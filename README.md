# forescope

Mold spec for the [forescoping method](https://github.com/dannyexmakina/forescopingmethod):
the JSON Schema, the foundry's intake check, and the Logic / Requirement Proof.

A **mold** fixes one task's parameters and test cases before anything is built:
the values the task receives ([Parameter] name / domain / note), and for each
test case ([TestCase] TC-NNN: scenario / precondition / data / expected) what
happens when those values are given. Molds live in each repo at
`.agents/molds/<id>.yaml`; this repo holds the contract and the checks that
every consumer shares.

This follows the upstream shape after [PR #19](https://github.com/dannyexmakina/forescopingmethod/pull/19)
(2026-09-28), which unified the mold into parameters + test cases.

## Contents

- `schema/mold.schema.json` — the language-neutral SoT (JSON Schema 2020-12)
- `lintMold()` — intake check (foundry manual 1-1..1-3): schema / every name in
  a test case's data ↔ a parameter one-to-one / every test case has an expected
  result / no duplicate test case ID or parameter name / `files` is a real
  boundary. Returns every defect at once. It never blocks a write.
- `proveMold()` — runs each test case's verify command (Logic Proof) and derives
  one row per test case ID (Requirement Proof): satisfied / not-satisfied /
  not-applicable (declared with a reason) / answered via `--response`. A case
  with neither a command nor a response is pending and blocks delivery.

## Extensions (not in the upstream class)

Two fields extend the upstream `Mold`; they are marked `EXTENSION` in the schema.

- `files[]` — the only repo-relative paths the foundry may read or write. Maps
  to aiq `spec.files` and the ExitPlanMode scope advisory.
- `test_cases[].command` — a shell command whose exit 0 means the expected
  result is satisfied. When present, `proveMold` runs it (Logic Proof is
  generated, not hand-written). Absent = judged by a person/AI and reported
  via `forescope proof --response`.

## CLI

```bash
bun run src/cli.ts lint  <mold.yaml> [--json]
bun run src/cli.ts proof <mold.yaml> [--cwd DIR] [--response TC-NNN=verdict[:text] ...] [--na TC-NNN=reason ...] [--json]
```

| command | 0 | 1 | 2 |
|---|---|---|---|
| lint | accepted (請書) | defects (stderr) | usage / IO |
| proof | deliverable | not deliverable | usage |

## Consumers

- dotfiles — `forescope` shim; the ExitPlanMode hook reads a plan's `mold:` pointer
- aiq — issues carry a mold; `spec.files` / `verify_command` derive from it
- plan7 — `deriveMold()` builds a mold from an impl-plan payload

Pin by commit: `"@pigeonworks-llc/forescope": "github:pigeonworks-llc/forescope#<sha>"`.

## Develop

```bash
bun install
bun run ci   # typecheck + bun test
```
