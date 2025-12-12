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
 * @throws Error if popup is blocked, closed by user, or times out
 */
export async function openOAuthPopup(url: string): Promise<OAuthPopupResult> {
  const timeout = 120_000;
  const pollInterval = 500;

  return new Promise((resolve, reject) => {
    const popup = globalThis.open(
      url,
      'neon_oauth_popup',
      'width=500,height=700,popup=yes'
    );

    if (!popup || popup.closed) {
      reject(new Error('Popup blocked. Please allow popups for this site.'));
      return;
    }

    // Set up timeout - reject after timeout period
    const timeoutId = setTimeout(() => {
      cleanup();
      try {
        popup.close();
      } catch {
        // Ignore errors closing popup (may already be closed)
      }
      reject(new Error('OAuth popup timed out. Please try again.'));
    }, timeout);

    // Poll for popup closure - detect if user closes popup manually
    const pollId = setInterval(() => {
      try {
        if (popup.closed) {
          cleanup();
          reject(new Error('OAuth popup was closed. Please try again.'));
        }
      } catch {
        // Cross-origin access error when popup navigates to OAuth provider
        // This is expected during the OAuth flow, continue waiting
      }
    }, pollInterval);

    // Cleanup function - removes all listeners and timers
    function cleanup() {
      clearTimeout(timeoutId);
      clearInterval(pollId);
      globalThis.removeEventListener('message', handleMessage);
    }

    // Handle postMessage from popup
    function handleMessage(event: MessageEvent) {
      // Security: Validate origin matches current origin
      if (event.origin !== globalThis.location.origin) {
        return; // Ignore messages from other origins
      }

      // Validate message format
      if (event.data?.type !== OAUTH_POPUP_MESSAGE_TYPE) {
        return; // Ignore unrelated messages
      }

      cleanup();
      resolve({ verifier: event.data.verifier || null });
    }

    // Listen for completion message from popup
    globalThis.addEventListener('message', handleMessage);
  });
}
