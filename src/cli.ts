#!/usr/bin/env bun
// forescope — mold intake check and proofs.
//
//   forescope lint  <mold.yaml> [--json]
//   forescope proof <mold.yaml> [--cwd DIR] [--na cN=reason ...] [--json]
//
// Exit codes and output match the Python predecessor (dotfiles mold-lint /
// mold-proof) so callers can switch without change:
//   lint : 0 accepted (請書) / 1 defects on stderr / 2 usage or IO error
//   proof: 0 deliverable / 1 not deliverable / 2 usage error
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { lintMold, moldScope, NaError, proveMold, renderProof } from "./index.ts";
import type { Mold } from "./types.ts";

function usage(): number {
	console.error(
		"usage: forescope lint <mold.yaml> [--json]\n       forescope proof <mold.yaml> [--cwd DIR] [--na cN=reason ...] [--json]",
	);
	return 2;
}

function load(path: string): { mold: unknown } | { error: string } {
	try {
		return { mold: parse(readFileSync(path, "utf8")) };
	} catch (e) {
		return { error: `forescope: ${path}: ${(e as Error).message}` };
	}
}

function main(argv: string[]): number {
	const [cmd, path, ...rest] = argv;
	if (!cmd || !path || (cmd !== "lint" && cmd !== "proof")) return usage();
	const json = rest.includes("--json");
	const loaded = load(path);
	if ("error" in loaded) {
		console.error(loaded.error);
		return 2;
	}

	if (cmd === "lint") {
		const defects = lintMold(loaded.mold);
		if (defects.length > 0) {
			for (const d of defects) console.error(`${path}: ${d}`);
			return 1;
		}
		const m = loaded.mold as Mold;
		console.log(json ? JSON.stringify(moldScope(m)) : `OK: ${m.id} r${m.revision} accepted (請書)`);
		return 0;
	}

	let cwd = ".";
	const na: Record<string, string> = {};
	for (let i = 0; i < rest.length; i++) {
		const a = rest[i];
		if (a === "--cwd") cwd = rest[++i] ?? ".";
		else if (a === "--na") {
			const item = rest[++i] ?? "";
			const eq = item.indexOf("=");
			if (eq <= 0) {
				console.error(`forescope: --na needs cN=reason, got \`${item}\``);
				return 2;
			}
			na[item.slice(0, eq)] = item.slice(eq + 1);
		}
	}
	let proof: ReturnType<typeof proveMold>;
	try {
		proof = proveMold(loaded.mold, { cwd, na });
	} catch (e) {
		if (e instanceof NaError) {
			console.error(`forescope: ${e.message}`);
			return 2;
		}
		throw e;
	}
	if (!proof.mold) {
		for (const d of proof.defects) console.error(`${path}: ${d}`);
		console.error("forescope: mold not accepted — nothing was run");
		return 1;
	}
	console.log(json ? JSON.stringify(proof, null, 2) : renderProof(proof));
	return proof.deliverable ? 0 : 1;
}

process.exit(main(process.argv.slice(2)));
