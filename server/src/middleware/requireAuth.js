import crypto from 'node:crypto';
import { pool } from '../db.js';

export async function requireAuth(req, res, next) {
  try {
    // Read the session token from the Cookie header
    const cookieHeader = req.headers.cookie || '';

    const sessionCookie = cookieHeader
      .split(';')
      .map(cookie => cookie.trim())
      .find(cookie => cookie.startsWith('session='));

    const token = sessionCookie?.slice('session='.length);

    // Our login generates a 64-character hexadecimal token
    if (!token || !/^[a-f0-9]{64}$/.test(token)) {
      return res.status(401).json({
        error: 'Authentication required',
      });
    }

    // Hash the token to compare against the database
    const tokenHash = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const result = await pool.query(
      `SELECT
         u.id,
         u.email,
         u.display_name
       FROM auth_sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1
         AND s.expires_at > NOW()
         AND s.revoked_at IS NULL`,
      [tokenHash]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: 'Invalid or expired session',
      });
    }

    // Make the authenticated user available to later handlers
    req.user = result.rows[0];
    req.sessionTokenHash = tokenHash;

    next();

  } catch (error) {
    next(error);
  }
}