export const onRequest: PagesFunction = async (context) => {
  const response = await context.next();
  response.headers.set("X-Rawkode", "I AM HERE");
  return response;
};
