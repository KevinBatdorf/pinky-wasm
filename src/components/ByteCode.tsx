import type { CompilerErrorType } from "../compiler";

export const ByteCode = ({
	bytes,
	strings,
	error,
}: {
	bytes: Uint8Array | null;
	strings: Uint8Array | null;
	error: CompilerErrorType | null;
}) => {
	if (!bytes) return null;
	return (
		<div className="flex-grow pb-60">
			<div className="bg-gray-900 p-1 text-xs rounded mb-1 text-gray-400 whitespace-normal">
				{strings ? new TextDecoder().decode(strings) : "No strings available"}
			</div>
			<div className="flex flex-wrap gap-1 text-xs">
				{Array.from(bytes)?.map((byte, i) => (
					<span
						// biome-ignore lint:
						key={i}
						className="px-1 py-0.5 rounded bg-gray-800 text-green-300"
						title={`Byte ${i}`}
					>
						{byte.toString(16).padStart(2, "0")}
					</span>
				))}
			</div>
			{error && <div className="text-red-500 text-wrap">{error.message}</div>}
		</div>
	);
};
