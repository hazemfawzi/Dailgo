import { isAbsolute, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
export function readConfig(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const port = Number(env.PORT || 8787);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw Error('PORT must be a valid TCP port');
  let origin = '';
  if (env.APP_ORIGIN) {
    const parsed = new URL(env.APP_ORIGIN);
    if (
      parsed.origin !== env.APP_ORIGIN ||
      parsed.username ||
      parsed.password ||
      (production && parsed.protocol !== 'https:')
    )
      throw Error('APP_ORIGIN must be an exact HTTPS origin, without a trailing slash');
    origin = parsed.origin;
  }
  if (production && !origin) throw Error('APP_ORIGIN is required in production');
  if (production && (!env.PERSONAL_OS_DB || !isAbsolute(env.PERSONAL_OS_DB)))
    throw Error('Production needs an absolute PERSONAL_OS_DB path');
  if (production) {
    const publicRoot = resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
    const db = resolve(env.PERSONAL_OS_DB);
    if (db === publicRoot || db.startsWith(publicRoot + sep))
      throw Error('Database must be outside the public dist directory');
  }
  const setupToken = env.PERSONAL_OS_SETUP_TOKEN ?? '';
  if (setupToken && (setupToken.length < 32 || setupToken.startsWith('REPLACE_')))
    throw Error('Setup token must have at least 32 characters');
  return {
    production,
    origin,
    port,
    dbPath: env.PERSONAL_OS_DB,
    setupToken,
    cookieSecure: production,
  };
}
