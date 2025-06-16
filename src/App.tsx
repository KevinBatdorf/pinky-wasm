import { useMemo, useState } from "react";
import type { Token } from "./tokens";
import { CodeEditor } from "./components/Editor";
import { example } from "./assets/example";
import { Tokens } from "./components/Tokens";
import { tokenize } from "./lexer";

function App() {
	const [code, setCode] = useState<string>(example);
	const [hoveredToken, setHoveredToken] = useState<Token | null>(null);

	const {
		tokens,
		perf: tokenPerf,
		error: tokenError,
	} = useMemo<{
		tokens: Token[];
		perf: number;
		error: { line: number; column: number; message: string } | null;
	}>(() => {
		const now = performance.now();
		const { tokens, error } = tokenize(code);
		return { tokens, perf: performance.now() - now, error };
	}, [code]);

	const handleTokenHover = (token: Token) => {
		setHoveredToken((prev) => (token === prev ? null : token));
	};
	const handleTokenLeave = () => {
		setHoveredToken(null);
	};

	return (
		<div className="flex justify-between max-h-screen overflow-hidden">
			<div className="flex-shrink text-sm p-1 max-h-screen w-52 border-r border-gray-800 flex flex-col overflow-hidden h-screen">
				<div className="flex items-center justify-between">
					<span className="">Tokens</span>
					<span className="text-xs text-gray-500">
						({tokenPerf.toFixed(2)}ms)
					</span>
				</div>
				<pre className="selection:bg-yellow-500 selection:text-black overflow-x-hidden overflow-y-auto flex-grow">
					<Tokens
						tokens={tokens}
						error={tokenError}
						handleTokenHover={handleTokenHover}
						handleTokenLeave={handleTokenLeave}
					/>
				</pre>
			</div>
			<div className="flex-grow border-r border-gray-800 p-1 overflow-hidden h-screen flex flex-col">
				<div className="flex items-center justify-between text-sm">
					<span className="pl-4 text-[#FF66C4]">Pinky</span>
					<a
						target="_blank"
						rel="noopener noreferrer"
						href="https://github.com/KevinBatdorf/pinky-wasm"
						className="text-xs text-gray-500"
					>
						(GitHub)
					</a>
				</div>
				<CodeEditor
					tokenError={tokenError}
					hoveredToken={hoveredToken}
					value={code}
					onChange={setCode}
				/>
			</div>
			<div className="text-sm border-r border-gray-800 p-1 w-56">
				<div className="flex items-center justify-between text-sm">
					<span>AST</span>
					<span className="text-xs text-gray-500">(coming soon)</span>
				</div>
			</div>
			<div className="text-sm p-1 w-56 border-r border-gray-800">
				<div className="flex items-center justify-between text-sm">
					<span>wasm bytecode</span>
					<span className="text-xs text-gray-500">(coming soon)</span>
				</div>
			</div>
			<div className="text-sm p-1 w-56">
				<div className="flex items-center justify-between text-sm">
					<span>output</span>
					<span className="text-xs text-gray-500">(coming soon)</span>
				</div>
			</div>
		</div>
	);
}

export default App;
