# Release Pipeline Runbook

## Overview

The neon-js release pipeline has two stages:

1. **Stage 1 — `prepare-release.yml`** (this repo, `neondatabase/neon-js`):
   Computes the release cascade from the selected trigger package, bumps versions
   in each `packages/*/package.json`, commits the version bumps to a release
   branch, and opens a release PR. After the PR is manually squash-merged,
   `post-release.yml` creates annotated git tags (e.g. `auth@v0.2.1`) on the
   merge commit and comments with Stage 2 dispatch instructions. No build, no
   pack, no scan, no publish — just version bookkeeping and handoff.

2. **Stage 2 — `neon-js.yml`** (`databricks/secure-public-registry-releases-eng`):
   Checks out the tagged source, installs dependencies (via JFrog proxy), audits,
   builds, packs tarballs, runs a security scan, and publishes to npm via OIDC
   Trusted Publishing. Runs on hardened release runners.

The two-stage split exists because npm OIDC Trusted Publishing is scoped to the
repository+workflow that is configured as a Trusted Publisher on npmjs.com. The
hardened runners and security scanning mandate lives in
`secure-public-registry-releases-eng`, so Stage 2 must live there.

## Prerequisites

- **Repo access**: You need `admin` or `maintain` role on both
  `neondatabase/neon-js` and `databricks/secure-public-registry-releases-eng`.
  Stage 2 checks this at runtime and will reject other roles.
- **Main branch must be CI-green**: Do not release from a red branch. Check the
  latest CI run on `main` before starting.
- **Supply chain freeze**: Before releasing, check
  `#tmp-unblock-neon-lakebase-releases` on Slack. If there is an active freeze,
  do not proceed without explicit approval.
- **Runner availability**: Both repos use protected runner groups. If runners are
  offline or queued, releases will be delayed. Check GitHub Actions queue status.

## Normal Release Flow

1. Go to **neon-js > Actions > Prepare Release** (`prepare-release.yml`).
2. Select the **trigger package** (e.g. `auth`), **bump type** (`patch`/`minor`/`major`),
   and **ref** (default: `main`).
3. Click **Run workflow**. Stage 1 will:
   - Compute the cascade (e.g. `auth` triggers `["auth", "neon-js"]`)
   - Bump versions in each cascaded package
   - Push a release branch
   - Open a release PR with a title like `chore: release @neondatabase/auth@vX.Y.Z @neondatabase/neon-js@vX.Y.Z`
4. Have an approver manually click **Squash and merge**. Do not use auto-merge.
   The merge commit triggers `post-release.yml`, which creates the annotated tags
   and comments with Stage 2 dispatch instructions.
5. Go to **secure-public-registry-releases-eng > Actions > neon-js** (`neon-js.yml`).
6. Select the **same package**. For an all-packages release, select `all` and use
   the `neon-js@v...` tag from the post-release handoff as the canonical **ref**
   (all release tags point at the same merge commit).
   Set **dry-run** to `false` for a real publish.
7. Click **Run workflow**. Stage 2 will:
   - Check actor permissions
   - Checkout neon-js source at the specified ref
   - Install deps, audit, build
   - Pack tarballs for all cascaded packages
   - Run security scan
   - Publish each package to npm via OIDC (skips already-published versions)
8. Verify on npmjs.com that all packages were published at the expected versions.

### Cascade Reference

| Trigger package | Cascade |
|---|---|
| `postgrest-js` | `postgrest-js`, `neon-js` |
| `auth-ui` | `auth-ui`, `auth`, `neon-js` |
| `auth` | `auth`, `neon-js` |
| `neon-js` | `neon-js` |
| `all` | `postgrest-js`, `auth-ui`, `auth`, `neon-js` |

`all` releases every public package together, but it does **not** align all
packages to one shared version. Each package is bumped once from its own current
version.

## Dry Run

Stage 2 supports `DRY_RUN=true` (the default). This runs the full pipeline
(install, audit, build, pack, scan) but skips the actual `npm publish`.

Use this to validate:
- Dependencies resolve through JFrog proxy
- Build succeeds with current source
- Security scan passes
- Tarballs are correctly packed

A dry run does not modify any state — no tags, no npm publishes.

## Failure Scenarios & Recovery

### 1. Stage 1 fails before branch push

**Symptoms**: Workflow fails at version bump or commit step.

**State**: Nothing was pushed. The commit existed only on the ephemeral runner
and is discarded when it terminates.

**Recovery**: Just re-run the workflow. No cleanup needed.

**Verify**: `git log origin/main --oneline -3` shows no version bump commit.

---

### 2. Stage 1 branch push or PR creation fails

**Symptoms**: The "Push release branch" or "Open PR" step fails.

**State**: Either nothing was pushed, or a release branch exists without a PR.
No tags are created by Stage 1.

**Recovery**:

```bash
# Check for a pushed release branch
git ls-remote --heads origin "release/*"

# If the branch exists, open the PR manually or delete the branch and rerun Stage 1
git push origin --delete "release/<package>-<run-id>"
```

**Verify**: The release PR exists, or the bad release branch is gone.

---

### 3. Stage 2 build fails

**Symptoms**: Install, audit, or build step fails in Stage 2.

**State**: Tags and version bump commit are in git (from Stage 1). Nothing is on
npm — no packages were published.

**Recovery**: Fix the build issue (missing dep, type error, etc.), push the fix
to `main`, and re-run Stage 2 pointing at the updated `main` or a new tag.

If the fix requires a new version bump, you will need to either:
- Delete the old tags and revert the version bump commit, then re-run Stage 1
- Or accept the version gap and bump again

**Verify**: `npm view @neondatabase/<pkg> versions` does not include the
failed version.

---

### 4. Stage 2 scan fails

**Symptoms**: Security scan step fails.

**State**: Same as build failure — tags in git, nothing on npm.

**Recovery**: Investigate the scan finding. If it is a true positive, fix the
vulnerability and re-run. If it is a false positive, work with security
(Adith Sudhakar) to get an exception, then re-run.

**Verify**: Re-run produces a clean scan.

---

### 5. Stage 2 partial publish

**Symptoms**: Publish step fails partway through. Some packages made it to npm,
others did not.

**State**: Some packages are on npm at the new version, others are not. The
`npm-oidc-publish.sh` script publishes packages sequentially, so you can tell
which ones succeeded by checking npm.

**Recovery**: Re-run Stage 2. The publish script and npm itself will reject
re-publishing an already-published version (409 Conflict), but remaining
packages will be published. If the workflow does not handle this gracefully,
you can run the publish script manually for the missing packages.

```bash
# Check which packages were published
npm view @neondatabase/auth version
npm view @neondatabase/neon-js version

# The missing ones need re-publishing via Stage 2 re-run
```

**Verify**: All packages in the cascade show the correct version on npm.

---

### 6. Stage 2 persistent failure (code is broken)

**Symptoms**: Stage 2 fails repeatedly despite re-runs. The code does not build
or has a real issue that CI on `main` did not catch.

**State**: Tags and version commit are in git. Nothing (or partial) on npm.

**Recovery**: Manual cleanup, then investigate the CI gap.

```bash
# Delete the tags from remote
git push --delete origin "auth@v0.2.1"
git push --delete origin "neon-js@v1.3.5"

# Revert the version bump commit on main
git revert <version-bump-commit-sha>
git push origin main

# Fix the underlying issue
# Add the missing CI check that would have caught this
# Then start a fresh release from Stage 1
```

**Verify**: Tags are gone, version in `package.json` matches the last
successfully published version, CI is updated.

---

### 7. OIDC token exchange fails

**Symptoms**: Stage 2 fails at the JFrog OIDC token step or the npm OIDC token
exchange step with an auth error.

**State**: Nothing was published. Git state is fine.

**Recovery**: This is almost always transient. Wait a few minutes and re-run
Stage 2. If it persists:
- Check GitHub's OIDC provider status: https://www.githubstatus.com/
- For JFrog OIDC: check `#unblock-release-public` on Slack
- For npm OIDC: verify Trusted Publisher config on npmjs.com matches the
  repo/workflow/environment

**Verify**: Re-run succeeds.

---

### 8. JFrog proxy issues

**Symptoms**: `bun install` fails in Stage 2 because dependencies cannot be
fetched from JFrog.

**State**: Nothing was built or published. Git state is fine.

**Recovery**:
1. Check `#unblock-release-public` on Slack for known outages
2. Contact Will Hess for runner/proxy access issues
3. If JFrog is down, wait for recovery and re-run

**Verify**: `bun install --frozen-lockfile` succeeds in Stage 2 re-run.

## Key Contacts

| Person | Role |
|---|---|
| **Will Hess** | Repo architect, runner access |
| **Gerardo Saca** | Runner hardening |
| **Adith Sudhakar** | Security (scan exceptions) |
| **Alexander Bayandin** | npm implementation |

**Slack channels**:
- `#unblock-release-public` — runner and proxy issues
- `#tmp-unblock-neon-lakebase-releases` — supply chain freeze status

## Architecture Notes

- **Why two repos**: npm OIDC Trusted Publishing ties the token to a specific
  repository + workflow + environment. The security team mandates that publishing
  happens from `secure-public-registry-releases-eng` on hardened runners with
  mandatory scanning. This cannot be done from `neon-js` directly.

- **Idempotent publish**: Stage 2's publish step is safe to re-run. npm rejects
  duplicate version publishes with a 409, and the workflow can be re-triggered
  for any packages that failed.

- **Dry run support**: Stage 2 defaults to `dry-run: true`. This runs the full
  pipeline (install, build, scan) without touching npm. Always do a dry run
  first for major or minor releases.

- **No secrets in Stage 1**: The prepare-release workflow only needs GitHub
  permissions to push the release branch and open a PR. No npm tokens, no JFrog
  tokens.

- **Cascade logic**: Both stages compute the cascade independently from the
  same hardcoded map. If you add a new package, update the cascade `case`
  block in both `prepare-release.yml` and `neon-js.yml`. `post-release.yml`
  also recognizes the `all` package set so it can emit a single Stage 2
  `package=all` dispatch instead of one dispatch per package.
