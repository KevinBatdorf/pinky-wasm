import type { Program, Statement } from "./syntax";
import type { Token } from "./tokens";

export const parse = (tokens: Token[]): Program => {
	const lastToken = tokens.at(-1);
	return {
		type: "Program",
		body: statements(tokens),
		loc: {
			start: { line: 1, column: 1 },
			end: {
				line: lastToken?.line || 1,
				column: lastToken?.value
					? // Count the length of the last token's value
						lastToken.column + lastToken.value.length - 1
					: lastToken?.column || 1,
			},
		},
	};
};

const statements = (tokens: Token[]): Statement[] => {
	//
	console.log(tokens);
	return [];
};
