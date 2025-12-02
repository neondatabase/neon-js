import { handleAuthRequest } from "./request";

type Params = { path: string[] }
export const toNextJsHandler = (baseUrl: string) => {
  const handler = async (request: Request, {params}: {params: Promise<Params>}) => {
    const resolvedParams = await params;
    const path = resolvedParams.path.join('/');
    return await handleAuthRequest(baseUrl, request, path)
  }
 

  return {
    GET: handler,
    POST: handler,
    PUT: handler,
    DELETE: handler,
    PATCH: handler,
  }
}



