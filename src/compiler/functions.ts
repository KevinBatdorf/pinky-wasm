import {
	if_,
	fn,
	i32,
	f64,
	local,
	unsignedLEB,
	valType,
	block,
	loop,
	global,
	memory,
	misc,
} from "./wasm";

// Set up function signatures
type FunctionType = {
	name: string;
	type: {
		params: readonly ReturnType<typeof valType>[];
		results: readonly ReturnType<typeof valType>[];
	};
};
const i32t = valType("i32");
const f64t = valType("f64");
export const importFunctions = [
	{ name: "print", type: { params: [i32t], results: [] } },
	{ name: "println", type: { params: [i32t], results: [] } },
	{ name: "to_string", type: { params: [i32t], results: [i32t] } },
	{ name: "math_pow", type: { params: [f64t, f64t], results: [f64t] } },
] as const;
export const definedFunctions: FunctionType[] = [
	{ name: "main", type: { params: [], results: [] } },
	{ name: "mod", type: { params: [f64t, f64t], results: [f64t] } },
	{ name: "is_truthy", type: { params: [i32t], results: [i32t] } },
	{ name: "is_string", type: { params: [i32t], results: [i32t] } },
	{ name: "is_bool", type: { params: [i32t], results: [i32t] } },
	{ name: "to_number", type: { params: [i32t], results: [i32t] } },
	{ name: "concat", type: { params: [i32t, i32t], results: [i32t] } },
	{ name: "memory_copy", type: { params: [i32t, i32t, i32t], results: [] } },
	{ name: "box_number", type: { params: [f64t], results: [i32t] } },
	{ name: "unbox_number", type: { params: [i32t], results: [f64t] } },
	{ name: "box_bool", type: { params: [i32t], results: [i32t] } },
	{ name: "box_string", type: { params: [i32t, i32t], results: [i32t] } },
	{ name: "box_nil", type: { params: [], results: [i32t] } },
	{ name: "ensure_space", type: { params: [i32t], results: [] } },
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

// biome-ignore format:
// js/lua style modulus
const modFunctionBody = [
    ...local.declare(),
    ...local.get(0),    // 0 (left)
    ...local.get(1),    // 1 (right)
    ...local.get(0),    // 0 (left)
    ...local.get(1),    // 1 (right)
    ...f64.div(),
    ...f64.trunc(), // trunc to integer
    ...f64.mul(),   // multiply by right
    ...f64.sub(),   // subtract -> yields a - b * floor(a/b)
    ...fn.end(),
];

const isStringFunctionBody: number[] = [
	// param: pointer to the boxed value
	...local.declare(),
	...local.get(0),
	...i32.load(0),
	...i32.const(2), // is it tag 2 (string)?
	...i32.eq(),
	...fn.end(),
];

const isBooleanFunctionBody: number[] = [
	// param: pointer to the boxed value
	...local.declare(),
	...local.get(0),
	...i32.load(0),
	...i32.const(3), // is it tag 3 (boolean)?
	...i32.eq(),
	...fn.end(),
];

// biome-ignore format:
const memoryCopyFunctionBody: number[] = [
	// params: from (0), to (1), len (2)
	...local.declare("i32", "i32"), // i, current byte
    ...i32.const(0), // i = 0
    ...local.set(3),

    ...block.start(),
    ...loop.start(),
        ...local.get(3),
        ...local.get(2),
        ...i32.ge_s(), // i >= len ?
        ...loop.br_if(1),

        ...local.get(0),
        ...local.get(3),
        ...i32.add(),
        ...i32.load8_u(), // ptr @ from + i
        ...local.set(4), // current byte

        ...local.get(1),
        ...local.get(3),
        ...i32.add(),
        ...local.get(4), // current byte
        ...i32.store8(), // ptr @ to + i

        ...local.get(3),
        ...i32.const(1),
        ...i32.add(),
        ...local.set(3), // i++

        ...loop.br(0), // loop back
    ...loop.end(),
    ...block.end(),
    ...fn.end()
];
const concatFunctionBody: number[] = [
	// incoming params: left (0), right (1) - i32 boxed unknowns
	...local.declare("i32", "i32", "i32", "i32", "i32"),

	...i32.const(16),
	...fn.call(func().ensure_space),

	// 0 = left
	...local.get(0),
	...fn.call(func().to_string), // JS import
	...local.set(0),

	// 1 = right
	...local.get(1),
	...fn.call(func().to_string),
	...local.set(1),

	// 2 = leftOffset
	...local.get(0),
	...i32.const(4),
	...i32.add(),
	...i32.load(),
	...local.set(2),

	// 3 = leftLength
	...local.get(0),
	...i32.const(8),
	...i32.add(),
	...i32.load(),
	...local.set(3),

	// 4 = rightOffset
	...local.get(1),
	...i32.const(4),
	...i32.add(),
	...i32.load(),
	...local.set(4),

	// 5 = rightLength
	...local.get(1),
	...i32.const(8),
	...i32.add(),
	...i32.load(),
	...local.set(5),

	// 6 = resultOffset
	...global.get(0), // global heap ptr
	...local.set(6),

	// copy left
	...local.get(2), // left offset (from)
	...local.get(6), // end of heap (to)
	...local.get(3), // left length (len)
	...fn.call(func().memory_copy),

	// copy right
	...local.get(4), // right offset (from)
	...local.get(6), // end of heap before left
	...local.get(3), // left length
	...i32.add(), // get new end of heap (to)
	...local.get(5), // right length (len)
	...fn.call(func().memory_copy),

	// update heap pointer
	...global.get(0),
	...local.get(3),
	...local.get(5),
	...i32.add(),
	...i32.add(),
	...global.set(0),

	// return new string
	...local.get(6),
	...local.get(3),
	...local.get(5),
	...i32.add(),
	...fn.call(func().box_string),

	...fn.end(),
];

// biome-ignore format:
const toNumberFunctionBody: number[] = [
    // incoming param: a pointer to a boxed value
	...local.declare(),
	...local.get(0),
	...i32.load(0), // load tag

	...i32.const(1),
	...i32.eq(),
    // tag == 1 (number)?
	...if_.start(valType("f64")),
        ...local.get(0),
        ...i32.const(8),
        ...i32.add(),
        ...f64.load(0),
	...if_.else(),
	    ...local.get(0),
	    ...i32.load(0), // reload tag
	    ...i32.const(3),
	    ...i32.eq(),
        // tag == 3 (bool)?
	    ...if_.start(valType("f64")),
	        ...local.get(0),
	        ...i32.const(4),
	        ...i32.add(),
	        ...i32.load(0),
	        ...f64.convert_i32_s(),
	    ...if_.else(),
	        ...local.get(0),
	        ...i32.load(0), // reload tag
	        ...i32.const(2),
	        ...i32.eq(),
            // tag == 2 (string)?
	        ...if_.start(valType("f64")),
	            // strings → NaN
	            ...f64.const(Number.NaN),
	        ...if_.else(),
	            // tag == 0 (nil)
	            ...f64.const(0),
	        ...if_.end(), // string
	    ...if_.end(), // bool
	...if_.end(), // number
	...fn.call(func().box_number),
	...fn.end(),
];

// biome-ignore format:
const isTruthyFunctionBody: number[] = [
    // incoming param: a pointer to a boxed value
    ...local.declare(),
    ...local.get(0), // load tag
    ...i32.load(0),

    // if tag == 1 (number)
    ...i32.const(1), ...i32.eq(),
    ...if_.start(valType("i32")), // if (result i32)
        ...local.get(0), ...i32.const(8), ...i32.add(), // offset + 8
        ...f64.load(0),
        ...f64.const(0),
        ...f64.ne(), // (number != 0)
        ...if_.else(),
            ...local.get(0), ...i32.load(0), // load tag again
            // if tag == 3 (bool)
            ...i32.const(3), ...i32.eq(),
                ...if_.start(valType("i32")), // if (result i32)
                ...local.get(0), ...i32.const(4), ...i32.add(), // offset + 4
                ...i32.load(0),
            ...if_.else(),
                ...local.get(0), ...i32.load(0), // load tag again
                ...i32.const(2), ...i32.eq(),
                ...if_.start(valType("i32")), // if (result i32)
                    ...local.get(0), ...i32.const(8), ...i32.add(),
                    ...i32.load(0),
                    ...i32.const(0),
                    ...i32.ne(), // (length > 0)
                ...if_.else(),
                    // falsy fallback
                    ...i32.const(0), // return 0 (falsy)
                ...if_.end(), // end string
            ...if_.end(), // end bool
        ...if_.end(), // end number
    ...fn.end(),
];

// biome-ignore format:
const ensureSpaceFunctionBody = [
	// param: i32 sizeNeeded
	...local.declare("i32"), // currentPtr
	// currentPtr = global heap ptr
	...global.get(0),
	...local.set(1),

	// Check if (currentPtr + sizeNeeded) > memory.size * 65536
	...local.get(1),
	...local.get(0),
	...i32.add(),

	...memory.size(),
	...i32.const(16),
	...i32.shl(),

	...i32.gt_u(),
	...if_.start(),

		// ceil(sizeNeeded / 65536)
		...local.get(0),
		...i32.const(65536 - 1),
		...i32.add(),
		...i32.const(16),
		...i32.shr_u(),

		...memory.grow(),
		...misc.drop(),

	...if_.end(),
	...fn.end(),
];

const boxNumberFunctionBody = [
	// incoming param: f64 value
	...local.declare("i32"), // temp_ptr

	...i32.const(16),
	...fn.call(func().ensure_space),

	// temp_ptr = heap_ptr
	...global.get(0),
	...local.set(1), // local[1] = temp_ptr

	// store tag = 1 (number) at temp_ptr
	...local.get(1),
	...i32.const(1),
	...i32.store(0), // offset = 0

	// store f64 at temp_ptr + 8
	...local.get(1),
	...i32.const(8),
	...i32.add(),
	...local.get(0), // f64 param
	...f64.store(0), // offset = 0

	// heap_ptr += 16
	...global.setFromOffset(16),

	// return temp_ptr
	...local.get(1),
	...fn.end(),
];

const unboxNumberFunctionBody = [
	// incoming param: pointer to boxed value
	...local.declare(),
	...local.get(0),
	...i32.const(8),
	...i32.add(),
	...f64.load(0), // align = 8, offset = 0
	...fn.end(),
];

const boxStringFunctionBody = [
	// two incoming params: string offset (i32) and length (i32)
	...local.declare("i32"), // declare temp_ptr
	...i32.const(16),
	...fn.call(func().ensure_space),
	// temp_ptr = heap_ptr
	...global.get(0),
	...local.set(2), // temp_ptr

	// store tag = 2 at (temp_ptr)
	...local.get(2),
	...i32.const(2),
	...i32.store(0), // offset = 0

	// store offset param at (temp_ptr + 4)
	...local.get(2),
	...i32.const(4),
	...i32.add(),
	...local.get(0),
	...i32.store(0), // offset = 0

	// store length param at (temp_ptr + 8)
	...local.get(2),
	...i32.const(8),
	...i32.add(),
	...local.get(1),
	...i32.store(0), // offset = 0

	// heap_ptr += 16
	...global.setFromOffset(16),

	// return temp_ptr
	...local.get(2),
	...fn.end(),
];

const boxBooleanFunctionBody = [
	// incoming param: boolean value (i32)
	...local.declare("i32"), // temp_ptr
	...i32.const(16),
	...fn.call(func().ensure_space),
	// temp_ptr = heap_ptr
	...global.get(0),
	...local.set(1),

	// store tag = 3 (boolean)
	...local.get(1),
	...i32.const(3),
	...i32.store(0), // offset = 0

	// store boolean value at temp_ptr + 4
	...local.get(1),
	...i32.const(4),
	...i32.add(),
	...local.get(0),
	...i32.store(0), // offset = 0

	// heap_ptr += 16
	...global.setFromOffset(16),

	// return temp_ptr
	...local.get(1),
	...fn.end(),
];

const boxNilFunctionBody = [
	// no incoming params
	...local.declare(),
	...global.get(0),
	...i32.const(0), // nil tag
	...i32.store(),
	...global.setFromOffset(16), // increment heap pointer
	...global.get(0),
	...fn.end(),
];

const builtInFuncBodies: Record<string, number[]> = {
	main: [], // main is defined later
	mod: modFunctionBody,
	is_truthy: isTruthyFunctionBody,
	is_string: isStringFunctionBody,
	is_bool: isBooleanFunctionBody,
	to_number: toNumberFunctionBody,
	concat: concatFunctionBody,
	memory_copy: memoryCopyFunctionBody,
	box_number: boxNumberFunctionBody,
	unbox_number: unboxNumberFunctionBody,
	box_bool: boxBooleanFunctionBody,
	box_string: boxStringFunctionBody,
	box_nil: boxNilFunctionBody,
	ensure_space: ensureSpaceFunctionBody,
};
export let functionBodies = { ...builtInFuncBodies };
export const addFunctionBody = (name: string, body: number[]): void => {
	functionBodies[name] = body;
};
export const resetFunctionBodies = (): void => {
	functionBodies = { ...builtInFuncBodies }; // reset to built-in functions
};
