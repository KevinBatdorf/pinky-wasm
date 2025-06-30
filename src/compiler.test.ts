import { beforeAll, expect, test } from "vitest";
import { compile } from "./compiler";
import { tokenize } from "./lexer";
import { parse } from "./parser";
import { loadWasm, type RunFunction } from "./compiler/exports";
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
	const input = `
        print 5
        println 10`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toBe("510\n");
});

test("prints boolean values as true and false", async () => {
	const input = `
        print true
        println false`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toBe("truefalse\n");
});

test("prints binary operators", async () => {
	const input = `
        print 5 + 3
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
	const input = `
        print 3 % 4 -- 3
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
	const input = `
        print 2 ^ 3 -- 8
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
	const input = `
        x := 5
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
	const input = `
        print true and false
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
	const input = `
        print true and 7
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
	const input = `
        print "foo" and "bar" and "hello" -- hello
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
	const input = `
        x := 1
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
	const input = `
        x := 2
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
	const input = `
        x := 2
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
	const input = `
        x := 3
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
	const input = `
        x := 3
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
	const input = `
        x := 4
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
	const input = `
        x := 1
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
	const input = `
        x := 2
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
	const input = `
        x := 1
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

test("shadowed variable restored after block", () => {
	const input = `
        x := "outer"
        if true then
            local x := "inner"
            println x
        end
        println x`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	expect(error).toBeNull();
	const output = run(bytes);
	expect(output.join("")).toBe("inner\nouter\n");
});

test("if without else and false condition", () => {
	const input = `
        x := 2
        if x == 1 then
            print x
        end`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toBe("");
});

test("elif skipped due to true if branch", () => {
	const input = `
        x := 1
        if x == 1 then
            print "first"
        elif x == 1 then
            print "second"
        end`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toBe("first");
});

test("all branches skipped with no else", () => {
	const input = `
        x := 0
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
	expect(output.join("")).toBe("");
});

test("local variable inside else branch", () => {
	const input = `
        x := 2
        if x == 1 then
            print x
        else
            local x := 10
            print x
        end`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toBe("10");
});

test("complex if condition", () => {
	const input = `
        x := 2
        y := 3
        if x * y == 6 then
            print "math!"
        end`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toBe("math!");
});

test("while loop with print", async () => {
	const input = `
        x := 1
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
	const input = `
        x := 1
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
	const input = `
        x := 1
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
	const input = `
        x := 1
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

test("while loop with false condition from start", async () => {
	const input = `
        x := 5
        while x < 5 do
            print x
            x := x + 1
        end`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toBe("");
});

test("while loop with local gives runtime error", async () => {
	const input = `
        x := 1
        while x < 3 do
            local x := 5
            print x
            x := 1
        end`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toContain(
		"RuntimeError: Unreachable code found. Infinite loop?",
	);
});

test("while loop modifies outer variable", async () => {
	const input = `
        x := 1
        while x < 4 do
            x := x + 1
        end
        print x`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toBe("4");
});

test("while loop modifies outer variable", async () => {
	const input = `
        x := 1
        y := 1
        while y < 4 do
            local x := x + 1
            print x
            y := y + 1
        end
        print x
        print y`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toBe("22214");
});

test("nested while loops", async () => {
	const input = `
        i := 1
        while i <= 2 do
            j := 1
            while j <= 2 do
                print i
                print j
                j := j + 1
            end
            i := i + 1
        end`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toBe("11122122");
});

test("basic for loop ascending", () => {
	const input = `
        for i := 1, 5 do
            print i
        end`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toBe("12345");
});

test("basic for loop descending with step", () => {
	const input = `
        for i := 5, 1, -1 do
            print i
        end`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toBe("54321");
});

test("for loop with step > 1", () => {
	const input = `
        for i := 1, 10, 2 do
            print i
        end`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toBe("13579");
});

test("for loop with step < 0", () => {
	const input = `
        for i := 10, 2, -2 do
            print i
        end`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toBe("108642");
});

test("for loop with zero step runs forever", () => {
	const input = `
        for i := 1, 5, 0 do
            print i
        end`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toBe(
		"RuntimeError: Unreachable code found. Infinite loop?",
	);
});

test("for loop where start > end without step has no output", () => {
	const input = `
        for i := 5, 1 do
            print i
        end`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toBe("");
});

test("for loop with local variable inside", () => {
	const input = `
        for i := 1, 3 do
            local x := i * 10
            print x
        end`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toBe("102030");
});

test("for loop with shadowing index variable", () => {
	const input = `
        for i := 1, 3 do
            local i := 99
            print i
        end`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toBe("999999");
});

test("nested for loops", () => {
	const input = `
        for i := 1, 2 do
            for j := 1, 2 do
                print i
                print j
            end
        end`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toBe("11122122");
});

test("for loop with negative step but start < end does not run", () => {
	const input = `
        for i := 1, 5, -1 do
            print i
        end`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toBe("");
});

test("for loop with zero step causes runtime error", () => {
	const input = `
        for i := 1, 5, 0 do
            print i
        end`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toContain("RuntimeError");
});

test("shadowing loop variable in nested loop", () => {
	const input = `
        for i := 1, 2 do
            for i := 10, 11 do
                print i
            end
        end`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toBe("10111011");
});

test("outer variable retains value after loop", () => {
	const input = `
        i := 2
        for i := 1, 3 do
            print i
        end
        print i`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toBe("1232");
});

test("for loop with start equal to end runs once", () => {
	const input = `
        for i := 3, 3 do
            print i
        end`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toBe("3");
});

test("for loop step as a variable", () => {
	const input = `
        step := -1
        for i := 5, 1, step do
            print i
        end`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toBe("54321");
});

test("function call with no return", () => {
	const input = `
        func greet()
          println "hi"
        end
        greet()`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toBe("hi\n");
});

test("passing function return to another function", () => {
	const input = `
        func one()
          ret 1
        end
        func addTwo(x)
          ret x + 2
        end
        println addTwo(one())`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	expect(error).toBeNull();
	const output = run(bytes);
	expect(output.join("")).toBe("3\n");
});

test("function returns value but unused", () => {
	const input = `
        func give()
          ret 1
        end
        give()
        println "ok"`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toBe("ok\n");
});

test("function return used in assignment", () => {
	const input = `
        func getNum()
          ret 42
        end
        x := getNum()
        println x`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toBe("42\n");
});

test("function params do not modify outer scope", () => {
	const input = `
        x := 10
        func modify(x)
            x := 5
        end
        modify(99)
        println x`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	expect(error).toBeNull();
	const output = run(bytes);
	expect(output.join("")).toBe("10\n");
});

test("function with parameters returns sum", () => {
	const input = `
        func add(a, b)
          ret a + b
        end
        println add(5, 7)`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toBe("12\n");
});

test("nested function calls work", () => {
	const input = `
        func square(n)
          ret n * n
        end
        func doubleSquare(x)
          ret square(x * 2)
        end
        println doubleSquare(3)`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toBe("36\n");
});

test("conditional returns based on input", () => {
	const input = `
        func check(a)
          if a > 0 then
            ret "positive"
          else
            ret "non-positive"
          end
        end
        println check(3)`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toBe("positive\n");
});

test("return from within a while loop", () => {
	const input = `
        func earlyExit()
          i := 0
          while i < 5 do
            if i == 3 then
              ret i
            end
            i := i + 1
          end
          ret -1
        end
        println earlyExit()`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toBe("3\n");
});

test("missing return in one branch returns nil", () => {
	const input = `
        func nil(flag)
          if flag then
            ret 1
          end
        end
        println nil(false)`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toBe("\n");
});

test("missing return in one branch is falsy", () => {
	const input = `
        func nil(flag)
            if flag then ret 1 end
        end
        if nil(false) then
            println 1
        else
            print 3
        end`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toBe("3");
});

test("multiple returns in same block doesn't error", () => {
	const input = `
        func foo()
            ret 1
            ret 2
        end
        print foo()`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	expect(error).toBeNull();
	const output = run(bytes);
	expect(output.join("")).toBe("1");
});

test("return inside loop and after loop", () => {
	const input = `
        func logic(x)
            while x > 0 do
                if x == 2 then
                    ret "two"
                end
                x := x - 1
            end
            ret "done"
        end
        println logic(3)`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toBe("two\n");
});

test("recursive function call", () => {
	const input = `
        func fact(n)
            if n <= 1 then
                ret 1
            else
                ret n * fact(n - 1)
            end
        end
        println fact(5)`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toBe("120\n");
});
test("string concat: string + string", () => {
	const input = `
        println "Hello, " + "world!"`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toBe("Hello, world!\n");
});

test("string concat: string + number", () => {
	const input = `
        println "Age: " + 42`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toBe("Age: 42\n");
});

test("string concat: number + string", () => {
	const input = `
        println 100 + "%"`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toBe("100%\n");
});

test("string concat: string + bool", () => {
	const input = `
        println "Done: " + true`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toBe("Done: true\n");
});

test("string concat: nested expression", () => {
	const input = `
        println "Result: " + (1 + 2) + ", ok"`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toBe("Result: 3, ok\n");
});

test("string concat: function return + string", () => {
	const input = `
        func greet()
            ret "Hello"
        end
        println greet() + " world!"`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toBe("Hello world!\n");
});

test("string concat: variable + string", () => {
	const input = `
        x := "Score: "
        y := 99
        println x + y`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toBe("Score: 99\n");
});

test("string concat: var + func return + literal", () => {
	const input = `
        func tag()
            ret "[OK]"
        end
        msg := "Result "
        println msg + tag() + "!"`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toBe("Result [OK]!\n");
});

test("string concat: empty string", () => {
	const input = `
        println "" + "empty" + ""`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toBe("empty\n");
});

test("string concat with number and boolean", () => {
	const input = `
        println "Result: " + 10 + " " + true`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toBe("Result: 10 true\n");
});

test("Can handle printing nil values", () => {
	const input = `
        func log(msg)
          println msg
        end
        print log("hello")`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	const output = run(bytes);
	expect(error).toBeNull();
	expect(output.join("")).toBe("hello\n");
});

test("empty function returns nil", () => {
	const input = `
        func noop()
        end
        println noop()`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	expect(error).toBeNull();
	const output = run(bytes);
	expect(output.join("")).toBe("\n");
});

// misc cases where it error
test("handles binary and inside while condition", () => {
	// This was an issue with scratch var tracking in the compiler
	const input = `
        func foo()
            while 1 <= 4 and 1 < 3 do
                x := 1
            end
        end
        println true and false`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	expect(error).toBeNull();
	const output = run(bytes);
	expect(output.join("")).toBe("false\n");
});

test("clears out scratch var index before fn decl", () => {
	// This was also scratch index related
	const input = `
        i := 2
        for i := 1, 3 do
            print i
        end
        print i
        func foo(n)
            if 1 and 2 then
                ret 1
            end
        end`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	expect(error).toBeNull();
	const output = run(bytes);
	expect(output.join("")).toBe("1232");
});

test("Function variables are scoped to the function", () => {
	// Before it was attempting to shadow the outside scope
	const input = `
        i := 0
        func foo(n)
            i := 1
            while i <= n do
                print "bar"
                i := i + 1
            end
        end
        foo(5)`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	expect(error).toBeNull();
	const output = run(bytes);
	expect(output.join("")).toBe("barbarbarbarbar");
});

test("boolean coerces to number in math", () => {
	const input = `
        print 1 + true
        print 1 + false
        print true + true
        print false + false
        print true + 1
        print false + 1`;
	const { tokens } = tokenize(input);
	const { ast } = parse(tokens);
	const { bytes, error } = compile(ast);
	expect(error).toBeNull();
	const output = run(bytes);
	expect(output.join("")).toBe("212021");
});
