import { z } from 'zod';

export const createGroupSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional(),
}).strict();

export const joinGroupSchema = z.object({
  joinCode: z.string().trim().min(1).max(20),
}).strict();

