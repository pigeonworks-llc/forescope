#!/usr/bin/env bun
// forescope — mold intake check and proofs.
//
//   forescope lint  <mold.yaml> [--json]
//   forescope proof <mold.yaml> [--cwd DIR] [--response TC-NNN=verdict[:text] ...] [--na TC-NNN=reason ...] [--json]
//
// Exit codes and output match the Python predecessor (dotfiles mold-lint /
// mold-proof) so callers can switch without change:
//   lint : 0 accepted (請書) / 1 defects on stderr / 2 usage or IO error
//   proof: 0 deliverable / 1 not deliverable / 2 usage error
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { lintMold, moldScope, proveMold, renderProof, ResponseError } from "./index.js";
import type { Mold, Response } from "./types.js";

function usage(): number {
	console.error(
		"usage: forescope lint <mold.yaml> [--json]\n       forescope proof <mold.yaml> [--cwd DIR] [--response TC-NNN=satisfied|not-satisfied|not-applicable[:text] ...] [--na TC-NNN=reason ...] [--json]",
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

const VERDICTS = new Set<Response>(["satisfied", "not-satisfied", "not-applicable"]);

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
	const responses: Record<string, { response: Response; text?: string }> = {};
	for (let i = 0; i < rest.length; i++) {
		const a = rest[i];
		if (a === "--cwd") cwd = rest[++i] ?? ".";
		else if (a === "--response" || a === "--na") {
			const item = rest[++i] ?? "";
			const eq = item.indexOf("=");
			if (eq <= 0) {
				console.error(`forescope: ${a} needs TC-NNN=verdict[:text], got \`${item}\``);
				return 2;
			}
			const tcId = item.slice(0, eq);
			if (a === "--na") {
				// sugar for --response TC-NNN=not-applicable:reason
				responses[tcId] = { response: "not-applicable", text: item.slice(eq + 1) };
				continue;
			}
			const rest1 = item.slice(eq + 1);
			const colon = rest1.indexOf(":");
			const verdict = colon === -1 ? rest1 : rest1.slice(0, colon);
			const text = colon === -1 ? "" : rest1.slice(colon + 1);
			if (!VERDICTS.has(verdict as Response)) {
				console.error(`forescope: --response needs verdict satisfied|not-satisfied|not-applicable, got \`${verdict}\``);
				return 2;
			}
			if (verdict === "not-applicable" && text.trim() === "") {
				console.error(`forescope: --response not-applicable needs TC-NNN=not-applicable:reason, got \`${item}\``);
				return 2;
			}
			responses[tcId] = { response: verdict as Response, text };
		}
	}
	let proof: ReturnType<typeof proveMold>;
	try {
		proof = proveMold(loaded.mold, { cwd, responses });
	} catch (e) {
		if (e instanceof ResponseError) {
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
