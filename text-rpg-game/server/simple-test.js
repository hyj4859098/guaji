const http = require('http');
const port = 3001;

const server = http.createServer((req, res) => {
  if (req.url === '/api/admin/login' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      console.log('Login request received:', body);
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify({
        code: 0,
        msg: 'success',
        data: {
          token: 'test-token-123',
          uid: 1,
          username: 'asd4859098'
        }
      }));
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Simple test server running on port ${port}`);
});