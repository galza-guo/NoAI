# Persistent Rule Worktree Workflow

## Recommendation

Use persistent worktrees for language-specific English/general and Chinese
rule-development loops, with one important boundary: rule-loop agents prepare
reviewed branches; they do not merge themselves into `main`.

In plain terms, a worktree is a second folder for the same Git repository. It is
useful here because the English and Chinese rule loops can each keep their own
checked-out files, local ignored corpora, staged changes, and running commands
without blocking normal app work in the main folder.

The workflow is appropriate for this repo because:

- `.worktrees/` is already ignored by Git.
- The Chinese detector has a real module boundary in `src/redactor/chinese.ts`.
- English/general rules are mostly in `src/redactor/engine.ts` and
  `src/redactor/rules.ts`.
- Private dev-round material belongs under `benchmarking/private/dev-rounds/`,
  which is ignored.
- Sealed benchmark suite documents, annotations, model inputs, proposals, and
  reports are ignored under `benchmarking/suites/<suite-id>/`.
- `src/redactor/version.ts` already has split general and Chinese ruleset
  counters, and `scripts/check-engine-version.mjs` enforces staged version and
  changelog updates for redaction-engine changes.

This is not a perfect separation. The test file, changelog, engine orchestrator,
version file, benchmark harness, and candidate/replacement pipeline are shared.
Those files should be treated as coordination points.

## Existing State

At the time this guide was written, the main worktree is:

```bash
/Users/guolite/GitHub/NoAI
```

There is also an existing project-local worktree:

```bash
/Users/guolite/GitHub/NoAI/.worktrees/chinese-redaction-5-rounds
```

Do not delete, reset, or repurpose an existing worktree without explicit owner
approval. The current `chinese-redaction-5-rounds` worktree is pending audit:
review it, keep or discard changes intentionally, then merge/retire it before
starting a clean replacement Chinese loop.

## Proposed Persistent Worktrees

Use the main worktree for general app, shared infrastructure, and integration
work:

- UI/frontend work.
- File readers and export behavior.
- Shared redaction pipeline behavior.
- Candidate kinds and replacement semantics.
- Benchmark harness/process changes.
- Build, test, package, and deployment changes.
- Broad refactors that affect both rulesets.
- Periodic review, merge, squash, or cherry-pick of accepted rule-loop commits.

Use persistent rule worktrees for benchmark/corpus-driven rule-development
loops:

```text
Main/general app worktree:
  /Users/guolite/GitHub/NoAI

English/general rule worktree:
  /Users/guolite/GitHub/NoAI/.worktrees/rules-en
  branch: codex/rules-en

Chinese rule worktree:
  /Users/guolite/GitHub/NoAI/.worktrees/rules-zh
  branch: codex/rules-zh
```

The folder name and branch name are separate things. A worktree is the folder;
the branch is the line of development checked out in that folder.

The NoAI dev-loop skill is only for these language-specific ruleset loops. A
dev-loop worker may run several rounds in its rule worktree and commit at the
end of each accepted loop. It must leave merge/squash/cherry-pick and final
adoption decisions to the main-worktree integration worker.

## Setup Commands

Run setup from the main worktree after confirming the current status:

```bash
cd /Users/guolite/GitHub/NoAI
git status --short --branch
git check-ignore -q .worktrees
```

If a branch does not exist yet:

```bash
git worktree add .worktrees/rules-en -b codex/rules-en main
git worktree add .worktrees/rules-zh -b codex/rules-zh main
```

If a branch already exists but has no attached worktree:

```bash
git worktree add .worktrees/rules-en codex/rules-en
git worktree add .worktrees/rules-zh codex/rules-zh
```

Install dependencies and verify each worktree before using it:

```bash
cd /Users/guolite/GitHub/NoAI/.worktrees/rules-en
npm install
npm test

cd /Users/guolite/GitHub/NoAI/.worktrees/rules-zh
npm install
npm test
```

## English/General Rule Lane

The English/general loop may normally edit:

- `src/redactor/engine.ts`, for English/general detectors and shared detector
  calls only when the change is directly needed by the English/general rule.
- `src/redactor/rules.ts`.
- English/general cases in `src/redactor/engine.test.ts`.
- `src/redactor/version.ts`, bumping `GENERAL_RULES_VERSION` for
  English/general rule behavior changes.
- `docs/engine-changelog.md`.
- `docs/redaction-corpus-rounds.md`.
- `benchmarking/prompts/worker-round-prompt-template.md`, if the English/general
  worker prompt itself needs to change.

Ignored local artifacts for the English loop should stay under:

```text
benchmarking/private/dev-rounds/<round-id>/
```

English aggregate scoring should use the current local English NAIR suite when
available, normally `benchmarking/suites/NAIR-v2`, but agents must not inspect
suite documents, gold annotations, manifests, model proposals, or span-level
failure details while writing rules.

## Chinese Rule Lane

The Chinese loop may normally edit:

- `src/redactor/chinese.ts`.
- Chinese-specific cases in `src/redactor/engine.test.ts`.
- `src/redactor/version.ts`, bumping `CHINESE_RULES_VERSION` for Chinese rule
  behavior changes.
- `docs/engine-changelog.md`.
- `docs/redaction-corpus-chinese-rounds.md`.
- `docs/redaction-corpus-chinese-synthetic.md`.
- `benchmarking/prompts/chinese-engine-worker-round-prompt-template.md`, if the
  Chinese worker prompt itself needs to change.

Ignored local artifacts for the Chinese loop should stay under:

```text
benchmarking/private/dev-rounds/<round-id>/
```

Chinese aggregate scoring should use the current local Chinese NAIR suite when
available, normally `benchmarking/suites/NAIR-CN-v1.0`, but agents must not
inspect suite documents, gold annotations, manifests, model proposals, or
span-level failure details while writing rules.

## Shared Coordination Files

These files are likely conflict points and should be edited from a rule worktree
only when necessary:

- `src/redactor/engine.ts`, especially detector order, candidate cleanup,
  dedupe, aliasing, replacement, and review/export behavior.
- `src/redactor/types.ts`.
- `src/redactor/version.ts`.
- `src/redactor/engine.test.ts`.
- `docs/engine-changelog.md`.
- `benchmarking/process.md`.
- `benchmarking/harness/**`.
- `benchmarking/prompts/model-annotation-prompt.md`.
- `benchmarking/prompts/agent-dev-annotation-prompt.md`.
- `package.json`, `package-lock.json`, `tsconfig.json`, and Vite/Vitest config.
- `src/fileReaders.ts`, `src/main.ts`, and other UI/app integration files.

If a rule loop needs to modify one of these files, pause and explain why the
change is rule-specific rather than shared infrastructure work. For a broad
shared change, move the work to the main worktree or a separate reviewed branch.

## Running Rule Loops

Before starting a round in a rule worktree:

```bash
git status --short --branch
npm test
```

Create local development artifacts only under ignored private folders:

```bash
node benchmarking/harness/create-dev-round.mjs \
  --round <YYYY-MM-DD-theme> \
  --theme "<theme>" \
  --source-mode public-search
```

Run the standard dev-round harness from inside the relevant worktree:

```bash
node benchmarking/harness/index-dev-round-docs.mjs \
  --round-dir benchmarking/private/dev-rounds/<round-id>

node benchmarking/harness/run-dev-round-engine.mjs \
  --round-dir benchmarking/private/dev-rounds/<round-id> \
  --levels balanced
```

When searching the repo during a rule loop, exclude sealed and private local
artifact folders unless the command is deliberately operating on the current
ignored dev-round folder:

```bash
rg -n "pattern" src docs benchmarking/prompts benchmarking/harness \
  --glob '!benchmarking/private/**' \
  --glob '!benchmarking/suites/**'
```

Do not run broad searches over all of `benchmarking/` during rule-writing work.
Local sealed suites may exist on disk even though Git ignores them.

## Scoring Without Output Races

If a rule worktree needs aggregate NAIR scoring and the suite exists only in the
main worktree, pass the suite by absolute path. To avoid two loops overwriting
the same ignored suite `reports/` files, write score outputs into the current
worktree's ignored dev-round folder:

```bash
mkdir -p benchmarking/private/dev-rounds/<round-id>/score

node benchmarking/harness/score-current-engine.mjs \
  --suite /Users/guolite/GitHub/NoAI/benchmarking/suites/NAIR-v2 \
  --level balanced \
  --out benchmarking/private/dev-rounds/<round-id>/score/nair-v2-balanced.json \
  --history benchmarking/private/dev-rounds/<round-id>/score/score-history.json
```

For Chinese:

```bash
mkdir -p benchmarking/private/dev-rounds/<round-id>/score

node benchmarking/harness/score-current-engine.mjs \
  --suite /Users/guolite/GitHub/NoAI/benchmarking/suites/NAIR-CN-v1.0 \
  --level balanced \
  --out benchmarking/private/dev-rounds/<round-id>/score/nair-cn-v1-balanced.json \
  --history benchmarking/private/dev-rounds/<round-id>/score/score-history.json
```

Read and report only aggregate score summaries. Do not inspect benchmark source
documents, extracted Markdown, gold annotations, model proposals, or span-level
failure reports to write rules.

## Adopting Successful Rule Changes

Rule-loop branches should prepare small, meaningful commits with clear evidence.
A human or main-worktree coordinating agent should decide whether to merge into
`main`.

Minimum adoption checklist:

- The change is general, not tied to one real document's exact fact pattern.
- Synthetic tests use invented values and include counterexamples.
- `src/redactor/version.ts` is bumped correctly:
  - `GENERAL_RULES_VERSION` for English/general ruleset-only changes.
  - `CHINESE_RULES_VERSION` for Chinese ruleset-only changes.
  - Do not bump `ENGINE_VERSION` for a ruleset-only change, even if narrow rule
    plumbing touches `src/redactor/engine.ts`.
  - Bump `ENGINE_VERSION` only for shared engine/API/review metadata changes
    that are not just one language ruleset changing.
- `docs/engine-changelog.md` has a matching version heading.
- `npm test` passes.
- `npm run build` passes for meaningful shipped changes.
- `node scripts/check-engine-version.mjs` passes when engine files are staged.
- Aggregate benchmark movement is recorded if a relevant local suite is
  available.
- `git status --short` contains no raw/source documents, extracted text,
  annotations, comparison reports, logs, or temporary scratch files outside
  ignored private folders.

Recommended main adoption options:

- Prefer review plus a normal merge or squash merge into `main`.
- Use cherry-pick only when a branch contains mixed useful and rejected commits.
- Do not let a long-running rule-loop agent merge directly to `main` without
  explicit approval.

Why this review step exists: rule-loop builders are optimized for finding and
trying rule improvements. The main-worktree integrator checks whether the change
is still general, whether it conflicts with shared engine/harness work, whether
version/changelog/test evidence is complete, and whether the branch needs to be
synced with current `main` before adoption.

## Keeping Rule Branches Current

Prefer merging `main` into persistent rule branches:

```bash
cd /Users/guolite/GitHub/NoAI/.worktrees/rules-en
git fetch origin
git merge main
npm test
```

Use the same pattern for `rules-zh`.

Why merge by default: persistent worktrees are long-lived shared folders, and
merge preserves the branch's actual development history and benchmark evidence.
It avoids rewriting commits that another agent, terminal, or note may already
refer to.

Rebase is acceptable only for short-lived local branches before review, or when
the owner explicitly asks for a linear-history cleanup:

```bash
git rebase main
```

Do not force-push, hard-reset, delete a branch, remove a worktree, or
auto-resolve merge conflicts without explicit approval.

## When Main Changes Structurally

Sync a rule worktree from `main` before continuing if `main` changes:

- `src/redactor/types.ts`.
- Shared parts of `src/redactor/engine.ts`.
- `src/redactor/version.ts`.
- `src/redactor/engine.test.ts`.
- `benchmarking/harness/**`.
- `benchmarking/process.md`.
- `benchmarking/prompts/**`.
- Build/test scripts or package dependencies.
- File reader/export behavior that affects redaction inputs or outputs.

If `main` only changes unrelated UI copy, public images, or docs outside the
rule loop, a rule branch can remain on its older base temporarily.

## Repo-Structure Improvements To Consider

The current structure is workable, but these changes would make persistent
worktrees cleaner over time:

- Split `src/redactor/engine.test.ts` into smaller files, such as
  `engine.general.test.ts`, `engine.chinese.test.ts`, and shared pipeline tests.
- Move more English/general detector code out of `src/redactor/engine.ts` into a
  `src/redactor/general.ts` module, matching the Chinese boundary.
- Keep generated score outputs under branch/round-specific ignored folders by
  default.
- Add wrapper scripts for common lane commands, for example:
  - `npm run score:nair:en -- --round <round-id>`
  - `npm run score:nair:zh -- --round <round-id>`
- Consider a preflight script that warns when a rule branch edits shared
  infrastructure files.

## Main Risks

- The English/general lane is less isolated than Chinese because much of it is
  still in the large shared engine file.
- Both lanes edit `src/redactor/engine.test.ts`, `src/redactor/version.ts`, and
  `docs/engine-changelog.md`, so merge conflicts are expected.
- Parallel scoring can overwrite ignored report files unless `--out` and
  `--history` point to branch-specific private folders.
- Broad search commands can surface sealed local benchmark material if they
  include `benchmarking/suites/**`.
- Rule branches can drift behind shared harness or engine changes if they are
  not periodically merged from `main`.
- A benchmark score can improve while general behavior gets worse; keep the
  synthetic tests, counterexamples, and code review gate.
