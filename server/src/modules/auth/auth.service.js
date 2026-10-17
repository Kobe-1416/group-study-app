import argon2 from 'argon2';
import { pool } from '../../db.js';
import crypto from 'node:crypto';

export async function registerUser(data) {
  const { displayName, email, password } = data;

  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
  });

  const result = await pool.query(
    `INSERT INTO users (display_name, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, display_name, email, created_at`,
    [displayName, email, passwordHash]
  );

  return result.rows[0];
}

export async function loginUser(email, password) {
  // 1. Find the user
  const result = await pool.query(
    `SELECT id, email, display_name, password_hash
     FROM users
     WHERE LOWER(email) = $1`,
    [email]
  );

  const user = result.rows[0];

  // 2. Verify the password
  // Use a generic error to avoid revealing account existence.
  if (!user) {
    return null;
  }

  const validPassword = await argon2.verify(
    user.password_hash,
    password
  );

  if (!validPassword) {
    return null;
  }

  // 3. Generate a secure session token
  const token = crypto.randomBytes(32).toString('hex');

  // 4. Hash the token before storing it
  const tokenHash = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');

  // 5. Session expires after 7 days
  const expiresAt = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000
  );

  // 6. Store the session in PostgreSQL
  await pool.query(
    `INSERT INTO auth_sessions
     (token_hash, user_id, expires_at)
     VALUES ($1, $2, $3)`,
    [tokenHash, user.id, expiresAt]
  );

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      display_name: user.display_name,
    },
  };
}