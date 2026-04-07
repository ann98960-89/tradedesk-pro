/* ===================================================
   feedback.js - 试样反馈收集 & 智能重新选型模块
   =================================================== */

let allFeedbacks = [];
let filteredFeedbacks = [];
let currentFeedbackProductId = null;   // 正在填写反馈的产品
let currentFeedbackProductName = '';
let currentFeedbackCriteria = {};      // 原始选型条件（用于重选时继承）

/* ================================================================
   问题分类知识库  →  每种问题自动触发对应调整策略
   ================================================================ */
const PROBLEM_CATEGORIES = [
  {
    id: 'wire_break',
    label: '断丝',
    icon: '💥',
    color: '#dc2626',
    desc: '拉拔过程中出现断丝现象',
    adjust_hints: [
      '建议切换含更高极压添加剂（EP）配方产品',
      '考虑降低拉拔速度 10-20%',
      '检查减面率是否过大，建议增加道次',
      '若高速断丝，优先推荐超高速稳定型乳化液',
    ],
    penalize: ['speed_too_high', 'ep_insufficient'],
    prefer: ['high_ep', 'anti_breakage', 'fine_drawing'],
  },
  {
    id: 'surface_scratch',
    label: '表面划痕/麻坑',
    icon: '🔴',
    color: '#dc2626',
    desc: '线材表面出现纵向划痕或点状麻坑',
    adjust_hints: [
      '建议切换粒径更细、成膜更均匀的产品',
      'PCD或天然金刚石模具可降低摩擦划伤',
      '提高乳化液浓度至上限以增强润滑膜厚度',
      '检查拉丝粉供给装置是否均匀',
    ],
    penalize: ['coarse_powder', 'low_film'],
    prefer: ['fine_particle', 'uniform_film', 'mirror_surface'],
  },
  {
    id: 'surface_blackening',
    label: '表面发黑/烧焦',
    icon: '⬛',
    color: '#374151',
    desc: '线材表面出现黑色氧化或烧焦痕迹',
    adjust_hints: [
      '温升过高，建议提升产品耐温等级',
      '考虑湿拉工艺替代干拉以强化冷却',
      '提高乳化液循环流量改善冷却效果',
      '降低拉拔速度或减少单道次减面率',
    ],
    penalize: ['low_temp_resistance', 'dry_only'],
    prefer: ['high_temp', 'wet_cooling', 'SCE'],
  },
  {
    id: 'die_wear',
    label: '模具磨损过快',
    icon: '⚙️',
    color: '#d97706',
    desc: '模具使用寿命明显低于预期',
    adjust_hints: [
      '建议换用摩擦系数更低的产品（含MoS₂或PTFE组分）',
      '升级模具材质：TC → PCD → 天然金刚石',
      '提高润滑剂供给量或浓度',
      '不锈钢丝需使用专用防冷焊配方',
    ],
    penalize: ['high_friction', 'no_ep'],
    prefer: ['low_friction', 'die_protection', 'MoS2'],
  },
  {
    id: 'lubricant_residue',
    label: '润滑剂残留过多',
    icon: '🟡',
    color: '#d97706',
    desc: '产品表面残留白色皂粉或油膜，影响后工序',
    adjust_hints: [
      '选用低皂含量或快速挥发型产品',
      '焊丝残留影响焊接质量，需换用焊接友好配方',
      '镀锌/镀铜前需确认残留物与镀液兼容性',
      '调低拉丝粉供给量或提高皂化温度',
    ],
    penalize: ['high_residue', 'non_welding_friendly'],
    prefer: ['low_residue', 'weld_compatible', 'plating_compatible'],
  },
  {
    id: 'emulsion_unstable',
    label: '乳化液不稳定/分层',
    icon: '🧪',
    color: '#7c3aed',
    desc: '乳化液出现分层、发臭、浓度波动等问题',
    adjust_hints: [
      '建议选用含抗菌剂（生物稳定型）配方',
      '检查水质硬度，建议使用软化水配制',
      '调整维护周期，定期补充杀菌剂',
      '换用 pH 自稳定型乳化液',
    ],
    penalize: ['low_stability', 'no_biocide'],
    prefer: ['bio_stable', 'ph_stable', 'long_life'],
  },
  {
    id: 'coating_issue',
    label: '镀层附着力差',
    icon: '⚡',
    color: '#0891b2',
    desc: '后续镀铜/镀锌/镀镍层附着力不足或起皮',
    adjust_hints: [
      '更换镀前兼容型拉丝粉（无蜡或低蜡配方）',
      '不锈钢镀镍需无氯无硫配方防止腐蚀',
      '考虑增加磷化预处理工序提升表面活性',
    ],
    penalize: ['wax_residue', 'chlorine_sulfur'],
    prefer: ['plating_compatible', 'phosphate_friendly', 'no_wax'],
  },
  {
    id: 'rust',
    label: '线材生锈/腐蚀',
    icon: '🟤',
    color: '#92400e',
    desc: '拉拔后或储存时线材出现锈斑',
    adjust_hints: [
      '建议选用含气相防锈组分的产品',
      '提高乳化液 pH 至 8.5-9.5 区间',
      '湿拉后需增加防锈油涂覆工序',
      '仓储环境控制湿度 < 60%',
    ],
    penalize: ['no_rust_inhibitor'],
    prefer: ['rust_inhibitor', 'vci', 'high_ph'],
  },
  {
    id: 'welding_defect',
    label: '焊接缺陷（气孔/飞溅）',
    icon: '🔧',
    color: '#1e40af',
    desc: '焊丝拉拔后焊接出现气孔或飞溅过多',
    adjust_hints: [
      '立即更换焊接专用低残留配方',
      '确认产品卤素含量（Cl+F）< 10 ppm',
      '药芯焊丝需选用与粉芯相容的润滑剂',
      '检查线材清洁度，必要时增加超声波清洗',
    ],
    penalize: ['high_halogen', 'non_welding_friendly'],
    prefer: ['welding_compatible', 'low_halogen', 'low_residue'],
  },
  {
    id: 'scc',
    label: '应力腐蚀裂纹 SCC',
    icon: '⚠️',
    color: '#dc2626',
    desc: '不锈钢丝在含氯环境下出现应力腐蚀裂纹',
    adjust_hints: [
      '立即更换氯离子 < 5 ppm 的专用不锈钢乳化液',
      '严格控制水质中 Cl⁻ 含量',
      '定期检测使用中乳化液的 Cl⁻ 浓度',
      '选用无氯无硫双重保护配方',
    ],
    penalize: ['high_chlorine'],
    prefer: ['ultra_low_chlorine', 'ss_compatible'],
  },
];

/* ================================================================
   页面初始化入口
   ================================================================ */
function loadFeedbackPage() {
  loadFeedbacks();
  initProblemGrid();
  renderFeedbackStats();
  updateFeedbackBadge();
}

/** 渲染问题分类多选网格 */
function initProblemGrid() {
  const grid = document.getElementById('fb-problem-grid');
  if (!grid || grid.dataset.initialized) return;
  grid.dataset.initialized = 'true';

  grid.innerHTML = PROBLEM_CATEGORIES.map(cat => `
    <label style="cursor:pointer;border:1.5px solid #e5e7eb;border-radius:8px;padding:10px 12px;display:flex;gap:8px;align-items:flex-start;transition:all 0.15s;" 
           id="fb-cat-${cat.id}"
           onmouseover="this.style.borderColor='${cat.color}'" 
           onmouseout="if(!document.getElementById('fb-chk-${cat.id}').checked)this.style.borderColor='#e5e7eb'">
      <input type="checkbox" class="fb-problem-check" value="${cat.id}" id="fb-chk-${cat.id}"
             style="margin-top:2px;width:15px;height:15px;accent-color:${cat.color};"
             onchange="onProblemCheckChange('${cat.id}', '${cat.color}')">
      <div style="flex:1;min-width:0;">
        <div style="font-weight:700;font-size:13px;color:#111827;">${cat.icon} ${cat.label}</div>
        <div style="font-size:11.5px;color:#6b7280;margin-top:2px;">${cat.desc}</div>
        <div class="fb-sub-input-${cat.id}" style="display:none;margin-top:8px;">
          <input type="text" class="form-control fb-sub-detail" data-key="${cat.id}" 
                 style="font-size:12px;padding:6px 10px;" 
                 placeholder="请描述具体现象（断丝频率/划痕程度等）...">
        </div>
      </div>
    </label>`).join('');
}

function onProblemCheckChange(catId, color) {
  const chk = document.getElementById(`fb-chk-${catId}`);
  const card = document.getElementById(`fb-cat-${catId}`);
  const subInput = document.querySelector(`.fb-sub-input-${catId}`);
  if (chk.checked) {
    card.style.borderColor = color;
    card.style.background = color + '0d';
    if (subInput) subInput.style.display = '';
  } else {
    card.style.borderColor = '#e5e7eb';
    card.style.background = '';
    if (subInput) subInput.style.display = 'none';
  }
}

/** 反馈统计卡片 */
async function renderFeedbackStats() {
  const container = document.getElementById('feedback-stats');
  if (!container || !allFeedbacks.length) {
    if (container) container.innerHTML = '';
    return;
  }
  const total = allFeedbacks.length;
  const failed = allFeedbacks.filter(f => f.trial_result === '失败').length;
  const partial = allFeedbacks.filter(f => f.trial_result === '部分通过').length;
  const passed = allFeedbacks.filter(f => f.trial_result === '通过').length;
  const pending = allFeedbacks.filter(f => f.status === '待分析').length;

  container.innerHTML = [
    { icon: '📊', label: '总反馈数', value: total, color: '#1a56db', bg: '#e8f0fe' },
    { icon: '❌', label: '试样失败', value: failed, color: '#dc2626', bg: '#fee2e2' },
    { icon: '⚠️', label: '部分通过', value: partial, color: '#d97706', bg: '#fef3c7' },
    { icon: '✅', label: '试样通过', value: passed, color: '#059669', bg: '#d1fae5' },
    { icon: '⏳', label: '待分析', value: pending, color: '#7c3aed', bg: '#ede9fe' },
  ].map(item => `
    <div class="card" style="padding:14px 18px;display:flex;align-items:center;gap:12px;min-width:130px;">
      <div style="width:40px;height:40px;border-radius:10px;background:${item.bg};display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">${item.icon}</div>
      <div>
        <div style="font-size:22px;font-weight:800;color:${item.color};">${item.value}</div>
        <div style="font-size:12px;color:#6b7280;">${item.label}</div>
      </div>
    </div>`).join('');
}

/** 更新侧边栏徽章 */
async function updateFeedbackBadge() {
  try {
    const data = await apiGet('trial_feedback', { limit: 500 });
    const pending = (data.data || []).filter(f => f.status === '待分析').length;
    const badge = document.getElementById('feedback-badge');
    if (badge) {
      badge.textContent = pending;
      badge.style.display = pending > 0 ? '' : 'none';
    }
  } catch(e) {}
}

/** 保存反馈并立即触发重选 */
async function saveFeedbackAndReselect() {
  const company = document.getElementById('fb-company').value.trim();
  if (!company) { showToast('请填写客户公司名称', 'warning'); return; }

  const checkedProblems = [...document.querySelectorAll('.fb-problem-check:checked')].map(el => el.value);
  if (!checkedProblems.length) {
    showToast('请至少选择一个问题分类', 'warning'); return;
  }

  // 先保存
  await saveFeedback();

  // 稍等后触发重选（等待 loadFeedbacks 完成）
  setTimeout(async () => {
    const data = await apiGet('trial_feedback', { limit: 500 });
    const latest = (data.data || []).sort((a,b) => (b.created_at||0)-(a.created_at||0))[0];
    if (latest) reSelectFromFeedback(latest.id);
  }, 600);
}

/** 导出反馈记录 */
async function exportFeedbacks() {
  const data = await apiGet('trial_feedback', { limit: 1000 });
  const rows = data.data || [];
  if (!rows.length) { showToast('暂无反馈数据', 'warning'); return; }

  const headers = ['客户公司','产品名称','产品编号','线材材质','产品类型','机型','速度(m/s)',
    '道次','线径(mm)','试样日期','试样结果','严重程度','问题分类','断丝情况','表面质量',
    '润滑效果','温升情况','残留物','客户详细反馈','客户建议','跟进计划','处理状态'];

  const sheetData = [headers, ...rows.map(r => [
    r.company_name, r.product_name, r.product_id,
    r.wire_material, r.wire_subtype, r.machine_type, r.speed, r.passes, r.wire_diameter,
    r.trial_date ? new Date(r.trial_date).toLocaleDateString('zh-CN') : '',
    r.trial_result, r.severity, r.problem_categories,
    r['断丝率']||'', r['表面质量']||'', r['润滑效果']||'', r['温升异常']||'', r['残留物']||'',
    r.detailed_feedback, r.improvement_suggestions, r.followup_action, r.status,
  ])];

  downloadExcel([{ name: '试样反馈记录', data: sheetData }], `试样反馈_${todayStr()}.xlsx`);
  showToast(`✅ 成功导出 ${rows.length} 条反馈记录`, 'success');
}

const FEEDBACK_ADJUSTMENT_RULES = {
  wire_break: {
    boost_ids: ['P001', 'P010', 'P003'],         // 高速稳定/钢帘线/不锈钢专用
    penalize_ids: ['P002', 'P011'],
    filter_out_types: [],
    add_constraint: 'higher_ep',
    speed_hint: '建议降速 15-25%',
  },
  surface_scratch: {
    boost_ids: ['P004', 'P010', 'P005'],
    penalize_ids: ['P002'],
    add_constraint: 'fine_particle',
    surface_hint: '建议提升乳化液浓度上限',
  },
  surface_blackening: {
    boost_ids: ['P010', 'P005', 'P006'],
    penalize_ids: ['P001', 'P002', 'P003'],
    add_constraint: 'high_temp_wet',
    process_hint: '优先切换湿拉工艺',
  },
  die_wear: {
    boost_ids: ['P004', 'P006', 'P003'],
    penalize_ids: ['P002', 'P011'],
    add_constraint: 'low_friction',
    die_hint: '建议升级模具至 PCD 或天然金刚石',
  },
  lubricant_residue: {
    boost_ids: ['P008', 'P009'],
    penalize_ids: ['P001', 'P002'],
    add_constraint: 'low_residue',
  },
  emulsion_unstable: {
    boost_ids: ['P005', 'P006', 'P007', 'P012'],
    penalize_ids: [],
    add_constraint: 'bio_stable',
  },
  coating_issue: {
    boost_ids: ['P011', 'P008', 'P009'],
    penalize_ids: ['P001'],
    add_constraint: 'plating_friendly',
  },
  rust: {
    boost_ids: ['P005', 'P006', 'P007'],
    penalize_ids: [],
    add_constraint: 'rust_inhibitor',
  },
  welding_defect: {
    boost_ids: ['P008', 'P009'],
    penalize_ids: ['P001', 'P002', 'P003'],
    add_constraint: 'welding_only',
    filter_out_types: ['dry_non_weld'],
  },
  scc: {
    boost_ids: ['P006', 'P009'],
    penalize_ids: ['P005'],
    filter_out_ids: ['P001', 'P002', 'P007', 'P008', 'P010', 'P011', 'P012'],
    add_constraint: 'ultra_low_chlorine',
  },
};

/* ================================================================
   加载反馈列表页
   ================================================================ */
async function loadFeedbacks() {
  try {
    const data = await apiGet('trial_feedback', { limit: 500 });
    allFeedbacks = (data.data || []).sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
    filteredFeedbacks = [...allFeedbacks];
    renderFeedbackList(filteredFeedbacks);
  } catch (e) {
    showToast('加载反馈记录失败', 'error');
  }
}

function renderFeedbackList(list) {
  const container = document.getElementById('feedback-list-container');
  if (!container) return;

  if (!list.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🧪</div>
        <h3>暂无试样反馈记录</h3>
        <p>在选型结果页点击「📝 提交试样反馈」填写客户试用情况</p>
      </div>`;
    return;
  }

  const RESULT_CFG = {
    '失败':     { cls: 'badge-danger',  icon: '❌' },
    '通过':     { cls: 'badge-success', icon: '✅' },
    '部分通过': { cls: 'badge-warning', icon: '⚠️' },
  };
  const SEV_CFG = {
    '致命': { cls: 'badge-danger',  icon: '🚨' },
    '严重': { cls: 'badge-danger',  icon: '🔴' },
    '中等': { cls: 'badge-warning', icon: '🟡' },
    '轻微': { cls: 'badge-gray',    icon: '🟢' },
  };
  const STATUS_CFG = {
    '待分析':   { cls: 'badge-warning', icon: '⏳' },
    '已推荐':   { cls: 'badge-primary', icon: '💡' },
    '已解决':   { cls: 'badge-success', icon: '✅' },
    '持续跟进': { cls: 'badge-purple',  icon: '🔄' },
  };

  container.innerHTML = `
    <div class="table-wrapper">
      <table>
        <thead><tr>
          <th>客户公司</th><th>试样产品</th><th>线材类型</th><th>试样日期</th>
          <th>试样结果</th><th>严重程度</th><th>问题分类</th><th>处理状态</th><th>操作</th>
        </tr></thead>
        <tbody>
          ${list.map(f => {
            const res = RESULT_CFG[f.trial_result] || { cls: 'badge-gray', icon: '?' };
            const sev = SEV_CFG[f.severity] || { cls: 'badge-gray', icon: '' };
            const sta = STATUS_CFG[f.status] || { cls: 'badge-gray', icon: '' };
            const cats = (f.problem_categories || '').split(',').filter(Boolean);
            return `
              <tr>
                <td><div style="font-weight:700;color:#111827;">${escHtml(f.company_name)}</div>
                    <div style="font-size:11px;color:#9ca3af;">${escHtml(f.wire_material || '')} ${f.wire_subtype ? '· '+escHtml(f.wire_subtype) : ''}</div></td>
                <td><div style="font-weight:600;">${escHtml(f.product_name)}</div>
                    <div style="font-size:11px;color:#6b7280;">${escHtml(f.product_id || '')}</div></td>
                <td style="font-size:12.5px;">${escHtml(f.wire_material||'')} ${escHtml(f.wire_subtype||'')}</td>
                <td style="font-size:12.5px;">${formatDate(f.trial_date)}</td>
                <td><span class="badge ${res.cls}">${res.icon} ${f.trial_result||'-'}</span></td>
                <td>${f.severity ? `<span class="badge ${sev.cls}">${sev.icon} ${f.severity}</span>` : '-'}</td>
                <td style="max-width:160px;">
                  ${cats.slice(0,3).map(c => {
                    const cat = PROBLEM_CATEGORIES.find(p => p.id === c.trim());
                    return cat ? `<span style="background:${cat.color}18;color:${cat.color};font-size:10.5px;font-weight:600;padding:2px 7px;border-radius:4px;margin:1px;display:inline-block;">${cat.icon} ${cat.label}</span>` : '';
                  }).join('')}
                  ${cats.length > 3 ? `<span style="font-size:11px;color:#9ca3af;">+${cats.length-3}</span>` : ''}
                </td>
                <td><span class="badge ${sta.cls}">${sta.icon} ${f.status||'待分析'}</span></td>
                <td>
                  <div class="td-actions">
                    <button class="btn btn-sm btn-primary" style="font-size:11px;" onclick="reSelectFromFeedback('${f.id}')" title="基于反馈重新选型">
                      🔄 重选
                    </button>
                    <button class="btn btn-ghost btn-sm" onclick="viewFeedbackDetail('${f.id}')" title="查看详情"><i class="fas fa-eye" style="font-size:11px;color:#1a56db;"></i></button>
                    <button class="btn btn-ghost btn-sm" onclick="deleteFeedback('${f.id}')" style="color:#dc2626;"><i class="fas fa-trash" style="font-size:11px;"></i></button>
                  </div>
                </td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

function filterFeedbacks() {
  const search = (document.getElementById('feedback-search')?.value || '').toLowerCase();
  const result = document.getElementById('feedback-filter-result')?.value || '';
  const severity = document.getElementById('feedback-filter-severity')?.value || '';

  filteredFeedbacks = allFeedbacks.filter(f => {
    if (search && !f.company_name?.toLowerCase().includes(search) &&
        !f.product_name?.toLowerCase().includes(search)) return false;
    if (result && f.trial_result !== result) return false;
    if (severity && f.severity !== severity) return false;
    return true;
  });
  renderFeedbackList(filteredFeedbacks);
}

/* ================================================================
   打开反馈填写模态框
   ================================================================ */
function openFeedbackModal(productId, productName, criteria = {}) {
  currentFeedbackProductId = productId;
  currentFeedbackProductName = productName;
  currentFeedbackCriteria = criteria;

  // 回填产品信息
  document.getElementById('fb-product-id').value = productId || '';
  document.getElementById('fb-product-name').value = productName || '';
  document.getElementById('fb-wire-material').value = criteria.wire_material || '';
  document.getElementById('fb-wire-subtype').value  = criteria.wire_subtype  || '';
  document.getElementById('fb-machine-type').value  = criteria.machine_type  || '';
  document.getElementById('fb-die-material').value  = criteria.die_material  || '';
  document.getElementById('fb-speed').value         = criteria.speed         || '';
  document.getElementById('fb-passes').value        = criteria.passes        || '';
  document.getElementById('fb-diameter').value      = criteria.wire_diameter || '';
  document.getElementById('fb-company').value       = '';
  document.getElementById('fb-trial-date').value    = new Date().toISOString().slice(0,10);
  document.getElementById('fb-trial-result').value  = '失败';
  document.getElementById('fb-severity').value      = '严重';
  document.getElementById('fb-detail').value        = '';
  document.getElementById('fb-suggestion').value    = '';
  document.getElementById('fb-action').value        = '';
  document.getElementById('fb-status').value        = '待分析';

  // 重置问题勾选
  document.querySelectorAll('.fb-problem-check').forEach(el => el.checked = false);
  // 重置子问题详情
  document.querySelectorAll('.fb-sub-detail').forEach(el => { el.value = ''; });

  onTrialResultChange();
  initProblemGrid();  // 确保多选格已渲染

  document.getElementById('feedback-modal').classList.add('active');
  setTimeout(() => document.getElementById('fb-company').focus(), 100);
}

function closeFeedbackModal() {
  document.getElementById('feedback-modal').classList.remove('active');
}

function onTrialResultChange() {
  const result = document.getElementById('fb-trial-result').value;
  const problemSection = document.getElementById('fb-problem-section');
  if (result === '通过') {
    problemSection.style.opacity = '0.4';
    problemSection.style.pointerEvents = 'none';
  } else {
    problemSection.style.opacity = '1';
    problemSection.style.pointerEvents = '';
  }
}

/* ================================================================
   保存反馈
   ================================================================ */
async function saveFeedback() {
  const company = document.getElementById('fb-company').value.trim();
  const productName = document.getElementById('fb-product-name').value.trim();
  if (!company) { showToast('请填写客户公司名称', 'warning'); return; }

  const checkedProblems = [...document.querySelectorAll('.fb-problem-check:checked')].map(el => el.value);
  const subDetails = {};
  document.querySelectorAll('.fb-sub-detail').forEach(el => {
    if (el.value.trim()) subDetails[el.dataset.key] = el.value.trim();
  });

  const payload = {
    company_name:          company,
    product_id:            document.getElementById('fb-product-id').value,
    product_name:          productName,
    trial_date:            document.getElementById('fb-trial-date').value ?
                             new Date(document.getElementById('fb-trial-date').value).getTime() : Date.now(),
    wire_material:         document.getElementById('fb-wire-material').value,
    wire_subtype:          document.getElementById('fb-wire-subtype').value,
    machine_type:          document.getElementById('fb-machine-type').value,
    die_material:          document.getElementById('fb-die-material').value,
    speed:                 document.getElementById('fb-speed').value,
    passes:                document.getElementById('fb-passes').value,
    wire_diameter:         document.getElementById('fb-diameter').value,
    trial_result:          document.getElementById('fb-trial-result').value,
    severity:              document.getElementById('fb-severity').value,
    problem_categories:    checkedProblems.join(','),
    '断丝率':              subDetails['wire_break']        || '',
    '表面质量':            subDetails['surface_scratch']   || subDetails['surface_blackening'] || '',
    '润滑效果':            subDetails['die_wear']          || '',
    '模具磨损':            subDetails['die_wear_detail']   || '',
    '温升异常':            subDetails['surface_blackening'] || '',
    '残留物':              subDetails['lubricant_residue'] || '',
    detailed_feedback:     document.getElementById('fb-detail').value.trim(),
    improvement_suggestions: document.getElementById('fb-suggestion').value.trim(),
    followup_action:       document.getElementById('fb-action').value.trim(),
    status:                document.getElementById('fb-status').value,
  };

  // 如果公司存在，关联客户 ID
  if (allCustomers?.length) {
    const cust = allCustomers.find(c => c.company_name === company);
    if (cust) payload.customer_id = cust.id;
  }

  try {
    await apiPost('trial_feedback', payload);
    showToast('✅ 反馈已保存！点击「🔄 重选」生成改进方案', 'success', 4000);
    closeFeedbackModal();
    await loadFeedbacks();

    // 若当前在反馈页，刷新
    if (currentPage === 'feedback') loadFeedbacks();
  } catch (e) {
    showToast('保存失败，请重试', 'error');
  }
}

/* ================================================================
   删除
   ================================================================ */
function deleteFeedback(id) {
  const f = allFeedbacks.find(f => f.id === id);
  showConfirm(`确定删除「${f?.company_name || ''}」的试样反馈记录？`, async () => {
    try {
      await apiDelete('trial_feedback', id);
      showToast('已删除', 'success');
      await loadFeedbacks();
    } catch (e) { showToast('删除失败', 'error'); }
  });
}

/* ================================================================
   查看反馈详情
   ================================================================ */
function viewFeedbackDetail(id) {
  const f = allFeedbacks.find(fb => fb.id === id);
  if (!f) return;

  const cats = (f.problem_categories || '').split(',').filter(Boolean);
  const catHtml = cats.map(c => {
    const cat = PROBLEM_CATEGORIES.find(p => p.id === c.trim());
    if (!cat) return '';
    return `
      <div style="background:${cat.color}10;border:1px solid ${cat.color}30;border-radius:8px;padding:10px 14px;margin-bottom:8px;">
        <div style="font-weight:700;font-size:13px;color:${cat.color};">${cat.icon} ${cat.label}</div>
        <div style="font-size:12px;color:#6b7280;margin-top:3px;">${cat.desc}</div>
        <div style="margin-top:8px;">
          ${cat.adjust_hints.map(h => `<div style="font-size:12px;color:#374151;margin-bottom:3px;">• ${h}</div>`).join('')}
        </div>
      </div>`;
  }).join('');

  const modal = document.getElementById('feedback-detail-modal');
  document.getElementById('fbd-title').textContent = `${f.company_name} · ${f.product_name}`;
  document.getElementById('fbd-body').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px;">
      <div class="card" style="padding:14px;">
        <div style="font-size:11px;color:#6b7280;font-weight:700;text-transform:uppercase;margin-bottom:10px;">试样信息</div>
        <div class="info-list">
          <div class="info-item"><div class="info-label">客户</div><div class="info-value">${escHtml(f.company_name)}</div></div>
          <div class="info-item"><div class="info-label">产品</div><div class="info-value">${escHtml(f.product_name)}</div></div>
          <div class="info-item"><div class="info-label">线材</div><div class="info-value">${escHtml(f.wire_material||'')} ${escHtml(f.wire_subtype||'')}</div></div>
          <div class="info-item"><div class="info-label">速度</div><div class="info-value">${f.speed ? f.speed+' m/s' : '-'}</div></div>
          <div class="info-item"><div class="info-label">道次</div><div class="info-value">${f.passes || '-'}</div></div>
          <div class="info-item"><div class="info-label">线径</div><div class="info-value">${f.wire_diameter ? f.wire_diameter+' mm' : '-'}</div></div>
          <div class="info-item"><div class="info-label">试样日期</div><div class="info-value">${formatDate(f.trial_date)}</div></div>
        </div>
      </div>
      <div class="card" style="padding:14px;">
        <div style="font-size:11px;color:#6b7280;font-weight:700;text-transform:uppercase;margin-bottom:10px;">结果评估</div>
        <div class="info-list">
          <div class="info-item"><div class="info-label">试样结果</div><div class="info-value">
            ${f.trial_result === '通过' ? '<span class="badge badge-success">✅ 通过</span>' :
              f.trial_result === '失败' ? '<span class="badge badge-danger">❌ 失败</span>' :
              '<span class="badge badge-warning">⚠️ 部分通过</span>'}
          </div></div>
          <div class="info-item"><div class="info-label">严重程度</div><div class="info-value">${escHtml(f.severity||'-')}</div></div>
          <div class="info-item"><div class="info-label">处理状态</div><div class="info-value">${escHtml(f.status||'-')}</div></div>
          ${f['断丝率']   ? `<div class="info-item"><div class="info-label">断丝情况</div><div class="info-value">${escHtml(f['断丝率'])}</div></div>` : ''}
          ${f['表面质量'] ? `<div class="info-item"><div class="info-label">表面情况</div><div class="info-value">${escHtml(f['表面质量'])}</div></div>` : ''}
          ${f['残留物']   ? `<div class="info-item"><div class="info-label">残留情况</div><div class="info-value">${escHtml(f['残留物'])}</div></div>` : ''}
        </div>
      </div>
    </div>
    ${cats.length ? `<div style="font-size:12px;font-weight:700;color:#374151;margin-bottom:10px;text-transform:uppercase;">📋 问题详情与调整建议</div>${catHtml}` : ''}
    ${f.detailed_feedback ? `<div class="card" style="padding:14px;margin-top:12px;background:#fff8f0;border:1px solid #fed7aa;">
      <div style="font-size:12px;font-weight:700;color:#92400e;margin-bottom:6px;">💬 客户详细反馈</div>
      <p style="font-size:13px;color:#374151;line-height:1.7;white-space:pre-wrap;">${escHtml(f.detailed_feedback)}</p>
    </div>` : ''}
    ${f.improvement_suggestions ? `<div class="card" style="padding:14px;margin-top:10px;background:#f0fdf4;border:1px solid #bbf7d0;">
      <div style="font-size:12px;font-weight:700;color:#065f46;margin-bottom:6px;">💡 客户改进建议</div>
      <p style="font-size:13px;color:#374151;">${escHtml(f.improvement_suggestions)}</p>
    </div>` : ''}`;

  document.getElementById('fbd-reselect-btn').onclick = () => {
    modal.classList.remove('active');
    reSelectFromFeedback(id);
  };
  modal.classList.add('active');
}

function closeFeedbackDetail() {
  document.getElementById('feedback-detail-modal').classList.remove('active');
}

/* ================================================================
   🔄 基于反馈重新选型 — 核心算法
   ================================================================ */
function reSelectFromFeedback(feedbackId) {
  const f = allFeedbacks.find(fb => fb.id === feedbackId);
  if (!f) return;

  const problems = (f.problem_categories || '').split(',').filter(Boolean);

  // 恢复原始工艺条件
  const criteria = {
    wire_material: f.wire_material || '',
    wire_subtype:  f.wire_subtype  || '',
    machine_type:  f.machine_type  || '',
    die_material:  f.die_material  || '',
    speed:         f.speed         || '',
    passes:        f.passes        || '',
    wire_diameter: f.wire_diameter || '',
  };

  // 运行基础选型
  let results = runProductSelector(criteria);

  // 排除原试样产品（已知失败）
  results = results.filter(p => p.id !== f.product_id);

  // 应用问题驱动的调整策略
  const boostMap = {};
  const penalizeMap = {};
  const filterOutIds = new Set();
  const adjustHints = [];
  const processHints = [];
  const dieHints = [];

  problems.forEach(pid => {
    const rule = FEEDBACK_ADJUSTMENT_RULES[pid.trim()];
    const cat  = PROBLEM_CATEGORIES.find(p => p.id === pid.trim());

    if (rule) {
      (rule.boost_ids || []).forEach(id => { boostMap[id] = (boostMap[id] || 0) + 25; });
      (rule.penalize_ids || []).forEach(id => { penalizeMap[id] = (penalizeMap[id] || 0) + 20; });
      (rule.filter_out_ids || []).forEach(id => filterOutIds.add(id));
      if (rule.speed_hint)   processHints.push(rule.speed_hint);
      if (rule.process_hint) processHints.push(rule.process_hint);
      if (rule.die_hint)     dieHints.push(rule.die_hint);
    }
    if (cat) adjustHints.push(...cat.adjust_hints);
  });

  // 过滤 & 重新评分
  results = results
    .filter(p => !filterOutIds.has(p.id))
    .map(p => {
      let adjusted = p.score + (boostMap[p.id] || 0) - (penalizeMap[p.id] || 0);
      const feedbackReasons = [];
      if (boostMap[p.id])   feedbackReasons.push(`🔧 反馈调优加 +${boostMap[p.id]} 分`);
      if (penalizeMap[p.id]) feedbackReasons.push(`⬇️ 问题规避减 -${penalizeMap[p.id]} 分`);
      return {
        ...p,
        score: Math.max(adjusted, 5),
        is_reselect: true,
        feedback_reasons: feedbackReasons,
        reasons: [...(p.reasons || []), ...feedbackReasons],
      };
    })
    .sort((a, b) => b.score - a.score);

  if (!results.length) {
    showToast('未能找到更优产品，请联系技术支持', 'warning');
    return;
  }

  // 更新反馈记录状态
  apiPut('trial_feedback', feedbackId, { ...f, status: '已推荐' }).catch(() => {});

  // 切换到选型页并展示结果
  switchPage('selector');
  setTimeout(() => {
    selectorResults = results;
    renderReSelectResults(f, results, problems, adjustHints, processHints, dieHints);
  }, 100);
}

function renderReSelectResults(feedback, results, problems, adjustHints, processHints, dieHints) {
  // 跳到第5步
  document.querySelectorAll('.selector-step').forEach((el, i) => {
    el.style.display = i === 4 ? '' : 'none';
  });
  updateStepIndicator(5);

  const problemTags = problems.map(pid => {
    const cat = PROBLEM_CATEGORIES.find(p => p.id === pid.trim());
    return cat ? `<span style="background:${cat.color}18;color:${cat.color};font-size:11.5px;font-weight:700;padding:4px 10px;border-radius:5px;border:1px solid ${cat.color}30;">${cat.icon} ${cat.label}</span>` : '';
  }).join('');

  const allHints = [...new Set([...adjustHints, ...processHints, ...dieHints])];

  const bannerHtml = `
    <div style="background:linear-gradient(135deg,#1e1b4b,#312e81);border-radius:12px;padding:20px 24px;margin-bottom:20px;color:#fff;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
        <div style="width:40px;height:40px;border-radius:10px;background:rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;font-size:20px;">🔄</div>
        <div>
          <div style="font-size:15px;font-weight:800;">基于试样反馈 — 智能改进方案</div>
          <div style="font-size:12px;opacity:0.7;margin-top:2px;">原试样产品：${escHtml(feedback.product_name)} · 客户：${escHtml(feedback.company_name)}</div>
        </div>
        <div style="margin-left:auto;text-align:right;">
          <div style="font-size:11px;opacity:0.6;">找到改进产品</div>
          <div style="font-size:24px;font-weight:800;">${results.length}</div>
        </div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px;">${problemTags}</div>
      <div style="background:rgba(255,255,255,0.1);border-radius:8px;padding:12px 14px;">
        <div style="font-size:11.5px;font-weight:700;opacity:0.8;margin-bottom:8px;text-transform:uppercase;">🛠️ 综合调整建议</div>
        ${allHints.slice(0,6).map(h => `<div style="font-size:12.5px;opacity:0.9;margin-bottom:4px;line-height:1.5;">• ${h}</div>`).join('')}
      </div>
    </div>`;

  // 渲染结果（复用原有渲染，但标注"改进推荐"）
  const criteriaFromFeedback = {
    wire_material: feedback.wire_material, wire_subtype: feedback.wire_subtype,
    machine_type: feedback.machine_type, die_material: feedback.die_material,
    speed: feedback.speed, passes: feedback.passes, wire_diameter: feedback.wire_diameter,
  };

  // 临时保存以供导出
  currentFeedbackCriteria = criteriaFromFeedback;
  currentFeedbackProductId = feedback.product_id;
  currentFeedbackProductName = feedback.product_name;

  const container = document.getElementById('selector-results');
  container.innerHTML = ''; // 先清空

  const fakeContainer = document.createElement('div');
  fakeContainer.id = 'selector-results-inner';

  // 用已有函数渲染
  selectorResults = results;
  renderSelectorResults(criteriaFromFeedback);

  // 在结果前插入 banner
  const existing = document.getElementById('selector-results').innerHTML;
  document.getElementById('selector-results').innerHTML = bannerHtml + existing;
}

/* ================================================================
   获取当前选型条件（供反馈模态框预填）
   ================================================================ */
function getCurrentSelectorCriteriaObj() {
  return {
    wire_material: document.getElementById('sel-wire-material')?.value || '',
    wire_subtype:  document.getElementById('sel-wire-subtype')?.value  || '',
    machine_type:  document.getElementById('sel-machine-type')?.value  || '',
    die_material:  document.getElementById('sel-die-material')?.value  || '',
    speed:         document.getElementById('sel-speed')?.value         || '',
    passes:        document.getElementById('sel-passes')?.value        || '',
    wire_diameter: document.getElementById('sel-diameter')?.value      || '',
  };
}
