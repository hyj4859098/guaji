import { dataStorageService, TxCtx } from '../service/data-storage.service';
import { Player } from '../types/player';
import { IBaseModel, Id, Uid } from '../types/index';
import { Collections } from '../config/collections';

export class PlayerModel implements IBaseModel<Player> {
  async get(id: Id, ctx?: TxCtx): Promise<Player | null> {
    return await dataStorageService.getById(Collections.PLAYER, id, ctx);
  }

  async listByUid(uid: Uid, ctx?: TxCtx): Promise<Player[]> {
    let list = await dataStorageService.list<Player>(Collections.PLAYER, { uid }, ctx);
    if (list.length === 0 && uid != null) {
      if (typeof uid === 'number') {
        list = await dataStorageService.list<Player>(Collections.PLAYER, { uid: String(uid) }, ctx);
      } else if (typeof uid === 'string' && !Number.isNaN(Number(uid))) {
        list = await dataStorageService.list<Player>(Collections.PLAYER, { uid: Number(uid) }, ctx);
      }
    }
    if (list.length === 0 && typeof uid === 'string' && /^[a-f0-9]{24}$/i.test(uid)) {
      const orphans = await dataStorageService.list<Player>(Collections.PLAYER, {
        $or: [{ uid: null }, { uid: { $exists: false } }]
      } as any, ctx);
      if (orphans.length === 1) {
        await dataStorageService.update(Collections.PLAYER, orphans[0].id, { uid } as any);
        list = await dataStorageService.list<Player>(Collections.PLAYER, { uid }, ctx);
      }
    }
    return list;
  }

  async insert(data: any, ctx?: TxCtx): Promise<Id> {
    const insertData = {
      ...data,
      level: data.level || 1,
      exp: data.exp || 0,
      hp: data.hp || 100,
      max_hp: data.max_hp || 100,
      mp: data.mp || 50,
      max_mp: data.max_mp || 50,
      gold: data.gold ?? 100,
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
    return await dataStorageService.insert(Collections.PLAYER, insertData as any, ctx);
  }

  async update(id: Id, data: Partial<Player>, ctx?: TxCtx): Promise<boolean> {
    return await dataStorageService.update(Collections.PLAYER, id, data as any, ctx);
  }

  async delete(id: Id, ctx?: TxCtx): Promise<boolean> {
    return await dataStorageService.delete(Collections.PLAYER, id, ctx);
  }
}
