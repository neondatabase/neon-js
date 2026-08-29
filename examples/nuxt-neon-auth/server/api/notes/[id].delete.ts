import { and, eq } from 'drizzle-orm';

import { useDatabase } from '../../database/client';
import { notes } from '../../database/schema';

export default defineEventHandler(async (event) => {
  const session = await requireUser(event);
  const id = getRouterParam(event, 'id');

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Note ID is required',
    });
  }

  await useDatabase(event)
    .delete(notes)
    .where(and(eq(notes.id, id), eq(notes.userId, session.user.id)));

  return { success: true };
});
