export const isAlpha = (char: string): boolean =>
	(char >= "a" && char <= "z") || (char >= "A" && char <= "Z") || char === "_";
export const isDigit = (char: string): boolean => char >= "0" && char <= "9";
export const isAlphaNumeric = (char: string): boolean =>
	isAlpha(char) || isDigit(char);
export const isWhitespace = (char: string): boolean =>
	char === " " || char === "\t" || char === "\r";
export const isNewline = (char: string): boolean => char === "\n";
export const isEndOfFile = (char: string): boolean => char === "\0";

export const peek = (source: string, curr: number): string =>
	curr < source.length ? source[curr] : "\0";
export const lookahead = (source: string, curr: number, n: number): string =>
	curr + n < source.length ? source[curr + n] : "\0";
export const match = (source: string, curr: number, char: string): boolean =>
	peek(source, curr) === char;
export const advance = (
	source: string,
	curr: number,
	line: number,
	column: number,
): {
	line: number;
	column: number;
	current: number;
} => {
	const char = peek(source, curr);
	let nextLine = line;
	let nextColumn = column;
	console.log(
		`Advancing from line ${line}, column ${column}, current index ${curr} with char '${char}'`,
	);
	if (isNewline(char)) {
		nextLine++;
		nextColumn = 1;
	} else {
		nextColumn++;
	}
	return {
		line: nextLine,
		column: nextColumn,
		current: curr + 1,
	};
};
