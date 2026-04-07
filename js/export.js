/* ===================================================
   export.js - Excel 数据导出模块
   依赖：SheetJS (xlsx) via CDN
   =================================================== */

// ===== 打开导出面板 =====
function openExportPanel() {
  document.getElementById('export-modal').classList.add('active');
}
function closeExportPanel() {
  document.getElementById('export-modal').classList.remove('active');
}

// ===== 主导出入口 =====
async function exportToExcel(type) {
  const btn = document.getElementById(`export-btn-${type}`);
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> 导出中...'; }

  try {
    switch (type) {
      case 'customers':    await exportCustomers();    break;
      case 'todos':        await exportTodos();        break;
      case 'followups':    await exportFollowups();    break;
      case 'products':     await exportProducts();     break;
      case 'investigation':await exportInvestigation();break;
      case 'all':          await exportAll();          break;
    }
  } catch (e) {
    showToast('导出失败：' + e.message, 'error');
    console.error(e);
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = getExportBtnLabel(type); }
  }
}

function getExportBtnLabel(type) {
  const labels = {
    customers: '⬇️ 导出客户列表',
    todos: '⬇️ 导出待办事项',
    followups: '⬇️ 导出跟进记录',
    products: '⬇️ 导出产品文档',
    investigation: '⬇️ 导出客户背调',
    all: '📦 一键全量导出',
  };
  return labels[type] || '导出';
}

// ===== 导出客户列表 =====
async function exportCustomers() {
  const data = await apiGet('customers', { limit: 1000 });
  const rows = data.data || [];
  if (!rows.length) { showToast('暂无客户数据', 'warning'); return; }

  const headers = ['公司名称','国家/地区','联系人','职位','邮箱','电话/WhatsApp',
    '客户来源','客户类型','销售阶段','客户评级','订单金额(USD)',
    '感兴趣产品','最近联系日期','下次跟进日期','备注'];

  const sheetData = [headers, ...rows.map(r => [
    r.company_name || '',
    r.country || '',
    r.contact_name || '',
    r.contact_title || '',
    r.email || '',
    r.phone || '',
    r.source || '',
    r.customer_type || '',
    r.stage || '',
    r.rating || '',
    r.order_amount || 0,
    r.interested_products || '',
    r.last_contact_date ? new Date(r.last_contact_date).toLocaleDateString('zh-CN') : '',
    r.next_followup_date ? new Date(r.next_followup_date).toLocaleDateString('zh-CN') : '',
    r.notes || '',
  ])];

  downloadExcel([{ name: '客户列表', data: sheetData }], `客户列表_${todayStr()}.xlsx`);
  showToast(`✅ 成功导出 ${rows.length} 条客户数据`, 'success');
}

// ===== 导出待办事项 =====
async function exportTodos() {
  const data = await apiGet('todos', { limit: 1000 });
  const rows = data.data || [];
  if (!rows.length) { showToast('暂无待办数据', 'warning'); return; }

  const headers = ['标题','分类','优先级','状态','截止日期','关联客户','详细描述','创建时间'];
  const sheetData = [headers, ...rows.map(r => [
    r.title || '',
    r.category || '',
    r.priority || '',
    r.status || '',
    r.due_date ? new Date(r.due_date).toLocaleDateString('zh-CN') : '',
    r.related_customer || '',
    r.description || '',
    r.created_at ? new Date(r.created_at).toLocaleDateString('zh-CN') : '',
  ])];

  downloadExcel([{ name: '待办事项', data: sheetData }], `待办事项_${todayStr()}.xlsx`);
  showToast(`✅ 成功导出 ${rows.length} 条待办数据`, 'success');
}

// ===== 导出跟进记录 =====
async function exportFollowups() {
  const data = await apiGet('followups', { limit: 1000 });
  const rows = data.data || [];
  if (!rows.length) { showToast('暂无跟进记录', 'warning'); return; }

  const headers = ['客户公司','跟进日期','联系方式','当前阶段','跟进内容','客户反馈','下一步计划','下次跟进日期'];
  const sheetData = [headers, ...rows.map(r => [
    r.company_name || '',
    r.followup_date ? new Date(r.followup_date).toLocaleDateString('zh-CN') : '',
    r.contact_method || '',
    r.stage || '',
    r.content || '',
    r.customer_feedback || '',
    r.next_action || '',
    r.next_followup_date ? new Date(r.next_followup_date).toLocaleDateString('zh-CN') : '',
  ])];

  downloadExcel([{ name: '跟进记录', data: sheetData }], `跟进记录_${todayStr()}.xlsx`);
  showToast(`✅ 成功导出 ${rows.length} 条跟进记录`, 'success');
}

// ===== 导出产品文档 =====
async function exportProducts() {
  const data = await apiGet('product_docs', { limit: 1000 });
  const rows = data.data || [];
  if (!rows.length) { showToast('暂无产品文档数据', 'warning'); return; }

  const headers = ['产品名称','产品编号','类别','文档类型','文档标题','版本','文件链接','发布日期','有效期至','标签','备注'];
  const sheetData = [headers, ...rows.map(r => [
    r.product_name || '',
    r.product_code || '',
    r.category || '',
    r.doc_type || '',
    r.doc_title || '',
    r.version || '',
    r.file_url || '',
    r.publish_date ? new Date(r.publish_date).toLocaleDateString('zh-CN') : '',
    r.expiry_date ? new Date(r.expiry_date).toLocaleDateString('zh-CN') : '',
    r.tags || '',
    r.notes || '',
  ])];

  downloadExcel([{ name: '产品文档', data: sheetData }], `产品文档_${todayStr()}.xlsx`);
  showToast(`✅ 成功导出 ${rows.length} 条产品文档`, 'success');
}

// ===== 导出客户背调 =====
async function exportInvestigation() {
  const data = await apiGet('customer_investigation', { limit: 1000 });
  const rows = data.data || [];
  if (!rows.length) { showToast('暂无背调数据', 'warning'); return; }

  const headers = ['公司名称','国家/地区','成立时间','公司规模','年采购量(USD)',
    '信用评估','官方网站','社交媒体','主要业务','主要供应商','竞争对手','背调结论','背调日期'];
  const sheetData = [headers, ...rows.map(r => [
    r.company_name || '',
    r.country || '',
    r.founded_year || '',
    r.company_size || '',
    r.annual_purchase || 0,
    r.credit_rating || '',
    r.website || '',
    r.social_links || '',
    r.main_business || '',
    r.main_suppliers || '',
    r.competitors || '',
    r.conclusion || '',
    r.investigation_date ? new Date(r.investigation_date).toLocaleDateString('zh-CN') : '',
  ])];

  downloadExcel([{ name: '客户背调', data: sheetData }], `客户背调_${todayStr()}.xlsx`);
  showToast(`✅ 成功导出 ${rows.length} 条背调记录`, 'success');
}

// ===== 全量导出（多 Sheet） =====
async function exportAll() {
  showToast('正在准备全量数据，请稍候...', 'info', 5000);

  const [customersRes, todosRes, followupsRes, productsRes, invRes] = await Promise.all([
    apiGet('customers', { limit: 1000 }),
    apiGet('todos', { limit: 1000 }),
    apiGet('followups', { limit: 1000 }),
    apiGet('product_docs', { limit: 1000 }),
    apiGet('customer_investigation', { limit: 1000 }),
  ]);

  const sheets = [];

  // Sheet 1: 客户列表
  const customers = customersRes.data || [];
  sheets.push({ name: '客户列表', data: [
    ['公司名称','国家/地区','联系人','职位','邮箱','电话','来源','类型','阶段','评级','订单金额','感兴趣产品','最近联系','下次跟进','备注'],
    ...customers.map(r => [r.company_name,r.country,r.contact_name,r.contact_title,r.email,r.phone,r.source,r.customer_type,r.stage,r.rating,r.order_amount||0,r.interested_products,r.last_contact_date?new Date(r.last_contact_date).toLocaleDateString('zh-CN'):'',r.next_followup_date?new Date(r.next_followup_date).toLocaleDateString('zh-CN'):'',r.notes]),
  ]});

  // Sheet 2: 待办事项
  const todos = todosRes.data || [];
  sheets.push({ name: '待办事项', data: [
    ['标题','分类','优先级','状态','截止日期','关联客户','描述'],
    ...todos.map(r => [r.title,r.category,r.priority,r.status,r.due_date?new Date(r.due_date).toLocaleDateString('zh-CN'):'',r.related_customer,r.description]),
  ]});

  // Sheet 3: 跟进记录
  const followups = followupsRes.data || [];
  sheets.push({ name: '跟进记录', data: [
    ['客户公司','跟进日期','联系方式','阶段','跟进内容','客户反馈','下一步','下次跟进'],
    ...followups.map(r => [r.company_name,r.followup_date?new Date(r.followup_date).toLocaleDateString('zh-CN'):'',r.contact_method,r.stage,r.content,r.customer_feedback,r.next_action,r.next_followup_date?new Date(r.next_followup_date).toLocaleDateString('zh-CN'):'']),
  ]});

  // Sheet 4: 产品文档
  const docs = productsRes.data || [];
  sheets.push({ name: '产品文档', data: [
    ['产品名称','产品编号','类别','文档类型','文档标题','版本','文件链接','发布日期','有效期至','标签'],
    ...docs.map(r => [r.product_name,r.product_code,r.category,r.doc_type,r.doc_title,r.version,r.file_url,r.publish_date?new Date(r.publish_date).toLocaleDateString('zh-CN'):'',r.expiry_date?new Date(r.expiry_date).toLocaleDateString('zh-CN'):'',r.tags]),
  ]});

  // Sheet 5: 客户背调
  const invs = invRes.data || [];
  sheets.push({ name: '客户背调', data: [
    ['公司名称','国家','成立时间','规模','年采购量','信用评估','官网','主要供应商','背调结论','背调日期'],
    ...invs.map(r => [r.company_name,r.country,r.founded_year,r.company_size,r.annual_purchase||0,r.credit_rating,r.website,r.main_suppliers,r.conclusion,r.investigation_date?new Date(r.investigation_date).toLocaleDateString('zh-CN'):'']),
  ]});

  downloadExcel(sheets, `TradeDesk_全量导出_${todayStr()}.xlsx`);
  const total = customers.length + todos.length + followups.length + docs.length + invs.length;
  showToast(`✅ 全量导出完成，共 ${total} 条记录，5个工作表`, 'success');
}

// ===== 核心下载函数（使用 SheetJS） =====
function downloadExcel(sheets, filename) {
  if (typeof XLSX === 'undefined') {
    throw new Error('Excel 库未加载，请检查网络连接后重试');
  }

  const wb = XLSX.utils.book_new();

  sheets.forEach(({ name, data }) => {
    const ws = XLSX.utils.aoa_to_sheet(data);

    // 设置列宽
    const colWidths = data[0].map((_, ci) => {
      const maxLen = data.reduce((max, row) => {
        const cell = row[ci];
        const len = cell ? String(cell).length : 0;
        return Math.max(max, len);
      }, 10);
      return { wch: Math.min(Math.max(maxLen, 10), 50) };
    });
    ws['!cols'] = colWidths;

    // 样式：表头行（首行）加粗
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let C = range.s.c; C <= range.e.c; C++) {
      const cellAddr = XLSX.utils.encode_cell({ r: 0, c: C });
      if (!ws[cellAddr]) continue;
      ws[cellAddr].s = {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '1A56DB' } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: false },
        border: {
          bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
        },
      };
    }

    XLSX.utils.book_append_sheet(wb, ws, name);
  });

  XLSX.writeFile(wb, filename);
}

// ===== 日期字符串 =====
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
}
