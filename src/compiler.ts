import type { AST } from "./parser";
import type { Expression } from "./syntax";
import { emitSection, unsignedLEB, signedLEB, encodeString } from "./wasm";

export type CompilerErrorType = Error | null;

const imports = ["print", "println"];
const functionIndices = Object.fromEntries(imports.map((name, i) => [name, i]));

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

	// === Type section (only handles signature for print/println) ===
	// TODO: imports are simple now but we could dynamically check import type
	// and register them here later on
	const typeSection = emitSection(
		1,
		// biome-ignore format:
		new Uint8Array([
			0x02, // 2 types defined here
            // 0: main()
            0x60, // indicates this is a function type
            0x00, // no params
            0x00, // no return
            // 1: print/println(pointer: i32, stringOffset: i32)
			0x60,
			0x02, // 2 parameters
			0x7f, 0x7f, // i32, i32
			0x00, // no return
		]),
	);

	// === Import section (import print/println from env) ===
	// TODO: these both point to the same type def, which is fine since
	// our signatures are the same and only 2 imports
	const importSection = emitSection(
		2,
		new Uint8Array([
			...unsignedLEB(imports.length),
			...imports.flatMap((name) => [
				...encodeString("env"),
				...encodeString(name),
				0x00, // kind 0x00 (function import)
				0x01, // type index 1 (i32, i32) -> void
			]),
		]),
	);

	// === Function section (1 function, pointing to type index 0) ===
	const funcSection = emitSection(
		3,
		new Uint8Array([
			0x01, // 1 function
			0x00, // type index 0
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

	// === Export section (export "main") ===
	const exportSection = emitSection(
		7,
		// biome-ignore format:
		new Uint8Array([
			0x02, // 2 exports

			// export "main" = function 1
			...encodeString("main"),
			0x00, // export kind: func
            // main is exported after imports (print/println)
			...unsignedLEB(imports.length),

			// export "memory" = memory 0
			...encodeString("memory"),
			0x02, // export kind: memory
			0x00, // memory index 0
		]),
	);

	// === Code section ===
	const funcBody = generateBody(ast, strings);
	const codeSection = emitSection(
		10,
		// biome-ignore format:
		new Uint8Array([
            0x01, // 1 function main()
            ...unsignedLEB(funcBody.length),
            ...funcBody
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

export const generateBody = (
	ast: AST,
	strings: ReturnType<typeof createStringTable>,
): number[] => {
	const body: number[] = [0x00]; // locals count (currently 0)

	for (const stmt of ast.body) {
		switch (stmt.type) {
			case "PrintlnStatement": {
				body.push(...compileExpression(stmt.expression, strings));
				body.push(0x10, functionIndices.println);
				break;
			}
			case "PrintStatement": {
				body.push(...compileExpression(stmt.expression, strings));
				body.push(0x10, functionIndices.print);
				break;
			}
			default:
				throw new Error(`Unsupported statement type: ${stmt.type}`);
		}
	}

	body.push(0x0b); // end
	return body;
};

const compileExpression = (
	expr: Expression,
	strings: ReturnType<typeof createStringTable>,
): number[] => {
	const textEncoder = new TextEncoder();
	switch (expr.type) {
		case "StringLiteral": {
			const offset = strings.getOffset(expr.value);
			const length = textEncoder.encode(expr.value).length;

			return [
				0x41,
				...signedLEB(offset), // i32.const offset
				0x41,
				...signedLEB(length), // i32.const length
			];
		}
		default:
			throw new Error(`Unsupported expression type: ${expr.type}`);
	}
};
