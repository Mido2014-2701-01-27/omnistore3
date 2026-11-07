/** An error that becomes a JSON response: { error: code, message }. */
export class HttpError extends Error {
    status;
    code;
    constructor(status, code, message) {
        super(message ?? code);
        this.status = status;
        this.code = code;
    }
}
export const SECURITY_HEADERS = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), geolocation=(), payment=()',
    // Images may come from any https host (product photos). Scripts only from this server.
    'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com data:",
        "img-src 'self' https: data: blob:",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "frame-ancestors 'none'",
        "form-action 'self'",
    ].join('; '),
};
export function sendJson(res, status, body, headers = {}) {
    const text = JSON.stringify(body);
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(text),
        'Cache-Control': 'no-store',
        ...SECURITY_HEADERS,
        ...headers,
    });
    res.end(text);
}
/** Read and parse a JSON body, refusing anything that is not JSON or is too large. */
export async function readJson(req, limit = 64 * 1024) {
    const type = String(req.headers['content-type'] ?? '');
    if (!type.toLowerCase().startsWith('application/json'))
        throw new HttpError(415, 'json_required', 'Send JSON with Content-Type: application/json.');
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
        const buf = chunk;
        size += buf.length;
        if (size > limit)
            throw new HttpError(413, 'too_large', 'Request body is too large.');
        chunks.push(buf);
    }
    try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
            throw new Error('not an object');
        return parsed;
    }
    catch {
        throw new HttpError(400, 'bad_json', 'The request body is not valid JSON.');
    }
}
export function parseCookies(header) {
    const out = {};
    for (const part of (header ?? '').split(';')) {
        const i = part.indexOf('=');
        if (i < 1)
            continue;
        const key = part.slice(0, i).trim();
        try {
            out[key] = decodeURIComponent(part.slice(i + 1).trim());
        }
        catch {
            /* ignore malformed cookie */
        }
    }
    return out;
}
export function cookieHeader(name, value, opts) {
    return [
        `${name}=${encodeURIComponent(value)}`,
        'Path=/',
        'HttpOnly',
        'SameSite=Lax',
        `Max-Age=${opts.maxAgeSec}`,
        opts.secure ? 'Secure' : '',
    ].filter(Boolean).join('; ');
}
export const clientIp = (req) => req.socket.remoteAddress ?? 'unknown';
// ----- small validators used by the routes -----
export const isInt = (v, min, max) => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
/** Trim, drop control characters and cap the length. */
export const cleanText = (v, max) => typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max) : '';
//# sourceMappingURL=http.js.map