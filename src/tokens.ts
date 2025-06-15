type TokenType =
	| "LPAREN"
	| "RPAREN"
	| "COMMA"
	| "COMMENT"
	| "DOT"
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
	| "LOCAL";

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
	// biome-ignore lint:
	then: "THEN",
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
	".": "DOT",
	"+": "PLUS",
	"-": "MINUS",
	"*": "STAR",
	"/": "SLASH",
	"^": "CARET",
	"%": "MOD",
	"!": "NOT",
	">": "GT",
	"<": "LT",
	">=": "GE",
	"<=": "LE",
	"!=": "NE",
	"==": "EQEQ",
	":=": "ASSIGN",
};
