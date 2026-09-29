// types.ts is type-only; this pins that a schema-shaped object satisfies Mold.
import { expect, test } from "bun:test";
import type { Mold } from "./types.js";

test("a schema-shaped object satisfies Mold", () => {
	const m: Mold = {
		id: "m",
		revision: 1,
		issued: "2026-09-28",
		due: "2026-10-05",
		fabless: "a",
		foundry: "b",
		parameters: [{ name: "x", domain: "1..9" }],
		test_cases: [
			{
				id: "TC-001",
				scenario: "s",
				data: { x: 5 },
				expected: "e",
				command: "true",
			},
		],
		files: ["src/**"],
	};
	expect(m.test_cases[0]?.id).toBe("TC-001");
});
