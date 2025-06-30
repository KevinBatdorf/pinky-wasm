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
		// TODO: Probably a ton of work, but maybe eventually implement in wasm
		to_string: (boxPtr: number) => {
			const buf = new DataView(memory.buffer);
			const tag = buf.getInt32(boxPtr, true);
			switch (tag) {
				case 0:
					return boxString("", memory);
				case 1:
					return boxString(String(buf.getFloat64(boxPtr + 8, true)), memory);
				case 2:
					return boxPtr;
				case 3:
					return boxString(
						buf.getInt32(boxPtr + 4, true) ? "true" : "false",
						memory,
					);
				default:
					return boxString("", memory);
			}
		},
		// TODO: here too because something like `10 ^ 0.5` is hard
		math_pow: (base: number, exp: number): number => {
			return base ** exp;
		},
	};

	return {
		run: (bytes: Uint8Array): string[] => {
			output.length = 0; // clear previous output
			const program = new WebAssembly.Module(bytes);
			const instance = new WebAssembly.Instance(program, {
				env,
			});
			memory = instance.exports.memory as WebAssembly.Memory;
			try {
				(instance.exports.main as () => void)();
			} catch (e) {
				console.error("Runtime error:", e);
				let msg = e instanceof Error ? e.message : String(e);
				if (msg === "unreachable") {
					msg = "Unreachable code found. Infinite loop?";
				}
				return [`RuntimeError: ${msg}`];
			}
			return [...output];
		},
	};
};

const boxString = (str: string, memory: WebAssembly.Memory): number => {
	const encoder = new TextEncoder();
	const bytes = encoder.encode(str);

	memory.grow(1);
	const buf = new DataView(memory.buffer);
	const mem = new Uint8Array(memory.buffer);
	const offset = memory.buffer.byteLength - bytes.length;

	for (let i = 0; i < bytes.length; i++) {
		mem[offset + i] = bytes[i];
	}

	const boxPtr = offset - 12;
	buf.setInt32(boxPtr, 2, true); // tag = string
	buf.setInt32(boxPtr + 4, offset, true); // offset
	buf.setInt32(boxPtr + 8, bytes.length, true); // length

	return boxPtr;
};
