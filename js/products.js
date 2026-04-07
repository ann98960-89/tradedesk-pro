/* ===================================================
   products.js - 产品资料数据库模块
   =================================================== */

let allDocs = [];
let filteredDocs = [];

// ===== 加载文档 =====
async function loadDocs() {
  try {
    const data = await apiGet('product_docs', { limit: 500 });
    allDocs = (data.data || []).sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
    filteredDocs = [...allDocs];
    renderDocs(filteredDocs);
    updateDocCategoryFilter();
    updateDocTypeStats();
  } catch (e) {
    showToast('加载文档失败', 'error');
  }
}

// ===== 渲染文档表格 =====
function renderDocs(list) {
  const tbody = document.getElementById('doc-tbody');
  const emptyEl = document.getElementById('doc-empty');
  const tableWrapper = document.querySelector('#page-products .table-wrapper');

  if (!list.length) {
    if (tableWrapper) tableWrapper.style.display = 'none';
    emptyEl.style.display = 'block';
    return;
  }
  if (tableWrapper) tableWrapper.style.display = '';
  emptyEl.style.display = 'none';

  const today = new Date();
  tbody.innerHTML = list.map(doc => {
    const expiry = doc.expiry_date ? new Date(doc.expiry_date) : null;
    const isExpired = expiry && expiry < today;
    const isExpiringSoon = expiry && !isExpired && (expiry - today) / (1000 * 60 * 60 * 24) <= 30;

    return `
    <tr>
      <td>
        <div style="font-weight:700;color:#111827;">${escHtml(doc.product_name)}</div>
      </td>
      <td style="font-size:12px;color:#6b7280;">${escHtml(doc.product_code) || '-'}</td>
      <td>${doc.category ? `<span class="badge badge-gray" style="font-size:11px;">${escHtml(doc.category)}</span>` : '-'}</td>
      <td>${docTypeBadge(doc.doc_type)}</td>
      <td style="max-width:200px;">
        <div style="font-weight:600;color:#374151;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escHtml(doc.doc_title)}">
          ${doc.file_url ? `<a href="${escHtml(doc.file_url)}" target="_blank" style="color:#1a56db;" title="点击打开文档">📄 ${escHtml(doc.doc_title)}</a>` : escHtml(doc.doc_title)}
        </div>
        ${doc.file_name ? `<div style="font-size:11px;color:#9ca3af;">${escHtml(doc.file_name)}</div>` : ''}
      </td>
      <td style="font-size:12px;">${doc.version ? `<span class="badge badge-gray">${escHtml(doc.version)}</span>` : '-'}</td>
      <td style="font-size:12.5px;">${formatDate(doc.publish_date)}</td>
      <td style="font-size:12.5px;">
        ${expiry ? `<span style="color:${isExpired ? '#dc2626' : isExpiringSoon ? '#d97706' : '#374151'};font-weight:${isExpired || isExpiringSoon ? '700' : '400'};">
          ${isExpired ? '⚠️ 已过期' : isExpiringSoon ? '🔔 即将到期' : formatDate(doc.expiry_date)}
        </span>` : '-'}
      </td>
      <td style="max-width:140px;">
        ${doc.tags ? doc.tags.split(',').slice(0,3).map(t => `<span style="background:#f3f4f6;color:#4b5563;font-size:10.5px;padding:2px 7px;border-radius:4px;margin:1px;display:inline-block;">${escHtml(t.trim())}</span>`).join('') : '-'}
      </td>
      <td>
        <div class="td-actions">
          ${doc.file_url ? `<a href="${escHtml(doc.file_url)}" target="_blank" class="btn btn-ghost btn-sm" title="下载/查看" style="color:#059669;"><i class="fas fa-external-link-alt" style="font-size:11px;"></i></a>` : ''}
          <button class="btn btn-ghost btn-sm" onclick="editDoc('${doc.id}')" title="编辑"><i class="fas fa-pen" style="font-size:11px;"></i></button>
          <button class="btn btn-ghost btn-sm" onclick="deleteDoc('${doc.id}')" title="删除" style="color:#dc2626;"><i class="fas fa-trash" style="font-size:11px;"></i></button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

// ===== 更新类别筛选 =====
function updateDocCategoryFilter() {
  const categories = [...new Set(allDocs.map(d => d.category).filter(Boolean))];
  const sel = document.getElementById('doc-filter-category');
  const current = sel.value;
  sel.innerHTML = '<option value="">全部产品类别</option>' +
    categories.map(c => `<option value="${escHtml(c)}">${escHtml(c)}</option>`).join('');
  if (current) sel.value = current;
}

// ===== 文档类型统计 =====
function updateDocTypeStats() {
  const types = ['SDS', 'TDS', 'COA', 'Inspection-Report', '选型指南', '其他'];
  const icons = { 'SDS':'🟡', 'TDS':'🔵', 'COA':'🟢', 'Inspection-Report':'🟣', '选型指南':'🩷', '其他':'⚪' };
  const container = document.getElementById('doc-type-stats');
  const counts = {};
  allDocs.forEach(d => { counts[d.doc_type] = (counts[d.doc_type] || 0) + 1; });

  container.innerHTML = types.map(t => {
    const count = counts[t] || 0;
    if (!count) return '';
    return `<div class="card" style="padding:10px 16px;cursor:pointer;display:flex;align-items:center;gap:8px;" onclick="quickFilterDocType('${t}')">
      ${docTypeBadge(t)}
      <span style="font-size:18px;font-weight:800;color:#111827;">${count}</span>
      <span style="font-size:11.5px;color:#6b7280;">份</span>
    </div>`;
  }).join('') + `<div class="card" style="padding:10px 16px;display:flex;align-items:center;gap:8px;">
    <span style="font-size:12px;font-weight:600;color:#6b7280;">总计</span>
    <span style="font-size:18px;font-weight:800;color:#1a56db;">${allDocs.length}</span>
    <span style="font-size:11.5px;color:#6b7280;">份文档</span>
  </div>`;
}

function quickFilterDocType(type) {
  document.getElementById('doc-filter-type').value = type;
  filterDocs();
}

// ===== 筛选文档 =====
function filterDocs() {
  const search = document.getElementById('doc-search').value.toLowerCase();
  const type = document.getElementById('doc-filter-type').value;
  const category = document.getElementById('doc-filter-category').value;

  filteredDocs = allDocs.filter(d => {
    if (search && !d.product_name?.toLowerCase().includes(search) &&
        !d.doc_title?.toLowerCase().includes(search) &&
        !d.tags?.toLowerCase().includes(search) &&
        !d.product_code?.toLowerCase().includes(search)) return false;
    if (type && d.doc_type !== type) return false;
    if (category && d.category !== category) return false;
    return true;
  });
  renderDocs(filteredDocs);
}

// ===== 打开模态框 =====
function openDocModal(doc = null) {
  document.getElementById('doc-modal-title').textContent = doc ? '编辑文档信息' : '添加产品文档';
  document.getElementById('doc-id').value = doc?.id || '';
  document.getElementById('d-product').value = doc?.product_name || '';
  document.getElementById('d-code').value = doc?.product_code || '';
  document.getElementById('d-category').value = doc?.category || '';
  document.getElementById('d-type').value = doc?.doc_type || 'SDS';
  document.getElementById('d-title').value = doc?.doc_title || '';
  document.getElementById('d-url').value = doc?.file_url || '';
  document.getElementById('d-filename').value = doc?.file_name || '';
  document.getElementById('d-version').value = doc?.version || '';
  document.getElementById('d-publish').value = doc?.publish_date ? formatDateInput(doc.publish_date) : '';
  document.getElementById('d-expiry').value = doc?.expiry_date ? formatDateInput(doc.expiry_date) : '';
  document.getElementById('d-tags').value = doc?.tags || '';
  document.getElementById('d-notes').value = doc?.notes || '';
  document.getElementById('doc-modal').classList.add('active');
  setTimeout(() => document.getElementById('d-product').focus(), 100);
}
function closeDocModal() {
  document.getElementById('doc-modal').classList.remove('active');
}

// ===== 编辑 =====
function editDoc(id) {
  const doc = allDocs.find(d => d.id === id);
  if (doc) openDocModal(doc);
}

// ===== 保存 =====
async function saveDoc() {
  const product = document.getElementById('d-product').value.trim();
  const title = document.getElementById('d-title').value.trim();
  if (!product) { showToast('请输入产品名称', 'warning'); return; }
  if (!title) { showToast('请输入文档标题', 'warning'); return; }

  const id = document.getElementById('doc-id').value;
  const payload = {
    product_name: product,
    product_code: document.getElementById('d-code').value.trim(),
    category: document.getElementById('d-category').value.trim(),
    doc_type: document.getElementById('d-type').value,
    doc_title: title,
    file_url: document.getElementById('d-url').value.trim(),
    file_name: document.getElementById('d-filename').value.trim(),
    version: document.getElementById('d-version').value.trim(),
    publish_date: document.getElementById('d-publish').value ? new Date(document.getElementById('d-publish').value).getTime() : null,
    expiry_date: document.getElementById('d-expiry').value ? new Date(document.getElementById('d-expiry').value).getTime() : null,
    tags: document.getElementById('d-tags').value.trim(),
    notes: document.getElementById('d-notes').value.trim(),
  };

  try {
    if (id) {
      await apiPut('product_docs', id, payload);
      showToast('文档信息已更新', 'success');
    } else {
      await apiPost('product_docs', payload);
      showToast('文档已添加', 'success');
    }
    closeDocModal();
    await loadDocs();
  } catch (e) {
    showToast('保存失败，请重试', 'error');
  }
}

// ===== 删除 =====
function deleteDoc(id) {
  const doc = allDocs.find(d => d.id === id);
  showConfirm(`确定删除文档「${doc?.doc_title || ''}」吗？`, async () => {
    try {
      await apiDelete('product_docs', id);
      showToast('已删除', 'success');
      await loadDocs();
    } catch (e) {
      showToast('删除失败', 'error');
    }
  });
}
