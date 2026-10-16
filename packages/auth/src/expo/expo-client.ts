import type { BetterAuthClientPlugin } from 'better-auth/client';
import { FORCE_FETCH_HEADER } from '../core/adapter-core';
import { NEON_AUTH_SESSION_VERIFIER_PARAM_NAME } from '../core/constants';

type ExpoStorage = {
  deleteItemAsync: (key: string) => Promise<void>;
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
};

type ExpoAuthSessionResult = { type: string; url?: string };

type ExpoWebBrowser = {
  openAuthSessionAsync: (
    url: string,
    redirectUrl: string,
    options?: { preferUniversalLinks?: boolean }
  ) => Promise<ExpoAuthSessionResult>;
};

export type NeonExpoClientOptions = {
  /** The custom URL scheme configured in the Expo app config. */
  scheme: string;
  storageKey: string;
  /** Expo SecureStore, or a compatible async storage implementation. */
  storage: ExpoStorage;
  /** Expo WebBrowser, or a compatible auth-session implementation. */
  browser: ExpoWebBrowser;
};

type StoredCookie = {
  value: string;
  expires: string | null;
};

const STORAGE_CHUNK_SIZE = 1800;
const STORAGE_CHUNK_MARKER = 'chunks:';
const EXPO_ORIGIN_HEADER = 'X-Neon-Expo-Origin';

type SetCookie = {
  name: string;
  value: string;
  maxAge?: number;
  expires?: Date;
};

async function readStorage(
  storage: ExpoStorage,
  key: string
): Promise<string | null> {
  const value = await storage.getItemAsync(key);
  if (!value?.startsWith(STORAGE_CHUNK_MARKER)) {
    return value;
  }

  const count = Number(value.slice(STORAGE_CHUNK_MARKER.length));
  if (!Number.isInteger(count) || count < 1) {
    return null;
  }

  let result = '';
  for (let index = 0; index < count; index += 1) {
    const chunk = await storage.getItemAsync(`${key}.${index}`);
    if (chunk === null) {
      return null;
    }
    result += chunk;
  }
  return result;
}

async function writeStorage(
  storage: ExpoStorage,
  key: string,
  value: string
): Promise<void> {
  const current = await storage.getItemAsync(key);
  const previousCount = current?.startsWith(STORAGE_CHUNK_MARKER)
    ? Number(current.slice(STORAGE_CHUNK_MARKER.length))
    : 0;

  if (value.length <= STORAGE_CHUNK_SIZE) {
    await storage.setItemAsync(key, value);
    for (let index = 0; index < previousCount; index += 1) {
      await storage.deleteItemAsync(`${key}.${index}`);
    }
    return;
  }

  const count = Math.ceil(value.length / STORAGE_CHUNK_SIZE);
  await storage.setItemAsync(key, '');
  for (let index = 0; index < count; index += 1) {
    const start = index * STORAGE_CHUNK_SIZE;
    await storage.setItemAsync(
      `${key}.${index}`,
      value.slice(start, start + STORAGE_CHUNK_SIZE)
    );
  }
  await storage.setItemAsync(key, `${STORAGE_CHUNK_MARKER}${count}`);
  for (let index = count; index < previousCount; index += 1) {
    await storage.deleteItemAsync(`${key}.${index}`);
  }
}

function isNativeRuntime(): boolean {
  return (
    typeof globalThis.navigator !== 'undefined' &&
    globalThis.navigator.product === 'ReactNative'
  );
}

function normalizeScheme(scheme: string): string {
  return scheme.replace(/:(?:\/\/)?$/, '');
}

function toCallbackURL(scheme: string, callbackURL?: string): string {
  if (callbackURL && /^[a-z][a-z\d+.-]*:/i.test(callbackURL)) {
    return callbackURL;
  }
  return `${normalizeScheme(scheme)}://${callbackURL?.replace(/^\/+/, '') ?? ''}`;
}

function toRequestOrigin(scheme: string, callbackURL: string): string {
  return (
    callbackURL.match(/^https?:\/\/[^/]+/i)?.[0] ??
    `${normalizeScheme(scheme)}://`
  );
}

function decode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function splitSetCookieHeader(header: string): string[] {
  const cookies: string[] = [];
  let start = 0;

  for (let index = 0; index < header.length; index += 1) {
    if (header[index] !== ',') {
      continue;
    }
    let separator = index + 1;
    while (header[separator] === ' ') {
      separator += 1;
    }
    while (
      separator < header.length &&
      !['=', ';', ','].includes(header[separator]!)
    ) {
      separator += 1;
    }
    if (header[separator] === '=') {
      cookies.push(header.slice(start, index).trim());
      start = index + 1;
    }
  }

  cookies.push(header.slice(start).trim());
  return cookies.filter(Boolean);
}

function parseSetCookies(header: string): SetCookie[] {
  return splitSetCookieHeader(header).flatMap((cookieString) => {
    const [nameValue = '', ...attributes] = cookieString
      .split(';')
      .map((part) => part.trim());
    const separator = nameValue.indexOf('=');
    if (separator < 1) {
      return [];
    }

    const name = nameValue.slice(0, separator);
    let value = nameValue.slice(separator + 1);
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    value = decode(value);

    const cookie: SetCookie = { name, value };
    for (const attribute of attributes) {
      const [attributeName, ...attributeValue] = attribute.split('=');
      const normalizedName = attributeName?.trim().toLowerCase();
      const normalizedValue = attributeValue.join('=').trim();
      if (normalizedName === 'max-age') {
        const maxAge = Number.parseInt(normalizedValue, 10);
        if (!Number.isNaN(maxAge)) {
          cookie.maxAge = maxAge;
        }
      } else if (normalizedName === 'expires') {
        cookie.expires = new Date(normalizedValue);
      }
    }
    return [cookie];
  });
}

function isAuthCookie(name: string): boolean {
  const normalizedName = name.replace(/^__Secure-/, '');
  return (
    normalizedName === 'neon-auth' ||
    normalizedName.startsWith('neon-auth.')
  );
}

function parseStoredCookies(
  value: string | null
): Record<string, StoredCookie> {
  if (!value) {
    return {};
  }
  try {
    return JSON.parse(value) as Record<string, StoredCookie>;
  } catch {
    return {};
  }
}

function toCookieHeader(cookies: Record<string, StoredCookie>): string {
  const now = Date.now();
  return Object.entries(cookies)
    .filter(([, cookie]) => {
      return !cookie.expires || new Date(cookie.expires).getTime() > now;
    })
    .map(([name, cookie]) => `${name}=${encodeURIComponent(cookie.value)}`)
    .join('; ');
}

async function updateStoredCookies(
  storage: ExpoStorage,
  storageKey: string,
  setCookieHeader: string
): Promise<boolean> {
  const previous = parseStoredCookies(await readStorage(storage, storageKey));
  const next = { ...previous };
  let sessionChanged = false;
  const now = Date.now();

  for (const [name, cookie] of Object.entries(next)) {
    if (cookie.expires && new Date(cookie.expires).getTime() <= now) {
      delete next[name];
    }
  }

  for (const cookie of parseSetCookies(setCookieHeader)) {
    if (!isAuthCookie(cookie.name)) {
      continue;
    }

    const previousValue = previous[cookie.name]?.value;
    const maxAge = cookie.maxAge;
    let expires = cookie.expires ?? null;
    if (maxAge !== undefined) {
      expires = new Date(Date.now() + Number(maxAge) * 1000);
    }
    if (expires && Number.isNaN(expires.getTime())) {
      expires = null;
    }
    const shouldDelete =
      (maxAge !== undefined && Number(maxAge) <= 0) ||
      (expires !== null && expires.getTime() <= Date.now());

    if (shouldDelete) {
      delete next[cookie.name];
    } else {
      next[cookie.name] = {
        value: cookie.value,
        expires: expires?.toISOString() ?? null
      };
    }

    if (
      cookie.name.includes('session_token') &&
      previousValue !== next[cookie.name]?.value
    ) {
      sessionChanged = true;
    }
  }

  await writeStorage(storage, storageKey, JSON.stringify(next));
  return sessionChanged;
}

function parseRequestBody(body: unknown): Record<string, unknown> {
  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return body && typeof body === 'object'
    ? (body as Record<string, unknown>)
    : {};
}

function getQueryParameter(url: string, name: string): string | null {
  const query = url.split('?')[1]?.split('#')[0];
  if (!query) {
    return null;
  }
  for (const parameter of query.split('&')) {
    const [key, ...value] = parameter.split('=');
    if (decode((key ?? '').replaceAll('+', ' ')) === name) {
      return decode(value.join('=').replaceAll('+', ' '));
    }
  }
  return null;
}

export function neonExpoClient(
  options: NeonExpoClientOptions
): BetterAuthClientPlugin {
  const storageKey = options.storageKey;
  const native = isNativeRuntime();
  let cookieWrite = Promise.resolve();
  let clientFetch:
    | Parameters<NonNullable<BetterAuthClientPlugin['getActions']>>[0]
    | undefined;
  let clientStore:
    | Parameters<NonNullable<BetterAuthClientPlugin['getActions']>>[1]
    | undefined;

  return {
    id: 'neon-expo',
    getActions($fetch, $store) {
      clientFetch = $fetch;
      clientStore = $store;
      return {};
    },
    fetchPlugins: [
      {
        id: 'neon-expo',
        name: 'Neon Expo',
        async init(url, fetchOptions) {
          if (!native) {
            return { url, options: fetchOptions };
          }

          const requestOptions = fetchOptions ?? {};
          const headers = {
            ...(requestOptions.headers as Record<string, string | undefined>)
          };
          let origin =
            headers[EXPO_ORIGIN_HEADER] ??
            `${normalizeScheme(options.scheme)}://`;
          delete headers[EXPO_ORIGIN_HEADER];
          const body = parseRequestBody(requestOptions.body);
          if (url.includes('/sign-in/social')) {
            const callbackURL = toCallbackURL(
              options.scheme,
              typeof body.callbackURL === 'string'
                ? body.callbackURL
                : undefined
            );
            body.callbackURL = callbackURL;
            body.disableRedirect = true;
            requestOptions.body = body;
            origin = toRequestOrigin(options.scheme, callbackURL);
          }

          const cookies = parseStoredCookies(
            await readStorage(options.storage, storageKey)
          );
          const cookieHeader = toCookieHeader(cookies);

          requestOptions.credentials = 'omit';
          if (cookieHeader) {
            headers.cookie = cookieHeader;
          }
          headers.origin = origin;
          headers.referer = origin;
          requestOptions.headers = headers;

          return { url, options: requestOptions };
        },
        hooks: {
          async onSuccess(context) {
            if (!native) {
              return;
            }

            const setCookie = context.response.headers.get('set-cookie');
            if (setCookie) {
              let sessionChanged = false;
              const write = cookieWrite.then(async () => {
                sessionChanged = await updateStoredCookies(
                  options.storage,
                  storageKey,
                  setCookie
                );
              });
              cookieWrite = write.catch(() => {});
              await write;
              if (sessionChanged) {
                clientStore?.notify('$sessionSignal');
              }
            }

            const requestURL = context.request.url.toString();
            const data = context.data as
              | { redirect?: boolean; url?: string }
              | undefined;
            if (
              !requestURL.includes('/sign-in/social') ||
              !data?.redirect ||
              !data.url
            ) {
              return;
            }

            const body = parseRequestBody(context.request.body);
            const callbackURL = toCallbackURL(
              options.scheme,
              typeof body.callbackURL === 'string'
                ? body.callbackURL
                : undefined
            );
            const result = callbackURL.startsWith('https://')
              ? await options.browser.openAuthSessionAsync(
                  data.url,
                  callbackURL,
                  { preferUniversalLinks: true }
                )
              : await options.browser.openAuthSessionAsync(
                  data.url,
                  callbackURL
                );
            if (result.type !== 'success' || !result.url) {
              return;
            }

            const oauthError = getQueryParameter(result.url, 'error');
            if (oauthError) {
              const description = getQueryParameter(
                result.url,
                'error_description'
              );
              throw new Error(
                description ?? `Neon Auth OAuth failed: ${oauthError}`
              );
            }

            const verifier = getQueryParameter(
              result.url,
              NEON_AUTH_SESSION_VERIFIER_PARAM_NAME
            );
            if (!verifier) {
              throw new Error(
                'Neon Auth completed OAuth without returning a session verifier'
              );
            }
            if (!clientFetch) {
              throw new Error('Neon Expo client was not initialized');
            }

            const sessionResult = await clientFetch('/get-session', {
              method: 'GET',
              query: { [NEON_AUTH_SESSION_VERIFIER_PARAM_NAME]: verifier },
              headers: {
                [EXPO_ORIGIN_HEADER]: toRequestOrigin(
                  options.scheme,
                  callbackURL
                ),
                [FORCE_FETCH_HEADER]: '1'
              }
            });
            if (sessionResult.error) {
              throw sessionResult.error;
            }
          }
        }
      }
    ]
  } satisfies BetterAuthClientPlugin;
}
