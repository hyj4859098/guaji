/**
 * 测试用 dataStorageService mock 工厂
 */
export function createMockDataStorage() {
  return {
    list: jest.fn(),
    getById: jest.fn(),
    getByCondition: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    updateByFilter: jest.fn(),
    batchInsert: jest.fn(),
    query: jest.fn(),
    getByIds: jest.fn().mockResolvedValue([]),
    listSorted: jest.fn().mockResolvedValue([]),
    listSortedWithCount: jest.fn().mockResolvedValue({ items: [], total: 0 }),
  };
}
