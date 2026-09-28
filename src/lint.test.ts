// Ported from dotfiles dot_local/lib/mold-lint/tests/test_executable_mold-lint.py
// (same cases, same expectations). The foundry intake check, manual 1-1..1-3.
import { describe, expect, test } from "bun:test";
import { lintMold, moldScope } from "./index.js";

function goodMold(): Record<string, unknown> {
	return {
		id: "mold-demo-1",
		revision: 1,
		issued: "2026-09-28",
		due: "2026-10-05",
		fabless: { name: "shunichi", role: "designer" },
		foundry: { name: "weak-main", role: "implementer" },
		function: "f(amount: int, deadline: date): approve | reject",
		inputs: [
			{ name: "amount", type: "int", domain: "1..1000000" },
			{ name: "deadline", type: "date", domain: ">= issued" },
		],
		files: ["src/approval/**"],
		conditions: [
			{ id: "c1", when: "amount <= 100000", then: "approve" },
			{ id: "c2", when: "amount > 100000", then: "reject" },
		],
		verify: [
			{ condition: "c1", command: "bun test tests/approval.test.ts -t c1" },
			{ condition: "c2", command: "bun test tests/approval.test.ts -t c2" },
		],
	};
}

const joined = (m: unknown) => lintMold(m).join("\n");

describe("lintMold", () => {
	test("good mold passes", () => {
		expect(lintMold(goodMold())).toEqual([]);
	});

	test("missing required field is listed", () => {
		const m = goodMold();
		delete m.due;
		expect(joined(m)).toContain("due");
	});

	test("argument without input row", () => {
		const m = goodMold();
		m.inputs = (m.inputs as unknown[]).slice(0, 1);
		expect(joined(m)).toContain("deadline");
	});

	test("input row without argument", () => {
		const m = goodMold();
		(m.inputs as unknown[]).push({ name: "extra", type: "str", domain: "any" });
		expect(joined(m)).toContain("extra");
	});

	test("condition without verification", () => {
		const m = goodMold();
		m.verify = (m.verify as unknown[]).slice(0, 1);
		expect(joined(m)).toContain("c2");
	});

	test("verification for unknown condition", () => {
		const m = goodMold();
		(m.verify as unknown[]).push({ condition: "c9", command: "true" });
		expect(joined(m)).toContain("c9");
	});

	test("duplicate condition id", () => {
		const m = goodMold();
		(m.conditions as { id: string }[])[1]!.id = "c1";
		expect(joined(m)).toContain("duplicate condition id `c1`");
	});

	test("function not in f form", () => {
		const m = goodMold();
		m.function = "approves small amounts";
		expect(joined(m)).toContain("function");
	});

	test("unbounded file glob is rejected", () => {
		const m = goodMold();
		m.files = ["**"];
		expect(joined(m)).toContain("files");
	});

	test("all problems reported at once", () => {
		const m = goodMold();
		delete m.due;
		m.verify = (m.verify as unknown[]).slice(0, 1);
		const out = joined(m);
		expect(out).toContain("due");
		expect(out).toContain("c2");
	});

	test("non-object mold is a defect, not a crash", () => {
		expect(lintMold("nope").length).toBeGreaterThan(0);
	});
});

describe("moldScope", () => {
	test("scope lists files and condition ids", () => {
		expect(moldScope(goodMold() as never)).toEqual({
			id: "mold-demo-1",
			revision: 1,
			files: ["src/approval/**"],
			conditions: ["c1", "c2"],
		});
	});
});
