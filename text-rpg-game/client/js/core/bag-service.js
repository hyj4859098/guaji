/**
 * 背包 API 封装，统一调用入口
 * 统一格式：{ items: [], equipment_count: 0, equipment_capacity: 100 }
 */
const BagService = {
  /**
   * 解析背包数据为统一格式（仅支持新格式对象）
   * @param {Object} raw - API/WS 返回的 { items, equipment_count, equipment_capacity }
   * @returns {{ items: Array, equipment_count: number, equipment_capacity: number }}
   */
  parseBagPayload(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return { items: [], equipment_count: 0, equipment_capacity: 100 };
    }
    return {
      items: raw.items ?? [],
      equipment_count: raw.equipment_count ?? 0,
      equipment_capacity: raw.equipment_capacity ?? 100
    };
  },

  async fetchList() {
    const res = await API.get('/bag/list');
    if (res.code === 0 && res.data != null) {
      res.data = this.parseBagPayload(res.data);
    }
    return res;
  },

  async useItem(id, count = 1) {
    return API.post('/bag/use', { id, count });
  },

  async wearItem(id) {
    return API.post('/bag/wear', { id });
  },

  async deleteItem(id) {
    return API.post('/bag/delete', { id });
  },

  async clearAllEquipment() {
    return API.post('/bag/clear-equipment');
  }
};
