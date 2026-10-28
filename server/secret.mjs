import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
export function secretBox(encoded) {
  const key =
    typeof encoded === 'string' && /^[a-f0-9]{64}$/i.test(encoded)
      ? Buffer.from(encoded, 'hex')
      : null;
  return {
    ready: !!key,
    seal(value) {
      if (!key) throw Error('encryption-not-configured');
      const iv = randomBytes(12),
        cipher = createCipheriv('aes-256-gcm', key, iv);
      const data = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
      return [
        iv.toString('base64url'),
        cipher.getAuthTag().toString('base64url'),
        data.toString('base64url'),
      ].join('.');
    },
    open(value) {
      if (!key) throw Error('encryption-not-configured');
      const [iv, tag, data] = value.split('.').map((x) => Buffer.from(x, 'base64url'));
      const decipher = createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      return JSON.parse(Buffer.concat([decipher.update(data), decipher.final()]).toString());
    },
  };
}
