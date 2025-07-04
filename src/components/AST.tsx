import { useEffect, useRef } from "react";
import type {
	AST,
	ParseErrorType,
	Expression,
	Location,
	Statement,
} from "pinky-compiler";
type ASTType = {
	ast: AST;
	error?: ParseErrorType;
	handleHover: (token: Location) => void;
	handleLeave: () => void;
};

export const ASTComponent = ({
	ast,
	error,
	handleHover,
	handleLeave,
}: ASTType) => {
	const errorRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		if (!errorRef.current || !error) return;
		if (window.innerWidth < 768) return;
		errorRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
	}, [error]);

	if (!ast.body) return null;
	const randomId = Math.random().toString(36).substring(2, 15);

	return (
		<div className="flex-grow pb-60 cursor-default flex flex-col gap-0.5">
			{ast.body.map((statement, index) => (
				<StatementDisplay
					handleLeave={handleLeave}
					handleHover={handleHover}
					statement={statement}
					key={index + randomId}
				/>
			))}
			{error && (
				<div ref={errorRef} className="text-red-500 text-wrap">
					{`Error: ${error.message} at line ${error.line}, column ${error.column}`}
				</div>
			)}
		</div>
	);
};
const colorsByDepth = [
	"text-sky-600",
	"text-sky-500",
	"text-sky-400",
	"text-sky-300",
	"text-sky-400",
	"text-sky-500",
];
const getColor = (depth: number) => {
	return colorsByDepth[depth % colorsByDepth.length];
};

const StatementDisplay = ({
	statement,
	indent = 0,
	depth = 0,
	handleHover,
	handleLeave,
}: {
	statement: Statement;
	indent?: number;
	depth?: number;
	handleHover: (loc: Location) => void;
	handleLeave: () => void;
}) => {
	const randomId = Math.random().toString(36).substring(2, 15);
	switch (statement.type) {
		case "PrintStatement":
		case "PrintlnStatement":
		case "ExpressionStatement":
			return (
				<div style={{ marginLeft: `${indent * 8}px` }}>
					<div
						onMouseEnter={(e) => {
							e.stopPropagation();
							handleHover(statement.loc);
						}}
						onMouseLeave={handleLeave}
						className={getColor(depth)}
					>
						{statement.type}
					</div>
					<ExpressionDisplay
						expression={statement.expression}
						indent={indent + 1}
						depth={depth + 1}
						handleHover={handleHover}
						handleLeave={handleLeave}
					/>
				</div>
			);
		case "AssignStatement":
			return (
				<div style={{ marginLeft: `${indent * 8}px` }}>
					<div
						className={getColor(depth)}
						onMouseEnter={(e) => {
							e.stopPropagation();
							handleHover(statement.loc);
						}}
						onMouseLeave={handleLeave}
					>
						{statement.type}
					</div>
					<div>
						<ExpressionDisplay
							expression={statement.identifier}
							indent={indent + 1}
							depth={depth + 1}
							handleHover={handleHover}
							handleLeave={handleLeave}
						/>
						<ExpressionDisplay
							expression={statement.expression}
							indent={indent + 1}
							depth={depth + 1}
							handleHover={handleHover}
							handleLeave={handleLeave}
						/>
					</div>
				</div>
			);
		case "IfStatement":
			return (
				<div style={{ marginLeft: `${indent * 8}px` }}>
					<div
						className={getColor(depth)}
						onMouseEnter={(e) => {
							e.stopPropagation();
							handleHover(statement.loc);
						}}
						onMouseLeave={handleLeave}
					>
						{statement.type}
					</div>
					<div style={{ marginLeft: `${(indent + 1) * 8}px` }}>
						<div className={getColor(depth)}>Condition:</div>
						<ExpressionDisplay
							expression={statement.condition}
							indent={indent + 1}
							depth={depth + 1}
							handleHover={handleHover}
							handleLeave={handleLeave}
						/>
						<div className={getColor(depth)}>Then:</div>
						{statement.thenBranch.map((stmt, index) => (
							<StatementDisplay
								handleHover={handleHover}
								handleLeave={handleLeave}
								key={index + randomId}
								statement={stmt}
								indent={indent}
								depth={depth + 1}
							/>
						))}
						{statement?.elifBranches && (
							<>
								<div className={getColor(depth)}>Elif Condition:</div>
								{statement.elifBranches.map((elif, index) => (
									<div key={index + randomId}>
										<ExpressionDisplay
											expression={elif.condition}
											indent={indent + 1}
											depth={depth + 1}
											handleHover={handleHover}
											handleLeave={handleLeave}
										/>
										<div>Elif Then:</div>
										{elif.body.map((stmt, index) => (
											<StatementDisplay
												key={index + randomId}
												statement={stmt}
												indent={indent}
												depth={depth + 1}
												handleHover={handleHover}
												handleLeave={handleLeave}
											/>
										))}
									</div>
								))}
							</>
						)}
						{statement.elseBranch ? (
							<>
								<div className={getColor(depth)}>Else:</div>
								{statement.elseBranch.map((stmt, index) => (
									<StatementDisplay
										key={index + randomId}
										statement={stmt}
										indent={indent}
										depth={depth + 1}
										handleHover={handleHover}
										handleLeave={handleLeave}
									/>
								))}
							</>
						) : null}
					</div>
				</div>
			);
		case "WhileStatement":
			return (
				<div style={{ marginLeft: `${indent * 8}px` }}>
					<div
						className={getColor(depth)}
						onMouseEnter={(e) => {
							e.stopPropagation();
							handleHover(statement.loc);
						}}
						onMouseLeave={handleLeave}
					>
						{statement.type}
					</div>
					<div style={{ marginLeft: `${(indent + 1) * 8}px` }}>
						<div className={getColor(depth)}>Condition:</div>
						<ExpressionDisplay
							expression={statement.condition}
							indent={indent + 1}
							depth={depth + 1}
							handleHover={handleHover}
							handleLeave={handleLeave}
						/>
						<div className={getColor(depth)}>Do:</div>
						{statement.body.map((stmt, index) => (
							<StatementDisplay
								key={index + randomId}
								statement={stmt}
								indent={indent}
								depth={depth + 1}
								handleHover={handleHover}
								handleLeave={handleLeave}
							/>
						))}
					</div>
				</div>
			);
		case "ForStatement":
			return (
				<div style={{ marginLeft: `${indent * 8}px` }}>
					<div
						className={getColor(depth)}
						onMouseEnter={(e) => {
							e.stopPropagation();
							handleHover(statement.loc);
						}}
						onMouseLeave={handleLeave}
					>
						{statement.type}
					</div>
					<div style={{ marginLeft: `${(indent + 1) * 8}px` }}>
						<StatementDisplay
							statement={statement.assignment}
							indent={indent}
							depth={depth + 1}
							handleHover={handleHover}
							handleLeave={handleLeave}
						/>
						<div className={getColor(depth)}>To:</div>
						<ExpressionDisplay
							expression={statement.condition}
							indent={indent + 1}
							depth={depth + 1}
							handleHover={handleHover}
							handleLeave={handleLeave}
						/>
						{statement.increment ? (
							<>
								<div className={getColor(depth)}>Step:</div>
								<ExpressionDisplay
									expression={statement.increment}
									indent={indent + 1}
									depth={depth + 1}
									handleHover={handleHover}
									handleLeave={handleLeave}
								/>
							</>
						) : null}
						<div className={getColor(depth)}>Do:</div>
						{statement.body.map((stmt, index) => (
							<StatementDisplay
								key={index + randomId}
								statement={stmt}
								indent={indent}
								depth={depth + 1}
								handleHover={handleHover}
								handleLeave={handleLeave}
							/>
						))}
					</div>
				</div>
			);
		case "FunctionDeclStatement":
			return (
				<div style={{ marginLeft: `${indent * 8}px` }}>
					<div
						className={getColor(depth)}
						onMouseEnter={(e) => {
							e.stopPropagation();
							handleHover(statement.loc);
						}}
						onMouseLeave={handleLeave}
					>
						{statement.type}
					</div>
					<div style={{ marginLeft: `${(indent + 1) * 8}px` }}>
						<div className={getColor(depth)}>Name:</div>
						<ExpressionDisplay
							expression={statement.name}
							indent={indent + 1}
							depth={depth + 1}
							handleHover={handleHover}
							handleLeave={handleLeave}
						/>
						{statement.params.length ? (
							<>
								<div className={getColor(depth)}>Params:</div>
								{statement.params.map((param, index) => (
									<ExpressionDisplay
										key={index + randomId}
										expression={param}
										indent={indent + 1}
										depth={depth + 1}
										handleHover={handleHover}
										handleLeave={handleLeave}
									/>
								))}
							</>
						) : null}
						<div className={getColor(depth)}>Body:</div>
						{statement.body.map((stmt, index) => (
							<StatementDisplay
								key={index + randomId}
								statement={stmt}
								indent={indent}
								depth={depth + 1}
								handleHover={handleHover}
								handleLeave={handleLeave}
							/>
						))}
					</div>
				</div>
			);
		case "ReturnStatement":
			return (
				<div style={{ marginLeft: `${indent * 8}px` }}>
					<div
						className={getColor(depth)}
						onMouseEnter={(e) => {
							e.stopPropagation();
							handleHover(statement.loc);
						}}
						onMouseLeave={handleLeave}
					>
						{statement.type}
					</div>
					<ExpressionDisplay
						expression={statement.expression}
						indent={indent + 1}
						depth={depth + 1}
						handleHover={handleHover}
						handleLeave={handleLeave}
					/>
				</div>
			);
		case "LocalAssignStatement":
			return (
				<div style={{ marginLeft: `${indent * 8}px` }}>
					<div
						className={getColor(depth)}
						onMouseEnter={(e) => {
							e.stopPropagation();
							handleHover(statement.loc);
						}}
						onMouseLeave={handleLeave}
					>
						{statement.type}
					</div>
					<div>
						<ExpressionDisplay
							expression={statement.identifier}
							indent={indent + 1}
							depth={depth + 1}
							handleHover={handleHover}
							handleLeave={handleLeave}
						/>
						<ExpressionDisplay
							expression={statement.expression}
							indent={indent + 1}
							depth={depth + 1}
							handleHover={handleHover}
							handleLeave={handleLeave}
						/>
					</div>
				</div>
			);
	}
};

const ExpressionDisplay = ({
	expression,
	indent,
	depth,
	handleHover,
	handleLeave,
}: {
	expression: Expression;
	indent: number;
	depth: number;
	handleHover: (loc: Location) => void;
	handleLeave: () => void;
}) => {
	const randomId = Math.random().toString(36).substring(2, 15);
	switch (expression.type) {
		case "StringLiteral":
			return (
				<div
					style={{ marginLeft: `${indent * 8}px` }}
					onMouseEnter={() => handleHover(expression.loc)}
					onMouseLeave={handleLeave}
				>
					<div className={getColor(depth)}>
						<span className="font-sans mr-1">└</span>
						{expression.type}
					</div>
					<div
						style={{ marginLeft: `${indent * 8}px` }}
						className="text-[#A6DA95] mt-1"
					>
						<span className="invisible">└</span> "{expression.value}"
					</div>
				</div>
			);
		case "NumberLiteral":
			return (
				<div
					style={{ marginLeft: `${indent * 8}px` }}
					onMouseEnter={() => handleHover(expression.loc)}
					onMouseLeave={handleLeave}
				>
					<div className={getColor(depth)}>
						<span className="font-sans mr-1">└</span>
						{expression.type}
					</div>
					<div
						style={{ marginLeft: `${indent * 8}px` }}
						className="text-[#F5A97F]"
					>
						<span className="invisible">└</span> {String(expression.value)}
					</div>
				</div>
			);
		case "BooleanLiteral":
			return (
				<div
					style={{ marginLeft: `${indent * 8}px` }}
					onMouseEnter={() => handleHover(expression.loc)}
					onMouseLeave={handleLeave}
				>
					<div className={getColor(depth)}>
						<span className="font-sans mr-1">└</span>
						{expression.type}
					</div>
					<div
						style={{ marginLeft: `${indent * 8}px` }}
						className="text-[#ED8796]"
					>
						<span className="invisible">└</span> {String(expression.value)}
					</div>
				</div>
			);
		case "FunctionCallExpression":
			return (
				<div style={{ marginLeft: `${indent * 8}px` }}>
					<div>
						<div
							className={getColor(depth)}
							onMouseEnter={() => handleHover(expression.loc)}
							onMouseLeave={handleLeave}
						>
							<span className="font-sans mr-1">└</span>
							{expression.type}
						</div>
						<ExpressionDisplay
							expression={expression.name}
							indent={indent}
							depth={depth + 1}
							handleHover={handleHover}
							handleLeave={handleLeave}
						/>
					</div>
					<div style={{ marginLeft: `${indent * 8}px` }} className="">
						{expression.args.map((arg, index) => (
							<ExpressionDisplay
								key={index + randomId}
								expression={arg}
								indent={indent}
								depth={depth + 1}
								handleHover={handleHover}
								handleLeave={handleLeave}
							/>
						))}
					</div>
				</div>
			);
		case "BinaryExpression":
			return (
				<div style={{ marginLeft: `${indent * 8}px` }}>
					<div>
						<div
							className={getColor(depth)}
							onMouseEnter={() => handleHover(expression.loc)}
							onMouseLeave={handleLeave}
						>
							<span className="font-sans mr-1">└</span>
							{expression.type}
						</div>
						<ExpressionDisplay
							expression={expression.left}
							indent={indent}
							depth={depth + 1}
							handleHover={handleHover}
							handleLeave={handleLeave}
						/>
						<div
							style={{ marginLeft: `${indent * 8}px` }}
							className="text-[#8BD5CA] my-1"
						>
							<span className="invisible">└</span> {expression.operator}
						</div>
						<ExpressionDisplay
							expression={expression.right}
							indent={indent}
							depth={depth + 1}
							handleHover={handleHover}
							handleLeave={handleLeave}
						/>
					</div>
				</div>
			);
		case "UnaryExpression":
			return (
				<div style={{ marginLeft: `${indent * 8}px` }}>
					<div
						className={getColor(depth)}
						onMouseEnter={() => handleHover(expression.loc)}
						onMouseLeave={handleLeave}
					>
						<span className="font-sans mr-1">└</span>
						{expression.type}
					</div>
					<div
						style={{ marginLeft: `${indent * 8}px` }}
						className="text-[#8BD5CA] my-1"
					>
						<span className="invisible">└</span> {expression.operator}
					</div>
					<ExpressionDisplay
						expression={expression.argument}
						indent={indent}
						depth={depth + 1}
						handleHover={handleHover}
						handleLeave={handleLeave}
					/>
				</div>
			);
		case "Identifier":
			return (
				<div
					style={{ marginLeft: `${indent * 8}px` }}
					onMouseEnter={() => handleHover(expression.loc)}
					onMouseLeave={handleLeave}
				>
					<div className={getColor(depth)}>
						<span className="font-sans mr-1">└</span>
						{expression.type}
					</div>
					<div
						style={{ marginLeft: `${indent * 8}px` }}
						className="text-[#CAD3F5]"
					>
						<span className="invisible">└</span> {expression.name}
					</div>
				</div>
			);
		case "GroupingExpression":
			return (
				<div style={{ marginLeft: `${indent * 8}px` }}>
					<div
						className={getColor(depth)}
						onMouseEnter={() => handleHover(expression.loc)}
						onMouseLeave={handleLeave}
					>
						<span className="font-sans mr-1">└</span>
						{expression.type}
					</div>
					<ExpressionDisplay
						expression={expression.expression}
						indent={indent}
						depth={depth + 1}
						handleHover={handleHover}
						handleLeave={handleLeave}
					/>
				</div>
			);
	}
};
