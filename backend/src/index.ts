import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer, IncomingMessage } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { WebSocketServer, WebSocket } from 'ws';

import { optionalAuth } from './middleware/auth';
import authRouter from './routes/auth';
import marketsRouter from './routes/markets';
import tradesRouter from './routes/trades';
import usersRouter from './routes/users';
import leaderboardRouter from './routes/leaderboard';
import tournamentsRouter from './routes/tournaments';
import socialRouter from './routes/social';
import adminRouter from './routes/admin';
import proposalsRouter from './routes/proposals';

const app = express();
const httpServer = createServer(app);

// ——— Middleware ———
app.use(helmet());
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map(s => s.trim())
  : null;
app.use(cors({
  origin: allowedOrigins
    ? (origin, cb) => {
        if (!origin || allowedOrigins.includes(origin)) cb(null, true);
        else cb(new Error('Not allowed by CORS'));
      }
    : true, // allow all in dev when FRONTEND_URL is not set
  credentials: true,
}));
app.use(express.json());
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
}));

// ——— Socket.IO (for web frontend) ———
export const io = new SocketIOServer(httpServer, {
  cors: { origin: process.env.FRONTEND_URL || '*' },
  path: '/socket.io',
});

io.on('connection', (socket) => {
  console.log('Socket.IO client connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('Socket.IO client disconnected:', socket.id);
  });
});

// ——— Raw WebSocket server (for mobile app at /ws) ———
const wss = new WebSocketServer({ noServer: true });
const rawClients = new Set<WebSocket>();

wss.on('connection', (ws) => {
  rawClients.add(ws);
  ws.on('close', () => rawClients.delete(ws));
});

httpServer.on('upgrade', (req: IncomingMessage, socket, head) => {
  if (req.url?.startsWith('/ws')) {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  }
});

// Broadcast price update to all raw WS clients (called after a trade)
export function broadcastPriceUpdate(marketId: string, prices: Record<string, number>) {
  const msg = JSON.stringify({ type: 'PRICE_UPDATE', payload: { marketId, prices } });
  rawClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  });
}

// ——— Optional auth on all routes (populates req.user if token present) ———
app.use(optionalAuth);

// ——— Routes ———
app.use('/api/auth', authRouter);
app.use('/api/markets', marketsRouter);
app.use('/api/trades', tradesRouter);
app.use('/api/users', usersRouter);
app.use('/api/leaderboard', leaderboardRouter);
app.use('/api/tournaments', tournamentsRouter);
app.use('/api/social', socialRouter);
app.use('/api/admin', adminRouter);
app.use('/api/proposals', proposalsRouter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// ——— Start ———
const PORT = parseInt(process.env.PORT || '3001', 10);
httpServer.listen(PORT, () => {
  console.log(`Predich backend running on port ${PORT}`);
});

export default app;
