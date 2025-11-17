## Development

1. Install dependencies

```bash
bun install
```

2. To use locally built packages, run the following command:

```bash
bun run build
bun run link:neon-js
```

3. Add the packages to your project's package.json:

```json
"dependencies": {
  "@neondatabase/neon-js": "link:@neondatabase/neon-js",
  "@neondatabase/postgrest-js": "link:@neondatabase/postgrest-js",
  "@neondatabase/neon-auth": "link:@neondatabase/neon-auth"
}
```

4.  Whenever you make changes to the packages, just run the build command to update the links.

```bash
bun run build
```