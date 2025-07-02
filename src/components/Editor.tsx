import { useMemo, useEffect, useRef, useState } from "react";
import Editor from "react-simple-code-editor";
import pinkyGrammar from "../assets/pinky.tmLanguage.json";
import {
	createHighlighter,
	type DecorationItem,
	type Highlighter,
} from "shiki";
import type {
	Location,
	ParseErrorType,
	TokenErrorType,
	CompilerErrorType,
} from "pinky-compiler";

type CodeEditorProps = {
	value: string;
	onChange: (value: string) => void;
	hovered: Location | null;
	parseError?: ParseErrorType;
	tokenError?: TokenErrorType;
	compilerError?: CompilerErrorType;
};

export const CodeEditor = (props: CodeEditorProps) => {
	const textAreaRef = useRef<HTMLDivElement>(null);
	const [highlighter, setHighlighter] = useState<Highlighter | null>(null);
	const {
		value,
		onChange,
		hovered,
		parseError,
		tokenError,
		compilerError,
		...remainingProps
	} = props;

	const updateCommentedLines = (
		value: string,
		selectionStart: number,
		selectionEnd: number,
	) => {
		const lines = value.split("\n");
		let charCount = 0;
		let newSelectionStart = selectionStart;
		let newSelectionEnd = selectionEnd;

		const newLines = lines.map((line) => {
			const lineStart = charCount;
			const lineEnd = charCount + line.length;

			let newLine = line;
			if (
				// line is within selection
				(selectionStart <= lineEnd && selectionEnd > lineStart) ||
				(selectionStart === selectionEnd &&
					selectionStart >= lineStart &&
					selectionStart <= lineEnd) // single cursor
			) {
				if (line.startsWith("--")) {
					newLine = line.replace(/^--\s?/, "");
					if (selectionStart > lineStart)
						newSelectionStart -= line.length - newLine.length;
					if (selectionEnd > lineStart)
						newSelectionEnd -= line.length - newLine.length;
				} else {
					newLine = `-- ${line}`;
					if (selectionStart > lineStart)
						newSelectionStart += newLine.length - line.length;
					if (selectionEnd > lineStart)
						newSelectionEnd += newLine.length - line.length;
				}
			}
			charCount += line.length + 1; // +1 for \n
			return newLine;
		});

		return {
			newValue: newLines.join("\n"),
			newSelectionStart,
			newSelectionEnd,
		};
	};

	useEffect(() => {
		createHighlighter({
			langs: [pinkyGrammar],
			themes: ["catppuccin-macchiato"],
		}).then(setHighlighter);
	}, []);

	useEffect(() => {
		if (!hovered) return;
		document.querySelector(".hovered-token")?.scrollIntoView({
			behavior: "smooth",
			block: "nearest",
		});
	}, [hovered]);

	const decorations = useMemo<DecorationItem[]>(() => {
		if (!highlighter || !value) return [];
		if (!hovered && !parseError && !tokenError && !compilerError) return [];

		const newDecorations: DecorationItem[] = [];
		if (hovered) {
			const { start, end } = hovered;
			newDecorations.push({
				start: { line: start.line - 1, character: start.column - 1 },
				end: {
					line: end.line - 1,
					character: end.column - 1,
				},
				properties: { class: "hovered-token" },
			});
		}
		if (tokenError) {
			const { line, column } = tokenError;
			newDecorations.push({
				// zero-based index
				start: { line: line - 1, character: column - 1 },
				end: { line: line - 1, character: column },
				properties: { class: "error-token" },
			});
			return newDecorations;
		}
		if (parseError) {
			const line = parseError.line - 1;
			const character = parseError.column - 1;
			const length = parseError.tokenLength || 1;
			newDecorations.push({
				// zero-based index
				start: { line, character },
				end: { line, character: character + length },
				properties: { class: "error-token" },
			});
		}
		if (compilerError) {
			const { line, column, tokenLength } = compilerError;
			newDecorations.push({
				start: { line: line - 1, character: column - 1 },
				end: {
					line: line - 1,
					character: column - 1 + (tokenLength || 1),
				},
				properties: { class: "error-token" },
			});
		}
		return newDecorations;
	}, [hovered, highlighter, parseError, compilerError, value, tokenError]);

	if (!highlighter) return null;

	return (
		<div ref={textAreaRef} className="overflow-y-auto h-full font-mono">
			<Editor
				autoFocus
				value={value}
				onValueChange={onChange}
				onClick={() => onChange(value)}
				onKeyDown={(e) => {
					onChange(value);
					// comment or uncomment if cmd+/ is pressed
					if (e.metaKey && e.key === "/") {
						e.preventDefault();
						const textarea = textAreaRef.current?.querySelector("textarea");
						if (!textarea) return;
						const { selectionStart, selectionEnd } = textarea;
						const { newValue, newSelectionStart, newSelectionEnd } =
							updateCommentedLines(value, selectionStart, selectionEnd);
						onChange(newValue);

						requestAnimationFrame(() => {
							const textarea = textAreaRef.current?.querySelector("textarea");
							if (!textarea) return;
							textarea.selectionStart = newSelectionStart;
							textarea.selectionEnd = newSelectionEnd;
							textarea.focus();
						});
					}
				}}
				{...remainingProps}
				padding={16}
				style={{
					lineHeight: "inherit",
					backgroundColor: "#000",
					overflowY: "auto",
					paddingBottom: "10rem",
					width: "100%",
				}}
				highlight={(code: string) =>
					highlighter
						.codeToHtml(code, {
							lang: "pinky",
							theme: "catppuccin-macchiato",
							decorations,
						})
						?.replace(/<\/?[pre|code][^>]*>/g, "")
				}
			/>
		</div>
	);
};
