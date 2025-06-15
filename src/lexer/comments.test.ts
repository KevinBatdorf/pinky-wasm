import { test, expect } from "vitest";
import { tokenize } from "./lexer";
test("Comments", () => {
	const string = `-- This is a comment
x := 10 -- Inline comment
--- Another comment`;
	const tokens = tokenize(string);
	const tok1 = {
		type: "COMMENT",
		value: "-- This is a comment",
		line: 1,
		column: 1,
		start: 0,
		end: 19,
	};
	const tok2 = {
		type: "COMMENT",
		value: "-- Inline comment",
		line: 2,
		column: 9,
		start: 29,
		end: 45,
	};
	const tok3 = {
		type: "COMMENT",
		value: "--- Another comment",
		line: 3,
		column: 1,
		start: 47,
		end: 65,
	};
	expect(tokens).toEqual(expect.arrayContaining([tok1, tok2, tok3]));
});
