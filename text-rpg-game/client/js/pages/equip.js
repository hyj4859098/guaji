const EquipPage = {
  equips: [],

  render() {
    const equipSlots = document.getElementById('equipSlots');
    if (!equipSlots) return;
    
    // 部位顺序与服务器一致：1武器 2衣服 3腰带 4裤子 5鞋子 6戒指 7项链 8坐骑
    const slots = [
      { pos: 1, name: '武器' },
      { pos: 2, name: '衣服' },
      { pos: 3, name: '腰带' },
      { pos: 4, name: '裤子' },
      { pos: 5, name: '鞋子' },
      { pos: 6, name: '戒指' },
      { pos: 7, name: '项链' },
      { pos: 8, name: '坐骑' }
    ];

    this._equipSlots = slots.map(slot => ({ slot, equip: this.equips.find(e => e.pos === slot.pos) }));
    equipSlots.innerHTML = `
      ${this._equipSlots.map(({ slot, equip }, index) => `
          <div class="equip-slot">
            <div class="equip-slot-name">${slot.name}</div>
            <div class="equip-slot-item ${equip ? 'equipped' : ''}" ${equip ? `onmouseenter="EquipPage.showEquipTooltip(event, ${index})" onmouseleave="Tooltip.hide()"` : ''}>
              ${equip ? equip.name : '空'}
            </div>
            ${equip ? `
              <div class="equip-actions">
                <button class="equip-btn remove" onclick="EquipPage.removeEquip('${equip.equipment_uid || equip.id}')">卸下</button>
              </div>
            ` : ''}
          </div>
        `).join('')}
    `;
  },

  showEquipTooltip(event, index) {
    const { equip } = this._equipSlots?.[index] || {};
    if (equip) Tooltip.showForItem(event, equip);
  },

  async load() {
    const result = await API.get('/equip/list');

    if (result.code === 0) {
      this.equips = result.data;
      // 后端API现在已经返回装备的名称和效果，不需要单独请求
      this.render();
    } else {
      UI.showToast('加载装备失败');
    }
  },

  async wearEquip(equipId) {
    const result = await API.post('/equip/wear', { id: equipId });

    if (result.code === 0) {
      UI.showToast('穿戴成功');
    } else {
      UI.showToast(result.msg || '穿戴失败');
    }
  },

  async removeEquip(equipId) {
    const result = await API.post('/equip/remove', { id: equipId });

    if (result.code === 0) {
      UI.showToast('卸下成功');
    } else {
      UI.showToast(result.msg || '卸下失败');
    }
  }
};