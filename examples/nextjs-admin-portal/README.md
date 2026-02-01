# Admin Portal - Cross-Subdomain Authentication Demo

This is a demo admin portal built with Next.js App Router and Server Components to demonstrate cross-subdomain authentication using Neon Auth.

## Features

- **Server Components Only**: No client-side UI library, pure Server Components
- **Cross-Subdomain Authentication**: Shares session cookies across subdomains
- **Role-Based Access Control**: Admin-only access with automatic redirection for non-admin users
- **Admin Dashboard**: View current user session details
- **Simple Sign-In**: Email/password authentication using Server Actions

## Quick Start

### Local Development (Single Domain)

```bash
# Install dependencies (from monorepo root)
bun install

# Set up environment
cd examples/nextjs-admin-portal
cp .env.example .env
# Edit .env with your Neon Auth credentials

# Run the dev server
bun dev
```

The app will be available at http://localhost:3001

### Docker Setup (Cross-Subdomain Testing)

To test cross-subdomain cookie sharing, use the Docker Compose setup:

```bash
# From monorepo root
cd examples/cross-domain-cookies
cp .env.docker.example .env
# Edit .env with your credentials

# Add to /etc/hosts (Linux/Mac) or C:\Windows\System32\drivers\etc\hosts (Windows)
127.0.0.1 myapp.local
127.0.0.1 app.myapp.local
127.0.0.1 admin.myapp.local

# Build and start services
docker-compose up --build

# Access the apps
# Main app: http://app.myapp.local
# Admin portal: http://admin.myapp.local
```

## How It Works

### Server Components

All pages use Server Components with `auth.getSession()` to read session data:

```typescript
// Server components using `auth` methods must be rendered dynamically
export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const { data: session } = await auth.getSession();
  // ...
}
```

### Server Actions

Authentication uses Server Actions for sign-in:

```typescript
async function signIn(formData: FormData) {
  'use server';

  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  const { error } = await auth.signIn.email({ email, password });
  if (error) {
    // Handle error
    return;
  }

  redirect('/admin');
}
```

### Cross-Subdomain Cookies

When `COOKIE_DOMAIN` is set to `.myapp.local` (or `.yourdomain.com` in production), cookies are shared across all subdomains:

```typescript
// lib/auth/server.ts
export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL!,
  cookies: {
    secret: process.env.NEON_AUTH_COOKIE_SECRET!,
    domain: process.env.COOKIE_DOMAIN || undefined, // .myapp.local
  },
});
```

## Role-Based Access Control

This admin portal implements role-based access control to ensure only administrators can access it:

### How It Works

1. **Sign-In Check**: After successful authentication, the app checks if `session.user.role === 'admin'`
2. **Admin Dashboard Check**: The admin page verifies the role before rendering
3. **Non-Admin Redirect**: Users without admin role are automatically redirected to `http://localhost:3000` (main app)

### Implementation

```typescript
// app/actions.ts
const { data: session } = await auth.getSession();

if (session.user.role !== 'admin') {
  redirect('http://localhost:3000'); // Redirect to main app
}
```

```typescript
// app/admin/page.tsx
if (session.user.role !== 'admin') {
  redirect('http://localhost:3000');
}
```

### Setting User Roles

To set a user as admin in your Neon Auth database:

```sql
UPDATE "user" SET role = 'admin' WHERE email = 'admin@example.com';
```

Or use the Better Auth admin API:

```typescript
await auth.admin.setRole({
  userId: 'user-id',
  role: 'admin',
});
```

## Testing Cross-Subdomain Authentication

1. Start both apps using Docker Compose
2. Sign in on the main app at http://app.myapp.local
3. Navigate to http://admin.myapp.local
4. You should be automatically signed in with the same session
5. **If you're an admin**: Access granted to admin dashboard
6. **If you're not an admin**: Automatically redirected to main app
7. Sign out from either app - you'll be signed out from both

## Architecture

```
examples/nextjs-admin-portal/
├── app/
│   ├── admin/              # Protected admin dashboard
│   │   └── page.tsx        # Server Component with session display
│   ├── auth/
│   │   └── sign-in/
│   │       └── page.tsx    # Sign-in form with Server Action
│   ├── api/
│   │   └── auth/[...path]/ # Auth API handler
│   │       └── route.ts
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Home page
│   └── globals.css         # Tailwind styles
├── lib/
│   ├── auth/
│   │   └── server.ts       # Auth configuration
│   └── utils.ts            # Utility functions
├── middleware.ts           # Route protection
└── Dockerfile              # Docker build config
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEON_AUTH_BASE_URL` | Neon Auth service URL | Yes |
| `NEON_AUTH_COOKIE_SECRET` | Cookie encryption secret (32+ chars) | Yes |
| `COOKIE_DOMAIN` | Cookie domain for cross-subdomain (e.g., `.myapp.local`) | No |

## Related Examples

- `examples/nextjs-neon-auth/` - Main Next.js app with full UI and Drizzle ORM
- `examples/react-neon-js/` - React + Vite example with auth UI

## Learn More

- [Neon Auth Documentation](../../packages/auth/README.md)
- [Next.js Integration Guide](../../packages/auth/NEXT-JS.md)
- [Docker Setup](../cross-domain-cookies/)
