## Development

1. Install dependencies

```bash
pnpm install
```

2. To use locally built packages, run the following command:

```bash
pnpm run build
pnpm run link:neon-js
```

3. Add the packages to your project's package.json:

```json
"dependencies": {
  "@neondatabase/neon-js": "link:@neondatabase/neon-js",
  "@neondatabase/postgrest-js": "link:@neondatabase/postgrest-js",
  "@neondatabase/auth": "link:@neondatabase/auth"
}
```

4.  Whenever you make changes to the packages, just run the build command to update the links.

```bash
pnpm run build
```