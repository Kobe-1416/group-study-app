import { Router } from 'express';
import { register, login, logout } from './auth.controller.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { getCurrentUser } from './auth.controller.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', requireAuth, getCurrentUser);
router.post('/logout', requireAuth, logout);

export default router;