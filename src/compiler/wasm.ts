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
	setFromOffset: (offset: number, index = 0): number[] => [
		...global.get(index), // get global[index] (heap pointer)
		...i32.const(offset), // offset to add
		...i32.add(), // heap_ptr + offset
		...global.set(index), // set global[index] = heap_ptr + offset
	],
};
export const i32 = {
	const: (value: number): number[] => [0x41, ...signedLEB(value)],
	eq: (): number[] => [0x46],
	eqz: (): number[] => [0x45], // equal zero
	gt_u: (): number[] => [0x4b], // unsigned greater than
	ge_s: (): number[] => [0x4e], // signed greater than or equal
	ge_u: (): number[] => [0x4f], // unsigned greater than or equal
	ne: (): number[] => [0x47],
	lt_s: (): number[] => [0x48], // signed less than
	add: (): number[] => [0x6a],
	sub: (): number[] => [0x6b],
	mul: (): number[] => [0x6c],
	and: (): number[] => [0x71], // bitwise AND
	or: (): number[] => [0x72], // bitwise OR
	shl: (): number[] => [0x74], // shift left
	shr_u: (): number[] => [0x76], // unsigned shift right
	trunc_f64_s: (): number[] => [0xaa], // convert f64 to i32 (signed)
	load: (offset = 0): number[] => [0x28, 0x02, ...unsignedLEB(offset)],
	store: (offset = 0): number[] => [0x36, 0x02, ...unsignedLEB(offset)],
	load8_u: (offset = 0): number[] => [0x2d, 0x00, ...unsignedLEB(offset)],
	store8: (offset = 0): number[] => [0x3a, 0x00, ...unsignedLEB(offset)],
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
	convert_i32_u: (): number[] => [0xb8],
	convert_i32_s: (): number[] => [0xb7],
	div: (): number[] => [0xa3],
	neg: (): number[] => [0x9a],
	trunc: (): number[] => [0x9d],
	load: (offset = 0): number[] => [0x2b, 0x03, ...unsignedLEB(offset)],
	store: (offset = 0): number[] => [0x39, 0x03, ...unsignedLEB(offset)],
};
export const control = {
	end: (): number[] => [0x0b],
};
export const block = {
	start: (type = valType("void")): number[] => [0x02, ...unsignedLEB(type)],
	end: (): number[] => control.end(),
};
export const if_ = {
	start: (type = valType("void")): number[] => [0x04, ...unsignedLEB(type)],
	else: (): number[] => [0x05],
	end: (): number[] => control.end(),
};
export const loop = {
	start: (type = valType("void")): number[] => [0x03, ...unsignedLEB(type)],
	br: (labelIndex: number): number[] => [0x0c, ...unsignedLEB(labelIndex)],
	br_if: (labelIndex: number): number[] => [0x0d, ...unsignedLEB(labelIndex)],
	end: (): number[] => control.end(),
};
export const fn = {
	call: (index: number): number[] => [0x10, ...unsignedLEB(index)],
	return: (): number[] => [0x0f],
	end: (): number[] => control.end(),
};
export const memory = {
	size: () => [0x3f, 0x00],
	grow: () => [0x40, 0x00],
};
export const misc = {
	drop: (): number[] => [0x1a],
	unreachable: (): number[] => [0x00],
	nop: (): number[] => [0x01],
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
