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
// Used for passing around types and not worrying about location info
const dummyLoc = {
	start: { line: 0, column: 0 },
	end: { line: 0, column: 0 },
};

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
			case "PrintlnStatement":
				instructions.push(...compileForPrint(stmt.expression, strings));
				if (isF64Expression(stmt.expression)) {
					instructions.push(0x10, functionIndices.println_64);
					break;
				}
				instructions.push(0x10, functionIndices.println);
				break;

			case "PrintStatement":
				instructions.push(...compileForPrint(stmt.expression, strings));
				if (isF64Expression(stmt.expression)) {
					instructions.push(0x10, functionIndices.print_64);
					break;
				}
				instructions.push(0x10, functionIndices.print);
				break;

			case "ExpressionStatement":
				console.log({ stmt });
				break;
			default:
				throw new Error(`Unsupported statement type: ${stmt.type}`);
		}
	}

	return [
		...unsignedLEB(0), // no local variables
		...instructions,
		0x0b,
	];
};

const comparisonOps = new Set(["==", "~=", ">", ">=", "<", "<="]);
export const isF64Expression = (expr: Expression): boolean => {
	if (expr.type === "GroupingExpression")
		return isF64Expression(expr.expression);
	if (expr.type === "UnaryExpression") return isF64Expression(expr.argument);
	return ["NumberLiteral", "BinaryExpression"].includes(expr.type);
};

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
				0x41,
				...signedLEB(offset), // i32.const offset
				0x41,
				...signedLEB(length), // i32.const length
			];
		}
		case "NumberLiteral": {
			return [
				0x44,
				...encodeF64(expr.value), // f64.const value
			];
		}
		case "BooleanLiteral":
			return [
				0x41,
				...signedLEB(expr.value ? 1 : 0), // treat as i32 for now
			];
		case "GroupingExpression":
			return compileExpression(expr.expression, strings);
		case "BinaryExpression": {
			const left = compileExpression(expr.left, strings);
			const right = compileExpression(expr.right, strings);
			const opcode = nativeBinOps[expr.operator];
			// Native operators supported for f64
			if (opcode !== null) {
				// comparing f64, f64 results in i32 so convert it back to f64
				return comparisonOps.has(expr.operator)
					? [...left, ...right, opcode, 0xb7] // f64.convert_i32_u
					: [...left, ...right, opcode];
			}
			switch (expr.operator) {
				case "%":
					return [...left, ...right, 0x10, functionIndices.mod];
				case "^":
					// TODO throw if exp is not an integer
					return [...left, ...right, 0x10, functionIndices.pow];
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
					return [...argument, 0x9a]; // f64.neg
				case "~":
					return [
						...argument,
						0x44,
						...encodeF64(0), // f64.const 0
						0x61, // f64.eq (result is i32)
						0xb7, // f64.convert_i32_u (convert i32 result back to f64)
					];
			}
			break;
		}

		default:
			throw new Error(`Unsupported expression type: ${expr.type}`);
	}
};

const compileForPrint = (
	expr: Expression,
	strings: ReturnType<typeof createStringTable>,
): number[] => {
	if (expr.type === "BooleanLiteral") {
		const str = expr.value ? "true" : "false";
		return compileExpression(
			{ type: "StringLiteral", value: str, loc: dummyLoc },
			strings,
		);
	}
	return compileExpression(expr, strings);
};
