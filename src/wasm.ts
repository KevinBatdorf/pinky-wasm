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
		let byte = v & typeCode("i32");
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

export const typeCode = (t: "i32" | "f64"): number => {
	switch (t) {
		case "i32":
			return 0x7f;
		case "f64":
			return 0x7c;
		default:
			throw new Error(`Unknown type: ${t}`);
	}
};
export const nativeBinOps = {
	"+": 0xa0, // f64.add
	"-": 0xa1, // f64.sub
	"*": 0xa2, // f64.mul
	"/": 0xa3, // f64.div
	"==": 0x61, // f64.eq
	"~=": 0x62, // f64.ne
	"<": 0x63, // f64.lt
	">": 0x64, // f64.gt
	"<=": 0x65, // f64.le
	">=": 0x66, // f64.ge
	// unsupported native operators
	"%": null,
	"^": null,
	and: null,
	or: null,
} as const;

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

// biome-ignore format:
// js/lua style modulus
export const modFunctionBody = [
	...unsignedLEB(0), // 0 local variables
	0x20, 0x00, // local.get 0 (left)
	0x20, 0x01, // local.get 1 (right)
	0x20, 0x00, // local.get 0 (left)
	0x20, 0x01, // local.get 1 (right)
	0xa3, // f64.div
	0x9d, // f64.trunc
	0xa2, // f64.mul
	0xa1, // f64.sub => yields a - b * floor(a/b)
	0x0b, // end
];

// biome-ignore format:
export const powFunctionBody = [
	...unsignedLEB(3),           // 3 locals
	0x01, typeCode("f64"),       // local[2]: result
	0x01, typeCode("i32"),       // local[3]: exp_i32
	0x01, typeCode("i32"),       // local[4]: counter

	// If exp < 0, invert base and negate exp
	0x20, 0x01,                // local.get 1 (exp)
	0x44, ...encodeF64(0),     // f64.const 0
	0x63,                      // f64.lt
	0x04, 0x40,                // if
		0x44, ...encodeF64(1), // f64.const 1
		0x20, 0x00,            // local.get 0 (base)
		0xa3,                  // f64.div
		0x21, 0x00,            // local.set 0 (base = 1 / base)

		0x20, 0x01,            // local.get 1 (exp)
		0x9a,                  // f64.neg
		0x21, 0x01,            // local.set 1 (exp = -exp)
	0x0b,                      // end if

	// result = base
	0x20, 0x00,  // local.get 0 (base)
	0x21, 0x02,  // local.set 2

	// exp_i32 = trunc(exp)
	0x20, 0x01,  // local.get 1 (exp)
	0xaa,        // i32.trunc_f64_s
	0x21, 0x03,  // local.set 3

	// counter = 1
	0x41, 0x01,  // i32.const 1
	0x21, 0x04,  // local.set 4

	// block
	0x02, 0x40,
		// loop
		0x03, 0x40,
			0x20, 0x04, // local.get 4 (counter)
			0x20, 0x03, // local.get 3 (exp_i32)
			0x4e,       // i32.ge_s
			0x0d, 0x01, // br_if 1 (break outer block)

			0x20, 0x02, // local.get 2 (result)
			0x20, 0x00, // local.get 0 (base)
			0xa2,       // f64.mul
			0x21, 0x02, // local.set 2 (result *= base)

			0x20, 0x04, // local.get 4 (counter)
			0x41, 0x01, // i32.const 1
			0x6a,       // i32.add
			0x21, 0x04, // local.set 4 (counter++)

			0x0c, 0x00, // br 0 (repeat loop)
		0x0b,         // end loop
	0x0b,           // end block

	0x20, 0x02,     // local.get 2 (result)
	0x0b            // end function
];

// biome-ignore format:
export const boxNumberFunctionBody = [
	// locals: 1 i32 local (temp_ptr), param is at local[0] (f64)
	...unsignedLEB(1), // one local
	0x01, typeCode("i32"), // local[1]: temp_ptr

	// temp_ptr = heap_ptr
	0x23, 0x00,         // global.get 0 (assumed heap_ptr)
	0x21, 0x01,         // local.set 1 into local[1] (temp_ptr)

	// store tag = 1 (number) at temp_ptr
	0x20, 0x01,         // local.get 1
	0x41, 0x01,         // i32.const 1
	0x36, 0x02, 0x00,   // i32.store offset=0

	// store f64 at temp_ptr + 8
	0x20, 0x01,         // local.get 1
	0x41, 0x08,         // i32.const 8
	0x6a,               // i32.add
	0x20, 0x00,         // local.get 0 (f64 param)
	0x39, 0x03, 0x00,   // f64.store offset=0

	// heap_ptr += 16
	0x23, 0x00,         // global.get 0
	0x41, 0x10,         // i32.const 16
	0x6a,               // i32.add
	0x24, 0x00,         // global.set 0

	// return temp_ptr
	0x20, 0x01,         // local.get 1
	0x0b,               // end
];

// biome-ignore format:
export const unboxNumber = (): number[] => [
    // 0x20, 0x00,      // local.get 0
	0x41, 8,         // i32.const 8
	0x6a,            // i32.add
	0x2b, 0x03, 0x00 // f64.load align=8, offset=0
];

// biome-ignore format:
export const boxStringFunctionBody = [
	// two incoming params: string offset (i32) and length (i32)
	// locals: 1 i32 local (temp_ptr)
	...unsignedLEB(1), // one local block
	0x01, typeCode("i32"), // temp_ptr

	// temp_ptr = heap_ptr
	0x23, 0x00,         // global.get 0
	0x21, 0x02,         // local.set 2 (temp_ptr)

	// store tag = 2 at (temp_ptr)
	0x20, 0x02,         // local.get 2
	0x41, 0x02,         // i32.const 2
	0x36, 0x02, 0x00,   // i32.store offset=0

	// store offset param at (temp_ptr + 4)
	0x20, 0x02,         // local.get 2
	0x41, 0x04,         // i32.const 4
	0x6a,               // i32.add
	0x20, 0x00,         // local.get 0 (offset)
	0x36, 0x02, 0x00,   // i32.store offset=0

	// store length param at (temp_ptr + 8)
	0x20, 0x02,         // local.get 2
	0x41, 0x08,         // i32.const 8
	0x6a,               // i32.add
	0x20, 0x01,         // local.get 1 (length)
	0x36, 0x02, 0x00,   // i32.store offset=0

	// heap_ptr += 16
	0x23, 0x00,
	0x41, 0x10,
	0x6a,
	0x24, 0x00,

	// return temp_ptr
	0x20, 0x02,
	0x0b,
];

// biome-ignore format:
export const boxBooleanFunctionBody = [
	...unsignedLEB(1),         // 1 local (temp_ptr)
	0x01, typeCode("i32"),

	// temp_ptr = heap_ptr
	0x23, 0x00,                // global.get 0
	0x21, 0x01,                // local.set 1

	// store tag = 3 (boolean)
	0x20, 0x01,                // local.get 1
	0x41, 0x03,                // i32.const 3
	0x36, 0x02, 0x00,          // i32.store

	// store boolean value at temp_ptr + 4
	0x20, 0x01,                // local.get 1
	0x41, 0x04,                // i32.const 4
	0x6a,                      // i32.add
	0x20, 0x00,                // local.get 0 (param)
	0x36, 0x02, 0x00,          // i32.store

	// heap_ptr += 16
	0x23, 0x00,
	0x41, 0x10,
	0x6a,
	0x24, 0x00,

	// return temp_ptr
	0x20, 0x01,
	0x0b,
];
// biome-ignore format:
export const isTruthyFunctionBody: number[] = [
    // Takes in one parameter: a pointer to a boxed value
    0x00, // no locals
    // load tag
    0x20, 0x00,             // local.get 0
    0x28, 0x02, 0x00,       // i32.load (tag)

    // if tag == 1 (number)
    0x41, 0x01, 0x46,       // i32.const 1, i32.eq
        0x04, 0x7f,             // if (result i32)
        0x20, 0x00, 0x41, 0x08, 0x6a, // local.get 0 + 8
        0x2b, 0x03, 0x00,             // f64.load
        0x44, ...encodeF64(0),        // f64.const 0
        0x62,                         // f64.ne
        0x05, // else
            // load tag again
            0x20, 0x00, 0x28, 0x02, 0x00,
            // if tag == 3 (bool)
            0x41, 0x03, 0x46,
                0x04, 0x7f, // if (result i32)
                0x20, 0x00, 0x41, 0x04, 0x6a,
                0x28, 0x02, 0x00,
            0x05, // else
                // load tag again
                0x20, 0x00, 0x28, 0x02, 0x00,
                0x41, 0x02, 0x46,

                // if (result i32)
                0x04, 0x7f,
                    0x20, 0x00, 0x41, 0x08, 0x6a,
                    0x28, 0x02, 0x00,
                    0x41, 0x00,
                    0x47, // i32.ne (length > 0)
                0x05,
                    // falsy fallback
                    0x41, 0x00,
                0x0b, // end string
            0x0b, // end bool
        0x0b, // end number
    0x0b // end function
];
