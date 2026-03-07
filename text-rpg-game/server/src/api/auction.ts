import { Router, Response } from 'express';
import { auth, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { auctionService } from '../service/auction.service';
import { success } from '../utils/response';
import { sanitizeKeyword } from '../utils/input-sanitize';
import { auctionListQuery, auctionListBody, auctionBuyBody, auctionOffShelfBody } from './schemas';
import { asyncHandler } from '../middleware/async-handler';

const router = Router();

router.get('/list', auth, validate(auctionListQuery, 'query'), asyncHandler(async (req: AuthRequest, res: Response) => {
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
}));

router.post('/list', auth, validate(auctionListBody), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { bag_id, count, price } = req.body;
  const auctionId = await auctionService.listItem(req.uid!, {
    bag_id,
    count,
    price,
  });
  success(res, { auction_id: auctionId, message: '上架成功' });
}));

router.post('/buy', auth, validate(auctionBuyBody), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { auction_id, count } = req.body;
  await auctionService.buy(req.uid!, auction_id, count);
  success(res, { message: '购买成功' });
}));

router.get('/records', auth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const records = await auctionService.getRecords(req.uid!);
  success(res, { records });
}));

router.post('/off-shelf', auth, validate(auctionOffShelfBody), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { auction_id } = req.body;
  await auctionService.offShelf(req.uid!, auction_id);
  success(res, { message: '下架成功' });
}));

export default router;
