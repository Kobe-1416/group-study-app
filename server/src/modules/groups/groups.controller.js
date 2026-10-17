import { createGroupSchema } from './groups.schema.js';
import { createGroup } from './groups.service.js';
import { joinGroupSchema } from './groups.schema.js';
import { joinGroup, getUserGroups, getGroupById, getGroupMembers } from './groups.service.js';

export async function create(req, res, next) {
  const validation = createGroupSchema.safeParse(req.body);

  if (!validation.success) {
    return res.status(400).json({
      error: 'Invalid group data',
      details: validation.error.issues,
    });
  }

  try {
    const group = await createGroup(
      validation.data,
      req.user.id
    );

    return res.status(201).json({
      message: 'Study group created successfully',
      group,
    });

  } catch (error) {
    next(error);
  }
}

export async function join(req, res, next) {
  const validation = joinGroupSchema.safeParse(req.body);

  if (!validation.success) {
    return res.status(400).json({
      error: 'Invalid join code',
    });
  }

  try {
    const result = await joinGroup(
      validation.data.joinCode,
      req.user.id
    );

    if (result.status === 'not_found') {
      return res.status(404).json({
        error: 'Invalid group join code',
      });
    }

    if (result.status === 'already_member') {
      return res.status(409).json({
        error: 'You are already a member of this group',
      });
    }

    return res.status(201).json({
      message: 'Joined group successfully',
      group: result.group,
      membership: result.membership,
    });
  } catch (error) {
    next(error);
  }
}

export async function list(req, res, next) {
  try {
    const groups = await getUserGroups(req.user.id);

    return res.status(200).json({
      groups,
    });
  } catch (error) {
    next(error);
  }
}

export async function getDetails(req, res, next) {
  try {
    const group = await getGroupById(req.params.groupId);

    if (!group) {
      return res.status(404).json({
        error: 'Group not found',
      });
    }

    return res.status(200).json({
      group: {
        ...group,
        myRole: req.groupRole,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getMembers(req, res, next) {
  try {
    const members = await getGroupMembers(req.params.groupId);

    return res.status(200).json({
      members,
    });
  } catch (error) {
    next(error);
  }
}