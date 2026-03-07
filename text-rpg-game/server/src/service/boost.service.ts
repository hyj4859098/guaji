import { PlayerService } from './player.service';
import { dataStorageService } from './data-storage.service';
import { isBoostCard } from '../utils/item-type';
import { logger } from '../utils/logger';
import { Uid } from '../types/index';
import { Collections } from '../config/collections';
import {
  BoostConfig, BoostCategoryKey, BoostMultiplierKey,
  BOOST_MULTIPLIER_VALUES, getDefaultBoostConfig,
} from '../types/player';

export interface BoostMultipliers {
  exp: number;
  gold: number;
  drop: number;
  reputation: number;
}

const VALID_CATEGORIES: BoostCategoryKey[] = ['exp', 'gold', 'drop', 'reputation'];
const VALID_MULTIPLIERS: BoostMultiplierKey[] = ['x2', 'x4', 'x8'];

export class BoostService {
  private playerService = new PlayerService();

  async getBoostConfig(uid: Uid): Promise<BoostConfig> {
    const players = await this.playerService.list(uid);
    if (!players.length) return getDefaultBoostConfig();
    return players[0].boost_config || getDefaultBoostConfig();
  }

  async useBoostCard(uid: Uid, itemId: number, count: number = 1): Promise<boolean> {
    const itemInfo = await dataStorageService.getByCondition(Collections.ITEM, { id: itemId });
    if (!itemInfo || !isBoostCard(itemInfo)) return false;

    const category = itemInfo.boost_category as BoostCategoryKey;
    const mult = itemInfo.boost_multiplier as number;
    const chargesPerCard = itemInfo.boost_charges as number || 100;

    if (!VALID_CATEGORIES.includes(category)) return false;
    const key = `x${mult}` as BoostMultiplierKey;
    if (!VALID_MULTIPLIERS.includes(key)) return false;

    const players = await this.playerService.list(uid);
    if (!players.length) return false;

    const config = players[0].boost_config || getDefaultBoostConfig();
    const addedCharges = chargesPerCard * count;
    config[category][key].charges += addedCharges;

    await this.playerService.update(players[0].id, { boost_config: config } as any);
    logger.info('多倍卡使用成功', { uid, category, multiplier: mult, count, addedCharges });
    return true;
  }

  async toggleBoost(uid: Uid, category: BoostCategoryKey, multiplier: BoostMultiplierKey, enabled: boolean): Promise<boolean> {
    if (!VALID_CATEGORIES.includes(category) || !VALID_MULTIPLIERS.includes(multiplier)) return false;

    const players = await this.playerService.list(uid);
    if (!players.length) return false;

    const config = players[0].boost_config || getDefaultBoostConfig();
    config[category][multiplier].enabled = enabled;

    await this.playerService.update(players[0].id, { boost_config: config } as any);
    return true;
  }

  async consumeCharges(uid: Uid): Promise<void> {
    const players = await this.playerService.list(uid);
    if (!players.length) return;

    const config = players[0].boost_config;
    if (!config) return;

    let changed = false;
    for (const cat of VALID_CATEGORIES) {
      for (const mul of VALID_MULTIPLIERS) {
        const slot = config[cat][mul];
        if (slot.enabled && slot.charges > 0) {
          slot.charges--;
          if (slot.charges <= 0) slot.enabled = false;
          changed = true;
        }
      }
    }

    if (changed) {
      await this.playerService.update(players[0].id, { boost_config: config } as any);
    }
  }

  static calcMultipliers(config: BoostConfig | null | undefined): BoostMultipliers {
    const result: BoostMultipliers = { exp: 1, gold: 1, drop: 1, reputation: 1 };
    if (!config) return result;

    for (const cat of VALID_CATEGORIES) {
      for (const mul of VALID_MULTIPLIERS) {
        const slot = config[cat][mul];
        if (slot.enabled && slot.charges > 0) {
          result[cat] *= BOOST_MULTIPLIER_VALUES[mul];
        }
      }
    }
    return result;
  }

  static calcMultipliersFromMemory(config: BoostConfig): BoostMultipliers {
    return BoostService.calcMultipliers(config);
  }

  static consumeChargesInMemory(config: BoostConfig): void {
    for (const cat of VALID_CATEGORIES) {
      for (const mul of VALID_MULTIPLIERS) {
        const slot = config[cat][mul];
        if (slot.enabled && slot.charges > 0) {
          slot.charges--;
          if (slot.charges <= 0) slot.enabled = false;
        }
      }
    }
  }
}
