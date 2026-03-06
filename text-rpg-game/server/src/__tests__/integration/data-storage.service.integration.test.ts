/**
 * DataStorageService 集成测试 - 覆盖 updateByFilter、batchInsert、deleteMany
 */
import { dataStorageService } from '../../service/data-storage.service';
import { getCollection } from '../../config/db';

const TEST_COL = `_test_ds_${Date.now()}`;

describe('DataStorageService 集成测试', () => {
  afterAll(async () => {
    try {
      await getCollection(TEST_COL).drop();
    } catch {
      /* ignore */
    }
  });

  it('updateByFilter 按条件更新', async () => {
    const id = await dataStorageService.insert(TEST_COL, { name: 'a', val: 1 });
    const before = await dataStorageService.getById(TEST_COL, id);
    expect(before.val).toBe(1);

    const ok = await dataStorageService.updateByFilter(TEST_COL, { id }, { val: 2 });
    expect(ok).toBe(true);
    const after = await dataStorageService.getById(TEST_COL, id);
    expect(after.val).toBe(2);
  });

  it('batchInsert 批量插入返回 ID 列表', async () => {
    const ids = await dataStorageService.batchInsert(TEST_COL, [
      { name: 'b1', x: 1 },
      { name: 'b2', x: 2 },
    ]);
    expect(ids).toHaveLength(2);
    expect(ids[0]).toBeDefined();
    expect(ids[1]).toBeDefined();

    const list = await dataStorageService.list(TEST_COL, { name: 'b1' });
    expect(list.length).toBe(1);
    expect(list[0].x).toBe(1);
  });

  it('batchInsert 空数组返回空', async () => {
    const ids = await dataStorageService.batchInsert(TEST_COL, []);
    expect(ids).toEqual([]);
  });

  it('deleteMany 按条件删除', async () => {
    await dataStorageService.insert(TEST_COL, { tag: 'del', v: 1 });
    await dataStorageService.insert(TEST_COL, { tag: 'del', v: 2 });
    const n = await dataStorageService.deleteMany(TEST_COL, { tag: 'del' });
    expect(n).toBe(2);
    const remain = await dataStorageService.list(TEST_COL, { tag: 'del' });
    expect(remain).toHaveLength(0);
  });
});
