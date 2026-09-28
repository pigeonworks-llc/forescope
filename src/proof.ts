// Derive a mold's Logic Proof and Requirement Proof (forescoping method).
// Neither is hand-filled:
//   Logic Proof        each condition's verify command, actually executed
//   Requirement Proof  one row per condition ID, derived from the Logic Proof:
//                      satisfied (exit 0) / not-satisfied (non-zero) /
//                      not-applicable (declared with a reason)
// A mold that fails the intake check is not built against, so nothing runs.
import { spawnSync } from "node:child_process";
import { lintMold } from "./lint.js";
import type { Mold, Proof } from "./types.js";

export class NaError extends Error {}

const now = () => new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

export function proveMold(mold: unknown, opts: { cwd?: string; na?: Record<string, string> } = {}): Proof {
	const cwd = opts.cwd ?? process.cwd();
	const environment = {
		runtime: typeof Bun !== "undefined" ? `bun ${Bun.version}` : `node ${process.version}`,
		platform: `${process.platform}-${process.arch}`,
		cwd,
	};
	const defects = lintMold(mold);
	if (defects.length > 0) {
		return {
			mold: null,
			generated_at: now(),
			environment,
			defects,
			logic_proof: [],
			requirement_proof: [],
			return_reasons: [],
			deliverable: false,
		};
	}
	const m = mold as Mold;
	const na = opts.na ?? {};
	const known = new Set(m.conditions.map((c) => c.id));
	for (const [cid, reason] of Object.entries(na)) {
		if (!reason.trim()) throw new NaError(`not-applicable needs cN=reason, got \`${cid}=\``);
		if (!known.has(cid)) throw new NaError(`not-applicable names unknown condition \`${cid}\``);
	}

	const commands = new Map(m.verify.map((v) => [v.condition, v.command]));
	const proof: Proof = {
		mold: { id: m.id, revision: m.revision },
		generated_at: now(),
		environment,
		defects: [],
		logic_proof: [],
		requirement_proof: [],
		return_reasons: [],
		deliverable: true,
	};
	for (const cond of m.conditions) {
		const reason = na[cond.id];
		if (reason !== undefined) {
			proof.requirement_proof.push({ condition: cond.id, response: "not-applicable", reason: reason.trim() });
			continue;
		}
		const cmd = commands.get(cond.id) as string;
		const ranAt = now();
		const r = spawnSync("sh", ["-c", cmd], { cwd, encoding: "utf8" });
		const exit = r.status ?? 1;
		const tail = `${r.stdout ?? ""}${r.stderr ?? ""}`.trim().split("\n").filter(Boolean).slice(-5);
		proof.logic_proof.push({ condition: cond.id, command: cmd, exit, ran_at: ranAt, output_tail: tail });
		if (exit === 0) {
			proof.requirement_proof.push({ condition: cond.id, response: "satisfied", evidence: cmd });
		} else {
			proof.requirement_proof.push({ condition: cond.id, response: "not-satisfied", evidence: `${cmd} (exit ${exit})` });
			proof.return_reasons.push({ condition: cond.id, reason: `${cond.then} — verify exited ${exit}` });
		}
	}
	proof.deliverable = proof.return_reasons.length === 0;
	return proof;
}

export function renderProof(p: Proof): string {
	if (!p.mold) return `mold not accepted — nothing was run:\n${p.defects.map((d) => `- ${d}`).join("\n")}`;
	return [
		`## Requirement Proof — ${p.mold.id} r${p.mold.revision}`,
		"",
		"| 条件 | 応答 | 該当箇所 / 適用外根拠 |",
		"|---|---|---|",
		...p.requirement_proof.map((r) => `| ${r.condition} | ${r.response} | \`${r.evidence ?? r.reason ?? ""}\` |`),
		"",
		`Logic Proof: ${p.logic_proof.length} command(s) executed at ${p.generated_at} (${p.environment.runtime})`,
		`deliverable: ${p.deliverable ? "yes" : `no — return on ${p.return_reasons.map((r) => r.condition).join(", ")}`}`,
	].join("\n");
}
