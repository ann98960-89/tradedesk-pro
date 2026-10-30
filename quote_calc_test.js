const fs = require('fs');
const html = fs.readFileSync('index.html','utf8');

/* 1. 全文件语法校验 */
const blocks = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
let bad=0;
blocks.forEach((c,i)=>{ try{ new Function(c); }catch(e){ bad++; console.log(`block ${i+1} SYNTAX ERROR:`, e.message); } });
console.log(`script blocks: ${blocks.length}, syntax errors: ${bad}`);

/* 2. 提取计算内核 */
const m = html.match(/\/\* ==== QUOTE_CALC_V2_START ====[\s\S]*?\/\* ==== QUOTE_CALC_V2_END ==== \*\//);
if(!m){ console.log('!! 未找到计算内核标记'); process.exit(1); }
const api = new Function(m[0] + `
  return {QUOTE_TERMS,_qnum,_termConf,_curSym,_miscTotal,_freightTotal,_unitPrices,
          _calcQuoteLine,_calcQuoteSummary,_quoteMeta,_quoteLines,_normQuoteLine,_fmtNum};`)();
const {_calcQuoteLine,_calcQuoteSummary,_unitPrices,_normQuoteLine,_quoteMeta,_quoteLines} = api;

let pass=0, fail=0;
function eq(name, got, want, tol){
  const t = tol===undefined ? 0.005 : tol;
  const ok = Math.abs(got-want) <= t;
  if(ok){ pass++; } else { fail++; console.log(`  ✗ ${name}: got ${got} want ${want}`); }
}

/* ===== 用例 A：用户表格 4 行（人民币，条款 CIF）===== */
console.log('\n=== A. 用户表格验算（CNY / CIF）===');
const sheet = [
  {name:'KS76',   f:8800,  q:1.5,  mk:13.00, misc:587.5,  frt:672.75,  fobT:10335.67, cifT:10784.17, fobKg:10.34, cifKg:10.78},
  {name:'KSN766', f:15500, q:11.25,mk:7.50,  misc:3757,   frt:5045.00, fobT:16996.46, cifT:17444.90, fobKg:17.00, cifKg:17.44},
  {name:'KSN100', f:15000, q:4.25, mk:9.50,  misc:1481.25,frt:1906.00, fobT:16773.53, cifT:17222.00, fobKg:16.77, cifKg:17.22},
  {name:'KSS012', f:9500,  q:3,    mk:6.90,  misc:1075,   frt:1345.00, fobT:10513.83, cifT:10962.17, fobKg:10.51, cifKg:10.96},
];
const metaCIF = {currency:'CNY', incoterms:'CIF', exchange_rate:1};
console.log('产品       EXW/T      FOB/T(算/表)          CIF/T(算/表)          FOB/kg  CIF/kg');
sheet.forEach(s=>{
  const r = _calcQuoteLine({product_name:s.name, factory_price:s.f, quantity:s.q, markup_rate:s.mk,
                            misc_mode:'total', misc_total:s.misc,
                            freight_mode:'total', freight_total:s.frt, unit:'MT'}, metaCIF);
  const ok1 = Math.abs(r.prices.fob.perT - s.fobT) < 0.005;
  const ok2 = Math.abs(r.prices.cif.perT - s.cifT) < 0.005;
  const ok3 = Math.abs(Math.round(r.prices.fob.perKg*100)/100 - s.fobKg) < 0.011;
  const ok4 = Math.abs(Math.round(r.prices.cif.perKg*100)/100 - s.cifKg) < 0.011;
  console.log(`${s.name.padEnd(9)} ${r.prices.exw.perT.toFixed(2).padStart(9)}  ${r.prices.fob.perT.toFixed(2).padStart(9)}/${String(s.fobT).padStart(9)} ${ok1?'✓':'✗'}  ${r.prices.cif.perT.toFixed(2).padStart(9)}/${String(s.cifT).padStart(9)} ${ok2?'✓':'✗'}  ${r.prices.fob.perKg.toFixed(2)} ${ok3?'✓':'✗'}  ${r.prices.cif.perKg.toFixed(2)} ${ok4?'✓':'✗'}`);
  eq(s.name+' FOB/T', r.prices.fob.perT, s.fobT);
  eq(s.name+' CIF/T', r.prices.cif.perT, s.cifT);
  eq(s.name+' FOB/kg', Math.round(r.prices.fob.perKg*100)/100, s.fobKg, 0.011);
  eq(s.name+' CIF/kg', Math.round(r.prices.cif.perKg*100)/100, s.cifKg, 0.011);
});

/* ===== 用例 B：溢价率口径（成本加成，不是售价占比）===== */
console.log('\n=== B. 溢价率口径 ===');
const b = _calcQuoteLine({factory_price:8800, quantity:1, markup_rate:13, unit:'MT'}, {currency:'CNY',incoterms:'EXW'});
eq('EXW/T = 8800*1.13', b.prices.exw.perT, 9944);
eq('溢价额', b.markupAmt, 1144);
eq('占报价 1144/9944', b.shareOfPrice, 1144/9944*100);

/* ===== 用例 C：暗佣与溢价并列相加 ===== */
console.log('\n=== C. 暗佣相加 ===');
const c = _calcQuoteLine({factory_price:8800, quantity:1, markup_rate:13, commission_rate:3, unit:'MT'}, {currency:'CNY',incoterms:'EXW'});
eq('EXW/T = 8800*1.16', c.prices.exw.perT, 10208);
eq('溢价额', c.markupAmt, 1144);
eq('佣金额', c.commAmt, 264);
eq('溢价+佣金 = 总加价', c.markupAmt+c.commAmt, c.exwTotal-8800);

/* ===== 用例 D：条款 gating ===== */
console.log('\n=== D. 条款 gating ===');
const lineD = {factory_price:10000, quantity:1, markup_rate:10, misc_mode:'total', misc_total:500,
               freight_mode:'total', freight_total:800, unit:'MT'};
const dEXW = _calcQuoteLine(lineD, {currency:'CNY',incoterms:'EXW'});
eq('EXW 条款 杂费=0', dEXW.miscCny, 0);
eq('EXW 条款 运费=0', dEXW.freightCny, 0);
eq('EXW 条款 报价=EXW', dEXW.quotedCny, 11000);
eq('EXW maxTier', dEXW.maxTier, 1);
const dFOB = _calcQuoteLine(lineD, {currency:'CNY',incoterms:'FOB'});
eq('FOB 条款 杂费计入', dFOB.miscCny, 500);
eq('FOB 条款 运费=0', dFOB.freightCny, 0);
eq('FOB 条款 报价=FOB', dFOB.quotedCny, 11500);
eq('FOB maxTier', dFOB.maxTier, 2);
const dCFR = _calcQuoteLine(lineD, {currency:'CNY',incoterms:'CFR'});
eq('CFR 报价含运费', dCFR.quotedCny, 12300);
eq('CFR maxTier', dCFR.maxTier, 3);
const dCIF = _calcQuoteLine(lineD, {currency:'CNY',incoterms:'CIF'});
eq('CFR 与 CIF 公式相同', dCIF.quotedCny, dCFR.quotedCny);

/* ===== 用例 E：单位换算 ===== */
console.log('\n=== E. 单位换算 ===');
const eMT = _calcQuoteLine({factory_price:8800, quantity:1.5, markup_rate:13, unit:'MT'}, {currency:'CNY',incoterms:'EXW'});
eq('MT perT', eMT.prices.exw.perT, 9944);
eq('MT perKg', eMT.prices.exw.perKg, 9.944);
const eKG = _calcQuoteLine({factory_price:8.8, quantity:1500, markup_rate:13, unit:'KG'}, {currency:'CNY',incoterms:'EXW'});
eq('KG perKg', eKG.prices.exw.perKg, 9.944);
eq('KG perT', eKG.prices.exw.perT, 9944);
const ePC = _calcQuoteLine({factory_price:50, quantity:100, markup_rate:10, unit:'PC'}, {currency:'CNY',incoterms:'EXW'});
eq('PC perUnit', ePC.prices.exw.perUnit, 55);
eq('PC perT 为 null', ePC.prices.exw.perT === null ? 1 : 0, 1);
eq('PC perKg 为 null', ePC.prices.exw.perKg === null ? 1 : 0, 1);
eq('PC isWeight=false', ePC.isWeight ? 1 : 0, 0);

/* ===== 用例 F：杂费/运费双模式互算 ===== */
console.log('\n=== F. 总额 / 单价双模式 ===');
const f1 = _calcQuoteLine({factory_price:1000, quantity:5, markup_rate:0, misc_mode:'total', misc_total:500, unit:'MT'}, {currency:'CNY',incoterms:'FOB'});
const f2 = _calcQuoteLine({factory_price:1000, quantity:5, markup_rate:0, misc_mode:'unit',  misc_unit:100, unit:'MT'}, {currency:'CNY',incoterms:'FOB'});
eq('总额500 = 单价100×5', f1.fobTotal, f2.fobTotal);
eq('每吨杂费分摊', (f1.fobTotal-f1.exwTotal)/5, 100);

/* ===== 用例 G：汇率安全垫 ===== */
console.log('\n=== G. 汇率换算 ===');
const g = _calcQuoteLine({factory_price:8800, quantity:1, markup_rate:13, unit:'MT'}, {currency:'USD',incoterms:'EXW',exchange_rate:6.55});
eq('USD 报价 = 9944/6.55', g.prices.exw.perT, 9944/6.55);
console.log(`  人民币 9944 → 报价汇率 6.55 → USD ${g.prices.exw.perT.toFixed(2)}`);
console.log(`  客户按实际汇率 6.60 结汇 → ¥${(g.prices.exw.perT*6.60).toFixed(2)}（安全垫 +${(g.prices.exw.perT*6.60-9944).toFixed(2)}）`);
const g2 = _calcQuoteLine({factory_price:8800, quantity:1, markup_rate:13, unit:'MT'}, {currency:'USD',incoterms:'EXW',exchange_rate:0});
eq('汇率缺失时降级为 1（不崩）', g2.prices.exw.perT, 9944);

/* ===== 用例 H：汇总 ===== */
console.log('\n=== H. 汇总 ===');
const sum = _calcQuoteSummary(sheet.map(s=>({product_name:s.name, factory_price:s.f, quantity:s.q, markup_rate:s.mk,
  misc_mode:'total', misc_total:s.misc, freight_mode:'total', freight_total:s.frt, unit:'MT'})), metaCIF);
eq('出厂成本合计', sum.factoryTotal, 8800*1.5+15500*11.25+15000*4.25+9500*3);
eq('报价合计', sum.quotedCny, 16176.25+196255.125+73193.5+32886.5);
eq('行数', sum.lineCount, 4);
console.log(`  出厂成本 ¥${sum.factoryTotal.toFixed(2)} | 溢价合计 ¥${sum.markupAmt.toFixed(2)} | 佣金 ¥${sum.commAmt.toFixed(2)}`);
console.log(`  杂费 ¥${sum.miscCny.toFixed(2)} | 运费 ¥${sum.freightCny.toFixed(2)} | 报价合计 ¥${sum.quotedCny.toFixed(2)}`);
console.log(`  加权平均溢价率 ${sum.avgMarkup.toFixed(3)}% | 溢价占报价 ${sum.shareOfPrice.toFixed(2)}%`);

/* ===== 用例 I：旧数据兼容 ===== */
console.log('\n=== I. 旧模型兼容 ===');
const legacy = _normQuoteLine({product_name:'旧', quantity:2, unit:'MT', unit_price:1200, unit_cost:1000});
eq('旧单反推出厂价', legacy.factory_price, 1000);
eq('旧单反推溢价率', legacy.markup_rate, 20);
const legCalc = _calcQuoteLine(legacy, {currency:'CNY',incoterms:'EXW'});
eq('旧单可正常计算', legCalc.prices.exw.perT, 1200);
const q = {currency:'USD', incoterms:'CIF', items:'{"meta":{"exchange_rate":6.55,"actual_rate":6.6},"lines":[]}'};
const qm = _quoteMeta(q);
eq('_quoteMeta 汇率', qm.exchange_rate, 6.55);
eq('_quoteMeta 实际汇率', qm.actual_rate, 6.6);
eq('_quoteLines 空数组', _quoteLines(q).length, 0);
eq('_quoteLines 数组形态', _quoteLines({items:[{product_name:'x',factory_price:1,quantity:1,markup_rate:0}]}).length, 1);

/* ===== 用例 J：零值 / 非法值不崩 ===== */
console.log('\n=== J. 边界 ===');
const j1 = _calcQuoteLine({}, {});
eq('空行不崩', j1.quotedCny, 0);
const j2 = _calcQuoteLine({factory_price:'abc', quantity:'', markup_rate:null}, {currency:'CNY'});
eq('非法值归零', j2.quotedCny, 0);
const j3 = _calcQuoteLine({factory_price:100, quantity:0, markup_rate:10, unit:'MT'}, {currency:'CNY',incoterms:'EXW'});
eq('数量 0 时单价不除零', j3.prices.exw.perUnit, 0);
const j4 = _calcQuoteSummary([], {});
eq('空明细汇总不崩', j4.quotedCny, 0);
eq('空明细 avgMarkup 不 NaN', j4.avgMarkup, 0);

console.log(`\n=========== 通过 ${pass} / 失败 ${fail} ===========`);
process.exit(fail ? 1 : 0);
