// types.ts is type-only; this pins that a schema-shaped object satisfies Mold.
import { expect, test } from "bun:test";
import type { Mold } from "./types.js";

test("a schema-shaped object satisfies Mold", () => {
	const m: Mold = {
		id: "m",
		revision: 1,
		issued: "2026-09-28",
		due: "2026-10-05",
		fabless: { name: "a", role: "r" },
		foundry: { name: "b", role: "r" },
		function: "f(x: int): y",
		inputs: [{ name: "x", type: "int", domain: "1..9" }],
		files: ["src/**"],
		conditions: [{ id: "c1", when: "w", then: "t" }],
		verify: [{ condition: "c1", command: "true" }],
	};
	expect(m.conditions[0]?.id).toBe("c1");
});
