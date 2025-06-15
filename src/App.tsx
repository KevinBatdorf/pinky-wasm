import { useMemo, useState } from "react";
import { tokenize } from "./lexer";
import type { Token } from "./tokens";
import { CodeEditor } from "./components/Editor";
import { example } from "./assets/example";
import { Tokens } from "./components/Tokens";

function App() {
	const [code, setCode] = useState<string>(example);
	const [hoveredToken, setHoveredToken] = useState<Token | null>(null);
	const tokens = useMemo<Token[]>(() => {
		try {
			return tokenize(code);
		} catch (error) {
			console.error("Error tokenizing code:", error);
			// TODO: could the lexer handle errors?
			// todo: highlght lines with errors?
			return [];
		}
	}, [code]);

	const handleTokenHover = (token: Token) => {
		setHoveredToken((prev) => (token === prev ? null : token));
	};
	const handleTokenLeave = () => {
		setHoveredToken(null);
	};

	return (
		<div className="flex justify-between max-h-screen overflow-hidden">
			<Tokens
				tokens={tokens}
				// TODO: on click can i highlight the code?
				handleTokenHover={handleTokenHover}
				handleTokenLeave={handleTokenLeave}
			/>
			<div className="flex-grow">
				<div className="pl-4 text-[#FF66C4] font-mono">Pinky</div>
				<CodeEditor token={hoveredToken} value={code} onChange={setCode} />
			</div>
			<div className="mx-4">AST (coming soon)</div>
			<div className="mx-4">output (coming soon)</div>
		</div>
	);
}

export default App;
