/**
 * 服务注册表 — 延迟单例
 *
 * 所有无状态 service 统一在此按需创建，全局共享一个实例。
 * 消除散落各处的 `new XxxService()` 和 `await import(...)` 动态加载。
 */

import type { PlayerService } from './player.service';
import type { BagService } from './bag.service';
import type { EquipService } from './equip.service';
import type { EquipInstanceService } from './equip_instance.service';

class ServiceRegistry {
  private _player?: PlayerService;
  private _bag?: BagService;
  private _equip?: EquipService;
  private _equipInstance?: EquipInstanceService;

  get player(): PlayerService {
    if (!this._player) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { PlayerService } = require('./player.service');
      this._player = new PlayerService();
    }
    return this._player!;
  }

  get bag(): BagService {
    if (!this._bag) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { BagService } = require('./bag.service');
      this._bag = new BagService();
    }
    return this._bag!;
  }

  get equip(): EquipService {
    if (!this._equip) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { EquipService } = require('./equip.service');
      this._equip = new EquipService();
    }
    return this._equip!;
  }

  get equipInstance(): EquipInstanceService {
    if (!this._equipInstance) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { EquipInstanceService } = require('./equip_instance.service');
      this._equipInstance = new EquipInstanceService();
    }
    return this._equipInstance!;
  }

  /** Reset all instances (for testing) */
  reset(): void {
    this._player = undefined;
    this._bag = undefined;
    this._equip = undefined;
    this._equipInstance = undefined;
  }
}

export const services = new ServiceRegistry();
