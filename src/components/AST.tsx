import { useEffect, useRef } from "react";
import type { AST, ParseErrorType } from "../parser";
import type { Expression, Location, Statement } from "../syntax";
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
		<div className="flex-grow pb-60 cursor-default flex flex-col gap-1.5">
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
	"text-violet-400",
	"text-violet-300",
	"text-violet-200",
	"text-violet-100",
];
const getColor = (depth: number) => {
	return colorsByDepth[depth % colorsByDepth.length];
};

const StatementDisplay = ({
	statement,
	indent = 0,
	handleHover,
	handleLeave,
}: {
	statement: Statement;
	indent?: number;
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
						className={getColor(indent)}
					>
						{statement.type}
					</div>
					<ExpressionDisplay
						expression={statement.expression}
						indent={indent + 1}
						handleHover={handleHover}
						handleLeave={handleLeave}
					/>
				</div>
			);
		case "AssignStatement":
			return (
				<div style={{ marginLeft: `${indent * 8}px` }}>
					<div
						className={getColor(indent)}
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
							handleHover={handleHover}
							handleLeave={handleLeave}
						/>
						<ExpressionDisplay
							expression={statement.expression}
							indent={indent + 1}
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
						className={getColor(indent)}
						onMouseEnter={(e) => {
							e.stopPropagation();
							handleHover(statement.loc);
						}}
						onMouseLeave={handleLeave}
					>
						{statement.type}
					</div>
					<div style={{ marginLeft: `${(indent + 1) * 8}px` }}>
						<div className={getColor(indent)}>Condition:</div>
						<ExpressionDisplay
							expression={statement.condition}
							indent={indent + 1}
							handleHover={handleHover}
							handleLeave={handleLeave}
						/>
						<div className={getColor(indent)}>Then:</div>
						{statement.thenBranch.map((stmt, index) => (
							<StatementDisplay
								handleHover={handleHover}
								handleLeave={handleLeave}
								key={index + randomId}
								statement={stmt}
								indent={indent}
							/>
						))}
						{statement?.elifBranches && (
							<>
								<div className={getColor(indent)}>Elif Condition:</div>
								{statement.elifBranches.map((elif, index) => (
									<div key={index + randomId}>
										<ExpressionDisplay
											expression={elif.condition}
											indent={indent + 1}
											handleHover={handleHover}
											handleLeave={handleLeave}
										/>
										<div>Elif Then:</div>
										{elif.body.map((stmt, index) => (
											<StatementDisplay
												key={index + randomId}
												statement={stmt}
												indent={indent}
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
								<div className={getColor(indent)}>Else:</div>
								{statement.elseBranch.map((stmt, index) => (
									<StatementDisplay
										key={index + randomId}
										statement={stmt}
										indent={indent}
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
						className={getColor(indent)}
						onMouseEnter={(e) => {
							e.stopPropagation();
							handleHover(statement.loc);
						}}
						onMouseLeave={handleLeave}
					>
						{statement.type}
					</div>
					<div style={{ marginLeft: `${(indent + 1) * 8}px` }}>
						<div className={getColor(indent)}>Condition:</div>
						<ExpressionDisplay
							expression={statement.condition}
							indent={indent + 1}
							handleHover={handleHover}
							handleLeave={handleLeave}
						/>
						<div className={getColor(indent)}>Do:</div>
						{statement.body.map((stmt, index) => (
							<StatementDisplay
								key={index + randomId}
								statement={stmt}
								indent={indent}
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
						className={getColor(indent)}
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
							handleHover={handleHover}
							handleLeave={handleLeave}
						/>
						<div className={getColor(indent)}>To:</div>
						<ExpressionDisplay
							expression={statement.condition}
							indent={indent + 1}
							handleHover={handleHover}
							handleLeave={handleLeave}
						/>
						{statement.increment ? (
							<>
								<div className={getColor(indent)}>Step:</div>
								<ExpressionDisplay
									expression={statement.increment}
									indent={indent + 1}
									handleHover={handleHover}
									handleLeave={handleLeave}
								/>
							</>
						) : null}
						<div className={getColor(indent)}>Do:</div>
						{statement.body.map((stmt, index) => (
							<StatementDisplay
								key={index + randomId}
								statement={stmt}
								indent={indent}
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
						className={getColor(indent)}
						onMouseEnter={(e) => {
							e.stopPropagation();
							handleHover(statement.loc);
						}}
						onMouseLeave={handleLeave}
					>
						{statement.type}
					</div>
					<div style={{ marginLeft: `${(indent + 1) * 8}px` }}>
						<div className={getColor(indent)}>Name:</div>
						<ExpressionDisplay
							expression={statement.name}
							indent={indent + 1}
							handleHover={handleHover}
							handleLeave={handleLeave}
						/>
						{statement.params.length ? (
							<>
								<div className={getColor(indent)}>Params:</div>
								{statement.params.map((param, index) => (
									<ExpressionDisplay
										key={index + randomId}
										expression={param}
										indent={indent + 1}
										handleHover={handleHover}
										handleLeave={handleLeave}
									/>
								))}
							</>
						) : null}
						<div className={getColor(indent)}>Body:</div>
						{statement.body.map((stmt, index) => (
							<StatementDisplay
								key={index + randomId}
								statement={stmt}
								indent={indent}
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
						className={getColor(indent)}
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
						handleHover={handleHover}
						handleLeave={handleLeave}
					/>
				</div>
			);
		case "LocalAssignStatement":
			return (
				<div style={{ marginLeft: `${indent * 8}px` }}>
					<div
						className={getColor(indent)}
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
							handleHover={handleHover}
							handleLeave={handleLeave}
						/>
						<ExpressionDisplay
							expression={statement.expression}
							indent={indent + 1}
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
	handleHover,
	handleLeave,
}: {
	expression: Expression;
	indent: number;
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
					<div className={getColor(indent)}>{expression.type}</div>
					<div style={{ marginLeft: `${indent * 8}px` }} className="">
						<span className="text-[#A6DA95]">"{expression.value}"</span>
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
					<div className={getColor(indent)}>{expression.type}</div>
					<div style={{ marginLeft: `${indent * 8}px` }} className="">
						<span className="text-[#F5A97F]">{String(expression.value)}</span>
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
					<div className={getColor(indent)}>{expression.type}</div>
					<div style={{ marginLeft: `${indent * 8}px` }} className="">
						<span className="text-[#ED8796]">{String(expression.value)}</span>
					</div>
				</div>
			);
		case "FunctionCallExpression":
			return (
				<div style={{ marginLeft: `${indent * 8}px` }}>
					<div>
						<div
							className={getColor(indent)}
							onMouseEnter={() => handleHover(expression.loc)}
							onMouseLeave={handleLeave}
						>
							{expression.type}
						</div>
						<ExpressionDisplay
							expression={expression.name}
							indent={indent}
							handleHover={handleHover}
							handleLeave={handleLeave}
						/>
					</div>
					<div style={{ marginLeft: `${indent * 8}px` }} className="">
						{expression.args.length ? (
							<div className={getColor(indent)}>Args:</div>
						) : null}
						{expression.args.map((arg, index) => (
							<ExpressionDisplay
								key={index + randomId}
								expression={arg}
								indent={indent}
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
							className={getColor(indent)}
							onMouseEnter={() => handleHover(expression.loc)}
							onMouseLeave={handleLeave}
						>
							{expression.type}
						</div>
						<ExpressionDisplay
							expression={expression.left}
							indent={indent}
							handleHover={handleHover}
							handleLeave={handleLeave}
						/>
						<div>
							<span className={getColor(indent)}>op:</span>
							<span className="text-[#8BD5CA]"> {expression.operator}</span>
						</div>
						<ExpressionDisplay
							expression={expression.right}
							indent={indent}
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
						className={getColor(indent)}
						onMouseEnter={() => handleHover(expression.loc)}
						onMouseLeave={handleLeave}
					>
						{expression.type}
					</div>
					<div style={{ marginLeft: `${indent * 8}px` }} className="">
						<span className={getColor(indent)}>op:</span>
						<span className="text-[#8BD5CA]"> {expression.operator}</span>
					</div>
					<ExpressionDisplay
						expression={expression.argument}
						indent={indent}
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
					<div className={getColor(indent)}>{expression.type}</div>
					<div
						style={{ marginLeft: `${indent * 8}px` }}
						className="text-[#CAD3F5]"
					>
						{expression.name}
					</div>
				</div>
			);
		case "GroupingExpression":
			return (
				<div style={{ marginLeft: `${indent * 8}px` }}>
					<div
						className={getColor(indent)}
						onMouseEnter={() => handleHover(expression.loc)}
						onMouseLeave={handleLeave}
					>
						{expression.type}
					</div>
					<ExpressionDisplay
						expression={expression.expression}
						indent={indent}
						handleHover={handleHover}
						handleLeave={handleLeave}
					/>
				</div>
			);
	}
};
