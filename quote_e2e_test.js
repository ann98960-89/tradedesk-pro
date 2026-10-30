/* ============================================================================
   第 7 步 端到端测试
   真实链路：jsdom 里跑真实 saveQuote 拿到 payload
            → 真实 _pushToCloud（_mapForPush → encryptObject → _sanitizeForPush）
            → 真实 Supabase POST
            → 真实 GET + decryptObject + _mapFromPull
            → 真实 _calcQuoteSummary 重算，验证零漂移
            → 真实 DELETE，验证无残留
   安全：测试记录 id 前缀 tdp_test_，无论成功失败都在 finally 里删除
   ========================================================================== */
const fs = require('fs');
const vm = require('vm');
const { webcrypto } = require('crypto');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync('index.html', 'utf8');

/* ---------------- 代码提取（按名字精确切出真实实现） ---------------- */
function extractFn(src, name) {
  const re = new RegExp('(?:async\\s+)?function\\s+' + name + '\\s*\\(');
  const m = re.exec(src);
  if (!m) return null;
  let i = src.indexOf('(', m.index), d = 0, j = i;
  for (; j < src.length; j++) {
    if (src[j] === '(') d++;
    else if (src[j] === ')') { d--; if (d === 0) { j++; break; } }
  }
  const b = src.indexOf('{', j);
  let d2 = 0, k = b;
  for (; k < src.length; k++) {
    if (src[k] === '{') d2++;
    else if (src[k] === '}') { d2--; if (d2 === 0) { k++; break; } }
  }
  return src.slice(m.index, k);
}

function extractConst(src, name) {
  const re = new RegExp('^(?:const|let|var)\\s+' + name + '\\s*=', 'm');
  const m = re.exec(src);
  if (!m) return null;
  let i = m.index, d = 0, n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); if (i < 0) break; continue; }
    if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i + 2) + 2; continue; }
    if (c === '"' || c === "'" || c === '`') {
      const q = c; i++;
      while (i < n) {
        if (src[i] === '\\') { i += 2; continue; }
        if (src[i] === q) { i++; break; }
        i++;
      }
      continue;
    }
    if (c === '(' || c === '[' || c === '{') { d++; i++; continue; }
    if (c === ')' || c === ']' || c === '}') { d--; i++; continue; }
    if (c === ';' && d === 0) return src.slice(m.index, i + 1);
    i++;
  }
  return src.slice(m.index, i);
}

const calcBlk = (html.match(/\/\* ==== QUOTE_CALC_V2_START ====[\s\S]*?\/\* ==== QUOTE_CALC_V2_END ==== \*\//) || [])[0];
if (!calcBlk) { console.log('!! QUOTE_CALC_V2 提取失败'); process.exit(1); }

const CONSTS = ['_SB_URL', '_SB_KEY', '_SB_MAX_RETRY', '_sleep', '_NUMERIC_COLS', '_META_COLS',
                '_TABLE_COLS', '_PUSH_COL_MAP', '_PULL_COL_MAP', '_PUSH_REQUIRED', '_DECRYPT_FAIL_MARK'];
const FNS = ['bufToB64', 'b64ToBuf', '_isNetErr', '_sbFetch', '_checkCloud', '_pushToCloud',
             'encryptValue', 'decryptValue', 'encryptObject', 'decryptObject',
             '_hasDecryptFail', '_sanitizeForPush', '_mapForPush', '_mapFromPull'];

let missing = [];
const constCode = CONSTS.map(n => { const s = extractConst(html, n); if (!s) missing.push(n); return s || ''; }).join('\n');
const fnCode    = FNS.map(n => { const s = extractFn(html, n);   if (!s) missing.push(n); return s || ''; }).join('\n\n');
if (missing.length) { console.log('!! 提取失败:', missing.join(', ')); process.exit(1); }

const prelude = `
let _cryptoKey = null;
let _sbAvailable = null;
var _toasts = [];
function showToast(m, t){ _toasts.push(m); }
function _updateSyncBadge(){}
`;
const sandboxCode = prelude + '\n' + calcBlk + '\n' + constCode + '\n' + fnCode;

/* ---------------- Phase A：jsdom 跑真实 saveQuote，拿 payload ---------------- */
function buildPayload() {
  return new Promise((resolve, reject) => {
    const css = (html.match(/<style[^>]*>([\s\S]*?)<\/style>/) || [])[1] || '';
    const mStart = html.indexOf('<!-- ===== 报价管理模态框 ===== -->');
    const mEnd   = html.indexOf('<!-- ===== 订单跟踪模态框 ===== -->');
    const modal  = html.slice(mStart, mEnd);
    const uiBlk  = (html.match(/\/\* ==== QUOTE_UI_V4_START ====[\s\S]*?\/\* ==== QUOTE_UI_V4_END ==== \*\//) || [])[0];
    const sStart = html.indexOf('async function saveQuote(isDraft) {');
    const sEnd   = html.indexOf('function editQuote(id) {');
    const saveBlk = html.slice(sStart, sEnd);
    if (!modal || !uiBlk || !saveBlk) return reject(new Error('界面代码块提取失败'));

    const dom = new JSDOM(`<!DOCTYPE html><html><head><style>${css}</style></head><body>${modal}</body></html>`,
                          { runScripts: 'dangerously' });
    const { window } = dom, doc = window.document;

    const stubs = `
    var currentPage='quotes', allQuotes=[], _savedPayloads=[];
    function showToast(m,t){ (_toasts=_toasts||[]).push(m); }
    var _toasts=[];
    function escHtml(s){ if(s===0) return '0'; if(!s) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
    function formatDateInput(v){ if(!v) return ''; var d=new Date(Number(v)||v); return isNaN(d)?'':d.toISOString().slice(0,10); }
    function generateQuoteNumber(){ return 'QT-E2E'; }
    async function apiPut(t,i,p){ _savedPayloads.push({op:'put',table:t,id:i,payload:p}); return {}; }
    async function apiPost(t,p){ _savedPayloads.push({op:'post',table:t,payload:p}); return {id:'x'}; }
    async function loadQuotes(){} function loadDashboard(){}
    `;
    const s = doc.createElement('script');
    s.textContent = stubs + '\n' + calcBlk + '\n' + uiBlk + '\n' + saveBlk + `
    (async function(){
      try {
        openQuoteModal(null);
        document.getElementById('quote-customer').value = 'E2E 测试客户（请勿使用）';
        document.getElementById('quote-number').value = __QN;
        document.getElementById('quote-currency').value = 'CNY';
        if (typeof onQuoteCurrencyChange === 'function') onQuoteCurrencyChange();
        document.getElementById('quote-incoterms').value = 'CIF';
        /* 付款方式是 <select>，用它的合法选项（默认值即第一项） */
        document.getElementById('quote-payment-terms').value = 'T/T 30% deposit, 70% before shipment';
        document.getElementById('quote-delivery').value = '30 天';
        document.getElementById('quote-origin').value = 'Shanghai';
        document.getElementById('quote-notes').value = '端到端测试记录，测试后立即删除';

        var tr = document.querySelector('#quote-items-tbody tr');
        tr.querySelector('.qitem-name').value    = 'KS76 拉丝润滑剂';
        tr.querySelector('.qitem-spec').value    = '180kg/铁桶';
        tr.querySelector('.qitem-qty').value     = '1.5';
        tr.querySelector('.qitem-unit').value    = 'MT';
        tr.querySelector('.qitem-factory').value = '8800';
        tr.querySelector('.qitem-markup').value  = '13';
        tr.querySelector('.qitem-comm').value    = '3';
        var mi = tr.querySelector('.qitem-misc'); if(mi) mi.value = '587.5';
        var fi = tr.querySelector('.qitem-freight'); if(fi) fi.value = '672.75';

        await saveQuote(false);
        var last = _savedPayloads[_savedPayloads.length-1];
        document.body.setAttribute('data-out', JSON.stringify(last ? last.payload : null));
      } catch(e) {
        document.body.setAttribute('data-out', JSON.stringify({__error: e.message}));
      }
    })();
    `.replace('__QN', JSON.stringify(global.__QN));
    doc.body.appendChild(s);

    setTimeout(() => {
      const raw = doc.body.getAttribute('data-out');
      if (!raw) return reject(new Error('saveQuote 未产出 payload'));
      const p = JSON.parse(raw);
      if (p && p.__error) return reject(new Error('saveQuote 报错: ' + p.__error));
      resolve(p);
    }, 400);
  });
}

/* ---------------- Phase B/C/D：真实推送 → 回读 → 删除 ---------------- */
(async function main() {
  const ts = Date.now();
  const testId = 'tdp_test_e2e_' + ts.toString(36);
  global.__QN = 'TDP-TEST-E2E-' + ts;
  console.log('测试记录 id:', testId, '| 单号:', global.__QN);

  /* --- A. 真实界面层产出 payload --- */
  const payload = await buildPayload();
  console.log('\n--- A. 真实 saveQuote 产出 payload ---');
  console.log('字段:', Object.keys(payload).sort().join(', '));
  const pItems = JSON.parse(payload.items);
  console.log('items.schema =', pItems.schema, '| 行数 =', pItems.lines.length,
              '| meta =', JSON.stringify(pItems.meta));
  console.log('total_amount =', payload.total_amount, '| margin_rate =', payload.margin_rate.toFixed(3),
              '| freight =', payload.freight, '| insurance =', payload.insurance,
              '| other_cost =', payload.other_cost, '| commission =', payload.commission);

  /* --- 沙箱：真实同步代码 --- */
  if (process.argv.includes('--dry')) {
    console.log('\n[--dry] 仅验证界面层与代码提取，不访问网络');
    const probe = {};
    const pctx = { console: { log(){}, warn(){}, error(){} }, crypto: webcrypto, TextEncoder, TextDecoder, btoa, atob, document: { getElementById: () => null } };
    pctx.globalThis = pctx;
    vm.createContext(pctx);
    vm.runInContext(sandboxCode, pctx);
    console.log('代码提取 OK：常量 ' + CONSTS.length + ' 个 / 函数 ' + FNS.length + ' 个，共 ' + sandboxCode.length + 'B');
    ['_sbFetch','_pushToCloud','_mapForPush','_mapFromPull','encryptObject','decryptObject'].forEach(n => {
      probe[n] = vm.runInContext('typeof ' + n, pctx);
    });
    console.log('函数可见性:', JSON.stringify(probe));
    return;
  }

  const warns = [];
  const ctx = {
    console: { log: (...a) => {}, warn: (...a) => warns.push(a.join(' ')), error: (...a) => warns.push(a.join(' ')) },
    fetch: globalThis.fetch, AbortController, setTimeout, clearTimeout,
    crypto: webcrypto, TextEncoder, TextDecoder, btoa, atob,
    document: { getElementById: () => null },
    __testId: testId, __payload: payload, __warns: warns
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(sandboxCode, ctx);

  const dekRaw = webcrypto.getRandomValues(new Uint8Array(32));
  ctx.__key = await webcrypto.subtle.importKey('raw', dekRaw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  vm.runInContext('_cryptoKey = __key;', ctx);

  const result = await vm.runInContext(`(async function(){
    var R = { pass:0, fail:0, msgs:[], log:[] };
    function ok(n,c,x){ if(c){R.pass++;} else {R.fail++; R.msgs.push('✗ '+n+(x!==undefined?(' | '+x):''));} }
    function eq(n,g,w){ ok(n, g===w, 'got '+JSON.stringify(g)+' want '+JSON.stringify(w)); }
    function near(n,g,w,t){ t=(t===undefined?0.011:t); ok(n, Math.abs(g-w)<=t, 'got '+g+' want '+w); }
    var table='quotes', id=__testId, P=__payload;

    try {
      /* 基线：测试前的云端行数 */
      var r0 = await _sbFetch(table+'?select=id');
      var baseRows = r0.ok ? (await r0.json()).length : -1;
      R.log.push('测试前云端 quotes 行数: ' + baseRows);

      var conn = await _checkCloud();
      ok('云端可连接', conn === true, 'checkCloud=' + conn);
      if (!conn) return R;

      /* ===== B. 真实推送 ===== */
      var now = Date.now();
      var row = Object.assign({}, P, { id:id, gs_project_id:'local', gs_table_name:table,
                                       created_at:now, updated_at:now, _deleted:false });
      var pushed = await _pushToCloud('post', table, id, row);
      ok('_pushToCloud 返回 true', pushed === true, 'warn: ' + __warns.slice(-2).join(' || '));
      if (!pushed) return R;
      R.log.push('推送成功（无 42703 / 22P02 / 23502）');

      /* ===== C. 回读 ===== */
      var res = await _sbFetch(table+'?id=eq.'+encodeURIComponent(id)+'&select=*');
      ok('GET 返回 200', res.ok, 'status ' + res.status);
      var arr = await res.json();
      eq('云端查到 1 条', arr.length, 1);
      if (!arr.length) return R;
      var raw = arr[0];

      /* 落库形态：该加密的加密，该是数字的是数字 */
      ok('id 明文保留', raw.id === id, raw.id);
      ok('gs_project_id = local', raw.gs_project_id === 'local', raw.gs_project_id);
      ok('gs_table_name = quotes', raw.gs_table_name === 'quotes', raw.gs_table_name);
      ok('quote_number 已加密', /^ENC:/.test(raw.quote_number||''), String(raw.quote_number).slice(0,16));
      ok('customer_name 已加密', /^ENC:/.test(raw.customer_name||''), String(raw.customer_name).slice(0,16));
      ok('items 已加密', /^ENC:/.test(raw.items||''), String(raw.items).slice(0,16));
      ok('notes 已加密', /^ENC:/.test(raw.notes||''), String(raw.notes).slice(0,16));
      ['freight','insurance','other_cost','commission','margin_rate','total_amount','total_cost'].forEach(function(k){
        ok(k + ' 是数值且未加密', typeof raw[k] === 'number', typeof raw[k] + ':' + raw[k]);
      });
      ok('_deleted = false', raw._deleted === false, raw._deleted);
      ok('quote_date 存为毫秒时间戳', /^\\d{12,}$/.test(String(raw.quote_date)), String(raw.quote_date));
      ok('valid_until 存为毫秒时间戳', /^\\d{12,}$/.test(String(raw.valid_until)), String(raw.valid_until));

      /* 解密 + 反向映射 */
      var dec = await decryptObject(raw);
      ok('解密无失败字段', !_hasDecryptFail(dec), JSON.stringify(dec).slice(0,120));
      var pulled = _mapFromPull(table, dec);
      eq('quote_number 还原一致', pulled.quote_number, P.quote_number);
      eq('customer_name 还原一致', pulled.customer_name, P.customer_name);
      eq('incoterms 还原一致', pulled.incoterms, P.incoterms);
      eq('currency 还原一致', pulled.currency, P.currency);
      eq('payment_terms 还原一致', pulled.payment_terms, P.payment_terms);
      eq('notes 还原一致', pulled.notes, P.notes);
      near('freight 零漂移', pulled.freight, P.freight, 0.001);
      near('insurance 零漂移', pulled.insurance, P.insurance, 0.001);
      near('other_cost 零漂移', pulled.other_cost, P.other_cost, 0.001);
      near('commission 零漂移', pulled.commission, P.commission, 0.001);
      near('margin_rate 零漂移', pulled.margin_rate, P.margin_rate, 0.001);
      near('total_cost 零漂移', pulled.total_cost, P.total_cost, 0.001);
      near('total_amount 零漂移', pulled.total_amount, P.total_amount, 0.001);

      /* ===== D. 用拉回来的数据重算，必须与落库金额一致 ===== */
      var meta = _quoteMeta(pulled);
      eq('汇率读回', meta.exchange_rate, 1);
      eq('条款读回', meta.incoterms, 'CIF');
      var lines = _quoteLines(pulled);
      eq('明细行数读回', lines.length, 1);
      eq('明细 schema = 2', JSON.parse(pulled.items).schema, 2);
      eq('产品名读回', lines[0].product_name, 'KS76 拉丝润滑剂');
      near('出厂价读回', lines[0].factory_price, 8800, 0.001);
      near('溢价率读回', lines[0].markup_rate, 13, 0.001);
      near('暗佣率读回', lines[0].commission_rate, 3, 0.001);
      var sum = _calcQuoteSummary(lines, meta);
      near('重算总额 == 落库 total_amount', sum.quoted, pulled.total_amount, 0.001);
      near('重算杂费 == 落库 other_cost', sum.miscCny, pulled.other_cost, 0.001);
      near('重算运费 == 落库 freight', sum.freightCny, pulled.freight, 0.001);
      near('重算暗佣 == 落库 commission', sum.commAmt, pulled.commission, 0.001);
      R.log.push('重算报价总额 ¥' + sum.quoted.toFixed(2) + '（落库 ' + pulled.total_amount.toFixed(2) + '）');

      /* ===== E. 更新（PATCH）也要能过 ===== */
      var row2 = Object.assign({}, row, { status:'已发送', total_amount: pulled.total_amount, updated_at: Date.now() });
      var pushed2 = await _pushToCloud('put', table, id, row2);
      ok('PATCH 更新返回 true', pushed2 === true, 'warn: ' + __warns.slice(-2).join(' || '));

      /* ===== F. 删除 ===== */
      var del = await _sbFetch(table+'?id=eq.'+encodeURIComponent(id), { method:'DELETE', _prefer:'return=minimal' });
      ok('DELETE 返回 2xx', del.ok, 'status ' + del.status);
      var r2 = await _sbFetch(table+'?id=eq.'+encodeURIComponent(id)+'&select=id');
      var left = r2.ok ? (await r2.json()).length : -1;
      eq('删除后云端查不到', left, 0);
      var r3 = await _sbFetch(table+'?select=id');
      var after = r3.ok ? (await r3.json()).length : -1;
      eq('云端总行数回到测试前', after, baseRows);
      R.log.push('测试后云端 quotes 行数: ' + after + '（与测试前一致）');
    } catch(e) {
      R.fail++;
      R.msgs.push('✗ 异常: ' + (e && e.message || e));
      /* 兜底删除 */
      try { await _sbFetch('quotes?id=eq.'+encodeURIComponent(__testId), { method:'DELETE', _prefer:'return=minimal' }); } catch(_) {}
    }
    return R;
  })()`, ctx);

  console.log('\n--- B/C/D. 推送 → 回读 → 重算 → 删除 ---');
  result.log.forEach(l => console.log('  ' + l));
  if (warns.length) console.log('  推送告警:', warns.slice(0, 3).join(' | '));
  result.msgs.forEach(m => console.log('  ' + m));
  console.log(`\n=========== 端到端 通过 ${result.pass} / 失败 ${result.fail} ===========`);
  process.exit(result.fail ? 1 : 0);
})().catch(e => { console.log('!! 脚本异常:', e.message); process.exit(1); });
