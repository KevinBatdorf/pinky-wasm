// Encode a number as LEB128 (Little Endian Base 128)
// This is used for encoding integers in WebAssembly
// LEB128 is a variable-length encoding scheme that uses 7 bits for each byte
// and the 8th bit as a continuation flag
export const unsignedLEB = (value: number): number[] => {
	const bytes: number[] = [];
	// Make sure we're working with an unsigned 32-bit value
	let v = value >>> 0;
	do {
		// Take the least significant 7 bits (mask with 0x7f = 01111111)
		let byte = v & valType("i32");
		// Shift value right by 7 bits to get the rest for the next round
		v >>>= 7;
		// If there's anything left, set high bit (0x80 = 10000000) to say: "more bytes follow"
		if (v !== 0) byte |= 0x80;
		bytes.push(byte);
	} while (v !== 0);
	return bytes;
};

export const encodeF64 = (value: number): number[] => {
	const buffer = new ArrayBuffer(8); // 64 bits = 8 bytes
	new DataView(buffer).setFloat64(0, value, true); // true = little-endian
	return [...new Uint8Array(buffer)];
};

export const encodeString = (str: string): number[] => {
	const bytes = [...new TextEncoder().encode(str)];
	return [bytes.length, ...bytes];
};

export const emitSection = (
	sectionId: number,
	payload: Uint8Array,
): Uint8Array => {
	const size = unsignedLEB(payload.length);
	return new Uint8Array([sectionId, ...size, ...payload]);
};

export type RunFunction = (bytes: Uint8Array) => string[];
export const loadWasm = async (): Promise<{ run: RunFunction }> => {
	let memory: WebAssembly.Memory;
	const output: string[] = [];
	const decoder = new TextDecoder();

	const env = {
		print: (boxPtr: number) => {
			const buf = new DataView(memory.buffer);
			// 1) read the 4-byte tag
			const tag = buf.getInt32(boxPtr, true);
			switch (tag) {
				case 0:
					// null/undefined: no output
					return;
				case 1: {
					// number: read 8-byte f64 at offset+8
					const num = buf.getFloat64(boxPtr + 8, true);
					output.push(String(num));
					break;
				}
				case 2: {
					// string: read offset (i32) and length (i32)
					const strOff = buf.getInt32(boxPtr + 4, true);
					const strLen = buf.getInt32(boxPtr + 8, true);
					const bytes = new Uint8Array(memory.buffer, strOff, strLen);
					output.push(decoder.decode(bytes));
					break;
				}
				case 3: {
					// boolean: read 4-byte i32 at offset+4
					const bool = buf.getInt32(boxPtr + 4, true);
					output.push(bool ? "true" : "false");
					break;
				}
				default:
					throw new Error(`Unknown tag: ${tag}`);
			}
		},
		println: (boxPtr: number) => {
			env.print(boxPtr);
			output.push("\n");
		},
	};

	const run = (bytes: Uint8Array): string[] => {
		output.length = 0; // clear previous output
		const program = new WebAssembly.Module(bytes);
		const instance = new WebAssembly.Instance(program, {
			env,
		});
		memory = instance.exports.memory as WebAssembly.Memory;
		(instance.exports.main as () => void)();
		return [...output]; // shallow copy so it’s immutable externally
	};
	return { run };
};

// opcode helpers
export const valType = (t: "i32" | "f64" | "void"): number => {
	switch (t) {
		case "i32":
			return 0x7f;
		case "f64":
			return 0x7c;
		case "void":
			return 0x40; // void type
		default:
			throw new Error(`Unknown type: ${t}`);
	}
};

export const local = {
	declare: (...types: ("i32" | "f64")[]): number[] => {
		if (!types.length) return [0x00]; // no locals
		const groups = new Map<string, number>();
		for (const t of types) {
			groups.set(t, (groups.get(t) ?? 0) + 1);
		}
		const result: number[] = [...unsignedLEB(groups.size)];
		for (const [type, count] of groups.entries()) {
			result.push(...unsignedLEB(count));
			result.push(valType(type as "i32" | "f64"));
		}
		return result;
	},
	get: (index: number): number[] => [0x20, ...unsignedLEB(index)],
	set: (index: number): number[] => [0x21, ...unsignedLEB(index)],
	tee: (index: number): number[] => [0x22, ...unsignedLEB(index)],
};
export const global = {
	get: (index: number): number[] => [0x23, ...unsignedLEB(index)],
	set: (index: number): number[] => [0x24, ...unsignedLEB(index)],
};
export const i32 = {
	const: (value: number): number[] => [0x41, ...unsignedLEB(value)],
	eq: (): number[] => [0x46],
	ge_s: (): number[] => [0x4e], // signed greater than or equal
	ne: (): number[] => [0x47],
	add: (): number[] => [0x6a],
	trunc_f64_s: (): number[] => [0xaa], // convert f64 to i32 (signed)
	load: (offset = 0): number[] => [0x28, 0x02, ...unsignedLEB(offset)],
	store: (offset = 0): number[] => [0x36, 0x02, ...unsignedLEB(offset)],
};

export const f64 = {
	const: (value: number): number[] => [0x44, ...encodeF64(value)],
	eq: (): number[] => [0x61],
	ne: (): number[] => [0x62],
	lt: (): number[] => [0x63],
	gt: (): number[] => [0x64],
	le: (): number[] => [0x65],
	ge: (): number[] => [0x66],
	add: (): number[] => [0xa0],
	sub: (): number[] => [0xa1],
	mul: (): number[] => [0xa2],
	div: (): number[] => [0xa3],
	neg: (): number[] => [0x9a],
	trunc: (): number[] => [0x9d],
	load: (offset = 0): number[] => [0x2b, 0x03, ...unsignedLEB(offset)],
	store: (offset = 0): number[] => [0x39, 0x03, ...unsignedLEB(offset)],
};
export const control = {
	block: (type = valType("void")): number[] => [0x02, ...unsignedLEB(type)],
	loop: (type = valType("void")): number[] => [0x03, ...unsignedLEB(type)],
	if: (type = valType("void")): number[] => [0x04, ...unsignedLEB(type)],
	else: (): number[] => [0x05],
	end: (): number[] => [0x0b],
	br: (labelIndex: number): number[] => [0x0c, ...unsignedLEB(labelIndex)],
	br_if: (labelIndex: number): number[] => [0x0d, ...unsignedLEB(labelIndex)],
	return: (): number[] => [0x0f],
};
export const fn = {
	call: (index: number): number[] => [0x10, ...unsignedLEB(index)],
};

export const nativeBinOps = {
	"+": f64.add()[0],
	"-": f64.sub()[0],
	"*": f64.mul()[0],
	"/": f64.div()[0],
	"==": f64.eq()[0],
	"~=": f64.ne()[0],
	"<": f64.lt()[0],
	">": f64.gt()[0],
	"<=": f64.le()[0],
	">=": f64.ge()[0],
	// unsupported native operators - but pinky needs
	"%": null,
	"^": null,
	and: null,
	or: null,
} as const;

// biome-ignore format:
// js/lua style modulus
export const modFunctionBody = [
	...local.declare(), // no locals
	...local.get(0),    // 0 (left)
	...local.get(1),    // 1 (right)
	...local.get(0),    // 0 (left)
	...local.get(1),    // 1 (right)
	...f64.div(),
	...f64.trunc(), // trunc to integer
	...f64.mul(),   // multiply by right
	...f64.sub(),   // subtract -> yields a - b * floor(a/b)
	...control.end(),
];

// biome-ignore format:
export const powFunctionBody = [
    // incoming params: base (f64), exp (f64)
    ...local.declare("f64", "i32", "i32"), // result, exp_i32, counter
	// If exp < 0, invert base and negate exp
	...local.get(1), // the exp
	...f64.const(0),
	...f64.lt(),
	...control.if(), // if (exp < 0)
		...f64.const(1),
		...local.get(0), // the base
		...f64.div(),
		...local.set(0), // base = 1 / base
		...local.get(1), // the exp
		...f64.neg(),
		...local.set(1), // exp = -exp
	...control.end(),

	// result = base
	...local.get(0), // the base
	...local.set(2), // local.set 2

	// exp_i32 = trunc(exp)
	...local.get(1), // the exp
	...i32.trunc_f64_s(), // convert f64 to i32
	...local.set(3),

	// counter = 1
	...i32.const(1),
	...local.set(4),

	...control.block(),
		...control.loop(),
			...local.get(4), // counter
			...local.get(3), // the exp_i32
			...i32.ge_s(),
			...control.br_if(1), // break outer block

			...local.get(2), // result
			...local.get(0), // base
			...f64.mul(), // result *= base
			...local.set(2), // result *= base

			...local.get(4), // counter
			...i32.const(1),
			...i32.add(), // counter++
			...local.set(4),

			...control.br(0), // repeat loop
		...control.end(), // loop
	...control.end(), // block

	...local.get(2), // result
	...control.end(),
];

export const boxNumberFunctionBody = [
	// incoming param: f64 value
	...local.declare("i32"), // temp_ptr

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
	...global.get(0),
	...i32.const(16),
	...i32.add(),
	...global.set(0),

	// return temp_ptr
	...local.get(1),
	...control.end(),
];

export const unboxNumber = (): number[] => [
	// incoming param: pointer to boxed number
	...i32.const(8),
	...i32.add(),
	...f64.load(0), // align = 8, offset = 0
];

export const boxStringFunctionBody = [
	// two incoming params: string offset (i32) and length (i32)
	...local.declare("i32"), // declare temp_ptr

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
	...global.get(0),
	...i32.const(16),
	...i32.add(),
	...global.set(0),

	// return temp_ptr
	...local.get(2),
	...control.end(),
];

export const boxBooleanFunctionBody = [
	// incoming param: boolean value (i32)
	...local.declare("i32"), // temp_ptr

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
	...global.get(0),
	...i32.const(16),
	...i32.add(),
	...global.set(0),

	// return temp_ptr
	...local.get(1),
	...control.end(),
];
// biome-ignore format:
export const isTruthyFunctionBody: number[] = [
    // incoming param: a pointer to a boxed value
    ...local.declare(), // no locals
    // load tag
    ...local.get(0),
    ...i32.load(0),

    // if tag == 1 (number)
    ...i32.const(1), ...i32.eq(),
    ...control.if(valType("i32")), // if (result i32)
        ...local.get(0), ...i32.const(8), ...i32.add(), // offset + 8
        ...f64.load(0),
        ...f64.const(0),
        ...f64.ne(), // (number != 0)
        ...control.else(),
            ...local.get(0), ...i32.load(0), // load tag again
            // if tag == 3 (bool)
            ...i32.const(3), ...i32.eq(),
                ...control.if(valType("i32")), // if (result i32)
                ...local.get(0), ...i32.const(4), ...i32.add(), // offset + 4
                ...i32.load(0),
            ...control.else(),
                ...local.get(0), ...i32.load(0), // load tag again
                ...i32.const(2), ...i32.eq(),
                ...control.if(valType("i32")), // if (result i32)
                    ...local.get(0), ...i32.const(8), ...i32.add(),
                    ...i32.load(0),
                    ...i32.const(0),
                    ...i32.ne(), // (length > 0)
                ...control.else(),
                    // falsy fallback
                    ...i32.const(0), // return 0 (falsy)
                ...control.end(), // end string
            ...control.end(), // end bool
        ...control.end(), // end number
    ...control.end(),
];
