import { useMemo, useEffect, useRef, useState } from "react";
import Editor from "react-simple-code-editor";
import pinkyGrammar from "../assets/pinky.tmLanguage.json";
import {
	createHighlighter,
	type DecorationItem,
	type Highlighter,
} from "shiki";
import type { Token } from "../tokens";

type CodeEditorProps = {
	value: string;
	onChange: (value: string) => void;
	hoveredToken: Token | null;
	tokenError?: { line: number; column: number; message: string } | null;
};

export const CodeEditor = (props: CodeEditorProps) => {
	const textAreaRef = useRef<HTMLDivElement>(null);
	const [highlighter, setHighlighter] = useState<Highlighter | null>(null);
	const { value, onChange, hoveredToken, tokenError, ...remainingProps } =
		props;

	useEffect(() => {
		createHighlighter({
			langs: [pinkyGrammar],
			themes: ["material-theme-palenight"],
		}).then(setHighlighter);
	}, []);

	useEffect(() => {
		if (!hoveredToken) return;
		document.querySelector(".hovered-token")?.scrollIntoView({
			behavior: "smooth",
			block: "nearest",
		});
	}, [hoveredToken]);

	const decorations = useMemo<DecorationItem[]>(() => {
		if (!highlighter || !value) return [];
		if (!hoveredToken && !tokenError) return [];

		const newDecorations: DecorationItem[] = [];
		if (hoveredToken) {
			const line = hoveredToken.line - 1;
			const character = hoveredToken.column - 1;
			newDecorations.push({
				start: { line, character },
				end: {
					line,
					character:
						hoveredToken.value.length +
						hoveredToken.column +
						(hoveredToken.type === "STRING" ? 1 : -1),
				},
				properties: { class: "hovered-token" },
			});
		}
		if (tokenError) {
			const line = tokenError.line - 1;
			const character = tokenError.column - 1;
			newDecorations.push({
				start: { line, character },
				end: { line, character: character + 1 },
				properties: { class: "error-token" },
			});
		}
		return newDecorations;
	}, [hoveredToken, highlighter, tokenError, value]);

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
							theme: "material-theme-palenight",
							decorations,
						})
						?.replace(/<\/?[pre|code][^>]*>/g, "")
				}
			/>
		</div>
	);
};
