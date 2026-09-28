// Types mirror schema/mold.schema.json (the language-neutral SoT).
export interface Party {
	name: string;
	role: string;
}

export interface Mold {
	id: string;
	revision: number;
	issued: string;
	due: string;
	fabless: Party;
	foundry: Party;
	function: string;
	inputs: { name: string; type: string; domain: string; note?: string }[];
	files: string[];
	conditions: { id: string; when: string; then: string }[];
	verify: { condition: string; command: string }[];
	refs?: { molds?: string[]; docs?: string[]; plan7_node?: string };
}

export interface MoldScope {
	id: string;
	revision: number;
	files: string[];
	conditions: string[];
}

export type Response = "satisfied" | "not-satisfied" | "not-applicable";

export interface Proof {
	mold: { id: string; revision: number } | null;
	generated_at: string;
	environment: { runtime: string; platform: string; cwd: string };
	defects: string[];
	logic_proof: { condition: string; command: string; exit: number; ran_at: string; output_tail: string[] }[];
	requirement_proof: { condition: string; response: Response; evidence?: string; reason?: string }[];
	return_reasons: { condition: string; reason: string }[];
	deliverable: boolean;
}
