// Derive a mold's Logic Proof and Requirement Proof (forescoping method).
// Neither is hand-filled:
//   Logic Proof        each test case's verify command, actually executed
//   Requirement Proof  one row per test case ID: satisfied (exit 0) /
//                      not-satisfied (non-zero) / not-applicable (declared with
//                      a reason) / answered via --response. A test case with
//                      neither a command nor a response is pending — delivery
//                      is blocked until it is answered.
// A mold that fails the intake check is not built against, so nothing runs.
import { spawnSync } from "node:child_process";
import { lintMold } from "./lint.js";
import type { Mold, Proof, Response } from "./types.js";

export class ResponseError extends Error {}
// Backward-compatible alias (the class predates the --response flag).
export { ResponseError as NaError };

const now = () => new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

export function proveMold(
	mold: unknown,
	opts: { cwd?: string; responses?: Record<string, { response: Response; text?: string }> } = {},
): Proof {
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
			pending: [],
			return_reasons: [],
			deliverable: false,
		};
	}
	const m = mold as Mold;
	const responses = opts.responses ?? {};
	const known = new Set(m.test_cases.map((t) => t.id));
	for (const [tcId, r] of Object.entries(responses)) {
		if (!known.has(tcId)) throw new ResponseError(`response names unknown test case \`${tcId}\``);
		if (r.response === "not-applicable" && !(r.text ?? "").trim()) {
			throw new ResponseError(`not-applicable needs TC-NNN=reason, got \`${tcId}=\``);
		}
	}

	const proof: Proof = {
		mold: { id: m.id, revision: m.revision },
		generated_at: now(),
		environment,
		defects: [],
		logic_proof: [],
		requirement_proof: [],
		pending: [],
		return_reasons: [],
		deliverable: true,
	};
	for (const tc of m.test_cases) {
		const answered = responses[tc.id];
		if (answered !== undefined) {
			if (tc.command !== undefined && answered.response !== "not-applicable") {
				throw new ResponseError(
					`\`${tc.id}\` has a command; the command decides (only not-applicable is allowed)`,
				);
			}
			proof.requirement_proof.push({
				test_case: tc.id,
				response: answered.response,
				...(answered.response === "not-applicable"
					? { reason: (answered.text ?? "").trim() }
					: { evidence: (answered.text ?? "").trim() || "(answered by --response)" }),
			});
			continue;
		}
		if (tc.command === undefined) {
			proof.pending.push(tc.id);
			proof.return_reasons.push({
				test_case: tc.id,
				reason: `${tc.expected} — no command and no --response`,
			});
			continue;
		}
		const ranAt = now();
		const r = spawnSync("sh", ["-c", tc.command], { cwd, encoding: "utf8" });
		const exit = r.status ?? 1;
		const tail = `${r.stdout ?? ""}${r.stderr ?? ""}`.trim().split("\n").filter(Boolean).slice(-5);
		proof.logic_proof.push({ test_case: tc.id, command: tc.command, exit, ran_at: ranAt, output_tail: tail });
		if (exit === 0) {
			proof.requirement_proof.push({ test_case: tc.id, response: "satisfied", evidence: tc.command });
		} else {
			proof.requirement_proof.push({
				test_case: tc.id,
				response: "not-satisfied",
				evidence: `${tc.command} (exit ${exit})`,
			});
			proof.return_reasons.push({
				test_case: tc.id,
				reason: `${tc.expected} — verify exited ${exit}`,
			});
		}
	}
	proof.deliverable = proof.return_reasons.length === 0;
	return proof;
}

const VERDICT_JA: Record<Response, string> = {
	satisfied: "満たしている",
	"not-satisfied": "満たしていない",
	"not-applicable": "適用外",
};

export function renderProof(p: Proof): string {
	if (!p.mold) return `mold not accepted — nothing was run:\n${p.defects.map((d) => `- ${d}`).join("\n")}`;
	const rows = p.requirement_proof.map(
		(r) => `| ${r.test_case} | ${VERDICT_JA[r.response]} | \`${r.evidence ?? r.reason ?? ""}\` |`,
	);
	for (const id of p.pending) rows.push(`| ${id} | 未応答 | (no command and no --response) |`);
	return [
		`## Requirement Proof — ${p.mold.id} r${p.mold.revision}`,
		"",
		"| テストケースID | 判定 | 根拠 / 適用外の根拠 |",
		"|---|---|---|",
		...rows,
		"",
		`Logic Proof: ${p.logic_proof.length} command(s) executed at ${p.generated_at} (${p.environment.runtime})`,
		`deliverable: ${p.deliverable ? "yes" : `no — return on ${p.return_reasons.map((r) => r.test_case).join(", ")}`}`,
	].join("\n");
}
