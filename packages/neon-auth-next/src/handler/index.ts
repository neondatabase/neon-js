import { handleAuthRequest } from "./request";
import { handleAuthResponse } from "./response";

type Params = { path: string[] }
export const toNextJsHandler = (baseUrl: string) => {
  const handler = async (request: Request, {params}: {params: Promise<Params>}) => {
    const resolvedParams = await params;
    const path = resolvedParams.path.join('/');
    const response = await handleAuthRequest(baseUrl, request, path)
    return handleAuthResponse(response)
  }
 

  return {
    GET: handler,
    POST: handler,
    PUT: handler,
    DELETE: handler,
    PATCH: handler,
  }
}



