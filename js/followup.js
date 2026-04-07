/* ===================================================
   followup.js - 跟进记录模块
   =================================================== */

let allFollowups = [];
let filteredFollowups = [];

// ===== 加载跟进记录 =====
async function loadFollowups() {
  try {
    const data = await apiGet('followups', { limit: 500 });
    allFollowups = (data.data || []).sort((a, b) => (b.followup_date || 0) - (a.followup_date || 0));
    filteredFollowups = [...allFollowups];
    renderFollowups(filteredFollowups);
    refreshCustomerDatalist();
  } catch (e) {
    showToast('加载跟进记录失败', 'error');
  }
}

// ===== 渲染跟进记录表格 =====
function renderFollowups(list) {
  const tbody = document.getElementById('followup-tbody');
  const emptyEl = document.getElementById('followup-empty');
  const tableWrapper = document.querySelector('#page-followup .table-wrapper');

  if (!list.length) {
    if (tableWrapper) tableWrapper.style.display = 'none';
    emptyEl.style.display = 'block';
    return;
  }
  if (tableWrapper) tableWrapper.style.display = '';
  emptyEl.style.display = 'none';

  const METHOD_ICONS = {
    'Email': '📧', 'WhatsApp': '💬', '电话': '📞',
    'Zoom': '💻', '展会': '🏢', '其他': '📝',
  };

  tbody.innerHTML = list.map(f => `
    <tr>
      <td>
        <div style="font-weight:700;color:#111827;">${escHtml(f.company_name)}</div>
        ${f.customer_id ? `<div style="font-size:11px;color:#9ca3af;">ID: ${f.customer_id.slice(0,8)}...</div>` : ''}
      </td>
      <td>${formatDate(f.followup_date)}</td>
      <td><span class="badge badge-gray">${METHOD_ICONS[f.contact_method] || ''} ${escHtml(f.contact_method) || '-'}</span></td>
      <td>${stageBadge(f.stage)}</td>
      <td style="max-width:220px;">
        <div style="font-size:13px;color:#374151;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escHtml(f.content)}">${escHtml(f.content) || '-'}</div>
        ${f.customer_feedback ? `<div style="font-size:11.5px;color:#0891b2;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">💬 ${escHtml(f.customer_feedback)}</div>` : ''}
      </td>
      <td style="max-width:160px;font-size:12.5px;color:#059669;">${escHtml(f.next_action) || '-'}</td>
      <td>${f.next_followup_date ? `<span style="color:${isOverdue(formatDateInput(f.next_followup_date)) ? '#dc2626' : isDueSoon(formatDateInput(f.next_followup_date)) ? '#d97706' : '#374151'};font-weight:${isOverdue(formatDateInput(f.next_followup_date)) ? '700' : '400'};">${formatDate(f.next_followup_date)}</span>` : '-'}</td>
      <td>
        <div class="td-actions">
          <button class="btn btn-ghost btn-sm" onclick="editFollowup('${f.id}')" title="编辑"><i class="fas fa-pen" style="font-size:11px;"></i></button>
          <button class="btn btn-ghost btn-sm" onclick="deleteFollowup('${f.id}')" title="删除" style="color:#dc2626;"><i class="fas fa-trash" style="font-size:11px;"></i></button>
        </div>
      </td>
    </tr>`).join('');
}

// ===== 筛选 =====
function filterFollowups() {
  const search = document.getElementById('followup-search').value.toLowerCase();
  const method = document.getElementById('followup-filter-method').value;

  filteredFollowups = allFollowups.filter(f => {
    if (search && !f.company_name?.toLowerCase().includes(search) && !f.content?.toLowerCase().includes(search)) return false;
    if (method && f.contact_method !== method) return false;
    return true;
  });
  renderFollowups(filteredFollowups);
}

// ===== 打开模态框 =====
function openFollowupModal(customerIdOrCompany = null) {
  // 预填客户信息
  let companyName = '';
  let stageVal = '初次接触';
  if (customerIdOrCompany) {
    // 可能是 customerId
    const c = allCustomers.find(c => c.id === customerIdOrCompany);
    if (c) {
      companyName = c.company_name;
      stageVal = c.stage || '初次接触';
    } else {
      companyName = customerIdOrCompany;
    }
  }

  document.getElementById('followup-modal-title').textContent = '记录跟进';
  document.getElementById('followup-id').value = '';
  document.getElementById('f-company').value = companyName;
  document.getElementById('f-date').value = new Date().toISOString().slice(0, 10);
  document.getElementById('f-method').value = 'Email';
  document.getElementById('f-stage').value = stageVal;
  document.getElementById('f-content').value = '';
  document.getElementById('f-feedback').value = '';
  document.getElementById('f-next-action').value = '';
  document.getElementById('f-next-date').value = '';
  document.getElementById('followup-modal').classList.add('active');
  setTimeout(() => document.getElementById('f-company').focus(), 100);
}
function closeFollowupModal() {
  document.getElementById('followup-modal').classList.remove('active');
}

// ===== 编辑 =====
function editFollowup(id) {
  const f = allFollowups.find(f => f.id === id);
  if (!f) return;
  document.getElementById('followup-modal-title').textContent = '编辑跟进记录';
  document.getElementById('followup-id').value = f.id;
  document.getElementById('f-company').value = f.company_name || '';
  document.getElementById('f-date').value = f.followup_date ? formatDateInput(f.followup_date) : '';
  document.getElementById('f-method').value = f.contact_method || 'Email';
  document.getElementById('f-stage').value = f.stage || '初次接触';
  document.getElementById('f-content').value = f.content || '';
  document.getElementById('f-feedback').value = f.customer_feedback || '';
  document.getElementById('f-next-action').value = f.next_action || '';
  document.getElementById('f-next-date').value = f.next_followup_date ? formatDateInput(f.next_followup_date) : '';
  document.getElementById('followup-modal').classList.add('active');
}

// ===== 保存 =====
async function saveFollowup() {
  const company = document.getElementById('f-company').value.trim();
  const content = document.getElementById('f-content').value.trim();
  if (!company) { showToast('请输入客户公司名称', 'warning'); return; }
  if (!content) { showToast('请输入跟进内容', 'warning'); return; }

  const id = document.getElementById('followup-id').value;
  // 找到对应的客户 ID
  const customer = allCustomers.find(c => c.company_name === company);

  const payload = {
    customer_id: customer?.id || '',
    company_name: company,
    followup_date: document.getElementById('f-date').value ? new Date(document.getElementById('f-date').value).getTime() : Date.now(),
    contact_method: document.getElementById('f-method').value,
    stage: document.getElementById('f-stage').value,
    content,
    customer_feedback: document.getElementById('f-feedback').value.trim(),
    next_action: document.getElementById('f-next-action').value.trim(),
    next_followup_date: document.getElementById('f-next-date').value ? new Date(document.getElementById('f-next-date').value).getTime() : null,
  };

  try {
    if (id) {
      await apiPut('followups', id, payload);
      showToast('跟进记录已更新', 'success');
    } else {
      await apiPost('followups', payload);
      showToast('跟进记录已保存', 'success');

      // 同步更新客户阶段和最近联系日期
      if (customer) {
        await apiPut('customers', customer.id, {
          ...customer,
          stage: payload.stage,
          last_contact_date: payload.followup_date,
          next_followup_date: payload.next_followup_date || customer.next_followup_date,
        });
      }
    }
    closeFollowupModal();
    await loadFollowups();
    // 刷新客户数据（因为可能更新了阶段）
    await loadCustomers();
    if (currentDetailCustomerId) loadCustomerDetail(currentDetailCustomerId);
  } catch (e) {
    showToast('保存失败，请重试', 'error');
  }
}

// ===== 删除 =====
function deleteFollowup(id) {
  const f = allFollowups.find(f => f.id === id);
  showConfirm(`确定删除「${f?.company_name || ''}」的跟进记录吗？`, async () => {
    try {
      await apiDelete('followups', id);
      showToast('已删除', 'success');
      await loadFollowups();
    } catch (e) {
      showToast('删除失败', 'error');
    }
  });
}
