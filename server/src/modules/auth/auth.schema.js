import { z } from 'zod';

export const registerSchema = z.object({
  displayName: z.string().trim().min(2).max(100),
  email: z.email().trim().toLowerCase().max(320),
  password: z.string().min(12).max(128),
}).strict();

export const loginSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(1),
}).strict();