import { beforeAll, expect, test } from "vitest";
import { compile } from "./compiler";
import { tokenize } from "./lexer";
import { parse } from "./parser";
import { loadWasm, type RunFunction } from "./wasm";
// import fs from "node:fs";

declare global {
	var run: RunFunction;
}

beforeAll(async () => {
	const { run } = await loadWasm();
	globalThis.run = run;
});

// test.only("prints to wasm binary file", async () => {
// 	const input = `println "jd" or "hello" -- hello
// println 1 or 2 -- 2
// println true or 7 -- true
// println "jd" and "hello" -- jd
// println 1 and 2 -- 1
// println true and 7 -- 7`;
// 	const { tokens } = tokenize(input);
// 	const { ast } = parse(tokens);
// 	const { bytes, error } = compile(ast);
// 	fs.writeFileSync("test.wasm", bytes);
// 	expect(error).toBeNull();
// });

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

test("prints boolean values as true and false", async () => {
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
	expect(output.join("")).toBe("88\n84\ntruetrue\ntruetrue\ntruefalse\n");
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

test("assigns variables and prints them", async () => {
	const input = `x := 5
                   y := "hello"
                   z := 10
                   print x
                   println y
                   println x + z
                   print z`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toBe("5hello\n15\n10");
});

test("short circuits on and & or", async () => {
	const input = `print true and false
                   print false or true
                   print true or false`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toBe("falsetruetrue");
});

test("short circuits on and & or with values", async () => {
	const input = `print true and 7
                   print false or "hello"
                   print 1 or 2`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toBe("7hello1");
});

test("chains and/or with values", async () => {
	const input = `print "foo" and "bar" and "hello" -- hello
                   print false or 0 or 2 -- 2
                   print true and 0 or 2 -- 2`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toBe("hello22");
});

test("if statements with print", async () => {
	const input = `x := 1
                   if x == 1 then
                     print x
                   end`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toBe("1");
});

test("if statements with print and else", async () => {
	const input = `x := 2
                   if x == 1 then
                     print x
                   else
                     print x + 1
                   end`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toBe("3");
});

test("if statements with elif", async () => {
	const input = `x := 2
                   if x == 1 then
                     print x
                   elif x == 2 then
                     print x * 2
                   end`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toBe("4");
});

test("if statements with elif and else", async () => {
	const input = `x := 3
                   if x == 1 then
                     print x
                   elif x == 2 then
                     print x * 2
                   else
                     print "not 1 or 2"
                   end`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toBe("not 1 or 2");
});

test("if statements with multiple elifs", async () => {
	const input = `x := 3
                   if x == 1 then
                     print "one"
                   elif x == 2 then
                     print "two"
                   elif x == 3 then
                     print "three"
                   end`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toBe("three");
});

test("if statements with multiple elifs and else", async () => {
	const input = `x := 4
                   if x == 1 then
                     print "one"
                   elif x == 2 then
                     print "two"
                   elif x == 3 then
                     print "three"
                   else
                     print "not one, two, or three"
                   end`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toBe("not one, two, or three");
});

test("if statements with nested ifs", async () => {
	const input = `x := 1
                   if x == 1 then
                     if x == 1 then
                       print "nested one"
                     end
                   end`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toBe("nested one");
});

test("if statements with nested ifs and else", async () => {
	const input = `x := 2
                   if x == 1 then
                     print "one"
                   else
                     if x == 2 then
                       print "nested two"
                     end
                   end`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toBe("nested two");
});

test("if statements with local variables", async () => {
	const input = `x := 1
                   if x == 1 then
                     local x := 2
                     print x
                   end`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toBe("2");
});

test("while loop with print", async () => {
	const input = `x := 1
                   while x < 5 do
                     print x
                     x := x + 1
                   end`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toBe("1234");
});

test("while loop with print and condition", async () => {
	const input = `x := 1
                   while x < 5 do
                     if x == 3 then
                       print "three"
                     else
                       print x
                     end
                     x := x + 1
                   end`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toBe("12three4");
});

test("while loop with local variables", async () => {
	const input = `x := 1
                   while x < 5 do
                     local y := x * 2
                     print y
                     x := x + 1
                   end`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toBe("2468");
});

test("while loop with local variables scoped", async () => {
	const input = `x := 1
                   while x < 5 do
                     x := x + 1
                     local x := 2
                     print x
                   end`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toBe("2222");
});
