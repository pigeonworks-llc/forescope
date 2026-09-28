// The foundry's intake check of a mold (forescoping method, foundry manual 1-1..1-3).
// Returns the whole defect list at once — never just the first defect.
//
//   1-1  required fields present and well-formed   (JSON Schema, schema/mold.schema.json)
//   1-2  the decision function's arguments match the input table one-to-one
//   1-3  every condition ID has a verification step; no step names an unknown one
//   +    condition IDs are unique; `files` is a real boundary (not `**`)
//
// It never blocks a write; it tells the fabless what to fix before building.
import Ajv2020 from "ajv/dist/2020.js";
import schema from "../schema/mold.schema.json" with { type: "json" };
import type { Mold, MoldScope } from "./types.js";

const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);

// a glob with no literal path component turns the boundary off
const BROAD = /^[*/.~]*$/;

export function functionArgs(sig: string): string[] | null {
	const m = /^\s*f\((.*)\)\s*:\s*\S/.exec(sig);
	if (!m) return null;
	const inner = (m[1] ?? "").trim();
	if (!inner) return [];
	return inner.split(",").map((part) => (part.split(":")[0] ?? "").trim());
}

const isObj = (v: unknown): v is Record<string, unknown> =>
	typeof v === "object" && v !== null && !Array.isArray(v);

export function lintMold(mold: unknown): string[] {
	const defects: string[] = [];

	// 1-1: shape (every schema error, not only the first)
	if (!validate(mold)) {
		for (const e of validate.errors ?? []) {
			const where = e.instancePath.replace(/^\//, "").replaceAll("/", ".") || "(root)";
			const detail =
				e.keyword === "required"
					? `'${(e.params as { missingProperty: string }).missingProperty}' is a required property`
					: e.message;
			defects.push(`${where}: ${detail}`);
		}
	}
	if (!isObj(mold)) return defects;

	// 1-2: decision function arguments vs input table
	const rows = (Array.isArray(mold.inputs) ? mold.inputs : [])
		.filter(isObj)
		.map((r) => r.name)
		.filter((n): n is string => typeof n === "string" && n.length > 0);
	if (typeof mold.function === "string") {
		const args = functionArgs(mold.function);
		if (args === null) {
			defects.push("function: not in the form f(arg: type, ...): output");
		} else {
			for (const a of args) if (!rows.includes(a)) defects.push(`inputs: argument \`${a}\` has no input row`);
			for (const r of rows) if (!args.includes(r)) defects.push(`inputs: row \`${r}\` is not an argument of function`);
		}
	}

	// 1-3: every condition verified, no orphan verification
	const condIds = (Array.isArray(mold.conditions) ? mold.conditions : [])
		.filter(isObj)
		.map((c) => c.id)
		.filter((id): id is string => typeof id === "string" && id.length > 0);
	const seen = new Set<string>();
	for (const id of condIds) {
		if (seen.has(id)) defects.push(`conditions: duplicate condition id \`${id}\``);
		seen.add(id);
	}
	const verified = new Set(
		(Array.isArray(mold.verify) ? mold.verify : [])
			.filter(isObj)
			.map((v) => v.condition)
			.filter((c): c is string => typeof c === "string" && c.length > 0),
	);
	for (const id of seen) if (!verified.has(id)) defects.push(`verify: condition \`${id}\` has no verification step`);
	for (const v of [...verified].sort()) if (!seen.has(v)) defects.push(`verify: step names unknown condition \`${v}\``);

	// the input scope must be a boundary
	for (const g of Array.isArray(mold.files) ? mold.files : []) {
		if (typeof g === "string" && BROAD.test(g.trim())) {
			defects.push(
				`files: \`${g}\` has no literal path — it is not a boundary; split the mold until its files can be named`,
			);
		}
	}
	return defects;
}

export function moldScope(mold: Mold): MoldScope {
	return {
		id: mold.id,
		revision: mold.revision,
		files: mold.files,
		conditions: mold.conditions.map((c) => c.id),
	};
}
