import { Router } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth.ts';
import { PERMISSIONS } from '../lib/permissions-list.ts';
import { getConfig, updateConfig } from '../services/config.ts';
import { configurarWebhook, obterQrCode, obterStatusConexao } from '../services/whatsapp.ts';

export const configRouter = Router();
configRouter.use(requireAuth);

configRouter.get('/', requirePermission(PERMISSIONS.CONFIG_VIEW), async (_req, res) => {
  res.json({ config: await getConfig() });
});

configRouter.put('/', requirePermission(PERMISSIONS.CONFIG_EDIT), async (req, res) => {
  res.json({ config: await updateConfig(req.body ?? {}) });
});

// Reconfigura o webhook do Evolution para a URL publica atual (aba Configuracoes).
configRouter.post('/webhook', requirePermission(PERMISSIONS.CONFIG_EDIT), async (req, res) => {
  const appUrl = (req.body?.appUrl as string) || process.env.VITE_APP_URL || '';
  if (!appUrl) { res.status(400).json({ erro: 'appUrl obrigatorio' }); return; }
  const ok = await configurarWebhook(appUrl);
  res.json({ ok, url: `${appUrl}/api/webhook/evolution` });
});

// Estado atual da conexao do WhatsApp (Evolution).
configRouter.get('/whatsapp/status', requirePermission(PERMISSIONS.CONFIG_VIEW), async (_req, res) => {
  res.json(await obterStatusConexao());
});

// Gera o QR code para parear o WhatsApp (ou confirma que ja esta conectado).
configRouter.get('/whatsapp/qrcode', requirePermission(PERMISSIONS.CONFIG_EDIT), async (_req, res) => {
  res.json(await obterQrCode());
});
