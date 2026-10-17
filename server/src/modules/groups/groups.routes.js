import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth.js';
import {
  create,
  join,
  list,
  getDetails,
  getMembers,
} from './groups.controller.js';
import { requireGroupMember } from '../../middleware/requireGroupMember.js';


const router = Router();

// All group routes require authentication
router.use(requireAuth);

router.post('/', create);
router.post('/join', join);
router.get('/', list);

router.get(
  '/:groupId',
  requireGroupMember,
  getDetails
);

router.get(
  '/:groupId/members',
  requireGroupMember,
  getMembers
);

export default router;