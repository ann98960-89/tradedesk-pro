const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('index.html','utf8');
const calcBlk  = html.match(/\/\* ==== QUOTE_CALC_V2_START ====[\s\S]*?\/\* ==== QUOTE_CALC_V2_END ==== \*\//)[0];
const printBlk = html.match(/\/\* ==== QUOTE_PRINT_V1_START ====[\s\S]*?\/\* ==== QUOTE_PRINT_V1_END ==== \*\//)[0];

const dom = new JSDOM('<!DOCTYPE html><body></body>', { runScripts:'dangerously', url:'https://example.com/' });
const doc = dom.window.document;
const stubs = `
function showToast(){}
function escHtml(s){ if(s===0) return '0'; if(!s) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function formatDate(v){ if(!v) return '-'; var d=new Date(Number(v)||v); if(isNaN(d)) return '-'; return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
var allQuotes = [];
`;
const driver = `
saveLetterhead({
  name:'江苏恒润新材料有限公司',
  nameEn:'Jiangsu Hengrun New Material Co., Ltd.',
  tel:'+86-512-6688 9900', email:'sales@hengrun-chem.com', website:'www.hengrun-chem.com',
  address:'江苏省苏州市工业园区星湖街 218 号',
  bank:'开户行：中国银行苏州工业园区支行\\n账　号：5123 4567 8901 2345\\nSWIFT：BKCHCNBJ95B',
  footer:'本报价单有效期以单内注明为准，逾期需重新确认。价格以最终合同为准。'
});
var lines = [
  {product_name:'KS76 拉丝润滑剂', spec:'180kg/铁桶', quantity:1.5, unit:'MT', factory_price:8800, markup_rate:13, commission_rate:0,
   misc_mode:'total', misc_total:587.5, freight_mode:'total', freight_total:672.75,
   misc_items:[{name:'内陆运费',amount:300},{name:'报关费',amount:150},{name:'码头及货代费',amount:137.5}]},
  {product_name:'KSN766 拉丝润滑剂', spec:'200kg/铁桶', quantity:11.25, unit:'MT', factory_price:15500, markup_rate:7.5, commission_rate:0,
   misc_mode:'total', misc_total:3757, freight_mode:'total', freight_total:5045,
   misc_items:[{name:'内陆运费',amount:1800},{name:'进仓费',amount:700},{name:'报关费',amount:500},{name:'码头及货代费',amount:757}]},
  {product_name:'KSN100 拉丝粉', spec:'25kg/袋', quantity:4.25, unit:'MT', factory_price:15000, markup_rate:9.5, commission_rate:0,
   misc_mode:'total', misc_total:1481.25, freight_mode:'total', freight_total:1906},
  {product_name:'KSS012 化工粉末', spec:'25kg/袋', quantity:3, unit:'MT', factory_price:9500, markup_rate:6.9, commission_rate:0,
   misc_mode:'total', misc_total:1075, freight_mode:'total', freight_total:1345}
];
var q = {
  id:'demo', quote_number:'QT-20261030-861', customer_name:'PT Nusantara Parkerizing',
  currency:'CNY', incoterms:'CIF', quote_date: Date.now(), valid_until: Date.now()+30*86400000,
  status:'已发送', payment_terms:'T/T 30% deposit, 70% before shipment',
  delivery_time:'30-45 天', origin_port:'Shanghai',
  items: JSON.stringify({ schema:2, meta:{ exchange_rate:1, version:1 }, lines: lines }),
  notes:'包装：按规格表执行\\n唛头：按客户要求\\n以上价格含 13% 增值税专用发票'
};
document.body.setAttribute('data-out', buildQuotePrintHtml(q));
`;
const s = doc.createElement('script');
s.textContent = stubs + '\n' + calcBlk + '\n' + printBlk + '\n(function(){' + driver + '})();';
doc.body.appendChild(s);

setTimeout(()=>{
  const out = doc.body.getAttribute('data-out');
  if(!out){ console.log('生成失败'); process.exit(1); }
  fs.writeFileSync('报价单打印预览示例.html', out, 'utf8');
  console.log('已生成，长度', out.length);
}, 500);
