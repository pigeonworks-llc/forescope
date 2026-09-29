// Types mirror schema/mold.schema.json (the language-neutral SoT).
// The shape follows the forescopingmethod PR #19 class (parameters + test
// cases); `files` and `test_cases[].command` are forescope extensions.
export interface Parameter {
  name: string;
  domain: string;
  note?: string;
}

export interface TestCase {
  id: string;
  scenario: string;
  precondition?: string;
  data: Record<string, unknown> | string;
  expected: string;
  command?: string;
}

export interface Mold {
  id: string;
  revision: number;
  issued: string;
  due: string;
  fabless: string;
  foundry: string;
  parameters: Parameter[];
  test_cases: TestCase[];
  files: string[];
  refs?: { molds?: string[]; docs?: string[]; plan7_node?: string };
}

export interface MoldScope {
  id: string;
  revision: number;
  files: string[];
  test_cases: string[];
}

export type Response = "satisfied" | "not-satisfied" | "not-applicable";

export interface Proof {
  mold: { id: string; revision: number } | null;
  generated_at: string;
  environment: { runtime: string; platform: string; cwd: string };
  defects: string[];
  logic_proof: { test_case: string; command: string; exit: number; ran_at: string; output_tail: string[] }[];
  requirement_proof: { test_case: string; response: Response; evidence?: string; reason?: string }[];
  /** Test cases with neither a command nor a --response — delivery is blocked until answered. */
  pending: string[];
  return_reasons: { test_case: string; reason: string }[];
  deliverable: boolean;
}
