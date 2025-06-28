import {
	definedFunctions,
	func,
	functionBodies,
	functionTypeMap,
	functionTypes,
	getFunctionTypeKey,
	importFunctions,
} from "./compiler/imports";
import type { AST } from "./parser";
import {
	clearScopes,
	createStringTable,
	declareVar,
	enterScope,
	exitScope,
	getLocalDecls,
	getScratchIndex,
	getVar,
	resetLocalIndex,
	resetScratchIndex,
} from "./compiler/state";
import type { Expression, Statement } from "./syntax";
import {
	local,
	nativeBinOps,
	valType,
	emitSection,
	unsignedLEB,
	encodeString,
	i32,
	f64,
	control,
	fn,
} from "./compiler/wasm";

export type CompilerErrorType = Error | null;

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
	// Reset state for each compilation
	clearScopes();
	resetLocalIndex();
	resetScratchIndex();

	// WASM magic + version
	const header = new Uint8Array([
		0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
	]);

	// Type section (handles signature for print/println)
	const typeSection = emitSection(
		1,
		// biome-ignore format:
		new Uint8Array([
            ...unsignedLEB(functionTypes.length), // number of types
            ...functionTypes.flat(), // all type entries defined at the top
        ]),
	);

	// Import section (import print/println from env)
	const importSection = emitSection(
		2,
		new Uint8Array([
			...unsignedLEB(importFunctions.length),
			...importFunctions.flatMap((imp) => {
				const key = getFunctionTypeKey(imp.type);
				const typeIndex = functionTypeMap.get(key);
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
				const key = getFunctionTypeKey(def.type);
				const typeIndex = functionTypeMap.get(key);
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
			...unsignedLEB(func.main),
			// export "memory" = memory 0
			...encodeString("memory"),
			0x02, // export kind: memory
			0x00, // memory index 0
		]),
	);

	// Code section
	const mainFunc = mainFuncBody(ast, strings);
	functionBodies.main = mainFunc;
	const codeSection = emitSection(
		10,
		new Uint8Array([
			...unsignedLEB(definedFunctions.length),
			...definedFunctions.flatMap((def) => {
				const body = functionBodies[def.name];
				if (!body) throw new Error(`Function body for "${def.name}" not found`);
				return [...unsignedLEB(body.length), ...body];
			}),
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
	return [...getLocalDecls(), ...instructions, ...control.end()];
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
			instructions.push(...fn.call(func.println));
			break;
		}
		case "PrintStatement": {
			const bytes = compileExpression(stmt.expression, strings);
			instructions.push(...bytes);
			instructions.push(...fn.call(func.print));
			break;
		}
		case "LocalAssignStatement":
		case "AssignStatement": {
			const { identifier, expression } = stmt;
			const isLocal = stmt.type === "LocalAssignStatement";
			const bytes = compileExpression(expression, strings);
			const varInfo = declareVar(identifier.name, isLocal);
			if (!varInfo) {
				throw new Error(`Failed to declare variable "${identifier.name}"`);
			}
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
				...fn.call(func.is_truthy),
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
						...fn.call(func.is_truthy),
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
			enterScope();
			const condition = compileExpression(stmt.condition, strings);
			enterScope();
			const body = compileStatements(stmt.body, strings);
			exitScope();
			exitScope();
			// biome-ignore format:
			return [
				...control.block(),
                ...control.loop(),
                    ...condition,
                    ...fn.call(func.is_truthy),
                    ...i32.eqz(), // check if condition is false
                    ...control.br_if(1), // break out of outer block
                    ...body,
                    ...control.br(0), // loop back
                ...control.end(),
                ...control.end(),
			];
		}
		case "ForStatement": {
			const { assignment, condition, increment, body } = stmt;
			enterScope();
			const init = compileStatement(assignment, strings);
			const { index: loopVarIndex } = getVar(assignment.identifier.name);
			enterScope(); // inner scope for the loop body
			const cond = compileExpression(condition, strings);
			const step = increment
				? compileExpression(increment, strings)
				: [...f64.const(1), ...fn.call(func.box_number)]; // default increment is 1
			const loopBody = compileStatements(body, strings);
			exitScope(); // exit inner
			exitScope();
			const isDescending = getScratchIndex();
			// biome-ignore format:
			return [
                ...init, // e.g. i := 0
                ...step,
                ...fn.call(func.unbox_number),
                ...f64.const(0),
                ...f64.lt(), // step < 0 ?
                ...local.set(isDescending),

                ...control.block(),
                ...control.loop(),
                    ...local.get(isDescending),
                    ...control.if(valType("i32")), // descending case
                        ...local.get(loopVarIndex),
                        ...fn.call(func.unbox_number),
                        ...cond,
                        ...fn.call(func.unbox_number),
                        ...f64.lt(), // i < cond ? 1 : 0
                    ...control.else(), // ascending case
                        ...local.get(loopVarIndex),
                        ...fn.call(func.unbox_number),
                        ...cond,
                        ...fn.call(func.unbox_number),
                        ...f64.gt(), // i > cond ? 1 : 0
                    ...control.end(),
                    ...control.br_if(1), // exit if 1

                    ...loopBody,

                    // increment the loop variable
                    ...local.get(loopVarIndex),
                    ...fn.call(func.unbox_number),
                    ...step,
                    ...fn.call(func.unbox_number),
                    ...f64.add(),
                    ...fn.call(func.box_number),
                    ...local.set(loopVarIndex),

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
				...fn.call(func.box_string),
			];
		}
		case "NumberLiteral": {
			return [...f64.const(expr.value), ...fn.call(func.box_number)];
		}
		case "BooleanLiteral":
			return [...i32.const(expr.value ? 1 : 0), ...fn.call(func.box_bool)];
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
					...fn.call(func.unbox_number),
					...right,
					...fn.call(func.unbox_number),
					nativeOp,
				];
				// comparing f64, f64 results in i32 so convert it back to f64
				if (comparisonOps.has(expr.operator)) {
					ops.push(...fn.call(func.box_bool));
					return ops;
				}
				ops.push(...fn.call(func.box_number));
				return ops;
			}
			switch (expr.operator) {
				case "%":
					return [
						...left,
						...fn.call(func.unbox_number),
						...right,
						...fn.call(func.unbox_number),
						...fn.call(func.mod), // call mod -> f64
						...fn.call(func.box_number), // box the result
					];
				case "^":
					// TODO write runtime error if exp is not an integer
					return [
						...left,
						...fn.call(func.unbox_number),
						...right,
						...fn.call(func.unbox_number),
						...fn.call(func.pow),
						...fn.call(func.box_number),
					];
				case "and": {
					const scratch = getScratchIndex();
					// biome-ignore format:
					return [
                        ...left, // evaluate A
                        ...local.set(scratch),
                        ...local.get(scratch),
                        ...fn.call(func.is_truthy),
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
                        ...fn.call(func.is_truthy),
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
							...fn.call(func.box_number),
						];
					}
					return [
						...compileExpression(expr.argument, strings),
						...fn.call(func.unbox_number),
						...f64.neg(),
						...fn.call(func.box_number),
					];
				}
				case "~":
					return [
						...compileExpression(expr.argument, strings),
						...fn.call(func.unbox_number),
						...f64.const(0),
						...f64.eq(), // result is i32 here
						...fn.call(func.box_bool),
					];
				default:
					throw new Error(`Unsupported unary operator: ${expr.operator}`);
			}
		default:
			throw new Error(`Unsupported expression type: ${expr.type}`);
	}
};
