import express from 'express';
import cookieParser from 'cookie-parser';
import { runMigrations } from './db/migrations.ts';
import { logger } from './lib/logger.ts';
import { webhookRouter } from './routes/webhook.ts';
import { authRouter } from './routes/auth.ts';
import { usersRouter } from './routes/users.ts';
import { clientesRouter } from './routes/clientes.ts';
import { planosRouter } from './routes/planos.ts';
import { dashboardRouter } from './routes/dashboard.ts';
import { agendaRouter } from './routes/agenda.ts';
import { configRouter } from './routes/config.ts';

export const app = express();

app.use(express.json({ limit: '15mb' })); // base64 de midia pode ser grande
app.use(cookieParser());

// Migrations rodam uma vez por cold start (idempotentes). Antes de qualquer rota, inclusive o webhook.
let migrou: Promise<void> | null = null;
export function garantirMigrations(): Promise<void> {
  if (!migrou) migrou = runMigrations().catch((e) => { logger.error('migrations falharam', e); migrou = null; throw e; });
  return migrou;
}
app.use(async (_req, _res, next) => {
  try { await garantirMigrations(); next(); } catch (e) { next(e); }
});

// Webhook ANTES de qualquer middleware de auth (entrada publica do Evolution, autentica com apikey proprio).
app.use('/api/webhook', webhookRouter);

app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/clientes', clientesRouter);
app.use('/api/planos', planosRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/agenda', agendaRouter);
app.use('/api/config', configRouter);

app.get('/api/health', (_req, res) => res.json({ ok: true }));
