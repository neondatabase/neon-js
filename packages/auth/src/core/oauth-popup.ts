import { OAUTH_POPUP_MESSAGE_TYPE } from './constants';

/** Result from the OAuth popup containing the session verifier */
export interface OAuthPopupResult {
  /** The session verifier token from the OAuth callback */
  verifier: string | null;
}

/**
 * Opens an OAuth popup window and waits for completion.
 *
 * This is used when the app is running inside an iframe, where OAuth
 * redirect flows don't work due to X-Frame-Options/CSP restrictions.
 * The popup completes the OAuth flow and sends a postMessage back
 * with the session verifier needed to fetch the session.
 *
 * @param url - The OAuth authorization URL to open in the popup
 * @returns Promise that resolves with the session verifier when OAuth completes
 * @throws Error if popup is blocked by the browser
 */
export async function openOAuthPopup(url: string): Promise<OAuthPopupResult> {
  return new Promise((resolve, reject) => {
    const popup = globalThis.open(
      url,
      'neon_oauth_popup',
      'width=500,height=700,popup=yes'
    );

    if (!popup) {
      reject(new Error('Popup blocked. Please allow popups for this site.'));
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === OAUTH_POPUP_MESSAGE_TYPE) {
        globalThis.removeEventListener('message', handleMessage);
        resolve({ verifier: event.data.verifier || null });
      }
    };

    globalThis.addEventListener('message', handleMessage);
    // If user closes popup manually, Promise hangs - they can retry
  });
}
