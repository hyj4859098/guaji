/**
 * 背包 API 封装，统一调用入口
 */
const BagService = {
  async fetchList() {
    return API.get('/bag/list');
  },

  async useItem(id, count = 1) {
    return API.post('/bag/use', { id, count });
  },

  async wearItem(id) {
    return API.post('/bag/wear', { id });
  },

  async deleteItem(id) {
    return API.post('/bag/delete', { id });
  }
};
