/**
 * 玩家服务模块
 * 负责处理玩家相关的业务逻辑
 * 包括玩家信息的增删改查、经验值管理、金币管理和声望管理
 * 使用 Map 内存缓存减轻数据库读写，更新时主动失效保证一致性
 */
import { PlayerModel } from '../model/player.model';
import { Player } from '../types/player';
import { IBaseService, Id, Uid } from '../types/index';
import { LevelExpService } from './level_exp.service';
import { logger } from '../utils/logger';
import { cacheService } from './cache.service';

export class PlayerService implements IBaseService<Player> {
  private model: PlayerModel;
  private levelExpService: LevelExpService;

  /**
   * 构造函数
   * 初始化玩家模型和等级经验服务
   */
  constructor() {
    this.model = new PlayerModel();
    this.levelExpService = new LevelExpService();
  }

  /**
   * 根据ID获取玩家信息
   * @param id 玩家ID
   * @param ctx 事务上下文（可选）
   * @returns 玩家信息或null
   */
  async get(id: Id, ctx?: any): Promise<Player | null> {
    // 直接从数据库获取玩家信息
    return await this.model.get(id, ctx);
  }

  /**
   * 根据用户ID获取玩家列表（带缓存，减轻战斗内频繁读库）
   * @param uid 用户ID
   * @param ctx 事务上下文（可选，事务内不读缓存）
   * @returns 玩家列表
   */
  async list(uid: Uid, ctx?: any): Promise<Player[]> {
    if (!ctx) {
      const cached = cacheService.player.get(uid);
      if (cached) return cached;
    }
    const list = await this.model.listByUid(uid, ctx);
    if (!ctx && list.length > 0) cacheService.player.set(uid, list);
    return list;
  }

  /**
   * 添加新玩家
   * @param data 玩家数据
   * @param ctx 事务上下文（可选）
   * @returns 新玩家ID
   */
  async add(data: Omit<Player, 'id' | 'create_time' | 'update_time'>, ctx?: any): Promise<Id> {
    // 构建新玩家数据
    const newPlayer = {
      ...data,
      create_time: Math.floor(Date.now() / 1000),
      update_time: Math.floor(Date.now() / 1000)
    };
    
    // 直接插入数据库，MongoDB会自动生成ObjectId
    const insertedId = await this.model.insert(newPlayer, ctx);
    
    return insertedId;
  }

  /**
   * 更新玩家信息
   * @param id 玩家ID
   * @param data 玩家数据
   * @param ctx 事务上下文（可选）
   * @returns 是否更新成功
   */
  async update(id: Id, data: Partial<Player>, ctx?: any): Promise<boolean> {
    const ok = await this.model.update(id, data, ctx);
    if (ok && !ctx) cacheService.player.invalidateByPlayerId(id);
    return ok;
  }

  /**
   * 删除玩家
   * @param id 玩家ID
   * @returns 是否删除成功
   */
  async delete(id: Id): Promise<boolean> {
    // 直接从数据库删除
    return await this.model.delete(id);
  }

  /**
   * 为玩家添加经验值
   * @param uid 用户ID
   * @param exp 经验值
   * @param ctx 事务上下文（可选）
   * @returns 是否添加成功
   */
  async addExp(uid: Uid, exp: number, ctx?: any): Promise<boolean> {
    // 从数据库获取玩家信息
    const players = await this.list(uid, ctx);
    if (players.length === 0) return false;
    const player = players[0];

    const newExp = player.exp + exp;
    
    let newLevel = player.level;
    let currentExp = newExp;
    
    while (true) {
      const nextLevelExp = await this.levelExpService.getExpByLevel(newLevel);
      if (!nextLevelExp) break;
      
      if (currentExp >= nextLevelExp.exp) {
        currentExp -= nextLevelExp.exp;
        newLevel++;
      } else {
        break;
      }
    }

    await this.model.update(player.id, { 
      exp: currentExp, 
      level: newLevel,
      update_time: Math.floor(Date.now() / 1000)
    }, ctx);
    if (!ctx) cacheService.player.invalidateByUid(uid);
    return true;
  }

  /**
   * 为玩家添加金币
   * @param uid 用户ID
   * @param gold 金币数量
   * @param ctx 事务上下文（可选）
   * @returns 是否添加成功
   */
  async addGold(uid: Uid, gold: number, ctx?: any): Promise<boolean> {
    // 从数据库获取玩家信息
    const players = await this.list(uid, ctx);
    if (players.length === 0) return false;
    const player = players[0];

    const newGold = player.gold + gold;
    if (newGold < 0) return false;

    await this.model.update(player.id, { 
      gold: newGold,
      update_time: Math.floor(Date.now() / 1000)
    }, ctx);
    if (!ctx) cacheService.player.invalidateByUid(uid);
    return true;
  }

  /**
   * 为玩家添加积分（充值获得，用于积分商店）
   * @param uid 用户ID
   * @param points 积分数量
   * @param ctx 事务上下文（可选）
   * @returns 是否添加成功
   */
  async addPoints(uid: Uid, points: number, ctx?: any): Promise<boolean> {
    const players = await this.list(uid, ctx);
    if (players.length === 0) return false;
    const player = players[0];

    const newPoints = (player.points ?? 0) + points;
    if (newPoints < 0) return false;

    await this.model.update(player.id, {
      points: newPoints,
      update_time: Math.floor(Date.now() / 1000)
    } as any, ctx);
    if (!ctx) cacheService.player.invalidateByUid(uid);
    return true;
  }

  /**
   * 为玩家添加声望
   * @param uid 用户ID
   * @param reputation 声望值
   * @param ctx 事务上下文（可选）
   * @returns 是否添加成功
   */
  async addReputation(uid: Uid, reputation: number, ctx?: any): Promise<boolean> {
    // 从数据库获取玩家信息
    const players = await this.list(uid, ctx);
    if (players.length === 0) return false;
    const player = players[0];

    const newReputation = (player.reputation || 0) + reputation;
    if (newReputation < 0) return false;

    await this.model.update(player.id, { 
      reputation: newReputation,
      update_time: Math.floor(Date.now() / 1000)
    }, ctx);
    if (!ctx) cacheService.player.invalidateByUid(uid);
    return true;
  }

  /**
   * 为玩家添加生命值
   * @param uid 用户ID
   * @param hp 生命值
   * @param ctx 事务上下文（可选）
   * @returns 是否添加成功
   */
  async addHp(uid: Uid, hp: number, ctx?: any): Promise<boolean> {
    // 从数据库获取玩家信息
    const players = await this.list(uid, ctx);
    if (players.length === 0) return false;
    const player = players[0];

    const newHp = Math.min(player.hp + hp, player.max_hp);

    await this.model.update(player.id, { 
      hp: newHp,
      update_time: Math.floor(Date.now() / 1000)
    }, ctx);
    if (!ctx) cacheService.player.invalidateByUid(uid);
    return true;
  }

  /**
   * 为玩家添加魔法值
   * @param uid 用户ID
   * @param mp 魔法值
   * @param ctx 事务上下文（可选）
   * @returns 是否添加成功
   */
  async addMp(uid: Uid, mp: number, ctx?: any): Promise<boolean> {
    // 从数据库获取玩家信息
    const players = await this.list(uid, ctx);
    if (players.length === 0) return false;
    const player = players[0];

    const newMp = Math.min((player.mp || 0) + mp, player.max_mp || 0);

    await this.model.update(player.id, { 
      mp: newMp,
      update_time: Math.floor(Date.now() / 1000)
    }, ctx);
    if (!ctx) cacheService.player.invalidateByUid(uid);
    return true;
  }
}
