export default defineEventHandler(async (event) => {
  return createEventAuth(event).handler()(event);
});
