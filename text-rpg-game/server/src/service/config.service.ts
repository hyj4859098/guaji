/**
 * 配置管理服务
 * 统一管理游戏配置，支持从文件和数据库加载配置
 */
import * as fs from 'fs';
import * as path from 'path';
import { dataStorageService } from './data-storage.service';
import { logger } from '../utils/logger';

interface ConfigCache {
  [key: string]: any;
}

export class ConfigService {
  private configCache: ConfigCache = {};
  private configDir: string;

  constructor() {
    // 配置文件目录
    this.configDir = path.join(__dirname, '../config/data');
    // 确保配置目录存在
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }
    // 初始化加载配置
    this.loadConfigFiles();
  }

  /**
   * 加载配置文件
   */
  private loadConfigFiles(): void {
    try {
      const files = fs.readdirSync(this.configDir);
      files.forEach(file => {
        if (file.endsWith('.json')) {
          const filePath = path.join(this.configDir, file);
          const configName = file.replace('.json', '');
          try {
            const configData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            this.configCache[configName] = configData;
            logger.info(`加载配置文件成功: ${file}`);
          } catch (error) {
            logger.error(`加载配置文件失败: ${file}`, { error: error instanceof Error ? error.message : String(error) });
          }
        }
      });
    } catch (error) {
      logger.error('加载配置文件目录失败', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  /**
   * 从数据库加载配置
   * @param configName 配置名称
   */
  private async loadConfigFromDb(configName: string): Promise<void> {
    try {
      const config = await dataStorageService.getByCondition('config', { name: configName });
      if (config) {
        this.configCache[configName] = JSON.parse(config.value);
        logger.info(`从数据库加载配置成功: ${configName}`);
      }
    } catch (error) {
      logger.error(`从数据库加载配置失败: ${configName}`, { error: error instanceof Error ? error.message : String(error) });
    }
  }

  /**
   * 获取配置
   * @param configName 配置名称
   * @param defaultValue 默认值（可选）
   * @returns 配置值
   */
  get<T>(configName: string, defaultValue?: T): T {
    if (this.configCache[configName] !== undefined) {
      return this.configCache[configName] as T;
    }
    return defaultValue as T;
  }

  /**
   * 设置配置
   * @param configName 配置名称
   * @param value 配置值
   */
  set(configName: string, value: any): void {
    this.configCache[configName] = value;
  }

  /**
   * 保存配置到文件
   * @param configName 配置名称
   */
  saveToFile(configName: string): void {
    try {
      const filePath = path.join(this.configDir, `${configName}.json`);
      fs.writeFileSync(filePath, JSON.stringify(this.configCache[configName], null, 2));
      logger.info(`保存配置到文件成功: ${configName}`);
    } catch (error) {
      logger.error(`保存配置到文件失败: ${configName}`, { error: error instanceof Error ? error.message : String(error) });
    }
  }

  /**
   * 保存配置到数据库
   * @param configName 配置名称
   */
  async saveToDb(configName: string): Promise<void> {
    try {
      const configValue = JSON.stringify(this.configCache[configName]);
      
      // 检查配置是否存在
      const existingConfig = await dataStorageService.getByCondition('config', { name: configName });
      
      if (existingConfig) {
        // 更新现有配置
        await dataStorageService.update('config', existingConfig.id, {
          value: configValue,
          update_time: Math.floor(Date.now() / 1000)
        });
      } else {
        // 插入新配置
        await dataStorageService.insert('config', {
          name: configName,
          value: configValue
        });
      }
      
      logger.info(`保存配置到数据库成功: ${configName}`);
    } catch (error) {
      logger.error(`保存配置到数据库失败: ${configName}`, { error: error instanceof Error ? error.message : String(error) });
    }
  }

  /**
   * 刷新配置
   * @param configName 配置名称（可选，不指定则刷新所有配置）
   */
  async refresh(configName?: string): Promise<void> {
    if (configName) {
      // 刷新指定配置
      await this.loadConfigFromDb(configName);
    } else {
      // 刷新所有配置
      this.loadConfigFiles();
      // 从数据库加载配置
      const configs = await dataStorageService.list('config');
      configs.forEach(config => {
        try {
          this.configCache[config.name] = JSON.parse(config.value);
        } catch (error) {
          logger.error(`解析配置失败: ${config.name}`, { error: error instanceof Error ? error.message : String(error) });
        }
      });
    }
    logger.info('配置刷新成功');
  }

  /**
   * 获取技能配置
   * @param skillId 技能ID
   * @returns 技能配置
   */
  getSkillConfig(skillId: number): any {
    const skillsConfig = this.get('skills', {});
    return (skillsConfig as Record<number, any>)[skillId] || null;
  }

  /**
   * 获取怪物配置
   * @param monsterId 怪物ID
   * @returns 怪物配置
   */
  getMonsterConfig(monsterId: number): any {
    const monstersConfig = this.get('monsters', {});
    return (monstersConfig as Record<number, any>)[monsterId] || null;
  }

  /**
   * 获取物品配置
   * @param itemId 物品ID
   * @returns 物品配置
   */
  getItemConfig(itemId: number): any {
    const itemsConfig = this.get('items', {});
    return (itemsConfig as Record<number, any>)[itemId] || null;
  }
}

// 导出单例实例
export const configService = new ConfigService();
