import type { Token } from "../tokens";

type TokensType = {
	tokens: Token[];
	handleTokenHover: (token: Token) => void;
	handleTokenLeave: () => void;
};

export const Tokens = ({
	tokens,
	handleTokenHover,
	handleTokenLeave,
}: TokensType) => (
	<pre className="flex-shrink text-sm p-1 font-mono max-h-screen w-52 border-r border-gray-800 selection:bg-yellow-500 selection:text-black flex flex-col h-full">
		<span className="">Tokens</span>
		<div className="overflow-x-hidden overflow-y-auto flex-grow pb-60 ">
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
	</pre>
);
