import { test, expect } from "vitest";
import { tokenize } from "./lexer";

test("should tokenize all punctuation and symbol tokens", () => {
	const input = "(),.+-*/^%";
	const { tokens } = tokenize(input);
	const expected = [
		{ type: "LPAREN", value: "(", start: 0, end: 1, column: 1, line: 1 },
		{ type: "RPAREN", value: ")", start: 1, end: 2, column: 2, line: 1 },
		{ type: "COMMA", value: ",", start: 2, end: 3, column: 3, line: 1 },
		{ type: "DOT", value: ".", start: 3, end: 4, column: 4, line: 1 },
		{ type: "PLUS", value: "+", start: 4, end: 5, column: 5, line: 1 },
		{ type: "MINUS", value: "-", start: 5, end: 6, column: 6, line: 1 },
		{ type: "STAR", value: "*", start: 6, end: 7, column: 7, line: 1 },
		{ type: "SLASH", value: "/", start: 7, end: 8, column: 8, line: 1 },
		{ type: "CARET", value: "^", start: 8, end: 9, column: 9, line: 1 },
		{ type: "MOD", value: "%", start: 9, end: 10, column: 10, line: 1 },
		{ type: "EOF", value: "", start: 10, end: 10, column: 11, line: 1 },
	];
	expect(tokens).toEqual(expected);
});
test("should tokenize variable assignment and numbers", () => {
	const input = "x := 42";
	const { tokens } = tokenize(input);
	expect(tokens).toEqual([
		{ type: "IDENTIFIER", value: "x", start: 0, end: 1, column: 1, line: 1 },
		{ type: "ASSIGN", value: ":=", start: 2, end: 4, column: 3, line: 1 },
		{ type: "NUMBER", value: "42", start: 5, end: 7, column: 6, line: 1 },
		{ type: "EOF", value: "", start: 7, end: 7, column: 8, line: 1 },
	]);
});

test("should tokenize arithmetic and floats", () => {
	const input = "y := x + 3.14";
	const { tokens } = tokenize(input);
	expect(tokens).toEqual([
		{ type: "IDENTIFIER", value: "y", start: 0, end: 1, column: 1, line: 1 },
		{ type: "ASSIGN", value: ":=", start: 2, end: 4, column: 3, line: 1 },
		{ type: "IDENTIFIER", value: "x", start: 5, end: 6, column: 6, line: 1 },
		{ type: "PLUS", value: "+", start: 7, end: 8, column: 8, line: 1 },
		{ type: "NUMBER", value: "3.14", start: 9, end: 13, column: 10, line: 1 },
		{ type: "EOF", value: "", start: 13, end: 13, column: 14, line: 1 },
	]);
});

test("should tokenize string assignment", () => {
	const input = 'name := "Pinky"';
	const { tokens } = tokenize(input);
	expect(tokens).toEqual([
		{
			type: "IDENTIFIER",
			value: "name",
			start: 0,
			end: 4,
			column: 1,
			line: 1,
		},
		{ type: "ASSIGN", value: ":=", start: 5, end: 7, column: 6, line: 1 },
		{ type: "STRING", value: "Pinky", start: 8, end: 15, column: 9, line: 1 },
		{ type: "EOF", value: "", start: 15, end: 15, column: 16, line: 1 },
	]);
});

test("should tokenize if statement", () => {
	const input = 'if x > 0 then print("positive") end';
	const { tokens } = tokenize(input);
	expect(tokens).toEqual([
		{ type: "IF", value: "if", start: 0, end: 2, column: 1, line: 1 },
		{ type: "IDENTIFIER", value: "x", start: 3, end: 4, column: 4, line: 1 },
		{ type: "GT", value: ">", start: 5, end: 6, column: 6, line: 1 },
		{ type: "NUMBER", value: "0", start: 7, end: 8, column: 8, line: 1 },
		{ type: "THEN", value: "then", start: 9, end: 13, column: 10, line: 1 },
		{
			type: "PRINT",
			value: "print",
			start: 14,
			end: 19,
			column: 15,
			line: 1,
		},
		{ type: "LPAREN", value: "(", start: 19, end: 20, column: 20, line: 1 },
		{
			type: "STRING",
			value: "positive",
			start: 20,
			end: 30,
			column: 21,
			line: 1,
		},
		{ type: "RPAREN", value: ")", start: 30, end: 31, column: 31, line: 1 },
		{ type: "END", value: "end", start: 32, end: 35, column: 33, line: 1 },
		{ type: "EOF", value: "", start: 35, end: 35, column: 36, line: 1 },
	]);
});

test("should tokenize while loop", () => {
	const input = "while x < 10 do x := x + 1 end";
	const { tokens } = tokenize(input);
	expect(tokens).toEqual([
		{ type: "WHILE", value: "while", start: 0, end: 5, column: 1, line: 1 },
		{ type: "IDENTIFIER", value: "x", start: 6, end: 7, column: 7, line: 1 },
		{ type: "LT", value: "<", start: 8, end: 9, column: 9, line: 1 },
		{ type: "NUMBER", value: "10", start: 10, end: 12, column: 11, line: 1 },
		{ type: "DO", value: "do", start: 13, end: 15, column: 14, line: 1 },
		{
			type: "IDENTIFIER",
			value: "x",
			start: 16,
			end: 17,
			column: 17,
			line: 1,
		},
		{ type: "ASSIGN", value: ":=", start: 18, end: 20, column: 19, line: 1 },
		{
			type: "IDENTIFIER",
			value: "x",
			start: 21,
			end: 22,
			column: 22,
			line: 1,
		},
		{ type: "PLUS", value: "+", start: 23, end: 24, column: 24, line: 1 },
		{ type: "NUMBER", value: "1", start: 25, end: 26, column: 26, line: 1 },
		{ type: "END", value: "end", start: 27, end: 30, column: 28, line: 1 },
		{ type: "EOF", value: "", start: 30, end: 30, column: 31, line: 1 },
	]);
});

test("should tokenize function definition and call", () => {
	const input = "func add(a, b) do ret a + b end\nresult := add(2, 3)";
	const { tokens } = tokenize(input);
	expect(tokens).toEqual([
		{ type: "FUNC", value: "func", start: 0, end: 4, column: 1, line: 1 },
		{
			type: "IDENTIFIER",
			value: "add",
			start: 5,
			end: 8,
			column: 6,
			line: 1,
		},
		{ type: "LPAREN", value: "(", start: 8, end: 9, column: 9, line: 1 },
		{
			type: "IDENTIFIER",
			value: "a",
			start: 9,
			end: 10,
			column: 10,
			line: 1,
		},
		{ type: "COMMA", value: ",", start: 10, end: 11, column: 11, line: 1 },
		{
			type: "IDENTIFIER",
			value: "b",
			start: 12,
			end: 13,
			column: 13,
			line: 1,
		},
		{ type: "RPAREN", value: ")", start: 13, end: 14, column: 14, line: 1 },
		{ type: "DO", value: "do", start: 15, end: 17, column: 16, line: 1 },
		{ type: "RET", value: "ret", start: 18, end: 21, column: 19, line: 1 },
		{
			type: "IDENTIFIER",
			value: "a",
			start: 22,
			end: 23,
			column: 23,
			line: 1,
		},
		{ type: "PLUS", value: "+", start: 24, end: 25, column: 25, line: 1 },
		{
			type: "IDENTIFIER",
			value: "b",
			start: 26,
			end: 27,
			column: 27,
			line: 1,
		},
		{ type: "END", value: "end", start: 28, end: 31, column: 29, line: 1 },
		{
			type: "IDENTIFIER",
			value: "result",
			start: 32,
			end: 38,
			column: 1,
			line: 2,
		},
		{ type: "ASSIGN", value: ":=", start: 39, end: 41, column: 8, line: 2 },
		{
			type: "IDENTIFIER",
			value: "add",
			start: 42,
			end: 45,
			column: 11,
			line: 2,
		},
		{ type: "LPAREN", value: "(", start: 45, end: 46, column: 14, line: 2 },
		{ type: "NUMBER", value: "2", start: 46, end: 47, column: 15, line: 2 },
		{ type: "COMMA", value: ",", start: 47, end: 48, column: 16, line: 2 },
		{ type: "NUMBER", value: "3", start: 49, end: 50, column: 18, line: 2 },
		{ type: "RPAREN", value: ")", start: 50, end: 51, column: 19, line: 2 },
		{ type: "EOF", value: "", start: 51, end: 51, column: 20, line: 2 },
	]);
});

test("should tokenize nested for loops", () => {
	const input = `for i := 1, 2 do
	for j := 1, 2 do
		print(i, j)
	end
end`;
	const { tokens } = tokenize(input);
	expect(tokens).toEqual([
		{ type: "FOR", value: "for", start: 0, end: 3, column: 1, line: 1 },
		{ type: "IDENTIFIER", value: "i", start: 4, end: 5, column: 5, line: 1 },
		{ type: "ASSIGN", value: ":=", start: 6, end: 8, column: 7, line: 1 },
		{ type: "NUMBER", value: "1", start: 9, end: 10, column: 10, line: 1 },
		{ type: "COMMA", value: ",", start: 10, end: 11, column: 11, line: 1 },
		{ type: "NUMBER", value: "2", start: 12, end: 13, column: 13, line: 1 },
		{ type: "DO", value: "do", start: 14, end: 16, column: 15, line: 1 },
		{ type: "FOR", value: "for", start: 18, end: 21, column: 2, line: 2 },
		{ type: "IDENTIFIER", value: "j", start: 22, end: 23, column: 6, line: 2 },
		{ type: "ASSIGN", value: ":=", start: 24, end: 26, column: 8, line: 2 },
		{ type: "NUMBER", value: "1", start: 27, end: 28, column: 11, line: 2 },
		{ type: "COMMA", value: ",", start: 28, end: 29, column: 12, line: 2 },
		{ type: "NUMBER", value: "2", start: 30, end: 31, column: 14, line: 2 },
		{ type: "DO", value: "do", start: 32, end: 34, column: 16, line: 2 },
		{ type: "PRINT", value: "print", start: 37, end: 42, column: 3, line: 3 },
		{ type: "LPAREN", value: "(", start: 42, end: 43, column: 8, line: 3 },
		{ type: "IDENTIFIER", value: "i", start: 43, end: 44, column: 9, line: 3 },
		{ type: "COMMA", value: ",", start: 44, end: 45, column: 10, line: 3 },
		{ type: "IDENTIFIER", value: "j", start: 46, end: 47, column: 12, line: 3 },
		{ type: "RPAREN", value: ")", start: 47, end: 48, column: 13, line: 3 },
		{ type: "END", value: "end", start: 50, end: 53, column: 2, line: 4 },
		{ type: "END", value: "end", start: 54, end: 57, column: 1, line: 5 },
		{ type: "EOF", value: "", start: 57, end: 57, column: 4, line: 5 },
	]);
});

test("should tokenize single-character comparison operators", () => {
	const input = "x > 1 y < 2";
	const { tokens } = tokenize(input);
	expect(tokens).toEqual([
		{ type: "IDENTIFIER", value: "x", start: 0, end: 1, column: 1, line: 1 },
		{ type: "GT", value: ">", start: 2, end: 3, column: 3, line: 1 },
		{ type: "NUMBER", value: "1", start: 4, end: 5, column: 5, line: 1 },
		{ type: "IDENTIFIER", value: "y", start: 6, end: 7, column: 7, line: 1 },
		{ type: "LT", value: "<", start: 8, end: 9, column: 9, line: 1 },
		{ type: "NUMBER", value: "2", start: 10, end: 11, column: 11, line: 1 },
		{ type: "EOF", value: "", start: 11, end: 11, column: 12, line: 1 },
	]);
});

test("should error on invalid input", () => {
	const input = "func main(): do\n  print(Hello, World!)\nend";
	const { tokens, error } = tokenize(input);
	expect(tokens).toEqual([
		{ type: "FUNC", value: "func", start: 0, end: 4, column: 1, line: 1 },
		{ type: "IDENTIFIER", value: "main", start: 5, end: 9, column: 6, line: 1 },
		{ type: "LPAREN", value: "(", start: 9, end: 10, column: 10, line: 1 },
		{ type: "RPAREN", value: ")", start: 10, end: 11, column: 11, line: 1 },
	]);
	expect(error).toEqual({
		line: 1,
		column: 12,
		message: "Unexpected character ':'",
	});
});

test("should tokenize >= and <=", () => {
	const input = "a >= 10 b <= 20";
	const { tokens } = tokenize(input);
	expect(tokens).toEqual([
		{ type: "IDENTIFIER", value: "a", start: 0, end: 1, column: 1, line: 1 },
		{ type: "GE", value: ">=", start: 2, end: 4, column: 3, line: 1 },
		{ type: "NUMBER", value: "10", start: 5, end: 7, column: 6, line: 1 },
		{ type: "IDENTIFIER", value: "b", start: 8, end: 9, column: 9, line: 1 },
		{ type: "LE", value: "<=", start: 10, end: 12, column: 11, line: 1 },
		{ type: "NUMBER", value: "20", start: 13, end: 15, column: 14, line: 1 },
		{ type: "EOF", value: "", start: 15, end: 15, column: 16, line: 1 },
	]);
});

test("should tokenize single and inline comments", () => {
	const string = `-- This is a comment
x := 10 -- Inline comment
--- Another comment`;
	const { tokens } = tokenize(string);
	const tok1 = {
		type: "COMMENT",
		value: "-- This is a comment",
		line: 1,
		column: 1,
		start: 0,
		end: 20,
	};
	const tok2 = {
		type: "COMMENT",
		value: "-- Inline comment",
		line: 2,
		column: 9,
		start: 29,
		end: 46,
	};
	const tok3 = {
		type: "COMMENT",
		value: "--- Another comment",
		line: 3,
		column: 1,
		start: 47,
		end: 66,
	};
	expect(tokens).toEqual(expect.arrayContaining([tok1, tok2, tok3]));
});
