import { Router } from 'express';
import { logger } from '../lib/logger.ts';
import { executarFollowUps } from '../services/follow-up.ts';

export const cronRouter = Router();

// Disparador da regua de follow-up. SEM auth do painel: protegido por CRON_SECRET. A Vercel injeta o header
// `Authorization: Bearer <CRON_SECRET>` nas chamadas de cron quando a env existe. Tambem aceita `?secret=`
// para disparadores externos (cron-job.org / GitHub Actions) caso um dia precise de granularidade fina.
//
// No Hobby o cron roda 1x/dia (ver crons em scripts/build-vercel.mjs): processa tudo que venceu.
cronRouter.get('/agenda', async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const header = req.headers.authorization;
    const viaQuery = req.query.secret;
    if (header !== `Bearer ${secret}` && viaQuery !== secret) {
      res.status(401).json({ erro: 'nao autorizado' });
      return;
    }
  } else {
    logger.warn('cron: CRON_SECRET nao configurado — endpoint /api/cron/agenda exposto sem protecao');
  }

  try {
    const resumo = await executarFollowUps();
    res.json({ ok: true, ...resumo });
  } catch (e) {
    logger.error('cron: falha ao executar follow-ups', e);
    res.status(500).json({ ok: false, erro: 'falha ao executar follow-ups' });
  }
});
