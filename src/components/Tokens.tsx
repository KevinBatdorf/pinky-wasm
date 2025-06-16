import type { Token } from "../tokens";
import { useEffect, useMemo, useState } from "react";
import { tokenize } from "../lexer";
type TokensType = {
	code: string;
	handleTokenHover: (token: Token) => void;
	handleTokenLeave: () => void;
	setTokenPerf: (perf: number) => void;
};

export const Tokens = ({
	code,
	handleTokenHover,
	handleTokenLeave,
	setTokenPerf,
}: TokensType) => {
	const { tokens, perf } = useMemo<{ tokens: Token[]; perf: number }>(() => {
		try {
			const now = performance.now();
			const tokens = tokenize(code);
			return { tokens, perf: performance.now() - now };
		} catch (error) {
			console.error("Error tokenizing code:", error);
			// TODO: could the lexer handle errors?
			// todo: highlght lines with errors?
			return { tokens: [], perf: 0 };
		}
	}, [code]);

	useEffect(() => {
		setTokenPerf(perf);
	}, [perf, setTokenPerf]);

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
		</div>
	);
};
