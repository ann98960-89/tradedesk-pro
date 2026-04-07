/* ===================================================
   selector-data.js
   拉丝工艺产品选型知识库（润滑剂/拉丝粉/乳化液）
   =================================================== */

// ======================================================================
// 一、拉线材质 × 产品类型 × 工艺条件 → 推荐产品矩阵
// ======================================================================

/** 产品类型完整分类 */
const WIRE_PRODUCT_TYPES = {
  carbon_steel: {
    label: '碳钢',
    icon: '⚙️',
    color: '#374151',
    subtypes: [
      { value: 'steel_cord',    label: '钢帘线 Steel Cord',      desc: '子午轮胎骨架材料，高强度镀铜' },
      { value: 'galvanized',    label: '镀锌钢丝 Galvanized Wire', desc: '热镀锌或电镀锌，用于围栏/钢绞线' },
      { value: 'bright_wire',   label: '光亮钢丝 Bright Wire',    desc: '冷拔高光，用于弹簧/钢丝绳' },
      { value: 'bead_wire',     label: '胎圈丝 Bead Wire',        desc: '镀铜高强度，轮胎圈部加强' },
      { value: 'rope_wire',     label: '钢丝绳 Wire Rope',        desc: '多股绞合，起重/索道/海洋' },
      { value: 'spring_wire',   label: '弹簧钢丝 Spring Wire',    desc: '高弹性，精密弹簧制造' },
      {
        value: 'welding_wire',
        label: '焊丝 Welding Wire',
        desc: '气体保护焊/埋弧焊用线材',
        children: {
          by_material: [
            { value: 'ww_carbon',    label: 'ER49-1 / ER50-6 碳钢焊丝' },
            { value: 'ww_low_alloy', label: 'ER55-B2 低合金耐热焊丝' },
            { value: 'ww_ss_308',    label: 'ER308L 不锈钢焊丝' },
            { value: 'ww_ss_316',    label: 'ER316L 不锈钢焊丝' },
            { value: 'ww_al_4043',   label: 'ER4043 铝合金焊丝' },
            { value: 'ww_al_5356',   label: 'ER5356 铝合金焊丝' },
          ],
          by_structure: [
            { value: 'ww_solid',     label: '实心焊丝 Solid Wire' },
            { value: 'ww_flux_core', label: '药芯焊丝 Flux-Cored Wire (FCW)' },
            { value: 'ww_metal_core',label: '金属粉芯焊丝 Metal-Cored Wire' },
            { value: 'ww_submerged', label: '埋弧焊丝 Submerged Arc Wire' },
          ],
        },
      },
    ],
  },
  alloy_steel: {
    label: '合金钢',
    icon: '🔩',
    color: '#1e40af',
    subtypes: [
      { value: 'high_speed',   label: '高速钢丝 High Speed Steel Wire', desc: '高线速度下的精密拉拔' },
      { value: 'alloy_spring', label: '合金弹簧钢 Alloy Spring Steel',  desc: '高温/高疲劳环境弹簧' },
      { value: 'bearing_wire', label: '轴承钢丝 Bearing Steel Wire',    desc: 'GCr15，精密轴承滚珠' },
      { value: 'tool_wire',    label: '工具钢丝 Tool Steel Wire',       desc: '高硬度，刀具/模具制造' },
    ],
  },
  stainless_steel: {
    label: '不锈钢',
    icon: '✨',
    color: '#0891b2',
    subtypes: [
      { value: 'ss_304',  label: '304 不锈钢丝', desc: '通用型，食品/医疗/建筑' },
      { value: 'ss_316',  label: '316L 不锈钢丝', desc: '耐氯腐蚀，海洋/化工' },
      { value: 'ss_430',  label: '430 铁素体不锈钢丝', desc: '磁性，家电/汽车排气' },
      { value: 'ss_2205', label: '2205 双相不锈钢丝', desc: '高强度高耐腐蚀' },
    ],
  },
  aluminum: {
    label: '铝及铝合金',
    icon: '🪶',
    color: '#7c3aed',
    subtypes: [
      { value: 'acs_wire',  label: '铝包钢丝 ACS Wire',       desc: '同轴复合线，架空输电' },
      { value: 'al_wire',   label: '纯铝拉丝 Pure Aluminum',  desc: '导电/箔用铝丝' },
      { value: 'al_6xxx',   label: '6系铝合金 6xxx Alloy',    desc: '6061/6063，结构件' },
      { value: 'al_8xxx',   label: '8系铝合金 8xxx Alloy',    desc: '8030/8176，导线线芯' },
    ],
  },
};

/** 拉丝机类型 */
const MACHINE_TYPES = [
  { value: 'slip_type',       label: '滑轮式拉丝机 Slip Type',         desc: '多道次同机拉拔，适合中细丝' },
  { value: 'non_slip',        label: '无滑动式拉丝机 Non-Slip',         desc: '各道次线速独立控制，适合高精度' },
  { value: 'inverted_capstan',label: '倒立式/鼓式拉丝机 Inverted',      desc: '大盘储线，适合粗中丝' },
  { value: 'straight',        label: '直线式拉丝机 Straight Type',      desc: '单道次直进，适合粗大线径' },
  { value: 'bull_block',      label: '大拉机 Bull Block',               desc: '盘条粗拉，出口线径 3-8mm' },
  { value: 'fine_drawing',    label: '水箱拉丝机 Water Box / Fine',     desc: '超细丝，线径 0.05-0.5mm' },
];

/** 模具材质 */
const DIE_MATERIALS = [
  { value: 'tc',      label: '硬质合金模 Tungsten Carbide (TC)', desc: '通用，适合大多数线材' },
  { value: 'pcd',     label: 'PCD 金刚石模 Polycrystalline Diamond', desc: '超细丝/有色金属，超低摩擦' },
  { value: 'nd',      label: '天然金刚石模 Natural Diamond',      desc: '超精密，线径 < 0.1mm' },
  { value: 'ceramic', label: '陶瓷模 Ceramic',                    desc: '高耐磨，铝/铜等软金属' },
];

// ======================================================================
// 二、润滑剂产品数据库
// ======================================================================

const LUBRICANT_PRODUCTS = [
  // ───────────────────────────────── 干拉粉 ──────────────────────────────────
  {
    id: 'P001',
    name: '高速拉丝粉 HSP-200',
    type: '干拉粉 Dry Powder',
    category: '碳钢/高速',
    applicable_wire: ['carbon_steel', 'alloy_steel'],
    applicable_subtypes: ['steel_cord','bead_wire','bright_wire','spring_wire'],
    machine_types: ['slip_type','non_slip','fine_drawing'],
    die_materials: ['tc','pcd'],
    speed_range: { min: 5, max: 25, unit: 'm/s' },
    pass_range: { min: 6, max: 24 },
    wire_diameter_out: { min: 0.15, max: 3.0, unit: 'mm' },
    features: ['极压抗磨','高速润滑','低皂粉残留','镀前清洗友好'],
    temp_resistance: 280,
    description: '采用特殊脂肪酸复合皂基配方，专为高速多道次干拉工艺设计。在 5-25 m/s 拉拔速度下保持优异润滑性能，适用于钢帘线、胎圈丝等高质量碳钢拉拔。',
    highlights: '⭐ 推荐钢帘线 / 胎圈丝首选',
    packaging: '25kg/袋',
  },
  {
    id: 'P002',
    name: '低温拉丝粉 LTP-100',
    type: '干拉粉 Dry Powder',
    category: '碳钢/低速常温',
    applicable_wire: ['carbon_steel'],
    applicable_subtypes: ['galvanized','bright_wire','rope_wire'],
    machine_types: ['bull_block','inverted_capstan','straight'],
    die_materials: ['tc'],
    speed_range: { min: 0.5, max: 5, unit: 'm/s' },
    pass_range: { min: 1, max: 8 },
    wire_diameter_out: { min: 1.5, max: 8.0, unit: 'mm' },
    features: ['低温起效','皮膜均匀','镀锌前无需酸洗','低烟雾'],
    temp_resistance: 180,
    description: '适合粗中拉阶段（大拉机、倒立机），尤其针对镀锌钢丝前道次拉拔，皂粉残留物与锌液兼容性好，不影响后续镀层附着力。',
    highlights: '✅ 镀锌丝粗拉推荐',
    packaging: '25kg/袋',
  },
  {
    id: 'P003',
    name: '不锈钢干拉粉 SSP-50',
    type: '干拉粉 Dry Powder',
    category: '不锈钢专用',
    applicable_wire: ['stainless_steel'],
    applicable_subtypes: ['ss_304','ss_316','ss_430','ss_2205'],
    machine_types: ['slip_type','non_slip'],
    die_materials: ['tc','pcd'],
    speed_range: { min: 1, max: 10, unit: 'm/s' },
    pass_range: { min: 4, max: 15 },
    wire_diameter_out: { min: 0.1, max: 5.0, unit: 'mm' },
    features: ['极压EP添加剂','防冷焊','无氯无硫配方','镀镍友好'],
    temp_resistance: 350,
    description: '不锈钢加工硬化严重，本品采用含磷极压添加剂，有效防止模具与工件粘结（冷焊），延长模具寿命。无氯无硫配方适合食品级/医疗不锈钢丝。',
    highlights: '🔬 不锈钢专用，防冷焊',
    packaging: '20kg/桶',
  },
  {
    id: 'P004',
    name: '超细丝拉丝粉 UFP-010',
    type: '干拉粉 Dry Powder',
    category: '超细钢丝',
    applicable_wire: ['carbon_steel','stainless_steel'],
    applicable_subtypes: ['steel_cord','fine_wire'],
    machine_types: ['fine_drawing'],
    die_materials: ['pcd','nd'],
    speed_range: { min: 10, max: 30, unit: 'm/s' },
    pass_range: { min: 12, max: 30 },
    wire_diameter_out: { min: 0.05, max: 0.3, unit: 'mm' },
    features: ['纳米级颗粒','超高速稳定','低摩擦系数','表面镜面光亮'],
    temp_resistance: 320,
    description: '专为水箱拉丝机及超细丝（< 0.3mm）开发，采用纳米级皂粉颗粒，在极高线速（最高 30 m/s）下仍可形成均匀润滑膜。特别适合钢帘线末道次。',
    highlights: '🏆 超细丝 / 钢帘线末道次专用',
    packaging: '10kg/桶',
  },
  // ───────────────────────────────── 湿拉乳化液 ───────────────────────────────
  {
    id: 'P005',
    name: '拉丝乳化液 WDE-300',
    type: '湿拉乳化液 Wet Drawing Emulsion',
    category: '碳钢/不锈钢通用',
    applicable_wire: ['carbon_steel','alloy_steel','stainless_steel'],
    applicable_subtypes: ['bright_wire','rope_wire','spring_wire','ss_304','high_speed'],
    machine_types: ['fine_drawing','non_slip'],
    die_materials: ['tc','pcd'],
    speed_range: { min: 3, max: 20, unit: 'm/s' },
    pass_range: { min: 4, max: 20 },
    wire_diameter_out: { min: 0.08, max: 2.0, unit: 'mm' },
    features: ['优异冷却性','长液池寿命','防锈保护','抗菌稳定'],
    concentration: '3-8%',
    description: '高性能水溶性拉丝乳化液，适用于湿拉工艺。优异的冷却效果可降低模具/线材温升，配合杀菌剂可延长液池使用周期达 6-12 个月。',
    highlights: '💧 湿拉工艺通用首选',
    packaging: '200L/桶',
  },
  {
    id: 'P006',
    name: '不锈钢湿拉液 SSE-200',
    type: '湿拉乳化液 Wet Drawing Emulsion',
    category: '不锈钢专用',
    applicable_wire: ['stainless_steel'],
    applicable_subtypes: ['ss_304','ss_316','ss_430','ss_2205'],
    machine_types: ['fine_drawing','non_slip'],
    die_materials: ['tc','pcd','nd'],
    speed_range: { min: 1, max: 12, unit: 'm/s' },
    pass_range: { min: 4, max: 18 },
    wire_diameter_out: { min: 0.05, max: 3.0, unit: 'mm' },
    features: ['氯离子含量<5ppm','无硫','强极压','表面光亮'],
    concentration: '5-12%',
    description: '专为不锈钢湿拉设计，严格控制氯离子（< 5 ppm），防止应力腐蚀裂纹（SCC）。添加聚合物成膜剂，显著提高不锈钢丝表面光洁度。',
    highlights: '🔬 304/316不锈钢湿拉，抗SCC',
    packaging: '200L/桶',
  },
  {
    id: 'P007',
    name: '铝合金拉丝油 ALO-500',
    type: '铝拉丝油 Aluminum Drawing Oil',
    category: '铝/铝合金',
    applicable_wire: ['aluminum'],
    applicable_subtypes: ['acs_wire','al_wire','al_6xxx','al_8xxx'],
    machine_types: ['slip_type','non_slip','straight'],
    die_materials: ['tc','pcd','ceramic'],
    speed_range: { min: 2, max: 15, unit: 'm/s' },
    pass_range: { min: 3, max: 12 },
    wire_diameter_out: { min: 0.5, max: 10.0, unit: 'mm' },
    features: ['铝专用极压','高光洁度','无铝皂沉积','防氧化'],
    description: '铝合金拉丝专用润滑油，不含铜/铁等有色金属催化氧化成分，防止铝丝变色。特殊分散剂可减少铝皂在模具和线材上的积聚。',
    highlights: '🪶 铝/铝包钢丝专用',
    packaging: '200L/桶',
  },
  {
    id: 'P008',
    name: '焊丝拉拔润滑粉 WWP-100',
    type: '干拉粉 Dry Powder',
    category: '碳钢焊丝',
    applicable_wire: ['carbon_steel'],
    applicable_subtypes: ['welding_wire'],
    machine_types: ['slip_type','non_slip'],
    die_materials: ['tc','pcd'],
    speed_range: { min: 2, max: 15, unit: 'm/s' },
    pass_range: { min: 4, max: 12 },
    wire_diameter_out: { min: 0.8, max: 4.0, unit: 'mm' },
    features: ['低挥发物','焊接飞溅少','残留物焊接友好','铜镀前兼容'],
    temp_resistance: 220,
    description: '专为 CO₂/MAG 焊丝及埋弧焊丝开发。润滑剂残留物在焊接过程中不会产生过量烟气和飞溅，对铜镀层附着力无影响。特别适合 ER49-1、ER50-6 等碳钢实心焊丝。',
    highlights: '⚡ 碳钢实心焊丝首选',
    packaging: '25kg/袋',
  },
  {
    id: 'P009',
    name: '不锈钢焊丝拉拔液 SSWW-100',
    type: '湿拉乳化液 Wet Drawing Emulsion',
    category: '不锈钢焊丝',
    applicable_wire: ['stainless_steel'],
    applicable_subtypes: ['welding_wire'],
    machine_types: ['fine_drawing','non_slip'],
    die_materials: ['tc','pcd'],
    speed_range: { min: 1, max: 8, unit: 'm/s' },
    pass_range: { min: 3, max: 10 },
    wire_diameter_out: { min: 0.8, max: 3.2, unit: 'mm' },
    features: ['无卤素','超低残留','焊缝气孔抑制','表面镜面光亮'],
    concentration: '6-10%',
    description: '专为 ER308L、ER316L 等不锈钢焊丝湿拉设计。严格控制卤素含量（Cl+F < 10ppm），残留物在焊接时不会导致焊缝气孔缺陷，确保焊缝 X 射线合格率。',
    highlights: '🔬 不锈钢焊丝，防焊缝气孔',
    packaging: '200L/桶',
  },
  {
    id: 'P010',
    name: '钢帘线拉拔乳化液 SCE-800',
    type: '湿拉乳化液 Wet Drawing Emulsion',
    category: '钢帘线专用',
    applicable_wire: ['carbon_steel'],
    applicable_subtypes: ['steel_cord'],
    machine_types: ['fine_drawing'],
    die_materials: ['pcd','nd'],
    speed_range: { min: 15, max: 35, unit: 'm/s' },
    pass_range: { min: 15, max: 30 },
    wire_diameter_out: { min: 0.1, max: 0.4, unit: 'mm' },
    features: ['超高速稳定','镀铜兼容','防断丝','超低摩擦系数'],
    concentration: '5-8%',
    description: '针对钢帘线（Steel Cord）超细高速湿拉工艺特别研发。在 > 20 m/s 超高速度下保持稳定油膜，防止断丝，与铜镀层兼容性经过验证，确保橡胶与钢丝粘合强度。',
    highlights: '🏆 钢帘线超高速湿拉专用',
    packaging: '200L/桶',
  },
  {
    id: 'P011',
    name: '镀锌前处理磷化液 ZPH-200',
    type: '磷化处理液 Phosphate Coating',
    category: '镀锌丝预处理',
    applicable_wire: ['carbon_steel'],
    applicable_subtypes: ['galvanized'],
    machine_types: ['all'],
    die_materials: ['tc'],
    speed_range: { min: 0.5, max: 8, unit: 'm/s' },
    pass_range: { min: 1, max: 6 },
    wire_diameter_out: { min: 2.0, max: 12.0, unit: 'mm' },
    features: ['磷化膜均匀','与拉丝粉协同','镀锌附着力提升','防锈'],
    description: '通过磷化处理在线材表面形成磷酸铁/锌转化膜，显著提升润滑剂附着力，减少拉拔摩擦，同时改善后续热镀锌层的附着质量。',
    highlights: '🔧 镀锌丝粗中拉前处理',
    packaging: '1000L/IBC桶',
  },
  {
    id: 'P012',
    name: '高性能铝包钢拉丝乳化液 ACS-400',
    type: '湿拉乳化液 Wet Drawing Emulsion',
    category: '铝包钢丝',
    applicable_wire: ['aluminum'],
    applicable_subtypes: ['acs_wire'],
    machine_types: ['non_slip','straight'],
    die_materials: ['tc','ceramic'],
    speed_range: { min: 1, max: 8, unit: 'm/s' },
    pass_range: { min: 2, max: 8 },
    wire_diameter_out: { min: 1.5, max: 8.0, unit: 'mm' },
    features: ['铝钢双金属兼容','防电偶腐蚀','防铝粉积聚','pH稳定'],
    concentration: '4-8%',
    description: '铝包钢复合线芯含异种金属（铝/钢），本品通过缓蚀剂系统防止电偶腐蚀，同时兼顾铝和钢两种金属的润滑需求，保护铝包覆层的完整性。',
    highlights: '⚡ 铝包钢丝专用，防电偶腐蚀',
    packaging: '200L/桶',
  },
];

// ======================================================================
// 三、选型规则引擎
// ======================================================================

/**
 * 根据输入条件过滤并评分产品
 * @param {Object} criteria - 选型条件
 * @returns {Array} - 排序后的推荐产品列表（含匹配分数）
 */
function runProductSelector(criteria) {
  const {
    wire_material,    // 'carbon_steel' | 'alloy_steel' | 'stainless_steel' | 'aluminum'
    wire_subtype,     // 具体子类型
    machine_type,     // 拉丝机类型
    die_material,     // 模具材质
    speed,            // 拉拔速度 m/s (number)
    passes,           // 拉拔道次 (number)
    wire_diameter,    // 出口线径 mm (number)
  } = criteria;

  const results = [];

  LUBRICANT_PRODUCTS.forEach(p => {
    let score = 0;
    const reasons = [];
    const warnings = [];

    // ① 线材材质匹配（权重最高）
    if (wire_material && p.applicable_wire.includes(wire_material)) {
      score += 40;
      reasons.push('✅ 线材材质匹配');
    } else if (wire_material) {
      return; // 材质不匹配直接排除
    }

    // ② 产品子类型匹配
    if (wire_subtype && p.applicable_subtypes) {
      if (p.applicable_subtypes.includes(wire_subtype)) {
        score += 30;
        reasons.push('✅ 产品类型精准匹配');
      }
    }

    // ③ 拉丝机类型匹配
    if (machine_type && p.machine_types) {
      if (p.machine_types.includes(machine_type) || p.machine_types.includes('all')) {
        score += 15;
        reasons.push('✅ 拉丝机类型匹配');
      } else {
        warnings.push('⚠️ 机型与推荐有偏差');
        score -= 5;
      }
    }

    // ④ 模具材质匹配
    if (die_material && p.die_materials) {
      if (p.die_materials.includes(die_material)) {
        score += 10;
        reasons.push('✅ 模具材质兼容');
      } else {
        warnings.push('⚠️ 模具材质不在推荐范围');
      }
    }

    // ⑤ 速度范围校验
    if (speed !== '' && speed !== undefined && speed !== null) {
      const s = parseFloat(speed);
      if (!isNaN(s)) {
        if (p.speed_range && s >= p.speed_range.min && s <= p.speed_range.max) {
          score += 10;
          reasons.push(`✅ 速度 ${s} m/s 在适用范围内 (${p.speed_range.min}-${p.speed_range.max} m/s)`);
        } else if (p.speed_range) {
          if (s > p.speed_range.max) {
            warnings.push(`⚠️ 速度 ${s} m/s 超出推荐上限 ${p.speed_range.max} m/s`);
            score -= 10;
          } else {
            warnings.push(`⚠️ 速度 ${s} m/s 低于推荐下限 ${p.speed_range.min} m/s`);
          }
        }
      }
    }

    // ⑥ 道次范围校验
    if (passes !== '' && passes !== undefined) {
      const ps = parseInt(passes);
      if (!isNaN(ps)) {
        if (p.pass_range && ps >= p.pass_range.min && ps <= p.pass_range.max) {
          score += 5;
          reasons.push(`✅ 拉拔道次 ${ps} 在适用范围内`);
        } else if (p.pass_range) {
          warnings.push(`⚠️ 拉拔道次 ${ps} 超出推荐范围 (${p.pass_range.min}-${p.pass_range.max})`);
        }
      }
    }

    // ⑦ 线径范围校验
    if (wire_diameter !== '' && wire_diameter !== undefined) {
      const wd = parseFloat(wire_diameter);
      if (!isNaN(wd) && p.wire_diameter_out) {
        if (wd >= p.wire_diameter_out.min && wd <= p.wire_diameter_out.max) {
          score += 5;
          reasons.push(`✅ 线径 ${wd} mm 在适用范围内`);
        } else {
          warnings.push(`⚠️ 线径 ${wd} mm 不在推荐范围 (${p.wire_diameter_out.min}-${p.wire_diameter_out.max} mm)`);
          score -= 5;
        }
      }
    }

    if (score > 0) {
      results.push({ ...p, score, reasons, warnings });
    }
  });

  // 按分数降序排列
  return results.sort((a, b) => b.score - a.score);
}
