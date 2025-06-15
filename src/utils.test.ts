import { test, expect } from "vitest";
import {
	isAlpha,
	advance,
	isDigit,
	isAlphaNumeric,
	isWhitespace,
	isNewline,
	isEndOfFile,
	peek,
	lookahead,
	match,
} from "./utils";

test("isAlpha", () => {
	expect(isAlpha("a")).toBe(true);
	expect(isAlpha("Z")).toBe(true);
	expect(isAlpha("_")).toBe(true);
	expect(isAlpha("1")).toBe(false);
	expect(isAlpha("$")).toBe(false);
});

test("isDigit", () => {
	expect(isDigit("0")).toBe(true);
	expect(isDigit("9")).toBe(true);
	expect(isDigit("a")).toBe(false);
});

test("isAlphaNumeric", () => {
	expect(isAlphaNumeric("a")).toBe(true);
	expect(isAlphaNumeric("5")).toBe(true);
	expect(isAlphaNumeric("_")).toBe(true);
	expect(isAlphaNumeric("-")).toBe(false);
});

test("isWhitespace", () => {
	expect(isWhitespace(" ")).toBe(true);
	expect(isWhitespace("\t")).toBe(true);
	expect(isWhitespace("\r")).toBe(true);
	expect(isWhitespace("\n")).toBe(false);
	expect(isWhitespace("a")).toBe(false);
});

test("isNewline", () => {
	expect(isNewline("\n")).toBe(true);
	expect(isNewline("\r")).toBe(false);
	expect(isNewline("a")).toBe(false);
});

test("isEndOfFile", () => {
	expect(isEndOfFile("\0")).toBe(true);
	expect(isEndOfFile("\n")).toBe(false);
	expect(isEndOfFile("a")).toBe(false);
});

test("peek", () => {
	const source = "hello";
	expect(peek(source, 0)).toBe("h");
	expect(peek(source, 4)).toBe("o");
	expect(peek(source, 5)).toBe("\0");
});
test("lookahead", () => {
	const source = "hello";
	expect(lookahead(source, 0, 1)).toBe("e");
	expect(lookahead(source, 1, 2)).toBe("l");
	expect(lookahead(source, 3, 1)).toBe("o");
	expect(lookahead(source, 4, 1)).toBe("\0");
	expect(lookahead(source, 5, 1)).toBe("\0"); // Beyond end of file
});

test("match", () => {
	const source = "hello";
	expect(match(source, 0, "h")).toBe(true);
	expect(match(source, 1, "e")).toBe(true);
	expect(match(source, 2, "l")).toBe(true);
	expect(match(source, 3, "l")).toBe(true);
	expect(match(source, 4, "o")).toBe(true);
	expect(match(source, 5, "\0")).toBe(true); // Beyond end of file
	expect(match(source, 0, "x")).toBe(false); // Mismatch
});

test("advance", () => {
	const source = "hello\nworld";
	let position = { line: 1, column: 1, current: 0 };

	// Initial position at the start of the string
	position = advance(source, 0, position.line, position.column);
	expect(position).toEqual({ line: 1, column: 2, current: 1 });

	// Advancing by 1 character
	position = advance(source, 1, position.line, position.column);
	expect(position).toEqual({ line: 1, column: 3, current: 2 });

	// Advancing to the newline character
	position = advance(source, 5, position.line, position.column);
	expect(position).toEqual({ line: 2, column: 1, current: 6 });

	// Advancing to the next character after the newline
	position = advance(source, 6, position.line, position.column);
	expect(position).toEqual({ line: 2, column: 2, current: 7 });
});
