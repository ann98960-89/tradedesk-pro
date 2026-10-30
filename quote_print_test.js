/* 打印模块测试：金额大写 + 打印 HTML 生成（jsdom 提供 localStorage） */
const fs = require('fs');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync('index.html', 'utf8');
const calcBlk  = (html.match(/\/\* ==== QUOTE_CALC_V2_START ====[\s\S]*?\/\* ==== QUOTE_CALC_V2_END ==== \*\//) || [])[0];
const printBlk = (html.match(/\/\* ==== QUOTE_PRINT_V1_START ====[\s\S]*?\/\* ==== QUOTE_PRINT_V1_END ==== \*\//) || [])[0];
if (!calcBlk || !printBlk) { console.log('!! 提取失败', { calc: !!calcBlk, print: !!printBlk }); process.exit(1); }
console.log(`calc ${calcBlk.length}B / print ${printBlk.length}B`);

const dom = new JSDOM('<!DOCTYPE html><body></body>', { runScripts: 'dangerously', url: 'https://example.com/' });
const doc = dom.window.document;

const stubs = `
var _toasts = [];
function showToast(m,t){ _toasts.push(m); }
function escHtml(s){ if(s===0) return '0'; if(!s) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function formatDate(v){ if(!v) return '-'; var d=new Date(Number(v)||v); if(isNaN(d)) return '-'; return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
var allQuotes = [];
`;

const driver = `
var R = { pass:0, fail:0, msgs:[] };
function ok(n,c,e){ if(c){R.pass++;} else {R.fail++; R.msgs.push('✗ '+n+(e!==undefined?(' | '+e):''));} }
function eq(n,g,w){ ok(n, g===w, 'got "'+g+'" want "'+w+'"'); }

/* ===== 1. 金额大写 ===== */
var cases = [
  [0,          '零元整'],
  [1,          '壹元整'],
  [10,         '壹拾元整'],
  [100,        '壹佰元整'],
  [1000,       '壹仟元整'],
  [1001,       '壹仟零壹元整'],
  [10000,      '壹万元整'],
  [10001,      '壹万零壹元整'],
  [100000,     '壹拾万元整'],
  [107000,     '壹拾万柒仟元整'],
  [1000000,    '壹佰万元整'],
  [10000000,   '壹仟万元整'],
  [100000000,  '壹亿元整'],
  [100000001,  '壹亿零壹元整'],
  [1234.56,    '壹仟贰佰叁拾肆元伍角陆分'],
  [12.5,       '壹拾贰元伍角整'],
  [12.05,      '壹拾贰元零伍分'],
  [0.5,        '零元伍角整'],
  [318511.38,  '叁拾壹万捌仟伍佰壹拾壹元叁角捌分'],
  [99999999.99,'玖仟玖佰玖拾玖万玖仟玖佰玖拾玖元玖角玖分'],
  [-100,       '负壹佰元整']
];
console.log('\\n--- 金额大写 ---');
cases.forEach(function(c){
  var got = _amountToChinese(c[0]);
  console.log(String(c[0]).padStart(12) + ' → ' + got);
  eq('大写 ' + c[0], got, c[1]);
});
eq('非法值返回空', _amountToChinese('abc'), '零元整');

/* ===== 2. 抬头存取 ===== */
saveLetterhead({ name:'江苏测试化工有限公司', nameEn:'Jiangsu Test Chemical Co., Ltd.',
                 tel:'+86-512-12345678', email:'sales@test.com', website:'www.test.com',
                 address:'江苏省苏州市工业园区XX路8号', bank:'中国银行苏州分行 1234567890\\nSWIFT: BKCHCNBJ95B',
                 footer:'本报价单有效期以单内注明为准。' });
var lh = getLetterhead();
eq('抬头名称读回', lh.name, '江苏测试化工有限公司');
eq('抬头电话读回', lh.tel, '+86-512-12345678');
ok('抬头空值不报错', (function(){ saveLetterhead({}); return getLetterhead().name === undefined; })());
saveLetterhead({ name:'江苏测试化工有限公司', nameEn:'Jiangsu Test Chemical Co., Ltd.',
                 tel:'+86-512-12345678', email:'sales@test.com', website:'www.test.com',
                 address:'江苏省苏州市工业园区XX路8号', bank:'中国银行苏州分行 1234567890',
                 footer:'本报价单有效期以单内注明为准。' });

/* ===== 3. 打印 HTML（USD / CIF / 两行）===== */
var lines = [
  {product_name:'KS76', spec:'180kg/drum', quantity:1.5, unit:'MT', factory_price:8800, markup_rate:13, commission_rate:3,
   misc_mode:'total', misc_total:587.5, freight_mode:'total', freight_total:672.75,
   misc_items:[{name:'内陆运费',amount:300},{name:'报关费',amount:150},{name:'码头及货代费',amount:137.5}]},
  {product_name:'KSS012', spec:'', quantity:3, unit:'MT', factory_price:9500, markup_rate:6.9, commission_rate:0,
   misc_mode:'total', misc_total:1075, freight_mode:'total', freight_total:1345}
];
var quote = {
  id:'q1', quote_number:'QT-20261030-001', customer_name:'ACME CORP', currency:'USD', incoterms:'CIF',
  quote_date: 1761814800000, valid_until: 1764406800000, status:'已发送',
  payment_terms:'T/T 30% deposit, 70% before shipment', delivery_time:'30-45 days', origin_port:'Shanghai',
  items: JSON.stringify({ schema:2, meta:{ exchange_rate:6.55, actual_rate:6.60, version:2 }, lines: lines }),
  notes:'包装：180kg/铁桶\\n唛头按客户要求'
};
var out = buildQuotePrintHtml(quote);

console.log('\\n--- 打印 HTML 结构 ---');
console.log('文档长度', out.length, 'B');

ok('含 DOCTYPE', out.indexOf('<!DOCTYPE html>')===0);
ok('A4 页面设置', out.indexOf('@page{size:A4')>=0);
ok('打印色彩保真', out.indexOf('print-color-adjust:exact')>=0);
ok('含公司中文名', out.indexOf('江苏测试化工有限公司')>=0);
ok('含公司英文名', out.indexOf('Jiangsu Test Chemical')>=0);
ok('含电话', out.indexOf('12345678')>=0);
ok('含地址', out.indexOf('苏州')>=0);
ok('含标题「报 价 单」', out.indexOf('报 价 单')>=0);
ok('含 QUOTATION', out.indexOf('QUOTATION')>=0);
ok('含客户名', out.indexOf('ACME CORP')>=0);
ok('含报价单号', out.indexOf('QT-20261030-001')>=0);
ok('含版本 v2', out.indexOf('（v2）')>=0);
ok('含贸易条款 CIF', out.indexOf('CIF')>=0);
ok('含起运港', out.indexOf('Shanghai')>=0);
ok('含付款方式', out.indexOf('T/T 30% deposit')>=0);
ok('含交货周期', out.indexOf('30-45 days')>=0);
ok('含两行产品', out.indexOf('KS76')>=0 && out.indexOf('KSS012')>=0);
ok('含规格', out.indexOf('180kg/drum')>=0);
ok('含 /kg 折算', out.indexOf('/kg')>=0);
ok('含备注且换行转 br', out.indexOf('包装：180kg/铁桶<br>唛头按客户要求')>=0);
ok('含银行信息', out.indexOf('中国银行苏州分行')>=0);
ok('含页脚声明', out.indexOf('有效期以单内注明为准')>=0);
ok('含签字栏', out.indexOf('供方（盖章 / 签字）')>=0 && out.indexOf('需方（盖章 / 签字）')>=0);
ok('含打印时间', out.indexOf('打印时间')>=0);
ok('含价格说明', out.indexOf('含内陆运输、报关、码头、货代、海运费及保险费')>=0);
ok('表头重复打印(thead)', out.indexOf('display:table-header-group')>=0);
ok('行不跨页', out.indexOf('page-break-inside:avoid')>=0);

/* 成本信息绝不能出现在打印件里 */
ok('不泄露"出厂"', out.indexOf('出厂')<0, '泄露出厂价');
ok('不泄露"溢价"', out.indexOf('溢价')<0, '泄露溢价率');
ok('不泄露"暗佣"', out.indexOf('暗佣')<0, '泄露暗佣率');
ok('不泄露"佣金"', out.indexOf('佣金')<0, '泄露佣金');
ok('不泄露"成本"', out.indexOf('成本')<0, '泄露成本');
ok('不含成本数字 8800', out.indexOf('8800')<0 && out.indexOf('8,800')<0);
ok('不含工厂价 9500', out.indexOf('9500')<0 && out.indexOf('9,500')<0);

/* 金额核对 */
var sum = _calcQuoteSummary(_quoteLines(quote), _quoteMeta(quote));
var wantTotal = sum.quoted;
var m = out.match(/合计 Total（CIF）<\\/td><td class="num total-line">\\$([\\d,]+\\.\\d\\d)/);
ok('合计金额正确', m && Math.abs(parseFloat(m[1].replace(/,/g,'')) - wantTotal) < 0.05, m?m[1]:'未匹配');
console.log('合计', m?m[1]:'(未匹配)', '期望', wantTotal.toFixed(2));

/* ===== 3b. 打印件算术自洽（客户会拿计算器核对）===== */
console.log('\\n--- 打印件算术自洽 ---');
var rowRe = /<td class="num">([\\d,]+(?:\\.\\d+)?)<\\/td><td class="ctr">([A-Z]+)<\\/td><td class="num">([\\d,]+\\.\\d\\d)(?:<div[^>]*>[^<]*<\\/div>)?<\\/td><td class="num"><b>([\\d,]+\\.\\d\\d)<\\/b>/g;
var rw, rowSum = 0, rowCount = 0;
while ((rw = rowRe.exec(out)) !== null) {
  rowCount++;
  var qty = parseFloat(rw[1].replace(/,/g,''));
  var up  = parseFloat(rw[3].replace(/,/g,''));
  var amt = parseFloat(rw[4].replace(/,/g,''));
  var calc = Math.round(up * qty * 100) / 100;
  ok('行' + rowCount + ' 单价×数量=金额 (' + up + '×' + qty + '=' + calc + ' vs ' + amt + ')',
     Math.abs(calc - amt) < 0.005, '差 ' + (calc - amt).toFixed(4));
  rowSum += amt;
}
rowSum = Math.round(rowSum * 100) / 100;
ok('解析到两行明细', rowCount === 2, '实际 ' + rowCount);
ok('合计 = 各行金额之和', m && Math.abs(parseFloat(m[1].replace(/,/g,'')) - rowSum) < 0.005,
   '行和 ' + rowSum.toFixed(2) + ' vs 合计 ' + (m?m[1]:'-'));
console.log('行和', rowSum.toFixed(2), '单上合计', m?m[1]:'-');

/* 数量显示去尾零 */
eq('数量 1.5 显示 1.5 而非 1.50', _fmtQty(1.5), '1.5');
eq('数量 3 显示 3', _fmtQty(3), '3');
eq('数量 11.25 显示 11.25', _fmtQty(11.25), '11.25');
eq('数量 1234.5 带千分位', _fmtQty(1234.5), '1,234.5');
ok('打印件里不出现 1.50', out.indexOf('>1.50<') < 0);

/* ===== 4. 人民币单要有金额大写 ===== */
var cnyQuote = Object.assign({}, quote, { currency:'CNY', incoterms:'FOB',
  items: JSON.stringify({ schema:2, meta:{ exchange_rate:1, version:1 }, lines:[lines[0]] }) });
var out2 = buildQuotePrintHtml(cnyQuote);
ok('人民币单含金额大写', out2.indexOf('金额大写')>=0);
ok('人民币单符号 ¥', out2.indexOf('¥')>=0);
ok('FOB 单说明不含保险', out2.indexOf('含内陆运输、进仓、报关、码头及货代费用，不含海运费及保险')>=0);
var words = (out2.match(/金额大写：<\\/b>([^<]+)</)||[])[1];
console.log('人民币单大写:', words);
ok('大写内容非空', !!words && words.indexOf('元')>=0);

/* ===== 5. 无抬头时给提示而不崩 ===== */
saveLetterhead({});
var out3 = buildQuotePrintHtml(quote);
ok('无抬头时有提示', out3.indexOf('请在「公司抬头」中填写公司名称')>=0);
ok('无抬头仍能生成', out3.indexOf('ACME CORP')>=0);

/* ===== 6. 空报价单不崩 ===== */
var out4 = buildQuotePrintHtml({});
ok('空单不崩', out4.indexOf('报 价 单')>=0);
console.log('空单长度', out4.length);

document.body.setAttribute('data-result', JSON.stringify(R));
`;

const s = doc.createElement('script');
s.textContent = stubs + '\n' + calcBlk + '\n' + printBlk + '\n(function(){' + driver + '\n})();';
doc.body.appendChild(s);

setTimeout(() => {
  const r = doc.body.getAttribute('data-result');
  if (!r) { console.log('!! 驱动未完成'); process.exit(1); }
  const R = JSON.parse(r);
  R.msgs.forEach(m => console.log('  ' + m));
  console.log(`\n=========== 打印层 通过 ${R.pass} / 失败 ${R.fail} ===========`);
  process.exit(R.fail ? 1 : 0);
}, 700);
