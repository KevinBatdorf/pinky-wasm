import type { AST } from "./parser";
import type { Expression } from "./syntax";
import {
	emitSection,
	unsignedLEB,
	encodeString,
	encodeF64,
	typeCode,
	nativeBinOps,
	modFunctionBody,
	powFunctionBody,
	boxNumberFunctionBody,
	boxBooleanFunctionBody,
	boxStringFunctionBody,
	isTruthyFunctionBody,
	unboxNumber,
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
type VarInfo = { name: string; index: number };
type Scope = Map<string, VarInfo>;
let scopes: Scope[] = [new Map()]; // global scope
// const enterScope = () => scopes.push(new Map());
// const exitScope = () => scopes.pop();

const findScopeForVar = (name: string): Scope | null =>
	scopes
		.slice()
		.reverse()
		.find((scope) => scope.has(name)) ?? scopes[0]; // global scope fallback
let nextLocalIndex = 0; // for local variables
const declareVar = (name: string, isLocal: boolean): VarInfo | null => {
	const scope = isLocal ? scopes[scopes.length - 1] : findScopeForVar(name);
	if (!scope) throw new Error(`No scope found for variable "${name}"`);
	if (scope.has(name))
		throw new Error(`Variable "${name}" already declared in this scope`);
	const varInfo: VarInfo = { name, index: nextLocalIndex++ };
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
const getScratchIndex = (() => {
	let index: number | null = null;
	return () => {
		if (index === null) index = nextLocalIndex++;
		return index;
	};
})();

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
					0x00, // kind 0x00 (function import)
					...unsignedLEB(typeIndex), // type index
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
		// biome-ignore format:
		new Uint8Array([
            0x01, // number of memories
            0x00, // limits: min only
            0x01, // min = 1 page = 64KB
        ]),
	);

	// Export section (export "main" and "memory")
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

	// Code section
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

	// This is listed out of order becasue we need to calc the heap size
	// global heap pointer, mutable i32, init to 1024
	const globalSection = emitSection(
		6,
		// biome-ignore format:
		new Uint8Array([
            0x01, // one global
            typeCode("i32"),
            0x01,  // mutable
            0x41, ...unsignedLEB(stringBytes.length + 1),
            0x0b, // end
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
	const instructions: number[] = [];

	for (const stmt of ast.body) {
		switch (stmt.type) {
			case "PrintlnStatement": {
				const bytes = compileExpression(stmt.expression, strings);
				instructions.push(...bytes);
				instructions.push(0x10, functionIndices.println);
				break;
			}
			case "PrintStatement": {
				const bytes = compileExpression(stmt.expression, strings);
				instructions.push(...bytes);
				instructions.push(0x10, functionIndices.print);
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
				instructions.push(...bytes, 0x21, ...unsignedLEB(varInfo.index)); // i32.store
				break;
			}
			default:
				throw new Error(`Unsupported statement type: ${stmt.type}`);
		}
	}

	// Since we are boxing, there's only one type of local variable (i32)
	const localDecals: number[] =
		nextLocalIndex > 0
			? [
					...unsignedLEB(1), // 1 type group
					...unsignedLEB(nextLocalIndex), // N locals
					0x7f, // i32
				]
			: [0x00]; // no locals
	return [...localDecals, ...instructions, 0x0b];
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
			// biome-ignore format:
			return [
                0x41, ...unsignedLEB(offset), // i32.const offset
                0x41, ...unsignedLEB(length), // i32.const length
                0x10, functionIndices.box_string, // call box_string → i32 ptr
            ]
		}
		case "NumberLiteral": {
			// biome-ignore format:
			return [
                0x44, ...encodeF64(expr.value), // f64.const value
                0x10, functionIndices.box_number, // call box_number → i32 ptr
            ]
		}
		case "BooleanLiteral":
			// biome-ignore format:
			return [
                0x41, expr.value ? 1 : 0, // i32.const value (0 or 1)
                0x10, functionIndices.box_bool, // call box_bool → i32 ptr
            ]
		case "Identifier": {
			const { index } = getVar(expr.name);
			// All vars are boxed i32, so just local.get the pointer
			return [0x20, ...unsignedLEB(index)]; // local.get index
		}
		case "GroupingExpression":
			return compileExpression(expr.expression, strings);
		case "BinaryExpression": {
			const left = compileExpression(expr.left, strings);
			const right = compileExpression(expr.right, strings);
			const nativeOp = nativeBinOps[expr.operator];
			// Native operators supported for f64
			if (nativeOp !== null) {
				// biome-ignore format:
				const ops: number[] = [
                    ...left, ...unboxNumber(),
                    ...right, ...unboxNumber(),
                    nativeOp,
                ];
				// comparing f64, f64 results in i32 so convert it back to f64
				if (comparisonOps.has(expr.operator)) {
					ops.push(0x10, functionIndices.box_bool); // call box_bool → i32 ptr
					return ops;
				}
				ops.push(0x10, functionIndices.box_number); // call box_number → i32 ptr
				return ops;
			}
			switch (expr.operator) {
				case "%":
					// biome-ignore format:
					return [
                        ...left, ...unboxNumber(),
                        ...right, ...unboxNumber(),
                        0x10, functionIndices.mod, // call mod → f64
                        0x10, functionIndices.box_number, // call box_number → i32 ptr
                    ]
				case "^":
					// TODO write runtime error if exp is not an integer
					// biome-ignore format:
					return [
                        ...left, ...unboxNumber(),
                        ...right, ...unboxNumber(),
                        0x10, functionIndices.pow,
                        0x10, functionIndices.box_number,
                    ];
				case "and": {
					const scratch = getScratchIndex();
					// biome-ignore format:
					return [
                        ...left,                           // evaluate A
                        0x21, ...unsignedLEB(scratch),     // local.set scratch
                        0x20, ...unsignedLEB(scratch),     // local.get scratch
                        0x10, functionIndices.is_truthy,   // call is_truthy
                        0x04, 0x7f,                        // if (result i32)
                            ...right,                      // else: evaluate and return B
                        0x05,                              // else
                            0x20, ...unsignedLEB(scratch), // then: return A (scratch)
                        0x0b,                              // end
                    ];
				}
				case "or": {
					const scratch = getScratchIndex();
					// biome-ignore format:
					return [
                        ...left,                           // evaluate A
                        0x21, ...unsignedLEB(scratch),     // local.set scratch
                        0x20, ...unsignedLEB(scratch),     // local.get scratch
                        0x10, functionIndices.is_truthy,   // call is_truthy
                        0x04, 0x7f,                        // if (result i32)
                            0x20, ...unsignedLEB(scratch), // then: return A (scratch)
                        0x05,                              // else
                            ...right,                      // else: evaluate and return B
                        0x0b,                              // end
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
						// If it's a number literal, negate the value
						// biome-ignore format:
						return [
                            0x44, ...encodeF64(-expr.argument.value), // f64.const -value
                            0x10, functionIndices.box_number, // call box_number → i32 ptr
                        ];
					}
					// biome-ignore format:
					return [
						...compileExpression(expr.argument, strings),
                        ...unboxNumber(),
						0x9a, // f64.neg (negate the f64 value)
						0x10, functionIndices.box_number, // call box_number → i32 ptr
					];
				}
				case "~":
					// biome-ignore format:
					return [
						...compileExpression(expr.argument, strings),
                        ...unboxNumber(),
						0x44, ...encodeF64(0), // f64.const 0
						0x61, // f64.eq (result is i32)
						0x10, functionIndices.box_bool, // call box_bool → i32 ptr
					];
				default:
					throw new Error(`Unsupported unary operator: ${expr.operator}`);
			}
		default:
			throw new Error(`Unsupported expression type: ${expr.type}`);
	}
};
