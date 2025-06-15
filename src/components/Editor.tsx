import { useEffect, useRef, useState } from "react";
import Editor from "react-simple-code-editor";
import pinkyGrammar from "../assets/pinky.tmLanguage.json";
import { createHighlighter, type Highlighter } from "shiki";
import type { Token } from "../tokens";

type CodeEditorProps = {
	value: string;
	onChange: (value: string) => void;
	token: Token | null;
};

export const CodeEditor = (props: CodeEditorProps) => {
	const textAreaRef = useRef<HTMLDivElement>(null);
	const [highlighter, setHighlighter] = useState<Highlighter | null>(null);
	const { value, onChange, token, ...remainingProps } = props;

	useEffect(() => {
		createHighlighter({
			langs: [pinkyGrammar],
			themes: ["aurora-x"],
		}).then(setHighlighter);
	}, []);

	if (!highlighter) return null;

	return (
		<div ref={textAreaRef} className="overflow-y-auto h-full">
			<Editor
				autoFocus
				value={value}
				className="h-screen font-jetbrains-mono"
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
							lang: "Pinky",
							theme: "aurora-x",
							decorations: token
								? [
										{
											start: {
												line: token.line - 1,
												character: token.column - 1,
											},
											end: {
												line: token.line - 1,
												character:
													token.value.length +
													token.column +
													(token.type === "STRING" ? 1 : -1),
											},
											properties: { class: "hovered-token" },
										},
									]
								: [],
						})
						?.replace(/<\/?[pre|code][^>]*>/g, "")
				}
			/>
		</div>
	);
};
