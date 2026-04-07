/* ===================================================
   investigation.js - 客户背调模块
   =================================================== */

let allInvestigations = [];
let filteredInvestigations = [];

// ===== 加载背调记录 =====
async function loadInvestigations() {
  try {
    const data = await apiGet('customer_investigation', { limit: 500 });
    allInvestigations = (data.data || []).sort((a, b) => (b.investigation_date || 0) - (a.investigation_date || 0));
    filteredInvestigations = [...allInvestigations];
    renderInvestigations(filteredInvestigations);
    refreshCustomerDatalist();
  } catch (e) {
    showToast('加载背调记录失败', 'error');
  }
}

// ===== 渲染表格 =====
function renderInvestigations(list) {
  const tbody = document.getElementById('inv-tbody');
  const emptyEl = document.getElementById('inv-empty');
  const tableWrapper = document.querySelector('#page-investigation .table-wrapper');

  if (!list.length) {
    if (tableWrapper) tableWrapper.style.display = 'none';
    emptyEl.style.display = 'block';
    return;
  }
  if (tableWrapper) tableWrapper.style.display = '';
  emptyEl.style.display = 'none';

  tbody.innerHTML = list.map(inv => `
    <tr>
      <td>
        <div style="font-weight:700;color:#111827;cursor:pointer;" onclick="openInvDetail('${inv.id}')">${escHtml(inv.company_name)}</div>
        ${inv.website ? `<a href="${escHtml(inv.website)}" target="_blank" style="font-size:11.5px;color:#1a56db;">${escHtml(inv.website)}</a>` : ''}
      </td>
      <td>${inv.country ? `🌍 ${escHtml(inv.country)}` : '-'}</td>
      <td>${escHtml(inv.founded_year) || '-'}</td>
      <td>${escHtml(inv.company_size) || '-'}</td>
      <td style="font-weight:700;color:#059669;">${formatAmount(inv.annual_purchase)}</td>
      <td style="max-width:160px;font-size:12.5px;color:#6b7280;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escHtml(inv.main_suppliers)}">${escHtml(inv.main_suppliers) || '-'}</td>
      <td>${creditBadge(inv.credit_rating)}</td>
      <td>${formatDate(inv.investigation_date)}</td>
      <td>
        <div class="td-actions">
          <button class="btn btn-ghost btn-sm" onclick="openInvDetail('${inv.id}')" title="查看详情"><i class="fas fa-eye" style="font-size:11px;color:#1a56db;"></i></button>
          <button class="btn btn-ghost btn-sm" onclick="editInvestigation('${inv.id}')" title="编辑"><i class="fas fa-pen" style="font-size:11px;"></i></button>
          <button class="btn btn-ghost btn-sm" onclick="deleteInvestigation('${inv.id}')" title="删除" style="color:#dc2626;"><i class="fas fa-trash" style="font-size:11px;"></i></button>
        </div>
      </td>
    </tr>`).join('');
}

// ===== 筛选 =====
function filterInvestigations() {
  const search = document.getElementById('inv-search').value.toLowerCase();
  const credit = document.getElementById('inv-filter-credit').value;

  filteredInvestigations = allInvestigations.filter(inv => {
    if (search && !inv.company_name?.toLowerCase().includes(search) && !inv.country?.toLowerCase().includes(search)) return false;
    if (credit && inv.credit_rating !== credit) return false;
    return true;
  });
  renderInvestigations(filteredInvestigations);
}

// ===== 打开模态框 =====
function openInvestigationModal(customerIdOrNull = null) {
  let companyName = '';
  let country = '';
  if (customerIdOrNull) {
    const c = allCustomers.find(c => c.id === customerIdOrNull);
    if (c) { companyName = c.company_name; country = c.country || ''; }
  }

  document.getElementById('inv-modal-title').textContent = '新建客户背调';
  document.getElementById('inv-id').value = '';
  document.getElementById('inv-company').value = companyName;
  document.getElementById('inv-country').value = country;
  document.getElementById('inv-founded').value = '';
  document.getElementById('inv-size').value = '';
  document.getElementById('inv-purchase').value = '';
  document.getElementById('inv-credit').value = '安全';
  document.getElementById('inv-website').value = '';
  document.getElementById('inv-social').value = '';
  document.getElementById('inv-business').value = '';
  document.getElementById('inv-suppliers').value = '';
  document.getElementById('inv-competitors').value = '';
  document.getElementById('inv-conclusion').value = '';
  document.getElementById('inv-date').value = new Date().toISOString().slice(0, 10);
  document.getElementById('investigation-modal').classList.add('active');
  setTimeout(() => document.getElementById('inv-company').focus(), 100);
}
function closeInvestigationModal() {
  document.getElementById('investigation-modal').classList.remove('active');
}

// ===== 编辑 =====
function editInvestigation(id) {
  const inv = allInvestigations.find(i => i.id === id);
  if (!inv) return;
  document.getElementById('inv-modal-title').textContent = '编辑背调记录';
  document.getElementById('inv-id').value = inv.id;
  document.getElementById('inv-company').value = inv.company_name || '';
  document.getElementById('inv-country').value = inv.country || '';
  document.getElementById('inv-founded').value = inv.founded_year || '';
  document.getElementById('inv-size').value = inv.company_size || '';
  document.getElementById('inv-purchase').value = inv.annual_purchase || '';
  document.getElementById('inv-credit').value = inv.credit_rating || '安全';
  document.getElementById('inv-website').value = inv.website || '';
  document.getElementById('inv-social').value = inv.social_links || '';
  document.getElementById('inv-business').value = inv.main_business || '';
  document.getElementById('inv-suppliers').value = inv.main_suppliers || '';
  document.getElementById('inv-competitors').value = inv.competitors || '';
  document.getElementById('inv-conclusion').value = inv.conclusion || '';
  document.getElementById('inv-date').value = inv.investigation_date ? formatDateInput(inv.investigation_date) : '';
  document.getElementById('investigation-modal').classList.add('active');
}

// ===== 保存 =====
async function saveInvestigation() {
  const company = document.getElementById('inv-company').value.trim();
  if (!company) { showToast('请输入公司名称', 'warning'); return; }

  const id = document.getElementById('inv-id').value;
  const customer = allCustomers.find(c => c.company_name === company);

  const payload = {
    customer_id: customer?.id || '',
    company_name: company,
    country: document.getElementById('inv-country').value.trim(),
    founded_year: document.getElementById('inv-founded').value.trim(),
    company_size: document.getElementById('inv-size').value.trim(),
    annual_purchase: parseFloat(document.getElementById('inv-purchase').value) || 0,
    credit_rating: document.getElementById('inv-credit').value,
    website: document.getElementById('inv-website').value.trim(),
    social_links: document.getElementById('inv-social').value.trim(),
    main_business: document.getElementById('inv-business').value.trim(),
    main_suppliers: document.getElementById('inv-suppliers').value.trim(),
    competitors: document.getElementById('inv-competitors').value.trim(),
    conclusion: document.getElementById('inv-conclusion').value.trim(),
    investigation_date: document.getElementById('inv-date').value ? new Date(document.getElementById('inv-date').value).getTime() : Date.now(),
  };

  try {
    if (id) {
      await apiPut('customer_investigation', id, payload);
      showToast('背调记录已更新', 'success');
    } else {
      await apiPost('customer_investigation', payload);
      showToast('背调记录已保存', 'success');
    }
    closeInvestigationModal();
    await loadInvestigations();
    if (currentDetailCustomerId) loadCustomerDetail(currentDetailCustomerId);
  } catch (e) {
    showToast('保存失败，请重试', 'error');
  }
}

// ===== 删除 =====
function deleteInvestigation(id) {
  const inv = allInvestigations.find(i => i.id === id);
  showConfirm(`确定删除「${inv?.company_name || ''}」的背调记录吗？`, async () => {
    try {
      await apiDelete('customer_investigation', id);
      showToast('已删除', 'success');
      await loadInvestigations();
    } catch (e) {
      showToast('删除失败', 'error');
    }
  });
}

// ===== 查看详情弹窗 =====
function openInvDetail(id) {
  const inv = allInvestigations.find(i => i.id === id);
  if (!inv) return;

  const creditInfo = CREDIT_MAP[inv.credit_rating] || { cls: 'badge-gray', icon: '' };
  const content = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
      <div class="card" style="padding:16px;">
        <div style="font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;margin-bottom:10px;">基本信息</div>
        <div class="info-list">
          ${inv.country ? `<div class="info-item"><div class="info-label">国家</div><div class="info-value">🌍 ${escHtml(inv.country)}</div></div>` : ''}
          ${inv.founded_year ? `<div class="info-item"><div class="info-label">成立时间</div><div class="info-value">${escHtml(inv.founded_year)}</div></div>` : ''}
          ${inv.company_size ? `<div class="info-item"><div class="info-label">公司规模</div><div class="info-value">${escHtml(inv.company_size)}</div></div>` : ''}
          ${inv.annual_purchase ? `<div class="info-item"><div class="info-label">年采购量</div><div class="info-value" style="font-weight:700;color:#059669;">${formatAmount(inv.annual_purchase)}</div></div>` : ''}
          <div class="info-item"><div class="info-label">信用评估</div><div class="info-value">${creditBadge(inv.credit_rating)}</div></div>
          <div class="info-item"><div class="info-label">背调日期</div><div class="info-value">${formatDate(inv.investigation_date)}</div></div>
        </div>
      </div>
      <div class="card" style="padding:16px;">
        <div style="font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;margin-bottom:10px;">联系方式</div>
        <div class="info-list">
          ${inv.website ? `<div class="info-item"><div class="info-label">官网</div><div class="info-value"><a href="${escHtml(inv.website)}" target="_blank" style="color:#1a56db;">${escHtml(inv.website)}</a></div></div>` : ''}
          ${inv.social_links ? `<div class="info-item"><div class="info-label">社交媒体</div><div class="info-value">${escHtml(inv.social_links)}</div></div>` : ''}
          ${inv.main_suppliers ? `<div class="info-item"><div class="info-label">主要供应商</div><div class="info-value">${escHtml(inv.main_suppliers)}</div></div>` : ''}
          ${inv.competitors ? `<div class="info-item"><div class="info-label">竞争对手</div><div class="info-value">${escHtml(inv.competitors)}</div></div>` : ''}
        </div>
      </div>
    </div>
    ${inv.main_business ? `<div class="card" style="padding:16px;margin-bottom:12px;"><div style="font-size:12px;color:#6b7280;font-weight:700;text-transform:uppercase;margin-bottom:8px;">主要业务</div><p style="font-size:13.5px;color:#374151;line-height:1.7;">${escHtml(inv.main_business)}</p></div>` : ''}
    ${inv.conclusion ? `<div class="card" style="padding:16px;background:#f0fdf4;border:1px solid #bbf7d0;"><div style="font-size:12px;color:#065f46;font-weight:700;text-transform:uppercase;margin-bottom:8px;">📋 背调结论与建议</div><p style="font-size:13.5px;color:#374151;line-height:1.7;white-space:pre-wrap;">${escHtml(inv.conclusion)}</p></div>` : ''}`;

  // 创建临时详情模态框
  let modal = document.getElementById('inv-detail-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'inv-detail-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal modal-lg">
        <div class="modal-header">
          <div>
            <div class="modal-title" id="inv-detail-title"></div>
            <div id="inv-detail-badge" style="margin-top:4px;"></div>
          </div>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-sm btn-outline" id="inv-detail-edit-btn">✏️ 编辑</button>
            <button class="btn-close" onclick="closeInvDetail()">×</button>
          </div>
        </div>
        <div class="modal-body" id="inv-detail-body"></div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) closeInvDetail(); });
  }
  document.getElementById('inv-detail-title').textContent = inv.company_name;
  document.getElementById('inv-detail-badge').innerHTML = creditBadge(inv.credit_rating) + (inv.country ? ` <span style="color:#6b7280;font-size:12px;margin-left:6px;">🌍 ${escHtml(inv.country)}</span>` : '');
  document.getElementById('inv-detail-body').innerHTML = content;
  document.getElementById('inv-detail-edit-btn').onclick = () => { closeInvDetail(); editInvestigation(id); };
  modal.classList.add('active');
}
function closeInvDetail() {
  const m = document.getElementById('inv-detail-modal');
  if (m) m.classList.remove('active');
}
