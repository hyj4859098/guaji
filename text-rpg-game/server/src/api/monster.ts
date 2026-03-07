import { Router, Response } from 'express';
import { MonsterService } from '../service/monster.service';
import { AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { success, fail } from '../utils/response';
import { ErrorCode } from '../utils/error';
import { monsterGetQuery, monsterLevelQuery, monsterMapQuery } from './schemas';
import { asyncHandler } from '../middleware/async-handler';

const router = Router();
const monsterService = new MonsterService();

router.get('/list', asyncHandler(async (req: AuthRequest, res: Response) => {
  const monsters = await monsterService.list();
  success(res, monsters);
}));

router.get('/get', validate(monsterGetQuery, 'query'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = req.query.id as unknown as number;
  const monster = await monsterService.get(id);

  if (!monster) {
    return fail(res, ErrorCode.NOT_FOUND, '怪物不存在');
  }

  success(res, monster);
}));

router.get('/level', validate(monsterLevelQuery, 'query'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const min = req.query.min as unknown as number;
  const max = req.query.max as unknown as number;
  const monsters = await monsterService.listByLevel(min, max);
  success(res, monsters);
}));

router.get('/map', validate(monsterMapQuery, 'query'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const map_id = req.query.map_id as unknown as number;
  const monsters = await monsterService.listByMapId(map_id);
  success(res, monsters);
}));

export default router;
