// Servidor de desenvolvimento: roda o Express local na porta 3000.
// O Vite (porta 5173) faz proxy de /api para ca. Rode: npm run dev
import './load-env.ts'; // PRECISA ser o primeiro import (carrega .env antes do client de IA/pool)
import { app, garantirMigrations } from './server.ts';
import { logger } from './lib/logger.ts';

const PORT = Number(process.env.PORT) || 3000;

garantirMigrations()
  .catch((e) => logger.error('dev: migrations falharam (seguindo mesmo assim)', e))
  .finally(() => {
    app.listen(PORT, () => logger.info(`dev: API em http://localhost:${PORT}`));
  });
