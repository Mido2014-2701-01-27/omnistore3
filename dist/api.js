import { getUser } from './utils.js';
/** An error response from the Node server: status, a short code, and a message. */
export class ApiError extends Error {
    status;
    code;
    constructor(status, code, message) {
        super(message);
        this.status = status;
        this.code = code;
    }
}
let available = false;
async function request(method, path, body) {
    const res = await fetch(path, {
        method,
        credentials: 'same-origin',
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    let data = null;
    try {
        data = await res.json();
    }
    catch {
        /* empty or non-JSON body */
    }
    if (!res.ok)
        throw new ApiError(res.status, data?.error ?? `http_${res.status}`, data?.message ?? res.statusText);
    return data;
}
/**
 * Talks to the Node server when it is there. When the pages are opened from any
 * other kind of web server, `available` stays false and the store keeps working
 * on its own, exactly as before.
 */
export const api = {
    get available() {
        return available;
    },
    async detect() {
        try {
            const res = await fetch('/api/health', { signal: AbortSignal.timeout(1500) });
            available = res.ok && (await res.json()).ok === true;
        }
        catch {
            available = false;
        }
        return available;
    },
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body),
    put: (path, body) => request('PUT', path, body),
    del: (path) => request('DELETE', path),
};
/** True when this visitor is logged in through the Node server (has a real session). */
export const serverSession = () => available && !!getUser()?.server;
//# sourceMappingURL=api.js.map