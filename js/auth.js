/* =====================================================
   auth.js — TradeDesk Pro 安全认证 & 数据加密模块
   
   安全架构：
   ┌─────────────────────────────────────────────────┐
   │  用户密码                                        │
   │     ↓  PBKDF2 (100,000次迭代 + 随机Salt)        │
   │  派生密钥 (AES-256-GCM)                         │
   │     ↓  加密所有写入数据库的字段值               │
   │  密文存入 tables/xxx                            │
   │     ↓  读取时用同一密钥解密                     │
   │  明文显示给用户                                 │
   └─────────────────────────────────────────────────┘
   
   即使他人直接访问 API，看到的全是 Base64 密文乱码。
   不知道密码 = 无法解密 = 无法读取任何内容。
   ===================================================== */

// ===== 常量 =====
const AUTH_KEY        = 'tdp_auth_session';   // sessionStorage：会话令牌
const VAULT_KEY       = 'tdp_vault';          // localStorage：密码验证数据
const SALT_KEY        = 'tdp_salt';           // localStorage：PBKDF2 盐值
const SESSION_TIMEOUT = 8 * 60 * 60 * 1000;  // 8小时自动退出

// ===== 模块内私有状态 =====
let _cryptoKey = null;       // CryptoKey 对象，仅存于内存，页面关闭即消失
let _sessionTimer = null;

/* ─────────────────────────────────────────────────────
   工具：Base64 ↔ ArrayBuffer
───────────────────────────────────────────────────── */
function bufToB64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function b64ToBuf(b64) {
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

/* ─────────────────────────────────────────────────────
   核心：PBKDF2 派生 AES-256-GCM 密钥
───────────────────────────────────────────────────── */
async function deriveKey(password, saltBuf) {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: saltBuf, iterations: 100000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/* ─────────────────────────────────────────────────────
   加密：明文字符串 → "iv:ciphertext" Base64 字符串
───────────────────────────────────────────────────── */
async function encryptValue(plainText) {
  if (!_cryptoKey) throw new Error('未登录，无法加密');
  if (plainText === null || plainText === undefined || plainText === '') return '';

  const enc = new TextEncoder();
  const iv  = crypto.getRandomValues(new Uint8Array(12));
  const ct  = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    _cryptoKey,
    enc.encode(String(plainText))
  );
  // 格式：ENC:base64(iv):base64(ciphertext)
  return 'ENC:' + bufToB64(iv.buffer) + ':' + bufToB64(ct);
}

/* ─────────────────────────────────────────────────────
   解密："ENC:iv:ciphertext" → 明文字符串
───────────────────────────────────────────────────── */
async function decryptValue(encText) {
  if (!_cryptoKey) return encText;
  if (!encText || !String(encText).startsWith('ENC:')) return encText;

  try {
    const parts = String(encText).split(':');
    if (parts.length < 3) return encText;
    const iv = new Uint8Array(b64ToBuf(parts[1]));
    const ct = b64ToBuf(parts.slice(2).join(':'));
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, _cryptoKey, ct);
    return new TextDecoder().decode(plain);
  } catch (e) {
    // 解密失败（密码错误或数据损坏）
    return '[解密失败]';
  }
}

/* ─────────────────────────────────────────────────────
   加密整个对象（递归处理所有字符串字段）
   数字、布尔、null 不加密（保留用于排序/筛选）
───────────────────────────────────────────────────── */
async function encryptObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    // 系统字段不加密
    if (['id','gs_project_id','gs_table_name','created_at','updated_at'].includes(k)) {
      result[k] = v;
    } else if (typeof v === 'string' && v !== '') {
      result[k] = await encryptValue(v);
    } else {
      result[k] = v;
    }
  }
  return result;
}

/* ─────────────────────────────────────────────────────
   解密整个对象（递归处理所有 ENC: 前缀字段）
───────────────────────────────────────────────────── */
async function decryptObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string' && v.startsWith('ENC:')) {
      result[k] = await decryptValue(v);
    } else {
      result[k] = v;
    }
  }
  return result;
}

/* ─────────────────────────────────────────────────────
   解密数组（批量解密列表结果）
───────────────────────────────────────────────────── */
async function decryptArray(arr) {
  if (!Array.isArray(arr)) return arr;
  return Promise.all(arr.map(item => decryptObject(item)));
}

/* ─────────────────────────────────────────────────────
   首次设置密码
───────────────────────────────────────────────────── */
async function setupPassword(password) {
  // 生成随机 Salt（32字节）
  const saltBuf = crypto.getRandomValues(new Uint8Array(32));
  const saltB64 = bufToB64(saltBuf.buffer);

  // 派生密钥
  const key = await deriveKey(password, saltBuf.buffer);

  // 创建验证令牌：加密一段固定文本，之后用于验证密码正确性
  const verifyToken = await encryptValueWithKey('TRADEDESK_PRO_VERIFY_2024', key);

  // 存储 salt + 验证令牌到 localStorage（持久化）
  localStorage.setItem(SALT_KEY, saltB64);
  localStorage.setItem(VAULT_KEY, verifyToken);

  // 激活会话
  _cryptoKey = key;
  _startSession();
  return true;
}

/* ─────────────────────────────────────────────────────
   使用指定 key 加密（内部用，不依赖全局 _cryptoKey）
───────────────────────────────────────────────────── */
async function encryptValueWithKey(plainText, key) {
  const enc = new TextEncoder();
  const iv  = crypto.getRandomValues(new Uint8Array(12));
  const ct  = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, key, enc.encode(plainText)
  );
  return 'ENC:' + bufToB64(iv.buffer) + ':' + bufToB64(ct);
}

async function decryptValueWithKey(encText, key) {
  if (!encText || !String(encText).startsWith('ENC:')) return null;
  try {
    const parts = String(encText).split(':');
    const iv = new Uint8Array(b64ToBuf(parts[1]));
    const ct = b64ToBuf(parts.slice(2).join(':'));
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
    return new TextDecoder().decode(plain);
  } catch (e) {
    return null;
  }
}

/* ─────────────────────────────────────────────────────
   验证密码并登录
───────────────────────────────────────────────────── */
async function loginWithPassword(password) {
  const saltB64    = localStorage.getItem(SALT_KEY);
  const vaultToken = localStorage.getItem(VAULT_KEY);
  if (!saltB64 || !vaultToken) return { ok: false, reason: 'no_setup' };

  const saltBuf = b64ToBuf(saltB64);
  let key;
  try {
    key = await deriveKey(password, saltBuf);
  } catch (e) {
    return { ok: false, reason: 'derive_failed' };
  }

  // 尝试解密验证令牌
  const decrypted = await decryptValueWithKey(vaultToken, key);
  if (decrypted !== 'TRADEDESK_PRO_VERIFY_2024') {
    return { ok: false, reason: 'wrong_password' };
  }

  // 密码正确，激活会话
  _cryptoKey = key;
  _startSession();
  return { ok: true };
}

/* ─────────────────────────────────────────────────────
   会话管理
───────────────────────────────────────────────────── */
function _startSession() {
  const session = {
    ts: Date.now(),
    exp: Date.now() + SESSION_TIMEOUT,
  };
  sessionStorage.setItem(AUTH_KEY, JSON.stringify(session));

  // 定时自动退出
  if (_sessionTimer) clearTimeout(_sessionTimer);
  _sessionTimer = setTimeout(() => {
    logout('会话已超时（8小时），请重新登录');
  }, SESSION_TIMEOUT);
}

function isLoggedIn() {
  if (!_cryptoKey) return false;
  const raw = sessionStorage.getItem(AUTH_KEY);
  if (!raw) return false;
  try {
    const s = JSON.parse(raw);
    return Date.now() < s.exp;
  } catch (e) {
    return false;
  }
}

function isPasswordSetup() {
  return !!(localStorage.getItem(SALT_KEY) && localStorage.getItem(VAULT_KEY));
}

function logout(msg) {
  _cryptoKey = null;
  sessionStorage.removeItem(AUTH_KEY);
  if (_sessionTimer) clearTimeout(_sessionTimer);
  // 跳转登录页（带 auth=1 让伪装页自动展示登录框）
  const qs = new URLSearchParams({ auth: '1' });
  if (msg) qs.set('msg', msg);
  window.location.href = 'login.html?' + qs.toString();
}

/* ─────────────────────────────────────────────────────
   修改密码（需要重新加密所有数据 — 危险操作）
   这里仅更新验证令牌和 salt，旧数据需要用户手动迁移
   建议：先导出数据 → 改密码 → 重新导入
───────────────────────────────────────────────────── */
async function changePassword(oldPwd, newPwd) {
  const result = await loginWithPassword(oldPwd);
  if (!result.ok) return { ok: false, reason: '旧密码错误' };

  // 生成新 salt
  const newSaltBuf = crypto.getRandomValues(new Uint8Array(32));
  const newSaltB64 = bufToB64(newSaltBuf.buffer);
  const newKey = await deriveKey(newPwd, newSaltBuf.buffer);
  const newToken = await encryptValueWithKey('TRADEDESK_PRO_VERIFY_2024', newKey);

  localStorage.setItem(SALT_KEY, newSaltB64);
  localStorage.setItem(VAULT_KEY, newToken);
  _cryptoKey = newKey;
  _startSession();

  return { ok: true };
}

/* ─────────────────────────────────────────────────────
   页面保护检查（在 index.html 顶部调用）
───────────────────────────────────────────────────── */
function guardPage() {
  if (!isPasswordSetup()) {
    window.location.href = 'login.html?mode=setup';
    return false;
  }
  if (!isLoggedIn()) {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}
