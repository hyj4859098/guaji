import { dataStorageService, TxCtx } from '../service/data-storage.service';
import { Player } from '../types/player';
import { IBaseModel, Id, Uid } from '../types/index';

export class PlayerModel implements IBaseModel<Player> {
  async get(id: Id, ctx?: TxCtx): Promise<Player | null> {
    return await dataStorageService.getById('player', id, ctx);
  }

  async listByUid(uid: Uid, ctx?: TxCtx): Promise<Player[]> {
    let list = await dataStorageService.list<Player>('player', { uid }, ctx);
    if (list.length === 0 && uid != null) {
      if (typeof uid === 'number') {
        list = await dataStorageService.list<Player>('player', { uid: String(uid) }, ctx);
      } else if (typeof uid === 'string' && !Number.isNaN(Number(uid))) {
        list = await dataStorageService.list<Player>('player', { uid: Number(uid) }, ctx);
      }
    }
    if (list.length === 0 && typeof uid === 'string' && /^[a-f0-9]{24}$/i.test(uid)) {
      const orphans = await dataStorageService.list<Player>('player', {
        $or: [{ uid: null }, { uid: { $exists: false } }]
      } as any, ctx);
      if (orphans.length === 1) {
        await dataStorageService.update('player', orphans[0].id, { uid } as any);
        list = await dataStorageService.list<Player>('player', { uid }, ctx);
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
    return await dataStorageService.insert('player', insertData as any, ctx);
  }

  async update(id: Id, data: Partial<Player>, ctx?: TxCtx): Promise<boolean> {
    return await dataStorageService.update('player', id, data as any, ctx);
  }

  async delete(id: Id, ctx?: TxCtx): Promise<boolean> {
    return await dataStorageService.delete('player', id, ctx);
  }
}
