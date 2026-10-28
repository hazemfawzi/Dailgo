import { encryptBackup, decryptBackup } from './backupCrypto.mjs';
import { recordStore } from './recordStore.mjs';
import { fileURLToPath } from 'node:url';
import { DatabaseSync, backup } from 'node:sqlite';
import { readFileSync, mkdirSync, chmodSync, existsSync, realpathSync, unlinkSync } from 'node:fs';
import { resolve, dirname, isAbsolute } from 'node:path';
import { randomBytes, scryptSync } from 'node:crypto';
import { readConfig } from './config.mjs';
export async function backupDatabase(source, directory, { encryptionKey } = {}) {
  if (encryptionKey && !/^[a-f0-9]{64}$/i.test(encryptionKey))
    throw Error('Invalid backup encryption key');
  if (!isAbsolute(source) || !isAbsolute(directory) || !existsSync(source))
    throw Error('Use absolute paths and an existing database');
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const file = resolve(
    directory,
    'workspace-' +
      new Date().toISOString().replace(/[:.]/g, '-') +
      '-' +
      randomBytes(4).toString('hex') +
      '.sqlite',
  );
  const db = new DatabaseSync(source, { readOnly: true });
  try {
    await backup(db, file);
  } finally {
    db.close();
  }
  chmodSync(file, 0o600);
  const check = new DatabaseSync(file, { readOnly: true });
  try {
    if (Object.values(check.prepare('PRAGMA quick_check').get())[0] !== 'ok')
      throw Error('Backup integrity check failed');
  } finally {
    check.close();
  }
  if (encryptionKey) {
    const encrypted = file + '.enc',
      verified = file + '.verify';
    try {
      await encryptBackup(file, encrypted, encryptionKey);
      await decryptBackup(encrypted, verified, encryptionKey);
      const check = new DatabaseSync(verified, { readOnly: true });
      try {
        if (Object.values(check.prepare('PRAGMA quick_check').get())[0] !== 'ok')
          throw Error('Encrypted backup verification failed');
      } finally {
        check.close();
      }
      unlinkSync(file);
      return encrypted;
    } catch (error) {
      if (existsSync(encrypted)) unlinkSync(encrypted);
      if (existsSync(file)) unlinkSync(file);
      throw error;
    } finally {
      if (existsSync(verified)) unlinkSync(verified);
    }
  }
  return file;
}
export function resetPassword(file, password) {
  if (password.length < 12 || password.length > 200 || !existsSync(file))
    throw Error('Existing database and a 12–200 character password are required');
  const db = new DatabaseSync(file);
  try {
    if (!db.prepare('SELECT id FROM account WHERE id=1').get())
      throw Error('Set up the first account through the application');
    const salt = randomBytes(16).toString('hex');
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('UPDATE account SET salt=?,password=? WHERE id=1').run(
        salt,
        scryptSync(password, salt, 64).toString('hex'),
      );
      db.prepare('DELETE FROM sessions').run();
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  } finally {
    db.close();
  }
}
// Match the executable even when systemd reaches it through current/.
if (
  process.argv[1] &&
  existsSync(process.argv[1]) &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
) {
  process.umask(0o077);
  const config = readConfig();
  const file = config.dbPath;
  if (!file) throw Error('Set PERSONAL_OS_DB to an absolute database path');
  if (process.argv[2] === 'backup') {
    const folder = process.argv[3];
    if (!folder) throw Error('Pass an absolute backup directory');
    await backupDatabase(file, folder, { encryptionKey: process.env.BACKUP_ENCRYPTION_KEY });
    process.stdout.write('Verified database backup created.\n');
  } else if (process.argv[2] === 'project-legacy') {
    const db = new DatabaseSync(file);
    try {
      recordStore(db).projectAll();
    } finally {
      db.close();
    }
    process.stdout.write('Compatibility snapshots updated.\n');
  } else if (process.argv[2] === 'decrypt-backup') {
    const source = process.argv[3],
      destination = process.argv[4];
    if (!source || !destination) throw Error('Pass source and a new destination path');
    await decryptBackup(source, destination, process.env.BACKUP_ENCRYPTION_KEY);
    process.stdout.write('Backup decrypted to the new destination.\n');
  } else if (process.argv[2] === 'reset-password') {
    if (process.stdin.isTTY)
      throw Error('Supply the password through protected standard input, not arguments');
    const password = readFileSync(0, 'utf8').replace(/\r?\n$/, '');
    resetPassword(file, password);
    process.stdout.write('Owner password replaced; owner sessions revoked.\n');
  } else
    throw Error(
      'Supported maintenance commands: backup, decrypt-backup, project-legacy, reset-password',
    );
}
