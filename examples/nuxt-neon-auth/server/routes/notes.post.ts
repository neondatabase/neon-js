import { useDatabase } from '../database/client';
import { notes } from '../database/schema';

export default defineEventHandler(async (event) => {
  const session = await requireUser(event);
  const form = await readFormData(event);
  const value = form.get('title');
  const title = typeof value === 'string' ? value.trim() : '';

  if (!title) {
    return sendRedirect(event, '/notes?error=missing-title', 303);
  }

  await useDatabase(event)
    .insert(notes)
    .values({ title, userId: session.user.id });

  return sendRedirect(event, '/notes', 303);
});
