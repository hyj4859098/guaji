const Helper = {
  /** 物品类型映射（与数据库、GM 一致：1消耗品 2装备 3材料 4道具 5/6多倍/VIP） */
  getItemType(item) {
    const t = item?.type ?? 0;
    if (t === 1) return 'consumable';
    if (t === 2) return 'equipment';
    if (t === 3) return 'material';
    if (t === 4 || t === 5 || t === 6) return 'tool';
    return 'tool';
  },

  formatNumber(num) {
    if (num >= 100000000) {
      return (num / 100000000).toFixed(2) + '亿';
    } else if (num >= 10000) {
      return (num / 10000).toFixed(2) + '万';
    }
    return num.toString();
  },

  formatDate(timestamp) {
    const date = new Date(timestamp * 1000);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    const second = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
  }
};
