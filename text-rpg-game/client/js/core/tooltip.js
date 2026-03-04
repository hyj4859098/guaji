const Tooltip = {
  /**
   * 显示物品/装备悬浮窗（唯一入口）
   * @param {Event} event 鼠标事件
   * @param {Object} item 物品/装备对象（完整引用，勿序列化）
   */
  showForItem(event, item) {
    if (!item) return;
    const type = (item.type === 2 || item.equipment_uid) ? 'equipment' : 'item';

    const tooltip = document.createElement('div');
    tooltip.id = 'common-tooltip';
    tooltip.className = 'common-tooltip';
    tooltip.innerHTML = this.buildContent(item, type);

    const target = event.currentTarget;
    const rect = target.getBoundingClientRect();
    tooltip.style.position = 'fixed';
    tooltip.style.left = `${rect.right + 10}px`;
    tooltip.style.top = `${rect.top}px`;
    tooltip.style.zIndex = '1000';

    document.body.appendChild(tooltip);
    this.adjustPosition(tooltip);
  },

  /**
   * 隐藏悬浮窗
   */
  hide() {
    const tooltip = document.getElementById('common-tooltip');
    if (tooltip) {
      tooltip.remove();
    }
  },

  /**
   * 构建悬浮窗内容
   * @param {Object} data 数据
   * @param {string} type 类型
   * @returns {string} HTML内容
   */
  buildContent(data, type) {
    const enhanceLv = data.enhance_level ?? 0;
    const prefix = enhanceLv > 0 ? `+${enhanceLv} ` : '';
    let content = `<div class="tooltip-title">${prefix}${data.name || '未知'}</div>`;

    if (type === 'equipment') {
      content += this.buildEquipmentContent(data);
    } else if (type === 'item') {
      content += this.buildItemContent(data);
    }

    return content;
  },

  /**
   * 构建装备悬浮窗内容
   * 主属性超过基础值显示绿色，低于显示红色
   * @param {Object} equipment 装备数据
   * @returns {string} HTML内容
   */
  buildEquipmentContent(equipment) {
    return this._buildEquipAttrSections(equipment);
  },

  /**
   * 构建物品悬浮窗内容
   * @param {Object} item 物品数据
   * @returns {string} HTML内容
   */
  buildItemContent(item) {
    let content = '';
    let hasAttributes = false;

    if (item.equip_attributes || item.attributes) {
      content += this._buildEquipAttrSections(item);
      hasAttributes = true;
    }

    // 血药、蓝药
    if (!hasAttributes) {
      const hpVal = Number(item.hp_restore) || 0;
      const mpVal = Number(item.mp_restore) || 0;
      if (hpVal > 0 || mpVal > 0) {
        const parts = [];
        if (hpVal > 0) parts.push(`+${hpVal} HP`);
        if (mpVal > 0) parts.push(`+${mpVal} MP`);
        content += `<div class="tooltip-effect"><span class="tooltip-attr-name">效果:</span><span class="tooltip-attr-value">${parts.join(' ')}</span></div>`;
        hasAttributes = true;
      } else if (item.effect) {
        try {
          const effect = typeof item.effect === 'string' ? JSON.parse(item.effect) : item.effect;
          const effects = [];
          if (effect.phy_atk) effects.push(`物理攻击+${effect.phy_atk}`);
          if (effect.mag_atk) effects.push(`魔法攻击+${effect.mag_atk}`);
          if (effect.phy_def) effects.push(`物理防御+${effect.phy_def}`);
          if (effect.mag_def) effects.push(`魔法防御+${effect.mag_def}`);
          if (effect.hp) effects.push(`生命值+${effect.hp}`);
          if (effect.max_hp) effects.push(`最大生命值+${effect.max_hp}`);
          if (effect.exp) effects.push(`经验值+${effect.exp}`);
          if (effect.gold) effects.push(`金币+${effect.gold}`);
          if (effects.length > 0) {
            content += `<div class="tooltip-effect"><span class="tooltip-attr-name">效果:</span><span class="tooltip-attr-value">${effects.join(', ')}</span></div>`;
            hasAttributes = true;
          }
        } catch (e) {
          console.error('解析物品效果失败:', e);
        }
      }
    }

    if (!hasAttributes && item) {
      const attrs = { hp: item.hp, phy_atk: item.phy_atk, phy_def: item.phy_def, mp: item.mp, mag_def: item.mag_def, mag_atk: item.mag_atk, hit_rate: item.hit_rate, dodge_rate: item.dodge_rate, crit_rate: item.crit_rate };
      for (const [key, value] of Object.entries(attrs)) {
        if (value > 0) {
          content += `<div class="tooltip-attr"><span class="tooltip-attr-name">${this.getAttributeName(key)}:</span><span class="tooltip-attr-value">${value}</span></div>`;
          hasAttributes = true;
        }
      }
    }

    if (!hasAttributes) {
      content += `<div class="tooltip-attr"><span class="tooltip-attr-name">属性:</span><span class="tooltip-attr-value">无</span></div>`;
    }

    if (item.count && item.count > 1) {
      content += `<div class="tooltip-count">数量: ${item.count}</div>`;
    }

    return content;
  },

  _pctKeys: new Set(['phy_skill_prob','mag_skill_prob','skill_dmg_pct','phy_def_pct','mag_def_pct','max_hp_pct']),

  _buildEquipAttrSections(data) {
    let content = '';
    const equipLevel = data.equip_level ?? data.level ?? 0;
    const enhanceLevel = data.enhance_level ?? 0;
    const blessingLevel = data.blessing_level ?? 0;
    const rawAttributes = data.equip_attributes || data.attributes || {};
    const baseAttributes = data.base_attributes || {};
    const mainAttrMap = { 1: 'phy_atk', 2: 'phy_def', 3: 'mag_def', 4: 'phy_def', 5: 'dodge_rate', 6: 'hit_rate', 7: 'phy_atk', 8: 'hp' };
    const mainAttrKey = mainAttrMap[data.pos] || null;
    const isWeapon = data.pos === 1;
    const mainValue = data.main_value ?? 0;
    const mainValue2 = data.main_value_2 ?? 0;

    const blessingFlat = {};
    if (data.blessing_effects) {
      for (const e of data.blessing_effects) {
        if (e.suffix === '' && e.mode === 'attr' && e.target) {
          blessingFlat[e.target] = (blessingFlat[e.target] || 0) + e.value;
        }
      }
    }
    const attributes = {};
    for (const [key, value] of Object.entries(rawAttributes)) {
      attributes[key] = (blessingFlat[key] && !this._pctKeys.has(key))
        ? value - blessingFlat[key]
        : value;
    }

    if (equipLevel > 0) {
      content += `<div class="tooltip-meta">装备等级: ${equipLevel}</div>`;
    }

    let hasAttr = false;
    const enhanceBonuses = [];

    for (const [key, value] of Object.entries(attributes)) {
      if (this._pctKeys.has(key)) continue;
      if (value > 0) {
        const attrName = this.getAttributeName(key);
        const baseVal = baseAttributes[key] ?? 0;
        const isMain1 = key === mainAttrKey && mainValue > 0;
        const isMain2 = isWeapon && key === 'mag_atk' && mainValue2 > 0;

        if ((isMain1 || isMain2) && enhanceLevel > 0) {
          const rolledBase = isMain1 ? mainValue : mainValue2;
          const bonus = value - rolledBase;
          let valueColor = '#ffffff';
          if (baseVal > 0 && rolledBase !== baseVal) {
            valueColor = rolledBase > baseVal ? '#48bb78' : '#f56565';
          }
          content += `<div class="tooltip-attr"><span class="tooltip-attr-name">${attrName}</span><span class="tooltip-attr-value" style="color:${valueColor}">${rolledBase}</span></div>`;
          if (bonus > 0) enhanceBonuses.push({ name: attrName, value: bonus });
        } else {
          let valueColor = '#ffffff';
          if (baseVal > 0 && value !== baseVal) {
            valueColor = value > baseVal ? '#48bb78' : '#f56565';
          }
          content += `<div class="tooltip-attr"><span class="tooltip-attr-name">${attrName}</span><span class="tooltip-attr-value" style="color:${valueColor}">${value}</span></div>`;
        }
        hasAttr = true;
      }
    }

    if (enhanceBonuses.length > 0) {
      content += `<div class="tooltip-divider"></div>`;
      for (const b of enhanceBonuses) {
        content += `<div class="tooltip-attr"><span class="tooltip-attr-name" style="color:#48bb78">强化 ${b.name}</span><span class="tooltip-attr-value" style="color:#48bb78">+${b.value}</span></div>`;
      }
    }

    if (blessingLevel > 0 && data.blessing_effects && data.blessing_effects.length > 0) {
      content += `<div class="tooltip-divider"></div>`;
      content += `<div class="tooltip-meta" style="color:#fbbf24">祝福 (+${blessingLevel})</div>`;
      for (const e of data.blessing_effects) {
        const valStr = e.suffix === '%' ? `+${e.value}%` : `+${e.value}`;
        content += `<div class="tooltip-attr"><span class="tooltip-attr-name" style="color:#fbbf24">${e.label}</span><span class="tooltip-attr-value" style="color:#fbbf24">${valStr}</span></div>`;
      }
    }

    if (!hasAttr) {
      content += `<div class="tooltip-attr"><span class="tooltip-attr-name">属性</span><span class="tooltip-attr-value">无</span></div>`;
    }

    return content;
  },

  adjustPosition(tooltip) {
    const tooltipRect = tooltip.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    const windowWidth = window.innerWidth;
    
    // 调整垂直位置
    if (tooltipRect.bottom > windowHeight) {
      tooltip.style.top = `${windowHeight - tooltipRect.height - 10}px`;
    }
    
    // 调整水平位置
    if (tooltipRect.right > windowWidth) {
      tooltip.style.left = 'auto';
      tooltip.style.right = '10px';
    }
  },

  /**
   * 获取属性名称
   * @param {string} key 属性键名
   * @returns {string} 属性名称
   */
  getAttributeName(key) {
    const attrMap = {
      hp: '生命值',
      phy_atk: '物理攻击',
      phy_def: '物理防御',
      mp: '蓝量',
      mag_def: '魔法防御',
      mag_atk: '魔法攻击',
      hit_rate: '命中',
      dodge_rate: '闪避',
      crit_rate: '暴击'
    };
    return attrMap[key] || key;
  },

  /**
   * 初始化样式
   */
  initStyles() {
    // 检查样式是否已存在
    if (document.getElementById('tooltip-styles')) {
      return;
    }
    
    // 创建样式元素
    const style = document.createElement('style');
    style.id = 'tooltip-styles';
    style.textContent = `
      .common-tooltip {
        background: rgba(10, 10, 20, 0.95);
        border: 1px solid #555;
        border-radius: 4px;
        padding: 10px 14px;
        min-width: 180px;
        max-width: 280px;
        box-shadow: 0 2px 12px rgba(0,0,0,0.6);
        color: #ffffff;
        font-size: 13px;
        line-height: 1.6;
      }

      .tooltip-title {
        font-size: 15px;
        font-weight: bold;
        color: #ffcc00;
        margin-bottom: 6px;
      }

      .tooltip-meta {
        font-size: 12px;
        color: #a0aec0;
        margin-bottom: 2px;
      }

      .tooltip-enhance-lv {
        color: #48bb78;
        font-weight: bold;
      }

      .tooltip-attr {
        display: flex;
        justify-content: space-between;
        margin: 2px 0;
        font-size: 13px;
      }

      .tooltip-attr-name {
        color: #b0b0b0;
      }

      .tooltip-attr-value {
        color: #ffffff;
        font-weight: 500;
      }

      .tooltip-divider {
        border-top: 1px solid #333;
        margin: 5px 0 3px;
      }

      .tooltip-effect {
        margin: 2px 0;
        font-size: 13px;
      }

      .tooltip-count {
        margin-top: 6px;
        padding-top: 6px;
        border-top: 1px solid #333;
        font-size: 12px;
        color: #66ccff;
      }
    `;
    
    // 添加到文档
    document.head.appendChild(style);
  }
};

// 初始化样式
Tooltip.initStyles();
