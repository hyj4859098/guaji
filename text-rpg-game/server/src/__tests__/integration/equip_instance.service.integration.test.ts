/**
 * EquipInstanceService 集成测试 - 真实 DB，无 mock
 * 覆盖 createFromBase、createFromDrop、buildEquipAttrs、buildBaseAttrs、getEquipLevel、buildBlessingEffects
 */
import request from 'supertest';
import { createApp } from '../../create-app';
import { createTestUser, giveItem } from '../../__test-utils__/integration-helpers';
import { EquipInstanceService } from '../../service/equip_instance.service';
import { EquipService } from '../../service/equip.service';
import { BagService } from '../../service/bag.service';
import { dataStorageService } from '../../service/data-storage.service';
import { enrichEquipDetail, enrichEquipFromBase } from '../../utils/enrich-equip';

const app = createApp();
const UNIQUE = `_ei_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
const UNIQUE2 = `_ei2_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

describe('EquipInstanceService 集成测试', () => {
  let uid: number;
  let uid2: number;
  const equipInstanceService = new EquipInstanceService();
  const bagService = new BagService();

  beforeAll(async () => {
    const reg = await request(app).post('/api/user/register').send({ username: UNIQUE, password: 'test123456' });
    const reg2 = await request(app).post('/api/user/register').send({ username: UNIQUE2, password: 'test123456' });
    if (reg.body.code !== 0) throw new Error('注册失败');
    if (reg2.body.code !== 0) throw new Error('注册失败');
    uid = reg.body.data.uid;
    uid2 = reg2.body.data.uid;
    await request(app).post('/api/player/add').set('Authorization', `Bearer ${reg.body.data.token}`).send({ name: '装备实例测试' });
    await request(app).post('/api/player/add').set('Authorization', `Bearer ${reg2.body.data.token}`).send({ name: '装备实例测试2' });
  }, 10000);

  describe('createFromBase', () => {
    it('创建装备实例成功', async () => {
      const id = await equipInstanceService.createFromBase(uid, 13);
      expect(id).not.toBeNull();
      expect(typeof id).toBe('number');
    });

    it('不存在的 equip_base 返回 null', async () => {
      const id = await equipInstanceService.createFromBase(uid, 99999);
      expect(id).toBeNull();
    });
  });

  describe('createFromDrop', () => {
    it('从掉落创建装备实例（主属性浮动）', async () => {
      const id = await equipInstanceService.createFromDrop(uid, 13);
      expect(id).not.toBeNull();
      const instance = await equipInstanceService.get(id!);
      expect(instance).not.toBeNull();
      expect(instance?.main_value).toBeDefined();
    });
  });

  describe('buildEquipAttrs / buildBaseAttrs / getEquipLevel', () => {
    it('buildEquipAttrs 返回完整属性', async () => {
      await bagService.addItem(uid, 13, 1);
      const list = await bagService.list(uid);
      const equip = list.find((i: any) => i.item_id === 13 && i.equipment_uid);
      expect(equip).toBeDefined();
      const instance = await equipInstanceService.get(Number(equip!.equipment_uid));
      expect(instance).not.toBeNull();
      const attrs = await equipInstanceService.buildEquipAttrs(instance!);
      expect(attrs).toHaveProperty('phy_atk');
      expect(attrs).toHaveProperty('phy_def');
      expect(typeof attrs.phy_atk).toBe('number');
    });

    it('buildBaseAttrs 返回基础属性', async () => {
      const list = await bagService.list(uid);
      const equip = list.find((i: any) => i.item_id === 13 && i.equipment_uid);
      expect(equip).toBeDefined();
      const instance = await equipInstanceService.get(Number(equip!.equipment_uid));
      const base = await equipInstanceService.buildBaseAttrs(instance!);
      expect(base).toHaveProperty('phy_atk');
      expect(typeof base.phy_atk).toBe('number');
    });

    it('getEquipLevel 返回需求等级', async () => {
      const list = await bagService.list(uid);
      const equip = list.find((i: any) => i.item_id === 13 && i.equipment_uid);
      expect(equip).toBeDefined();
      const instance = await equipInstanceService.get(Number(equip!.equipment_uid));
      const level = await equipInstanceService.getEquipLevel(instance!);
      expect(level).toBeGreaterThanOrEqual(1);
    });
  });

  describe('buildBlessingEffects', () => {
    it('无祝福等级返回空数组', async () => {
      const list = await bagService.list(uid);
      const equip = list.find((i: any) => i.item_id === 13 && i.equipment_uid);
      expect(equip).toBeDefined();
      const instance = await equipInstanceService.get(Number(equip!.equipment_uid));
      const effects = await equipInstanceService.buildBlessingEffects(instance!);
      expect(Array.isArray(effects)).toBe(true);
      expect(effects.length).toBe(0);
    });

    it('有祝福等级返回祝福效果', async () => {
      const id = await equipInstanceService.createFromBase(uid, 13);
      if (!id) return;
      const { dataStorageService } = await import('../../service/data-storage.service');
      await dataStorageService.update('equip_instance', id, { blessing_level: 1 });
      const instance = await equipInstanceService.get(id);
      expect(instance).not.toBeNull();
      const effects = await equipInstanceService.buildBlessingEffects(instance!);
      expect(Array.isArray(effects)).toBe(true);
      expect(effects.length).toBeGreaterThan(0);
    });
  });

  describe('get / deleteInstance', () => {
    it('get 不存在的实例返回 null', async () => {
      const instance = await equipInstanceService.get(999999);
      expect(instance).toBeNull();
    });

    it('deleteInstance 不存在的返回 false', async () => {
      const ok = await equipInstanceService.deleteInstance(999999);
      expect(ok).toBe(false);
    });

    it('deleteInstance 存在的实例删除成功', async () => {
      const id = await equipInstanceService.createFromBase(uid, 13);
      if (id) {
        const ok = await equipInstanceService.deleteInstance(id);
        expect(ok).toBe(true);
      }
    });
  });

  describe('transferOwnership / tradeToUser', () => {
    it('transferOwnership 不存在的实例返回 false', async () => {
      const ok = await equipInstanceService.transferOwnership(999999, uid);
      expect(ok).toBe(false);
    });

    it('tradeToUser 卖家背包有装备时交易成功', async () => {
      const list = await bagService.list(uid);
      const equip = list.find((i: any) => i.item_id === 13 && i.equipment_uid);
      expect(equip).toBeDefined();
      const instanceId = Number(equip!.equipment_uid);
      const ok = await equipInstanceService.tradeToUser(uid, uid2, instanceId);
      expect(ok).toBe(true);
      const inst = await equipInstanceService.get(instanceId);
      expect(inst?.uid).toBe(uid2);
      const buyerBag = await bagService.list(uid2);
      expect(buyerBag.some((b: any) => b.equipment_uid === String(instanceId))).toBe(true);
    });

    it('transferOwnership 存在实例转移给他人返回 true', async () => {
      await bagService.addItem(uid, 13, 1);
      const list = await bagService.list(uid);
      const equip = list.find((i: any) => i.item_id === 13 && i.equipment_uid);
      expect(equip).toBeDefined();
      const instanceId = Number(equip!.equipment_uid);
      const ok = await equipInstanceService.transferOwnership(instanceId, uid2);
      expect(ok).toBe(true);
      const inst = await equipInstanceService.get(instanceId);
      expect(inst?.uid).toBe(uid2);
    });

    it('tradeToUser 卖家不匹配返回 false', async () => {
      const list = await bagService.list(uid);
      const equip = list.find((i: any) => i.item_id === 13 && i.equipment_uid);
      if (equip) {
        const instanceId = Number(equip.equipment_uid);
        const ok = await equipInstanceService.tradeToUser(999999, uid, instanceId);
        expect(ok).toBe(false);
      }
    });

    it('tradeToUser 实例不存在返回 false', async () => {
      const ok = await equipInstanceService.tradeToUser(uid, uid2, 999999);
      expect(ok).toBe(false);
    });

    it('tradeToUser 实例属于买家时卖家不匹配返回 false', async () => {
      const list = await bagService.list(uid2);
      const equip = list.find((i: any) => i.item_id === 13 && i.equipment_uid);
      if (equip) {
        const instanceId = Number(equip.equipment_uid);
        const ok = await equipInstanceService.tradeToUser(uid, uid2, instanceId);
        expect(ok).toBe(false);
      }
    });
  });

  describe('createFromDrop', () => {
    it('createFromDrop 不存在的 item 返回 null', async () => {
      const id = await equipInstanceService.createFromDrop(uid, 99999);
      expect(id).toBeNull();
    });
  });

  describe('destroyOnEnhanceFail', () => {
    it('destroyOnEnhanceFail 实例不存在返回 false', async () => {
      const ok = await equipInstanceService.destroyOnEnhanceFail(999999, uid);
      expect(ok).toBe(false);
    });

    it('destroyOnEnhanceFail uid 不匹配返回 false', async () => {
      const id = await equipInstanceService.createFromBase(uid, 13);
      if (!id) return;
      const ok = await equipInstanceService.destroyOnEnhanceFail(id, uid2);
      expect(ok).toBe(false);
      await equipInstanceService.deleteInstance(id);
    });
  });

  describe('buildEquipAttrs / buildBaseAttrs 边界', () => {
    it('buildEquipAttrs 无 equip_base 返回空对象', async () => {
      const fakeInstance = { item_id: 99999, pos: 1, main_value: 10, main_value_2: 0, enhance_level: 0, blessing_level: 0 };
      const attrs = await equipInstanceService.buildEquipAttrs(fakeInstance);
      expect(attrs).toEqual({});
    });

    it('buildBaseAttrs 无 equip_base 返回空对象', async () => {
      const fakeInstance = { item_id: 99999, pos: 1 };
      const base = await equipInstanceService.buildBaseAttrs(fakeInstance);
      expect(base).toEqual({});
    });
  });

  it('createFromDrop 非装备物品返回 null', async () => {
    const id = await equipInstanceService.createFromDrop(uid, 1);
    expect(id).toBeNull();
  });

  it('createFromDrop 无 equip_base 返回 null (77777)', async () => {
    const id = await equipInstanceService.createFromDrop(uid, 77777);
    expect(id).toBeNull();
  });

  it('buildEquipAttrs 无 equip_base 返回空对象 (77777)', async () => {
    const fakeInstance = { item_id: 77777, pos: 1, main_value: 10, main_value_2: 0, enhance_level: 0, blessing_level: 0 };
    const attrs = await equipInstanceService.buildEquipAttrs(fakeInstance);
    expect(attrs).toEqual({});
  });

  it('buildBlessingEffects 有祝福等级(3)返回效果列表', async () => {
    const id = await equipInstanceService.createFromBase(uid, 13);
    expect(id).not.toBeNull();
    const { dataStorageService } = await import('../../service/data-storage.service');
    await dataStorageService.update('equip_instance', id!, { blessing_level: 3 });
    const instance = await equipInstanceService.get(id!);
    expect(instance).not.toBeNull();
    const effects = await equipInstanceService.buildBlessingEffects(instance!);
    expect(Array.isArray(effects)).toBe(true);
    expect(effects.length).toBeGreaterThan(0);
    await equipInstanceService.deleteInstance(id!);
  });

  describe('enrichEquipDetail / enrichEquipFromBase', () => {
    it('enrichEquipDetail 返回完整装备属性', async () => {
      await bagService.addItem(uid, 13, 1);
      const list = await bagService.list(uid);
      const equip = list.find((i: any) => i.item_id === 13 && i.equipment_uid);
      if (!equip) return;

      const instanceId = parseInt(String(equip.equipment_uid), 10);
      const instance = await equipInstanceService.get(instanceId);
      if (!instance) return;

      const detail = await enrichEquipDetail(equipInstanceService, instance);
      expect(detail).toHaveProperty('equip_attributes');
      expect(detail).toHaveProperty('base_attributes');
      expect(detail).toHaveProperty('equip_level');
      expect(detail).toHaveProperty('enhance_level');
      expect(detail).toHaveProperty('pos');
    });

    it('enrichEquipFromBase 从 equip_base 构建兜底详情', async () => {
      const equipBase = await dataStorageService.getByCondition('equip_base', { item_id: 13 });
      if (!equipBase) return;

      const detail = enrichEquipFromBase(equipBase);
      expect(detail.equip_attributes).toBeDefined();
      expect(detail.base_attributes).toBeDefined();
      expect(detail.equip_level).toBeGreaterThanOrEqual(1);
      expect(detail.enhance_level).toBe(0);
      expect(detail.blessing_level).toBe(0);
      expect(detail.pos).toBeGreaterThanOrEqual(1);
    });

    it('enrichEquipFromBase 处理空属性', () => {
      const detail = enrichEquipFromBase({});
      expect(detail.equip_attributes.hp).toBe(0);
      expect(detail.equip_attributes.phy_atk).toBe(0);
      expect(detail.equip_level).toBe(1);
      expect(detail.pos).toBe(1);
    });
  });
});

describe('关键路径/深度分支', () => {
  const _equipInstanceService = new EquipInstanceService();
  const _bagService = new BagService();
  const _equipService = new EquipService();

  it('createFromBase 无 equip_base 返回 null（深度分支）', async () => {
    const result = await _equipInstanceService.createFromBase(1, 1);
    expect(result).toBeNull();
  });

  it('destroyOnEnhanceFail 已穿戴装备移除效果', async () => {
    const { uid } = await createTestUser(app, { prefix: 'ds', suffix: 'eiDes' });
    await giveItem(uid, 13, 1);
    const bags = await _bagService.list(uid);
    const equip = bags.find((b: any) => b.item_id === 13 && b.equipment_uid);
    if (!equip) return;
    const instanceId = parseInt(String(equip.equipment_uid), 10);
    await _bagService.wearItem(uid, equip.original_id ?? equip.id, _equipService);
    const destroyed = await _equipInstanceService.destroyOnEnhanceFail(instanceId, uid);
    expect(destroyed).toBe(true);
    const after = await _equipInstanceService.get(instanceId);
    expect(after).toBeNull();
  });

  it('createFromDrop 产生的实例属性在 ±20% 范围内', async () => {
    const { uid } = await createTestUser(app, { prefix: 'r2', suffix: 'dropfl' });
    const equipBase = await dataStorageService.getByCondition('equip_base', { item_id: 13 });
    if (!equipBase) return;

    const results: any[] = [];
    for (let i = 0; i < 10; i++) {
      const instanceId = await _equipInstanceService.createFromDrop(uid, 13);
      if (instanceId) {
        const instance = await _equipInstanceService.get(instanceId);
        if (instance) results.push(instance);
      }
    }

    if (results.length > 0 && equipBase.phy_atk > 0) {
      const base = equipBase.phy_atk;
      const min = base * 0.8;
      const max = base * 1.2;
      for (const inst of results) {
        if (inst.phy_atk != null && inst.phy_atk !== 0) {
          expect(inst.phy_atk).toBeGreaterThanOrEqual(Math.floor(min));
          expect(inst.phy_atk).toBeLessThanOrEqual(Math.ceil(max));
        }
      }
    }
  });
});
