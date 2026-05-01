import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server } from 'socket.io';
import { startScheduler } from './services/scheduler';
import { verifyTokenString } from './lib/auth-utils';

const dev = process.env.COZE_PROJECT_ENV !== 'PROD';
const hostname = process.env.HOSTNAME || 'localhost';
const port = parseInt(process.env.PORT || '5000', 10);

// Create Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  // 启动定时任务调度器
  startScheduler().catch((err) => {
    console.error('Failed to start scheduler:', err);
  });

  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('Internal server error');
    }
  });

  // 初始化 Socket.IO
  const io = new Server(server, {
    path: '/api/socket',
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  // 存储 io 实例供 API routes 使用
  (globalThis as typeof globalThis & { io: typeof io }).io = io;

  io.use(async (socket, next) => {
    try {
      let token = socket.handshake.auth.token as string;

      // 如果 auth.token 为空，尝试从 handshake 的 cookie 中读取（HttpOnly cookie）
      if (!token && socket.handshake.headers.cookie) {
        const match = socket.handshake.headers.cookie.match(/(?:^|; )qq_token=([^;]*)/);
        if (match) {
          token = decodeURIComponent(match[1]);
        }
      }

      if (!token) {
        return next(new Error('Authentication error: no token'));
      }
      const payload = await verifyTokenString(token);
      if (!payload) {
        return next(new Error('Authentication error: invalid token'));
      }
      socket.data.userId = payload.userId;
      next();
    } catch {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId as number;
    if (!userId) return;

    socket.join(`user_${userId}`);

    socket.on('join_conversation', (conversationId: number) => {
      socket.join(`conversation_${conversationId}`);
    });

    socket.on('leave_conversation', (conversationId: number) => {
      socket.leave(`conversation_${conversationId}`);
    });

    socket.on('disconnect', () => {
      // disconnected
    });
  });

  server.once('error', (err) => {
    console.error(err);
    process.exit(1);
  });

  server.listen(port, () => {
    console.log(
      `> Server listening at http://${hostname}:${port} as ${
        dev ? 'development' : process.env.COZE_PROJECT_ENV
      }`,
    );
  });
});
