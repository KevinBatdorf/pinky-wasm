import {
	BINARY_OPERATORS,
	UNARY_OPERATORS,
	type BinaryOperator,
	type Expression,
	type Identifier,
	type Program,
	type Statement,
	type UnaryOperator,
} from "./syntax";
import { symbolForTokenType, type Token, type TokenType } from "./tokens";

type ParserState = { tokens: Token[]; current: number };
export type AST = Program;
class ParseError extends Error {
	body: Program;
	line: number;
	column: number;
	tokenLength: number;
	constructor(
		message: string,
		body: Program,
		line: number,
		column: number,
		tokenLength: number,
	) {
		super(message);
		this.name = "ParseError";
		this.body = body;
		this.line = line;
		this.column = column;
		this.tokenLength = tokenLength;
	}
}
export type ParseErrorType = null | ParseError;

/** Peek at the current token without advancing the cursor */
export const peek = ({ tokens, current }: ParserState): Token =>
	tokens[current];
/** Return the current token and advance the cursor */
export const advance = (state: ParserState): Token => {
	const token = state.tokens[state.current];
	if (!isEOF(token)) state.current++; // mutate in place
	return token;
};
/** Check if the current token is of a specific type and advance the cursor */
export const match = (state: ParserState, type: TokenType): boolean => {
	const { tokens, current } = state;
	if (isEOF(tokens[current]) || tokens[current].type !== type) return false;
	advance(state);
	return true;
};
/** Check if the a token is EOF */
export const isEOF = (token: Token | null): boolean => token?.type === "EOF";
/** Return the previous token */
export const previousToken = (state: ParserState): Token => {
	const { tokens, current } = state;
	if (current === 0) throw new Error("No previous token available");
	return tokens[current - 1];
};
/** Check if the next token is of a specific type */
export const isNextToken = (state: ParserState, type: TokenType): boolean => {
	const { tokens, current } = state;
	return !isEOF(tokens[current]) && tokens[current].type === type;
};
/** Check if the next token is of a specific type and advance the cursor */
export const expectNext = (state: ParserState, type: TokenType): Token => {
	if (isNextToken(state, type)) return advance(state);
	const { tokens, current } = state;
	throw new ParseError(
		`Expected token type ${type} but found ${tokens[current]?.type}`,
		makeProgram([], tokens),
		tokens[current]?.line,
		tokens[current]?.column,
		tokens[current]?.value.length || 0,
	);
};

const makeProgram = (body: Statement[], tokens: Token[]): Program => {
	const lastToken = tokens.at(-1);
	return {
		type: "Program",
		body,
		loc: {
			start: { line: 1, column: 1 },
			end: {
				line: lastToken?.line || 1,
				column: (lastToken?.column || 1) + (lastToken?.value.length || 0),
			},
		},
	};
};

const isBinaryOperator = (op: string): op is BinaryOperator =>
	(BINARY_OPERATORS as readonly string[]).includes(op);
export function getBinarySymbol(type: TokenType): BinaryOperator {
	const symbol = symbolForTokenType[type];
	if (symbol === undefined) {
		throw new Error(`No symbol found for TokenType: ${type}`);
	}
	if (!isBinaryOperator(symbol)) {
		throw new Error(
			`TokenType ${type} does not correspond to a binary operator`,
		);
	}
	return symbol;
}
const isUnaryOperator = (op: string): op is UnaryOperator =>
	(UNARY_OPERATORS as readonly string[]).includes(op);
export function getUnarySymbol(type: TokenType): UnaryOperator {
	const symbol = symbolForTokenType[type];
	if (symbol === undefined) {
		throw new Error(`No symbol found for TokenType: ${type}`);
	}
	if (!isUnaryOperator(symbol)) {
		throw new Error(
			`TokenType ${type} does not correspond to a unary operator`,
		);
	}
	return symbol;
}

export const parse = (tokens: Token[]): { ast: AST; error: ParseErrorType } => {
	const state = { tokens, current: 0 };
	try {
		const body = parseStatements(state);
		return { ast: makeProgram(body, tokens), error: null };
	} catch (error) {
		if (error instanceof ParseError) {
			return { ast: error.body, error };
		}
		throw error;
	}
};
const parseStatements = (state: ParserState): Statement[] => {
	const body: Statement[] = [];

	while (
		!isEOF(peek(state)) &&
		!isNextToken(state, "ELSE") &&
		!isNextToken(state, "ELIF") &&
		!isNextToken(state, "END")
	) {
		try {
			if (isNextToken(state, "COMMENT")) {
				advance(state);
				continue;
			}
			body.push(parseStatement(state));
		} catch (err) {
			if (!(err instanceof ParseError)) throw err;
			throw new ParseError(
				err.message,
				makeProgram(body, state.tokens),
				err.line ?? previousToken(state).line,
				err.column ?? previousToken(state).column,
				err.tokenLength ?? previousToken(state).value.length,
			);
		}
	}
	return body;
};

const parseStatement = (state: ParserState): Statement => {
	const token = peek(state);
	switch (token.type) {
		case "PRINT": {
			advance(state);
			const expression = parseExpression(state);
			return {
				type: "PrintStatement",
				loc: {
					start: { line: token.line, column: token.column },
					end: expression.loc.end,
				},
				expression,
			};
		}
		case "PRINTLN": {
			advance(state);
			const expression = parseExpression(state);
			return {
				type: "PrintlnStatement",
				loc: {
					start: { line: token.line, column: token.column },
					end: expression.loc.end,
				},
				expression,
			};
		}
		case "IF": {
			advance(state);
			const condition = parseExpression(state);
			expectNext(state, "THEN");
			const thenBranch = parseStatements(state);
			const elifBranches: { condition: Expression; body: Statement[] }[] = [];
			while (isNextToken(state, "ELIF")) {
				advance(state);
				const elifCondition = parseExpression(state);
				expectNext(state, "THEN");
				const elifBody = parseStatements(state);
				elifBranches.push({ condition: elifCondition, body: elifBody });
			}
			let elseBranch: Statement[] = [];
			if (isNextToken(state, "ELSE")) {
				advance(state);
				elseBranch = parseStatements(state);
			}
			const end = expectNext(state, "END");
			return Object.assign(
				{
					type: "IfStatement" as const,
					condition,
					thenBranch,
					loc: {
						start: { line: token.line, column: token.column },
						end: {
							line: end.line,
							column: end.column + end.value.length,
						},
					},
				},
				elifBranches.length > 0 ? { elifBranches } : {},
				elseBranch.length > 0 ? { elseBranch } : {},
			);
		}
		case "WHILE": {
			advance(state);
			const condition = parseExpression(state);
			expectNext(state, "DO");
			const body = parseStatements(state);
			const end = expectNext(state, "END");
			return {
				type: "WhileStatement",
				condition,
				body,
				loc: {
					start: { line: token.line, column: token.column },
					end: {
						line: end.line,
						column: end.column + end.value.length,
					},
				},
			};
		}
		case "FOR": {
			advance(state);
			if (!isNextToken(state, "IDENTIFIER")) {
				throw new ParseError(
					"Expected identifier after 'for'",
					makeProgram([], state.tokens),
					previousToken(state).line,
					previousToken(state).column,
					previousToken(state).value.length,
				);
			}
			const identifier = parsePrimary(state) as Identifier;
			expectNext(state, "ASSIGN");
			const start = parseExpression(state);
			expectNext(state, "COMMA");
			const condition = parseExpression(state);
			const increment = match(state, "COMMA")
				? parseExpression(state)
				: undefined;
			expectNext(state, "DO");
			const body = parseStatements(state);
			const end = expectNext(state, "END");
			return Object.assign(
				{
					type: "ForStatement" as const,
					assignment: {
						type: "AssignStatement" as const,
						identifier,
						expression: start,
						loc: {
							start: identifier.loc.start,
							end: start.loc.end,
						},
					},
					condition,
					body,
					loc: {
						start: { line: token.line, column: token.column },
						end: {
							line: end.line,
							column: end.column + end.value.length,
						},
					},
				},
				increment ? { increment } : {},
			);
		}
		case "FUNC": {
			advance(state);
			const name = expectNext(state, "IDENTIFIER");
			expectNext(state, "LPAREN");
			const params = [];
			if (!isNextToken(state, "RPAREN")) {
				do {
					if (!isNextToken(state, "IDENTIFIER")) {
						throw new ParseError(
							"Expected identifier in function parameters",
							makeProgram([], state.tokens),
							previousToken(state).line,
							previousToken(state).column,
							previousToken(state).value.length,
						);
					}
					params.push(parsePrimary(state) as Identifier);
				} while (match(state, "COMMA"));
			}
			expectNext(state, "RPAREN");
			const body = parseStatements(state);
			const end = expectNext(state, "END");
			return {
				type: "FunctionDeclStatement",
				name: {
					type: "Identifier",
					name: name.value,
					loc: {
						start: { line: name.line, column: name.column },
						end: { line: name.line, column: name.column + name.value.length },
					},
				},
				params,
				body,
				loc: {
					start: { line: token.line, column: token.column },
					end: {
						line: end.line,
						column: end.column + end.value.length,
					},
				},
			};
		}
		case "RET": {
			advance(state);
			const expression = parseExpression(state);
			return {
				type: "ReturnStatement",
				expression,
				loc: {
					start: { line: token.line, column: token.column },
					end: expression.loc.end,
				},
			};
		}
		case "LOCAL": {
			advance(state);
			if (!isNextToken(state, "IDENTIFIER")) {
				throw new ParseError(
					"Expected identifier after 'local'",
					makeProgram([], state.tokens),
					previousToken(state).line,
					previousToken(state).column,
					previousToken(state).value.length,
				);
			}
			const identifier = parsePrimary(state) as Identifier;
			expectNext(state, "ASSIGN");
			const expression = parseExpression(state);
			return {
				type: "LocalAssignStatement",
				identifier,
				expression,
				loc: {
					start: { line: token.line, column: token.column },
					end: expression.loc.end,
				},
			};
		}
		case "EOF":
			throw new ParseError(
				"Unexpected end of input: expected statement",
				makeProgram([], state.tokens),
				previousToken(state).line,
				previousToken(state).column,
				previousToken(state).value.length,
			);
		default: {
			const left = parseExpression(state);
			if (left.type === "Identifier" && match(state, "ASSIGN")) {
				const right = parseExpression(state);
				return {
					type: "AssignStatement",
					loc: { start: left.loc.start, end: right.loc.end },
					identifier: left,
					expression: right,
				};
			}
			return {
				type: "ExpressionStatement",
				expression: left,
				loc: { start: left.loc.start, end: left.loc.end },
			};
		}
	}
};

// Make our way through the expression grammar
const parseExpression = (state: ParserState): Expression =>
	parseOrLogical(state);

const parseOrLogical = (state: ParserState): Expression => {
	let left = parseAndLogical(state);
	while (match(state, "OR")) {
		const right = parseAndLogical(state);
		left = {
			type: "BinaryExpression",
			left,
			operator: "or",
			right,
			loc: { start: left.loc.start, end: right.loc.end },
		};
	}
	return left;
};
const parseAndLogical = (state: ParserState): Expression => {
	let left = parseEquality(state);
	while (match(state, "AND")) {
		const right = parseEquality(state);
		left = {
			type: "BinaryExpression",
			left,
			operator: "and",
			right,
			loc: { start: left.loc.start, end: right.loc.end },
		};
	}
	return left;
};
const parseEquality = (state: ParserState): Expression => {
	let left = parseComparison(state);
	while (match(state, "EQEQ") || match(state, "NE")) {
		const op = previousToken(state).type;
		const right = parseComparison(state);
		left = {
			type: "BinaryExpression",
			left,
			operator: getBinarySymbol(op),
			right,
			loc: { start: left.loc.start, end: right.loc.end },
		};
	}
	return left;
};
const parseComparison = (state: ParserState): Expression => {
	let left = parseAddition(state);
	while (
		match(state, "GT") ||
		match(state, "LT") ||
		match(state, "GE") ||
		match(state, "LE")
	) {
		const op = previousToken(state).type;
		const right = parseAddition(state);
		left = {
			type: "BinaryExpression",
			left,
			operator: getBinarySymbol(op),
			right,
			loc: { start: left.loc.start, end: right.loc.end },
		};
	}
	return left;
};
const parseAddition = (state: ParserState): Expression => {
	let left = parseMultiplication(state);
	while (match(state, "PLUS") || match(state, "MINUS")) {
		const op = previousToken(state).type;
		const right = parseMultiplication(state);
		left = {
			type: "BinaryExpression",
			left,
			operator: getBinarySymbol(op),
			right,
			loc: { start: left.loc.start, end: right.loc.end },
		};
	}
	return left;
};
const parseMultiplication = (state: ParserState): Expression => {
	let left = parseModulo(state);
	while (match(state, "STAR") || match(state, "SLASH")) {
		const op = previousToken(state).type;
		const right = parseModulo(state);
		left = {
			type: "BinaryExpression",
			left,
			operator: getBinarySymbol(op),
			right,
			loc: { start: left.loc.start, end: right.loc.end },
		};
	}
	return left;
};
const parseModulo = (state: ParserState): Expression => {
	const left = parseUnary(state);
	if (match(state, "MOD")) {
		const op = previousToken(state).type;
		const right = parseUnary(state);
		return {
			type: "BinaryExpression",
			left,
			operator: getBinarySymbol(op),
			right,
			loc: { start: left.loc.start, end: right.loc.end },
		};
	}
	return left;
};
const parseUnary = (state: ParserState): Expression => {
	if (match(state, "PLUS") || match(state, "MINUS") || match(state, "NOT")) {
		const op = previousToken(state);
		const argument = parseUnary(state);
		return {
			type: "UnaryExpression",
			operator: getUnarySymbol(op.type),
			argument,
			loc: {
				start: { line: op.line, column: op.column },
				end: argument.loc.end,
			},
		};
	}
	return parseExponent(state);
};
const parseExponent = (state: ParserState): Expression => {
	let left = parsePrimary(state);
	while (match(state, "CARET")) {
		const operator = previousToken(state).type;
		const right = parsePrimary(state);
		left = {
			type: "BinaryExpression",
			left,
			operator: getBinarySymbol(operator),
			right,
			loc: { start: left.loc.start, end: right.loc.end },
		};
	}
	return left;
};

const parsePrimary = (state: ParserState): Expression => {
	const token = advance(state);
	switch (token?.type) {
		case "NUMBER":
			return {
				type: "NumberLiteral",
				value: Number.parseFloat(token.value),
				loc: {
					start: { line: token.line, column: token.column },
					end: { line: token.line, column: token.column + token.value.length },
				},
			};
		case "TRUE":
		case "FALSE":
			return {
				type: "BooleanLiteral",
				value: token.value === "true",
				loc: {
					start: { line: token.line, column: token.column },
					end: { line: token.line, column: token.column + token.value.length },
				},
			};
		case "STRING":
			return {
				type: "StringLiteral",
				value: token.value,
				loc: {
					start: { line: token.line, column: token.column },
					end: {
						line: token.line,
						column: token.column + token.value.length + 2, // +2 for quotes
					},
				},
			};
		case "LPAREN": {
			const expr = parseExpression(state);
			const rparen = expectNext(state, "RPAREN");
			return {
				type: "GroupingExpression",
				expression: expr,
				loc: {
					start: { line: token.line, column: token.column },
					end: {
						line: rparen.line,
						column: rparen.column + rparen.value.length,
					},
				},
			};
		}
		case "IDENTIFIER": {
			if (match(state, "LPAREN")) {
				// Function call
				const args: Expression[] = [];
				if (!isNextToken(state, "RPAREN")) {
					do {
						args.push(parseExpression(state));
					} while (match(state, "COMMA"));
				}
				const rparen = expectNext(state, "RPAREN");
				return {
					type: "FunctionCallExpression",
					name: {
						type: "Identifier",
						name: token.value,
						loc: {
							start: { line: token.line, column: token.column },
							end: {
								line: token.line,
								column: token.column + token.value.length,
							},
						},
					},
					args,
					loc: {
						start: { line: token.line, column: token.column },
						end: {
							line: rparen.line,
							column: rparen.column + rparen.value.length,
						},
					},
				};
			}
			return {
				type: "Identifier",
				name: token.value,
				loc: {
					start: { line: token.line, column: token.column },
					end: { line: token.line, column: token.column + token.value.length },
				},
			};
		}
		case "EOF":
			throw new ParseError(
				"Unexpected end of input: expected expression",
				makeProgram([], state.tokens),
				previousToken(state).line,
				previousToken(state).column,
				previousToken(state).value.length,
			);
		default: {
			throw new ParseError(
				`Unexpected token type ${token?.type} in expression`,
				makeProgram([], state.tokens),
				previousToken(state).line,
				previousToken(state).column,
				previousToken(state).value.length,
			);
		}
	}
};
