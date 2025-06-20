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

type CodeEditorProps = {
	value: string;
	onChange: (value: string) => void;
	hovered: Location | null;
	parseError?: ParseErrorType | null;
};

export const CodeEditor = (props: CodeEditorProps) => {
	const textAreaRef = useRef<HTMLDivElement>(null);
	const [highlighter, setHighlighter] = useState<Highlighter | null>(null);
	const { value, onChange, hovered, parseError, ...remainingProps } = props;

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
		if (!hovered && !parseError) return [];

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
		if (parseError) {
			const programEnd = parseError.body.loc.end.column - 1; // minus EOF
			const line = parseError.line - 1; // zero-based index
			let character = parseError.column - 1; // zero-based index
			console.log({ parseError, programEnd, line, character });
			// If the error is at the end of the line, we need to adjust the character position
			if (character >= programEnd) {
				character = programEnd - 1;
			}
			newDecorations.push({
				start: { line, character },
				end: { line, character: character + 1 },
				properties: { class: "error-token" },
			});
		}
		return newDecorations;
	}, [hovered, highlighter, parseError, value]);

	if (!highlighter) return null;

	return (
		<div ref={textAreaRef} className="overflow-y-auto h-full">
			<Editor
				autoFocus
				value={value}
				className="font-jetbrains-mono"
				onValueChange={onChange}
				{...remainingProps}
				padding={16}
				style={{
					fontFamily: "var(--font-mono)",
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
