import { getUser } from './utils.js';

/** An error response from the Node server: status, a short code, and a message. */
export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
  }
}

let available = false;

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* empty or non-JSON body */
  }
  if (!res.ok) throw new ApiError(res.status, data?.error ?? `http_${res.status}`, data?.message ?? res.statusText);
  return data as T;
}

/**
 * Talks to the Node server when it is there. When the pages are opened from any
 * other kind of web server, `available` stays false and the store keeps working
 * on its own, exactly as before.
 */
export const api = {
  get available(): boolean {
    return available;
  },
  async detect(): Promise<boolean> {
    try {
      const res = await fetch('/api/health', { signal: AbortSignal.timeout(1500) });
      available = res.ok && ((await res.json()) as { ok?: boolean }).ok === true;
    } catch {
      available = false;
    }
    return available;
  },
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
};

/** True when this visitor is logged in through the Node server (has a real session). */
export const serverSession = (): boolean => available && !!getUser()?.server;
