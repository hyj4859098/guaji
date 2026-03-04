import { Router, Response, NextFunction } from 'express';
import { auth, AuthRequest } from '../middleware/auth';
import { auctionService } from '../service/auction.service';
import { success, fail } from '../utils/response';
import { ErrorCode } from '../utils/error';
import { logger } from '../utils/logger';

const router = Router();

router.get('/list', auth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const type = req.query.type != null ? Number(req.query.type) : undefined;
    let keyword = (req.query.keyword as string) || '';
    if (keyword === 'undefined' || keyword === 'null') keyword = '';
    const pos = req.query.pos != null ? Number(req.query.pos) : undefined;
    const min_level = req.query.min_level != null ? Number(req.query.min_level) : undefined;
    const max_level = req.query.max_level != null ? Number(req.query.max_level) : undefined;
    const page = req.query.page != null ? Number(req.query.page) : 1;
    const pageSize = req.query.pageSize != null ? Number(req.query.pageSize) : 15;

    const result = await auctionService.list({
      type,
      keyword: keyword || undefined,
      pos,
      min_level,
      max_level,
      page,
      pageSize,
    });
    success(res, result);
  } catch (error: any) {
    if (error.code) {
      return fail(res, error.code, error.message);
    }
    logger.error('获取拍卖列表失败:', error);
    next(error);
  }
});

router.post('/list', auth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { bag_id, count, price } = req.body;
    if (!bag_id || price == null) {
      return fail(res, ErrorCode.INVALID_PARAMS, '缺少背包ID或价格');
    }
    const auctionId = await auctionService.listItem(req.uid!, {
      bag_id: Number(bag_id),
      count: count != null ? Number(count) : undefined,
      price: Number(price),
    });
    success(res, { auction_id: auctionId, message: '上架成功' });
  } catch (error: any) {
    if (error.code) {
      return fail(res, error.code, error.message);
    }
    logger.error('拍卖上架失败:', error);
    next(error);
  }
});

router.post('/buy', auth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { auction_id, count } = req.body;
    if (!auction_id || !count) {
      return fail(res, ErrorCode.INVALID_PARAMS, '缺少拍卖ID或数量');
    }
    await auctionService.buy(req.uid!, Number(auction_id), Number(count));
    success(res, { message: '购买成功' });
  } catch (error: any) {
    if (error.code) {
      return fail(res, error.code, error.message);
    }
    logger.error('拍卖购买失败:', error);
    next(error);
  }
});

router.get('/records', auth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const records = await auctionService.getRecords(req.uid!);
    success(res, { records });
  } catch (error: any) {
    if (error.code) {
      return fail(res, error.code, error.message);
    }
    logger.error('获取拍卖记录失败:', error);
    next(error);
  }
});

router.post('/off-shelf', auth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { auction_id } = req.body;
    if (!auction_id) {
      return fail(res, ErrorCode.INVALID_PARAMS, '缺少拍卖ID');
    }
    await auctionService.offShelf(req.uid!, Number(auction_id));
    success(res, { message: '下架成功' });
  } catch (error: any) {
    if (error.code) {
      return fail(res, error.code, error.message);
    }
    logger.error('拍卖下架失败:', error);
    next(error);
  }
});

export default router;
