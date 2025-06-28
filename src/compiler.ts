import {
	addFunctionBody,
	addUserDefinedFunction,
	clearUserDefinedFunctions,
	definedFunctions,
	func,
	functionBodies,
	getFunctionTypeKey,
	getFunctionTypes,
	hasReturn,
	importFunctions,
	resetFunctionBodies,
	userDefinedFunctions,
} from "./compiler/functions";
import type { AST } from "./parser";
import {
	clearScopes,
	createStringTable,
	declareVar,
	enterScope,
	exitScope,
	getLocalDecls,
	getLocalVarsIndex,
	getScratchIndex,
	getVar,
	setLocalVarsIndex,
	setScratchIndex,
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
	block,
	loop,
	if_,
} from "./compiler/wasm";

class CompilerError extends Error {
	line: number;
	column: number;
	tokenLength: number;
	constructor(
		message: string,
		line: number,
		column: number,
		tokenLength: number,
	) {
		super(message);
		this.name = "CompilerError";
		this.line = line;
		this.column = column;
		this.tokenLength = tokenLength;
	}
}
export type CompilerErrorType = null | CompilerError;

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
		if (err instanceof CompilerError) {
			error = err;
		} else {
			console.error("Compilation error:", err);
		}
	}
	return { bytes, error, meta: { strings: strings.getBytes() } };
};

const _compile = (
	ast: AST,
	strings: ReturnType<typeof createStringTable>,
): Uint8Array => {
	// Reset state for each compilation
	clearScopes();
	setLocalVarsIndex(0);
	setScratchIndex(null);
	clearUserDefinedFunctions();
	resetFunctionBodies();

	// WASM magic + version
	const header = new Uint8Array([
		0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
	]);

	// Function section
	const mainFunc = mainFuncBody(ast, strings); // compiles
	addFunctionBody("main", mainFunc);
	const { functionTypes, functionIndices } = getFunctionTypes();
	console.log("Function types:", functionTypes, functionIndices, func());
	const funcSection = emitSection(
		3,
		new Uint8Array([
			// loop over the defined functions and get their type indices
			...unsignedLEB(definedFunctions.length + userDefinedFunctions.length),
			...definedFunctions.flatMap((def) => {
				const key = getFunctionTypeKey(def.type);
				const typeIndex = functionIndices.get(key);
				if (typeIndex === undefined) {
					throw new Error(`Type not found for function "${def.name}"`);
				}
				return unsignedLEB(typeIndex);
			}),
			...userDefinedFunctions.flatMap((func) => {
				const key = getFunctionTypeKey(func.type);
				const typeIndex = functionIndices.get(key);
				if (typeIndex === undefined) {
					throw new Error(
						`Type not found for user-defined function "${func.name}"`,
					);
				}
				return unsignedLEB(typeIndex);
			}),
		]),
	);

	// Type section for all functions
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
				const typeIndex = functionIndices.get(key);
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
			...unsignedLEB(func().main),
			// export "memory" = memory 0
			...encodeString("memory"),
			0x02, // export kind: memory
			0x00, // memory index 0
		]),
	);

	// Code section
	const codeSection = emitSection(
		10,
		new Uint8Array([
			...unsignedLEB(Object.keys(functionBodies).length),
			...definedFunctions.flatMap((def) => {
				const body = functionBodies[def.name];
				if (!body) throw new Error(`Function body for "${def.name}" not found`);
				return [...unsignedLEB(body.length), ...body];
			}),
			...userDefinedFunctions.flatMap((func) => {
				const body = functionBodies[func.name];
				if (!body) {
					throw new Error(`Function body for "${func.name}" not found`);
				}
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

	// Keep at the end to set heap ptr from string length
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
	switch (stmt.type) {
		case "PrintlnStatement": {
			const bytes = compileExpression(stmt.expression, strings);
			return [...bytes, ...fn.call(func().println)];
		}
		case "PrintStatement": {
			const bytes = compileExpression(stmt.expression, strings);
			return [...bytes, ...fn.call(func().print)];
		}
		case "LocalAssignStatement":
		case "AssignStatement": {
			const { identifier, expression } = stmt;
			const isLocal = stmt.type === "LocalAssignStatement";
			const bytes = compileExpression(expression, strings);
			const varInfo = declareVar(identifier.name, isLocal);
			if (!varInfo) {
				throw new CompilerError(
					`Variable "${identifier.name}" is not declared`,
					identifier.loc.start.line,
					identifier.loc.start.column,
					identifier.name.length,
				);
			}
			return [...bytes, ...local.set(varInfo.index)]; // set the variable
		}
		case "IfStatement": {
			const condition = compileExpression(stmt.condition, strings);
			enterScope();
			const thenBranch = compileStatements(stmt.thenBranch, strings);
			exitScope();
			const bytes = [
				...condition,
				...fn.call(func().is_truthy),
				...if_.start(),
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
						...fn.call(func().is_truthy),
						...if_.start(),
						...elifBranch,
						...if_.else(),
						...elseBlock, // else block needs to be repositioned
						...if_.end(),
					];
				}
			}
			// Add the final elseBlock to the original if
			return [...bytes, ...if_.else(), ...elseBlock, ...if_.end()];
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
				...block.start(),
                ...loop.start(),
                    ...condition,
                    ...fn.call(func().is_truthy),
                    ...i32.eqz(), // check if condition is false
                    ...loop.br_if(1), // break out of outer block
                    ...body,
                    ...loop.br(0), // loop back
                ...loop.end(),
                ...block.end(),
			];
		}
		case "ForStatement": {
			const { assignment, condition, increment, body } = stmt;
			enterScope();
			const init = compileStatement(assignment, strings);
			const loopVar = getVar(assignment.identifier.name);
			if (!loopVar) {
				throw new CompilerError(
					`Variable "${assignment.identifier.name}" is not declared`,
					assignment.identifier.loc.start.line,
					assignment.identifier.loc.start.column,
					assignment.identifier.name.length,
				);
			}
			enterScope(); // inner scope for the loop body
			const cond = compileExpression(condition, strings);
			const step = increment
				? compileExpression(increment, strings)
				: [...f64.const(1), ...fn.call(func().box_number)]; // default increment is 1
			const loopBody = compileStatements(body, strings);
			exitScope(); // exit inner
			exitScope();
			const isDescending = getScratchIndex();
			// biome-ignore format:
			return [
                ...init, // e.g. i := 0
                ...step,
                ...fn.call(func().unbox_number),
                ...f64.const(0),
                ...f64.lt(), // step < 0 ?
                ...local.set(isDescending),

                ...block.start(),
                ...loop.start(),
                    ...local.get(isDescending),
                    ...if_.start(valType("i32")), // descending case
                        ...local.get(loopVar.index),
                        ...fn.call(func().unbox_number),
                        ...cond,
                        ...fn.call(func().unbox_number),
                        ...f64.lt(), // i < cond ? 1 : 0
                    ...if_.else(), // ascending case
                        ...local.get(loopVar.index),
                        ...fn.call(func().unbox_number),
                        ...cond,
                        ...fn.call(func().unbox_number),
                        ...f64.gt(), // i > cond ? 1 : 0
                    ...if_.end(),
                    ...loop.br_if(1), // exit if 1

                    ...loopBody,

                    // increment the loop variable
                    ...local.get(loopVar.index),
                    ...fn.call(func().unbox_number),
                    ...step,
                    ...fn.call(func().unbox_number),
                    ...f64.add(),
                    ...fn.call(func().box_number),
                    ...local.set(loopVar.index),

                    ...loop.br(0), // loop back
                ...loop.end(),
                ...block.end(),
            ];
		}
		case "FunctionDeclStatement": {
			const { name, params, body } = stmt;
			if (userDefinedFunctions.some((f) => f.name === name.name)) {
				throw new CompilerError(
					`Function "${name.name}" is already defined`,
					name.loc.start.line,
					name.loc.start.column,
					name.name.length,
				);
			}
			const paramTypes = params.map(() => valType("i32")); // boxed i32
			const returnType = hasReturn(body) ? [valType("i32")] : [];
			addUserDefinedFunction(name.name, paramTypes, returnType);
			const prevIndex = getLocalVarsIndex();
			setLocalVarsIndex(0); // temp set to collect fn params
			enterScope();
			for (const param of params) declareVar(param.name, true);
			const bodyBytes = compileStatements(body, strings);
			exitScope();
			const localDecls = getLocalDecls();
			setLocalVarsIndex(prevIndex); // restore local vars index
			addFunctionBody(name.name, [
				...localDecls,
				...bodyBytes,
				...control.end(),
			]);
			return [];
		}
		case "ReturnStatement": {
			return [
				...compileExpression(stmt.expression, strings),
				...fn.call(func().ret),
			];
		}
		case "ExpressionStatement": {
			return compileExpression(stmt.expression, strings);
		}
		default:
			throw new Error("Something went wrong");
	}
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
				...fn.call(func().box_string),
			];
		}
		case "NumberLiteral": {
			return [...f64.const(expr.value), ...fn.call(func().box_number)];
		}
		case "BooleanLiteral":
			return [...i32.const(expr.value ? 1 : 0), ...fn.call(func().box_bool)];
		case "Identifier": {
			const variable = getVar(expr.name);
			if (!variable) {
				throw new CompilerError(
					`Variable "${expr.name}" is not declared`,
					expr.loc.start.line,
					expr.loc.start.column,
					expr.name.length,
				);
			}
			// All vars are boxed i32, so just get the pointer
			return local.get(variable.index);
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
					...fn.call(func().unbox_number),
					...right,
					...fn.call(func().unbox_number),
					nativeOp,
				];
				// comparing f64, f64 results in i32 so convert it back to f64
				if (comparisonOps.has(expr.operator)) {
					ops.push(...fn.call(func().box_bool));
					return ops;
				}
				ops.push(...fn.call(func().box_number));
				return ops;
			}
			switch (expr.operator) {
				case "%":
					return [
						...left,
						...fn.call(func().unbox_number),
						...right,
						...fn.call(func().unbox_number),
						...fn.call(func().mod), // call mod -> f64
						...fn.call(func().box_number), // box the result
					];
				case "^":
					// TODO write runtime error if exp is not an integer
					return [
						...left,
						...fn.call(func().unbox_number),
						...right,
						...fn.call(func().unbox_number),
						...fn.call(func().pow),
						...fn.call(func().box_number),
					];
				case "and": {
					const scratch = getScratchIndex();
					// biome-ignore format:
					return [
                        ...left, // evaluate A
                        ...local.set(scratch),
                        ...local.get(scratch),
                        ...fn.call(func().is_truthy),
                        ...if_.start(valType("i32")),
                            ...right, // evaluate and return B
                        ...if_.else(),
                            ...local.get(scratch), // return A
                        ...if_.end(),
                    ];
				}
				case "or": {
					const scratch = getScratchIndex();
					// biome-ignore format:
					return [
                        ...left, // evaluate A
                        ...local.set(scratch),
                        ...local.get(scratch),
                        ...fn.call(func().is_truthy),
                        ...if_.start(valType("i32")),
                            ...local.get(scratch), //return A
                        ...if_.else(),
                            ...right, // evaluate and return B
                        ...if_.end(),
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
							...fn.call(func().box_number),
						];
					}
					return [
						...compileExpression(expr.argument, strings),
						...fn.call(func().unbox_number),
						...f64.neg(),
						...fn.call(func().box_number),
					];
				}
				case "~":
					return [
						...compileExpression(expr.argument, strings),
						...fn.call(func().unbox_number),
						...f64.const(0),
						...f64.eq(), // result is i32 here
						...fn.call(func().box_bool),
					];
				default:
					throw new Error(`Unsupported unary operator: ${expr.operator}`);
			}
		case "FunctionCallExpression": {
			const { name, args } = expr;
			const f = userDefinedFunctions.find((fn) => fn.name === name.name);
			if (!f) {
				throw new CompilerError(
					`Function "${name.name}" is not defined`,
					name.loc.start.line,
					name.loc.start.column,
					name.name.length,
				);
			}
			if (f.type.params.length !== args.length) {
				throw new CompilerError(
					`Function "${name.name}" expects ${f.type.params.length} arguments, but got ${args.length}`,
					name.loc.start.line,
					name.loc.start.column,
					name.name.length,
				);
			}
			return [
				...args.flatMap((arg) => compileExpression(arg, strings)),
				...fn.call(func()[name.name]),
			];
		}
		default:
			throw new Error("Something went wrong");
	}
};
