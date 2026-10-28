import { randomUUID } from 'node:crypto';
export class RequestError extends Error {
  constructor(code, status = 400) {
    super(code);
    this.status = status;
  }
}
export function reportError(
  error,
  req,
  res,
  send,
  logger = (event) => console.error(JSON.stringify(event)),
) {
  const expected =
    error instanceof RequestError ||
    /^(?:Invalid data(?::| keys)|Unknown data key|Invalid workspace|invalid-|too-large|content-type|milestone-|goal-|edit-conflict|record-|duplicate-|unsafe-|unsupported-|unknown-)/i.test(
      error.message ?? '',
    );
  const status = Number.isInteger(error.status) ? error.status : expected ? 400 : 500;
  const requestId = randomUUID();
  res.setHeader('X-Request-Id', requestId);
  if (status >= 500)
    logger({
      level: 'error',
      event: 'request-failed',
      requestId,
      method: req.method,
      path: (req.url ?? '/')
        .split('?')[0]
        .replace(/(\/(?:public|family|widgets)\/)[^/]+/g, '$1:redacted'),
      errorType: error.name ?? 'Error',
      code:
        typeof error.code === 'string'
          ? error.code.replace(/[^\w-]/g, '').slice(0, 80)
          : 'unexpected',
    });
  return send(res, status, {
    error: status >= 500 ? 'server-error' : 'request-rejected',
    requestId,
  });
}
