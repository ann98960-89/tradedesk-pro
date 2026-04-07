/* ===================================================
   selector.js - 拉丝工艺产品智能选型模块
   =================================================== */

let selectorResults = [];
let currentStep = 1;
const TOTAL_STEPS = 5;

// ===== 初始化选型页面 =====
function loadSelector() {
  resetSelectorForm();
}

// ===== renderSelectorStep（兼容旧调用） =====
function renderSelectorStep(step) {
  // 直接更新显示，不走验证流程
  currentStep = step;
  document.querySelectorAll('.selector-step').forEach((el, i) => {
    el.style.display = (i + 1 === step) ? '' : 'none';
  });
  updateStepIndicator(step);
}

// ===== 重置表单 =====
function resetSelectorForm() {
  currentStep = 1;
  selectorResults = [];
  document.querySelectorAll('.selector-step').forEach((el, i) => {
    el.style.display = i === 0 ? '' : 'none';
  });
  updateStepIndicator(1);

  // 重置所有选择
  ['sel-wire-material','sel-wire-subtype','sel-machine-type',
   'sel-die-material','sel-speed','sel-passes','sel-diameter'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('sel-subtype-wrapper').style.display = 'none';
  document.getElementById('sel-welding-extra').style.display = 'none';
  document.getElementById('selector-results').innerHTML = '';
}

// ===== 步骤切换 =====
function goStep(step) {
  // 验证当前步骤
  if (step > currentStep && !validateSelectorStep(currentStep)) return;

  currentStep = step;
  document.querySelectorAll('.selector-step').forEach((el, i) => {
    el.style.display = (i + 1 === step) ? '' : 'none';
  });
  updateStepIndicator(step);

  // 到达结果步骤时自动运行
  if (step === TOTAL_STEPS) {
    runSelector();
  }
}

function nextStep() { goStep(currentStep + 1); }
function prevStep() { goStep(currentStep - 1); }

function updateStepIndicator(step) {
  document.querySelectorAll('.sel-step-dot').forEach((el, i) => {
    el.classList.remove('active', 'done');
    if (i + 1 < step) el.classList.add('done');
    else if (i + 1 === step) el.classList.add('active');
  });
  document.querySelectorAll('.sel-step-connector').forEach((el, i) => {
    el.classList.toggle('done', i + 1 < step);
  });
}

// ===== 步骤验证 =====
function validateSelectorStep(step) {
  if (step === 1) {
    if (!document.getElementById('sel-wire-material').value) {
      showToast('请先选择线材材质', 'warning'); return false;
    }
  }
  return true;
}

// ===== 线材材质变化 → 动态子类型 =====
function onWireMaterialChange() {
  const mat = document.getElementById('sel-wire-material').value;
  const wrapper = document.getElementById('sel-subtype-wrapper');
  const subtypeSelect = document.getElementById('sel-wire-subtype');
  const weldingExtra = document.getElementById('sel-welding-extra');

  if (!mat || !WIRE_PRODUCT_TYPES[mat]) {
    wrapper.style.display = 'none';
    weldingExtra.style.display = 'none';
    return;
  }
  wrapper.style.display = '';
  subtypeSelect.innerHTML = '<option value="">-- 请选择产品类型 --</option>' +
    WIRE_PRODUCT_TYPES[mat].subtypes.map(s =>
      `<option value="${s.value}">${s.label}</option>`
    ).join('');
  weldingExtra.style.display = 'none';
}

function onWireSubtypeChange() {
  const subtype = document.getElementById('sel-wire-subtype').value;
  const mat = document.getElementById('sel-wire-material').value;
  const weldingExtra = document.getElementById('sel-welding-extra');

  if (subtype === 'welding_wire') {
    // 显示焊丝子分类
    weldingExtra.style.display = '';
    renderWeldingExtraOptions();
  } else {
    weldingExtra.style.display = 'none';
  }
}

function renderWeldingExtraOptions() {
  const weldingData = WIRE_PRODUCT_TYPES['carbon_steel'].subtypes.find(s => s.value === 'welding_wire');
  if (!weldingData?.children) return;

  document.getElementById('sel-welding-extra').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
      <div class="form-group">
        <label class="form-label">按材料分类</label>
        <select class="form-control" id="sel-ww-material">
          <option value="">-- 不限 --</option>
          ${weldingData.children.by_material.map(m => `<option value="${m.value}">${m.label}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">按结构分类</label>
        <select class="form-control" id="sel-ww-structure">
          <option value="">-- 不限 --</option>
          ${weldingData.children.by_structure.map(m => `<option value="${m.value}">${m.label}</option>`).join('')}
        </select>
      </div>
    </div>`;
}

// ===== 运行选型引擎 =====
function runSelector() {
  const criteria = {
    wire_material:  document.getElementById('sel-wire-material')?.value || '',
    wire_subtype:   document.getElementById('sel-wire-subtype')?.value || '',
    machine_type:   document.getElementById('sel-machine-type')?.value || '',
    die_material:   document.getElementById('sel-die-material')?.value || '',
    speed:          document.getElementById('sel-speed')?.value || '',
    passes:         document.getElementById('sel-passes')?.value || '',
    wire_diameter:  document.getElementById('sel-diameter')?.value || '',
  };

  selectorResults = runProductSelector(criteria);
  renderSelectorResults(criteria);
}

// ===== 渲染结果 =====
function renderSelectorResults(criteria) {
  const container = document.getElementById('selector-results');

  // 条件摘要
  const matInfo = WIRE_PRODUCT_TYPES[criteria.wire_material];
  const subtypeInfo = matInfo?.subtypes.find(s => s.value === criteria.wire_subtype);
  const machineInfo = MACHINE_TYPES.find(m => m.value === criteria.machine_type);
  const dieInfo = DIE_MATERIALS.find(d => d.value === criteria.die_material);

  const conditionHtml = `
    <div class="card" style="margin-bottom:20px;background:linear-gradient(135deg,#e8f0fe,#f0f9ff);border:1px solid #bfdbfe;">
      <div class="card-body" style="padding:16px 20px;">
        <div style="font-size:13px;font-weight:700;color:#1e40af;margin-bottom:12px;">📋 您的工艺条件</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;">
          ${criteria.wire_material ? `<span class="badge badge-primary">材质：${matInfo?.label || criteria.wire_material}</span>` : ''}
          ${criteria.wire_subtype ? `<span class="badge badge-purple">产品：${subtypeInfo?.label || criteria.wire_subtype}</span>` : ''}
          ${criteria.machine_type ? `<span class="badge badge-gray">机型：${machineInfo?.label?.split(' ')[0] || criteria.machine_type}</span>` : ''}
          ${criteria.die_material ? `<span class="badge badge-gray">模具：${dieInfo?.label?.split(' ')[0] || criteria.die_material}</span>` : ''}
          ${criteria.speed ? `<span class="badge badge-warning">速度：${criteria.speed} m/s</span>` : ''}
          ${criteria.passes ? `<span class="badge badge-warning">道次：${criteria.passes} 道</span>` : ''}
          ${criteria.wire_diameter ? `<span class="badge badge-success">线径：${criteria.wire_diameter} mm</span>` : ''}
        </div>
      </div>
    </div>`;

  if (!selectorResults.length) {
    container.innerHTML = conditionHtml + `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <h3>未找到匹配产品</h3>
        <p>请尝试调整选型条件，或联系技术支持获取定制推荐</p>
        <button class="btn btn-primary" style="margin-top:16px;" onclick="goStep(1)">🔄 重新选型</button>
      </div>`;
    return;
  }

  const resultsHtml = selectorResults.map((p, idx) => {
    const rankBadge = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx+1}`;
    const scoreColor = p.score >= 80 ? '#059669' : p.score >= 50 ? '#d97706' : '#6b7280';
    const typeClass = p.type.includes('干拉粉') ? 'doc-sds' : p.type.includes('湿拉') ? 'doc-tds' :
                      p.type.includes('铝') ? 'doc-coa' : p.type.includes('磷化') ? 'doc-ir' : 'doc-other';

    return `
      <div class="card" style="margin-bottom:16px;border-left:4px solid ${scoreColor};${idx===0?'box-shadow:0 4px 20px rgba(5,150,105,0.15);':''}">
        <div class="card-header" style="padding:14px 20px;">
          <div style="display:flex;align-items:center;gap:12px;flex:1;min-width:0;">
            <span style="font-size:22px;">${rankBadge}</span>
            <div style="flex:1;min-width:0;">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                <span style="font-size:15px;font-weight:800;color:#111827;">${p.name}</span>
                <span class="doc-type-badge ${typeClass}" style="font-size:10.5px;">${p.type}</span>
                ${p.highlights ? `<span style="font-size:11.5px;color:${scoreColor};font-weight:600;">${p.highlights}</span>` : ''}
              </div>
              <div style="font-size:12px;color:#6b7280;margin-top:3px;">${p.category}</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:10px;flex-shrink:0;">
            <div style="text-align:right;">
              <div style="font-size:22px;font-weight:800;color:${scoreColor};">${p.score}<span style="font-size:12px;font-weight:400;">分</span></div>
              <div style="font-size:10.5px;color:#9ca3af;">匹配度</div>
            </div>
          </div>
        </div>
        <div class="card-body" style="padding:0 20px 16px;">
          <p style="font-size:13.5px;color:#374151;line-height:1.7;margin-bottom:14px;">${p.description}</p>
          
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;margin-bottom:14px;">
            ${p.speed_range ? `<div style="background:#f9fafb;border-radius:8px;padding:10px 12px;">
              <div style="font-size:10.5px;color:#6b7280;font-weight:600;text-transform:uppercase;margin-bottom:3px;">拉拔速度</div>
              <div style="font-size:13px;font-weight:700;color:#374151;">${p.speed_range.min} – ${p.speed_range.max} m/s</div>
            </div>` : ''}
            ${p.pass_range ? `<div style="background:#f9fafb;border-radius:8px;padding:10px 12px;">
              <div style="font-size:10.5px;color:#6b7280;font-weight:600;text-transform:uppercase;margin-bottom:3px;">拉拔道次</div>
              <div style="font-size:13px;font-weight:700;color:#374151;">${p.pass_range.min} – ${p.pass_range.max} 道</div>
            </div>` : ''}
            ${p.wire_diameter_out ? `<div style="background:#f9fafb;border-radius:8px;padding:10px 12px;">
              <div style="font-size:10.5px;color:#6b7280;font-weight:600;text-transform:uppercase;margin-bottom:3px;">适用线径</div>
              <div style="font-size:13px;font-weight:700;color:#374151;">${p.wire_diameter_out.min} – ${p.wire_diameter_out.max} mm</div>
            </div>` : ''}
            ${p.temp_resistance ? `<div style="background:#f9fafb;border-radius:8px;padding:10px 12px;">
              <div style="font-size:10.5px;color:#6b7280;font-weight:600;text-transform:uppercase;margin-bottom:3px;">耐温</div>
              <div style="font-size:13px;font-weight:700;color:#374151;">≤ ${p.temp_resistance}°C</div>
            </div>` : ''}
            ${p.concentration ? `<div style="background:#f9fafb;border-radius:8px;padding:10px 12px;">
              <div style="font-size:10.5px;color:#6b7280;font-weight:600;text-transform:uppercase;margin-bottom:3px;">使用浓度</div>
              <div style="font-size:13px;font-weight:700;color:#374151;">${p.concentration}</div>
            </div>` : ''}
            ${p.packaging ? `<div style="background:#f9fafb;border-radius:8px;padding:10px 12px;">
              <div style="font-size:10.5px;color:#6b7280;font-weight:600;text-transform:uppercase;margin-bottom:3px;">包装规格</div>
              <div style="font-size:13px;font-weight:700;color:#374151;">${p.packaging}</div>
            </div>` : ''}
          </div>

          <div style="display:flex;gap:16px;flex-wrap:wrap;">
            ${p.features?.length ? `<div style="flex:1;min-width:200px;">
              <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;margin-bottom:8px;">产品特点</div>
              <div style="display:flex;flex-wrap:wrap;gap:5px;">
                ${p.features.map(f => `<span style="background:#e8f0fe;color:#1e40af;font-size:11.5px;font-weight:600;padding:3px 8px;border-radius:5px;">${f}</span>`).join('')}
              </div>
            </div>` : ''}
            <div style="min-width:200px;">
              <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;margin-bottom:8px;">匹配原因</div>
              ${p.reasons.map(r => `<div style="font-size:12px;color:#059669;margin-bottom:3px;">${r}</div>`).join('')}
              ${p.warnings.map(w => `<div style="font-size:12px;color:#d97706;margin-bottom:3px;">${w}</div>`).join('')}
            </div>
          </div>

          <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap;">
            <button class="btn btn-sm btn-primary" onclick="addSelectorTodo('${p.id}','${escHtml(p.name)}')">
              <i class="fas fa-plus"></i> 添加跟进任务
            </button>
            <button class="btn btn-sm btn-secondary" onclick="exportSingleRecommendation('${p.id}')">
              <i class="fas fa-file-excel"></i> 导出推荐报告
            </button>
            <button class="btn btn-sm" style="background:#fff3cd;color:#856404;border:1.5px solid #ffc107;" onclick="openFeedbackModal('${p.id}','${escHtml(p.name)}', getCurrentSelectorCriteriaObj())">
              📝 提交试样反馈
            </button>
          </div>
        </div>
      </div>`;
  }).join('');

  container.innerHTML = conditionHtml +
    `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
      <div style="font-size:14px;font-weight:700;color:#111827;">找到 <span style="color:#059669;">${selectorResults.length}</span> 个匹配产品（按匹配度排序）</div>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-sm btn-success" onclick="exportRecommendations()">
          <i class="fas fa-file-excel"></i> 导出全部推荐报告
        </button>
        <button class="btn btn-sm btn-secondary" onclick="goStep(1)">
          🔄 重新选型
        </button>
      </div>
    </div>` + resultsHtml;
}

// ===== 添加选型结果为待办任务 =====
async function addSelectorTodo(productId, productName) {
  const criteria = getSelectorCriteria();
  try {
    await apiPost('todos', {
      title: `向客户推荐：${productName}`,
      category: '报价',
      priority: '中',
      status: '待处理',
      due_date: new Date(Date.now() + 3 * 86400000).toISOString(),
      description: `根据客户工艺条件（${criteria}）智能选型推荐产品：${productName}`,
    });
    showToast(`✅ 已添加跟进任务：${productName}`, 'success');
  } catch (e) {
    showToast('添加失败', 'error');
  }
}

function getSelectorCriteria() {
  const parts = [];
  const mat = document.getElementById('sel-wire-material')?.value;
  const sub = document.getElementById('sel-wire-subtype')?.value;
  const speed = document.getElementById('sel-speed')?.value;
  const passes = document.getElementById('sel-passes')?.value;
  const dia = document.getElementById('sel-diameter')?.value;
  if (mat) parts.push(WIRE_PRODUCT_TYPES[mat]?.label || mat);
  if (sub) {
    const matInfo = WIRE_PRODUCT_TYPES[mat];
    const subInfo = matInfo?.subtypes.find(s => s.value === sub);
    if (subInfo) parts.push(subInfo.label.split(' ')[0]);
  }
  if (speed) parts.push(`${speed}m/s`);
  if (passes) parts.push(`${passes}道次`);
  if (dia) parts.push(`线径${dia}mm`);
  return parts.join('，');
}

// ===== 导出推荐报告 =====
function exportRecommendations() {
  if (!selectorResults.length) { showToast('暂无推荐结果', 'warning'); return; }

  const criteria = getSelectorCriteria();
  const headers = ['排名','产品编号','产品名称','类型','类别','匹配分数','适用速度(m/s)',
    '适用道次','适用线径(mm)','产品特点','适用机型','适用模具','包装规格','产品描述'];

  const rows = selectorResults.map((p, i) => [
    i + 1,
    p.id,
    p.name,
    p.type,
    p.category,
    p.score,
    p.speed_range ? `${p.speed_range.min}-${p.speed_range.max}` : '',
    p.pass_range ? `${p.pass_range.min}-${p.pass_range.max}` : '',
    p.wire_diameter_out ? `${p.wire_diameter_out.min}-${p.wire_diameter_out.max}` : '',
    (p.features || []).join('; '),
    (p.machine_types || []).join('; '),
    (p.die_materials || []).join('; '),
    p.packaging || '',
    p.description || '',
  ]);

  downloadExcel([{
    name: '智能选型推荐',
    data: [
      [`工艺条件：${criteria}`, '', '', '', '', '', '', '', '', '', '', '', '', ''],
      [`生成时间：${new Date().toLocaleDateString('zh-CN')}`, '', '', '', '', '', '', '', '', '', '', '', '', ''],
      headers,
      ...rows,
    ],
  }], `产品选型推荐报告_${todayStr()}.xlsx`);

  showToast(`✅ 已导出 ${selectorResults.length} 条推荐产品报告`, 'success');
}

function exportSingleRecommendation(productId) {
  const p = selectorResults.find(r => r.id === productId);
  if (!p) return;
  const criteria = getSelectorCriteria();

  const data = [
    ['TradeDesk Pro - 产品选型推荐报告', ''],
    ['', ''],
    ['工艺条件摘要', criteria],
    ['生成日期', new Date().toLocaleDateString('zh-CN')],
    ['', ''],
    ['产品信息', ''],
    ['产品编号', p.id],
    ['产品名称', p.name],
    ['类型', p.type],
    ['类别', p.category],
    ['匹配度评分', `${p.score} 分`],
    ['', ''],
    ['技术参数', ''],
    ['适用拉拔速度', p.speed_range ? `${p.speed_range.min} – ${p.speed_range.max} m/s` : '-'],
    ['适用拉拔道次', p.pass_range ? `${p.pass_range.min} – ${p.pass_range.max} 道` : '-'],
    ['适用出口线径', p.wire_diameter_out ? `${p.wire_diameter_out.min} – ${p.wire_diameter_out.max} mm` : '-'],
    ['耐温上限', p.temp_resistance ? `${p.temp_resistance}°C` : '-'],
    ['使用浓度', p.concentration || '-'],
    ['包装规格', p.packaging || '-'],
    ['', ''],
    ['产品特点', (p.features || []).join('; ')],
    ['产品描述', p.description || ''],
    ['', ''],
    ['选型建议', p.highlights || ''],
    ['', ''],
    ['匹配原因', p.reasons.join('\n')],
    ['注意事项', p.warnings.join('\n')],
  ];

  downloadExcel([{ name: p.name, data }], `选型报告_${p.id}_${todayStr()}.xlsx`);
  showToast(`✅ 已导出 ${p.name} 的选型报告`, 'success');
}

// ===== 工艺预设快速填入 =====
const PRESETS = {
  steel_cord_fine: { speed: 20, passes: 18, diameter: 0.20, machine: 'fine_drawing', die: 'pcd', material: 'carbon_steel', subtype: 'steel_cord' },
  galvanized_rough: { speed: 2, passes: 5, diameter: 3.0, machine: 'bull_block', die: 'tc', material: 'carbon_steel', subtype: 'galvanized' },
  spring_mid:   { speed: 6, passes: 10, diameter: 1.2, machine: 'slip_type', die: 'tc', material: 'carbon_steel', subtype: 'spring_wire' },
  welding_wire: { speed: 8, passes: 8, diameter: 1.2, machine: 'non_slip', die: 'pcd', material: 'carbon_steel', subtype: 'welding_wire' },
  ss_fine:      { speed: 5, passes: 12, diameter: 0.5, machine: 'non_slip', die: 'pcd', material: 'stainless_steel', subtype: 'ss_304' },
};

function fillPreset(key) {
  const p = PRESETS[key];
  if (!p) return;
  document.getElementById('sel-speed').value = p.speed;
  document.getElementById('sel-passes').value = p.passes;
  document.getElementById('sel-diameter').value = p.diameter;
  if (p.machine) {
    document.getElementById('sel-machine-type').value = p.machine;
    const radio = document.querySelector(`input[name="machine_type"][value="${p.machine}"]`);
    if (radio) { radio.checked = true; highlightMachineCard(p.machine); }
  }
  if (p.die) {
    document.getElementById('sel-die-material').value = p.die;
    const radio = document.querySelector(`input[name="die_material"][value="${p.die}"]`);
    if (radio) { radio.checked = true; highlightDieCard(p.die); }
  }
  if (p.material) {
    document.getElementById('sel-wire-material').value = p.material;
    onWireMaterialChange();
    if (p.subtype) {
      setTimeout(() => {
        document.getElementById('sel-wire-subtype').value = p.subtype;
        onWireSubtypeChange();
      }, 50);
    }
  }
  showToast(`✅ 已填入「${key}」预设工艺参数`, 'success');
}

// ===== 卡片高亮 =====
function highlightMachineCard(val) {
  document.querySelectorAll('.machine-card').forEach(el => {
    el.style.borderColor = '#e5e7eb';
    el.style.background = '';
  });
  const card = document.getElementById(`mtype-${val}`);
  if (card) { card.style.borderColor = '#1a56db'; card.style.background = '#e8f0fe'; }
}
function highlightDieCard(val) {
  document.querySelectorAll('.die-card').forEach(el => {
    el.style.borderColor = '#e5e7eb';
    el.style.background = '';
  });
  const card = document.getElementById(`dtype-${val}`);
  if (card) { card.style.borderColor = '#7c3aed'; card.style.background = '#ede9fe'; }
}
