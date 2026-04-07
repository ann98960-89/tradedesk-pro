/* ===================================================
   customers.js - 客户列表 & 详情面板
   =================================================== */

let allCustomers = [];
let filteredCustomers = [];
let customerPage = 1;
const CUSTOMER_PER_PAGE = 15;

// ===== 加载客户列表 =====
async function loadCustomers() {
  try {
    const data = await apiGet('customers', { limit: 500 });
    allCustomers = data.data || [];
    filteredCustomers = [...allCustomers];
    renderCustomers();
    refreshCustomerDatalist();
  } catch (e) {
    showToast('加载客户数据失败', 'error');
  }
}

// ===== 渲染客户表格 =====
function renderCustomers() {
  const tbody = document.getElementById('customer-tbody');
  const emptyEl = document.getElementById('customer-empty');

  if (!filteredCustomers.length) {
    tbody.innerHTML = '';
    document.querySelector('.table-wrapper') && (document.querySelector('#page-customers .table-wrapper').style.display = 'none');
    emptyEl.style.display = 'block';
    document.getElementById('customer-pagination').innerHTML = '';
    return;
  }
  document.querySelector('#page-customers .table-wrapper').style.display = '';
  emptyEl.style.display = 'none';

  const start = (customerPage - 1) * CUSTOMER_PER_PAGE;
  const pageData = filteredCustomers.slice(start, start + CUSTOMER_PER_PAGE);

  tbody.innerHTML = pageData.map(c => `
    <tr style="cursor:pointer;" onclick="openDetailPanel('${c.id}')">
      <td>
        <div style="font-weight:700;color:#111827;">${escHtml(c.company_name)}</div>
        ${c.email ? `<div style="font-size:11.5px;color:#6b7280;">${escHtml(c.email)}</div>` : ''}
      </td>
      <td>${c.country ? `<span style="font-size:13px;">🌍 ${escHtml(c.country)}</span>` : '-'}</td>
      <td>
        <div>${escHtml(c.contact_name) || '-'}</div>
        ${c.contact_title ? `<div style="font-size:11.5px;color:#9ca3af;">${escHtml(c.contact_title)}</div>` : ''}
      </td>
      <td>${c.source ? `<span class="badge badge-gray">${escHtml(c.source)}</span>` : '-'}</td>
      <td>${ratingBadge(c.rating)}</td>
      <td>${stageBadge(c.stage)}</td>
      <td style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:#6b7280;">${escHtml(c.interested_products) || '-'}</td>
      <td>${formatDate(c.last_contact_date)}</td>
      <td>${c.next_followup_date ? `<span style="color:${isOverdue(formatDateInput(c.next_followup_date)) ? '#dc2626' : isDueSoon(formatDateInput(c.next_followup_date)) ? '#d97706' : '#374151'};font-weight:${isOverdue(formatDateInput(c.next_followup_date)) ? '700' : '400'};">${formatDate(c.next_followup_date)}</span>` : '-'}</td>
      <td onclick="event.stopPropagation()">
        <div class="td-actions">
          <button class="btn btn-ghost btn-sm" onclick="editCustomer('${c.id}')" title="编辑"><i class="fas fa-pen" style="font-size:11px;"></i></button>
          <button class="btn btn-ghost btn-sm" onclick="openFollowupModal('${c.id}')" title="记录跟进" style="color:#1a56db;"><i class="fas fa-comment-dots" style="font-size:11px;"></i></button>
          <button class="btn btn-ghost btn-sm" onclick="deleteCustomer('${c.id}')" title="删除" style="color:#dc2626;"><i class="fas fa-trash" style="font-size:11px;"></i></button>
        </div>
      </td>
    </tr>`).join('');

  // 分页
  renderCustomerPagination();
}

function renderCustomerPagination() {
  const total = filteredCustomers.length;
  const totalPages = Math.ceil(total / CUSTOMER_PER_PAGE);
  const pag = document.getElementById('customer-pagination');
  if (totalPages <= 1) { pag.innerHTML = `<span style="font-size:12px;color:#6b7280;">共 ${total} 位客户</span>`; return; }

  let html = `<span style="font-size:12px;color:#6b7280;">共 ${total} 位客户</span><div style="display:flex;gap:6px;">`;
  for (let i = 1; i <= totalPages; i++) {
    html += `<button class="btn btn-sm ${i === customerPage ? 'btn-primary' : 'btn-secondary'}" onclick="goCustomerPage(${i})">${i}</button>`;
  }
  html += '</div>';
  pag.innerHTML = html;
}

function goCustomerPage(page) {
  customerPage = page;
  renderCustomers();
}

// ===== 筛选客户 =====
function filterCustomers() {
  customerPage = 1;
  const search = document.getElementById('customer-search').value.toLowerCase();
  const stage = document.getElementById('customer-filter-stage').value;
  const rating = document.getElementById('customer-filter-rating').value;
  const type = document.getElementById('customer-filter-type').value;

  filteredCustomers = allCustomers.filter(c => {
    if (search && !c.company_name?.toLowerCase().includes(search) && !c.contact_name?.toLowerCase().includes(search) && !c.email?.toLowerCase().includes(search)) return false;
    if (stage && c.stage !== stage) return false;
    if (rating && c.rating !== rating) return false;
    if (type && c.customer_type !== type) return false;
    return true;
  });
  renderCustomers();
}

// ===== 打开客户模态框 =====
function openCustomerModal(customer = null) {
  const title = customer ? '编辑客户信息' : '新增客户';
  document.getElementById('customer-modal-title').textContent = title;
  document.getElementById('customer-id').value = customer?.id || '';
  document.getElementById('c-company').value = customer?.company_name || '';
  document.getElementById('c-country').value = customer?.country || '';
  document.getElementById('c-contact').value = customer?.contact_name || '';
  document.getElementById('c-title').value = customer?.contact_title || '';
  document.getElementById('c-email').value = customer?.email || '';
  document.getElementById('c-phone').value = customer?.phone || '';
  document.getElementById('c-source').value = customer?.source || 'Exhibition';
  document.getElementById('c-type').value = customer?.customer_type || '终端客户';
  document.getElementById('c-stage').value = customer?.stage || '初次接触';
  document.getElementById('c-rating').value = customer?.rating || 'B';
  document.getElementById('c-amount').value = customer?.order_amount || '';
  document.getElementById('c-products').value = customer?.interested_products || '';
  document.getElementById('c-last-contact').value = customer?.last_contact_date ? formatDateInput(customer.last_contact_date) : new Date().toISOString().slice(0,10);
  document.getElementById('c-next-followup').value = customer?.next_followup_date ? formatDateInput(customer.next_followup_date) : '';
  document.getElementById('c-notes').value = customer?.notes || '';
  document.getElementById('customer-modal').classList.add('active');
  setTimeout(() => document.getElementById('c-company').focus(), 100);
}
function closeCustomerModal() {
  document.getElementById('customer-modal').classList.remove('active');
}

// ===== 编辑客户 =====
function editCustomer(id) {
  const customer = allCustomers.find(c => c.id === id);
  if (customer) openCustomerModal(customer);
}

// ===== 保存客户 =====
async function saveCustomer() {
  const company = document.getElementById('c-company').value.trim();
  if (!company) { showToast('请输入公司名称', 'warning'); return; }

  const id = document.getElementById('customer-id').value;
  const payload = {
    company_name: company,
    country: document.getElementById('c-country').value.trim(),
    contact_name: document.getElementById('c-contact').value.trim(),
    contact_title: document.getElementById('c-title').value.trim(),
    email: document.getElementById('c-email').value.trim(),
    phone: document.getElementById('c-phone').value.trim(),
    source: document.getElementById('c-source').value,
    customer_type: document.getElementById('c-type').value,
    stage: document.getElementById('c-stage').value,
    rating: document.getElementById('c-rating').value,
    order_amount: parseFloat(document.getElementById('c-amount').value) || 0,
    interested_products: document.getElementById('c-products').value.trim(),
    last_contact_date: document.getElementById('c-last-contact').value ? new Date(document.getElementById('c-last-contact').value).getTime() : null,
    next_followup_date: document.getElementById('c-next-followup').value ? new Date(document.getElementById('c-next-followup').value).getTime() : null,
    notes: document.getElementById('c-notes').value.trim(),
  };

  try {
    if (id) {
      await apiPut('customers', id, payload);
      showToast('客户信息已更新', 'success');
    } else {
      await apiPost('customers', payload);
      showToast('客户已添加', 'success');
    }
    closeCustomerModal();
    await loadCustomers();
    if (currentPage === 'pipeline') loadPipeline();
    if (currentPage === 'dashboard') loadDashboard();
  } catch (e) {
    showToast('保存失败，请重试', 'error');
  }
}

// ===== 删除客户 =====
function deleteCustomer(id) {
  const c = allCustomers.find(c => c.id === id);
  showConfirm(`确定删除客户「${c?.company_name || ''}」？相关跟进记录不会被删除。`, async () => {
    try {
      await apiDelete('customers', id);
      showToast('客户已删除', 'success');
      await loadCustomers();
      if (currentPage === 'pipeline') loadPipeline();
    } catch (e) {
      showToast('删除失败', 'error');
    }
  });
}

// ===== 客户详情面板 =====
async function loadCustomerDetail(id) {
  const c = allCustomers.find(c => c.id === id) || await apiGetOne('customers', id);
  if (!c) return;

  document.getElementById('dp-company').textContent = c.company_name;
  document.getElementById('dp-stage-badge').innerHTML = stageBadge(c.stage) + ' ' + ratingBadge(c.rating);
  document.getElementById('dp-edit-btn').onclick = () => { closeDetailPanel(); editCustomer(id); };

  // 基本信息
  document.getElementById('detail-info-panel').innerHTML = `
    <div class="info-list">
      <div class="info-item"><div class="info-label">国家</div><div class="info-value">${escHtml(c.country) || '-'}</div></div>
      <div class="info-item"><div class="info-label">联系人</div><div class="info-value">${escHtml(c.contact_name) || '-'} ${c.contact_title ? '<span style="color:#9ca3af;font-size:12px;">· ' + escHtml(c.contact_title) + '</span>' : ''}</div></div>
      <div class="info-item"><div class="info-label">邮件</div><div class="info-value">${c.email ? '<a href="mailto:' + escHtml(c.email) + '" style="color:#1a56db;">' + escHtml(c.email) + '</a>' : '-'}</div></div>
      <div class="info-item"><div class="info-label">电话</div><div class="info-value">${escHtml(c.phone) || '-'}</div></div>
      <div class="info-item"><div class="info-label">来源</div><div class="info-value"><span class="badge badge-gray">${escHtml(c.source) || '-'}</span></div></div>
      <div class="info-item"><div class="info-label">类型</div><div class="info-value">${escHtml(c.customer_type) || '-'}</div></div>
      <div class="info-item"><div class="info-label">阶段</div><div class="info-value">${stageBadge(c.stage)}</div></div>
      <div class="info-item"><div class="info-label">评级</div><div class="info-value">${ratingBadge(c.rating)}</div></div>
      <div class="info-item"><div class="info-label">订单金额</div><div class="info-value" style="font-weight:700;color:#1a56db;">${formatAmount(c.order_amount)}</div></div>
      <div class="info-item"><div class="info-label">感兴趣产品</div><div class="info-value">${escHtml(c.interested_products) || '-'}</div></div>
      <div class="info-item"><div class="info-label">最近联系</div><div class="info-value">${formatDate(c.last_contact_date)}</div></div>
      <div class="info-item"><div class="info-label">下次跟进</div><div class="info-value" style="color:${isOverdue(formatDateInput(c.next_followup_date)) ? '#dc2626' : '#374151'};font-weight:${isOverdue(formatDateInput(c.next_followup_date)) ? '700' : '400'};">${formatDate(c.next_followup_date)}</div></div>
      ${c.notes ? `<div class="info-item"><div class="info-label">备注</div><div class="info-value" style="white-space:pre-wrap;">${escHtml(c.notes)}</div></div>` : ''}
    </div>
    <div style="margin-top:16px;">
      <div style="font-size:12px;font-weight:700;color:#6b7280;margin-bottom:10px;text-transform:uppercase;">销售阶段进度</div>
      <div class="stage-steps">
        ${STAGE_ORDER.map((s, i) => {
          const currentIdx = STAGE_ORDER.indexOf(c.stage);
          const cls = i < currentIdx ? 'done' : i === currentIdx ? 'active' : '';
          return `<div class="stage-step ${cls}"><div class="step-dot"></div>${s}</div>${i < STAGE_ORDER.length - 1 ? '<div class="stage-connector ' + (i < currentIdx ? 'done' : '') + '"></div>' : ''}`;
        }).join('')}
      </div>
    </div>`;

  // 跟进记录
  loadDetailFollowups(id);
  // 背调
  loadDetailInvestigation(id);
}

async function loadDetailFollowups(customerId) {
  try {
    const data = await apiGet('followups', { limit: 200 });
    const records = (data.data || []).filter(f => f.customer_id === customerId || f.company_name === (allCustomers.find(c => c.id === customerId)?.company_name));
    const panel = document.getElementById('detail-followup-panel');
    if (!records.length) {
      panel.innerHTML = '<div class="empty-state" style="padding:30px;"><div style="font-size:32px;">📋</div><p style="color:#9ca3af;margin-top:8px;">暂无跟进记录</p></div>';
      return;
    }
    panel.innerHTML = `<div class="timeline">${records.sort((a,b) => (b.followup_date||0) - (a.followup_date||0)).map(f => `
      <div class="timeline-item">
        <div class="timeline-dot">${f.contact_method === 'Email' ? '📧' : f.contact_method === 'WhatsApp' ? '💬' : f.contact_method === 'Zoom' ? '💻' : '📞'}</div>
        <div class="timeline-content">
          <div class="timeline-title">${stageBadge(f.stage)} <span class="badge badge-gray" style="font-size:10.5px;">${escHtml(f.contact_method)}</span></div>
          <div class="timeline-text" style="margin-top:5px;">${escHtml(f.content)}</div>
          ${f.customer_feedback ? `<div style="background:#f0f9ff;border-radius:6px;padding:8px 10px;margin-top:6px;font-size:12px;color:#0369a1;"><strong>客户反馈：</strong>${escHtml(f.customer_feedback)}</div>` : ''}
          ${f.next_action ? `<div style="font-size:12px;color:#059669;margin-top:5px;"><strong>下一步：</strong>${escHtml(f.next_action)}</div>` : ''}
          <div class="timeline-date">${formatDate(f.followup_date)}${f.next_followup_date ? ' · 下次：' + formatDate(f.next_followup_date) : ''}</div>
        </div>
      </div>`).join('')}</div>`;
  } catch(e) {}
}

async function loadDetailInvestigation(customerId) {
  try {
    const data = await apiGet('customer_investigation', { limit: 100 });
    const c = allCustomers.find(c => c.id === customerId);
    const records = (data.data || []).filter(i => i.customer_id === customerId || i.company_name === c?.company_name);
    const panel = document.getElementById('detail-investigation-panel');
    if (!records.length) {
      panel.innerHTML = '<div class="empty-state" style="padding:30px;"><div style="font-size:32px;">🔍</div><p style="color:#9ca3af;margin-top:8px;">暂无背调记录</p></div>';
      return;
    }
    const inv = records[records.length - 1];
    panel.innerHTML = `
      <div class="info-list">
        ${inv.country ? `<div class="info-item"><div class="info-label">国家</div><div class="info-value">${escHtml(inv.country)}</div></div>` : ''}
        ${inv.founded_year ? `<div class="info-item"><div class="info-label">成立时间</div><div class="info-value">${escHtml(inv.founded_year)}</div></div>` : ''}
        ${inv.company_size ? `<div class="info-item"><div class="info-label">公司规模</div><div class="info-value">${escHtml(inv.company_size)}</div></div>` : ''}
        ${inv.annual_purchase ? `<div class="info-item"><div class="info-label">年采购量</div><div class="info-value" style="font-weight:700;">${formatAmount(inv.annual_purchase)}</div></div>` : ''}
        <div class="info-item"><div class="info-label">信用评估</div><div class="info-value">${creditBadge(inv.credit_rating)}</div></div>
        ${inv.main_suppliers ? `<div class="info-item"><div class="info-label">主要供应商</div><div class="info-value">${escHtml(inv.main_suppliers)}</div></div>` : ''}
        ${inv.website ? `<div class="info-item"><div class="info-label">官网</div><div class="info-value"><a href="${escHtml(inv.website)}" target="_blank" style="color:#1a56db;">${escHtml(inv.website)}</a></div></div>` : ''}
        ${inv.conclusion ? `<div class="info-item"><div class="info-label">结论</div><div class="info-value" style="white-space:pre-wrap;">${escHtml(inv.conclusion)}</div></div>` : ''}
        <div class="info-item"><div class="info-label">背调日期</div><div class="info-value">${formatDate(inv.investigation_date)}</div></div>
      </div>`;
  } catch(e) {}
}

// ===== 刷新 datalist =====
function refreshCustomerDatalist() {
  const dl = document.getElementById('customer-datalist');
  if (!dl) return;
  dl.innerHTML = allCustomers.map(c => `<option value="${escHtml(c.company_name)}">`).join('');
}

// ===== 销售漏斗页 =====
async function loadPipeline() {
  if (!allCustomers.length) await loadCustomers();
  renderKanban();
}

function switchPipelineView(view) {
  document.getElementById('pipeline-kanban').style.display = view === 'kanban' ? '' : 'none';
  document.getElementById('pipeline-list').style.display = view === 'list' ? '' : 'none';
  document.getElementById('view-kanban').className = `btn btn-sm ${view === 'kanban' ? 'btn-secondary' : 'btn-ghost'}`;
  document.getElementById('view-list').className = `btn btn-sm ${view === 'list' ? 'btn-secondary' : 'btn-ghost'}`;
  if (view === 'list') renderPipelineList();
}

function renderKanban() {
  const container = document.getElementById('pipeline-kanban');
  const stageColors = {
    '初次接触':'#e5e7eb','需求确认':'#dbeafe','样品寄送':'#ede9fe',
    '报价谈判':'#fef3c7','下单确认':'#fef9c3','生产跟进':'#dbeafe',
    '出货物流':'#d1fae5','回款完成':'#bbf7d0','长期合作':'#a7f3d0',
  };
  container.innerHTML = `<div class="kanban-board">${
    STAGE_ORDER.map(stage => {
      const customers = allCustomers.filter(c => c.stage === stage);
      const totalAmt = customers.reduce((sum, c) => sum + (c.order_amount || 0), 0);
      return `
        <div class="kanban-column">
          <div class="kanban-col-header">
            <div class="kanban-col-title" style="color:#374151;">
              <span>${STAGE_ICONS[stage]}</span> ${stage}
            </div>
            <span class="kanban-col-count">${customers.length}</span>
          </div>
          ${totalAmt > 0 ? `<div style="font-size:11px;color:#6b7280;margin-bottom:8px;padding:0 2px;">💰 ${formatAmount(totalAmt)}</div>` : ''}
          ${customers.length ? customers.map(c => `
            <div class="kanban-card" onclick="openDetailPanel('${c.id}')">
              <div class="kanban-card-title">${escHtml(c.company_name)}</div>
              <div class="kanban-card-sub">${escHtml(c.country || '')} ${c.contact_name ? '· ' + escHtml(c.contact_name) : ''}</div>
              <div style="font-size:11.5px;color:#6b7280;">${escHtml(c.interested_products || '')}</div>
              <div class="kanban-card-footer">
                ${ratingBadge(c.rating)}
                ${c.order_amount ? `<span style="font-size:11.5px;font-weight:700;color:#059669;">${formatAmount(c.order_amount)}</span>` : ''}
                ${c.next_followup_date ? `<span style="font-size:11px;color:${isOverdue(formatDateInput(c.next_followup_date)) ? '#dc2626' : '#9ca3af'};">${isOverdue(formatDateInput(c.next_followup_date)) ? '⚠️' : '📅'} ${formatDate(c.next_followup_date)}</span>` : ''}
              </div>
            </div>`).join('') : '<div style="text-align:center;padding:20px;color:#9ca3af;font-size:12px;">暂无客户</div>'}
        </div>`;
    }).join('')
  }</div>`;
}

function renderPipelineList() {
  const container = document.getElementById('pipeline-list');
  const sorted = [...allCustomers].sort((a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage));
  container.innerHTML = `
    <div class="table-wrapper">
      <table>
        <thead><tr><th>公司名称</th><th>国家</th><th>阶段</th><th>评级</th><th>订单金额</th><th>下次跟进</th><th>操作</th></tr></thead>
        <tbody>${sorted.map(c => `
          <tr onclick="openDetailPanel('${c.id}')" style="cursor:pointer;">
            <td style="font-weight:700;">${escHtml(c.company_name)}</td>
            <td>${escHtml(c.country) || '-'}</td>
            <td>${stageBadge(c.stage)}</td>
            <td>${ratingBadge(c.rating)}</td>
            <td style="font-weight:700;color:#059669;">${formatAmount(c.order_amount)}</td>
            <td>${formatDate(c.next_followup_date)}</td>
            <td onclick="event.stopPropagation()">
              <div class="td-actions">
                <button class="btn btn-ghost btn-sm" onclick="editCustomer('${c.id}')"><i class="fas fa-pen" style="font-size:11px;"></i></button>
                <button class="btn btn-ghost btn-sm" onclick="openFollowupModal('${c.id}')" style="color:#1a56db;"><i class="fas fa-comment-dots" style="font-size:11px;"></i></button>
              </div>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}
