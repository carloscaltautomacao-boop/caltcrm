// Wrapper de fetch para a API. Lanca em erro != 2xx.
async function req<T>(metodo: string, caminho: string, corpo?: unknown): Promise<T> {
  const resp = await fetch(`/api${caminho}`, {
    method: metodo,
    headers: corpo ? { 'Content-Type': 'application/json' } : undefined,
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error((json as { erro?: string }).erro || `Erro ${resp.status}`);
  return json as T;
}

export const api = {
  get: <T>(c: string) => req<T>('GET', c),
  post: <T>(c: string, body?: unknown) => req<T>('POST', c, body),
  put: <T>(c: string, body?: unknown) => req<T>('PUT', c, body),
  patch: <T>(c: string, body?: unknown) => req<T>('PATCH', c, body),
  del: <T>(c: string) => req<T>('DELETE', c),
};
