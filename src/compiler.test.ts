import { beforeAll, expect, test } from "vitest";
import { compile } from "./compiler";
import { tokenize } from "./lexer";
import { parse } from "./parser";
import { loadWasm, type RunFunction } from "./wasm";

declare global {
	var run: RunFunction;
}

beforeAll(async () => {
	const { run } = await loadWasm();
	globalThis.run = run;
});

test("println hello world", async () => {
	const input = 'println "hello world"';
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const {
		bytes,
		error,
		meta: { strings },
	} = compile(ast);
	const text = new TextDecoder().decode(strings);
	expect(text).toBe("hello world\0");
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toBe("hello world\n");
});

test("print hello world", async () => {
	const input = 'print "hello world"';
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const {
		bytes,
		error,
		meta: { strings },
	} = compile(ast);
	const text = new TextDecoder().decode(strings);
	expect(text).toBe("hello world\0");
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toBe("hello world");
});

test("strings are empty when no strings used", async () => {
	const input = "print 5";
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const {
		bytes,
		error,
		meta: { strings },
	} = compile(ast);
	const text = new TextDecoder().decode(strings);
	expect(text).toBe("");
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toBe("5");
});

test("print and println with numbers", async () => {
	const input = `print 5
                   println 10`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toBe("510\n");
});

test("prints boolean values", async () => {
	const input = `print true
                   println false`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toBe("truefalse\n");
});

test("prints binary operators", async () => {
	const input = `print 5 + 3
                   println 10 - 2
                   print 4 * 2
                   println 8 / 2
                   print 2 == 2
                   println 2 ~= 3
                   print 3 < 5
                   println 5 > 3
                   print 3 <= 3
                   println 1 >= 4`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toBe("88\n84\n11\n11\n10\n");
});

test("prints grouping expressions", async () => {
	const input = "print (2 * (6 - -1))";
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toBe("14");
});

test("prints modulus operators", async () => {
	const input = `print 3 % 4 -- 3
                   print 7 % 3 -- 1
                   print -2 % 5 -- -2
                   print 10 % -3 -- 1
                   print -8 % -3 -- -2
                   print 0 % 7 -- 0
                   print 5 % 1 -- 0
                   print 5 % 0 -- NaN`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toBe("31-21-200NaN");
});
test("prints exponentiation operators", async () => {
	const input = `print 2 ^ 3 -- 8
                   print 5 ^ 2 -- 25
                   print 10 ^ -1 -- 0.1
                   print -2 ^ 3 -- -8
                   print -3 ^ 2 -- -9`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toBe("8250.1-8-9");
});
