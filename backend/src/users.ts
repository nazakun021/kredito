import db from './db';
import { unauthorized } from './errors';
import type { DbUser, UserWalletRow } from './types/db';

export function loadUserById(userId: number | undefined): DbUser {
  const user = db
    .prepare('SELECT id, stellar_pub, stellar_enc_secret, is_external FROM users WHERE id = ?')
    .get(userId) as DbUser | undefined;

  if (!user) {
    throw unauthorized('User not found. Please log in again.');
  }

  return user;
}

export function loadAllUserWallets(): UserWalletRow[] {
  return db.prepare('SELECT id, stellar_pub FROM users').all() as UserWalletRow[];
}
