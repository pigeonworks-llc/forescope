// The public surface aiq and the dotfiles shim depend on.
import { expect, test } from "bun:test";
import * as api from "./index.js";

test("public surface", () => {
	for (const name of ["lintMold", "moldScope", "proveMold", "renderProof", "NaError", "ResponseError"]) {
		expect(typeof (api as Record<string, unknown>)[name]).toBe("function");
	}
});
