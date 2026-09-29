// Logic Proof = each test case's verify command actually executed.
// Requirement Proof = one row per test case ID, derived from the Logic Proof
// (or answered via --response). A case with neither command nor response is
// pending — delivery is blocked until it is answered.
import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { proveMold, renderProof, ResponseError } from "./index.js";

function mold(cases: { id: string; command?: string; expected?: string }[]) {
	return {
		id: "mold-t",
		revision: 2,
		issued: "2026-09-28",
		due: "2026-10-05",
		fabless: "a",
		foundry: "b",
		parameters: [{ name: "x", domain: "1..9" }],
		files: ["src/**"],
		test_cases: cases.map((c) => ({
			id: c.id,
			scenario: `scenario ${c.id}`,
			data: { x: 5 },
			expected: c.expected ?? `expected ${c.id}`,
			...(c.command !== undefined ? { command: c.command } : {}),
		})),
	};
}

const tmp = () => mkdtempSync(join(tmpdir(), "forescope-"));
const rows = (p: ReturnType<typeof proveMold>) =>
	Object.fromEntries(p.requirement_proof.map((r) => [r.test_case, r]));

describe("proveMold", () => {
	test("all commands pass is deliverable", () => {
		const p = proveMold(mold([{ id: "TC-001", command: "true" }, { id: "TC-002", command: "exit 0" }]), { cwd: tmp() });
		expect(p.deliverable).toBe(true);
		expect(rows(p)["TC-001"]!.response).toBe("satisfied");
		expect(rows(p)["TC-002"]!.response).toBe("satisfied");
		expect(p.mold).toEqual({ id: "mold-t", revision: 2 });
		const lp = p.logic_proof.find((x) => x.test_case === "TC-001")!;
		expect(lp.exit).toBe(0);
		expect(lp.ran_at).toBeTruthy();
		expect(p.environment.runtime).toBeTruthy();
	});

	test("failing command is not satisfied and returned", () => {
		const p = proveMold(mold([{ id: "TC-001", command: "true" }, { id: "TC-002", command: "exit 3" }]), { cwd: tmp() });
		expect(p.deliverable).toBe(false);
		expect(rows(p)["TC-001"]!.response).toBe("satisfied");
		expect(rows(p)["TC-002"]!.response).toBe("not-satisfied");
		expect(p.return_reasons.map((r) => r.test_case)).toEqual(["TC-002"]);
		expect(p.logic_proof.find((x) => x.test_case === "TC-002")!.exit).toBe(3);
	});

	test("not-applicable response is not run", () => {
		const dir = tmp();
		const marker = join(dir, "ran");
		const p = proveMold(mold([{ id: "TC-001", command: "true" }, { id: "TC-002", command: `touch ${marker}` }]), {
			cwd: dir,
			responses: { "TC-002": { response: "not-applicable", text: "depends on hardware not in CI" } },
		});
		expect(existsSync(marker)).toBe(false);
		expect(p.deliverable).toBe(true);
		expect(rows(p)["TC-002"]!.response).toBe("not-applicable");
		expect(rows(p)["TC-002"]!.reason).toBe("depends on hardware not in CI");
	});

	test("not-applicable response needs a reason", () => {
		expect(() =>
			proveMold(mold([{ id: "TC-001", command: "true" }]), {
				cwd: tmp(),
				responses: { "TC-001": { response: "not-applicable", text: "" } },
			}),
		).toThrow(ResponseError);
	});

	test("response names an unknown test case", () => {
		expect(() =>
			proveMold(mold([{ id: "TC-001", command: "true" }]), {
				cwd: tmp(),
				responses: { "TC-999": { response: "satisfied" } },
			}),
		).toThrow(ResponseError);
	});

	test("command case accepts only not-applicable as a response", () => {
		expect(() =>
			proveMold(mold([{ id: "TC-001", command: "true" }]), {
				cwd: tmp(),
				responses: { "TC-001": { response: "satisfied" } },
			}),
		).toThrow(ResponseError);
	});

	test("command-less case without a response is pending and blocks delivery", () => {
		const p = proveMold(mold([{ id: "TC-001", command: "true" }, { id: "TC-002" }]), { cwd: tmp() });
		expect(p.pending).toEqual(["TC-002"]);
		expect(p.deliverable).toBe(false);
		expect(p.return_reasons.map((r) => r.test_case)).toEqual(["TC-002"]);
		expect(p.logic_proof).toHaveLength(1);
	});

	test("command-less case with a response is answered", () => {
		const p = proveMold(mold([{ id: "TC-001", command: "true" }, { id: "TC-002" }]), {
			cwd: tmp(),
			responses: { "TC-002": { response: "satisfied", text: "manually checked" } },
		});
		expect(p.pending).toEqual([]);
		expect(p.deliverable).toBe(true);
		expect(rows(p)["TC-002"]!.response).toBe("satisfied");
		expect(rows(p)["TC-002"]!.evidence).toBe("manually checked");
	});

	test("invalid mold runs nothing", () => {
		const dir = tmp();
		const marker = join(dir, "ran");
		const m = mold([{ id: "TC-001", command: `touch ${marker}` }]) as Record<string, unknown>;
		delete m.due;
		const p = proveMold(m, { cwd: dir });
		expect(existsSync(marker)).toBe(false);
		expect(p.deliverable).toBe(false);
		expect(p.defects.join("\n")).toContain("due");
	});

	test("markdown table has a row per test case with author terms", () => {
		const md = renderProof(proveMold(mold([{ id: "TC-001", command: "true" }, { id: "TC-002", command: "exit 1" }]), { cwd: tmp() }));
		expect(md).toContain("| TC-001 |");
		expect(md).toContain("| TC-002 |");
		expect(md).toContain("満たしていない");
	});

	test("markdown table lists pending cases as 未応答", () => {
		const md = renderProof(proveMold(mold([{ id: "TC-001" }]), { cwd: tmp() }));
		expect(md).toContain("未応答");
	});
});
