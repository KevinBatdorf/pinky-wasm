import {
	boxBooleanFunctionBody,
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
const i32 = valType("i32");
const f64 = valType("f64");
export const importFunctions = [
	{ name: "print", type: { params: [i32], results: [] } },
	{ name: "println", type: { params: [i32], results: [] } },
] as const;
export const definedFunctions = [
	{ name: "main", type: { params: [], results: [] } },
	{ name: "mod", type: { params: [f64, f64], results: [f64] } },
	{ name: "pow", type: { params: [f64, f64], results: [f64] } },
	{ name: "box_number", type: { params: [f64], results: [i32] } },
	{ name: "unbox_number", type: { params: [i32], results: [f64] } },
	{ name: "box_bool", type: { params: [i32], results: [i32] } },
	{ name: "box_string", type: { params: [i32, i32], results: [i32] } },
	{ name: "is_truthy", type: { params: [i32], results: [i32] } },
] as const;
const allFunctions = [...definedFunctions, ...importFunctions];
// We can only add a type once, so we use a map to track them
export const functionTypeMap = new Map<string, number>();
export const functionTypes: number[][] = [];
export const getFunctionTypeKey = (type: {
	params: readonly ReturnType<typeof valType>[];
	results: readonly ReturnType<typeof valType>[];
}) => `(${type.params.join(",")})=>(${type.results.join(",")})`;

// Set types for all functions
for (const imp of allFunctions) {
	const key = getFunctionTypeKey(imp.type);
	if (functionTypeMap.has(key)) continue;
	functionTypeMap.set(key, functionTypeMap.size); // increment as we add
	functionTypes.push([
		0x60, // function type
		...unsignedLEB(imp.type.params.length), // number of params
		...imp.type.params,
		...unsignedLEB(imp.type.results.length), // number of results
		...imp.type.results,
	]);
}
// Assign the function indices
export const func: Record<string, number> = {};
for (const [i, def] of importFunctions.entries()) func[def.name] = i;
for (const [i, def] of definedFunctions.entries())
	func[def.name] = importFunctions.length + i;
export const functionBodies: Record<string, number[]> = {
	main: [], // main is defined later
	mod: modFunctionBody,
	pow: powFunctionBody,
	box_number: boxNumberFunctionBody,
	unbox_number: unboxNumberFunctionBody,
	box_bool: boxBooleanFunctionBody,
	box_string: boxStringFunctionBody,
	is_truthy: isTruthyFunctionBody,
};
