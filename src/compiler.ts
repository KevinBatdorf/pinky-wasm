import type { AST } from "./parser";
import type { Expression } from "./syntax";
import {
	emitSection,
	unsignedLEB,
	signedLEB,
	encodeString,
	encodeF64,
	typeCode,
	nativeBinOps,
	modFunctionBody,
	powFunctionBody,
} from "./wasm";

export type CompilerErrorType = Error | null;

// Set up function signatures
const importFunctions = [
	{ name: "print", type: { params: ["i32", "i32"], results: [] } },
	{ name: "println", type: { params: ["i32", "i32"], results: [] } },
	{ name: "print_64", type: { params: ["f64"], results: [] } },
	{ name: "println_64", type: { params: ["f64"], results: [] } },
] as const;
const definedFunctions = [
	{ name: "main", type: { params: [], results: [] } },
	{ name: "mod", type: { params: ["f64", "f64"], results: ["f64"] } },
	{ name: "pow", type: { params: ["f64", "f64"], results: ["f64"] } },
] as const;
const allFunctions = [...definedFunctions, ...importFunctions];
// We can only add a type once, so we use a map to track them
const typeMap = new Map<string, number>();
const typeEntries: number[][] = [];
const functionIndices: Record<string, number> = {};
const getTypeKey = (type: {
	params: readonly string[];
	results: readonly string[];
}) => `(${type.params.join(",")})=>(${type.results.join(",")})`;
// Set types for all functions
for (const imp of allFunctions) {
	const key = getTypeKey(imp.type);
	if (typeMap.has(key)) continue;
	typeMap.set(key, typeMap.size); // increment as we add
	typeEntries.push([
		0x60, // function type
		...unsignedLEB(imp.type.params.length), // number of params
		...imp.type.params.map((p) => typeCode(p)), // params
		...unsignedLEB(imp.type.results.length), // number of results
		...imp.type.results.map((r) => typeCode(r)), // results
	]);
}
importFunctions.forEach((imp, i) => {
	functionIndices[imp.name] = i;
});
definedFunctions.forEach((def, i) => {
	functionIndices[def.name] = importFunctions.length + i;
});

// Manage variables
type VarType = "f64" | "i32"; // (number/bool) | string
type VarInfo = { type: VarType; name: string; index?: number };
// Apply the index above after we know all variables
const assignLocalIndices = (): Map<VarType, number> => {
	const counts = new Map<VarType, number>();
	const vars: { varInfo: VarInfo; type: VarType; slots: number }[] = [];

	// First pass: collect and count
	for (const scope of scopes) {
		for (const [, varInfo] of scope.entries()) {
			if (varInfo.index !== undefined) continue;
			const slots = varInfo.type === "i32" ? 2 : 1;
			counts.set(varInfo.type, (counts.get(varInfo.type) ?? 0) + slots);
			vars.push({ varInfo, type: varInfo.type, slots });
		}
	}

	// Assign indices sequentially, grouped by type order
	const typeOrder = Array.from(counts.keys());
	const typeStarts = new Map<VarType, number>();
	let offset = 0;
	for (const type of typeOrder) {
		typeStarts.set(type, offset);
		offset += counts.get(type) || 0;
	}

	// Assign indices in declaration order
	const typeOffsets = new Map(typeStarts);
	for (const type of typeOrder) {
		for (const { varInfo, type: t, slots } of vars) {
			if (t !== type) continue;
			varInfo.index = typeOffsets.get(type) || 0;
			typeOffsets.set(type, varInfo.index + slots);
		}
	}

	return counts;
};

type Patch = {
	name: string; // name of the variable to patch
	offset: number; // offset in the bytecode to patch
	type: VarType; // type of the variable, if known
	slot?: number; // delta relative to offset
};
const placeholder = 0xff;
// We need placeholders to manage type indexes
const patches: Patch[] = [];
const applyPatches = (instructions: number[]) => {
	for (const patch of patches) {
		const scope = findScopeForVar(patch.name);
		if (!scope) throw new Error(`Scope not found for ${patch.name}`);
		const varInfo = scope.get(patch.name);
		if (!varInfo || varInfo.index === undefined)
			throw new Error(`Unresolved variable index for "${patch.name}"`);
		const encoded = unsignedLEB(varInfo.index + (patch.slot ?? 0));
		instructions.splice(patch.offset, 1, ...encoded);
	}
	return instructions;
};
type Scope = Map<string, VarInfo>;
let scopes: Scope[] = [new Map()]; // global scope
// const enterScope = () => scopes.push(new Map());
// const exitScope = () => scopes.pop();

const findScopeForVar = (name: string): Scope | null =>
	scopes
		.slice()
		.reverse()
		.find((scope) => scope.has(name)) ?? scopes[0]; // global scope fallback
const declareVar = (
	name: string,
	type: VarType,
	isLocal: boolean,
): VarInfo | null => {
	const scope = isLocal ? scopes[scopes.length - 1] : findScopeForVar(name);
	if (!scope) throw new Error(`No scope found for variable "${name}"`);
	if (scope.has(name))
		throw new Error(`Variable "${name}" already declared in this scope`);
	const varInfo: VarInfo = { name, type };
	scope.set(name, varInfo);
	return varInfo;
};
const getVar = (name: string): VarInfo => {
	const varInfo = findScopeForVar(name)?.get(name);
	if (!varInfo)
		throw new Error(`Variable "${name}" not found in current scope`);
	return varInfo;
};
const getVarType = (expr: Expression): VarType =>
	expr.type === "StringLiteral" ? "i32" : "f64";

// Create a string table to manage string offsets in the WASM binary
const createStringTable = () => {
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

export const compile = (
	ast: AST,
): {
	bytes: Uint8Array;
	error: CompilerErrorType;
	meta: {
		strings: Uint8Array;
	};
} => {
	let error: CompilerErrorType = null;
	let bytes: Uint8Array = new Uint8Array(0);
	const strings = createStringTable();
	try {
		if (!ast || ast.type !== "Program") {
			throw new Error("Invalid AST: Expected a Program node");
		}
		bytes = _compile(ast, strings);
	} catch (err) {
		error = err instanceof Error ? err : new Error(String(err));
	}
	return { bytes, error, meta: { strings: strings.getBytes() } };
};

const _compile = (
	ast: AST,
	strings: ReturnType<typeof createStringTable>,
): Uint8Array => {
	// reset patches
	patches.length = 0;
	// Reset scopes for each compile
	scopes = [new Map()]; // reset to global scope
	// WASM magic + version
	const header = new Uint8Array([
		0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
	]);

	// === Type section (handles signature for print/println) ===
	const typeSection = emitSection(
		1,
		// biome-ignore format:
		new Uint8Array([
			...unsignedLEB(typeEntries.length), // number of types
            ...typeEntries.flat(), // all type entries defined at the top
		]),
	);

	// === Import section (import print/println from env) ===
	const importSection = emitSection(
		2,
		new Uint8Array([
			...unsignedLEB(importFunctions.length),
			...importFunctions.flatMap((imp) => {
				const key = getTypeKey(imp.type);
				const typeIndex = typeMap.get(key);
				if (typeIndex === undefined) {
					throw new Error(`Type not found for import "${imp.name}"`);
				}
				return [
					...encodeString("env"),
					...encodeString(imp.name),
					0x00, // kind 0x00 (function import)
					...unsignedLEB(typeIndex), // type index
				];
			}),
		]),
	);

	// === Function section  ===
	const funcSection = emitSection(
		3,
		new Uint8Array([
			// loop over the defined functions and get their type indices
			...unsignedLEB(definedFunctions.length),
			...definedFunctions.flatMap((def) => {
				const key = getTypeKey(def.type);
				const typeIndex = typeMap.get(key);
				if (typeIndex === undefined) {
					throw new Error(`Type not found for function "${def.name}"`);
				}
				return unsignedLEB(typeIndex);
			}),
		]),
	);

	// === Memory section (1 memory with min 1 page) ===
	const memorySection = emitSection(
		5, // memory section id
		// biome-ignore format:
		new Uint8Array([
			0x01, // number of memories
			0x00, // limits: min only
			0x01, // min = 1 page = 64KB
		]),
	);

	// === Export section (export "main" and "memory") ===
	const exportSection = emitSection(
		7,
		// biome-ignore format:
		new Uint8Array([
			0x02, // 2 exports

			// export "main" = function 1
			...encodeString("main"),
			0x00, // export kind: func
            // main is exported after imports (print/println)
			...unsignedLEB(functionIndices.main),

			// export "memory" = memory 0
			...encodeString("memory"),
			0x02, // export kind: memory
			0x00, // memory index 0
		]),
	);

	// === Code section ===
	const mainFunc = mainFuncBody(ast, strings);
	console.log("Main function body:", mainFunc);
	const codeSection = emitSection(
		10,
		new Uint8Array([
			...unsignedLEB(definedFunctions.length),
			...unsignedLEB(mainFunc.length), // main()
			...mainFunc,
			// todo: loop here?
			...unsignedLEB(modFunctionBody.length),
			...modFunctionBody,
			...unsignedLEB(powFunctionBody.length),
			...powFunctionBody,
		]),
	);

	// === Data section ===
	const stringBytes = strings.getBytes();
	const dataSection = emitSection(
		11,
		// biome-ignore format:
		new Uint8Array([
			0x01, // 1 data segment
			0x00, // memory index 0
			0x41, ...unsignedLEB(0), // i32.const 0 (start offset)
			0x0b, // end
			...unsignedLEB(stringBytes.length),
			...stringBytes,
		]),
	);

	return new Uint8Array([
		...header,
		...typeSection,
		...importSection,
		...funcSection,
		...memorySection,
		...exportSection,
		...codeSection,
		...dataSection,
	]);
};

export const mainFuncBody = (
	ast: AST,
	strings: ReturnType<typeof createStringTable>,
): number[] => {
	const instructions: number[] = [];

	for (const stmt of ast.body) {
		switch (stmt.type) {
			case "PrintlnStatement": {
				const { bytes, patches: p } = compileExpression(
					stmt.expression,
					strings,
				);
				instructions.push(...bytes);
				for (const patch of p ?? []) {
					patches.push({
						...patch,
						offset: instructions.length - bytes.length + patch.offset,
					});
				}
				if (isF64Expression(stmt.expression)) {
					instructions.push(0x10, functionIndices.println_64);
					break;
				}
				instructions.push(0x10, functionIndices.println);
				break;
			}
			case "PrintStatement": {
				const { bytes, patches: p } = compileExpression(
					stmt.expression,
					strings,
				);
				instructions.push(...bytes);
				for (const patch of p ?? []) {
					patches.push({
						...patch,
						offset: instructions.length - bytes.length + patch.offset,
					});
				}
				if (isF64Expression(stmt.expression)) {
					instructions.push(0x10, functionIndices.print_64);
					break;
				}
				instructions.push(0x10, functionIndices.print);
				break;
			}
			case "LocalAssignStatement":
			case "AssignStatement": {
				const { identifier, expression } = stmt;
				const isLocal = stmt.type === "LocalAssignStatement";
				const type = getVarType(expression);
				const varInfo = declareVar(identifier.name, type, isLocal);
				const { bytes } = compileExpression(expression, strings);
				if (!varInfo) {
					throw new Error(`Failed to declare variable "${identifier.name}"`);
				}
				// biome-ignore format:
				if (type === "i32") {
					instructions.push(bytes[0], bytes[1])
					instructions.push(0x21, placeholder)
					patches.push({
						name: identifier.name,
						offset: instructions.length - 1,
						type,
					});
					instructions.push(bytes[2], bytes[3])
					instructions.push(0x21, placeholder)
                    patches.push({
                        name: identifier.name,
                        offset: instructions.length - 1,
                        type,
                        slot: 1, // next slot for i32
                    });
					break;
				}
				instructions.push(...bytes, 0x21, placeholder);
				patches.push({
					name: identifier.name,
					offset: instructions.length - 1,
					type,
				});
				break;
			}
			default:
				throw new Error(`Unsupported statement type: ${stmt.type}`);
		}
	}

	// Set up locals
	const types = assignLocalIndices();
	const localDecals: number[] = [];
	for (const [type, count] of types.entries()) {
		localDecals.push(...unsignedLEB(count), typeCode(type));
	}
	console.log({ instructions, localDecals, types, patches });
	return [
		...unsignedLEB(types.size),
		...localDecals,
		...applyPatches(instructions),
		0x0b,
	];
};

const comparisonOps = new Set(["==", "~=", ">", ">=", "<", "<="]);
export const isF64Expression = (expr: Expression): boolean => {
	if (expr.type === "GroupingExpression")
		return isF64Expression(expr.expression);
	if (expr.type === "UnaryExpression") return isF64Expression(expr.argument);
	if (expr.type === "Identifier") {
		const varInfo = getVar(expr.name);
		return varInfo.type === "f64";
	}
	return ["NumberLiteral", "BooleanLiteral", "BinaryExpression"].includes(
		expr.type,
	);
};
const compileExpression = (
	expr: Expression,
	strings: ReturnType<typeof createStringTable>,
): { bytes: number[]; patches?: Patch[] } => {
	const textEncoder = new TextEncoder();
	switch (expr.type) {
		case "StringLiteral": {
			const offset = strings.getOffset(String(expr.value));
			const length = textEncoder.encode(String(expr.value)).length;
			return {
				bytes: [
					0x41,
					...signedLEB(offset), // i32.const offset
					0x41,
					...signedLEB(length), // i32.const length
				],
			};
		}
		case "NumberLiteral": {
			return {
				bytes: [
					0x44,
					...encodeF64(expr.value), // f64.const value
				],
			};
		}
		case "BooleanLiteral": {
			const value = expr.value ? 1 : 0;
			return {
				bytes: [0x44, ...encodeF64(value)],
			};
		}
		case "Identifier": {
			const { name, type } = getVar(expr.name);
			if (type === "i32") {
				return {
					bytes: [0x20, placeholder, 0x20, placeholder + 1],
					patches: [
						{ name, offset: 1, type },
						{ name, offset: 3, type, slot: 1 },
					],
				};
			}
			return {
				bytes: [0x20, placeholder],
				patches: [{ name, offset: 1, type }],
			};
		}
		case "GroupingExpression":
			return compileExpression(expr.expression, strings);
		case "BinaryExpression": {
			const left = compileExpression(expr.left, strings);
			const right = compileExpression(expr.right, strings);
			const opcode = nativeBinOps[expr.operator];
			// set the offset of the right side to the end of the left side
			const rightPatches = (right.patches ?? []).map((p) => ({
				...p,
				offset: p.offset + left.bytes.length,
			}));
			// Native operators supported for f64
			if (opcode !== null) {
				// comparing f64, f64 results in i32 so convert it back to f64
				return {
					bytes: comparisonOps.has(expr.operator)
						? [...left.bytes, ...right.bytes, opcode, 0xb7] // f64.convert_i32_u
						: [...left.bytes, ...right.bytes, opcode],
					patches: [...(left.patches ?? []), ...rightPatches],
				};
			}
			switch (expr.operator) {
				case "%":
					return {
						bytes: [...left.bytes, ...right.bytes, 0x10, functionIndices.mod],
						patches: [...(left.patches ?? []), ...rightPatches],
					};
				case "^":
					// TODO throw if exp is not an integer
					return {
						bytes: [...left.bytes, ...right.bytes, 0x10, functionIndices.pow],
						patches: [...(left.patches ?? []), ...rightPatches],
					};
				case "and":
				case "or":
					throw new Error("TODO");
				default:
					throw new Error(`Unsupported binary operator: ${expr.operator}`);
			}
		}
		case "UnaryExpression": {
			const argument = compileExpression(expr.argument, strings);
			switch (expr.operator) {
				case "+":
					return argument;
				case "-":
					return {
						bytes: [...argument.bytes, 0x9a],
						patches: argument.patches,
					};
				case "~":
					return {
						bytes: [
							...argument.bytes,
							0x44,
							...encodeF64(0), // f64.const 0
							0x61, // f64.eq (result is i32)
							0xb7, // f64.convert_i32_u (convert i32 result back to f64)
						],
						patches: argument.patches,
					};
			}
			break;
		}

		default:
			throw new Error(`Unsupported expression type: ${expr.type}`);
	}
};
