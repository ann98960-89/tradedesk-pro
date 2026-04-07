/* ===================================================
   dashboard.js - 工作台总览仪表盘
   =================================================== */

async function loadDashboard() {
  try {
    // 并行加载所有数据
    const [todosData, customersData, docsData, followupsData] = await Promise.all([
      apiGet('todos', { limit: 500 }),
      apiGet('customers', { limit: 500 }),
      apiGet('product_docs', { limit: 500 }),
      apiGet('followups', { limit: 200 }),
    ]);

    const todos = todosData.data || [];
    const customers = customersData.data || [];
    const docs = docsData.data || [];
    const followups = followupsData.data || [];

    // 同步到全局缓存
    if (!allCustomers.length) allCustomers = customers;

    // ===== 统计卡片 =====
    const pendingTodos = todos.filter(t => t.status !== '已完成');
    const urgentTodos = pendingTodos.filter(t => t.priority === '高' || isOverdue(formatDateInput(t.due_date)));

    document.getElementById('dash-todo-count').textContent = pendingTodos.length;
    document.getElementById('dash-todo-urgent').textContent = urgentTodos.length + ' 项紧急';
    document.getElementById('dash-todo-urgent').className = 'stat-change ' + (urgentTodos.length > 0 ? 'down' : 'up');

    const activeStages = ['需求确认','样品寄送','报价谈判','下单确认','生产跟进','出货物流'];
    const activeCustomers = customers.filter(c => activeStages.includes(c.stage));
    document.getElementById('dash-customer-count').textContent = customers.length;
    document.getElementById('dash-customer-active').textContent = activeCustomers.length + ' 活跃';

    const inProgressCustomers = customers.filter(c => c.stage !== '回款完成' && c.stage !== '长期合作');
    const potentialAmount = inProgressCustomers.reduce((sum, c) => sum + (c.order_amount || 0), 0);
    document.getElementById('dash-pipeline-count').textContent = inProgressCustomers.length;
    document.getElementById('dash-pipeline-amount').textContent = '$' + (potentialAmount > 9999 ? (potentialAmount / 1000).toFixed(0) + 'K' : potentialAmount.toLocaleString()) + ' 潜在';

    document.getElementById('dash-doc-count').textContent = docs.length;
    const docTypes = [...new Set(docs.map(d => d.doc_type))];
    document.getElementById('dash-doc-types').textContent = docTypes.slice(0,3).join(' / ') || '暂无文档';

    // ===== 今日待办预览 =====
    const dashTodos = pendingTodos.slice(0, 8);
    const dashTodoList = document.getElementById('dash-todos-list');
    if (!dashTodos.length) {
      dashTodoList.innerHTML = `<div class="empty-state" style="padding:30px;"><div style="font-size:32px;">🎉</div><p style="margin-top:8px;color:#6b7280;">太棒了，没有待办事项！</p></div>`;
    } else {
      const priorityColors = { '高': '#fee2e2', '中': '#fef3c7', '低': '#f0fdf4' };
      const priorityDots = { '高': '#dc2626', '中': '#d97706', '低': '#059669' };
      dashTodoList.innerHTML = dashTodos.map(t => `
        <div style="display:flex;align-items:center;gap:10px;padding:11px 20px;border-bottom:1px solid #f3f4f6;">
          <div class="todo-check ${t.status === '已完成' ? 'checked' : ''}" onclick="toggleTodoStatus('${t.id}', ${t.status === '已完成'})"></div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:13.5px;font-weight:600;color:#111827;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(t.title)}</div>
            <div style="font-size:11.5px;color:#6b7280;">${t.category || ''} ${t.related_customer ? '· ' + escHtml(t.related_customer) : ''} ${t.due_date ? '· ' + formatDate(t.due_date) : ''}</div>
          </div>
          <div style="width:8px;height:8px;border-radius:50%;background:${priorityDots[t.priority] || '#9ca3af'};flex-shrink:0;"></div>
        </div>`).join('') +
        (pendingTodos.length > 8 ? `<div style="text-align:center;padding:12px;font-size:12px;color:#1a56db;cursor:pointer;" onclick="switchPage('todos')">查看全部 ${pendingTodos.length} 条待办 →</div>` : '');
    }

    // ===== 需要跟进客户 =====
    const now = new Date();
    const needFollowup = customers
      .filter(c => c.next_followup_date && (isOverdue(formatDateInput(c.next_followup_date)) || isDueSoon(formatDateInput(c.next_followup_date), 3)))
      .sort((a, b) => (a.next_followup_date || 0) - (b.next_followup_date || 0))
      .slice(0, 8);

    const dashFollowupList = document.getElementById('dash-followup-list');
    if (!needFollowup.length) {
      dashFollowupList.innerHTML = `<div class="empty-state" style="padding:24px;"><div style="font-size:28px;">✨</div><p style="margin-top:6px;color:#6b7280;font-size:12px;">暂无需要跟进的客户</p></div>`;
    } else {
      dashFollowupList.innerHTML = needFollowup.map(c => {
        const overdue = isOverdue(formatDateInput(c.next_followup_date));
        return `
          <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #f3f4f6;cursor:pointer;" onclick="openDetailPanel('${c.id}')">
            <div style="width:36px;height:36px;border-radius:8px;background:${overdue ? '#fee2e2' : '#fef3c7'};display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;">${overdue ? '⚠️' : '🔔'}</div>
            <div style="flex:1;min-width:0;">
              <div style="font-size:13px;font-weight:700;color:#111827;">${escHtml(c.company_name)}</div>
              <div style="font-size:11.5px;color:#6b7280;">${escHtml(c.country || '')} · ${stageBadge(c.stage)}</div>
            </div>
            <div style="text-align:right;flex-shrink:0;">
              <div style="font-size:12px;font-weight:700;color:${overdue ? '#dc2626' : '#d97706'};">${formatDate(c.next_followup_date)}</div>
              ${ratingBadge(c.rating)}
            </div>
          </div>`;
      }).join('');
    }

    // ===== 销售漏斗概览 =====
    const funnelContainer = document.getElementById('dash-funnel');
    const stageCounts = {};
    const stageAmounts = {};
    customers.forEach(c => {
      stageCounts[c.stage] = (stageCounts[c.stage] || 0) + 1;
      stageAmounts[c.stage] = (stageAmounts[c.stage] || 0) + (c.order_amount || 0);
    });
    funnelContainer.innerHTML = STAGE_ORDER.map(stage => {
      const count = stageCounts[stage] || 0;
      const amount = stageAmounts[stage] || 0;
      const pct = customers.length ? Math.round((count / customers.length) * 100) : 0;
      return `
        <div class="card" style="flex:1;min-width:110px;padding:14px;cursor:pointer;text-align:center;" onclick="switchPage('pipeline')">
          <div style="font-size:18px;margin-bottom:5px;">${STAGE_ICONS[stage]}</div>
          <div style="font-size:12px;font-weight:600;color:#374151;margin-bottom:4px;">${stage}</div>
          <div style="font-size:22px;font-weight:800;color:#111827;">${count}</div>
          ${amount > 0 ? `<div style="font-size:11px;color:#059669;font-weight:600;margin-top:3px;">${formatAmount(amount)}</div>` : ''}
          <div style="margin-top:8px;height:4px;background:#f3f4f6;border-radius:2px;">
            <div style="height:100%;border-radius:2px;background:linear-gradient(90deg,#1a56db,#0891b2);width:${pct}%;transition:width 0.4s;"></div>
          </div>
        </div>`;
    }).join('');

    updateBadges();
  } catch (e) {
    console.error('Dashboard load error:', e);
    showToast('加载仪表盘数据失败', 'error');
  }
}
