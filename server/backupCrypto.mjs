import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import {
  createReadStream,
  createWriteStream,
  writeFileSync,
  appendFileSync,
  readSync,
  openSync,
  closeSync,
  statSync,
  unlinkSync,
} from 'node:fs';
import { pipeline } from 'node:stream/promises';
const magic = Buffer.from('DAILGO-BACKUP-v1\n');
function key(value) {
  if (typeof value !== 'string' || !/^([a-f0-9]{64})$/i.test(value))
    throw Error('Use a private 32-byte hexadecimal backup encryption key');
  return Buffer.from(value, 'hex');
}
export async function encryptBackup(source, destination, secret) {
  const iv = randomBytes(12),
    cipher = createCipheriv('aes-256-gcm', key(secret), iv);
  writeFileSync(destination, Buffer.concat([magic, iv]), { flag: 'wx', mode: 0o600 });
  try {
    await pipeline(
      createReadStream(source),
      cipher,
      createWriteStream(destination, { flags: 'a', mode: 0o600 }),
    );
    appendFileSync(destination, cipher.getAuthTag());
  } catch (error) {
    unlinkSync(destination);
    throw error;
  }
}
export async function decryptBackup(source, destination, secret) {
  const length = statSync(source).size;
  if (length < magic.length + 28) throw Error('Invalid encrypted backup');
  const fd = openSync(source, 'r');
  const header = Buffer.alloc(magic.length + 12),
    tag = Buffer.alloc(16);
  try {
    readSync(fd, header, 0, header.length, 0);
    readSync(fd, tag, 0, 16, length - 16);
  } finally {
    closeSync(fd);
  }
  if (!header.subarray(0, magic.length).equals(magic)) throw Error('Unsupported encrypted backup');
  const decipher = createDecipheriv('aes-256-gcm', key(secret), header.subarray(magic.length));
  decipher.setAuthTag(tag);
  // Exclusive creation preserves every existing destination, including symlinks.
  const output = createWriteStream(destination, { flags: 'wx', mode: 0o600 });
  let created = false;
  output.once('open', () => {
    created = true;
  });
  try {
    await pipeline(
      createReadStream(source, { start: header.length, end: length - 17 }),
      decipher,
      output,
    );
  } catch (error) {
    if (created) unlinkSync(destination);
    throw error;
  }
}
