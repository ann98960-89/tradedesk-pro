/* ===================================================
   todos.js - 每日待办事项模块
   =================================================== */

let allTodos = [];
let filteredTodos = [];

// ===== 加载待办列表 =====
async function loadTodos() {
  try {
    const data = await apiGet('todos', { limit: 500, sort: 'due_date' });
    allTodos = data.data || [];
    filteredTodos = [...allTodos];
    renderTodos(filteredTodos);
    updateBadges();
  } catch (e) {
    showToast('加载待办事项失败', 'error');
  }
}

// ===== 渲染待办 =====
function renderTodos(list) {
  const container = document.getElementById('todos-container');
  if (!list.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <h3>暂无待办事项</h3>
        <p>点击「新建待办」添加第一条任务</p>
      </div>`;
    return;
  }

  // 分组：高/中/低优先级 & 已完成
  const groups = { '高': [], '中': [], '低': [], '已完成': [] };
  list.forEach(t => {
    if (t.status === '已完成') groups['已完成'].push(t);
    else groups[t.priority || '中'].push(t);
  });

  const groupConfig = [
    { key: '高', label: '🔴 高优先级', color: '#fee2e2' },
    { key: '中', label: '🟡 中优先级', color: '#fef3c7' },
    { key: '低', label: '🟢 低优先级', color: '#d1fae5' },
    { key: '已完成', label: '✅ 已完成', color: '#f3f4f6' },
  ];

  let html = '';
  groupConfig.forEach(({ key, label, color }) => {
    const items = groups[key];
    if (!items.length) return;
    html += `
      <div class="card" style="margin-bottom:16px;">
        <div class="card-header" style="background:${color}20;padding:12px 20px;">
          <div class="card-title" style="font-size:13px;">${label} <span style="font-weight:400;color:#6b7280;">(${items.length})</span></div>
        </div>
        <div>`;
    items.forEach(t => {
      html += renderTodoItem(t);
    });
    html += `</div></div>`;
  });
  container.innerHTML = html;
}

function renderTodoItem(t) {
  const isChecked = t.status === '已完成';
  const overdue = !isChecked && isOverdue(t.due_date);
  const dueToday = !isChecked && isDueToday(t.due_date);

  let dateLabel = '';
  if (t.due_date) {
    if (overdue) dateLabel = `<span style="color:#dc2626;font-weight:600;font-size:11px;">⚠️ 已逾期</span>`;
    else if (dueToday) dateLabel = `<span style="color:#d97706;font-weight:600;font-size:11px;">🔔 今天</span>`;
    else dateLabel = `<span style="color:#9ca3af;font-size:11px;">📅 ${formatDate(t.due_date)}</span>`;
  }

  const catColors = { 跟进:'#dbeafe', 会议:'#ede9fe', 报价:'#fef3c7', 发货:'#d1fae5', 回款:'#fee2e2', 其他:'#f3f4f6' };
  const catColor = catColors[t.category] || '#f3f4f6';

  return `
    <div class="todo-item" id="todo-item-${t.id}" style="display:flex;align-items:flex-start;gap:12px;padding:14px 20px;border-bottom:1px solid #f3f4f6;transition:background 0.15s;${isChecked ? 'opacity:0.55;' : ''}">
      <div class="todo-check ${isChecked ? 'checked' : ''}" onclick="toggleTodoStatus('${t.id}', ${isChecked})" title="${isChecked ? '标记为未完成' : '标记为已完成'}"></div>
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px;">
          <span style="font-size:14px;font-weight:600;color:${isChecked ? '#9ca3af' : '#111827'};${isChecked ? 'text-decoration:line-through;' : ''}">${escHtml(t.title)}</span>
          <span style="background:${catColor};color:#374151;font-size:10.5px;font-weight:600;padding:2px 7px;border-radius:4px;">${t.category || ''}</span>
          ${dateLabel}
          ${t.related_customer ? `<span style="color:#6b7280;font-size:11.5px;">👤 ${escHtml(t.related_customer)}</span>` : ''}
        </div>
        ${t.description ? `<div style="font-size:12.5px;color:#6b7280;line-height:1.5;margin-top:2px;">${escHtml(t.description)}</div>` : ''}
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0;">
        <button class="btn btn-ghost btn-sm" onclick="editTodo('${t.id}')" title="编辑"><i class="fas fa-pen" style="font-size:11px;"></i></button>
        <button class="btn btn-ghost btn-sm" onclick="deleteTodo('${t.id}')" title="删除" style="color:#dc2626;"><i class="fas fa-trash" style="font-size:11px;"></i></button>
      </div>
    </div>`;
}

// ===== 筛选待办 =====
function filterTodos() {
  const search = document.getElementById('todo-search').value.toLowerCase();
  const status = document.getElementById('todo-filter-status').value;
  const priority = document.getElementById('todo-filter-priority').value;
  const category = document.getElementById('todo-filter-category').value;

  filteredTodos = allTodos.filter(t => {
    if (search && !t.title?.toLowerCase().includes(search) && !t.related_customer?.toLowerCase().includes(search)) return false;
    if (status && t.status !== status) return false;
    if (priority && t.priority !== priority) return false;
    if (category && t.category !== category) return false;
    return true;
  });
  renderTodos(filteredTodos);
}

// ===== 切换完成状态 =====
async function toggleTodoStatus(id, isChecked) {
  try {
    const newStatus = isChecked ? '待处理' : '已完成';
    await apiPut('todos', id, { status: newStatus });
    showToast(isChecked ? '已标记为待处理' : '✅ 已完成！', 'success');
    await loadTodos();
  } catch (e) {
    showToast('操作失败', 'error');
  }
}

// ===== 打开模态框 =====
function openTodoModal(todo = null) {
  document.getElementById('todo-modal-title').textContent = todo ? '编辑待办事项' : '新建待办事项';
  document.getElementById('todo-id').value = todo?.id || '';
  document.getElementById('todo-title').value = todo?.title || '';
  document.getElementById('todo-category').value = todo?.category || '跟进';
  document.getElementById('todo-priority').value = todo?.priority || '中';
  document.getElementById('todo-due-date').value = todo?.due_date ? formatDateInput(todo.due_date) : new Date().toISOString().slice(0,10);
  document.getElementById('todo-customer').value = todo?.related_customer || '';
  document.getElementById('todo-status').value = todo?.status || '待处理';
  document.getElementById('todo-desc').value = todo?.description || '';
  document.getElementById('todo-modal').classList.add('active');
  setTimeout(() => document.getElementById('todo-title').focus(), 100);
}
function closeTodoModal() {
  document.getElementById('todo-modal').classList.remove('active');
}

// ===== 编辑待办 =====
function editTodo(id) {
  const todo = allTodos.find(t => t.id === id);
  if (todo) openTodoModal(todo);
}

// ===== 保存待办 =====
async function saveTodo() {
  const title = document.getElementById('todo-title').value.trim();
  if (!title) { showToast('请输入待办标题', 'warning'); return; }

  const id = document.getElementById('todo-id').value;
  const payload = {
    title,
    category: document.getElementById('todo-category').value,
    priority: document.getElementById('todo-priority').value,
    due_date: document.getElementById('todo-due-date').value ? new Date(document.getElementById('todo-due-date').value).getTime() : null,
    related_customer: document.getElementById('todo-customer').value.trim(),
    status: document.getElementById('todo-status').value,
    description: document.getElementById('todo-desc').value.trim(),
  };

  try {
    if (id) {
      await apiPut('todos', id, payload);
      showToast('待办事项已更新', 'success');
    } else {
      await apiPost('todos', payload);
      showToast('待办事项已创建', 'success');
    }
    closeTodoModal();
    await loadTodos();
  } catch (e) {
    showToast('保存失败，请重试', 'error');
  }
}

// ===== 删除待办 =====
function deleteTodo(id) {
  const todo = allTodos.find(t => t.id === id);
  showConfirm(`确定要删除待办「${todo?.title || ''}」吗？此操作不可撤销。`, async () => {
    try {
      await apiDelete('todos', id);
      showToast('已删除', 'success');
      await loadTodos();
    } catch (e) {
      showToast('删除失败', 'error');
    }
  });
}

// ===== 清除已完成 =====
async function clearCompletedTodos() {
  const completed = allTodos.filter(t => t.status === '已完成');
  if (!completed.length) { showToast('没有已完成的待办', 'info'); return; }
  showConfirm(`确定删除全部 ${completed.length} 条已完成待办吗？`, async () => {
    try {
      await Promise.all(completed.map(t => apiDelete('todos', t.id)));
      showToast(`已清除 ${completed.length} 条已完成待办`, 'success');
      await loadTodos();
    } catch (e) {
      showToast('清除失败', 'error');
    }
  });
}

// escHtml is defined in app.js
