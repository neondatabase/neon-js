import { z } from 'zod';

export const accessTokenSchema = z.object({
  exp: z.number(),
  iat: z.number(),
  sub: z.string(),
  email: z.string().nullable(),
});
