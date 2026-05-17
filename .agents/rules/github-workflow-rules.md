---
trigger: always_on
---

# GitHub / Git Workflow Rules

## MANDATORY RULE 1: USER COMMIT/PUSH APPROVAL (CRITICAL)

YOU MUST ALWAYS explicitly ask the USER for approval before performing any Git commit or pushing any code. Never automatically stage files, create commits, or push changes without first asking:
"Would you like me to commit these changes now?" or "Do you want to create a commit for this update?" and waiting for their explicit confirmation.

## MANDATORY RULE 2: HYBRID BUG/FEATURE WORKFLOW (CRITICAL)

1. **Assess Bug/Feature Complexity**:
   - For complex, functional bugs, logic regressions, or new feature proposals, YOU MUST ALWAYS recommend creating a GitHub Issue first before writing code or creating a branch.
   - For trivial changes (such as typos, simple visual tweaks, and minor stylesheet adjustments), you may proceed directly with code changes without creating an issue.

2. **Standardized Branch Naming**:
   - If a GitHub Issue is created, you MUST name the Git branch exactly following:
     - `fix/issue-<ID>-<slug>` (for bugs)
     - `feat/issue-<ID>-<slug>` (for features)
   - For trivial changes without an issue, use:
     - `fix/<slug>`
     - `feat/<slug>`

3. **Pull Request Linking**:
   - When generating Pull Requests, always write descriptions that match the structure of `.github/pull_request_template.md`.
   - You MUST explicitly include a closing keyword (e.g., `Closes #<ID>` or `Resolves #<ID>`) at the top of the PR description to automatically link and close the associated issue when merged.

