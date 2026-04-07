/* =====================================================
   recycle.js — 软删除保护 & 回收站模块

   核心机制：
   所有"删除"操作改为向记录打标记 { _deleted: true, _deleted_at: timestamp }
   真实 DELETE 请求不再发出（对外界永远有数据，只是标记隐藏）
   回收站可查看并一键恢复，30天后提示永久清除
   ===================================================== */

// ===== 软删除：给记录打标记，替代真实删除 =====
async function softDelete(table, id, label) {
  try {
    // PATCH 只更新删除标记字段
    const res = await fetch(`tables/${table}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        _deleted: true,
        _deleted_at: new Date().toISOString(),
        _deleted_label: await encryptValue(label || id),
      }),
    });
    if (!res.ok) throw new Error('标记失败');
    return true;
  } catch (e) {
    console.error('softDelete error:', e);
    return false;
  }
}

// ===== 恢复：清除删除标记 =====
async function restoreRecord(table, id) {
  try {
    const res = await fetch(`tables/${table}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        _deleted: false,
        _deleted_at: null,
        _deleted_label: null,
      }),
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

// ===== 真正永久删除（回收站清除时才调用）=====
async function permanentDelete(table, id) {
  try {
    const res = await fetch(`tables/${table}/${id}`, { method: 'DELETE' });
    return res.ok || res.status === 204;
  } catch (e) {
    return false;
  }
}

// ===== 加载回收站数据 =====
async function loadRecycleBin() {
  const tables = [
    { key: 'customers',              label: '客户',     icon: '🤝' },
    { key: 'todos',                  label: '待办',     icon: '✅' },
    { key: 'followups',              label: '跟进记录', icon: '📋' },
    { key: 'customer_investigation', label: '背调',     icon: '🔍' },
    { key: 'product_docs',           label: '产品文档', icon: '📁' },
    { key: 'trial_feedback',         label: '试样反馈', icon: '🔬' },
  ];

  const container = document.getElementById('recycle-list');
  if (!container) return;
  container.innerHTML = `<div style="text-align:center;padding:30px;color:#9ca3af;font-size:13px;">⏳ 加载中...</div>`;

  let allDeleted = [];

  for (const t of tables) {
    try {
      const res = await fetch(`tables/${t.key}?limit=500`);
      const json = await res.json();
      const deleted = (json.data || []).filter(r => r._deleted === true);
      for (const r of deleted) {
        // 解密标签
        let displayLabel = r._deleted_label || r.id;
        try { displayLabel = await decryptValue(displayLabel); } catch(e) {}
        allDeleted.push({
          ...r,
          _table: t.key,
          _tableLabel: t.label,
          _tableIcon: t.icon,
          _displayLabel: displayLabel,
        });
      }
    } catch(e) { /* 表不存在则跳过 */ }
  }

  // 更新回收站徽章
  const badge = document.getElementById('recycle-badge');
  if (badge) {
    badge.textContent = allDeleted.length;
    badge.style.display = allDeleted.length > 0 ? '' : 'none';
  }

  if (!allDeleted.length) {
    container.innerHTML = `
      <div class="empty-state" style="padding:50px 20px;">
        <div class="empty-icon">🗑️</div>
        <h3>回收站为空</h3>
        <p>删除的数据会暂存于此，可随时恢复</p>
      </div>`;
    return;
  }

  // 按删除时间排序（最新在前）
  allDeleted.sort((a, b) => new Date(b._deleted_at||0) - new Date(a._deleted_at||0));

  const now = Date.now();
  container.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px;">
      <div style="font-size:13px;color:#6b7280;">共 <strong style="color:#374151;">${allDeleted.length}</strong> 条已删除记录，可随时恢复</div>
      <button class="btn btn-sm btn-danger" onclick="confirmClearAll()" style="font-size:12px;">
        <i class="fas fa-trash"></i> 清空回收站
      </button>
    </div>
    <div class="table-wrapper">
      <table>
        <thead><tr>
          <th>类型</th><th>记录标识</th><th>删除时间</th><th>距今</th><th>操作</th>
        </tr></thead>
        <tbody>
          ${allDeleted.map(r => {
            const deletedAt = r._deleted_at ? new Date(r._deleted_at) : null;
            const daysAgo = deletedAt ? Math.floor((now - deletedAt.getTime()) / 86400000) : 0;
            const isOld = daysAgo >= 25;
            return `
              <tr>
                <td><span class="badge badge-gray">${r._tableIcon} ${r._tableLabel}</span></td>
                <td style="font-weight:600;color:#374151;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                  ${escHtml(r._displayLabel)}
                </td>
                <td style="font-size:12.5px;color:#6b7280;">${deletedAt ? deletedAt.toLocaleString('zh-CN') : '-'}</td>
                <td>
                  ${isOld
                    ? `<span style="color:#dc2626;font-size:12px;font-weight:600;">⚠️ ${daysAgo}天前</span>`
                    : `<span style="font-size:12px;color:#9ca3af;">${daysAgo}天前</span>`
                  }
                </td>
                <td>
                  <div class="td-actions">
                    <button class="btn btn-sm btn-success" style="font-size:11.5px;" onclick="doRestore('${r._table}','${r.id}',this)">
                      ↩️ 恢复
                    </button>
                    <button class="btn btn-sm btn-danger" style="font-size:11.5px;" onclick="doPermDelete('${r._table}','${r.id}',this)">
                      <i class="fas fa-trash" style="font-size:10px;"></i>
                    </button>
                  </div>
                </td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

// ===== 恢复单条记录 =====
async function doRestore(table, id, btn) {
  btn.disabled = true;
  btn.textContent = '⏳';
  const ok = await restoreRecord(table, id);
  if (ok) {
    showToast('✅ 已恢复！', 'success');
    await loadRecycleBin();
  } else {
    showToast('恢复失败', 'error');
    btn.disabled = false;
    btn.textContent = '↩️ 恢复';
  }
}

// ===== 永久删除单条 =====
async function doPermDelete(table, id, btn) {
  showConfirm('确定永久删除？此操作无法撤销。', async () => {
    btn.disabled = true;
    const ok = await permanentDelete(table, id);
    if (ok) {
      showToast('已永久删除', 'success');
      await loadRecycleBin();
    } else {
      showToast('删除失败', 'error');
    }
  });
}

// ===== 清空回收站 =====
async function confirmClearAll() {
  showConfirm('确定清空整个回收站？所有标记删除的数据将被永久清除，无法恢复。', async () => {
    const container = document.getElementById('recycle-list');
    const rows = container.querySelectorAll('tbody tr');
    let count = 0;
    // 遍历所有行并永久删除
    const allItems = [];
    const trs = container.querySelectorAll('tbody tr');
    trs.forEach(tr => {
      const restoreBtn = tr.querySelector('.btn-success');
      const deleteBtn  = tr.querySelector('.btn-danger');
      if (restoreBtn && deleteBtn) {
        const onclickRestore = restoreBtn.getAttribute('onclick') || '';
        const match = onclickRestore.match(/doRestore\('([^']+)','([^']+)'/);
        if (match) allItems.push({ table: match[1], id: match[2] });
      }
    });

    for (const item of allItems) {
      await permanentDelete(item.table, item.id);
      count++;
    }
    showToast(`✅ 已永久清除 ${count} 条记录`, 'success');
    await loadRecycleBin();
  });
}

// ===== 打开/关闭回收站面板 =====
function openRecycleBin() {
  document.getElementById('recycle-modal').classList.add('active');
  loadRecycleBin();
}
function closeRecycleBin() {
  document.getElementById('recycle-modal').classList.remove('active');
}

// ===== 初始化时更新回收站徽章数量 =====
async function updateRecycleBadge() {
  try {
    const tables = ['customers','todos','followups','customer_investigation','product_docs','trial_feedback'];
    let total = 0;
    for (const t of tables) {
      try {
        const res = await fetch(`tables/${t}?limit=500`);
        const json = await res.json();
        total += (json.data || []).filter(r => r._deleted === true).length;
      } catch(e) {}
    }
    const badge = document.getElementById('recycle-badge');
    if (badge) { badge.textContent = total; badge.style.display = total > 0 ? '' : 'none'; }
  } catch(e) {}
}
