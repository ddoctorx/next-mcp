const express = require('express');
const http = require('http');
const next = require('next');
const { Server } = require('socket.io');
const cors = require('cors');
const bodyParser = require('body-parser');
const mcpService = require('./src/server');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = express();
  const httpServer = http.createServer(server);

  // 设置 Socket.io
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  // 中间件配置
  server.use(cors());
  server.use(bodyParser.json());

  // 初始化 MCP 服务，传入 Express 服务器和 Socket.io 实例
  mcpService.init(server, io);

  // Next.js 请求处理
  server.all('*', (req, res) => {
    return handle(req, res);
  });

  // 启动服务器
  const PORT = process.env.PORT || 3000;
  httpServer.listen(PORT, err => {
    if (err) throw err;
    console.log(`> 服务器已启动在 http://localhost:${PORT}`);
    console.log(`访问上面的地址管理您的MCP`);
  });
});
