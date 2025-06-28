import { expect, test } from "vitest";
import {
	advance,
	expectNext,
	isEOF,
	isNextToken,
	match,
	parse,
	peek,
	previousToken,
} from "./parser";
import type { Token } from "./tokens";
import { tokenize } from "./lexer";

// Helpers
test("peek returns current token", () => {
	const tokens: Token[] = [
		{ type: "IDENTIFIER", value: "foo", line: 1, column: 1, start: 0, end: 3 },
		{ type: "EOF", value: "", line: 1, column: 4, start: 3, end: 3 },
	];
	const state = { tokens, current: 0 };
	expect(peek(state)).toEqual(tokens[0]);
});

test("advance returns current token and advances", () => {
	const tokens: Token[] = [
		{ type: "IDENTIFIER", value: "foo", line: 1, column: 1, start: 0, end: 3 },
		{ type: "EOF", value: "", line: 1, column: 4, start: 3, end: 3 },
	];
	const state = { tokens, current: 0 };
	const token = advance(state);
	expect(token).toEqual(tokens[0]);
	expect(state.current).toBe(1);
});

test("match checks the current token type and advances", () => {
	const tokens: Token[] = [
		{ type: "IDENTIFIER", value: "foo", line: 1, column: 1, start: 0, end: 3 },
		{ type: "EOF", value: "", line: 1, column: 4, start: 3, end: 3 },
	];
	const state = { tokens, current: 0 };
	expect(match(state, "IDENTIFIER")).toBe(true);
	expect(state.current).toBe(1);
	expect(match(state, "EOF")).toBe(false);
	expect(state.current).toBe(1);
});

test("advance does not advance past EOF", () => {
	const tokens: Token[] = [
		{ type: "EOF", value: "", line: 1, column: 1, start: 0, end: 0 },
	];
	const state = { tokens, current: 0 };
	const token = advance(state);
	expect(token).toEqual(tokens[0]);
	expect(state.current).toBe(0);
});

test("isEOF returns true for EOF token", () => {
	const token: Token = {
		type: "EOF",
		value: "",
		line: 2,
		column: 10,
		start: 9,
		end: 9,
	};
	expect(isEOF(token)).toBe(true);
});

test("isEOF returns false for non-EOF token", () => {
	const token: Token = {
		type: "IDENTIFIER",
		value: "foo",
		line: 1,
		column: 1,
		start: 0,
		end: 3,
	};
	expect(isEOF(token)).toBe(false);
});

test("previousToken returns previous token or throws", () => {
	const tokens: Token[] = [
		{ type: "IDENTIFIER", value: "foo", line: 1, column: 1, start: 0, end: 3 },
		{ type: "ASSIGN", value: ":=", line: 1, column: 4, start: 3, end: 4 },
		{ type: "EOF", value: "", line: 1, column: 5, start: 4, end: 4 },
	];
	const state = { tokens, current: 2 };
	expect(previousToken(state)).toEqual(tokens[1]);
	expect(() => previousToken({ tokens, current: 0 })).toThrow();
});

test("isNextToken returns true if next token matches", () => {
	const tokens: Token[] = [
		{ type: "IDENTIFIER", value: "foo", line: 1, column: 1, start: 0, end: 3 },
		{ type: "EOF", value: "", line: 1, column: 4, start: 3, end: 3 },
	];
	const state = { tokens, current: 0 };
	expect(isNextToken(state, "IDENTIFIER")).toBe(true);
	expect(isNextToken(state, "EQEQ")).toBe(false);
});

test("expectNext advances if token matches", () => {
	const tokens: Token[] = [
		{ type: "IDENTIFIER", value: "foo", line: 1, column: 1, start: 0, end: 3 },
		{ type: "EOF", value: "", line: 1, column: 4, start: 3, end: 3 },
	];
	const state = { tokens, current: 0 };
	const token = expectNext(state, "IDENTIFIER");
	expect(token.type).toBe("IDENTIFIER");
	expect(state.current).toBe(1);
});

test("expectNext throws if token does not match", () => {
	const tokens: Token[] = [
		{ type: "WHILE", value: "while", line: 1, column: 1, start: 0, end: 5 },
		{ type: "IDENTIFIER", value: "foo", line: 1, column: 7, start: 6, end: 9 },
		{ type: "EOF", value: "", line: 1, column: 4, start: 3, end: 3 },
	];
	const state = { tokens, current: 1 };
	expect(() => expectNext(state, "EQEQ")).toThrow(/Expected token type EQEQ/);
});

// Grammar tests
test("should have the correct location in Program", () => {
	// if true then\nprint 1\nend
	const tokens: Token[] = [
		{ type: "IF", value: "if", line: 1, column: 1, start: 0, end: 2 },
		{ type: "TRUE", value: "true", line: 1, column: 4, start: 3, end: 7 },
		{ type: "THEN", value: "then", line: 1, column: 9, start: 8, end: 12 },
		{ type: "PRINT", value: "print", line: 2, column: 3, start: 15, end: 20 },
		{ type: "NUMBER", value: "1", line: 2, column: 9, start: 21, end: 22 },
		{ type: "END", value: "end", line: 3, column: 1, start: 23, end: 26 },
		{ type: "EOF", value: "", line: 3, column: 3, start: 26, end: 26 },
	];
	const { ast } = parse(tokens);
	expect(ast.loc).toEqual({
		start: { line: 1, column: 1 },
		end: { line: 3, column: 3 },
	});
});
test("parses binary expressions with precedence", () => {
	const input = "1 + 2 * 3";
	const { tokens } = tokenize(input);
	const { ast, error } = parse(tokens);

	expect(error).toBeNull();
	expect(ast.body).toEqual([
		{
			type: "ExpressionStatement",
			expression: {
				type: "BinaryExpression",
				left: {
					type: "NumberLiteral",
					value: 1,
					loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 2 } },
				},
				operator: "+",
				right: {
					type: "BinaryExpression",
					left: {
						type: "NumberLiteral",
						value: 2,
						loc: {
							start: { line: 1, column: 5 },
							end: { line: 1, column: 6 },
						},
					},
					operator: "*",
					right: {
						type: "NumberLiteral",
						value: 3,
						loc: {
							start: { line: 1, column: 9 },
							end: { line: 1, column: 10 },
						},
					},
					loc: { start: { line: 1, column: 5 }, end: { line: 1, column: 10 } },
				},
				loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 10 } },
			},
			loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 10 } },
		},
	]);
});

test("parses unary expressions", () => {
	const input = "-1 * +1";
	const { tokens } = tokenize(input);
	const { ast, error } = parse(tokens);

	expect(error).toBeNull();
	expect(ast.body).toEqual([
		{
			type: "ExpressionStatement",
			expression: {
				type: "BinaryExpression",
				left: {
					type: "UnaryExpression",
					operator: "-",
					argument: {
						type: "NumberLiteral",
						value: 1,
						loc: {
							start: { line: 1, column: 2 },
							end: { line: 1, column: 3 },
						},
					},
					loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 3 } },
				},
				operator: "*",
				right: {
					type: "UnaryExpression",
					operator: "+",
					argument: {
						type: "NumberLiteral",
						value: 1,
						loc: {
							start: { line: 1, column: 7 },
							end: { line: 1, column: 8 },
						},
					},
					loc: { start: { line: 1, column: 6 }, end: { line: 1, column: 8 } },
				},
				loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 8 } },
			},
			loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 8 } },
		},
	]);
});

test("parses exponential expressions", () => {
	const input = "2 ^ 3";
	const { tokens } = tokenize(input);
	const { ast, error } = parse(tokens);

	expect(error).toBeNull();
	expect(ast.body).toEqual([
		{
			type: "ExpressionStatement",
			expression: {
				type: "BinaryExpression",
				left: {
					type: "NumberLiteral",
					value: 2,
					loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 2 } },
				},
				operator: "^",
				right: {
					type: "NumberLiteral",
					value: 3,
					loc: { start: { line: 1, column: 5 }, end: { line: 1, column: 6 } },
				},
				loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 6 } },
			},
			loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 6 } },
		},
	]);
});

test("parses exponential expressions with unary op", () => {
	const input = "2 ^ -3";
	const { tokens } = tokenize(input);
	const { ast, error } = parse(tokens);

	expect(error).toBeNull();
	expect(ast.body).toEqual([
		{
			type: "ExpressionStatement",
			expression: {
				type: "BinaryExpression",
				left: {
					type: "NumberLiteral",
					value: 2,
					loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 2 } },
				},
				operator: "^",
				right: {
					type: "UnaryExpression",
					operator: "-",
					argument: {
						type: "NumberLiteral",
						value: 3,
						loc: { start: { line: 1, column: 6 }, end: { line: 1, column: 7 } },
					},
					loc: { start: { line: 1, column: 5 }, end: { line: 1, column: 7 } },
				},
				loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 7 } },
			},
			loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 7 } },
		},
	]);
});

test("parses print statements", () => {
	const input = 'print "foo"';
	const { tokens } = tokenize(input);
	const { ast, error } = parse(tokens);

	expect(error).toBeNull();
	expect(ast.body).toEqual([
		{
			type: "PrintStatement",
			loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 12 } },
			expression: {
				type: "StringLiteral",
				value: "foo",
				loc: { start: { line: 1, column: 7 }, end: { line: 1, column: 12 } },
			},
		},
	]);
});
test("parses println statements", () => {
	const input = 'println "foo"';
	const { tokens } = tokenize(input);
	const { ast, error } = parse(tokens);

	expect(error).toBeNull();
	expect(ast.body).toEqual([
		{
			type: "PrintlnStatement",
			loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 14 } },
			expression: {
				type: "StringLiteral",
				value: "foo",
				loc: { start: { line: 1, column: 9 }, end: { line: 1, column: 14 } },
			},
		},
	]);
});

test("parses callable print statements", () => {
	const input = 'print("foo")';
	const { tokens } = tokenize(input);
	const { ast, error } = parse(tokens);

	expect(error).toBeNull();
	expect(ast.body).toEqual([
		{
			type: "PrintStatement",
			loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 13 } },
			expression: {
				type: "GroupingExpression",
				expression: {
					type: "StringLiteral",
					value: "foo",
					loc: { start: { line: 1, column: 7 }, end: { line: 1, column: 12 } },
				},
				loc: { start: { line: 1, column: 6 }, end: { line: 1, column: 13 } },
			},
		},
	]);
});

test("parses assignment statements", () => {
	const input = "x := 42";
	const { tokens } = tokenize(input);
	const { ast, error } = parse(tokens);

	expect(error).toBeNull();
	expect(ast.body).toEqual([
		{
			type: "AssignStatement",
			loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 8 } },
			identifier: {
				type: "Identifier",
				name: "x",
				loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 2 } },
			},
			expression: {
				type: "NumberLiteral",
				value: 42,
				loc: { start: { line: 1, column: 6 }, end: { line: 1, column: 8 } },
			},
		},
	]);
});

test("parses local assignment statements", () => {
	const input = "local x := 42";
	const { tokens } = tokenize(input);
	const { ast, error } = parse(tokens);

	expect(error).toBeNull();
	expect(ast.body).toEqual([
		{
			type: "LocalAssignStatement",
			loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 14 } },
			identifier: {
				type: "Identifier",
				name: "x",
				loc: { start: { line: 1, column: 7 }, end: { line: 1, column: 8 } },
			},
			expression: {
				type: "NumberLiteral",
				value: 42,
				loc: { start: { line: 1, column: 12 }, end: { line: 1, column: 14 } },
			},
		},
	]);
});

test("parses identifiers", () => {
	const input = "foo";
	const { tokens } = tokenize(input);
	const { ast, error } = parse(tokens);
	expect(error).toBeNull();
	expect(ast.body).toEqual([
		{
			type: "ExpressionStatement",
			loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 4 } },
			expression: {
				type: "Identifier",
				name: "foo",
				loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 4 } },
			},
		},
	]);
});

test("parses function declarations", () => {
	const input = `func foo(x, y)
ret x + y
end`;
	const { tokens } = tokenize(input);
	const { ast, error } = parse(tokens);
	expect(error).toBeNull();
	expect(ast.body).toEqual([
		{
			type: "FunctionDeclStatement",
			name: {
				type: "Identifier",
				name: "foo",
				loc: {
					start: { line: 1, column: 6 },
					end: { line: 1, column: 9 },
				},
			},
			params: [
				{
					type: "Identifier",
					name: "x",
					loc: {
						start: { line: 1, column: 10 },
						end: { line: 1, column: 11 },
					},
				},
				{
					type: "Identifier",
					name: "y",
					loc: {
						start: { line: 1, column: 13 },
						end: { line: 1, column: 14 },
					},
				},
			],
			body: [
				{
					type: "ReturnStatement",
					expression: {
						type: "BinaryExpression",
						left: {
							type: "Identifier",
							name: "x",
							loc: {
								start: { line: 2, column: 5 },
								end: { line: 2, column: 6 },
							},
						},
						operator: "+",
						right: {
							type: "Identifier",
							name: "y",
							loc: {
								start: { line: 2, column: 9 },
								end: { line: 2, column: 10 },
							},
						},
						loc: {
							start: { line: 2, column: 5 },
							end: { line: 2, column: 10 },
						},
					},
					loc: { start: { line: 2, column: 1 }, end: { line: 2, column: 10 } },
				},
			],
			loc: { start: { line: 1, column: 1 }, end: { line: 3, column: 4 } },
		},
	]);
});

test("parses function calls", () => {
	const input = "foo(1, 2)";
	const { tokens } = tokenize(input);
	const { ast, error } = parse(tokens);

	expect(error).toBeNull();
	expect(ast.body).toEqual([
		{
			type: "ExpressionStatement",
			loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 10 } },
			expression: {
				type: "FunctionCallExpression",
				name: {
					type: "Identifier",
					name: "foo",
					loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 4 } },
				},
				args: [
					{
						type: "NumberLiteral",
						value: 1,
						loc: { start: { line: 1, column: 5 }, end: { line: 1, column: 6 } },
					},
					{
						type: "NumberLiteral",
						value: 2,
						loc: { start: { line: 1, column: 8 }, end: { line: 1, column: 9 } },
					},
				],
				loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 10 } },
			},
		},
	]);
});

test("parses if statements", () => {
	const input = `if true then
  print "Hello"
end`;
	const { tokens } = tokenize(input);
	const { ast, error } = parse(tokens);

	expect(error).toBeNull();
	expect(ast.body).toEqual([
		{
			type: "IfStatement",
			condition: {
				type: "BooleanLiteral",
				value: true,
				loc: { start: { line: 1, column: 4 }, end: { line: 1, column: 8 } },
			},
			thenBranch: [
				{
					type: "PrintStatement",
					loc: { start: { line: 2, column: 3 }, end: { line: 2, column: 16 } },
					expression: {
						type: "StringLiteral",
						value: "Hello",
						loc: {
							start: { line: 2, column: 9 },
							end: { line: 2, column: 16 },
						},
					},
				},
			],
			loc: { start: { line: 1, column: 1 }, end: { line: 3, column: 4 } },
		},
	]);
});

test("parses if statements with elif and else", () => {
	const input = `if true then
  print "Hello"
elif false then
  print "World"
else
  print "!"
end`;
	const { tokens } = tokenize(input);
	const { ast, error } = parse(tokens);

	expect(error).toBeNull();
	expect(ast.body).toEqual([
		{
			type: "IfStatement",
			condition: {
				type: "BooleanLiteral",
				value: true,
				loc: { start: { line: 1, column: 4 }, end: { line: 1, column: 8 } },
			},
			thenBranch: [
				{
					type: "PrintStatement",
					loc: { start: { line: 2, column: 3 }, end: { line: 2, column: 16 } },
					expression: {
						type: "StringLiteral",
						value: "Hello",
						loc: {
							start: { line: 2, column: 9 },
							end: { line: 2, column: 16 },
						},
					},
				},
			],
			loc: { start: { line: 1, column: 1 }, end: { line: 7, column: 4 } },
			elifBranches: [
				{
					condition: {
						type: "BooleanLiteral",
						value: false,
						loc: {
							start: { line: 3, column: 6 },
							end: { line: 3, column: 11 },
						},
					},
					body: [
						{
							type: "PrintStatement",
							loc: {
								start: { line: 4, column: 3 },
								end: { line: 4, column: 16 },
							},
							expression: {
								type: "StringLiteral",
								value: "World",
								loc: {
									start: { line: 4, column: 9 },
									end: { line: 4, column: 16 },
								},
							},
						},
					],
				},
			],
			elseBranch: [
				{
					type: "PrintStatement",
					loc: { start: { line: 6, column: 3 }, end: { line: 6, column: 12 } },
					expression: {
						type: "StringLiteral",
						value: "!",
						loc: {
							start: { line: 6, column: 9 },
							end: { line: 6, column: 12 },
						},
					},
				},
			],
		},
	]);
});

test("parses while statements", () => {
	const input = `while true do
  print "Hello"
end`;
	const { tokens } = tokenize(input);
	const { ast, error } = parse(tokens);

	expect(error).toBeNull();
	expect(ast.body).toEqual([
		{
			type: "WhileStatement",
			condition: {
				type: "BooleanLiteral",
				value: true,
				loc: { start: { line: 1, column: 7 }, end: { line: 1, column: 11 } },
			},
			body: [
				{
					type: "PrintStatement",
					loc: { start: { line: 2, column: 3 }, end: { line: 2, column: 16 } },
					expression: {
						type: "StringLiteral",
						value: "Hello",
						loc: {
							start: { line: 2, column: 9 },
							end: { line: 2, column: 16 },
						},
					},
				},
			],
			loc: { start: { line: 1, column: 1 }, end: { line: 3, column: 4 } },
		},
	]);
});

test("parses nested statements", () => {
	const input = `if true then
  if false then
    print "Nested"
  end
end`;
	const { tokens } = tokenize(input);
	const { ast, error } = parse(tokens);

	expect(error).toBeNull();
	expect(ast.body).toEqual([
		{
			type: "IfStatement",
			condition: {
				type: "BooleanLiteral",
				value: true,
				loc: { start: { line: 1, column: 4 }, end: { line: 1, column: 8 } },
			},
			thenBranch: [
				{
					type: "IfStatement",
					condition: {
						type: "BooleanLiteral",
						value: false,
						loc: {
							start: { line: 2, column: 6 },
							end: { line: 2, column: 11 },
						},
					},
					thenBranch: [
						{
							type: "PrintStatement",
							loc: {
								start: { line: 3, column: 5 },
								end: { line: 3, column: 19 },
							},
							expression: {
								type: "StringLiteral",
								value: "Nested",
								loc: {
									start: { line: 3, column: 11 },
									end: { line: 3, column: 19 },
								},
							},
						},
					],
					loc: { start: { line: 2, column: 3 }, end: { line: 4, column: 6 } },
				},
			],
			loc: { start: { line: 1, column: 1 }, end: { line: 5, column: 4 } },
		},
	]);
});

test("parses empty statements", () => {
	const input = "";
	const { tokens } = tokenize(input);
	const { ast, error } = parse(tokens);

	expect(error).toBeNull();
	expect(ast.body).toEqual([]);
});

test("parses multiple statements", () => {
	const input = `x := 1
y := 2
z := 3`;
	const { tokens } = tokenize(input);
	const { ast, error } = parse(tokens);

	expect(error).toBeNull();
	expect(ast.body).toEqual([
		{
			type: "AssignStatement",
			loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 7 } },
			identifier: {
				type: "Identifier",
				name: "x",
				loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 2 } },
			},
			expression: {
				type: "NumberLiteral",
				value: 1,
				loc: { start: { line: 1, column: 6 }, end: { line: 1, column: 7 } },
			},
		},
		{
			type: "AssignStatement",
			loc: { start: { line: 2, column: 1 }, end: { line: 2, column: 7 } },
			identifier: {
				type: "Identifier",
				name: "y",
				loc: { start: { line: 2, column: 1 }, end: { line: 2, column: 2 } },
			},
			expression: {
				type: "NumberLiteral",
				value: 2,
				loc: { start: { line: 2, column: 6 }, end: { line: 2, column: 7 } },
			},
		},
		{
			type: "AssignStatement",
			loc: { start: { line: 3, column: 1 }, end: { line: 3, column: 7 } },
			identifier: {
				type: "Identifier",
				name: "z",
				loc: { start: { line: 3, column: 1 }, end: { line: 3, column: 2 } },
			},
			expression: {
				type: "NumberLiteral",
				value: 3,
				loc: { start: { line: 3, column: 6 }, end: { line: 3, column: 7 } },
			},
		},
	]);
});

test("parses for statements", () => {
	const input = `for i := 1, i < 10 do
  print i
end`;
	const { tokens } = tokenize(input);
	const { ast, error } = parse(tokens);

	expect(error).toBeNull();
	expect(ast.body).toEqual([
		{
			type: "ForStatement",
			assignment: {
				type: "LocalAssignStatement",
				identifier: {
					type: "Identifier",
					name: "i",
					loc: { start: { line: 1, column: 5 }, end: { line: 1, column: 6 } },
				},
				expression: {
					type: "NumberLiteral",
					value: 1,
					loc: { start: { line: 1, column: 10 }, end: { line: 1, column: 11 } },
				},
				loc: { start: { line: 1, column: 5 }, end: { line: 1, column: 11 } },
			},
			condition: {
				type: "BinaryExpression",
				left: {
					type: "Identifier",
					name: "i",
					loc: { start: { line: 1, column: 13 }, end: { line: 1, column: 14 } },
				},
				operator: "<",
				right: {
					type: "NumberLiteral",
					value: 10,
					loc: { start: { line: 1, column: 17 }, end: { line: 1, column: 19 } },
				},
				loc: { start: { line: 1, column: 13 }, end: { line: 1, column: 19 } },
			},
			body: [
				{
					type: "PrintStatement",
					loc: { start: { line: 2, column: 3 }, end: { line: 2, column: 10 } },
					expression: {
						type: "Identifier",
						name: "i",
						loc: {
							start: { line: 2, column: 9 },
							end: { line: 2, column: 10 },
						},
					},
				},
			],
			loc: { start: { line: 1, column: 1 }, end: { line: 3, column: 4 } },
		},
	]);
});

test("parses for statements with increment", () => {
	const input = `for i := 1, i < 10, i + 1 do
  print i
end`;
	const { tokens } = tokenize(input);
	const { ast, error } = parse(tokens);

	expect(error).toBeNull();
	expect(ast.body).toEqual([
		{
			type: "ForStatement",
			assignment: {
				type: "LocalAssignStatement",
				identifier: {
					type: "Identifier",
					name: "i",
					loc: { start: { line: 1, column: 5 }, end: { line: 1, column: 6 } },
				},
				expression: {
					type: "NumberLiteral",
					value: 1,
					loc: { start: { line: 1, column: 10 }, end: { line: 1, column: 11 } },
				},
				loc: { start: { line: 1, column: 5 }, end: { line: 1, column: 11 } },
			},
			condition: {
				type: "BinaryExpression",
				left: {
					type: "Identifier",
					name: "i",
					loc: { start: { line: 1, column: 13 }, end: { line: 1, column: 14 } },
				},
				operator: "<",
				right: {
					type: "NumberLiteral",
					value: 10,
					loc: { start: { line: 1, column: 17 }, end: { line: 1, column: 19 } },
				},
				loc: { start: { line: 1, column: 13 }, end: { line: 1, column: 19 } },
			},
			increment: {
				type: "BinaryExpression",
				left: {
					type: "Identifier",
					name: "i",
					loc: { start: { line: 1, column: 21 }, end: { line: 1, column: 22 } },
				},
				operator: "+",
				right: {
					type: "NumberLiteral",
					value: 1,
					loc: {
						start: { line: 1, column: 25 },
						end: {
							line: 1,
							column: 26,
						},
					},
				},
				loc: { start: { line: 1, column: 21 }, end: { line: 1, column: 26 } },
			},
			body: [
				{
					type: "PrintStatement",
					loc: { start: { line: 2, column: 3 }, end: { line: 2, column: 10 } },
					expression: {
						type: "Identifier",
						name: "i",
						loc: {
							start: { line: 2, column: 9 },
							end: { line: 2, column: 10 },
						},
					},
				},
			],
			loc: { start: { line: 1, column: 1 }, end: { line: 3, column: 4 } },
		},
	]);
});

test("parses without comments", () => {
	const input = `x := 1
    -- This is a comment
    y := 2`;
	const { tokens } = tokenize(input);
	const { ast, error } = parse(tokens);
	expect(error).toBeNull();
	expect(ast.body).toEqual([
		{
			type: "AssignStatement",
			loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 7 } },
			identifier: {
				type: "Identifier",
				name: "x",
				loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 2 } },
			},
			expression: {
				type: "NumberLiteral",
				value: 1,
				loc: { start: { line: 1, column: 6 }, end: { line: 1, column: 7 } },
			},
		},
		{
			type: "AssignStatement",
			loc: { start: { line: 3, column: 5 }, end: { line: 3, column: 11 } },
			identifier: {
				type: "Identifier",
				name: "y",
				loc: { start: { line: 3, column: 5 }, end: { line: 3, column: 6 } },
			},
			expression: {
				type: "NumberLiteral",
				value: 2,
				loc: { start: { line: 3, column: 10 }, end: { line: 3, column: 11 } },
			},
		},
	]);
});

test("parses nested functions", () => {
	const input = `func outer()
  func inner()
    print "Hello from inner"
  end
  print "Hello from outer"
end`;
	const { tokens } = tokenize(input);
	const { ast, error } = parse(tokens);

	expect(error).toBeNull();
	expect(ast.body).toEqual([
		{
			type: "FunctionDeclStatement",
			name: {
				type: "Identifier",
				name: "outer",
				loc: { start: { line: 1, column: 6 }, end: { line: 1, column: 11 } },
			},
			params: [],
			body: [
				{
					type: "FunctionDeclStatement",
					name: {
						type: "Identifier",
						name: "inner",
						loc: {
							start: { line: 2, column: 8 },
							end: { line: 2, column: 13 },
						},
					},
					params: [],
					body: [
						{
							type: "PrintStatement",
							loc: {
								start: { line: 3, column: 5 },
								end: { line: 3, column: 29 },
							},
							expression: {
								type: "StringLiteral",
								value: "Hello from inner",
								loc: {
									start: { line: 3, column: 11 },
									end: { line: 3, column: 29 },
								},
							},
						},
					],
					loc: { start: { line: 2, column: 3 }, end: { line: 4, column: 6 } },
				},
				{
					type: "PrintStatement",
					loc: { start: { line: 5, column: 3 }, end: { line: 5, column: 27 } },
					expression: {
						type: "StringLiteral",
						value: "Hello from outer",
						loc: {
							start: { line: 5, column: 9 },
							end: { line: 5, column: 27 },
						},
					},
				},
			],
			loc: { start: { line: 1, column: 1 }, end: { line: 6, column: 4 } },
		},
	]);
});

test("parses function calls as statements", () => {
	const input = "foo(1, 2)";
	const { tokens } = tokenize(input);
	const { ast, error } = parse(tokens);
	expect(error).toBeNull();
	expect(ast.body).toEqual([
		{
			type: "ExpressionStatement",
			expression: {
				type: "FunctionCallExpression",
				name: {
					type: "Identifier",
					name: "foo",
					loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 4 } },
				},
				args: [
					{
						type: "NumberLiteral",
						value: 1,
						loc: { start: { line: 1, column: 5 }, end: { line: 1, column: 6 } },
					},
					{
						type: "NumberLiteral",
						value: 2,
						loc: { start: { line: 1, column: 8 }, end: { line: 1, column: 9 } },
					},
				],
				loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 10 } },
			},
			loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 10 } },
		},
	]);
});

test("parses function calls with no arguments as expressions", () => {
	const input = "i := 3 * foo()";
	const { tokens } = tokenize(input);
	const { ast, error } = parse(tokens);
	expect(error).toBeNull();
	expect(ast.body).toEqual([
		{
			type: "AssignStatement",
			loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 15 } },
			identifier: {
				type: "Identifier",
				name: "i",
				loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 2 } },
			},
			expression: {
				type: "BinaryExpression",
				left: {
					type: "NumberLiteral",
					value: 3,
					loc: { start: { line: 1, column: 6 }, end: { line: 1, column: 7 } },
				},
				operator: "*",
				right: {
					type: "FunctionCallExpression",
					name: {
						type: "Identifier",
						name: "foo",
						loc: {
							start: { line: 1, column: 10 },
							end: { line: 1, column: 13 },
						},
					},
					args: [],
					loc: { start: { line: 1, column: 10 }, end: { line: 1, column: 15 } },
				},
				loc: { start: { line: 1, column: 6 }, end: { line: 1, column: 15 } },
			},
		},
	]);
});

test("parses return statements", () => {
	const input = `func foo()
  return 42
end`;
	const { tokens } = tokenize(input);
	const { ast, error } = parse(tokens);

	expect(error).toBeNull();
	expect(ast.body).toEqual([
		{
			type: "FunctionDeclStatement",
			name: {
				type: "Identifier",
				name: "foo",
				loc: { start: { line: 1, column: 6 }, end: { line: 1, column: 9 } },
			},
			params: [],
			body: [
				{
					type: "ExpressionStatement",
					expression: {
						type: "Identifier",
						name: "return",
						loc: { start: { line: 2, column: 3 }, end: { line: 2, column: 9 } },
					},
					loc: { start: { line: 2, column: 3 }, end: { line: 2, column: 9 } },
				},
				{
					type: "ExpressionStatement",
					expression: {
						type: "NumberLiteral",
						value: 42,
						loc: {
							start: { line: 2, column: 10 },
							end: { line: 2, column: 12 },
						},
					},
					loc: { start: { line: 2, column: 10 }, end: { line: 2, column: 12 } },
				},
			],
			loc: { start: { line: 1, column: 1 }, end: { line: 3, column: 4 } },
		},
	]);
});

test("handles parsing errors gracefully", () => {
	const input = `print "hi"
1 +`;
	const { tokens } = tokenize(input);
	const { ast, error } = parse(tokens);

	const expectedAst = {
		type: "Program",
		body: [
			{
				type: "PrintStatement",
				loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 11 } },
				expression: {
					type: "StringLiteral",
					value: "hi",
					loc: { start: { line: 1, column: 7 }, end: { line: 1, column: 11 } },
				},
			},
		],
		loc: { start: { line: 1, column: 1 }, end: { line: 2, column: 4 } },
	};

	expect(ast).toEqual(expectedAst);
	expect(error).not.toBeNull();
	expect(error?.message).toBe("Unexpected end of input: expected expression");
	expect(error?.body).toEqual(expectedAst);
	expect(error?.line).toBe(2);
	expect(error?.column).toBe(3);
	expect(error?.tokenLength).toBe(1);
	expect(error?.name).toBe("ParseError");
});

test("parses string concatenation", () => {
	const input = '"hello" + "world"';
	const { tokens } = tokenize(input);
	const { ast, error } = parse(tokens);
	expect(error).toBeNull();
	expect(ast.body).toEqual([
		{
			type: "ExpressionStatement",
			expression: {
				type: "BinaryExpression",
				left: {
					type: "StringLiteral",
					value: "hello",
					loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 8 } },
				},
				operator: "+",
				right: {
					type: "StringLiteral",
					value: "world",
					loc: { start: { line: 1, column: 11 }, end: { line: 1, column: 18 } },
				},
				loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 18 } },
			},
			loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 18 } },
		},
	]);
});

test("parses unary expressions with parentheses", () => {
	const input = "-(1 + 2)";
	const { tokens } = tokenize(input);
	const { ast, error } = parse(tokens);
	expect(error).toBeNull();
	expect(ast.body).toEqual([
		{
			type: "ExpressionStatement",
			expression: {
				type: "UnaryExpression",
				operator: "-",
				argument: {
					type: "GroupingExpression",
					expression: {
						type: "BinaryExpression",
						left: {
							type: "NumberLiteral",
							value: 1,
							loc: {
								start: { line: 1, column: 3 },
								end: { line: 1, column: 4 },
							},
						},
						operator: "+",
						right: {
							type: "NumberLiteral",
							value: 2,
							loc: {
								start: { line: 1, column: 7 },
								end: { line: 1, column: 8 },
							},
						},
						loc: { start: { line: 1, column: 3 }, end: { line: 1, column: 8 } },
					},
					loc: { start: { line: 1, column: 2 }, end: { line: 1, column: 9 } },
				},
				loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 9 } },
			},
			loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 9 } },
		},
	]);
});

test("grouping overrides precedence", () => {
	const input = "(1 + 2) * 3";
	const { tokens } = tokenize(input);
	const { ast, error } = parse(tokens);
	expect(error).toBeNull();
	expect(ast.body).toEqual([
		{
			type: "ExpressionStatement",
			expression: {
				type: "BinaryExpression",
				left: {
					type: "GroupingExpression",
					expression: {
						type: "BinaryExpression",
						left: {
							type: "NumberLiteral",
							value: 1,
							loc: {
								start: { line: 1, column: 2 },
								end: { line: 1, column: 3 },
							},
						},
						operator: "+",
						right: {
							type: "NumberLiteral",
							value: 2,
							loc: {
								start: { line: 1, column: 6 },
								end: { line: 1, column: 7 },
							},
						},
						loc: { start: { line: 1, column: 2 }, end: { line: 1, column: 7 } },
					},
					loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 8 } },
				},
				operator: "*",
				right: {
					type: "NumberLiteral",
					value: 3,
					loc: { start: { line: 1, column: 11 }, end: { line: 1, column: 12 } },
				},
				loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 12 } },
			},
			loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 12 } },
		},
	]);
});

test("parses or and and expressions", () => {
	const input = "true or false and true";
	const { tokens } = tokenize(input);
	const { ast, error } = parse(tokens);
	expect(error).toBeNull();
	expect(ast.body).toEqual([
		{
			type: "ExpressionStatement",
			expression: {
				type: "BinaryExpression",
				left: {
					type: "BooleanLiteral",
					value: true,
					loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 5 } },
				},
				operator: "or",
				right: {
					type: "BinaryExpression",
					left: {
						type: "BooleanLiteral",
						value: false,
						loc: {
							start: { line: 1, column: 9 },
							end: { line: 1, column: 14 },
						},
					},
					operator: "and",
					right: {
						type: "BooleanLiteral",
						value: true,
						loc: {
							start: { line: 1, column: 19 },
							end: { line: 1, column: 23 },
						},
					},
					loc: { start: { line: 1, column: 9 }, end: { line: 1, column: 23 } },
				},
				loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 23 } },
			},
			loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 23 } },
		},
	]);
});

test("parses complex expressions with mixed operators", () => {
	const input = "1 + 2 * 3 - 4 / 2";
	const { tokens } = tokenize(input);
	const { ast, error } = parse(tokens);
	expect(error).toBeNull();
	expect(ast.body).toEqual([
		{
			type: "ExpressionStatement",
			expression: {
				type: "BinaryExpression",
				left: {
					type: "BinaryExpression",
					left: {
						type: "NumberLiteral",
						value: 1,
						loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 2 } },
					},
					operator: "+",
					right: {
						type: "BinaryExpression",
						left: {
							type: "NumberLiteral",
							value: 2,
							loc: {
								start: { line: 1, column: 5 },
								end: { line: 1, column: 6 },
							},
						},
						operator: "*",
						right: {
							type: "NumberLiteral",
							value: 3,
							loc: {
								start: { line: 1, column: 9 },
								end: { line: 1, column: 10 },
							},
						},
						loc: {
							start: { line: 1, column: 5 },
							end: { line: 1, column: 10 },
						},
					},
					loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 10 } },
				},
				operator: "-",
				right: {
					type: "BinaryExpression",
					left: {
						type: "NumberLiteral",
						value: 4,
						loc: {
							start: { line: 1, column: 13 },
							end: { line: 1, column: 14 },
						},
					},
					operator: "/",
					right: {
						type: "NumberLiteral",
						value: 2,
						loc: {
							start: { line: 1, column: 17 },
							end: { line: 1, column: 18 },
						},
					},
					loc: { start: { line: 1, column: 13 }, end: { line: 1, column: 18 } },
				},
				loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 18 } },
			},
			loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 18 } },
		},
	]);
});

test("parses negative numbers", () => {
	const input = "-42 + 5";
	const { tokens } = tokenize(input);
	const { ast, error } = parse(tokens);
	expect(error).toBeNull();
	expect(ast.body).toEqual([
		{
			type: "ExpressionStatement",
			expression: {
				type: "BinaryExpression",
				left: {
					type: "UnaryExpression",
					operator: "-",
					argument: {
						type: "NumberLiteral",
						value: 42,
						loc: { start: { line: 1, column: 2 }, end: { line: 1, column: 4 } },
					},
					loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 4 } },
				},
				operator: "+",
				right: {
					type: "NumberLiteral",
					value: 5,
					loc: { start: { line: 1, column: 7 }, end: { line: 1, column: 8 } },
				},
				loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 8 } },
			},
			loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 8 } },
		},
	]);
});

test("parses 0 as a number literal", () => {
	const input = "0 + 1";
	const { tokens } = tokenize(input);
	const { ast, error } = parse(tokens);
	expect(error).toBeNull();
	expect(ast.body).toEqual([
		{
			type: "ExpressionStatement",
			expression: {
				type: "BinaryExpression",
				left: {
					type: "NumberLiteral",
					value: 0,
					loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 2 } },
				},
				operator: "+",
				right: {
					type: "NumberLiteral",
					value: 1,
					loc: { start: { line: 1, column: 5 }, end: { line: 1, column: 6 } },
				},
				loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 6 } },
			},
			loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 6 } },
		},
	]);
});

test("parses empty strings", () => {
	const input = '""';
	const { tokens } = tokenize(input);
	const { ast, error } = parse(tokens);
	expect(error).toBeNull();
	expect(ast.body).toEqual([
		{
			type: "ExpressionStatement",
			expression: {
				type: "StringLiteral",
				value: "",
				loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 3 } },
			},
			loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 3 } },
		},
	]);
});

test("parses composed function calls", () => {
	const input = "foo(bar(), 4)";
	const { tokens } = tokenize(input);
	const { ast, error } = parse(tokens);
	expect(error).toBeNull();
	expect(ast.body).toEqual([
		{
			type: "ExpressionStatement",
			expression: {
				type: "FunctionCallExpression",
				name: {
					type: "Identifier",
					name: "foo",
					loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 4 } },
				},
				args: [
					{
						type: "FunctionCallExpression",
						name: {
							type: "Identifier",
							name: "bar",
							loc: {
								start: { line: 1, column: 5 },
								end: { line: 1, column: 8 },
							},
						},
						args: [],
						loc: {
							start: { line: 1, column: 5 },
							end: { line: 1, column: 10 },
						},
					},
					{
						type: "NumberLiteral",
						value: 4,
						loc: {
							start: { line: 1, column: 12 },
							end: { line: 1, column: 13 },
						},
					},
				],
				loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 14 } },
			},
			loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 14 } },
		},
	]);
});

test("parses multi-line expressions", () => {
	const input = `x :=
  1 +
  2 +
  3`;
	const { tokens } = tokenize(input);
	const { ast, error } = parse(tokens);
	expect(error).toBeNull();
	expect(ast.body).toEqual([
		{
			type: "AssignStatement",
			loc: { start: { line: 1, column: 1 }, end: { line: 4, column: 4 } },
			identifier: {
				type: "Identifier",
				name: "x",
				loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 2 } },
			},
			expression: {
				type: "BinaryExpression",
				left: {
					type: "BinaryExpression",
					left: {
						type: "NumberLiteral",
						value: 1,
						loc: { start: { line: 2, column: 3 }, end: { line: 2, column: 4 } },
					},
					operator: "+",
					right: {
						type: "NumberLiteral",
						value: 2,
						loc: { start: { line: 3, column: 3 }, end: { line: 3, column: 4 } },
					},
					loc: { start: { line: 2, column: 3 }, end: { line: 3, column: 4 } },
				},
				operator: "+",
				right: {
					type: "NumberLiteral",
					value: 3,
					loc: { start: { line: 4, column: 3 }, end: { line: 4, column: 4 } },
				},
				loc: { start: { line: 2, column: 3 }, end: { line: 4, column: 4 } },
			},
		},
	]);
});
