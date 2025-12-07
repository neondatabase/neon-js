import { handleAuthRequest } from './request';
import { handleAuthResponse } from './response';

type Params = { path: string[] };

export const toNextJsHandler = (baseUrl: string) => {
  const baseURL = baseUrl || process.env.NEON_AUTH_BASE_URL;
  if (!baseURL) {
    throw new Error(
      'You must provide a Neon Auth base URL in the handler options or in the environment variables'
    );
  }

  const handler = async (
    request: Request,
    { params }: { params: Promise<Params> }
  ) => {
    const resolvedParams = await params;
    const path = resolvedParams.path.join('/');
    const response = await handleAuthRequest(baseURL, request, path);
    return await handleAuthResponse(response);
  };

  return {
    GET: handler,
    POST: handler,
    PUT: handler,
    DELETE: handler,
    PATCH: handler,
  };
};
