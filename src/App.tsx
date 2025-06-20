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
		//ignore < 768px
		if (window.innerWidth < 768) {
			setHoveredToken(null);
			return;
		}
		setHoveredToken((prev) => {
			const { start, end } = loc;
			if (
				!prev ||
				prev.start.line !== start.line ||
				prev.start.column !== start.column ||
				prev.end.line !== end.line ||
				prev.end.column !== end.column
			) {
				return loc;
			}
			return prev;
		});
	};
	const handleLeave = () => {
		setHoveredToken(null);
	};
	const handleOnChange = (value: string) => {
		setHoveredToken(null);
		setCode(value);
	};
	return (
		<>
			<div className="bg-gray-800 p-6 md:hidden">
				The demo works on mobile, but it's more interactive on desktop.
			</div>
			<div className="flex">
				<div
					className="flex-wrap w-full md:h-screen md:overflow-hidden divide-y-16 md:divide-y-0 divide-gray-800
            grid
            grid-cols-1
            sm:grid-cols-2
            md:grid-cols-[1fr_14rem_14rem]
            lg:grid-cols-[14rem_1fr_14rem_14rem]
            xl:grid-cols-[14rem_1fr_14rem_14rem_14rem]

            grid-rows-5
            sm:grid-rows-3
            md:grid-rows-2
            xl:grid-rows-1
            "
				>
					<div
						className="w-full p-1 overflow-hidden flex flex-col h-screen border-gray-800 md:border-r pt-6 md:pt-0
                sm:col-span-2
                md:col-span-1
                lg:col-start-2

                row-span-1
                md:row-span-2
                lg:row-start-1
                "
					>
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
							onChange={handleOnChange}
						/>
					</div>
					<div
						className="text-sm p-1 flex flex-col overflow-hidden h-screen md:h-full border-gray-800 sm:border-r
                sm:col-start-1
                md:col-start-2
                lg:col-start-1

                row-span-1
                lg:row-span-2
                xl:row-span-1
                md:row-start-1
                "
					>
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
					<div
						className="text-sm p-1 overflow-hidden flex flex-col h-screen md:h-full border-gray-800 md:border-r md:border-t lg:boder-t-0
                sm:col-start-2
                lg:col-start-3
                lg:col-span-1

                lg:row-span-2
                xl:row-span-1
                md:row-start-2
                lg:row-start-1
                "
					>
						<div className="flex items-center justify-between text-sm bg-black">
							<span>AST</span>
							<span className="text-xs text-gray-500">
								({astPerf.toFixed(2)}ms)
							</span>
						</div>
						<div className="selection:bg-blue-500 selection:text-black overflow-x-auto overflow-y-auto">
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
					<div
						className="text-sm p-1 h-screen border-gray-800 sm:border-r
                sm:col-start-1
                md:col-start-3
                lg:col-start-4

                sm:row-start-3
                md:row-start-1
                lg:row-span-1
                "
					>
						<div className="flex items-center justify-between text-sm bg-black">
							<span>wasm bytecode</span>
							<span className="text-xs text-gray-500">(coming soon)</span>
						</div>
					</div>
					<div
						className="text-sm p-1 h-screen border-gray-800 md:border-t xl:border-t-0
                sm:col-start-2
                md:col-start-3
                lg:col-start-4
                xl:col-start-5

                sm:row-start-3
                md:row-start-2
                lg:row-span-1
                "
					>
						<div className="flex items-center justify-between text-sm bg-black">
							<span>output</span>
							<span className="text-xs text-gray-500">(coming soon)</span>
						</div>
					</div>
				</div>
				<div className="w-10 bg-gray-800 md:hidden flex-shrink-0" />
			</div>
		</>
	);
}

export default App;
