import { Router } from 'express';
import authRouter from './auth';
import monsterRouter from './monster';
import bossRouter from './boss';
import monsterDropRouter from './monster_drop';
import bossDropRouter from './boss_drop';
import skillRouter from './skill';
import mapRouter from './map';
import itemRouter from './item';
import equipBaseRouter from './equip_base';
import levelRouter from './level';
import playerRouter from './player';
import shopRouter from './shop';
import { adminAuth } from '../../middleware/auth';

const router = Router();

// 认证路由（不需要adminAuth）
router.use('/', authRouter);

// 应用管理员认证中间件到所有后续路由
router.use(adminAuth);

// 管理路由（统一单数路径：/admin/monster、/admin/skill 等）
router.use('/monster', monsterRouter);
router.use('/boss', bossRouter);
router.use('/monster_drop', monsterDropRouter);
router.use('/boss_drop', bossDropRouter);
router.use('/skill', skillRouter);
router.use('/map', mapRouter);
router.use('/item', itemRouter);
router.use('/equip_base', equipBaseRouter);
router.use('/level', levelRouter);
router.use('/player', playerRouter);
router.use('/shop', shopRouter);

export default router;