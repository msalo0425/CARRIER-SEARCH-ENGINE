import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import router from './routes/index';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { testConnection } from './db/pool';
import { startScheduler } from './services/scheduler';
import { ensureSearchVector } from './services/fmcsaSync';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3001');
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

app.use(helmet({ contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false }));
app.use(cors({
  origin: [FRONTEND_URL, 'http://localhost:5173', 'http://localhost:3000'],
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));
app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Rate limits
app.use('/api/auth/login', rateLimit({ windowMs: 15*60*1000, max: 20, message: { error: 'Too many login attempts' } }));
app.use('/api/', rateLimit({ windowMs: 15*60*1000, max: 2000, message: { error: 'Rate limit exceeded' } }));

app.use('/api', router);

// Serve uploads
app.use('/uploads', express.static(path.resolve(process.env.UPLOAD_DIR || './uploads')));

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  const dist = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use(notFoundHandler);
app.use(errorHandler);

async function start() {
  try {
    await testConnection();
    console.log('✓ PostgreSQL connected');
    await ensureSearchVector();
    startScheduler();
    app.listen(PORT, () => {
      console.log(`
  ╔═══════════════════════════════════════════════════╗
  ║   BLACK CLOVER LOGISTICS — Business OS            ║
  ║   Server: http://localhost:${PORT}                  ║
  ╚═══════════════════════════════════════════════════╝`);
    });
  } catch (err) {
    console.error('Failed to start:', err);
    process.exit(1);
  }
}

start();
export default app;
