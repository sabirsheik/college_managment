import cors from 'cors';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { rateLimit } from 'express-rate-limit';
import { env } from './config/env.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { apiRouter } from './routes/index.js';
import { logger } from './utils/logger.js';

export const app = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(pinoHttp({
  logger,
  serializers: {
    req: (req) => ({ method: req.method, url: req.url.split('?')[0] }),
    res: (res) => ({ statusCode: res.statusCode })
  },
  customProps: (_req, res) => ({ responseTimeMs: res.responseTime })
}));
app.use(cors({ origin: env.frontendUrl, credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use('/api/v1/auth/login', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false
}));
app.use('/api/v1', apiRouter);
app.use(notFound);
app.use(errorHandler);
