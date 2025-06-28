import { useMemo, useEffect, useRef, useState } from "react";
import Editor from "react-simple-code-editor";
import pinkyGrammar from "../assets/pinky.tmLanguage.json";
import {
	createHighlighter,
	type DecorationItem,
	type Highlighter,
} from "shiki";
import type { Location } from "../syntax";
import type { ParseErrorType } from "../parser";
import type { TokenErrorType } from "../lexer";

type CodeEditorProps = {
	value: string;
	onChange: (value: string) => void;
	hovered: Location | null;
	parseError?: ParseErrorType;
	tokenError?: TokenErrorType;
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
		...remainingProps
	} = props;

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
		if (!hovered && !parseError && !tokenError) return [];

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
		return newDecorations;
	}, [hovered, highlighter, parseError, value, tokenError]);

	if (!highlighter) return null;

	return (
		<div ref={textAreaRef} className="overflow-y-auto h-full font-mono">
			<Editor
				autoFocus
				value={value}
				onValueChange={onChange}
				onClick={() => onChange(value)}
				onKeyDown={() => onChange(value)}
				{...remainingProps}
				padding={16}
				style={{
					lineHeight: "inherit",
					backgroundColor: "#000",
					overflowY: "auto",
					paddingBottom: "10rem",
					width: "100%",
					height: "100%",
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
