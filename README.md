# forescope

Mold spec for the [forescoping method](https://github.com/dannyexmakina/forescopingmethod):
the JSON Schema, the foundry's intake check, and the Logic / Requirement Proof.

A **mold** fixes one task's input → output correspondence before anything is built:
the decision function `f(input): output`, the input spec (including the only `files`
the implementer may read or write), output conditions with IDs, and one verification
step per condition. Molds live in each repo at `.agents/molds/<id>.yaml`; this repo
holds the contract and the checks that every consumer shares.

## Contents

- `schema/mold.schema.json` — the language-neutral SoT (JSON Schema 2020-12)
- `lintMold()` — intake check (foundry manual 1-1..1-3): schema / function
  arguments vs input table one-to-one / a verification step per condition /
  no unknown or duplicate condition / `files` is a real boundary. Returns every
  defect at once. It never blocks a write.
- `proveMold()` — runs each condition's verify command (Logic Proof) and derives
  one row per condition ID (Requirement Proof): satisfied / not-satisfied /
  not-applicable (declared with a reason). A mold that fails intake runs nothing.

## CLI

```bash
bun run src/cli.ts lint  <mold.yaml> [--json]
bun run src/cli.ts proof <mold.yaml> [--cwd DIR] [--na cN=reason ...] [--json]
```

| command | 0 | 1 | 2 |
|---|---|---|---|
| lint | accepted (請書) | defects (stderr) | usage / IO |
| proof | deliverable | not deliverable | usage |

## Consumers

- dotfiles — `forescope` shim; the ExitPlanMode hook reads a plan's `mold:` pointer
- aiq — issues carry a mold; `spec.files` / `verify_command` derive from it

Pin by commit: `"@pigeonworks-llc/forescope": "github:pigeonworks-llc/forescope#<sha>"`.

## Develop

```bash
bun install
bun run ci   # typecheck + bun test
```
