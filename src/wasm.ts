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
		let byte = v & 0x7f;
		// Shift value right by 7 bits to get the rest for the next round
		v >>>= 7;
		// If there's anything left, set high bit (0x80 = 10000000) to say: "more bytes follow"
		if (v !== 0) byte |= 0x80;
		bytes.push(byte);
	} while (v !== 0);
	return bytes;
};

// Encode a signed number as LEB128 (Little Endian Base 128)
// This is used for signed integer literals in WebAssembly (e.g., i32.const, i64.const)
// LEB128 stores integers in a variable-length format, 7 bits per byte
// The 8th bit (0x80) marks whether another byte follows
// For signed numbers, sign-extension must be preserved during decoding
export const signedLEB = (value: number): number[] => {
	const bytes: number[] = [];
	let v = value;
	do {
		// Grab the least significant 7 bits of the current value
		let byte = v & 0x7f;
		// Arithmetic right shift to preserve the sign bit during shift
		// This makes `-1 >> 7 === -1`, unlike logical shift which would yield a positive
		const shifted = v >> 7;
		// Extract the sign bit of the current 7-bit chunk (bit 6)
		const signBit = byte & 0x40;
		// Decide whether we need to keep encoding more bytes
		// The goal is to stop if shifting has reached:
		//   - 0 and the sign bit is clear
		//   - -1 and the sign bit is set
		const more = !(
			(shifted === 0 && signBit === 0) ||
			(shifted === -1 && signBit !== 0)
		);
		// If we still need more bytes, set the high bit (0x80)
		if (more) byte |= 0x80;
		bytes.push(byte);
		v = shifted; // Prepare for the next 7 bits
	} while (
		// Repeat until all significant bits are encoded *and* the sign bit is correctly preserved
		!(
			(v === 0 && (bytes[bytes.length - 1] & 0x40) === 0) ||
			(v === -1 && (bytes[bytes.length - 1] & 0x40) !== 0)
		)
	);
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

export const typeCode = (t: "i32" | "i64" | "f32" | "f64"): number => {
	switch (t) {
		case "i32":
			return 0x7f;
		case "i64":
			return 0x7e;
		case "f32":
			return 0x7d;
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

// export const virtualBinOps = {
// 	and: true,
// 	or: true,
// 	"%": true,
// 	"^": true,
// } as const;

export type RunFunction = (bytes: Uint8Array) => string[];
export const loadWasm = async (): Promise<{ run: RunFunction }> => {
	let memory: WebAssembly.Memory;
	const output: string[] = [];
	const decoder = new TextDecoder();

	const env = {
		print: (ptr: number, len: number) => {
			const mem = new Uint8Array(memory.buffer, ptr, len);
			output.push(decoder.decode(mem));
		},
		print_64: (val: number) => {
			output.push(String(val));
		},
		println: (ptr: number, len: number) => {
			const mem = new Uint8Array(memory.buffer, ptr, len);
			output.push(`${decoder.decode(mem)}\n`);
		},
		println_64: (val: number) => {
			output.push(`${val}\n`);
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
