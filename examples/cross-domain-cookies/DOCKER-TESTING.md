# Docker Setup for Cross-Subdomain Cookie Testing

This guide explains how to test cross-subdomain authentication using Docker Compose with the main app and admin portal.

## Overview

The Docker setup creates two Next.js applications running on different subdomains:
- **Main App** (`app.myapp.local`): Full-featured app with notes, auth UI
- **Admin Portal** (`admin.myapp.local`): Admin dashboard with Server Components

Both apps share authentication cookies via the `.myapp.local` domain, demonstrating single sign-on across subdomains.

## Prerequisites

- Docker and Docker Compose installed
- Neon Auth account with credentials
- Access to modify `/etc/hosts` file (or equivalent)

## Setup Instructions

### 1. Configure Environment Variables

Create `.env` from the example:

```bash
cp .env.docker.example .env
```

Edit `.env` with your credentials:

```bash
# Neon Auth Configuration
NEON_AUTH_BASE_URL=https://your-project.neon.tech
NEON_AUTH_COOKIE_SECRET=your-secret-at-least-32-characters-long

# Database URL (for main app)
DATABASE_URL=postgresql://user:password@host/database

# Cookie domain - MUST be set for cross-subdomain
COOKIE_DOMAIN=.myapp.local
```

**Important:**
- The `COOKIE_DOMAIN` must start with a dot (`.`) to work across subdomains.
- Docker Compose automatically reads `.env` from the current directory. If you want to use a different file, run: `docker-compose --env-file .env.docker up --build`

### 2. Configure Local Domains

Add the following entries to your hosts file:

**Linux/Mac** (`/etc/hosts`):
```bash
sudo nano /etc/hosts

# Add these lines:
127.0.0.1 myapp.local
127.0.0.1 app.myapp.local
127.0.0.1 admin.myapp.local
```

**Windows** (`C:\Windows\System32\drivers\etc\hosts`):
```
127.0.0.1 myapp.local
127.0.0.1 app.myapp.local
127.0.0.1 admin.myapp.local
```

### 3. Build and Start Services

From the `examples/cross-domain-cookies/` directory:

```bash
# Build and start all services
docker-compose up --build

# Or run in background
docker-compose up -d --build
```

This will start:
- `main-app` - Main application on port 3000
- `admin-portal` - Admin portal on port 3001
- `nginx` - Reverse proxy on port 80 for subdomain routing

### 4. Access the Applications

Open your browser and navigate to:
- Main App: http://app.myapp.local
- Admin Portal: http://admin.myapp.local
- Root Domain: http://myapp.local (redirects to main app)

## Testing Cross-Subdomain Authentication

### Test Scenario 1: Sign In on Main App (Admin User)

1. Go to http://app.myapp.local
2. Sign in with admin credentials (user.role = 'admin')
3. Navigate to http://admin.myapp.local
4. You should be automatically signed in and see the admin dashboard
5. Check browser DevTools → Application → Cookies:
   - Cookie domain should be `.myapp.local`
   - Cookie is accessible from both subdomains

### Test Scenario 1b: Sign In as Non-Admin

1. Go to http://admin.myapp.local
2. Sign in with non-admin credentials (user.role ≠ 'admin')
3. You should be automatically redirected to http://localhost:3000 (main app)
4. The admin portal enforces role-based access control

### Test Scenario 2: Sign Out Propagation

1. Sign in on http://app.myapp.local
2. Verify you're signed in on http://admin.myapp.local
3. Sign out from the admin portal
4. Return to http://app.myapp.local
5. You should be signed out there as well

### Test Scenario 3: Session Persistence

1. Sign in on http://app.myapp.local
2. Open a new browser tab
3. Navigate to http://admin.myapp.local in the new tab
4. Session should be available without signing in again

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Browser (Port 80)                     │
│  http://app.myapp.local    http://admin.myapp.local     │
└──────────────────┬────────────────────┬─────────────────┘
                   │                    │
                   │    Nginx Proxy     │
                   │   (Subdomain       │
                   │    Routing)        │
                   │                    │
         ┌─────────▼─────────┐  ┌──────▼──────────┐
         │   Main App        │  │  Admin Portal    │
         │   (Port 3000)     │  │  (Port 3001)     │
         │  Server Components│  │ Server Components│
         └───────────────────┘  └──────────────────┘
                   │                    │
                   │  Shared Cookie     │
                   │  Domain:           │
                   │  .myapp.local      │
                   └────────┬───────────┘
                            │
                   ┌────────▼─────────┐
                   │   Neon Auth      │
                   │   (Remote)       │
                   └──────────────────┘
```

## Docker Services

### main-app

- Built from `examples/nextjs-neon-auth/`
- Runs on port 3000 (internal)
- Accessed via `app.myapp.local`
- Includes Drizzle ORM, notes feature, full auth UI

### admin-portal

- Built from `examples/nextjs-admin-portal/`
- Runs on port 3001 (internal)
- Accessed via `admin.myapp.local`
- Pure Server Components, no UI library

### nginx

- Reverse proxy for subdomain routing
- Routes `app.myapp.local` → main-app:3000
- Routes `admin.myapp.local` → admin-portal:3001
- Handles WebSocket upgrades for Next.js HMR

## Troubleshooting

### Cookies Not Shared Between Subdomains

**Problem:** Signing in on one app doesn't sign in on the other.

**Solutions:**
1. Verify `COOKIE_DOMAIN=.myapp.local` is set in `.env.docker` (note the leading dot)
2. Check hosts file has all three entries
3. Clear browser cookies and restart
4. Verify you're accessing via http://app.myapp.local, not http://localhost:3000

### Cannot Access Subdomains

**Problem:** `myapp.local` or subdomains don't resolve.

**Solutions:**
1. Verify hosts file entries are correct
2. Restart browser after editing hosts file
3. Try `ping app.myapp.local` to verify DNS resolution
4. On Windows, run Command Prompt as Administrator

### Docker Build Fails

**Problem:** Build fails with dependency errors.

**Solutions:**
1. Ensure you're in the `examples/cross-domain-cookies/` directory when running `docker-compose up`
2. Check that `bun.lockb` exists in the monorepo root
3. Try cleaning Docker cache: `docker-compose build --no-cache`
4. Verify all packages are properly built from monorepo root: `bun run build`

### Port Already in Use

**Problem:** Cannot start services due to port conflicts.

**Solutions:**
1. Stop other services using ports 80, 3000, or 3001
2. Modify ports in `docker-compose.yml`:
   ```yaml
   nginx:
     ports:
       - "8080:80"  # Change external port
   ```

## Viewing Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f main-app
docker-compose logs -f admin-portal
docker-compose logs -f nginx
```

## Stopping Services

```bash
# Stop all services
docker-compose down

# Stop and remove volumes
docker-compose down -v

# Stop and remove images
docker-compose down --rmi all
```

## Production Considerations

When deploying to production with a real domain (e.g., `example.com`):

1. **Cookie Domain**: Set to `.example.com` to share across all subdomains
2. **HTTPS**: Use SSL certificates for secure cookies
3. **Cookie Attributes**: Add `Secure` and `SameSite=Lax` flags
4. **Domain Verification**: Ensure DNS is properly configured

Example production config:

```typescript
export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL!,
  cookies: {
    secret: process.env.NEON_AUTH_COOKIE_SECRET!,
    domain: '.example.com', // Shares across app.example.com, admin.example.com
    sessionDataTtl: 300,
  },
});
```

## Advanced: Custom Domain Testing

To test with a different domain name:

1. Edit `docker-compose.yml` and replace `.myapp.local` with your domain
2. Update `nginx.conf` server names
3. Add new entries to hosts file
4. Rebuild: `docker-compose up --build`

## Learn More

- [Admin Portal README](../nextjs-admin-portal/README.md)
- [Next.js Integration Guide](../../packages/auth/NEXT-JS.md)
- [Neon Auth Documentation](../../packages/auth/README.md)
- [Docker Compose Reference](https://docs.docker.com/compose/)
