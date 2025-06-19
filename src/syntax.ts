type Position = {
	line: number;
	column: number;
};
export type Location = {
	start: Position;
	end: Position;
};

export type Node = {
	type: string;
	loc: Location;
};

export type ErrorNode = {
	type: "ErrorNode";
	message: string;
	loc: Location;
};

export type Statement =
	| ExpressionStatement
	| PrintStatement
	| AssignStatement
	| LocalAssignStatement
	| PrintlnStatement
	| IfStatement
	| WhileStatement
	| ForStatement
	| FunctionDeclStatement
	| ReturnStatement;

export type Expression =
	| BinaryExpression
	| UnaryExpression
	| Literal
	| Identifier
	| FunctionCallExpression
	| GroupingExpression;

export const BINARY_OPERATORS = [
	"+",
	"-",
	"*",
	"/",
	"%",
	"^",
	"==",
	"~=",
	">",
	">=",
	"<",
	"<=",
	"and",
	"or",
] as const;
export type BinaryOperator = (typeof BINARY_OPERATORS)[number];

export const UNARY_OPERATORS = ["+", "-", "~"] as const;
export type UnaryOperator = (typeof UNARY_OPERATORS)[number];

/** <program> ::= <stmts> */
export type Program = Node & {
	type: "Program";
	body: Statement[];
};

/** <expr_stmt> ::= <expr> */
export type ExpressionStatement = Node & {
	type: "ExpressionStatement";
	expression: Expression;
};

/** <assign> ::= <identifier> "=" <expr> */
export type AssignStatement = Node & {
	type: "AssignStatement";
	identifier: Identifier;
	expression: Expression;
};

/** <local_assign> ::= "local" <assign> */
export type LocalAssignStatement = Node & {
	type: "LocalAssignStatement";
	identifier: Identifier;
	expression: Expression;
};

/** <print_stmt> ::= "print" <expr> */
export type PrintStatement = Node & {
	type: "PrintStatement";
	expression: Expression;
};

/** <println_stmt> ::= "println" <expr> */
export type PrintlnStatement = Node & {
	type: "PrintlnStatement";
	expression: Expression;
};

// if_stmt  ::= 'if' expr 'then' stmts
//              ( 'elif' expr 'then' stmts )*
//              ( 'else' stmts )? 'end'
export type IfStatement = Node & {
	type: "IfStatement";
	condition: Expression;
	thenBranch: Statement[];
	elifBranches?: {
		condition: Expression;
		body: Statement[];
	}[];
	elseBranch?: Statement[];
};

/** <while_stmt> ::= "while" <expr> "do" <stmts> "end" */
export type WhileStatement = Node & {
	type: "WhileStatement";
	condition: Expression;
	body: Statement[];
};

/** <for_stmt> ::= "for" <assign> "," <expr> ( "," <expr>)? "do" <stmts> "end" */
export type ForStatement = Node & {
	type: "ForStatement";
	assignment: AssignStatement;
	condition: Expression;
	increment?: Expression;
	body: Statement[];
};

/** <func_decl> ::= "func" <func_name> "(" [<identifier> ("," <identifier>)*] ")" "do" <stmts> "end"  */
export type FunctionDeclStatement = Node & {
	type: "FunctionDeclStatement";
	name: Identifier;
	params: Identifier[];
	body: Statement[];
};

/** <func_call> ::= <func_name> "(" <args>? ")" */
export type FunctionCallExpression = Node & {
	type: "FunctionCallExpression";
	name: Identifier;
	args: Expression[];
};

/** <ret_stmt> ::= "ret" <expr> */
export type ReturnStatement = Node & {
	type: "ReturnStatement";
	expression: Expression;
};

/** <binary_expr> ::= <expr> <operator> <expr> */
export type BinaryExpression = Node & {
	type: "BinaryExpression";
	operator: BinaryOperator;
	left: Expression;
	right: Expression;
};

/** <unary_expr> ::= <operator> <expr> */
export type UnaryExpression = Node & {
	type: "UnaryExpression";
	operator: UnaryOperator;
	argument: Expression;
};

/** <literal> ::= <bool> | <integer> | "<float>" | "string" */
export type Literal = NumberLiteral | StringLiteral | BooleanLiteral;

/** <number> ::= <integer> | <float> */
export type NumberLiteral = Node & {
	type: "NumberLiteral";
	value: number;
};

/** <string> ::= '"' <string_content>? '"' | "'" <string_content>? "'" */
export type StringLiteral = Node & {
	type: "StringLiteral";
	value: string;
};

/** <bool> ::= "true" | "false" */
export type BooleanLiteral = Node & {
	type: "BooleanLiteral";
	value: boolean;
};

/** <identifier> ::= <alpha> <alnum>* */
export type Identifier = Node & {
	type: "Identifier";
	name: string;
};

/** <grouping> ::= "(" <expr> ")" */
export type GroupingExpression = Node & {
	type: "GroupingExpression";
	expression: Expression;
};
