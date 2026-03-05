/**
 * 强化/祝福材料配置 - 从 config 表读取，避免硬编码 item_id
 */
import { dataStorageService } from './data-storage.service';

export interface EnhanceMaterialIds {
  stone: number;
  lucky: number;
  anti_explode: number;
  blessing_oil: number;
}

const DEFAULT: EnhanceMaterialIds = {
  stone: 6,
  lucky: 8,
  anti_explode: 7,
  blessing_oil: 10,
};

/** 获取强化材料 item_id 配置 */
export async function getEnhanceMaterialIds(): Promise<EnhanceMaterialIds> {
  const row = await dataStorageService.getByCondition('config', { name: 'enhance_materials' });
  if (!row || !row.value) return DEFAULT;
  try {
    const parsed = JSON.parse(row.value) as Partial<EnhanceMaterialIds>;
    return {
      stone: typeof parsed.stone === 'number' ? parsed.stone : DEFAULT.stone,
      lucky: typeof parsed.lucky === 'number' ? parsed.lucky : DEFAULT.lucky,
      anti_explode: typeof parsed.anti_explode === 'number' ? parsed.anti_explode : DEFAULT.anti_explode,
      blessing_oil: typeof parsed.blessing_oil === 'number' ? parsed.blessing_oil : DEFAULT.blessing_oil,
    };
  } catch {
    return DEFAULT;
  }
}

/** 材料 ID 数组（用于前端过滤背包） */
export async function getEnhanceMaterialIdList(): Promise<number[]> {
  const ids = await getEnhanceMaterialIds();
  return [ids.stone, ids.anti_explode, ids.lucky, ids.blessing_oil];
}
