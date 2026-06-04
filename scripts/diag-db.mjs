import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DIAG_DB_URL, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
try {
  const { rows } = await pool.query(
    `SELECT telefone, whatsapp_jid, etapa, atualizado_em FROM clientes ORDER BY atualizado_em DESC LIMIT 6`,
  );
  console.log('=== clientes (whatsapp_jid atual) ===');
  for (const c of rows) console.log(`tel=${c.telefone}  jid=${JSON.stringify(c.whatsapp_jid)}  etapa=${c.etapa}  upd=${new Date(c.atualizado_em).toISOString()}`);
} catch (e) { console.error('DB ERROR:', e.message); } finally { await pool.end(); }
