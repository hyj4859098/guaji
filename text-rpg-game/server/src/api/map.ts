import { Router, Response } from 'express';
import { MapService } from '../service/map.service';
import { adminAuth, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { success, fail } from '../utils/response';
import { ErrorCode } from '../utils/error';
import { mapGetQuery, mapAddBody, mapUpdateBody, mapDeleteBody } from './schemas';
import { asyncHandler } from '../middleware/async-handler';

const router = Router();
const mapService = new MapService();

router.get('/list', asyncHandler(async (req: AuthRequest, res: Response) => {
  const maps = await mapService.list();
  success(res, maps);
}));

router.get('/get', validate(mapGetQuery, 'query'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = req.query.id as unknown as number;
  const map = await mapService.get(id);

  if (!map) {
    return fail(res, ErrorCode.NOT_FOUND, '地图不存在');
  }

  success(res, map);
}));

router.post('/add', adminAuth, validate(mapAddBody), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { name } = req.body;
  const id = await mapService.add({ name });
  success(res, { id });
}));

router.post('/update', adminAuth, validate(mapUpdateBody), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id, name } = req.body;
  const successResult = await mapService.update(id, { name });

  if (!successResult) {
    return fail(res, ErrorCode.NOT_FOUND, '地图不存在');
  }

  success(res, null);
}));

router.post('/delete', adminAuth, validate(mapDeleteBody), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.body;
  const successResult = await mapService.delete(id);

  if (!successResult) {
    return fail(res, ErrorCode.NOT_FOUND, '地图不存在');
  }

  success(res, null);
}));

export default router;
