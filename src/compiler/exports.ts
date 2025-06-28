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
		try {
			(instance.exports.main as () => void)();
		} catch (e) {
			console.error("Runtime error:", e);
			return [`RuntimeError: ${e instanceof Error ? e.message : String(e)}`];
		}
		return [...output];
	};
	return { run };
};
