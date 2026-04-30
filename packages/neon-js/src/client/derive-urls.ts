/**
 * Pure function: given a Neon base URL, returns the corresponding
 * auth and Data API URLs.
 *
 * Wrappers (e.g. @databricks/lakebase-js) can supply a different implementation
 * via the `deriveUrls` option on createClient.
 */
export type DeriveNeonUrls = (baseUrl: string) => {
  auth: string;
  dataApi: string;
};

/**
 * Default URL derivation for Neon endpoints.
 *
 * Insert `neonauth` / `apirest` after the first hostname label and append
 * `/auth` / `/rest/v1` to the path.
 *
 * Example:
 *   https://ep-xxx.c-2.us-east-2.aws.neon.build/dbname
 *     → auth:    https://ep-xxx.neonauth.c-2.us-east-2.aws.neon.build/dbname/auth
 *     → dataApi: https://ep-xxx.apirest.c-2.us-east-2.aws.neon.build/dbname/rest/v1
 */
export const defaultDeriveNeonUrls: DeriveNeonUrls = (baseUrl) => {
  const url = new URL(baseUrl);

  const labels = url.hostname.split('.');
  if (labels.length < 3) {
    throw new Error(
      `Invalid Neon base URL: hostname "${url.hostname}" must have at least 3 dot-separated labels (e.g. ep-xxx.region.tld).`
    );
  }

  const [first, ...rest] = labels;
  const authHost = [first, 'neonauth', ...rest].join('.');
  const dataApiHost = [first, 'apirest', ...rest].join('.');

  const basePath = url.pathname.replace(/\/+$/, '');
  const authPath = `${basePath}/auth`;
  const dataApiPath = `${basePath}/rest/v1`;

  const portSuffix = url.port ? `:${url.port}` : '';

  return {
    auth: `${url.protocol}//${authHost}${portSuffix}${authPath}`,
    dataApi: `${url.protocol}//${dataApiHost}${portSuffix}${dataApiPath}`,
  };
};
