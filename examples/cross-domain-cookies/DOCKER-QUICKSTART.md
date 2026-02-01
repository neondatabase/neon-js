# Docker Quick Start

Quick guide to get the cross-subdomain demo running.

## Prerequisites

- Docker and Docker Compose installed
- Neon Auth credentials (project URL and cookie secret)

## Setup (5 minutes)

**Important:** All commands should be run from this directory (`examples/cross-domain-cookies/`)

### 1. Generate SSL certificates

The setup requires HTTPS because Neon Auth uses `__Secure-` prefixed cookies.

```bash
./generate-certs.sh
```

**Trust the certificate in your browser:**
- **macOS**: `sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ./certs/fullchain.pem`
- **Linux**: `sudo cp ./certs/fullchain.pem /usr/local/share/ca-certificates/myapp.local.crt && sudo update-ca-certificates`
- **Windows**: Import `certs/fullchain.pem` into "Trusted Root Certification Authorities"

Or simply accept the self-signed certificate warning in your browser when you first visit the site.

### 2. Create environment file

```bash
# Copy the example
cp .env.docker.example .env

# Edit with your credentials
nano .env
```

Fill in:
```env
NEON_AUTH_BASE_URL=https://your-project.neon.tech
NEON_AUTH_COOKIE_SECRET=your-secret-at-least-32-characters-long
DATABASE_URL=postgresql://user:password@host/database
COOKIE_DOMAIN=.myapp.local
```

### 3. Configure hosts file

**Linux/Mac:**
```bash
sudo nano /etc/hosts
```

**Windows:**
Open `C:\Windows\System32\drivers\etc\hosts` as Administrator

Add these lines:
```
127.0.0.1 myapp.local
127.0.0.1 app.myapp.local
127.0.0.1 admin.myapp.local
```

### 4. Build and run

```bash
docker-compose up --build
```

Or run in background:
```bash
docker-compose up -d --build
```

### 5. Access the apps

- **Main App**: https://app.myapp.local (redirects from HTTP)
- **Admin Portal**: https://admin.myapp.local (redirects from HTTP)

**Note**: You'll see a certificate warning on first visit. Click "Advanced" → "Proceed" to accept the self-signed certificate.

## Testing Cross-Subdomain Auth

1. Sign in on the main app (https://app.myapp.local)
2. Open admin portal (https://admin.myapp.local) in same browser
3. **If admin**: You're automatically signed in ✅
4. **If not admin**: Redirected to main app ✅

The `__Secure-` prefixed cookies will now work correctly over HTTPS!

## Troubleshooting

### "Variable is not set" warnings

You're seeing these because Docker Compose can't find the `.env` file:
```
WARN[0000] The "NEON_AUTH_BASE_URL" variable is not set
```

**Solutions:**
1. Make sure `.env` exists: `ls -la .env`
2. Make sure you're in the `examples/cross-domain-cookies/` directory when running `docker-compose`
3. Or specify the file explicitly: `docker-compose --env-file .env up`

### Cannot access myapp.local domains

1. Verify hosts file entries: `ping app.myapp.local`
2. Restart browser after editing hosts file
3. Clear browser cache and cookies

### Cookies not shared

1. Check `COOKIE_DOMAIN=.myapp.local` in `.env` (note the leading dot)
2. Verify both apps are accessed via subdomain URLs, not localhost:port
3. Check browser DevTools → Application → Cookies for domain

### Port already in use

Stop other services using ports 80, 3000, or 3001:
```bash
# Check what's using the ports
lsof -i :80
lsof -i :3000
lsof -i :3001

# Stop Docker services
docker-compose down
```

## Stopping the Services

```bash
# Stop but keep data
docker-compose down

# Stop and remove volumes
docker-compose down -v

# Stop and remove images
docker-compose down --rmi all
```

## View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f main-app
docker-compose logs -f admin-portal
```

## Full Documentation

See [DOCKER-TESTING.md](./DOCKER-TESTING.md) for complete setup guide and architecture details.
