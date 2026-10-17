import { registerSchema } from './auth.schema.js';
import { registerUser } from './auth.service.js';
import { loginSchema } from './auth.schema.js';
import { loginUser } from './auth.service.js';
import { pool } from '../../db.js';

export async function register(req, res) {
  const validation = registerSchema.safeParse(req.body);

  if (!validation.success) {
    return res.status(400).json({
      error: 'Invalid registration data',
      details: validation.error.issues,
    });
  }

  try {
    const user = await registerUser(validation.data);

    return res.status(201).json({
      message: 'Account created successfully',
      user,
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({
        error: 'Email already registered',
      });
    }

    console.error('Registration failed:', error);

    return res.status(500).json({
      error: 'Internal server error',
    });
  }
}

export async function login(req, res) {
  const validation = loginSchema.safeParse(req.body);

  if (!validation.success) {
    return res.status(400).json({
      error: 'Invalid login data',
    });
  }

  try {
    const { email, password } = validation.data;

    const result = await loginUser(email, password);

    if (!result) {
      return res.status(401).json({
        error: 'Invalid email or password',
      });
    }

    // Send session token in HTTP-only cookie
    res.cookie('session', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    return res.status(200).json({
      message: 'Login successful',
      user: result.user,
    });

  } catch (error) {
    console.error('Login failed:', error);

    return res.status(500).json({
      error: 'Internal server error',
    });
  }
}

export function getCurrentUser(req, res) {
  return res.status(200).json({
    user: req.user,
  });
}

export async function logout(req, res, next) {
  try {
    await pool.query(
      `UPDATE auth_sessions
       SET revoked_at = NOW()
       WHERE token_hash = $1
         AND revoked_at IS NULL`,
      [req.sessionTokenHash]
    );

    res.clearCookie('session', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return res.status(200).json({
      message: 'Logout successful',
    });
  } catch (error) {
    next(error);
  }
}