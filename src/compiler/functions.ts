import type { Statement } from "../syntax";
import {
	boxBooleanFunctionBody,
	boxNilFunctionBody,
	boxNumberFunctionBody,
	boxStringFunctionBody,
	isTruthyFunctionBody,
	modFunctionBody,
	powFunctionBody,
	unboxNumberFunctionBody,
	unsignedLEB,
	valType,
} from "./wasm";

// Set up function signatures
type FunctionType = {
	name: string;
	type: {
		params: readonly ReturnType<typeof valType>[];
		results: readonly ReturnType<typeof valType>[];
	};
};
const i32 = valType("i32");
const f64 = valType("f64");
export const importFunctions = [
	{ name: "print", type: { params: [i32], results: [] } },
	{ name: "println", type: { params: [i32], results: [] } },
] as const;
export const definedFunctions: FunctionType[] = [
	{ name: "main", type: { params: [], results: [] } },
	{ name: "mod", type: { params: [f64, f64], results: [f64] } },
	{ name: "pow", type: { params: [f64, f64], results: [f64] } },
	{ name: "box_number", type: { params: [f64], results: [i32] } },
	{ name: "unbox_number", type: { params: [i32], results: [f64] } },
	{ name: "box_bool", type: { params: [i32], results: [i32] } },
	{ name: "box_string", type: { params: [i32, i32], results: [i32] } },
	{ name: "is_truthy", type: { params: [i32], results: [i32] } },
	{ name: "box_nil", type: { params: [], results: [i32] } },
] as const;
export const userDefinedFunctions: FunctionType[] = [];
export const addUserDefinedFunction = (
	name: string,
	params: readonly ReturnType<typeof valType>[],
	results: readonly ReturnType<typeof valType>[],
): void => {
	if (userDefinedFunctions.some((f) => f.name === name)) {
		throw new Error(`Function "${name}" is already defined`);
	}
	userDefinedFunctions.push({ name, type: { params, results } });
};
export const clearUserDefinedFunctions = (): void => {
	userDefinedFunctions.length = 0;
};
const builtInFuncBodies: Record<string, number[]> = {
	main: [], // main is defined later
	mod: modFunctionBody,
	pow: powFunctionBody,
	box_number: boxNumberFunctionBody,
	unbox_number: unboxNumberFunctionBody,
	box_bool: boxBooleanFunctionBody,
	box_string: boxStringFunctionBody,
	is_truthy: isTruthyFunctionBody,
	box_nil: boxNilFunctionBody,
};
export let functionBodies = { ...builtInFuncBodies };
export const addFunctionBody = (name: string, body: number[]): void => {
	functionBodies[name] = body;
};
export const resetFunctionBodies = (): void => {
	functionBodies = { ...builtInFuncBodies }; // reset to built-in functions
};
// We can only add a type once, so we use a map to track them
export const getFunctionTypeKey = (type: {
	params: readonly ReturnType<typeof valType>[];
	results: readonly ReturnType<typeof valType>[];
}) => `(${type.params.join(",")})=>(${type.results.join(",")})`;

// Set types for all functions
export const getFunctionTypes = (): {
	functionTypes: number[][];
	functionIndices: Map<string, number>;
} => {
	const functionTypes: number[][] = [];
	const functionIndices = new Map<string, number>();
	const allFunctions = [
		...definedFunctions,
		...importFunctions,
		...userDefinedFunctions,
	];
	for (const imp of allFunctions) {
		const key = getFunctionTypeKey(imp.type);
		if (!functionIndices.has(key)) {
			const typeIndex = functionTypes.length;
			functionIndices.set(key, typeIndex);
			functionTypes.push([
				0x60,
				...unsignedLEB(imp.type.params.length),
				...imp.type.params,
				...unsignedLEB(imp.type.results.length),
				...imp.type.results,
			]);
		}
	}
	return { functionTypes, functionIndices };
};

// Assign the function indices to be used in the WebAssembly module
export const func = (): Record<string, number> => {
	const list: Record<string, number> = {};
	let index = 0;
	for (const imp of importFunctions) list[imp.name] = index++;
	for (const def of definedFunctions) list[def.name] = index++;
	for (const user of userDefinedFunctions) list[user.name] = index++;

	return list;
};

export const getFunctionReturnCount = (name: string): number => {
	const all = [
		...definedFunctions,
		...importFunctions,
		...userDefinedFunctions,
	];
	const fn = all.find((f) => f.name === name);
	if (!fn) throw new Error(`Function "${name}" not found`);
	return fn.type.results.length;
};
