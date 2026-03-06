import { Router, Response, NextFunction } from 'express';
import { auth, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { auctionService } from '../service/auction.service';
import { success, fail } from '../utils/response';
import { ErrorCode } from '../utils/error';
import { logger } from '../utils/logger';
import { sanitizeKeyword } from '../utils/input-sanitize';
import { auctionListQuery, auctionListBody, auctionBuyBody, auctionOffShelfBody } from './schemas';

const router = Router();

router.get('/list', auth, validate(auctionListQuery, 'query'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const q = req.query as any;
    let keyword = sanitizeKeyword(q.keyword);
    if (keyword === 'undefined' || keyword === 'null') keyword = '';

    const result = await auctionService.list({
      type: q.type,
      keyword: keyword || undefined,
      pos: q.pos,
      min_level: q.min_level,
      max_level: q.max_level,
      page: q.page,
      pageSize: q.pageSize,
    });
    success(res, result);
  } catch (error) {
    next(error);
  }
});

router.post('/list', auth, validate(auctionListBody), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { bag_id, count, price } = req.body;
    const auctionId = await auctionService.listItem(req.uid!, {
      bag_id,
      count,
      price,
    });
    success(res, { auction_id: auctionId, message: '上架成功' });
  } catch (error) {
    next(error);
  }
});

router.post('/buy', auth, validate(auctionBuyBody), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { auction_id, count } = req.body;
    await auctionService.buy(req.uid!, auction_id, count);
    success(res, { message: '购买成功' });
  } catch (error) {
    next(error);
  }
});

router.get('/records', auth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const records = await auctionService.getRecords(req.uid!);
    success(res, { records });
  } catch (error) {
    next(error);
  }
});

router.post('/off-shelf', auth, validate(auctionOffShelfBody), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { auction_id } = req.body;
    await auctionService.offShelf(req.uid!, auction_id);
    success(res, { message: '下架成功' });
  } catch (error) {
    next(error);
  }
});

export default router;
