#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

const replacements = [
  ['@neondatabase/auth/react/ui/server', '@neondatabase/auth-ui/server'],
  ['@neondatabase/auth/react/ui', '@neondatabase/auth-ui'],
  ['@neondatabase/auth/ui/css', '@neondatabase/auth-ui/css'],
  ['@neondatabase/auth/ui/tailwind', '@neondatabase/auth-ui/tailwind'],
  ['@neondatabase/neon-js/auth/react/ui/server', '@neondatabase/auth-ui/server'],
  ['@neondatabase/neon-js/auth/react/ui', '@neondatabase/auth-ui'],
  ['@neondatabase/neon-js/ui/css', '@neondatabase/auth-ui/css'],
  ['@neondatabase/neon-js/ui/tailwind', '@neondatabase/auth-ui/tailwind'],
];

const compatibilityReactSources = new Set([
  '@neondatabase/auth/react',
  '@neondatabase/neon-js/auth/react',
]);

const authUiExports = new Set([
  'AcceptInvitationCard',
  'AccountSettingsCards',
  'AccountView',
  'AuthCallback',
  'AuthForm',
  'AuthLoading',
  'AuthUIContext',
  'AuthUIProvider',
  'AuthView',
  'ChangeEmailCard',
  'ChangePasswordCard',
  'CreateOrganizationDialog',
  'CreateTeamDialog',
  'DeleteAccountCard',
  'DeleteOrganizationCard',
  'ForgotPasswordForm',
  'MagicLinkForm',
  'NeonAuthUIProvider',
  'OrganizationCellView',
  'OrganizationInvitationsCard',
  'OrganizationLogo',
  'OrganizationLogoCard',
  'OrganizationMembersCard',
  'OrganizationNameCard',
  'OrganizationSettingsCards',
  'OrganizationSlugCard',
  'OrganizationSwitcher',
  'OrganizationView',
  'OrganizationsCard',
  'PasskeysCard',
  'PasswordInput',
  'ProvidersCard',
  'RecoverAccountForm',
  'RedirectToSignIn',
  'RedirectToSignUp',
  'ResetPasswordForm',
  'SecuritySettingsCards',
  'SessionsCard',
  'SettingsCard',
  'SignInForm',
  'SignOut',
  'SignUpForm',
  'SignedIn',
  'SignedOut',
  'TeamCell',
  'TeamsCard',
  'TwoFactorCard',
  'TwoFactorForm',
  'UpdateAvatarCard',
  'UpdateFieldCard',
  'UpdateNameCard',
  'UpdateUsernameCard',
  'UserAvatar',
  'UserButton',
  'UserInvitationsCard',
  'UserView',
  'accountViewPaths',
  'authLocalization',
  'authViewPaths',
  'getViewByPath',
  'organizationViewPaths',
  'socialProviders',
  'useAuthData',
  'useAuthenticate',
  'useCurrentOrganization',
  'useTheme',
]);

const supportedExtensions = new Set([
  '.cjs',
  '.css',
  '.js',
  '.jsx',
  '.md',
  '.mdx',
  '.mjs',
  '.scss',
  '.ts',
  '.tsx',
]);

const ignoredDirectories = new Set([
  '.git',
  '.next',
  'build',
  'coverage',
  'dist',
  'node_modules',
]);

function parseArgs(argv) {
  const options = {
    check: false,
    write: false,
    dependencyVersion: '^0.1.0',
    targets: [],
  };

  for (const arg of argv) {
    if (arg === '--check') {
      options.check = true;
    } else if (arg === '--write') {
      options.write = true;
    } else if (arg.startsWith('--dependency-version=')) {
      options.dependencyVersion = arg.slice('--dependency-version='.length);
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      options.targets.push(arg);
    }
  }

  if (options.check === options.write) {
    throw new Error('Choose exactly one mode: --check or --write.');
  }

  if (options.targets.length === 0) {
    options.targets.push('.');
  }

  return options;
}

function printHelp() {
  console.log(`Usage: node scripts/migrate-auth-ui-imports.mjs (--check|--write) [paths...]

Migrates deprecated Neon Auth UI compatibility imports to @neondatabase/auth-ui.

Options:
  --check                         Report files that need migration and exit non-zero.
  --write                         Rewrite files in place and update nearest package.json files.
  --dependency-version=<version>  Version added to package.json dependencies. Defaults to ^0.1.0.
`);
}

function* walk(path) {
  if (!existsSync(path)) {
    return;
  }

  const stat = statSync(path);
  if (stat.isFile()) {
    if (supportedExtensions.has(extname(path))) {
      yield path;
    }
    return;
  }

  if (!stat.isDirectory()) {
    return;
  }

  for (const entry of readdirSync(path)) {
    if (ignoredDirectories.has(entry)) {
      continue;
    }
    yield* walk(join(path, entry));
  }
}

function rewriteText(text) {
  let next = rewriteCompatibilityReactImports(text);
  for (const [from, to] of replacements) {
    next = next.split(from).join(to);
  }
  return next;
}

function rewriteCompatibilityReactImports(text) {
  return text.replace(
    /import\s+(type\s+)?\{([^}]*)\}\s+from\s+(['"])(@neondatabase\/(?:auth\/react|neon-js\/auth\/react))\3;?/g,
    (match, typeKeyword = '', specifierBlock, quote, source) => {
      if (!compatibilityReactSources.has(source)) {
        return match;
      }

      const specifiers = specifierBlock
        .split(',')
        .map((specifier) => specifier.trim())
        .filter(Boolean);
      const uiSpecifiers = [];
      const remainingSpecifiers = [];

      for (const specifier of specifiers) {
        const importedName = specifier.split(/\s+as\s+/i)[0]?.replace(/^type\s+/, '').trim();
        if (authUiExports.has(importedName)) {
          uiSpecifiers.push(specifier);
        } else {
          remainingSpecifiers.push(specifier);
        }
      }

      if (uiSpecifiers.length === 0) {
        return match;
      }

      const statements = [
        `import ${typeKeyword}{ ${uiSpecifiers.join(', ')} } from '@neondatabase/auth-ui';`,
      ];

      if (remainingSpecifiers.length > 0) {
        statements.push(
          `import ${typeKeyword}{ ${remainingSpecifiers.join(', ')} } from ${quote}${source}${quote};`
        );
      }

      return statements.join('\n');
    }
  );
}

function findPackageJson(start) {
  let current = resolve(statSync(start).isDirectory() ? start : join(start, '..'));
  const root = resolve('/');

  while (current !== root) {
    const candidate = join(current, 'package.json');
    if (existsSync(candidate)) {
      return candidate;
    }
    current = resolve(current, '..');
  }

  return null;
}

function updatePackageJson(packageJsonPath, dependencyVersion) {
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  packageJson.dependencies ??= {};

  if (packageJson.dependencies['@neondatabase/auth-ui']) {
    return false;
  }

  packageJson.dependencies['@neondatabase/auth-ui'] = dependencyVersion;
  writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
  return true;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const changedFiles = [];
  const packageJsons = new Set();

  for (const target of options.targets.map((target) => resolve(target))) {
    for (const file of walk(target)) {
      const original = readFileSync(file, 'utf8');
      const next = rewriteText(original);
      if (next === original) {
        continue;
      }

      changedFiles.push(file);
      const packageJsonPath = findPackageJson(file);
      if (packageJsonPath) {
        packageJsons.add(packageJsonPath);
      }

      if (options.write) {
        writeFileSync(file, next);
      }
    }
  }

  const changedPackageJsons = [];
  if (options.write) {
    for (const packageJsonPath of packageJsons) {
      if (updatePackageJson(packageJsonPath, options.dependencyVersion)) {
        changedPackageJsons.push(packageJsonPath);
      }
    }
  }

  if (changedFiles.length === 0) {
    console.log('No deprecated Neon Auth UI imports found.');
    return;
  }

  const mode = options.write ? 'Updated' : 'Would update';
  console.log(`${mode} ${changedFiles.length} file(s):`);
  for (const file of changedFiles) {
    console.log(`- ${file}`);
  }

  if (changedPackageJsons.length > 0) {
    console.log(`\nAdded @neondatabase/auth-ui to ${changedPackageJsons.length} package.json file(s):`);
    for (const packageJsonPath of changedPackageJsons) {
      console.log(`- ${packageJsonPath}`);
    }
    console.log('\nRun your package manager install command to update the lockfile.');
  }

  if (options.check) {
    process.exitCode = 1;
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
