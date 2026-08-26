import { desc, eq } from 'drizzle-orm';

import { useDatabase } from '../../database/client';
import { notes } from '../../database/schema';

export default defineEventHandler(async (event) => {
  const session = await requireUser(event);
  const db = useDatabase(event);

  return db
    .select()
    .from(notes)
    .where(eq(notes.userId, session.user.id))
    .orderBy(desc(notes.createdAt))
    .limit(15);
});
