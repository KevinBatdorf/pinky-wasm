import { useEffect, useMemo, useRef, useState } from "react";
import type { Token } from "./tokens";
import { CodeEditor } from "./components/Editor";
import example from "./example.pinky";
import { TokensComponent } from "./components/Tokens";
import { tokenize, type TokenErrorType } from "./lexer";
import { parse } from "./parser";
import { ASTComponent } from "./components/AST";
import type { ParseErrorType } from "./parser";
import type { Program, Location } from "./syntax";
import { compile, type CompilerErrorType } from "./compiler";
import { ByteCode } from "./components/ByteCode";
import { loadWasm, type RunFunction } from "./compiler/exports";

console.log("Hey there! 👋 Welcome to the Pinky WASM demo app!");

function App() {
	const [code, setCode] = useState<string>(example);
	const [run, setRun] = useState<RunFunction | null>(null);
	const [hovered, setHoveredToken] = useState<Location | null>(null);
	const isMouseDown = useRef(false);

	useEffect(() => {
		const handleDown = () => {
			isMouseDown.current = true;
			setHoveredToken(null);
		};
		const handleUp = () => {
			isMouseDown.current = false;
		};
		window.addEventListener("mousedown", handleDown);
		window.addEventListener("mouseup", handleUp);
		return () => {
			window.removeEventListener("mousedown", handleDown);
			window.removeEventListener("mouseup", handleUp);
		};
	}, []);

	useEffect(() => {
		loadWasm().then(({ run }) => setRun(() => run));
	}, []);

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
		// console.log({ tokens, error });
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
		// console.log({ ast, error });
		return { ast, perf: performance.now() - now, error };
	}, [tokens]);

	const {
		bytes,
		strings,
		perf: compilerPerf,
		error: compilerError,
	} = useMemo<{
		bytes: Uint8Array<ArrayBufferLike> | null;
		strings: Uint8Array | null;
		perf: number;
		error: CompilerErrorType;
	}>(() => {
		if (!ast) {
			return { bytes: null, strings: null, perf: 0, error: null };
		}
		const now = performance.now();
		const { bytes, meta, error } = compile(ast);
		// console.log({ bytes, meta, error });

		return {
			bytes,
			strings: meta.strings,
			perf: performance.now() - now,
			error,
		};
	}, [ast]);

	const {
		output,
		perf: outputPerf,
		error: outputError,
	} = useMemo<{
		output: string[] | null;
		perf: number;
		error: string | null;
	}>(() => {
		if (
			!run ||
			typeof bytes?.[Symbol.iterator] !== "function" ||
			!bytes.length
		) {
			return { output: null, perf: 0, error: null };
		}
		const now = performance.now();
		try {
			const output = run(bytes);
			return { output, perf: performance.now() - now, error: null };
		} catch (err) {
			return {
				output: null,
				perf: performance.now() - now,
				error: String(err),
			};
		}
	}, [bytes, run]);

	const handleHover = (loc: Location) => {
		// If text is selected or they are selecting, don't bother
		if (isMouseDown.current) return;
		const selection = window.getSelection();
		if (selection?.toString()?.length) return;

		//ignore < 768px
		if (window.innerWidth < 768) {
			// setHoveredToken(null);
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
            md:grid-cols-[1fr_13.55rem_13.55rem]
            lg:grid-cols-[13.55rem_1fr_13.55rem_13.55rem]
            xl:grid-cols-[13.55rem_1fr_0.5fr_13.55rem_13.55rem]

            grid-rows-5
            sm:grid-rows-3
            md:grid-rows-2
            xl:grid-rows-1
            "
				>
					<div
						className="w-full p-1 overflow-hidden flex flex-col h-screen border-gray-800 md:border-r pt-6 md:pt-1
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
							tokenError={tokenError}
							compilerError={compilerError}
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
                md:row-start-2
                "
					>
						<div className="flex items-center justify-between bg-black">
							<span className="">tokens</span>
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
						className="text-sm p-1 overflow-hidden flex flex-col h-screen md:h-full border-gray-800 md:border-r md:border-t lg:border-t-0
                sm:col-start-2
                lg:col-start-3
                lg:col-span-1

                lg:row-span-2
                xl:row-span-1
                md:row-start-1
                "
					>
						<div className="flex items-center justify-between text-sm bg-black">
							<span>output</span>
							<span className="text-xs text-gray-500">
								(wip {outputPerf.toFixed(2)}ms)
							</span>
						</div>
						<pre className="overflow-x-hidden overflow-y-auto">
							{outputError ? (
								<div className="text-wrap text-red-500">{outputError}</div>
							) : (
								<div className="pb-60 whitespace-pre-wrap text-gray-100 break-all">
									{output
										?.join("")
										.split("\n")
										.map((line, i) => (
											<div
												key={`${i}-${line}`}
												className="before:content-['~>'] before:mr-1.5 before:text-gray-500"
											>
												{line}
											</div>
										))}
								</div>
							)}
						</pre>
					</div>
					<div
						className="text-sm p-1 h-screen md:h-full border-gray-800 sm:border-r overflow-hidden flex flex-col
                sm:col-start-1
                md:col-start-3
                lg:col-start-4

                sm:row-start-3
                md:row-start-1
                lg:row-span-1
                "
					>
						<div className="flex items-center justify-between text-sm bg-black">
							<span>ast</span>
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
						className="flex flex-col text-sm p-1 h-screen md:h-full border-gray-800 md:border-t xl:border-t-0 overflow-hidden
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
							<span>wasm bytecode</span>
							<span className="text-xs text-gray-500">
								(wip {compilerPerf.toFixed(2)}ms)
							</span>
						</div>
						<pre className="selection:bg-blue-700 selection:text-white overflow-x-hidden overflow-y-auto flex-grow whitespace-pre-wrap">
							<ByteCode bytes={bytes} strings={strings} error={compilerError} />
						</pre>
					</div>
				</div>
				<div className="w-10 bg-gray-800 md:hidden flex-shrink-0" />
			</div>
		</>
	);
}

export default App;
