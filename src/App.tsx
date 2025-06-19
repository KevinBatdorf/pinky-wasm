import { useMemo, useState } from "react";
import type { Token } from "./tokens";
import { CodeEditor } from "./components/Editor";
import { example } from "./assets/example";
import { TokensComponent } from "./components/Tokens";
import { tokenize, type TokenErrorType } from "./lexer";
import { parse } from "./parser";
import { ASTComponent } from "./components/AST";
import type { ParseErrorType } from "./parser";
import type { Program, Location } from "./syntax";

console.log("Hey there! 👋 Welcome to the Pinky WASM demo app!");

function App() {
	const [code, setCode] = useState<string>(example);
	const [hovered, setHoveredToken] = useState<Location | null>(null);

	const {
		tokens,
		perf: tokenPerf,
		error: tokenError,
	} = useMemo<{
		tokens: Token[];
		perf: number;
		error: TokenErrorType;
	}>(() => {
		const now = performance.now();
		const { tokens, error } = tokenize(code);
		console.log({ tokens, error });
		return { tokens, perf: performance.now() - now, error };
	}, [code]);

	const {
		ast,
		perf: astPerf,
		error: astError,
	} = useMemo<{
		ast: Program | null;
		perf: number;
		error: ParseErrorType;
	}>(() => {
		const now = performance.now();
		const { ast, error } = parse(tokens);
		console.log({ ast, error });
		return { ast, perf: performance.now() - now, error };
	}, [tokens]);

	const handleHover = (loc: Location) => {
		setHoveredToken((prev) => (loc === prev ? null : loc));
	};
	const handleLeave = () => {
		setHoveredToken(null);
	};

	return (
		<div className="flex justify-between h-screen overflow-hidden">
			<div className="text-sm p-1 max-h-screen w-52 border-r border-gray-800 flex flex-col overflow-hidden h-screen flex-shrink-0">
				<div className="flex items-center justify-between bg-black">
					<span className="">Tokens</span>
					<span className="text-xs text-gray-500">
						({tokenPerf.toFixed(2)}ms)
					</span>
				</div>
				<pre className="selection:bg-yellow-500 selection:text-black overflow-x-hidden overflow-y-auto flex-grow">
					<TokensComponent
						tokens={tokens}
						error={tokenError}
						handleHover={handleHover}
						handleLeave={handleLeave}
					/>
				</pre>
			</div>
			<div className="flex-grow border-r border-gray-800 p-1 overflow-hidden h-screen flex flex-col min-w-96">
				<div className="flex items-center justify-between text-sm bg-black">
					<a
						href="https://pinky-lang.org/"
						target="_blank"
						rel="noopener noreferrer"
						className="pl-4 text-[#FF66C4]"
					>
						Pinky Scripting Language
					</a>
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
					parseError={astError}
					hovered={hovered}
					value={code}
					onChange={setCode}
				/>
			</div>
			<div className="text-sm border-r border-gray-800 p-1 w-56 h-screen overflow-hidden flex flex-col flex-shrink-0">
				<div className="flex items-center justify-between text-sm bg-black">
					<span>AST</span>
					<span className="text-xs text-gray-500">
						({astPerf.toFixed(2)}ms)
					</span>
				</div>
				<div className="selection:bg-blue-500 selection:text-black overflow-x-auto overflow-y-auto h-screen">
					{ast && (
						<ASTComponent
							ast={ast}
							error={astError}
							handleHover={handleHover}
							handleLeave={handleLeave}
						/>
					)}
				</div>
			</div>
			<div className="text-sm p-1 w-56 border-r border-gray-800 flex-shrink-0">
				<div className="flex items-center justify-between text-sm bg-black">
					<span>wasm bytecode</span>
					<span className="text-xs text-gray-500">(coming soon)</span>
				</div>
			</div>
			<div className="text-sm p-1 w-56 flex-shrink-0">
				<div className="flex items-center justify-between text-sm bg-black">
					<span>output</span>
					<span className="text-xs text-gray-500">(coming soon)</span>
				</div>
			</div>
		</div>
	);
}

export default App;
