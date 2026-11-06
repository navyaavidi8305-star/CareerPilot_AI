import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { Server as SocketServer } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import authRoutes from './routes/auth';
import userRoutes from './routes/user';
import resumeRoutes from './routes/resume';
import recommendationRoutes from './routes/recommendation';
import roadmapRoutes from './routes/roadmap';
import chatRoutes from './routes/chat';
import interviewRoutes from './routes/interview';
import marketRoutes from './routes/market';
import adminRoutes from './routes/admin';
import skillGapRoutes from './routes/skillGap';
import notificationRoutes from './routes/notification';
import learningRoutes from './routes/learning';
import graphRoutes from './routes/graph';
import { errorHandler } from './middleware/errorHandler';
import { authenticateSocket } from './middleware/auth';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new SocketServer(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

export const prisma = new PrismaClient();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
const uploadsDir = path.resolve(__dirname, '../uploads');
fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/resume', resumeRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/roadmaps', roadmapRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/interviews', interviewRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/skill-gaps', skillGapRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/learning', learningRoutes);
app.use('/api/graph', graphRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: 'CareerPilot AI API is running' });
});

app.use(errorHandler);

io.use(authenticateSocket);
io.on('connection', (socket) => {
  const userId = socket.data.userId;
  socket.join(`user:${userId}`);

  socket.on('disconnect', () => {
    socket.leave(`user:${userId}`);
  });
});

export { io };

const PORT = parseInt(process.env.PORT || '5000');
server.listen(PORT, () => {
  console.log(`CareerPilot AI server running on port ${PORT}`);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});
