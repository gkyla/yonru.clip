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

## MANDATORY RULE 5: PLAIN LANGUAGE & SIMPLE WORDS (CRITICAL)

YOU MUST ALWAYS use plain, straightforward, and simple language in your explanations, comments, and Git commit messages. Avoid overly complex, high-brow, or jargon-heavy words (such as 'decommission', 'ameliorate', 'facilitate', etc.). Prefer simple, active verbs (such as 'remove', 'fix', 'help', 'use', etc.) so that all communications, comments, and Git history logs remain clear, direct, and accessible to everyone.