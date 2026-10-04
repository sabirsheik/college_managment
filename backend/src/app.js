import cors from 'cors';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
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
if (env.trustProxyHops > 0) app.set('trust proxy', env.trustProxyHops);
app.use(helmet({
  contentSecurityPolicy: {
    directives: { 'img-src': ["'self'", 'data:', 'https:'] }
  }
}));
app.use((req, res, next) => {
  req.id = randomUUID();
  res.setHeader('X-Request-ID', req.id);
  next();
});
app.use(pinoHttp({
  logger,
  genReqId: (req) => req.id,
  serializers: {
    req: (req) => ({ method: req.method, url: req.url.split('?')[0] }),
    res: (res) => ({ statusCode: res.statusCode })
  },
  customProps: (req, res) => ({ requestId: req.id, responseTimeMs: res.responseTime })
}));
app.use(cors({ origin: env.frontendUrl, credentials: true }));
app.use(express.json({ limit: '1mb', strict: true }));
app.use(cookieParser());
app.use(verifyOrigin);
app.use('/api/v1', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: (req) => req.path === '/health',
  handler: (_req, res) => res.status(429).json({
    success: false,
    message: 'Too many requests. Please try again later.',
    errors: []
  })
}));
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
app.use('/api/v1/auth/password-reset', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, res) => res.status(429).json({
    success: false,
    message: 'Too many password reset requests. Please try again later.',
    errors: []
  })
}));
app.use('/api/v1', apiRouter);
app.use(notFound);
app.use(errorHandler);
