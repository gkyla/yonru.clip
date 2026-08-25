---
trigger: always_on
---

# GitHub / Git Workflow Rules

## MANDATORY RULE 1: USER COMMIT/PUSH APPROVAL (CRITICAL)

YOU MUST ALWAYS explicitly ask the USER for approval before performing any Git commit or pushing any code. Never automatically stage files, create commits, or push changes without first asking:
"Would you like me to commit these changes now?" or "Do you want to create a commit for this update?" and waiting for their explicit confirmation.

## MANDATORY RULE 2: PRE-FLIGHT GATEKEEPER & BRANCH/ISSUE WORKFLOW (CRITICAL)

1. **Pre-Flight Detection & Confirmation**:
   - When the user requests a new feature (`feat`), functional bugfix (`fix`), or major architecture overhaul (`refactor`):
     - The agent **MUST NOT** immediately edit files in `main`.
     - The agent **MUST FIRST** explicitly ask the user: *"This task involves a [new feature / bugfix / refactor]. Would you like me to create a GitHub Issue and a new branch (`feat/<slug>` / `fix/<slug>`) first?"* (The agent must seamlessly understand both English and Indonesian responses, such as 'yes', 'boleh', 'buatkan', 'no', 'langsung di main saja', etc.).
   - If the user confirms:
     - Programmatically create the issue using the matching template in `.github/ISSUE_TEMPLATE/`.
     - Create and switch to the new branch: `rtk git checkout -b feat/<slug>` or `rtk git checkout -b fix/<slug>`.
   - If the user declines (e.g. wants quick prototyping):
     - Fallback gracefully and proceed directly on the current branch (`main`).

2. **Direct Commit Allowance (Micro/Cosmetic Tasks)**:
   - For `style/*` (UI visual tweaks, minor padding/color), `docs/*` (documentation updates), and `chore/*` (dependency bumps, config updates), the agent is **permitted** to work directly on `main` without creating a branch/issue, provided that Rule 1 (Commit Approval) is always followed.

3. **Standardized Branch Naming**:
   - For all features, fixes, and improvements using branches:
     - `feat/<slug>` (for new features, UI enhancements, or capabilities)
     - `fix/<slug>` (for bug fixes, regressions, or corrections)
     - `feat/issue-<ID>-<slug>` or `fix/issue-<ID>-<slug>` if linked to a GitHub Issue ID.

4. **Pull Request Linking**:
   - When generating Pull Requests, always write descriptions that match the structure of `.github/pull_request_template.md`.
   - If linked to an existing issue, include a closing keyword (e.g., `Closes #<ID>` or `Resolves #<ID>`) at the top of the PR description to automatically link and close the associated issue when merged.

## MANDATORY RULE 3: PULL REQUEST MERGE & WORKSPACE SYNCHRONIZATION AUTOMATION (CRITICAL)

Once a Pull Request is fully tested and verified, the agent MUST programmatically manage the final merge and local synchronization workflow under the following strict checklist:
1. **Verification**: Confirm all automated unit and integration tests pass successfully.
2. **Approval**: Explicitly ask the USER for permission: *"Would you like me to merge this PR to main now?"* or *"Do you want me to merge the PR and synchronize your local workspace now?"* and wait for their explicit confirmation.
3. **Merge**: Programmatically call the GitHub MCP tool `merge_pull_request` to merge the PR on GitHub using the **"squash"** merge method (setting the `merge_method` parameter to `"squash"`), triggering automatic closing of the linked issue.
4. **Synchronization**:
   - Switch local workspace back to `main`: `rtk git checkout main`
   - Pull the remote merged code: `rtk git pull origin main`
   - Delete the temporary local branch: `rtk git branch -d <branch_name>`

## MANDATORY RULE 4: CLASSIFICATION NOTE ON SOLUTIONS (CRITICAL)

YOU MUST ALWAYS explicitly prepend a classification note at the start of every answer or task resolution where code is modified or proposed. This note must state the complexity classification of the problem and the rationale behind the decision. DO NOT include this note in simple conversational replies where no code is modified or proposed.

Format the note exactly as follows:
> **Category Change**: `Trivial/Simple` OR `Complex Bug/Feature`
> **Reason**: `[A concise explanation of the complexity assessment]`

## MANDATORY RULE 5: CONVENTIONAL COMMITS AND PLAIN LANGUAGE (CRITICAL)

YOU MUST ALWAYS format your Git commit messages using the Conventional Commits specification with an explicit scope representing the component or package being changed. Every commit message must begin with an appropriate type and scope prefix (e.g., `feat(editor):`, `fix(api):`, `chore(deps):`, `docs(readme):`, `style(styles):`, `refactor(player):`, `test(tests):`, `ci(actions):`).

### Commit Type Classification Guidelines:
- **`style(<scope>):`**: Visual UI adjustments, CSS/Tailwind tweaks, layout positioning, padding/margins, component aesthetics, tooltips, and copywriting polish without adding new backend endpoints or core business logic.
- **`feat(<scope>):`**: New business features, new backend APIs, or major system capability additions.
- **`fix(<scope>):`**: Bug fixes, error resolutions, and logic regressions.
- **`refactor(<scope>):`**: Code reorganization, cleanup, or structure improvements without changing external behavior or UI appearance.
- **`test(<scope>):`**: Adding or updating unit/integration test suites.
- **`docs(<scope>):`**: Updating documentation, guides, or README files.
- **`chore(<scope>):`**: Dependency upgrades, build configuration, or tooling maintenance.

Additionally, YOU MUST ALWAYS use plain, straightforward, and simple language in your commit messages, code comments, and explanations. Avoid overly complex, high-brow, or jargon-heavy words (such as 'decommission', 'ameliorate', 'facilitate', etc.). Prefer simple, active verbs (such as 'remove', 'fix', 'help', 'use', etc.) after the Conventional Commit prefix so that all communications, comments, and Git history logs remain clear, direct, and accessible to everyone.

## MANDATORY RULE 6: GITHUB ISSUE TEMPLATES (CRITICAL)

When programmatically creating or updating GitHub Issues, all agents MUST ALWAYS read the corresponding template file in `.github/ISSUE_TEMPLATE/` (e.g., `feature_request.md` or `bug_report.md`) first, and structure the issue title, label, headings, and descriptions to strictly match that template's required syntax and fields. In particular, the issue title MUST use standard lowercase conventional prefixes followed by a colon (e.g., `feat: `, `fix: `) instead of bracketed uppercase styles (e.g., `[FEAT]`, `[BUG]`).