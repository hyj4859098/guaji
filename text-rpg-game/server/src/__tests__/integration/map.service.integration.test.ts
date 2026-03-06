/**
 * MapService 集成测试 - list、get、add、update、delete
 */
import { MapService } from '../../service/map.service';

describe('MapService 集成测试', () => {
  const mapService = new MapService();

  it('list 返回地图列表', async () => {
    const maps = await mapService.list();
    expect(Array.isArray(maps)).toBe(true);
    maps.forEach((m: any) => {
      expect(m).toHaveProperty('id');
      expect(m).toHaveProperty('name');
    });
  });

  it('get 存在的 id 返回地图', async () => {
    const maps = await mapService.list();
    if (maps.length > 0) {
      const first = maps[0];
      const map = await mapService.get(first.id);
      expect(map).not.toBeNull();
      expect(map?.id).toBe(first.id);
      expect(map?.name).toBe(first.name);
    }
  });

  it('add 创建地图', async () => {
    const name = `测试地图_${Date.now()}`;
    const id = await mapService.add({ name });
    expect(typeof id).toBe('number');
    expect(id).toBeGreaterThan(0);

    const map = await mapService.get(id);
    expect(map).not.toBeNull();
    expect(map?.name).toBe(name);

    await mapService.delete(id);
  });

  it('update 更新地图', async () => {
    const name = `更新前_${Date.now()}`;
    const id = await mapService.add({ name });
    const newName = `更新后_${Date.now()}`;
    const ok = await mapService.update(id, { name: newName });
    expect(ok).toBe(true);

    const map = await mapService.get(id);
    expect(map?.name).toBe(newName);

    await mapService.delete(id);
  });

  it('delete 删除地图', async () => {
    const id = await mapService.add({ name: `待删_${Date.now()}` });
    const ok = await mapService.delete(id);
    expect(ok).toBe(true);

    const map = await mapService.get(id);
    expect(map).toBeNull();
  });

  it('get 不存在的 id 返回 null', async () => {
    const map = await mapService.get(99999);
    expect(map).toBeNull();
  });
});
