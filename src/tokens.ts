export type TokenType =
	| "LPAREN"
	| "RPAREN"
	| "COMMA"
	| "COMMENT"
	| "PLUS"
	| "MINUS"
	| "STAR"
	| "SLASH"
	| "CARET"
	| "MOD"
	| "NOT"
	| "GT"
	| "LT"
	| "GE"
	| "LE"
	| "NE"
	| "EQEQ"
	| "ASSIGN"
	| "IDENTIFIER"
	| "STRING"
	| "NUMBER"
	| "IF"
	| "ELIF"
	| "THEN"
	| "ELSE"
	| "TRUE"
	| "FALSE"
	| "AND"
	| "OR"
	| "WHILE"
	| "DO"
	| "FOR"
	| "FUNC"
	| "END"
	| "PRINT"
	| "PRINTLN"
	| "RET"
	| "LOCAL"
	| "EOF";

export interface Token {
	type: TokenType;
	value: string;
	line: number;
	column: number;
	start: number;
	end: number;
}

export const keywords: { [key: string]: TokenType } = {
	if: "IF",
	// biome-ignore lint: allow using then
	then: "THEN",
	elif: "ELIF",
	else: "ELSE",
	true: "TRUE",
	false: "FALSE",
	and: "AND",
	or: "OR",
	while: "WHILE",
	do: "DO",
	for: "FOR",
	func: "FUNC",
	end: "END",
	print: "PRINT",
	println: "PRINTLN",
	ret: "RET",
	local: "LOCAL",
};

export const tokenTypes: { [key: string]: TokenType } = {
	"(": "LPAREN",
	")": "RPAREN",
	",": "COMMA",
	"+": "PLUS",
	"-": "MINUS",
	"*": "STAR",
	"/": "SLASH",
	"^": "CARET",
	"%": "MOD",
	"~": "NOT",
	">": "GT",
	"<": "LT",
	">=": "GE",
	"<=": "LE",
	"~=": "NE",
	"==": "EQEQ",
	":=": "ASSIGN",
} as const;

export const symbolForTokenType: { [K in TokenType]?: string } =
	Object.fromEntries(
		Object.entries(tokenTypes).map(([symbol, type]) => [type, symbol]),
	);
