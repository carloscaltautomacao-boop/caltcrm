import { Router } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth.ts';
import { PERMISSIONS } from '../lib/permissions-list.ts';
import { resolverPeriodo } from '../lib/period.ts';
import { calcularKpis } from '../services/dashboard.ts';
import { getConfig } from '../services/config.ts';

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

// Crédito de referência para o KPI "% com perfil" (apenas leitura do dashboard; não é mais regra do agente).
const CREDITO_PERFIL_REFERENCIA = 50000;

dashboardRouter.get('/', requirePermission(PERMISSIONS.DASHBOARD_VIEW), async (req, res) => {
  const periodo = resolverPeriodo(req.query.de as string | undefined, req.query.ate as string | undefined);
  const config = await getConfig();
  const kpis = await calcularKpis(periodo, CREDITO_PERFIL_REFERENCIA);
  // Teto de custo desligado (0) => sem alerta. Quando >0, alerta ao ultrapassar.
  const alertaCustoIa = config.custo_ia_teto_usd_mes > 0 && kpis.custoIaUsd > config.custo_ia_teto_usd_mes;
  res.json({ periodo, kpis, alertaCustoIa });
});
