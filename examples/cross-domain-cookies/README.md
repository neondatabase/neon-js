# Cross-Domain Cookies Example

This directory contains Docker setup files for testing cross-subdomain authentication with Neon Auth.

## What's This?

This example demonstrates how to share authentication sessions across multiple subdomains using Neon Auth. It sets up two Next.js applications (main app and admin portal) that share cookies across `*.myapp.local` subdomains.

## Quick Start

See [DOCKER-QUICKSTART.md](./DOCKER-QUICKSTART.md) for a 5-minute setup guide.

## Full Documentation

- **[DOCKER-QUICKSTART.md](./DOCKER-QUICKSTART.md)** - Quick setup guide (5 minutes)
- **[DOCKER-TESTING.md](./DOCKER-TESTING.md)** - Complete documentation with architecture details

## Files

- `docker-compose.yml` - Docker Compose configuration for multi-app setup
- `nginx.conf` - Nginx reverse proxy for subdomain routing
- `generate-certs.sh` - SSL certificate generation script
- `.env.docker.example` - Environment variables template
- `certs/` - Generated SSL certificates (gitignored)

## Testing Scenarios

1. **Cross-subdomain authentication** - Sign in on one subdomain, automatically signed in on others
2. **Role-based access control** - Admin-only portal with automatic redirection
3. **Session persistence** - Shared session across multiple apps
4. **Sign out propagation** - Sign out from one app, signed out from all

## Related Examples

- [examples/nextjs-neon-auth/](../nextjs-neon-auth/) - Main Next.js app
- [examples/nextjs-admin-portal/](../nextjs-admin-portal/) - Admin portal

## Learn More

- [Neon Auth Documentation](../../packages/auth/README.md)
- [Next.js Integration Guide](../../packages/auth/NEXT-JS.md)
