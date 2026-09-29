// The foundry intake check (forescopingmethod PR #19, foundry manual 1-1..1-3).
import { describe, expect, test } from "bun:test";
import { lintMold, moldScope } from "./index.js";

function goodMold(): Record<string, unknown> {
	return {
		id: "mold-demo-1",
		revision: 1,
		issued: "2026-09-28",
		due: "2026-10-05",
		fabless: "shunichi",
		foundry: "weak-main",
		parameters: [
			{ name: "amount", domain: "1..1000000" },
			{ name: "deadline", domain: ">= issued" },
		],
		test_cases: [
			{
				id: "TC-001",
				scenario: "amount is within the approve threshold",
				precondition: "issued = 2026-09-28",
				data: { amount: 50000, deadline: "2026-10-01" },
				expected: "approve",
			},
			{
				id: "TC-002",
				scenario: "amount exceeds the approve threshold",
				data: { amount: 500000, deadline: "2026-10-01" },
				expected: "reject",
				command: "bun test tests/approval.test.ts -t large",
			},
		],
		files: ["src/approval/**"],
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

	test("name in data but not in parameters", () => {
		const m = goodMold();
		(m.test_cases as { data: Record<string, unknown> }[])[0]!.data = {
			amount: 50000,
			deadline: "2026-10-01",
			extra: "x",
		};
		expect(joined(m)).toContain("`extra` has no parameter");
	});

	test("parameter appearing in no test case", () => {
		const m = goodMold();
		// Remove the only case whose data uses `deadline`.
		(m.test_cases as { data: Record<string, unknown> }[])[0]!.data = { amount: 50000 };
		(m.test_cases as { data: Record<string, unknown> }[])[1]!.data = { amount: 500000 };
		expect(joined(m)).toContain("`deadline` appears in no test case");
	});

	test("duplicate test case id", () => {
		const m = goodMold();
		(m.test_cases as { id: string }[])[1]!.id = "TC-001";
		expect(joined(m)).toContain("duplicate test case id `TC-001`");
	});

	test("duplicate parameter name", () => {
		const m = goodMold();
		(m.parameters as { name: string; domain: string }[]).push({ name: "amount", domain: "any" });
		expect(joined(m)).toContain("duplicate parameter name `amount`");
	});

	test("string data with name= tokens passes 1-2", () => {
		const m = goodMold();
		(m.test_cases as { data: unknown }[])[0]!.data = "amount=50000 deadline=2026-10-01";
		expect(lintMold(m)).toEqual([]);
	});

	test("string data with no names is a defect", () => {
		const m = goodMold();
		(m.test_cases as { data: unknown }[])[0]!.data = "50000, 2026-10-01";
		expect(joined(m)).toContain("no parameter names found");
	});

	test("bad test case id form", () => {
		const m = goodMold();
		(m.test_cases as { id: string }[])[0]!.id = "c1";
		expect(joined(m)).toContain("must match pattern");
	});

	test("unbounded file glob is rejected", () => {
		const m = goodMold();
		m.files = ["**"];
		expect(joined(m)).toContain("files");
	});

	test("all problems reported at once", () => {
		const m = goodMold();
		delete m.due;
		(m.test_cases as { data: Record<string, unknown> }[])[0]!.data = { amount: 50000 };
		(m.test_cases as { data: Record<string, unknown> }[])[1]!.data = { amount: 500000 };
		const out = joined(m);
		expect(out).toContain("due");
		expect(out).toContain("no test case");
	});

	test("non-object mold is a defect, not a crash", () => {
		expect(lintMold("nope").length).toBeGreaterThan(0);
	});
});

describe("moldScope", () => {
	test("scope lists files and test case ids", () => {
		expect(moldScope(goodMold() as never)).toEqual({
			id: "mold-demo-1",
			revision: 1,
			files: ["src/approval/**"],
			test_cases: ["TC-001", "TC-002"],
		});
	});
});
