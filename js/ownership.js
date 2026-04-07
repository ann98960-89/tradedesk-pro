/* =====================================================
   ownership.js — 所有权保障：代码导出 & 迁移指南
   ===================================================== */

/* ─────────────────────────────────────────────────────
   生成项目文件清单 HTML（供用户了解迁移路径）
───────────────────────────────────────────────────── */
function openOwnershipPanel() {
  document.getElementById('ownership-modal').classList.add('active');
  renderOwnershipInfo();
}
function closeOwnershipPanel() {
  document.getElementById('ownership-modal').classList.remove('active');
}

function renderOwnershipInfo() {
  const container = document.getElementById('ownership-content');
  if (!container) return;

  container.innerHTML = `
    <!-- 所有权状态 -->
    <div style="background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:1px solid #86efac;border-radius:10px;padding:18px 20px;margin-bottom:20px;">
      <div style="font-size:13px;font-weight:700;color:#166534;margin-bottom:10px;">✅ 您的资产清单</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:12.5px;">
        <div style="background:#fff;border-radius:8px;padding:12px;">
          <div style="font-weight:700;color:#374151;margin-bottom:6px;">📄 代码文件（11个）</div>
          <div style="color:#6b7280;line-height:1.8;">
            index.html · login.html<br>
            css/style.css<br>
            js/app.js · auth.js · backup.js<br>
            js/customers.js · todos.js<br>
            js/followup.js · investigation.js<br>
            js/products.js · dashboard.js<br>
            js/export.js · selector.js<br>
            js/selector-data.js · feedback.js<br>
            js/recycle.js · ownership.js
          </div>
        </div>
        <div style="background:#fff;border-radius:8px;padding:12px;">
          <div style="font-weight:700;color:#374151;margin-bottom:6px;">🗄️ 数据（6张表）</div>
          <div style="color:#6b7280;line-height:1.8;">
            customers（客户）<br>
            todos（待办）<br>
            followups（跟进记录）<br>
            customer_investigation（背调）<br>
            product_docs（产品文档）<br>
            trial_feedback（试样反馈）
          </div>
        </div>
      </div>
    </div>

    <!-- 立即行动 -->
    <div style="font-size:13px;font-weight:700;color:#374151;margin-bottom:12px;">🚀 立即保存到本地</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">
      <div style="border:1.5px solid #e5e7eb;border-radius:10px;padding:16px;">
        <div style="font-size:14px;font-weight:700;margin-bottom:6px;">📦 下载数据备份</div>
        <div style="font-size:12px;color:#6b7280;margin-bottom:12px;line-height:1.6;">将所有数据导出为 Excel + JSON 文件到您的电脑</div>
        <button class="btn btn-primary btn-sm" style="width:100%;" onclick="closeOwnershipPanel();openBackupPanel();">
          💾 前往备份数据
        </button>
      </div>
      <div style="border:1.5px solid #e5e7eb;border-radius:10px;padding:16px;">
        <div style="font-size:14px;font-weight:700;margin-bottom:6px;">📋 复制代码到本地</div>
        <div style="font-size:12px;color:#6b7280;margin-bottom:12px;line-height:1.6;">在 Genspark 编辑器中可查看并复制全部源代码</div>
        <button class="btn btn-secondary btn-sm" style="width:100%;" onclick="showCopyGuide()">
          📖 查看操作指南
        </button>
      </div>
    </div>

    <!-- 迁移路线图 -->
    <div id="migration-guide" style="display:none;">
      <div style="font-size:13px;font-weight:700;color:#374151;margin-bottom:12px;">🗺️ 完全迁移路线图（获取100%所有权）</div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        ${[
          { step:'1', title:'注册 GitHub 账号', desc:'创建私有仓库（Private Repository），将代码上传，只有您能访问', icon:'🐙', color:'#6366f1' },
          { step:'2', title:'注册 Supabase 账号', desc:'免费云数据库，替换当前 Genspark tables/ API，数据完全属于您', icon:'🗄️', color:'#059669' },
          { step:'3', title:'修改 API 地址', desc:'将 app.js 中的 tables/ 替换为 Supabase 的 REST API，约修改 5 行代码', icon:'🔧', color:'#d97706' },
          { step:'4', title:'部署到 Vercel / Cloudflare Pages', desc:'免费静态托管，绑定您自己的域名，一键从 GitHub 自动部署', icon:'🚀', color:'#0891b2' },
          { step:'5', title:'绑定您的域名', desc:'在域名注册商（阿里云/腾讯云/Namecheap）购买域名，5分钟配置完成', icon:'🌐', color:'#7c3aed' },
        ].map(s => `
          <div style="display:flex;gap:14px;align-items:flex-start;background:#f9fafb;border-radius:8px;padding:12px 14px;">
            <div style="width:32px;height:32px;border-radius:50%;background:${s.color};color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;flex-shrink:0;">${s.step}</div>
            <div style="flex:1;">
              <div style="font-weight:700;font-size:13px;color:#111827;">${s.icon} ${s.title}</div>
              <div style="font-size:12px;color:#6b7280;margin-top:3px;line-height:1.6;">${s.desc}</div>
            </div>
          </div>`).join('')}
      </div>
      <div style="margin-top:16px;background:#e8f0fe;border:1px solid #bfdbfe;border-radius:8px;padding:12px 14px;font-size:12.5px;color:#1e40af;line-height:1.7;">
        💡 <strong>预计费用：</strong>GitHub 私仓免费 · Supabase 免费额度充足 · Vercel 免费 · 域名约 ¥50-100/年<br>
        💡 <strong>预计时间：</strong>技术能力一般的用户约需 2-3 小时完成全部迁移
      </div>
    </div>

    <button id="show-guide-btn" class="btn btn-outline btn-sm" style="width:100%;margin-top:4px;" onclick="showMigrationGuide()">
      🗺️ 查看完全迁移路线图（获取100%所有权）
    </button>`;
}

function showMigrationGuide() {
  document.getElementById('migration-guide').style.display = '';
  document.getElementById('show-guide-btn').style.display = 'none';
}

function showCopyGuide() {
  showToast('请在页面上方点击「编辑」进入 Genspark 编辑器，即可查看和下载所有源代码文件', 'info', 8000);
}
