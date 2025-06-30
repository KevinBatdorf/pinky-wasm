import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
	const hoverTimeout = useRef<number | null>(null);

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

	useEffect(() => {
		// set mobile viewport height once
		document.documentElement.style.setProperty(
			"--app-vh",
			`${window.innerHeight}px`,
		);
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
			astError ||
			compilerError ||
			tokenError ||
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
	}, [bytes, run, astError, compilerError, tokenError]);

	const handleHover = useCallback(
		(loc: Location) => {
			// If text is selected or they are selecting, don't bother
			if (isMouseDown.current) return;
			const selection = window.getSelection();
			if (selection?.toString()?.length) return;

			// If there's an error, don't hover
			if (astError || tokenError || compilerError) {
				return;
			}

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
		},
		[astError, tokenError, compilerError],
	);

	const handleLeave = useCallback(() => {
		setHoveredToken(null);
	}, []);

	// Prevent flyover mouse events from triggering hover
	const debouncedHandleHover = useCallback(
		(loc: Location) => {
			if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
			hoverTimeout.current = window.setTimeout(() => handleHover(loc), 100);
		},
		[handleHover],
	);

	const debouncedHandleLeave = useCallback(() => {
		if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
		handleLeave();
	}, [handleLeave]);
	const handleOnChange = (value: string) => {
		setHoveredToken(null);
		setCode(value);
	};
	return (
		<>
			<div className="bg-gray-800 p-2 px-1 text-sm text-center md:hidden text-gray-400">
				Demo is more interactive on wider screens.
			</div>
			<div className="flex">
				<div
					className="flex-wrap w-full md:h-screen md:overflow-hidden divide-y-16 md:divide-y-0 divide-gray-800
            grid
            grid-cols-1
            sm:grid-cols-2
            md:grid-cols-[1fr_13.55rem_13.55rem]
            lg:grid-cols-[13.55rem_1fr_13.55rem_13.55rem]
            xl:grid-cols-[13.55rem_1fr_0.8fr_13.55rem_13.55rem]

            grid-rows-5
            sm:grid-rows-3
            md:grid-rows-2
            xl:grid-rows-1
            "
				>
					<div
						className="w-full p-1 overflow-hidden flex flex-col h-[var(--app-vh)] md:h-screen border-gray-800 md:border-r pt-6 md:pt-1
                sm:col-span-2
                md:col-span-1
                lg:col-start-2

                row-span-1
                md:row-span-2
                lg:row-start-1
                "
					>
						<div className="flex items-center justify-between text-sm bg-black">
							<div className="pl-4 text-[#FF66C4]">
								Pinky Scripting Language
							</div>
							<div className="flex gap-1.5">
								<a
									href="https://pinky-lang.org/"
									target="_blank"
									rel="noopener noreferrer"
									className="text-xs text-gray-500 hover:text-[#FF66C4] transition-colors duration-200"
								>
									(docs)
								</a>
								<a
									target="_blank"
									rel="noopener noreferrer"
									href="https://github.com/KevinBatdorf/pinky-wasm"
									className="text-xs text-gray-500 hover:text-[#FF66C4] transition-colors duration-200"
								>
									(GitHub)
								</a>
							</div>
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
						className="text-sm p-1 overflow-hidden flex flex-col h-[var(--app-vh)] md:h-full border-gray-800 md:border-r md:border-t lg:border-t-0
                sm:col-start-1
                md:col-start-2
                lg:col-start-3
                lg:col-span-1

                row-span-1
                lg:row-span-2
                xl:row-span-1
                md:row-start-1
                "
					>
						<div className="flex items-center justify-between text-sm bg-black">
							<span>output</span>
							<span className="text-xs text-gray-500">
								({outputPerf.toFixed(2)}ms)
							</span>
						</div>
						<pre className="overflow-x-hidden overflow-y-auto">
							{outputError ? (
								<>
									<div className="text-wrap text-red-500 wrap-break-word">
										{outputError}
									</div>
									<FileIssueLink output={outputError.split("\n")} code={code} />
								</>
							) : (
								<div className="pb-60 whitespace-pre-wrap text-gray-100 wrap-break-word relative">
									{output
										?.join("")
										?.split("\n")
										?.map((line, i) => (
											<div
												key={`${i}-${line}`}
												className="before:content-['~>'] before:text-gray-500 before:absolute before:-left-2 before:w-6 before:text-right ml-6"
											>
												{line === "" ? "\u00A0" : line}
											</div>
										))}
									{output?.join("")?.includes("RuntimeError") ? (
										<FileIssueLink output={output} code={code} />
									) : null}
								</div>
							)}
						</pre>
					</div>
					<div
						className="text-sm p-1 flex flex-col overflow-hidden h-[var(--app-vh)] md:h-full border-gray-800 sm:border-r
                sm:col-start-2
                lg:col-start-1

                row-span-1
                lg:row-span-2
                sm:row-start-2
                lg:row-start-1
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
								handleHover={debouncedHandleHover}
								handleLeave={debouncedHandleLeave}
							/>
						</pre>
					</div>
					<div
						className="text-sm p-1 h-[var(--app-vh)] md:h-full border-gray-800 sm:border-r overflow-hidden flex flex-col
                sm:col-start-1
                md:col-start-3
                lg:col-start-4

                sm:row-start-3
                md:row-start-1
                row-span-1
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
									handleHover={debouncedHandleHover}
									handleLeave={debouncedHandleLeave}
								/>
							)}
						</div>
					</div>
					<div
						className="flex flex-col text-sm p-1 h-[var(--app-vh)] md:h-full border-gray-800 md:border-t xl:border-t-0 overflow-hidden
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
							<span>wasm</span>
							<span className="text-xs text-gray-500">
								({compilerPerf.toFixed(2)}ms)
							</span>
						</div>
						<pre className="selection:bg-blue-700 selection:text-white overflow-x-hidden overflow-y-auto flex-grow whitespace-pre-wrap">
							<ByteCode bytes={bytes} strings={strings} error={compilerError} />
						</pre>
					</div>
					<div className="h-64 bg-gray-800 md:hidden col-span-1 sm:col-span-2" />
				</div>
				<div className="w-9 bg-gray-800 md:hidden flex-shrink-0 relative">
					<div className="h-[var(--app-vh)]">
						<div className="transform origin-right rotate-90 text-gray-400 fixed top-1/2 right-4.5 -translate-y-1/2 flex gap-2 text-md">
							{"<-"} scroll bar {"->"}
						</div>
					</div>
				</div>
			</div>
		</>
	);
}

export default App;

const FileIssueLink = ({
	output,
	code,
}: {
	output: string[];
	code: string;
}) => (
	<div className="mt-4 text-wrap text-stone-400">
		Did you find a bug? Press{" "}
		<a
			target="_blank"
			rel="noopener noreferrer"
			className="text-stone-100 hover:text-stone-300 underline"
			href={`https://github.com/KevinBatdorf/pinky-wasm/issues/new?title=RuntimeError%20encountered&body=${encodeURIComponent(
				[
					"### Error message:",
					output.join("\n"),
					"",
					"### Code:",
					"```pinky",
					code,
					"```",
					"",
					"### Environment:",
					`Browser: ${navigator.userAgent}`,
				].join("\n"),
			)}`}
		>
			here
		</a>{" "}
		to report it.
	</div>
);
