import { describe, it, expect } from 'vitest';
import { defaultDeriveNeonUrls } from '../client/derive-urls';

describe('defaultDeriveNeonUrls', () => {
  it('derives auth and dataApi URLs from a standard Neon base URL', () => {
    const result = defaultDeriveNeonUrls(
      'https://ep-xxx.c-2.us-east-2.aws.neon.build/dbname'
    );
    expect(result).toEqual({
      auth: 'https://ep-xxx.neonauth.c-2.us-east-2.aws.neon.build/dbname/auth',
      dataApi:
        'https://ep-xxx.apirest.c-2.us-east-2.aws.neon.build/dbname/rest/v1',
    });
  });

  it('tolerates a trailing slash on the path', () => {
    const result = defaultDeriveNeonUrls(
      'https://ep-xxx.c-2.us-east-2.aws.neon.build/dbname/'
    );
    expect(result).toEqual({
      auth: 'https://ep-xxx.neonauth.c-2.us-east-2.aws.neon.build/dbname/auth',
      dataApi:
        'https://ep-xxx.apirest.c-2.us-east-2.aws.neon.build/dbname/rest/v1',
    });
  });

  it('preserves a custom port', () => {
    const result = defaultDeriveNeonUrls(
      'https://ep-xxx.c-2.us-east-2.aws.neon.build:8443/dbname'
    );
    expect(result).toEqual({
      auth: 'https://ep-xxx.neonauth.c-2.us-east-2.aws.neon.build:8443/dbname/auth',
      dataApi:
        'https://ep-xxx.apirest.c-2.us-east-2.aws.neon.build:8443/dbname/rest/v1',
    });
  });

  it('preserves a deeper path', () => {
    const result = defaultDeriveNeonUrls(
      'https://ep-xxx.c-2.us-east-2.aws.neon.build/proj/db'
    );
    expect(result).toEqual({
      auth: 'https://ep-xxx.neonauth.c-2.us-east-2.aws.neon.build/proj/db/auth',
      dataApi:
        'https://ep-xxx.apirest.c-2.us-east-2.aws.neon.build/proj/db/rest/v1',
    });
  });

  it('preserves http protocol', () => {
    const result = defaultDeriveNeonUrls(
      'http://ep-xxx.c-2.us-east-2.aws.neon.build/dbname'
    );
    expect(result.auth.startsWith('http://')).toBe(true);
    expect(result.dataApi.startsWith('http://')).toBe(true);
  });

  it('throws when the hostname has fewer than 3 labels', () => {
    expect(() => defaultDeriveNeonUrls('https://example.com/db')).toThrow(
      /Invalid Neon base URL/
    );
  });

  it('throws when the input is not a valid URL', () => {
    expect(() => defaultDeriveNeonUrls('not a url')).toThrow();
  });
});
