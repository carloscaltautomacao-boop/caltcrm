// Carrega o .env em desenvolvimento ANTES de qualquer outro import (Node 20.12+/24 tem loadEnvFile nativo).
// Em produção (Vercel) as variáveis vêm do ambiente, então a ausência do arquivo é ignorada.
try {
  process.loadEnvFile?.('.env');
} catch {
  // sem .env em dev — segue com as variáveis já presentes no ambiente
}
