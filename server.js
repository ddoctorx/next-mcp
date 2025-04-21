const express = require('express');
const http = require('http');
const next = require('next');
const { Server } = require('socket.io');
const cors = require('cors');
const bodyParser = require('body-parser');

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

  // Socket.io 连接处理
  io.on('connection', socket => {
    console.log(`客户端已连接: ${socket.id}`);

    socket.on('join_session', sessionId => {
      socket.join(sessionId);
      console.log(`客户端 ${socket.id} 加入会话 ${sessionId}`);
    });

    socket.on('leave_session', sessionId => {
      socket.leave(sessionId);
      console.log(`客户端 ${socket.id} 离开会话 ${sessionId}`);
    });

    socket.on('disconnect', () => {
      console.log(`客户端已断开连接: ${socket.id}`);
    });
  });

  // Next.js 请求处理
  server.all('*', (req, res) => {
    return handle(req, res);
  });

  // 启动服务器
  const PORT = process.env.PORT || 3000;
  httpServer.listen(PORT, err => {
    if (err) throw err;
    console.log(`> 服务器已启动在 http://localhost:${PORT}`);
  });
});
