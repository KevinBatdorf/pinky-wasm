import { expect, test } from "vitest";
import { parse } from "./parser";
import type { Token } from "./tokens";

test("should return empty Program with no tokens", () => {
	const result = parse([]);
	expect(result).toEqual({
		type: "Program",
		body: [],
		loc: {
			start: { line: 1, column: 1 },
			end: { line: 1, column: 1 },
		},
	});
});

test("should have the correct location in Program", () => {
	/*
if true then
  print 1
end
*/
	const tokens: Token[] = [
		{ type: "IF", value: "if", line: 1, column: 1, start: 0, end: 2 },
		{ type: "TRUE", value: "true", line: 1, column: 4, start: 3, end: 7 },
		{ type: "THEN", value: "then", line: 1, column: 9, start: 8, end: 12 },
		{ type: "PRINT", value: "print", line: 2, column: 3, start: 15, end: 20 },
		{ type: "NUMBER", value: "1", line: 2, column: 9, start: 21, end: 22 },
		{ type: "END", value: "end", line: 3, column: 1, start: 23, end: 26 },
	];
	const result = parse(tokens);
	expect(result).toEqual({
		type: "Program",
		body: [],
		loc: {
			start: { line: 1, column: 1 },
			end: { line: 3, column: 3 },
		},
	});
});
