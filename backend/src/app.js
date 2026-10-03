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
import { verifyOrigin } from './middleware/verifyOrigin.js';

export const app = express();

app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: {
    directives: { 'img-src': ["'self'", 'data:', 'https:'] }
  }
}));
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
app.use(verifyOrigin);
app.use('/api/v1/auth/login', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, res) => res.status(429).json({
    success: false,
    message: 'Too many sign-in attempts. Please try again later.',
    errors: []
  })
}));
app.use('/api/v1', apiRouter);
app.use(notFound);
app.use(errorHandler);
