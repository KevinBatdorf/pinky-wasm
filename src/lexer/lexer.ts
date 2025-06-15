import { type TokenType, type Token, keywords, tokenTypes } from "../tokens";
import { advance, match, peek } from "../utils";

export const tokenize = (src: string): Token[] => {
	const tokens: Token[] = [];
	let pos = { line: 1, column: 1, current: 0 };

	while (pos.current < src.length) {
		const ch = peek(src, pos.current);
		// console.log(
		// 	`Current char: ${ch}, Line: ${pos.line}, Column: ${pos.column}`,
		// );
		switch (ch) {
			case "-": {
				// Mark the start position
				const start = pos.current;
				const column = pos.column;
				pos = advance(src, pos.current, pos.line, pos.column);
				// Handle comment
				if (match(src, pos.current, "-")) {
					let value = "-";
					while (pos.current < src.length && !match(src, pos.current, "\n")) {
						// consume to the end of the line
						value += peek(src, pos.current);
						pos = advance(src, pos.current, pos.line, pos.column);
					}
					tokens.push({
						type: "COMMENT",
						value,
						line: pos.line,
						column,
						start,
						end: pos.current - 1, // Exclude the newline character
					});
				}
				break;
			}
			default:
				// temporary handling for other characters
				pos = advance(src, pos.current, pos.line, pos.column);
			// throw new Error(
			// 	`Unexpected character '${ch}' at line ${pos.line}, column ${pos.column}`,
			// );
		}
	}
	return tokens;
};
