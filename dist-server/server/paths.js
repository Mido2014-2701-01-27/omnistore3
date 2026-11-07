import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
/** The project folder (this file compiles to dist-server/server/, two levels down). */
export const ROOT = resolve(fileURLToPath(new URL('../../', import.meta.url)));
export const DATA_DIR = resolve(process.env.DATA_DIR || join(ROOT, 'data'));
export const MIGRATIONS_DIR = join(ROOT, 'database', 'migrations');
//# sourceMappingURL=paths.js.map