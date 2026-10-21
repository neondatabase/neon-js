import type { BetterAuthClientPlugin } from 'better-auth/client';
import {
  mapOAuth2ResumeResponse,
  type OAuth2ContinueResponse,
  prepareOAuth2Resume,
  type OAuth2ResumeResult,
} from '../core/oauth2-resume';

const CONTINUE_ENDPOINT = '/oauth2/continue';

/**
 * Adds `oauth2.resume()` next to the OAuth provider's own `oauth2.*` calls.
 * The only input is the page's signed query: accepting a target URL here would
 * make the helper an open redirect.
 */
export const oauth2ResumeClient = () => {
  return {
    id: 'oauth2-resume',
    getActions: ($fetch) => ({
      oauth2: {
        resume: async (): Promise<OAuth2ResumeResult> => {
          if (globalThis.window === undefined) return { status: 'not_oauth' };
          const prepared = prepareOAuth2Resume(globalThis.window.location.search);
          if ('result' in prepared) return prepared.result;

          // Sending oauth_query explicitly makes the provider client plugin's
          // fetch hook a no-op for this request, so there is one code path.
          // The adapter's custom fetch throws on non-2xx instead of returning
          // `{ error }`, so a rejection carries the HTTP status.
          let response: OAuth2ContinueResponse;
          try {
            response = (await $fetch<unknown>(CONTINUE_ENDPOINT, {
              method: 'POST',
              body: { selected: true, oauth_query: prepared.oauthQuery },
            })) as OAuth2ContinueResponse;
          } catch (error) {
            response = {
              data: null,
              error: error as OAuth2ContinueResponse['error'],
            };
          }
          return mapOAuth2ResumeResponse(response);
        },
      },
    }),
  } satisfies BetterAuthClientPlugin;
};
