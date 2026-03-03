import { Router, Response, NextFunction } from 'express';
import { dataStorageService } from '../service/data-storage.service';
import { generateToken } from '../utils/helper';
import { config } from '../config';
import { success, fail } from '../utils/response';
import { ErrorCode } from '../utils/error';
import { logger } from '../utils/logger';
import { MonsterService } from '../service/monster.service';
import { SkillService } from '../service/skill.service';
import { MapService } from '../service/map.service';
import { ItemService } from '../service/item.service';
import { LevelExpService } from '../service/level_exp.service';
import { PlayerService } from '../service/player.service';
import { adminAuth } from '../middleware/auth';

const router = Router();
const monsterService = new MonsterService();
const skillService = new SkillService();
const mapService = new MapService();
const itemService = new ItemService();
const levelExpService = new LevelExpService();
const playerService = new PlayerService();

/**
 * 管理员登录
 */
router.post('/login', async (req: any, res: Response, next: NextFunction) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return fail(res, ErrorCode.INVALID_PARAMS, '缺少用户名或密码');
    }
    
    // 检查用户是否存在
    const user = await dataStorageService.getByCondition('user', { username, password });
    
    if (!user) {
      return fail(res, ErrorCode.UNAUTHORIZED, '用户名或密码错误');
    }
    
    // 检查是否是管理员
    if (!user.is_admin) {
      return fail(res, ErrorCode.UNAUTHORIZED, '权限不足');
    }
    
    const token = generateToken(user.id || user._id, config.jwt_secret);
    
    success(res, {
      token,
      uid: user.id || user._id,
      username: user.username
    });
  } catch (error) {
    logger.error('管理员登录失败:', error);
    next(error);
  }
});

// 应用管理员认证中间件到所有后续路由
router.use(adminAuth);

/**
 * 清除缓存
 */
router.post('/clear-cache', async (req: any, res: Response, next: NextFunction) => {
  try {
    const { type } = req.body;
    
    // 由于已移除Redis，缓存清除功能已简化
    const validTypes = ['monster', 'skill', 'map', 'item', 'level_exp'];
    if (!validTypes.includes(type)) {
      return fail(res, ErrorCode.INVALID_PARAMS, '无效的缓存类型');
    }
    
    success(res, { message: '缓存清除成功' });
  } catch (error) {
    logger.error('清除缓存失败:', error);
    next(error);
  }
});

/**
 * 获取怪物列表
 */
router.get('/monster/list', async (req: any, res: Response, next: NextFunction) => {
  try {
    const monsters = await monsterService.list();
    success(res, monsters);
  } catch (error) {
    logger.error('获取怪物列表失败:', error);
    next(error);
  }
});

/**
 * 获取单个怪物信息
 */
router.get('/monster/:id', async (req: any, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return fail(res, ErrorCode.INVALID_PARAMS, '无效的怪物ID');
    }
    
    const monster = await monsterService.get(id);
    if (!monster) {
      return fail(res, ErrorCode.NOT_FOUND, '怪物不存在');
    }
    
    success(res, monster);
  } catch (error) {
    logger.error('获取怪物信息失败:', error);
    next(error);
  }
});

/**
 * 新增怪物
 */
router.post('/monster/add', async (req: any, res: Response, next: NextFunction) => {
  try {
    const { name, level, hp, mp, phy_atk, phy_def, mag_atk, mag_def, skill1, skill2, hit_rate, dodge_rate, crit_rate, exp, gold, reputation, map_id, description } = req.body;
    
    if (!name || !level || !hp) {
      return fail(res, ErrorCode.INVALID_PARAMS, '缺少必要参数');
    }
    
    const monsterData = {
      name,
      level,
      hp,
      mp: mp || 0,
      phy_atk: phy_atk || 0,
      phy_def: phy_def || 0,
      mag_atk: mag_atk || 0,
      mag_def: mag_def || 0,
      skill1: skill1 || '',
      skill2: skill2 || '',
      hit_rate: hit_rate || 0,
      dodge_rate: dodge_rate || 0,
      crit_rate: crit_rate || 0,
      exp: exp || 0,
      gold: gold || 0,
      reputation: reputation || 0,
      map_id: map_id || 1,
      description: description || '',
      create_time: Math.floor(Date.now() / 1000),
      update_time: Math.floor(Date.now() / 1000)
    };
    
    const id = await monsterService.add(monsterData);
    success(res, { id });
  } catch (error) {
    logger.error('新增怪物失败:', error);
    next(error);
  }
});

/**
 * 更新怪物
 */
router.post('/monster/update', async (req: any, res: Response, next: NextFunction) => {
  try {
    const { id, name, level, hp, mp, phy_atk, phy_def, mag_atk, mag_def, skill1, skill2, hit_rate, dodge_rate, crit_rate, exp, gold, reputation, map_id, description } = req.body;
    
    if (!id || !name || !level || !hp) {
      return fail(res, ErrorCode.INVALID_PARAMS, '缺少必要参数');
    }
    
    const monsterData = {
      name,
      level,
      hp,
      mp: mp || 0,
      phy_atk: phy_atk || 0,
      phy_def: phy_def || 0,
      mag_atk: mag_atk || 0,
      mag_def: mag_def || 0,
      skill1: skill1 || '',
      skill2: skill2 || '',
      hit_rate: hit_rate || 0,
      dodge_rate: dodge_rate || 0,
      crit_rate: crit_rate || 0,
      exp: exp || 0,
      gold: gold || 0,
      reputation: reputation || 0,
      map_id: map_id || 1,
      description: description || '',
      update_time: Math.floor(Date.now() / 1000)
    };
    
    const successFlag = await monsterService.update(id, monsterData);
    if (successFlag) {
      success(res, { message: '更新成功' });
    } else {
      fail(res, ErrorCode.NOT_FOUND, '怪物不存在');
    }
  } catch (error) {
    logger.error('更新怪物失败:', error);
    next(error);
  }
});

/**
 * 删除怪物
 */
router.post('/monster/delete', async (req: any, res: Response, next: NextFunction) => {
  try {
    const { id } = req.body;
    
    if (!id) {
      return fail(res, ErrorCode.INVALID_PARAMS, '缺少怪物ID');
    }
    
    const successFlag = await monsterService.delete(id);
    if (successFlag) {
      success(res, { message: '删除成功' });
    } else {
      fail(res, ErrorCode.NOT_FOUND, '怪物不存在');
    }
  } catch (error) {
    logger.error('删除怪物失败:', error);
    next(error);
  }
});

/**
 * 获取技能列表
 */
router.get('/skill/list', async (req: any, res: Response, next: NextFunction) => {
  try {
    const skills = await skillService.list();
    success(res, skills);
  } catch (error) {
    logger.error('获取技能列表失败:', error);
    next(error);
  }
});

/**
 * 获取地图列表
 */
router.get('/map/list', async (req: any, res: Response, next: NextFunction) => {
  try {
    const maps = await mapService.list();
    success(res, maps);
  } catch (error) {
    logger.error('获取地图列表失败:', error);
    next(error);
  }
});

/**
 * 获取物品列表
 */
router.get('/item/list', async (req: any, res: Response, next: NextFunction) => {
  try {
    const items = await itemService.getAllItems();
    success(res, items);
  } catch (error) {
    logger.error('获取物品列表失败:', error);
    next(error);
  }
});

/**
 * 获取等级经验列表
 */
router.get('/level/list', async (req: any, res: Response, next: NextFunction) => {
  try {
    const levels = await levelExpService.list();
    success(res, levels);
  } catch (error) {
    logger.error('获取等级经验列表失败:', error);
    next(error);
  }
});

/**
 * 获取玩家信息
 */
router.get('/player/:uid', async (req: any, res: Response, next: NextFunction) => {
  try {
    const uid = parseInt(req.params.uid);
    if (isNaN(uid)) {
      return fail(res, ErrorCode.INVALID_PARAMS, '无效的玩家UID');
    }
    
    const players = await playerService.list(uid);
    if (players.length === 0) {
      return fail(res, ErrorCode.NOT_FOUND, '玩家不存在');
    }
    
    success(res, players[0]);
  } catch (error) {
    logger.error('获取玩家信息失败:', error);
    next(error);
  }
});

export default router;