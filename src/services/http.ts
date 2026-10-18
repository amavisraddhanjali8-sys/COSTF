// Adds the login token to every /api request and signs out on 401.
import { getStoredSessionToken, clearSession } from './sessionService';

const OPEN_PATHS = [
  '/api/auth/login',
  '/api/auth/verify-mfa',
  '/api/auth/google-login',
  '/api/auth/signup-init',
  '/api/auth/signup-verify'
];

export function installAuthFetch() {
  const w = window as any;
  if (w.__authFetchInstalled) return;
  w.__authFetchInstalled = true;
  const original = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.pathname : input.url;
    const isApi = url.startsWith('/api/');
    if (!isApi) return original(input, init);

    const headers = new Headers(init?.headers || (typeof input !== 'string' && !(input instanceof URL) ? input.headers : undefined));
    const token = getStoredSessionToken();
    if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);

    const res = await original(input, { ...init, headers });
    const path = url.split('?')[0];
    if (res.status === 401 && token && !OPEN_PATHS.includes(path) && path !== '/api/auth/session') {
      clearSession();
    }
    return res;
  };
}
