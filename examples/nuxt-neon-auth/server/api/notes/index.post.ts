import { useDatabase } from '../../database/client';
import { notes } from '../../database/schema';

export default defineEventHandler(async (event) => {
  const session = await requireUser(event);
  const body = await readBody<{ title?: unknown }>(event);
  const title = typeof body.title === 'string' ? body.title.trim() : '';

  if (!title) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Title is required',
    });
  }

  const [note] = await useDatabase(event)
    .insert(notes)
    .values({ title, userId: session.user.id })
    .returning();

  setResponseStatus(event, 201);
  return note;
});
