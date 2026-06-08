// Temporario: descobre a regiao do pooler Supabase testando conexao. Apaga depois.
import pg from 'pg';
import fs from 'node:fs';

const env = fs.readFileSync('.env.bak', 'utf8');
const m = env.match(/DATABASE_URL\s*=\s*postgres(?:ql)?:\/\/postgres:(.+)@db\.([a-z0-9]+)\.supabase\.co/);
if (!m) { console.log('nao achei DATABASE_URL direta no .env.bak'); process.exit(1); }
const pass = m[1];
const ref = m[2];

const regions = [
  'sa-east-1',
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-central-1', 'eu-central-2', 'eu-north-1',
  'ap-southeast-1', 'ap-southeast-2', 'ap-south-1', 'ap-northeast-1', 'ap-northeast-2',
  'ca-central-1',
];

for (const r of regions) {
  for (const port of [5432, 6543]) {
    const url = `postgresql://postgres.${ref}:${pass}@aws-0-${r}.pooler.supabase.com:${port}/postgres`;
    const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 1, connectionTimeoutMillis: 6000 });
    try {
      await pool.query('select 1');
      console.log(`OK_REGION=${r} OK_PORT=${port}`);
      await pool.end();
      process.exit(0);
    } catch (e) {
      console.log(`fail ${r}:${port} -> ${(e.message || '').slice(0, 45)}`);
      try { await pool.end(); } catch { /* ignore */ }
    }
  }
}
console.log('NENHUMA regiao funcionou');
process.exit(2);
