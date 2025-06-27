import type { AST } from "./parser";
import type { Expression, Statement } from "./syntax";
import {
	local,
	nativeBinOps,
	valType,
	emitSection,
	unsignedLEB,
	encodeString,
	modFunctionBody,
	powFunctionBody,
	boxNumberFunctionBody,
	boxBooleanFunctionBody,
	boxStringFunctionBody,
	isTruthyFunctionBody,
	unboxNumber,
	i32,
	f64,
	control,
	fn,
} from "./wasm";

export type CompilerErrorType = Error | null;

// Set up function signatures
const importFunctions = [
	{ name: "print", type: { params: ["i32"], results: [] } },
	{ name: "println", type: { params: ["i32"], results: [] } },
] as const;
const definedFunctions = [
	{ name: "main", type: { params: [], results: [] } },
	{ name: "mod", type: { params: ["f64", "f64"], results: ["f64"] } },
	{ name: "pow", type: { params: ["f64", "f64"], results: ["f64"] } },
	{ name: "box_number", type: { params: ["f64"], results: ["i32"] } },
	{ name: "box_bool", type: { params: ["i32"], results: ["i32"] } },
	{ name: "box_string", type: { params: ["i32", "i32"], results: ["i32"] } }, // i32 ptr, length
	{ name: "is_truthy", type: { params: ["i32"], results: ["i32"] } },
] as const;
const allFunctions = [...definedFunctions, ...importFunctions];
// We can only add a type once, so we use a map to track them
const typeMap = new Map<string, number>();
const typeEntries: number[][] = [];
const f: Record<string, number> = {};
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
		...imp.type.params.map((p) => valType(p)), // params
		...unsignedLEB(imp.type.results.length), // number of results
		...imp.type.results.map((r) => valType(r)), // results
	]);
}
importFunctions.forEach((imp, i) => {
	f[imp.name] = i;
});
definedFunctions.forEach((def, i) => {
	f[def.name] = importFunctions.length + i;
});

// Manage variables
type VarInfo = { name: string; index: number };
type Scope = Map<string, VarInfo>;
let scopes: Scope[] = [new Map()]; // global scope
const enterScope = () => scopes.push(new Map());
const exitScope = () => scopes.pop();

const findScopeForVar = (name: string): Scope => {
	// walk up scopes from the last looking for the variable
	for (let i = 1; i < scopes.length + 1; i++) {
		const scope = scopes.at(-i);
		if (scope?.has(name)) return scope;
	}
	const lastScope = scopes.at(-1);
	if (!lastScope) {
		throw new Error(`No scopes available to find variable "${name}"`);
	}
	return lastScope; // fallsback to the last scope
};
let nextLocalIndex = 0; // for local variables
const declareVar = (name: string, isLocal: boolean): VarInfo | null => {
	if (isLocal && scopes.at(-1)?.has(name)) {
		// Cant do local x := 1 twice in the same scope
		throw new Error(`Variable "${name}" already declared in current scope`);
	}
	const scope = isLocal ? scopes.at(-1) : findScopeForVar(name);
	if (!scope) throw new Error(`No scope found for variable "${name}"`);
	const index = scope.has(name) ? scope?.get(name)?.index : nextLocalIndex++;
	if (typeof index === "undefined") {
		throw new Error(`Failed to get index for variable "${name}"`);
	}
	const varInfo: VarInfo = { name, index };
	scope.set(name, varInfo);
	return varInfo;
};
const getVar = (name: string): VarInfo => {
	const varInfo = findScopeForVar(name)?.get(name);
	if (!varInfo)
		throw new Error(`Variable "${name}" not found in current scope`);
	return varInfo;
};
// For temporary variables, we use a special index
let scratchIndex: number | null = null;
const getScratchIndex = (): number => {
	if (scratchIndex === null) scratchIndex = nextLocalIndex++;
	return scratchIndex;
};
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
	// Reset scopes for each compile
	scopes = [new Map()]; // reset to global scope
	nextLocalIndex = 0; // reset local index
	scratchIndex = null; // reset scratch index

	// WASM magic + version
	const header = new Uint8Array([
		0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
	]);

	// Type section (handles signature for print/println)
	const typeSection = emitSection(
		1,
		// biome-ignore format:
		new Uint8Array([
            ...unsignedLEB(typeEntries.length), // number of types
            ...typeEntries.flat(), // all type entries defined at the top
        ]),
	);

	// Import section (import print/println from env)
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
					0x00, // function import
					...unsignedLEB(typeIndex),
				];
			}),
		]),
	);

	// Function section
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

	// Memory section (1 memory with min 1 page)
	const memorySection = emitSection(
		5, // memory section id
		new Uint8Array([
			0x01, // number of memories
			0x00, // limits: min only
			0x01, // min = 1 page = 64KB
		]),
	);

	// Export section (export "main" and "memory")
	const exportSection = emitSection(
		7,
		new Uint8Array([
			...unsignedLEB(2), // 2 exports
			// export "main" = function 1
			...encodeString("main"),
			0x00, // export kind: func
			// main is exported after imports (print/println)
			...unsignedLEB(f.main),
			// export "memory" = memory 0
			...encodeString("memory"),
			0x02, // export kind: memory
			0x00, // memory index 0
		]),
	);

	// Code section
	const mainFunc = mainFuncBody(ast, strings);
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
			...unsignedLEB(boxNumberFunctionBody.length),
			...boxNumberFunctionBody,
			...unsignedLEB(boxBooleanFunctionBody.length),
			...boxBooleanFunctionBody,
			...unsignedLEB(boxStringFunctionBody.length),
			...boxStringFunctionBody,
			...unsignedLEB(isTruthyFunctionBody.length),
			...isTruthyFunctionBody,
		]),
	);

	// Data section
	const stringBytes = strings.getBytes();
	const dataSection = emitSection(
		11,
		new Uint8Array([
			0x01, // 1 data segment
			0x00, // memory index 0
			...i32.const(0), // start offset
			...control.end(),
			...unsignedLEB(stringBytes.length),
			...stringBytes,
		]),
	);

	// This is listed out of order becasue we need to calc the heap size
	const globalSection = emitSection(
		6,
		new Uint8Array([
			0x01, // one global
			valType("i32"),
			0x01, // mutable
			...i32.const(stringBytes.length + 1), // TODO: do I need to grow this?
			...control.end(), // end of global init
		]),
	);

	return new Uint8Array([
		...header,
		...typeSection,
		...importSection,
		...funcSection,
		...memorySection,
		...globalSection,
		...exportSection,
		...codeSection,
		...dataSection,
	]);
};

export const mainFuncBody = (
	ast: AST,
	strings: ReturnType<typeof createStringTable>,
): number[] => {
	const instructions: number[] = compileStatements(ast.body, strings);

	// Since we are boxing, there's only one type of local variable (i32)
	const localDecals: number[] =
		nextLocalIndex > 0
			? [
					...unsignedLEB(1), // 1 type group
					...unsignedLEB(nextLocalIndex), // N locals
					valType("i32"), // all locals are boxed i32
				]
			: unsignedLEB(0); // no locals
	return [...localDecals, ...instructions, ...control.end()];
};

const compileStatements = (
	statements: Statement[],
	strings: ReturnType<typeof createStringTable>,
): number[] => {
	const instructions: number[] = [];
	for (const stmt of statements) {
		const bytes = compileStatement(stmt, strings);
		instructions.push(...bytes);
	}
	return instructions;
};

const compileStatement = (
	stmt: Statement,
	strings: ReturnType<typeof createStringTable>,
): number[] => {
	const instructions: number[] = [];
	switch (stmt.type) {
		case "PrintlnStatement": {
			const bytes = compileExpression(stmt.expression, strings);
			instructions.push(...bytes);
			instructions.push(...fn.call(f.println));
			break;
		}
		case "PrintStatement": {
			const bytes = compileExpression(stmt.expression, strings);
			instructions.push(...bytes);
			instructions.push(...fn.call(f.print));
			break;
		}
		case "LocalAssignStatement":
		case "AssignStatement": {
			const { identifier, expression } = stmt;
			const isLocal = stmt.type === "LocalAssignStatement";
			const varInfo = declareVar(identifier.name, isLocal);
			if (!varInfo) {
				throw new Error(`Failed to declare variable "${identifier.name}"`);
			}
			const bytes = compileExpression(expression, strings);
			instructions.push(...bytes, ...local.set(varInfo.index)); // set the variable
			break;
		}
		case "IfStatement": {
			const condition = compileExpression(stmt.condition, strings);
			enterScope();
			const thenBranch = compileStatements(stmt.thenBranch, strings);
			exitScope();
			const bytes = [
				...condition,
				...fn.call(f.is_truthy),
				...control.if(),
				...thenBranch,
			];
			let elseBlock: number[] = [];
			if (stmt.elseBranch) {
				enterScope();
				elseBlock = compileStatements(stmt.elseBranch, strings);
				exitScope();
			}
			// add elif branches in reverse, nesting them inside each other
			if (stmt.elifBranches?.length) {
				for (let i = stmt.elifBranches.length - 1; i >= 0; i--) {
					const elif = stmt.elifBranches[i];
					const condition = compileExpression(elif.condition, strings);
					enterScope();
					const elifBranch = compileStatements(elif.body, strings);
					exitScope();
					elseBlock = [
						...condition,
						...fn.call(f.is_truthy),
						...control.if(),
						...elifBranch,
						...control.else(),
						...elseBlock, // else block needs to be repositioned
						...control.end(),
					];
				}
			}
			// Add the final elseBlock to the original if
			bytes.push(...control.else(), ...elseBlock, ...control.end());
			instructions.push(...bytes);
			break;
		}
		case "WhileStatement": {
			const condition = compileExpression(stmt.condition, strings);
			enterScope();
			const body = compileStatements(stmt.body, strings);
			exitScope();
			// biome-ignore format:
			return [
				...control.block(),
                ...control.loop(),
                    ...condition,
                    ...fn.call(f.is_truthy),
                    ...i32.eqz(), // check if condition is false
                    ...control.br_if(1), // break out of outer block
                    ...body,
                    ...control.br(0), // loop back
                ...control.end(),
                ...control.end(),
			];
		}
		default:
			throw new Error(`Unsupported statement type: ${stmt.type}`);
	}
	return instructions;
};

const comparisonOps = new Set(["==", "~=", ">", ">=", "<", "<="]);
const compileExpression = (
	expr: Expression,
	strings: ReturnType<typeof createStringTable>,
): number[] => {
	const textEncoder = new TextEncoder();
	switch (expr.type) {
		case "StringLiteral": {
			const offset = strings.getOffset(String(expr.value));
			const length = textEncoder.encode(String(expr.value)).length;
			return [
				...i32.const(offset),
				...i32.const(length),
				...fn.call(f.box_string),
			];
		}
		case "NumberLiteral": {
			return [...f64.const(expr.value), ...fn.call(f.box_number)];
		}
		case "BooleanLiteral":
			return [...i32.const(expr.value ? 1 : 0), ...fn.call(f.box_bool)];
		case "Identifier": {
			const { index } = getVar(expr.name);
			// All vars are boxed i32, so just get the pointer
			return local.get(index);
		}
		case "GroupingExpression":
			return compileExpression(expr.expression, strings);
		case "BinaryExpression": {
			const left = compileExpression(expr.left, strings);
			const right = compileExpression(expr.right, strings);
			const nativeOp = nativeBinOps[expr.operator];
			// Native operators supported for f64
			if (nativeOp !== null) {
				const ops: number[] = [
					...left,
					...unboxNumber(),
					...right,
					...unboxNumber(),
					nativeOp,
				];
				// comparing f64, f64 results in i32 so convert it back to f64
				if (comparisonOps.has(expr.operator)) {
					ops.push(...fn.call(f.box_bool));
					return ops;
				}
				ops.push(...fn.call(f.box_number));
				return ops;
			}
			switch (expr.operator) {
				case "%":
					return [
						...left,
						...unboxNumber(),
						...right,
						...unboxNumber(),
						...fn.call(f.mod), // call mod -> f64
						...fn.call(f.box_number), // box the result
					];
				case "^":
					// TODO write runtime error if exp is not an integer
					return [
						...left,
						...unboxNumber(),
						...right,
						...unboxNumber(),
						...fn.call(f.pow),
						...fn.call(f.box_number),
					];
				case "and": {
					const scratch = getScratchIndex();
					// biome-ignore format:
					return [
                        ...left, // evaluate A
                        ...local.set(scratch),
                        ...local.get(scratch),
                        ...fn.call(f.is_truthy),
                        ...control.if(valType("i32")),
                            ...right, // evaluate and return B
                        ...control.else(),
                            ...local.get(scratch), // return A
                        ...control.end(),
                    ];
				}
				case "or": {
					const scratch = getScratchIndex();
					// biome-ignore format:
					return [
                        ...left, // evaluate A
                        ...local.set(scratch),
                        ...local.get(scratch),
                        ...fn.call(f.is_truthy),
                        ...control.if(valType("i32")),
                            ...local.get(scratch), //return A
                        ...control.else(),
                            ...right, // evaluate and return B
                        ...control.end(),
                    ];
				}
				default:
					throw new Error(`Unsupported binary operator: ${expr.operator}`);
			}
		}
		case "UnaryExpression":
			switch (expr.operator as string) {
				case "+":
					return compileExpression(expr.argument, strings);
				case "-": {
					if (expr.argument.type === "NumberLiteral") {
						return [
							...f64.const(-expr.argument.value), // note the "-"
							...fn.call(f.box_number),
						];
					}
					return [
						...compileExpression(expr.argument, strings),
						...unboxNumber(),
						...f64.neg(), // negate the value
						...fn.call(f.box_number),
					];
				}
				case "~":
					return [
						...compileExpression(expr.argument, strings),
						...unboxNumber(),
						...f64.const(0),
						...f64.eq(), // result is i32 here
						...fn.call(f.box_bool),
					];
				default:
					throw new Error(`Unsupported unary operator: ${expr.operator}`);
			}
		default:
			throw new Error(`Unsupported expression type: ${expr.type}`);
	}
};
