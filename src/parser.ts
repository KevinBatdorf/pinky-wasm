import type { Program, Statement } from "./syntax";
import type { Token, TokenType } from "./tokens";

type ParserState = { tokens: Token[]; current: number };

const peek = ({ tokens, current }: ParserState): Token => tokens[current];
const advance = (state: ParserState): Token => {
	const token = state.tokens[state.current];
	if (!isEOF(token)) state.current++; // mutate in place
	return token;
};
const isEOF = (token: Token | null): boolean => token?.type === "EOF";
const previous = (state: ParserState): Token | null => {
	const { tokens, current } = state;
	return current > 0 ? tokens[current - 1] : null;
};
const isNextToken = (state: ParserState, type: TokenType): boolean => {
	const { tokens, current } = state;
	return !isEOF(tokens[current]) && tokens[current].type === type;
};
const expectNext = (state: ParserState, type: TokenType): Token => {
	if (isNextToken(state, type)) return advance(state);
	const { tokens, current } = state;
	throw new Error(
		`Expected token type ${type} but found ${tokens[current]?.type}`,
	);
};

export const parse = (tokens: Token[]): Program => ({
	type: "Program",
	body: parseStatements({ tokens, current: 0 }),
	loc: {
		start: { line: 1, column: 1 },
		end: {
			line: tokens?.at(-1)?.line || 1,
			column: tokens?.at(-1)?.column || 1,
		},
	},
});

const parseStatements = ({ tokens, current }: ParserState): Statement[] => {
	//
	console.log(tokens, current);
	return [];
};
