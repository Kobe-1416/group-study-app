import { pool } from '../db.js';

export async function requireGroupMember(req, res, next) {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT role
       FROM group_members
       WHERE group_id = $1
         AND user_id = $2`,
      [groupId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Group not found',
      });
    }

    req.groupRole = result.rows[0].role;

    next();
  } catch (error) {
    if (error.code === '22P02') {
      return res.status(400).json({
        error: 'Invalid group ID',
      });
    }

    next(error);
  }
}