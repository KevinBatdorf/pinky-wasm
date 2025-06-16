import { useEffect, useRef } from "react";
import type { Token } from "../tokens";
type TokensType = {
	tokens: Token[];
	error?: { line: number; column: number; message: string } | null;
	handleTokenHover: (token: Token) => void;
	handleTokenLeave: () => void;
};

export const Tokens = ({
	tokens,
	error,
	handleTokenHover,
	handleTokenLeave,
}: TokensType) => {
	const errorRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!errorRef.current || !error) return;
		errorRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
	}, [error]);

	if (!tokens.length) return null;

	return (
		<div className="flex-grow pb-60 ">
			{tokens.map((token) => {
				const { start, type, value } = token;
				return (
					<div
						key={start}
						onMouseEnter={() => handleTokenHover(token)}
						onMouseLeave={handleTokenLeave}
						className="w-full text-left grid grid-cols-2 gap-2 "
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
