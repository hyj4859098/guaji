import { dataStorageService } from '../service/data-storage.service';
import { Player } from '../types/player';
import { IBaseModel, Id, Uid } from '../types/index';

export class PlayerModel implements IBaseModel<Player> {
  async get(id: Id, ctx?: any): Promise<Player | null> {
    return await dataStorageService.getById('player', id, ctx);
  }

  async listByUid(uid: Uid, ctx?: any): Promise<Player[]> {
    let list = await dataStorageService.list('player', { uid }, ctx);
    // 兼容 DB 中 uid 存成字符串或数字不一致的情况
    if (list.length === 0 && uid != null) {
      if (typeof uid === 'number') {
        list = await dataStorageService.list('player', { uid: String(uid) }, ctx);
      } else if (typeof uid === 'string' && !Number.isNaN(Number(uid))) {
        list = await dataStorageService.list('player', { uid: Number(uid) }, ctx);
      }
    }
    // 老数据：角色可能是用 undefined/null 的 uid 创建的，用当前 uid（_id 字符串）认领唯一孤儿角色
    if (list.length === 0 && typeof uid === 'string' && /^[a-f0-9]{24}$/i.test(uid)) {
      const orphans = await dataStorageService.list('player', {
        $or: [{ uid: null }, { uid: { $exists: false } }]
      }, ctx);
      if (orphans.length === 1) {
        await dataStorageService.update('player', orphans[0].id, { uid });
        list = await dataStorageService.list('player', { uid }, ctx);
      }
    }
    return list;
  }

  async insert(data: any, ctx?: any): Promise<Id> {
    const insertData = {
      ...data,
      level: data.level || 1,
      exp: data.exp || 0,
      hp: data.hp || 100,
      max_hp: data.max_hp || 100,
      mp: data.mp || 50,
      max_mp: data.max_mp || 50,
      gold: data.gold || 0,
      phy_atk: data.phy_atk || 10,
      mag_atk: data.mag_atk || 10,
      phy_def: data.phy_def || 5,
      mag_def: data.mag_def || 5,
      hit_rate: data.hit_rate || 90,
      dodge_rate: data.dodge_rate || 10,
      crit_rate: data.crit_rate || 20,
      reputation: data.reputation || 0,
      points: data.points ?? 0
    };
    return await dataStorageService.insert('player', insertData, ctx);
  }

  async update(id: Id, data: Partial<Player>, ctx?: any): Promise<boolean> {
    return await dataStorageService.update('player', id, data, ctx);
  }

  async delete(id: Id, ctx?: any): Promise<boolean> {
    return await dataStorageService.delete('player', id, ctx);
  }
}
