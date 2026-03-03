const express = require('express');
const app = express();
const port = 3000;

app.use(express.json());

// 模拟登录路由
app.post('/api/admin/login', (req, res) => {
  console.log('Login request received:', req.body);
  res.json({
    code: 0,
    msg: 'success',
    data: {
      token: 'test-token-123',
      uid: 1,
      username: 'asd4859098'
    }
  });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Test server running on port ${port}`);
});