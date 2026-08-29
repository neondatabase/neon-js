export default defineNuxtConfig({
  compatibilityDate: '2026-08-01',
  devtools: { enabled: true },
  modules: ['@nuxt/ui', '@nuxt/eslint'],
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    neonAuthBaseUrl: '',
    neonAuthCookieSecret: '',
    databaseUrl: '',
    cookieDomain: '',
    public: {
      adminPortalUrl: '',
    },
  },
  colorMode: {
    preference: 'system',
    fallback: 'light',
    classSuffix: '',
  },
  icon: {
    provider: 'none',
    serverBundle: false,
    clientBundle: {
      scan: true,
      sizeLimitKb: 128,
    },
  },
  nitro: {
    preset: 'node-server',
  },
  typescript: {
    strict: true,
    typeCheck: true,
  },
  ui: {
    fonts: false,
    experimental: {
      componentDetection: true,
    },
  },
});
