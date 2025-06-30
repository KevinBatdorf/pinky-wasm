import { unsignedLEB, valType } from "./wasm";

type VarInfo = { name: string; index: number };
type Scope = Map<string, VarInfo>;

export const scopes: Scope[] = [new Map()]; // global scope
export const enterScope = () => scopes.push(new Map());
export const exitScope = () => scopes.pop();
export const clearScopes = () => {
	scopes.length = 0; // clear all scopes
	scopes.push(new Map()); // reinitialize with global scope
};
export const setScopes = (newScopes: Scope[]) => {
	scopes.length = 0; // clear current scopes
	scopes.push(...newScopes); // set new scopes
};
export const getCurrentScope = (): Scope => {
	const currentScope = scopes.at(-1);
	if (!currentScope) {
		throw new Error("No current scope available");
	}
	return currentScope;
};
const findScopeForVar = (name: string): Scope => {
	// walk up scopes from the last looking for the variable
	for (let i = 1; i < scopes.length + 1; i++) {
		const scope = scopes.at(-i);
		if (scope?.has(name)) return scope;
	}
	return getCurrentScope(); // fallsback to the last scope
};
export const declareVar = (name: string, isLocal: boolean): VarInfo | null => {
	if (isLocal && scopes.at(-1)?.has(name)) {
		// Cant do local x := 1 twice in the same scope
		throw new Error(`Variable "${name}" already declared in current scope`);
	}
	const scope = isLocal ? scopes.at(-1) : findScopeForVar(name);
	if (!scope) throw new Error(`No scope found for variable "${name}"`);
	const index = scope.has(name)
		? scope?.get(name)?.index
		: nextLocalVarsIndex++;
	if (typeof index === "undefined") {
		throw new Error(`Failed to get index for variable "${name}"`);
	}
	const varInfo: VarInfo = { name, index };
	scope.set(name, varInfo);
	return varInfo;
};
export const getVar = (name: string): VarInfo | undefined =>
	findScopeForVar(name)?.get(name);

// for local variables and function parameters
let nextLocalVarsIndex = 0;
export const setLocalVarsIndex = (index: number) => {
	nextLocalVarsIndex = index;
};
export const getLocalVarsIndex = (): number => nextLocalVarsIndex;

// For temporary variables, they can override
export const consumeScratchIndex = (): number => nextLocalVarsIndex++;

export const getLocalDecls = () => {
	if (nextLocalVarsIndex === 0) return unsignedLEB(0);
	return [
		...unsignedLEB(1), // 1 type group
		...unsignedLEB(nextLocalVarsIndex), // N locals
		valType("i32"), // all locals are boxed i32
	];
};

// Create a string table to manage string offsets in the WASM binary
export const createStringTable = () => {
	let memoryOffset = 0;
	const encoder = new TextEncoder();
	const table = new Map<string, number>();
	return {
		getBytes: () => {
			const all = Array.from(table.entries()).flatMap(([str]) => [
				...encoder.encode(str),
				0x00,
			]);
			return new Uint8Array(all);
		},
		getOffset(str: string): number {
			const existing = table.get(str);
			if (existing !== undefined) return existing;
			const offset = memoryOffset;
			table.set(str, offset);
			memoryOffset += encoder.encode(str).length + 1;
			return offset;
		},
	};
};
