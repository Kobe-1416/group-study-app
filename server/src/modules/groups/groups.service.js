import crypto from 'node:crypto';
import { pool } from '../../db.js';

export async function createGroup(data, userId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Generate a random join code
    const joinCode = crypto.randomBytes(6)
      .toString('hex')
      .toUpperCase();

    // Create the study group
    const groupResult = await client.query(
      `INSERT INTO study_groups
       (name, description, join_code, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        data.name,
        data.description ?? null,
        joinCode,
        userId,
      ]
    );

    const group = groupResult.rows[0];

    // Add the creator as the owner
    await client.query(
      `INSERT INTO group_members
       (group_id, user_id, role)
       VALUES ($1, $2, 'owner')`,
      [group.id, userId]
    );

    await client.query('COMMIT');

    return group;

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;

  } finally {
    client.release();
  }
}

export async function joinGroup(joinCode, userId) {
  const groupResult = await pool.query(
    `SELECT id, name
     FROM study_groups
     WHERE join_code = $1`,
    [joinCode.toUpperCase()]
  );

  const group = groupResult.rows[0];

  if (!group) {
    return { status: 'not_found' };
  }

  const result = await pool.query(
    `INSERT INTO group_members (group_id, user_id, role)
     VALUES ($1, $2, 'member')
     ON CONFLICT (group_id, user_id) DO NOTHING
     RETURNING group_id, user_id, role, joined_at`,
    [group.id, userId]
  );

  if (result.rows.length === 0) {
    return { status: 'already_member' };
  }

  return {
    status: 'joined',
    group,
    membership: result.rows[0],
  };
}

export async function getUserGroups(userId) {
  const result = await pool.query(
    `SELECT
       g.id,
       g.name,
       g.description,
       g.created_at,
       gm.role,
       gm.joined_at
     FROM study_groups g
     JOIN group_members gm
       ON gm.group_id = g.id
     WHERE gm.user_id = $1
     ORDER BY gm.joined_at DESC`,
    [userId]
  );

  return result.rows;
}

export async function getGroupById(groupId) {
  const result = await pool.query(
    `SELECT
       id,
       name,
       description,
       join_code,
       created_by,
       created_at
     FROM study_groups
     WHERE id = $1`,
    [groupId]
  );

  return result.rows[0] ?? null;
}

export async function getGroupMembers(groupId) {
  const result = await pool.query(
    `SELECT
       u.id,
       u.display_name,
       gm.role,
       gm.joined_at
     FROM group_members gm
     JOIN users u ON u.id = gm.user_id
     WHERE gm.group_id = $1
     ORDER BY
       CASE WHEN gm.role = 'owner' THEN 0 ELSE 1 END,
       gm.joined_at ASC`,
    [groupId]
  );

  return result.rows;
}