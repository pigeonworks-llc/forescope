// The foundry's intake check of a mold (forescoping method, foundry manual 1-1..1-3,
// PR #19 shape). Returns the whole defect list at once — never just the first defect.
//
//   1-1  required fields present and well-formed   (JSON Schema, schema/mold.schema.json)
//   1-2  every name appearing in a test case's data is a parameter, and every
//        parameter appears in at least one test case's data
//   1-3  every test case has an expected result (schema); whether the wording is
//        judgeable cannot be decided mechanically and is left to the manual
//   +    test case IDs / parameter names are unique; `files` is a real boundary (not `**`)
//
// It never blocks a write; it tells the fabless what to fix before building.
import Ajv2020 from "ajv/dist/2020.js";
import schema from "../schema/mold.schema.json" with { type: "json" };
import type { Mold, MoldScope } from "./types.js";

const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);

// a glob with no literal path component turns the boundary off
const BROAD = /^[*/.~]*$/;

const isObj = (v: unknown): v is Record<string, unknown> =>
	typeof v === "object" && v !== null && !Array.isArray(v);

/** Names appearing in a test case's data (object keys, or `name=`/`name:` tokens in a string). */
function dataNames(data: unknown): string[] {
	if (isObj(data)) return Object.keys(data);
	if (typeof data === "string") {
		const out: string[] = [];
		for (const m of data.matchAll(/\b([A-Za-z_]\w*)\s*[=:]/g)) {
			if (m[1] !== undefined) out.push(m[1]);
		}
		return out;
	}
	return [];
}

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

	const paramNames = (Array.isArray(mold.parameters) ? mold.parameters : [])
		.filter(isObj)
		.map((p) => p.name)
		.filter((n): n is string => typeof n === "string" && n.length > 0);
	const paramSet = new Set(paramNames);
	const seenParam = new Set<string>();
	for (const n of paramNames) {
		if (seenParam.has(n)) defects.push(`parameters: duplicate parameter name \`${n}\``);
		seenParam.add(n);
	}

	const seenTc = new Set<string>();
	const usedParams = new Set<string>();
	const tcs = Array.isArray(mold.test_cases) ? mold.test_cases : [];
	for (const tc of tcs) {
		if (!isObj(tc)) continue;
		const id = typeof tc.id === "string" ? tc.id : "?";
		if (seenTc.has(id)) defects.push(`test_cases: duplicate test case id \`${id}\``);
		seenTc.add(id);
		const names = dataNames(tc.data);
		if (names.length === 0 && typeof tc.data === "string") {
			defects.push(`test_cases.${id}.data: no parameter names found; use a map`);
		}
		for (const n of names) {
			if (!paramSet.has(n)) {
				defects.push(`test_cases.${id}.data: name \`${n}\` has no parameter`);
			}
			usedParams.add(n);
		}
	}
	for (const n of paramNames) {
		if (!usedParams.has(n)) defects.push(`parameters: \`${n}\` appears in no test case`);
	}

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
		test_cases: mold.test_cases.map((t) => t.id),
	};
}
