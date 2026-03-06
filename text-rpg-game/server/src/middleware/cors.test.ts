import { cors } from './cors';

describe('cors', () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockReq = { method: 'GET', headers: {} };
    mockRes = {
      header: jest.fn().mockReturnThis(),
      sendStatus: jest.fn(),
    };
    mockNext = jest.fn();
  });

  it('设置 CORS 头', () => {
    cors(mockReq, mockRes, mockNext);
    expect(mockRes.header).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
    expect(mockRes.header).toHaveBeenCalledWith('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    expect(mockRes.header).toHaveBeenCalledWith('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  });

  it('GET 请求调用 next', () => {
    cors(mockReq, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.sendStatus).not.toHaveBeenCalled();
  });

  it('OPTIONS 请求返回 200 且不调用 next', () => {
    mockReq.method = 'OPTIONS';
    cors(mockReq, mockRes, mockNext);
    expect(mockRes.sendStatus).toHaveBeenCalledWith(200);
    expect(mockNext).not.toHaveBeenCalled();
  });
});
