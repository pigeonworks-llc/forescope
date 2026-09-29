// CLI contract: exit codes and output shape match the Python predecessor, so
// the dotfiles hook and make target switch without change.
import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CLI = join(import.meta.dir, "cli.ts");
const FIX = join(import.meta.dir, "fixtures");
const run = (...args: string[]) => spawnSync("bun", ["run", CLI, ...args], { encoding: "utf8" });

test("lint accepts a real mold (請書)", () => {
	const r = run("lint", join(FIX, "mold-proof.yaml"));
	expect(r.status).toBe(0);
	expect(r.stdout).toContain("OK: mold-proof r1 accepted (請書)");
});

test("lint --json prints the scope", () => {
	const r = run("lint", join(FIX, "mold-plan-pointer.yaml"), "--json");
	expect(r.status).toBe(0);
	const s = JSON.parse(r.stdout);
	expect(s.id).toBe("mold-plan-pointer");
	expect(s.test_cases).toEqual(["TC-001", "TC-002", "TC-003"]);
});

test("lint defects exit 1 on stderr", () => {
	const d = mkdtempSync(join(tmpdir(), "fs-"));
	const p = join(d, "bad.yaml");
	writeFileSync(p, "id: x\n");
	const r = run("lint", p);
	expect(r.status).toBe(1);
	expect(r.stderr).toContain("revision");
});

test("missing file is usage/IO error 2", () => {
	expect(run("lint", "/nonexistent/mold.yaml").status).toBe(2);
});

test("unknown subcommand is 2", () => {
	expect(run("bogus", "x").status).toBe(2);
});

test("proof --na without reason is 2", () => {
	expect(run("proof", join(FIX, "mold-proof.yaml"), "--na", "TC-001").status).toBe(2);
});

test("proof --response without a verdict is 2", () => {
	expect(run("proof", join(FIX, "mold-proof.yaml"), "--response", "TC-001=maybe").status).toBe(2);
});

test("proof pending (no command, no response) exits 1 and names the case", () => {
	const r = run("proof", join(FIX, "mold-proof.yaml"));
	expect(r.status).toBe(1);
	expect(r.stdout).toContain("TC-003");
});

test("proof with --response for a command-less case answers that case", () => {
	const r = run("proof", join(FIX, "mold-plan-pointer.yaml"), "--response", "TC-003=satisfied:verified manually");
	// TC-001/002 carry dotfiles-only commands (fail here) so delivery is blocked,
	// but TC-003 must be answered by the --response, not listed as pending.
	expect(r.stdout).toContain("TC-003");
	expect(r.stdout).toContain("verified manually");
	expect(r.stdout).not.toContain("未応答");
});
