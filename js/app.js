/* ===================================================
   app.js - 全局公用工具函数 & 导航控制
   =================================================== */

// ===== 全局状态 =====
let currentPage = 'dashboard';
let currentDetailCustomerId = null;
let pendingDeleteFn = null;

const PAGE_TITLES = {
  dashboard: { title: '工作台总览', sub: '欢迎使用 TradeDesk Pro 外贸工作台 🌐' },
  todos:     { title: '每日待办事项', sub: '管理您的日常工作任务' },
  customers: { title: '客户列表', sub: '管理所有外贸客户信息' },
  pipeline:  { title: '销售漏斗', sub: '跟踪客户转化全流程' },
  followup:  { title: '跟进记录', sub: '记录每次客户沟通详情' },
  investigation: { title: '客户背调', sub: '调查客户背景与信用评估' },
  products:  { title: '产品资料数据库', sub: '管理 SDS / TDS / COA / Inspection Report 等文档' },
  selector:  { title: '拉丝工艺产品选型', sub: '根据生产工艺智能推荐最适合的润滑产品 🧪' },
  feedback:   { title: '试样反馈 & 改进方案', sub: '收集试样结果，智能驱动产品改进推荐 🔬' },
};

const ADD_ACTIONS = {
  todos:     () => openTodoModal(),
  customers: () => openCustomerModal(),
  pipeline:  () => openCustomerModal(),
  followup:  () => openFollowupModal(),
  investigation: () => openInvestigationModal(),
  products:  () => openDocModal(),
  selector:  () => {},
  feedback:  () => openFeedbackModal('', '', {}),
};

// ===== 页面切换 =====
function switchPage(page) {
  currentPage = page;

  // 更新导航激活状态
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });

  // 切换页面显示
  document.querySelectorAll('.page-content').forEach(el => {
    el.classList.toggle('active', el.id === `page-${page}`);
  });

  // 更新标题
  const info = PAGE_TITLES[page] || { title: page, sub: '' };
  document.getElementById('page-title').textContent = info.title;
  document.getElementById('page-subtitle').textContent = info.sub;

  // 关闭侧面板
  closeDetailPanel();
  closeSidebar();

  // 刷新对应页面数据
  const loaders = {
    dashboard:     loadDashboard,
    todos:         loadTodos,
    customers:     loadCustomers,
    pipeline:      loadPipeline,
    followup:      loadFollowups,
    investigation: loadInvestigations,
    products:      loadDocs,
    selector:      loadSelector,
    feedback:      loadFeedbackPage,
  };
  if (loaders[page]) loaders[page]();
}

function handleHeaderAdd() {
  const fn = ADD_ACTIONS[currentPage];
  if (fn) fn();
  else openTodoModal();
}

// ===== 侧边栏移动端 =====
function openSidebar() {
  document.getElementById('sidebar').classList.add('mobile-open');
  document.getElementById('sidebar-overlay').style.display = 'block';
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('mobile-open');
  document.getElementById('sidebar-overlay').style.display = 'none';
}

// ===== 通知 Toast =====
function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ===== 确认删除弹窗 =====
function showConfirm(message, onConfirm) {
  document.getElementById('confirm-message').textContent = message;
  pendingDeleteFn = onConfirm;
  document.getElementById('confirm-modal').classList.add('active');
  document.getElementById('confirm-delete-btn').onclick = () => {
    if (pendingDeleteFn) pendingDeleteFn();
    closeConfirmModal();
  };
}
function closeConfirmModal() {
  document.getElementById('confirm-modal').classList.remove('active');
  pendingDeleteFn = null;
}

// ===== 日期格式化 =====
function formatDate(ts) {
  if (!ts) return '-';
  const d = new Date(typeof ts === 'number' ? ts : ts);
  if (isNaN(d)) return ts;
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function formatDateInput(ts) {
  if (!ts) return '';
  const d = new Date(typeof ts === 'number' ? ts : ts);
  if (isNaN(d)) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function isOverdue(dateStr) {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date(new Date().toDateString());
}

function isDueToday(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const today = new Date();
  return d.getFullYear() === today.getFullYear() &&
         d.getMonth() === today.getMonth() &&
         d.getDate() === today.getDate();
}

function isDueSoon(dateStr, days = 3) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  const diff = (d - now) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= days;
}

// ===== 金额格式化 =====
function formatAmount(num) {
  if (!num && num !== 0) return '-';
  return '$' + Number(num).toLocaleString('en-US');
}

// ===== 阶段样式 =====
const STAGE_COLORS = {
  '初次接触': 'badge-gray',
  '需求确认': 'badge-primary',
  '样品寄送': 'badge-purple',
  '报价谈判': 'badge-warning',
  '下单确认': 'badge-warning',
  '生产跟进': 'badge-primary',
  '出货物流': 'badge-secondary',
  '回款完成': 'badge-success',
  '长期合作': 'badge-success',
};
const STAGE_ICONS = {
  '初次接触': '👋', '需求确认': '💬', '样品寄送': '📦',
  '报价谈判': '💰', '下单确认': '✅', '生产跟进': '🏭',
  '出货物流': '🚢', '回款完成': '💳', '长期合作': '🤝',
};
const STAGE_ORDER = ['初次接触','需求确认','样品寄送','报价谈判','下单确认','生产跟进','出货物流','回款完成','长期合作'];

function stageBadge(stage) {
  const cls = STAGE_COLORS[stage] || 'badge-gray';
  const icon = STAGE_ICONS[stage] || '';
  return `<span class="badge ${cls}">${icon} ${stage || '-'}</span>`;
}

// ===== 评级徽章 =====
function ratingBadge(r) {
  if (!r) return '-';
  return `<span class="rating-badge rating-${r}">${r}</span>`;
}

// ===== 信用评估徽章 =====
const CREDIT_MAP = {
  '安全':  { cls: 'badge-success', icon: '✅' },
  '厚道':  { cls: 'badge-primary', icon: '👍' },
  '注意':  { cls: 'badge-warning', icon: '⚠️' },
  '风险':  { cls: 'badge-danger',  icon: '🚨' },
};
function creditBadge(c) {
  if (!c) return '-';
  const m = CREDIT_MAP[c] || { cls: 'badge-gray', icon: '' };
  return `<span class="badge ${m.cls}">${m.icon} ${c}</span>`;
}

// ===== 文档类型徽章 =====
const DOC_TYPE_CLASS = {
  'SDS': 'doc-sds', 'TDS': 'doc-tds', 'COA': 'doc-coa',
  'Inspection-Report': 'doc-ir', '选型指南': 'doc-guide',
};
function docTypeBadge(t) {
  const cls = DOC_TYPE_CLASS[t] || 'doc-other';
  return `<span class="doc-type-badge ${cls}">${t || '-'}</span>`;
}

// ===== 全局搜索 =====
function globalSearch(val) {
  if (!val.trim()) return;
  // 在当前页触发搜索
  const searchMap = {
    todos: 'todo-search',
    customers: 'customer-search',
    followup: 'followup-search',
    investigation: 'inv-search',
    products: 'doc-search',
  };
  const inputId = searchMap[currentPage];
  if (inputId) {
    const el = document.getElementById(inputId);
    if (el) { el.value = val; el.dispatchEvent(new Event('input')); }
  }
}

// ===== 详情侧面板 =====
function openDetailPanel(customerId) {
  currentDetailCustomerId = customerId;
  document.getElementById('customer-detail-panel').classList.add('open');
  document.getElementById('detail-overlay').style.display = 'block';
  loadCustomerDetail(customerId);
  // 激活第一个tab
  switchDetailTab('info');
}
function closeDetailPanel() {
  currentDetailCustomerId = null;
  document.getElementById('customer-detail-panel').classList.remove('open');
  document.getElementById('detail-overlay').style.display = 'none';
}
function switchDetailTab(tab) {
  document.querySelectorAll('.detail-panel-body .tab-item').forEach((el, i) => {
    const tabs = ['info', 'followup', 'investigation'];
    el.classList.toggle('active', tabs[i] === tab);
  });
  document.querySelectorAll('.detail-panel-body .tab-panel').forEach(el => {
    el.classList.remove('active');
  });
  document.getElementById(`detail-${tab}-panel`).classList.add('active');
}

// ===== API 工具函数（含透明加解密拦截器）=====
// 读取：服务器返回密文 → 自动解密 → 返回明文
// 写入：明文数据 → 自动加密 → 发送密文

async function apiGet(table, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`tables/${table}${qs ? '?' + qs : ''}`);
  if (!res.ok) throw new Error(`API Error: ${res.status}`);
  const json = await res.json();
  // 过滤软删除记录 + 解密列表数据
  if (json.data && Array.isArray(json.data)) {
    json.data = json.data.filter(r => !r._deleted);
    json.data = await decryptArray(json.data);
  }
  return json;
}
async function apiGetOne(table, id) {
  const res = await fetch(`tables/${table}/${id}`);
  if (!res.ok) throw new Error(`API Error: ${res.status}`);
  const json = await res.json();
  return decryptObject(json);
}
async function apiPost(table, data) {
  const encrypted = await encryptObject(data);
  const res = await fetch(`tables/${table}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(encrypted),
  });
  if (!res.ok) throw new Error(`API Error: ${res.status}`);
  const json = await res.json();
  return decryptObject(json);
}
async function apiPut(table, id, data) {
  const encrypted = await encryptObject(data);
  const res = await fetch(`tables/${table}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(encrypted),
  });
  if (!res.ok) throw new Error(`API Error: ${res.status}`);
  const json = await res.json();
  return decryptObject(json);
}
async function apiDelete(table, id, label) {
  // 软删除：打标记而非真实删除，数据可从回收站恢复
  if (typeof softDelete === 'function') {
    const ok = await softDelete(table, id, label || id);
    if (!ok) throw new Error('软删除失败');
  } else {
    // 降级：直接删除
    const res = await fetch(`tables/${table}/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`API Error: ${res.status}`);
  }
}

// ===== 更新侧边栏徽章 =====
async function updateBadges() {
  try {
    const todosData = await apiGet('todos', { limit: 500 });
    const pending = (todosData.data || []).filter(t => t.status !== '已完成').length;
    const badge = document.getElementById('todo-badge');
    if (badge) { badge.textContent = pending; badge.style.display = pending > 0 ? '' : 'none'; }
  } catch(e) {}
  // Also update feedback badge
  if (typeof updateFeedbackBadge === 'function') updateFeedbackBadge();
}

// ===== HTML 转义 (全局使用) =====
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ===== 初始化 =====
document.addEventListener('DOMContentLoaded', () => {
  // ── 登录守卫：未登录立即跳转 ──
  if (typeof guardPage === 'function' && !guardPage()) return;

  // 今天日期填入默认值
  const today = new Date().toISOString().slice(0, 10);
  const dateFields = ['todo-due-date', 'f-date', 'inv-date'];
  dateFields.forEach(id => {
    const el = document.getElementById(id);
    if (el && !el.value) el.value = today;
  });

  // 加载首页
  loadDashboard();
  updateBadges();

  // 备份检查（登录后自动提醒）
  if (typeof initBackupCheck === 'function') initBackupCheck();
  // 回收站徽章
  if (typeof updateRecycleBadge === 'function') updateRecycleBadge();

  // 检查移动端
  if (window.innerWidth <= 900) {
    document.querySelector('.mobile-menu-btn').style.display = 'flex';
  }
  window.addEventListener('resize', () => {
    const btn = document.querySelector('.mobile-menu-btn');
    if (btn) btn.style.display = window.innerWidth <= 900 ? 'flex' : 'none';
  });

  // ESC 关闭模态框
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
      closeDetailPanel();
    }
  });
});
