# Local act runbook

Run GitHub Actions workflows locally with [nektos/act](https://github.com/nektos/act) (invoked via `gh act`).

Steps that require live GitHub API access (git push to origin, `gh pr create`, `gh pr comment`, `gh label create`, role-check) are guarded with `if: env.ACT != 'true'` and are automatically skipped when act sets `ACT=true`. Everything else — version bumps, cascade computation, PR-body rendering, handoff-message construction, and `$GITHUB_STEP_SUMMARY` writes — runs normally, giving you full local visibility.

## Prerequisites

```bash
# Install act extension for gh
gh extension install nektos/gh-act
```

The `.actrc` at the repo root maps all custom runner labels to `catthehacker/ubuntu:medium-latest`, which ships with `gh`, `node`, `pnpm`, and `jq` pre-installed.

## Commands

### Test `post-release.yml` end-to-end

Exercises: parse release metadata from commit message, tag-decision logic, Build Stage 2 handoff message, write handoff to `$GITHUB_STEP_SUMMARY`. Tags are NOT pushed (skipped under act).

```bash
gh act push \
  -W .github/workflows/post-release.yml \
  -j tag-and-handoff \
  --eventpath .github/act/push-release.json
```

### Test `prepare-release.yml` end-to-end

Exercises: ref validation, cascade computation, version bumps (the critical multi-package JSON step), PR-body construction. No push to origin, no `gh pr create` (skipped under act).

```bash
gh act workflow_dispatch \
  -W .github/workflows/prepare-release.yml \
  -j prepare \
  --eventpath .github/act/workflow-dispatch.json
```

## What you will see

- Computed version bumps for each package in the cascade, printed to the step log.
- The rendered PR-body string and handoff comment body written to `$GITHUB_STEP_SUMMARY` (act streams this to stdout).
- Skipped steps are shown as `SKIP` in the act output — that is expected.

## What does NOT happen locally

- No git push to origin.
- No `gh pr create` / `gh pr comment`.
- No `gh label create`.
- No actor role check against the GitHub API.

## Interpreting failures

If any non-skipped step fails locally, that is a real bug to fix before pushing. The version-bump step (`Bump versions`) is the most important to validate — it is where multi-line JSON output bugs have bitten us before (see PR #92).
