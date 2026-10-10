import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import path from 'path';

export interface AuthenticatedUser {
  id: number;
  workspace_id: number;
  email: string;
  business_name: string;
}

const authDatabase = new DatabaseSync(path.resolve(process.env.INVOICEFLOW_AUTH_PATH || 'invoiceflow-auth.sqlite'));
const sessionLifetimeMs = 30 * 24 * 60 * 60 * 1000;

authDatabase.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS workspaces (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_name TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id INTEGER NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
    email TEXT NOT NULL COLLATE NOCASE UNIQUE,
    password_salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
`);

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function issueSession(user: AuthenticatedUser) {
  const token = randomBytes(32).toString('base64url');
  authDatabase.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
  authDatabase.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .run(hashToken(token), user.id, Date.now() + sessionLifetimeMs);
  return { token, user };
}

export function createAccount(businessName: string, email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const salt = randomBytes(16);
  const passwordHash = scryptSync(password, salt, 64);
  const createdAt = new Date().toISOString();

  authDatabase.exec('BEGIN IMMEDIATE');
  try {
    const workspaceResult = authDatabase.prepare(
      'INSERT INTO workspaces (business_name, created_at) VALUES (?, ?)'
    ).run(businessName.trim(), createdAt);
    const workspaceId = Number(workspaceResult.lastInsertRowid);
    const userResult = authDatabase.prepare(`
      INSERT INTO users (workspace_id, email, password_salt, password_hash, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(workspaceId, normalizedEmail, salt.toString('hex'), passwordHash.toString('hex'), createdAt);
    const user = {
      id: Number(userResult.lastInsertRowid),
      workspace_id: workspaceId,
      email: normalizedEmail,
      business_name: businessName.trim(),
    };
    const session = issueSession(user);
    authDatabase.exec('COMMIT');
    return session;
  } catch (error) {
    authDatabase.exec('ROLLBACK');
    throw error;
  }
}

export function login(email: string, password: string) {
  const row = authDatabase.prepare(`
    SELECT users.id, users.workspace_id, users.email, users.password_salt, users.password_hash,
      workspaces.business_name
    FROM users
    JOIN workspaces ON workspaces.id = users.workspace_id
    WHERE users.email = ? COLLATE NOCASE
  `).get(email.trim()) as (AuthenticatedUser & { password_salt: string; password_hash: string }) | undefined;
  if (!row) return null;

  const salt = Buffer.from(row.password_salt, 'hex');
  const expected = Buffer.from(row.password_hash, 'hex');
  const actual = scryptSync(password, salt, expected.length);
  if (!timingSafeEqual(actual, expected)) return null;

  return issueSession({
    id: row.id,
    workspace_id: row.workspace_id,
    email: row.email,
    business_name: row.business_name,
  });
}

export function getSessionUser(token: string | undefined) {
  if (!token) return null;
  const row = authDatabase.prepare(`
    SELECT users.id, users.workspace_id, users.email, workspaces.business_name
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    JOIN workspaces ON workspaces.id = users.workspace_id
    WHERE sessions.token_hash = ? AND sessions.expires_at > ?
  `).get(hashToken(token), Date.now()) as AuthenticatedUser | undefined;
  return row || null;
}

export function revokeSession(token: string | undefined) {
  if (token) authDatabase.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
}