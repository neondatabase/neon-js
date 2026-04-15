import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  webpack: (config) => {
    // Optional captcha SDKs — the auth UI bundle dynamically imports them
    // but they're not needed for this example. Alias to false so webpack
    // resolves them as empty modules instead of recursing into shims.
    for (const pkg of [
      '@captchafox/react',
      '@hcaptcha/react-hcaptcha',
      '@marsidev/react-turnstile',
      'react-google-recaptcha',
      '@wojtekmaj/react-recaptcha-v3',
    ]) {
      config.resolve.alias[pkg] = false;
    }
    return config;
  },
};

export default nextConfig;
