// Ported from dotfiles dot_local/lib/mold-lint/tests/test_executable_mold-proof.py.
// Logic Proof = each condition's verify command actually executed.
// Requirement Proof = one row per condition ID, derived from the Logic Proof.
import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NaError, proveMold, renderProof } from "./index.js";

function mold(verify: Record<string, string>) {
	return {
		id: "mold-t",
		revision: 2,
		issued: "2026-09-28",
		due: "2026-10-05",
		fabless: { name: "a", role: "designer" },
		foundry: { name: "b", role: "implementer" },
		function: "f(x: int): y",
		inputs: [{ name: "x", type: "int", domain: "1..9" }],
		files: ["src/**"],
		conditions: Object.keys(verify).map((id) => ({ id, when: `when ${id}`, then: `then ${id}` })),
		verify: Object.entries(verify).map(([condition, command]) => ({ condition, command })),
	};
}

const tmp = () => mkdtempSync(join(tmpdir(), "forescope-"));
const rows = (p: ReturnType<typeof proveMold>) =>
	Object.fromEntries(p.requirement_proof.map((r) => [r.condition, r]));

describe("proveMold", () => {
	test("all pass is deliverable (c1)", () => {
		const p = proveMold(mold({ c1: "true", c2: "exit 0" }), { cwd: tmp() });
		expect(p.deliverable).toBe(true);
		expect(rows(p).c1!.response).toBe("satisfied");
		expect(rows(p).c2!.response).toBe("satisfied");
		expect(p.mold).toEqual({ id: "mold-t", revision: 2 });
		const lp = p.logic_proof.find((x) => x.condition === "c1")!;
		expect(lp.exit).toBe(0);
		expect(lp.ran_at).toBeTruthy();
		expect(p.environment.runtime).toBeTruthy();
	});

	test("failing command is not satisfied and returned (c2)", () => {
		const p = proveMold(mold({ c1: "true", c2: "exit 3" }), { cwd: tmp() });
		expect(p.deliverable).toBe(false);
		expect(rows(p).c1!.response).toBe("satisfied");
		expect(rows(p).c2!.response).toBe("not-satisfied");
		expect(p.return_reasons.map((r) => r.condition)).toEqual(["c2"]);
		expect(p.logic_proof.find((x) => x.condition === "c2")!.exit).toBe(3);
	});

	test("not-applicable is not run (c3)", () => {
		const dir = tmp();
		const marker = join(dir, "ran");
		const p = proveMold(mold({ c1: "true", c2: `touch ${marker}` }), {
			cwd: dir,
			na: { c2: "depends on hardware not in CI" },
		});
		expect(existsSync(marker)).toBe(false);
		expect(p.deliverable).toBe(true);
		expect(rows(p).c2!.response).toBe("not-applicable");
		expect(rows(p).c2!.reason).toBe("depends on hardware not in CI");
	});

	test("not-applicable needs a reason (c3)", () => {
		expect(() => proveMold(mold({ c1: "true" }), { cwd: tmp(), na: { c1: "" } })).toThrow(NaError);
	});

	test("not-applicable for unknown condition (c3)", () => {
		expect(() => proveMold(mold({ c1: "true" }), { cwd: tmp(), na: { c9: "x" } })).toThrow(NaError);
	});

	test("invalid mold runs nothing (c4)", () => {
		const dir = tmp();
		const marker = join(dir, "ran");
		const m = mold({ c1: `touch ${marker}` }) as Record<string, unknown>;
		delete m.due;
		const p = proveMold(m, { cwd: dir });
		expect(existsSync(marker)).toBe(false);
		expect(p.deliverable).toBe(false);
		expect(p.defects.join("\n")).toContain("due");
	});

	test("markdown table has a row per condition", () => {
		const md = renderProof(proveMold(mold({ c1: "true", c2: "exit 1" }), { cwd: tmp() }));
		expect(md).toContain("| c1 |");
		expect(md).toContain("| c2 |");
		expect(md).toContain("not-satisfied");
	});
});
