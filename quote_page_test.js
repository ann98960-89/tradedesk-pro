/* 报价模块页面层测试：列表页 / 统计卡 / 客户预览 / Excel 导出（jsdom，加载完整 DOM，脚本手动注入） */
const fs = require('fs');
const { JSDOM } = require('jsdom');

const raw = fs.readFileSync('index.html', 'utf8');

/* 去掉所有 script 标签，只保留结构与样式 */
const noScript = raw.replace(/<script[\s\S]*?<\/script>/g, '');

/* 取出 quotes.js 所在的整个 script 块（含计算内核、界面层、保存、列表、预览、导出） */
const blocks = [...raw.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const quotesBlock = blocks.find(b => b.includes('quotes.js - 报价管理模块'));
if (!quotesBlock) { console.log('!! 未找到 quotes.js 块'); process.exit(1); }
console.log(`quotes.js 块 ${quotesBlock.length}B，DOM ${noScript.length}B`);

const dom = new JSDOM(noScript, { runScripts: 'dangerously' });
const doc = dom.window.document;

const stubs = `
var currentPage = 'quotes';
var _toasts = [];
var _downloaded = [];
function showToast(m,t){ _toasts.push(m); }
function escHtml(s){ if(!s) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function formatDate(v){ if(!v) return '-'; var d=new Date(Number(v)||v); return isNaN(d)?'-':d.toISOString().slice(0,10); }
function formatDateInput(v){ if(!v) return ''; var d=new Date(Number(v)||v); return isNaN(d)?'':d.toISOString().slice(0,10); }
function isOverdue(s){ return false; }
function todayStr(){ return '20261030'; }
function downloadExcel(sheets, name){ _downloaded.push({sheets:sheets, name:name}); }
async function apiGet(t,o){ return { data: _remoteRows }; }
async function apiPost(){ return {}; }
async function apiPut(){ return {}; }
async function apiDelete(){ return {}; }
function loadDashboard(){}
var _remoteRows = [];
`;

const driver = `
var R = { pass:0, fail:0, msgs:[] };
function ok(n,c,e){ if(c){R.pass++;} else {R.fail++; R.msgs.push('✗ '+n+(e!==undefined?(' | '+e):''));} }
window.downloadExcel = function(sheets,name){ _downloaded.push({sheets:sheets,name:name}); };
function near(n,g,w,t){ t=t||0.02; ok(n, Math.abs(g-w)<=t, 'got '+g+' want '+w); }

/* 构造一条完整报价：USD / CIF / 汇率 6.55 / 两行 */
var lines = [
  {product_name:'KS76',   spec:'180kg/drum', quantity:1.5,  unit:'MT', factory_price:8800,  markup_rate:13, commission_rate:3,
   misc_mode:'total', misc_total:587.5,  misc_unit:391.6667,  freight_mode:'total', freight_total:672.75,  freight_unit:448.5},
  {product_name:'KSS012', spec:'',          quantity:3,    unit:'MT', factory_price:9500,  markup_rate:6.9, commission_rate:0,
   misc_mode:'total', misc_total:1075,   misc_unit:358.3333, freight_mode:'total', freight_total:1345,    freight_unit:448.3333}
];
var itemsJson = JSON.stringify({ schema:2, meta:{ exchange_rate:6.55, actual_rate:6.60, version:3 }, lines: lines });

_remoteRows = [
  { id:'q1', quote_number:'QT-20261030-001', customer_name:'ACME CORP', currency:'USD', incoterms:'CIF',
    quote_date: 1761814800000, valid_until: 1764406800000, status:'已发送',
    payment_terms:'T/T 30% deposit', delivery_time:'30 days', origin_port:'Shanghai',
    total_amount: (16176.25+32886.5)/6.55, total_cost: 100, margin_rate: 11.5,
    freight: 2017.75, other_cost: 1662.5, commission: 396, items: itemsJson, notes:'test note' },
  { id:'q2', quote_number:'QT-20261030-002', customer_name:'宁波贸易', currency:'CNY', incoterms:'FOB',
    quote_date: 1761814800000, valid_until: null, status:'草稿',
    total_amount: 15503.5, margin_rate: 13,
    items: JSON.stringify({ schema:2, meta:{ exchange_rate:1, version:1 }, lines:[lines[0]] }) }
];
allQuotes = _remoteRows.slice();
filteredQuotes = allQuotes.slice();

/* ---- 列表页 ---- */
renderQuotes();
var tbody = document.getElementById('quote-tbody');
var html = tbody.innerHTML;
ok('列表渲染 2 行', (html.match(/<tr>/g)||[]).length === 2, (html.match(/<tr>/g)||[]).length);
ok('USD 单显示 $ 符号', html.indexOf('$')>=0);
ok('CNY 单显示 ¥ 符号', html.indexOf('¥')>=0, '未找到 ¥');
ok('显示条款 CIF', html.indexOf('CIF')>=0);
ok('版本号来自 items.meta (v3)', html.indexOf('v3')>=0, html.indexOf('v3'));
ok('溢价率显示 margin_rate', html.indexOf('11.50%')>=0, '未见 11.50%');
ok('列表不再出现"利润率"表头', document.querySelector('#quote-table thead').textContent.indexOf('利润率')<0);
ok('列表出现"溢价率"表头', document.querySelector('#quote-table thead').textContent.indexOf('溢价率')>=0);

/* ---- 统计卡 ---- */
renderQuoteStats();
var statsHtml = document.getElementById('quote-stats-row').innerHTML;
ok('统计卡渲染', statsHtml.length>0);
ok('多币种不混加', statsHtml.indexOf('2 种币种')>=0, statsHtml.replace(/<[^>]+>/g,'|').slice(0,300));

/* 单一币种时显示金额 */
allQuotes = [ _remoteRows[0] ];
renderQuoteStats();
var s2 = document.getElementById('quote-stats-row').innerHTML;
ok('单一币种显示 $ 金额', s2.indexOf('$')>=0);
allQuotes = _remoteRows.slice();

/* ---- 客户预览：不能泄露成本信息 ---- */
previewQuote('q1');
var pv = document.getElementById('quote-preview-body').innerHTML;
ok('预览有客户名', pv.indexOf('ACME CORP')>=0);
ok('预览有条款 CIF', pv.indexOf('CIF')>=0);
ok('预览有合计', pv.indexOf('合计')>=0);
ok('预览有单价列', pv.indexOf('单价')>=0);
ok('预览显示 /kg 折算', pv.indexOf('/kg')>=0);
ok('预览不泄露"出厂价"', pv.indexOf('出厂')<0, '泄露了出厂价');
ok('预览不泄露"溢价"', pv.indexOf('溢价')<0, '泄露了溢价率');
ok('预览不泄露"暗佣"', pv.indexOf('暗佣')<0, '泄露了暗佣率');
ok('预览不泄露"成本"', pv.indexOf('成本')<0, '泄露了成本');
ok('预览不泄露"佣金"', pv.indexOf('佣金')<0, '泄露了佣金');
ok('预览不含 CNY 成本数字 8800', pv.indexOf('8800')<0 && pv.indexOf('8,800')<0);

/* 预览金额核对：两行 CIF 合计 / 6.55 */
var wantTotal = (16572.25 + 32886.5) / 6.55;   /* 第一行含 3% 暗佣 */
var m = pv.match(/合计 Total \\(CIF\\)：[^$]*\\$([\\d,]+\\.\\d\\d)/);
ok('预览合计金额正确', m && Math.abs(parseFloat(m[1].replace(/,/g,'')) - wantTotal) < 0.05,
   m ? m[1] : '未匹配');
console.log('预览合计:', m ? m[1] : '(未匹配)', ' 期望:', wantTotal.toFixed(2));
console.log('预览包含说明:', (pv.match(/含内陆运输[^<]*/)||[''])[0]);

/* ---- 预览 FOB 单（无运费）---- */
previewQuote('q2');
var pv2 = document.getElementById('quote-preview-body').innerHTML;
ok('CNY 单预览用 ¥', pv2.indexOf('¥')>=0);
ok('FOB 单预览说明含码头', pv2.indexOf('码头')>=0);

/* ---- Excel 导出 ---- */
try { await exportQuotes(); } catch(ee){ R.msgs.push('exportQuotes 抛错: '+ee.message); }
ok('导出调用了 downloadExcel', _downloaded.length===1, _downloaded.length);
console.log('导出调用次数', _downloaded.length, '| toasts', JSON.stringify(_toasts), '| rows', _remoteRows.length);
if(!_downloaded.length){ document.body.setAttribute('data-result', JSON.stringify(R)); return; }
var sheet = _downloaded[0].sheets[0];
ok('导出表头含"溢价率%"', sheet.data[0].indexOf('溢价率%')>=0, sheet.data[0].join(','));
ok('导出表头含"暗佣率%"', sheet.data[0].indexOf('暗佣率%')>=0);
ok('导出表头不含"小计"', sheet.data[0].indexOf('小计')<0);
ok('导出表头不含"佣金率"', sheet.data[0].indexOf('佣金率')<0);
ok('导出 2 行数据', sheet.data.length===3, sheet.data.length);
console.log('\\n导出表头:', sheet.data[0].join(' | '));
console.log('导出第1行:', sheet.data[1].join(' | '));

/* ---- 数字校验 ---- */
var sum = _calcQuoteSummary(_quoteLines(_remoteRows[0]), _quoteMeta(_remoteRows[0]));
near('溢价率加权 (13*1.5*8800 + 6.9*3*9500)/成本', sum.avgMarkup, (1144*1.5 + 655.5*3)/(8800*1.5+9500*3)*100, 0.02);
near('暗佣率加权 3% 仅第一行', sum.avgComm, (3*8800*1.5)/(8800*1.5+9500*3), 0.02);
console.log('\\n加权溢价率', sum.avgMarkup.toFixed(3)+'%', '加权暗佣率', sum.avgComm.toFixed(3)+'%');

document.body.setAttribute('data-result', JSON.stringify(R));
`;

const s = doc.createElement('script');
s.textContent = stubs + '\n' + quotesBlock + '\n(async function(){' + driver + '\n})();';
doc.body.appendChild(s);

setTimeout(() => {
  const r = doc.body.getAttribute('data-result');
  if (!r) { console.log('!! 驱动未完成'); process.exit(1); }
  const R = JSON.parse(r);
  R.msgs.forEach(m => console.log('  ' + m));
  console.log(`\n=========== 页面层 通过 ${R.pass} / 失败 ${R.fail} ===========`);
  process.exit(R.fail ? 1 : 0);
}, 800);
