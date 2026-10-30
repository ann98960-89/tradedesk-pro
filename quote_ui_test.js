/* 报价模块界面层 DOM 测试（jsdom）：验证 13 列明细表渲染、实时价格回填、汇总区、保存 payload */
const fs = require('fs');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync('index.html', 'utf8');

const css    = (html.match(/<style[^>]*>([\s\S]*?)<\/style>/) || [])[1] || '';
const mStart = html.indexOf('<!-- ===== 报价管理模态框 ===== -->');
const mEnd   = html.indexOf('<!-- ===== 订单跟踪模态框 ===== -->');
const modal  = html.slice(mStart, mEnd);
const calcBlk = (html.match(/\/\* ==== QUOTE_CALC_V2_START ====[\s\S]*?\/\* ==== QUOTE_CALC_V2_END ==== \*\//) || [])[0];
const uiBlk   = (html.match(/\/\* ==== QUOTE_UI_V4_START ====[\s\S]*?\/\* ==== QUOTE_UI_V4_END ==== \*\//) || [])[0];
const sStart  = html.indexOf('async function saveQuote(isDraft) {');
const sEnd    = html.indexOf('function editQuote(id) {');
const saveBlk = html.slice(sStart, sEnd);

if (!modal || !calcBlk || !uiBlk || !saveBlk) {
  console.log('!! 提取失败', { modal: !!modal, calc: !!calcBlk, ui: !!uiBlk, save: !!saveBlk });
  process.exit(1);
}
console.log(`提取成功：modal ${modal.length}B / calc ${calcBlk.length}B / ui ${uiBlk.length}B / save ${saveBlk.length}B`);

const dom = new JSDOM(
  `<!DOCTYPE html><html><head><style>${css}</style></head><body>${modal}</body></html>`,
  { runScripts: 'dangerously' }
);
const { window } = dom;
const doc = window.document;

/* ---- 桩：业务依赖 ---- */
const stubs = `
var currentPage = 'quotes';
var allQuotes = [];
var _savedPayloads = [];
function showToast(m,t){ (_toasts = _toasts||[]).push(m); }
var _toasts = [];
function escHtml(s){ if(!s) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function formatDateInput(v){ if(!v) return ''; var d=new Date(Number(v)||v); return isNaN(d)?'':d.toISOString().slice(0,10); }
function generateQuoteNumber(){ return 'QT-TEST-001'; }
async function apiPut(t,i,p){ _savedPayloads.push({op:'put',table:t,id:i,payload:p}); return {}; }
async function apiPost(t,p){ _savedPayloads.push({op:'post',table:t,payload:p}); return {id:'new'}; }
async function loadQuotes(){}
function loadDashboard(){}
`;

const driver = `
var R = { pass:0, fail:0, msgs:[] };
function ok(name, cond, extra){ if(cond){R.pass++;} else {R.fail++; R.msgs.push('✗ '+name+(extra?(' | '+extra):''));} }
function near(name, got, want, tol){ tol=tol||0.011; ok(name, Math.abs(got-want)<=tol, 'got '+got+' want '+want); }
function txt(id){ var e=document.getElementById(id); return e? e.textContent.trim() : '(缺 '+id+')'; }
function val(id){ var e=document.getElementById(id); return e? e.value : '(缺 '+id+')'; }
function cellText(tr, cls){ var e=tr.querySelector('.'+cls); return e? e.textContent.trim() : '(缺 '+cls+')'; }
function numOf(s){ var m=String(s).replace(/,/g,'').match(/-?\\d+(\\.\\d+)?/); return m? parseFloat(m[0]) : NaN; }

/* ===== 1. 新建报价单：默认一行 ===== */
openQuoteModal(null);
var rows = document.querySelectorAll('#quote-items-tbody tr');
ok('新建时生成 1 行', rows.length===1, '实际 '+rows.length);
ok('表格 13 列', document.querySelectorAll('#quote-items-tbody tr:first-child td').length===13,
   '实际 '+document.querySelectorAll('#quote-items-tbody tr:first-child td').length);
ok('存在出厂价输入框', !!rows[0].querySelector('.qitem-factory'));
ok('存在溢价率输入框', !!rows[0].querySelector('.qitem-markup'));
ok('存在暗佣率输入框', !!rows[0].querySelector('.qitem-comm'));
ok('不存在旧单价输入框', !rows[0].querySelector('.qitem-price'));
ok('不存在旧成本输入框', !rows[0].querySelector('.qitem-cost'));

/* ===== 2. 填入用户表格 4 行（CNY / CIF）===== */
document.getElementById('quote-currency').value = 'CNY';
document.getElementById('quote-incoterms').value = 'CIF';
onQuoteCurrencyChange();
ok('CNY 时汇率锁定为 1', val('quote-exchange-rate')==1 || val('quote-exchange-rate')==='1', val('quote-exchange-rate'));

var data = [
  {n:'KS76',   q:1.5,  f:8800,  mk:13.00, misc:587.5,  frt:672.75,  fob:10335.67, cif:10784.17},
  {n:'KSN766', q:11.25,f:15500, mk:7.50,  misc:3757,   frt:5045.00, fob:16996.46, cif:17444.90},
  {n:'KSN100', q:4.25, f:15000, mk:9.50,  misc:1481.25,frt:1906.00, fob:16773.53, cif:17222.00},
  {n:'KSS012', q:3,    f:9500,  mk:6.90,  misc:1075,   frt:1345.00, fob:10513.83, cif:10962.17}
];
var trs = document.querySelectorAll('#quote-items-tbody tr');
while (trs.length < 4) { addQuoteItem(); trs = document.querySelectorAll('#quote-items-tbody tr'); }
data.forEach(function(d,i){
  var tr = trs[i];
  tr.querySelector('.qitem-name').value = d.n;
  tr.querySelector('.qitem-qty').value = d.q;
  tr.querySelector('.qitem-factory').value = d.f;
  tr.querySelector('.qitem-markup').value = d.mk;
  tr.querySelector('.qitem-misc').value = d.misc;
  tr.querySelector('.qitem-misc-mode').value = 'total';
  tr.querySelector('.qitem-freight').value = d.frt;
  tr.querySelector('.qitem-freight-mode').value = 'total';
});
var sum = calcQuoteTotal();

console.log('\\n--- 逐行渲染结果 ---');
trs.forEach(function(tr,i){
  var d = data[i];
  var exw = cellText(tr,'qitem-exw'), fob = cellText(tr,'qitem-fob'), cif = cellText(tr,'qitem-cif');
  console.log(d.n.padEnd(8)+' EXW['+exw.replace(/\\s+/g,' ')+']  FOB['+fob.replace(/\\s+/g,' ')+']  CIF['+cif.replace(/\\s+/g,' ')+']');
  near(d.n+' FOB 主价', numOf(fob), d.fob, 0.011);
  near(d.n+' CIF 主价', numOf(cif), d.cif, 0.011);
  ok(d.n+' FOB 含 /kg 折算', fob.indexOf('/kg')>=0, fob);
  ok(d.n+' CIF 含 /kg 折算', cif.indexOf('/kg')>=0, cif);
});

/* ===== 3. 汇总区 ===== */
console.log('\\n--- 汇总区 ---');
console.log('出厂成本', txt('quote-sum-factory'), '| 溢价', txt('quote-sum-markup'), txt('quote-sum-markup-rate'),
            '| 暗佣', txt('quote-sum-comm'), '| 杂费', txt('quote-sum-misc'), '| 运费', txt('quote-sum-freight'));
console.log('报价合计', txt('quote-sum-total'), txt('quote-sum-total-label'), '| 溢价占报价', txt('quote-sum-share'),
            '| 成本口径', txt('quote-sum-cost'));
console.log('汇率提示', txt('quote-sum-rate-note'));

near('汇总 出厂成本', numOf(txt('quote-sum-factory')), 279825, 0.02);
near('汇总 溢价合计', numOf(txt('quote-sum-markup')), 22816.88, 0.02);
near('汇总 杂费合计', numOf(txt('quote-sum-misc')), 6900.75, 0.02);
near('汇总 运费合计', numOf(txt('quote-sum-freight')), 8968.75, 0.02);
near('汇总 报价合计', numOf(txt('quote-sum-total')), 318511.40, 0.02);
near('汇总 溢价占报价', numOf(txt('quote-sum-share')), 7.16, 0.02);
ok('汇总标签为 CIF', txt('quote-sum-total-label').indexOf('CIF')>=0, txt('quote-sum-total-label'));

/* ===== 4. 条款切换：FOB 时 CIF 列应隐藏 ===== */
document.getElementById('quote-incoterms').value = 'FOB';
calcQuoteTotal();
trs = document.querySelectorAll('#quote-items-tbody tr');
ok('FOB 条款 CIF 列显示 —', cellText(trs[0],'qitem-cif').indexOf('—')>=0, cellText(trs[0],'qitem-cif'));
ok('FOB 条款 FOB 列有价', numOf(cellText(trs[0],'qitem-fob'))>0, cellText(trs[0],'qitem-fob'));
near('FOB 条款报价合计 = 四行 FOB 总额', numOf(txt('quote-sum-total')), 15503.5+191210.175+71287.5+31541.49, 0.05);

/* ===== 5. EXW 条款：只有 EXW 档 ===== */
document.getElementById('quote-incoterms').value = 'EXW';
calcQuoteTotal();
trs = document.querySelectorAll('#quote-items-tbody tr');
ok('EXW 条款 FOB 列显示 —', cellText(trs[0],'qitem-fob').indexOf('—')>=0, cellText(trs[0],'qitem-fob'));
near('EXW 条款报价 = 四行 EXW 总额', numOf(txt('quote-sum-total')), 14916+187453.125+69806.25+30466.5, 0.05);

/* ===== 6. 单位 PC：/kg 隐藏 ===== */
document.getElementById('quote-incoterms').value = 'CIF';
trs = document.querySelectorAll('#quote-items-tbody tr');
trs[0].querySelector('.qitem-unit').value = 'PC';
calcQuoteTotal();
ok('PC 单位无 /kg 折算', cellText(trs[0],'qitem-cif').indexOf('/kg')<0, cellText(trs[0],'qitem-cif'));
trs[0].querySelector('.qitem-unit').value = 'MT';
calcQuoteTotal();

/* ===== 7. 费用模式切换：总额 ↔ 单价 ===== */
trs = document.querySelectorAll('#quote-items-tbody tr');
var tr0 = trs[0];
var before = numOf(txt('quote-sum-misc'));
tr0.querySelector('.qitem-misc-mode').value = 'unit';
tr0.querySelector('.qitem-misc').value = (587.5/1.5).toFixed(6);
calcQuoteTotal();
var after = numOf(txt('quote-sum-misc'));
near('总额→单价 换算一致', after, before, 0.02);
ok('单价模式下显示合计提示', (tr0.querySelector('.qitem-misc-hint').textContent||'').indexOf('合')>=0,
   tr0.querySelector('.qitem-misc-hint').textContent);
tr0.querySelector('.qitem-misc-mode').value = 'total';
tr0.querySelector('.qitem-misc').value = 587.5;
calcQuoteTotal();

/* ===== 8. 币种 USD + 汇率 ===== */
document.getElementById('quote-currency').value = 'USD';
onQuoteCurrencyChange();
document.getElementById('quote-exchange-rate').value = 6.55;
document.getElementById('quote-actual-rate').value = 6.60;
calcQuoteTotal();
trs = document.querySelectorAll('#quote-items-tbody tr');
near('USD CIF 价 = 10784.17/6.55', numOf(cellText(trs[0],'qitem-cif')), 10784.17/6.55, 0.02);
ok('USD 报价带 $ 符号', cellText(trs[0],'qitem-cif').indexOf('$')>=0, cellText(trs[0],'qitem-cif'));
ok('安全垫提示出现', txt('quote-sum-rate-note').indexOf('安全垫')>=0, txt('quote-sum-rate-note'));
console.log('汇率提示(USD)：', txt('quote-sum-rate-note').replace(/\\s+/g,' '));

/* ===== 9. 保存 payload ===== */
document.getElementById('quote-customer').value = 'TEST CUSTOMER';
document.getElementById('quote-notes').value = 'dom test';
await saveQuote(false);
var last = _savedPayloads[_savedPayloads.length-1];
ok('保存调用了 apiPost', !!last && last.op==='post', JSON.stringify(last&&last.op));
var p = last.payload;
ok('payload 不含 subtotal', !('subtotal' in p));
ok('payload 不含 version', !('version' in p));
ok('payload 不含 commission_rate', !('commission_rate' in p));
/* 落库总额必须等于界面上的报价合计（否则列表页与单页会差几分） */
near('payload.total_amount = 界面报价合计', p.total_amount, calcQuoteTotal().quoted, 0.001);
near('payload.margin_rate = 加权溢价率', p.margin_rate, 8.154, 0.01);
near('payload.commission = 暗佣合计', p.commission, 0, 0.001);
near('payload.other_cost = 杂费合计', p.other_cost, 6900.75, 0.02);
near('payload.freight = 运费合计', p.freight, 8968.75, 0.02);
near('payload.total_cost = 出厂+杂费+运费', p.total_cost, 279825+6900.75+8968.75, 0.02);
var itemsObj = JSON.parse(p.items);
ok('items.schema = 2', itemsObj.schema===2);
ok('items.meta 存了汇率', itemsObj.meta.exchange_rate===6.55, JSON.stringify(itemsObj.meta));
ok('items.meta 存了版本', itemsObj.meta.version===1, JSON.stringify(itemsObj.meta));
ok('items.lines 4 行', itemsObj.lines.length===4, String(itemsObj.lines.length));
ok('lines 有 factory_price', itemsObj.lines[0].factory_price===8800);
ok('lines 有 markup_rate', itemsObj.lines[0].markup_rate===13);
ok('lines 有 misc_total', Math.abs(itemsObj.lines[0].misc_total-587.5)<0.01);
console.log('\\npayload 字段：', Object.keys(p).sort().join(','));

/* ===== 10. 重新打开编辑：数据回填 ===== */
var fakeQuote = {
  id:'q1', quote_number:'QT-20261030-001', customer_name:'ACME', currency:'USD', incoterms:'CIF',
  quote_date: Date.now(), valid_until: Date.now()+86400000, status:'草稿',
  payment_terms:'T/T 30% deposit, 70% before shipment', delivery_time:'30 days', origin_port:'Shanghai',
  items: p.items, notes:'reload test'
};
openQuoteModal(fakeQuote);
trs = document.querySelectorAll('#quote-items-tbody tr');
ok('回填 4 行', trs.length===4, String(trs.length));
ok('回填产品名', trs[0].querySelector('.qitem-name').value==='KS76', trs[0].querySelector('.qitem-name').value);
ok('回填出厂价', Number(trs[0].querySelector('.qitem-factory').value)===8800, trs[0].querySelector('.qitem-factory').value);
ok('回填溢价率', Number(trs[0].querySelector('.qitem-markup').value)===13, trs[0].querySelector('.qitem-markup').value);
ok('回填汇率', Number(val('quote-exchange-rate'))===6.55, val('quote-exchange-rate'));
ok('回填实际汇率', Number(val('quote-actual-rate'))===6.60, val('quote-actual-rate'));
ok('回填客户', val('quote-customer')==='ACME', val('quote-customer'));
ok('回填后价格重算正确', Math.abs(numOf(cellText(trs[0],'qitem-cif'))-10784.17/6.55)<0.02, cellText(trs[0],'qitem-cif'));

/* ===== 11. 保存后重新打开，数值不漂移 ===== */
var sum2 = calcQuoteTotal();
/* 保存 → 重新打开，数值零漂移（存的就是界面上的数） */
near('回填后汇总与保存值一致', sum2.quoted, p.total_amount, 0.001);

/* ===== 12. 校验：缺客户 / 缺汇率 ===== */
_savedPayloads.length = 0; _toasts.length = 0;
document.getElementById('quote-customer').value = '';
await saveQuote(false);
ok('缺客户时不保存', _savedPayloads.length===0);
ok('缺客户有提示', _toasts.join('|').indexOf('客户')>=0, _toasts.join('|'));
document.getElementById('quote-customer').value = 'X';
document.getElementById('quote-exchange-rate').value = '';
await saveQuote(false);
ok('缺汇率时不保存', _savedPayloads.length===0, JSON.stringify(_savedPayloads.length));
ok('缺汇率有提示', _toasts.join('|').indexOf('汇率')>=0, _toasts.join('|'));

/* ===== 13. 删除行 ===== */
openQuoteModal(null);
var n0 = document.querySelectorAll('#quote-items-tbody tr').length;
addQuoteItem(); addQuoteItem();
var n1 = document.querySelectorAll('#quote-items-tbody tr').length;
ok('添加行生效', n1===n0+2, n0+'→'+n1);
document.querySelectorAll('#quote-items-tbody tr')[0].remove();
calcQuoteTotal();
ok('删除行生效', document.querySelectorAll('#quote-items-tbody tr').length===n1-1);


/* ===== 14. 杂费明细加总器 ===== */
openQuoteModal(null);
document.getElementById('quote-incoterms').value = 'CIF';
document.getElementById('quote-currency').value = 'CNY';
onQuoteCurrencyChange();
var tr = document.querySelectorAll('#quote-items-tbody tr')[0];
tr.querySelector('.qitem-name').value = 'KS76';
tr.querySelector('.qitem-qty').value = 1.5;
tr.querySelector('.qitem-factory').value = 8800;
tr.querySelector('.qitem-markup').value = 13;
calcQuoteTotal();

var link = tr.querySelector('.qitem-misc-link');
ok('杂费单元格有明细入口', !!link);
ok('未填明细时显示"加明细"', link.textContent.indexOf('加明细')>=0, link.textContent);

function rowNamesOf(){
  return Array.prototype.map.call(
    document.querySelectorAll('#misc-itemizer-rows > div > div:first-child'),
    function(e){ return e.textContent; });
}
function inputsOf(){ return Array.prototype.slice.call(document.querySelectorAll('#misc-itemizer-rows .mi-amount')); }

openMiscItemizer(link);
ok('加总器弹窗已打开', document.getElementById('misc-itemizer-modal').classList.contains('active'));
var names = rowNamesOf();
ok('CIF 含保险费项', names.indexOf('保险费')>=0, names.join('/'));
ok('CIF 含码头及货代费', names.indexOf('码头及货代费')>=0);
ok('CIF 明细项 6 个', names.length===6, names.length);

var ins = inputsOf();
var idx = {}; names.forEach(function(n,i){ idx[n]=i; });
ins[idx['内陆运费']].value = 300;
ins[idx['进仓费']].value = 120;
ins[idx['报关费']].value = 150;
ins[idx['码头及货代费']].value = 17.5;
ins[idx['保险费']].value = 0;
recalcMiscItemizer();
near('合计实时计算 587.5', numOf(txt('misc-itemizer-total')), 587.5, 0.01);

applyMiscItems();
near('应用后杂费输入框 = 587.5', Number(tr.querySelector('.qitem-misc').value), 587.5, 0.01);
ok('应用后输入框锁定', tr.querySelector('.qitem-misc').readOnly===true);
ok('应用后明细 4 项', tr._miscItems.length===4, JSON.stringify(tr._miscItems));
ok('明细入口显示"4 项"', tr.querySelector('.qitem-misc-link').textContent.indexOf('4 项')>=0,
   tr.querySelector('.qitem-misc-link').textContent);
ok('应用后弹窗关闭', !document.getElementById('misc-itemizer-modal').classList.contains('active'));
near('汇总杂费 = 587.5', numOf(txt('quote-sum-misc')), 587.5, 0.01);

/* FOB 条款不应出现保险费 */
document.getElementById('quote-incoterms').value = 'FOB';
calcQuoteTotal();
openMiscItemizer(tr.querySelector('.qitem-misc-link'));
var names2 = rowNamesOf();
ok('FOB 无保险费项', names2.indexOf('保险费')<0, names2.join('/'));
ok('FOB 明细项 5 个', names2.length===5, names2.length);
closeMiscItemizer();

/* 清除明细 */
document.getElementById('quote-incoterms').value = 'CIF';
calcQuoteTotal();
openMiscItemizer(tr.querySelector('.qitem-misc-link'));
clearMiscItems();
ok('清除后输入框解锁', tr.querySelector('.qitem-misc').readOnly===false);
ok('清除后明细为空', tr._miscItems.length===0);
ok('清除后杂费归零', numOf(txt('quote-sum-misc'))===0, txt('quote-sum-misc'));

/* EXW 条款拒绝加明细 */
document.getElementById('quote-incoterms').value = 'EXW';
_toasts.length = 0;
openMiscItemizer(tr.querySelector('.qitem-misc-link'));
ok('EXW 拒绝打开加总器', !document.getElementById('misc-itemizer-modal').classList.contains('active'));
ok('EXW 有提示', _toasts.join('|').indexOf('杂费')>=0, _toasts.join('|'));

/* 明细随保存落库，保险费单列 */
document.getElementById('quote-incoterms').value = 'CIF';
calcQuoteTotal();
openMiscItemizer(tr.querySelector('.qitem-misc-link'));
var names3 = rowNamesOf();
var ins3 = inputsOf();
ins3[names3.indexOf('报关费')].value = 150;
ins3[names3.indexOf('保险费')].value = 200;
applyMiscItems();
document.getElementById('quote-customer').value = 'X';
document.getElementById('quote-currency').value = 'CNY';
onQuoteCurrencyChange();
_savedPayloads.length = 0;
await saveQuote(false);
var pl = _savedPayloads[0].payload;
var io2 = JSON.parse(pl.items);
ok('落库 misc_items 2 项', io2.lines[0].misc_items.length===2, JSON.stringify(io2.lines[0].misc_items));
near('保险费单列落库 200', pl.insurance, 200, 0.01);
near('other_cost = 全部杂费 350', pl.other_cost, 350, 0.01);

/* 重新打开后明细与锁定状态保持 */
openQuoteModal({ id:'z1', quote_number:'QT-Z', customer_name:'Z', currency:'CNY', incoterms:'CIF',
  items: pl.items, status:'草稿' });
var tr2 = document.querySelectorAll('#quote-items-tbody tr')[0];
ok('回填后明细保留 2 项', tr2._miscItems.length===2, JSON.stringify(tr2._miscItems));
ok('回填后输入框仍锁定', tr2.querySelector('.qitem-misc').readOnly===true);
near('回填后杂费 350', Number(tr2.querySelector('.qitem-misc').value), 350, 0.01);
ok('回填后入口显示"2 项"', tr2.querySelector('.qitem-misc-link').textContent.indexOf('2 项')>=0);



/* ===== 15. 换条款时提示不适用的费用项 ===== */
document.getElementById('quote-currency').value = 'CNY';
onQuoteCurrencyChange();
openQuoteModal(null);
var tr3 = document.querySelectorAll('#quote-items-tbody tr')[0];
tr3.querySelector('.qitem-name').value = 'X';
tr3.querySelector('.qitem-qty').value = 1;
tr3.querySelector('.qitem-factory').value = 1000;
document.getElementById('quote-incoterms').value = 'CIF';
calcQuoteTotal();
openMiscItemizer(tr3.querySelector('.qitem-misc-link'));
var n3 = rowNamesOf(), i3 = inputsOf();
i3[n3.indexOf('保险费')].value = 100;
applyMiscItems();

_toasts.length = 0;
document.getElementById('quote-incoterms').value = 'FOB';
onQuoteTermChange();
ok('换条款提示保险费不适用', _toasts.join('|').indexOf('保险费')>=0, _toasts.join('|'));
ok('提示带行号', _toasts.join('|').indexOf('第 1 行')>=0, _toasts.join('|'));

_toasts.length = 0;
document.getElementById('quote-incoterms').value = 'CIF';
onQuoteTermChange();
ok('改回 CIF 不再告警', _toasts.length===0, _toasts.join('|'));

_toasts.length = 0;
document.getElementById('quote-incoterms').value = 'EXW';
onQuoteTermChange();
ok('改为 EXW 也告警', _toasts.join('|').indexOf('不再适用')>=0, _toasts.join('|'));


document.body.setAttribute('data-result', JSON.stringify(R));
`;

const script = doc.createElement('script');
script.textContent = stubs + '\n' + calcBlk + '\n' + uiBlk + '\n' + saveBlk + '\n(async function(){' + driver + '\n})();';
doc.body.appendChild(script);

setTimeout(() => {
  const raw = doc.body.getAttribute('data-result');
  if (!raw) { console.log('!! 驱动脚本未完成（可能有异常）'); process.exit(1); }
  const R = JSON.parse(raw);
  if (R.msgs.length) R.msgs.forEach(m => console.log('  ' + m));
  console.log(`\n=========== 界面层 通过 ${R.pass} / 失败 ${R.fail} ===========`);
  process.exit(R.fail ? 1 : 0);
}, 600);
