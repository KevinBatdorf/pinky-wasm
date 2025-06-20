import { useEffect, useRef } from "react";
import type { Token } from "../tokens";
import type { TokenErrorType } from "../lexer";
import type { Location } from "../syntax";
type TokensType = {
	tokens: Token[];
	error?: TokenErrorType;
	handleHover: (token: Location) => void;
	handleLeave: () => void;
};

export const TokensComponent = ({
	tokens,
	error,
	handleHover,
	handleLeave,
}: TokensType) => {
	const errorRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!errorRef.current || !error) return;
		if (window.innerWidth < 768) return;
		errorRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
	}, [error]);

	if (!tokens.length) return null;

	return (
		<div className="flex-grow pb-60 ">
			{tokens.map((token) => {
				const { line, column, start, type, value } = token;
				return (
					<div
						key={start}
						onMouseEnter={() => {
							if (type === "EOF") return;
							handleHover({
								start: { line, column },
								end: {
									line,
									column:
										value.length + column + 1 + (type === "STRING" ? 1 : -1),
								},
							});
						}}
						onMouseLeave={handleLeave}
						className="w-full text-left grid grid-cols-2 gap-2 cursor-default"
					>
						<span className="flex-shrink-0 text-green-500">{type}</span>
						<span className="text-clip text-blue-200">{value}</span>
					</div>
				);
			})}
			{error && (
				<div ref={errorRef} className="text-red-500 text-wrap">
					{`Error: ${error.message} at line ${error.line}, column ${error.column}`}
				</div>
			)}
		</div>
	);
};
