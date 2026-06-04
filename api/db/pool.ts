import pg from 'pg';

const { Pool } = pg;

// Pool unico reaproveitado entre invocacoes serverless (a Vercel reaproveita o processo quando "quente").
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Supabase exige SSL; rejectUnauthorized=false porque o cert e gerenciado pelo provedor.
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
  max: 5,
});

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params as never[]);
}
