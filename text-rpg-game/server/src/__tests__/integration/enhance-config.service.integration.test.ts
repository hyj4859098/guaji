/**
 * EnhanceConfigService 集成测试 - getEnhanceMaterialIds、getEnhanceMaterialIdList
 */
import { getEnhanceMaterialIds, getEnhanceMaterialIdList } from '../../service/enhance-config.service';
import { dataStorageService } from '../../service/data-storage.service';

describe('EnhanceConfigService 集成测试', () => {
  it('getEnhanceMaterialIds 返回有效配置', async () => {
    const ids = await getEnhanceMaterialIds();
    expect(ids).toHaveProperty('stone');
    expect(ids).toHaveProperty('lucky');
    expect(ids).toHaveProperty('anti_explode');
    expect(ids).toHaveProperty('blessing_oil');
    expect(typeof ids.stone).toBe('number');
  });

  it('getEnhanceMaterialIdList 返回数组', async () => {
    const list = await getEnhanceMaterialIdList();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBe(4);
  });

  it('getEnhanceMaterialIds 配置无效时返回 DEFAULT', async () => {
    const row = await dataStorageService.getByCondition('config', { name: 'enhance_materials' });
    if (!row) return;
    const orig = row.value;
    try {
      await dataStorageService.update('config', row.id, { value: 'invalid json {{{' });
      const ids = await getEnhanceMaterialIds();
      expect(ids.stone).toBe(6);
      expect(ids.lucky).toBe(8);
    } finally {
      await dataStorageService.update('config', row.id, { value: orig });
    }
  });

  it('getEnhanceMaterialIds 配置缺失时使用默认值', async () => {
    const ids = await getEnhanceMaterialIds();
    expect(typeof ids.stone).toBe('number');
    expect(typeof ids.lucky).toBe('number');
    expect(typeof ids.anti_explode).toBe('number');
    expect(typeof ids.blessing_oil).toBe('number');
    expect(ids.stone).toBeGreaterThan(0);
  });
});

describe('关键路径/深度分支', () => {
  it('getEnhanceMaterialIds 无效 JSON 返回默认值', async () => {
    const existing = await dataStorageService.getByCondition('config', { name: 'enhance_materials' });
    const origValue = existing?.value;
    if (existing) {
      await dataStorageService.update('config', existing.id, { value: 'not-json{{' });
    } else {
      await dataStorageService.insert('config', { name: 'enhance_materials', value: 'not-json{{' });
    }
    const ids = await getEnhanceMaterialIds();
    expect(ids.stone).toBe(6);
    expect(ids.lucky).toBe(8);
    if (existing) {
      await dataStorageService.update('config', existing.id, { value: origValue });
    } else {
      const row = await dataStorageService.getByCondition('config', { name: 'enhance_materials' });
      if (row) await dataStorageService.delete('config', row.id);
    }
  });

  it('getEnhanceMaterialIds 部分字段缺失用默认', async () => {
    const existing = await dataStorageService.getByCondition('config', { name: 'enhance_materials' });
    const origValue = existing?.value;
    const partial = JSON.stringify({ stone: 99 });
    if (existing) {
      await dataStorageService.update('config', existing.id, { value: partial });
    } else {
      await dataStorageService.insert('config', { name: 'enhance_materials', value: partial });
    }
    const ids = await getEnhanceMaterialIds();
    expect(ids.stone).toBe(99);
    expect(ids.lucky).toBe(8);
    expect(ids.anti_explode).toBe(7);
    expect(ids.blessing_oil).toBe(10);
    if (existing) {
      await dataStorageService.update('config', existing.id, { value: origValue });
    } else {
      const row = await dataStorageService.getByCondition('config', { name: 'enhance_materials' });
      if (row) await dataStorageService.delete('config', row.id);
    }
  });
});
