// Garante credentials:'include' em toda chamada e dispara 'auth-expired' em 401.
const originalFetch = window.fetch.bind(window);

window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const resp = await originalFetch(input, { ...init, credentials: 'include' });
  const url = typeof input === 'string' ? input : input.toString();
  if (resp.status === 401 && url.includes('/api/') && !url.includes('/api/auth/login')) {
    window.dispatchEvent(new CustomEvent('auth-expired'));
  }
  return resp;
};
