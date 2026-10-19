// Adds the login token to every /api request and signs out on 401.
import { getStoredSessionToken, clearSession } from './sessionService';

const OPEN_PATHS = [
  '/api/auth/login',
  '/api/auth/verify-mfa',
  '/api/auth/google-login',
  '/api/auth/signup-init',
  '/api/auth/signup-verify'
];

const nativeFetch: typeof fetch =
  typeof window !== 'undefined' && typeof window.fetch === 'function'
    ? window.fetch.bind(window)
    : globalThis.fetch.bind(globalThis);

export async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.pathname : input.url;
  const isApi = url.startsWith('/api/');
  if (!isApi) return nativeFetch(input, init);

  const headers = new Headers(
    init?.headers || (typeof input !== 'string' && !(input instanceof URL) ? input.headers : undefined)
  );
  const token = getStoredSessionToken();
  if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);

  const res = await nativeFetch(input, { ...init, headers });
  const path = url.split('?')[0];
  if (res.status === 401 && token && !OPEN_PATHS.includes(path) && path !== '/api/auth/session') {
    clearSession();
  }
  return res;
}

export function installAuthFetch() {
  if (typeof window === 'undefined') return;
  const w = window as any;
  if (w.__authFetchInstalled) return;
  w.__authFetchInstalled = true;

  try {
    Object.defineProperty(window, 'fetch', {
      value: authFetch,
      writable: true,
      configurable: true
    });
  } catch {
    // In sandboxed iframe environments where window.fetch is a non-configurable getter,
    // api.ts and bizStore.ts import authFetch directly.
  }
}
