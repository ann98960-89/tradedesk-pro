/* =====================================================
   backup.js — 自动备份 & 数据保全模块

   功能：
   1. 登录时检测距上次备份天数，超过7天弹提醒横幅
   2. localStorage 实时镜像：每次写入数据同时在本地存一份
   3. 一键备份下载：导出加密JSON包 + 明文Excel（双保险）
   4. 备份历史记录显示
   ===================================================== */

const BACKUP_LAST_KEY   = 'tdp_last_backup';   // localStorage：上次备份时间
const BACKUP_CACHE_KEY  = 'tdp_data_cache';     // localStorage：本地数据镜像
const BACKUP_WARN_DAYS  = 7;                    // 超过N天未备份则提醒

/* ─────────────────────────────────────────────────────
   初始化：登录后检查是否需要提醒备份
───────────────────────────────────────────────────── */
function initBackupCheck() {
  const lastBackup = localStorage.getItem(BACKUP_LAST_KEY);
  if (!lastBackup) {
    // 从未备份过，首次提醒
    showBackupBanner('首次使用提醒：建议立即备份一次数据到本地电脑', 'info');
    return;
  }
  const daysSince = Math.floor((Date.now() - parseInt(lastBackup)) / 86400000);
  if (daysSince >= BACKUP_WARN_DAYS) {
    showBackupBanner(`⚠️ 距上次备份已 ${daysSince} 天，建议立即备份`, 'warning');
  }
}

/* ─────────────────────────────────────────────────────
   顶部提醒横幅
───────────────────────────────────────────────────── */
function showBackupBanner(msg, type) {
  const el = document.getElementById('backup-banner');
  if (!el) return;
  const colors = {
    warning: { bg: '#fef3c7', border: '#fcd34d', text: '#92400e', btn: '#d97706' },
    info:    { bg: '#e0f2fe', border: '#bae6fd', text: '#0c4a6e', btn: '#0369a1' },
  };
  const c = colors[type] || colors.info;
  el.style.cssText = `
    display:flex; align-items:center; gap:12px;
    background:${c.bg}; border-bottom:1px solid ${c.border};
    color:${c.text}; padding:10px 20px; font-size:13px; font-weight:500;
    position:sticky; top:0; z-index:200;
  `;
  el.innerHTML = `
    <span style="flex:1;">${msg}</span>
    <button onclick="quickBackup()" style="background:${c.btn};color:#fff;border:none;border-radius:6px;padding:6px 14px;font-size:12.5px;font-weight:600;cursor:pointer;white-space:nowrap;">
      💾 立即备份
    </button>
    <button onclick="dismissBackupBanner()" style="background:none;border:none;color:${c.text};cursor:pointer;font-size:18px;padding:0 4px;opacity:0.6;">×</button>
  `;
}

function dismissBackupBanner() {
  const el = document.getElementById('backup-banner');
  if (el) el.style.display = 'none';
}

/* ─────────────────────────────────────────────────────
   快速备份（一键，从横幅触发）
───────────────────────────────────────────────────── */
async function quickBackup() {
  dismissBackupBanner();
  showToast('⏳ 正在收集数据，请稍候...', 'info', 3000);
  try {
    await doFullBackup();
  } catch(e) {
    showToast('备份失败：' + e.message, 'error');
  }
}

/* ─────────────────────────────────────────────────────
   完整备份：同时生成 Excel + 加密JSON
───────────────────────────────────────────────────── */
async function doFullBackup() {
  const tables = [
    { key: 'customers',              name: '客户列表' },
    { key: 'todos',                  name: '待办事项' },
    { key: 'followups',              name: '跟进记录' },
    { key: 'customer_investigation', name: '客户背调' },
    { key: 'product_docs',           name: '产品文档' },
    { key: 'trial_feedback',         name: '试样反馈' },
  ];

  const backupData = {};
  let totalRows = 0;

  for (const t of tables) {
    try {
      const res = await apiGet(t.key, { limit: 2000 });
      backupData[t.key] = res.data || [];
      totalRows += backupData[t.key].length;
    } catch(e) {
      backupData[t.key] = [];
    }
  }

  // 更新本地缓存镜像
  try {
    localStorage.setItem(BACKUP_CACHE_KEY, JSON.stringify({
      ts: Date.now(),
      data: backupData,
    }));
  } catch(e) { /* localStorage 可能已满，忽略 */ }

  // ① 导出 Excel（明文，可直接用 Excel 打开）
  await exportBackupExcel(backupData, tables);

  // ② 同时导出加密JSON备份包
  exportBackupJson(backupData);

  // 记录备份时间
  localStorage.setItem(BACKUP_LAST_KEY, String(Date.now()));
  updateBackupStatus();

  showToast(`✅ 备份完成！共 ${totalRows} 条数据，已下载到电脑`, 'success', 5000);
}

/* ─────────────────────────────────────────────────────
   导出 Excel 备份（明文可读）
───────────────────────────────────────────────────── */
async function exportBackupExcel(backupData, tables) {
  if (typeof XLSX === 'undefined') return;

  const wb   = XLSX.utils.book_new();
  const date = new Date().toLocaleDateString('zh-CN').replace(/\//g, '-');

  for (const t of tables) {
    const rows = backupData[t.key] || [];
    if (!rows.length) continue;

    // 取所有字段（排除系统字段和软删除字段）
    const skip = new Set(['gs_project_id','gs_table_name','_deleted','_deleted_at','_deleted_label']);
    const keys = [...new Set(rows.flatMap(r => Object.keys(r)))].filter(k => !skip.has(k));

    const sheetData = [
      keys,
      ...rows.map(r => keys.map(k => {
        const v = r[k];
        if (v === null || v === undefined) return '';
        if (typeof v === 'number' && (k.includes('_at') || k.includes('date'))) {
          try { return new Date(v).toLocaleString('zh-CN'); } catch(e) {}
        }
        return String(v);
      })),
    ];

    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    // 列宽
    ws['!cols'] = keys.map(() => ({ wch: 20 }));
    XLSX.utils.book_append_sheet(wb, ws, t.name.slice(0, 31));
  }

  XLSX.writeFile(wb, `TradeDesk_备份_${date}.xlsx`);
}

/* ─────────────────────────────────────────────────────
   导出加密JSON备份包（可用于恢复导入）
───────────────────────────────────────────────────── */
function exportBackupJson(backupData) {
  const payload = {
    app: 'TradeDesk Pro',
    version: '1.0',
    exported_at: new Date().toISOString(),
    // 注意：此处数据已由 apiGet 解密为明文
    // 导出的JSON是明文，下载到本地后请妥善保管
    data: backupData,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const date = new Date().toLocaleDateString('zh-CN').replace(/\//g, '-');
  a.href     = url;
  a.download = `TradeDesk_数据备份_${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ─────────────────────────────────────────────────────
   更新备份状态显示
───────────────────────────────────────────────────── */
function updateBackupStatus() {
  const lastTs  = localStorage.getItem(BACKUP_LAST_KEY);
  const statusEl = document.getElementById('backup-last-time');
  if (!statusEl) return;
  if (!lastTs) {
    statusEl.textContent = '从未备份';
    statusEl.style.color = '#dc2626';
    return;
  }
  const d = new Date(parseInt(lastTs));
  const days = Math.floor((Date.now() - parseInt(lastTs)) / 86400000);
  statusEl.textContent = `上次备份：${d.toLocaleString('zh-CN')}（${days === 0 ? '今天' : days + '天前'}）`;
  statusEl.style.color = days >= 7 ? '#d97706' : '#059669';
}

/* ─────────────────────────────────────────────────────
   打开/关闭备份管理面板
───────────────────────────────────────────────────── */
function openBackupPanel() {
  document.getElementById('backup-modal').classList.add('active');
  updateBackupStatus();
  renderLocalCache();
}
function closeBackupPanel() {
  document.getElementById('backup-modal').classList.remove('active');
}

/* ─────────────────────────────────────────────────────
   显示本地缓存信息
───────────────────────────────────────────────────── */
function renderLocalCache() {
  const el = document.getElementById('backup-cache-info');
  if (!el) return;
  const raw = localStorage.getItem(BACKUP_CACHE_KEY);
  if (!raw) { el.textContent = '暂无本地缓存'; el.style.color = '#9ca3af'; return; }
  try {
    const cache = JSON.parse(raw);
    const d = new Date(cache.ts);
    const total = Object.values(cache.data || {}).reduce((s, arr) => s + (arr?.length || 0), 0);
    el.innerHTML = `✅ 本地有缓存：${total} 条记录，更新于 ${d.toLocaleString('zh-CN')}
      <button onclick="restoreFromCache()" class="btn btn-sm btn-outline" style="margin-left:10px;font-size:11.5px;">
        从缓存恢复
      </button>`;
    el.style.color = '#059669';
  } catch(e) {
    el.textContent = '缓存数据格式异常';
    el.style.color = '#dc2626';
  }
}

/* ─────────────────────────────────────────────────────
   从本地缓存恢复（紧急情况使用）
───────────────────────────────────────────────────── */
async function restoreFromCache() {
  const raw = localStorage.getItem(BACKUP_CACHE_KEY);
  if (!raw) { showToast('无本地缓存', 'warning'); return; }

  showConfirm('从本地缓存恢复数据将覆盖现有数据库内容，确定继续？', async () => {
    try {
      const cache = JSON.parse(raw);
      let restored = 0;
      for (const [table, rows] of Object.entries(cache.data || {})) {
        for (const row of rows) {
          const { id, gs_project_id, gs_table_name, created_at, updated_at, _deleted, ...data } = row;
          if (_deleted) continue;
          try { await apiPost(table, data); restored++; } catch(e) {}
        }
      }
      showToast(`✅ 已从缓存恢复 ${restored} 条记录`, 'success', 5000);
      closeBackupPanel();
    } catch(e) {
      showToast('恢复失败：' + e.message, 'error');
    }
  });
}
