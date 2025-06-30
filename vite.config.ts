import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { execSync } from "node:child_process";

// https://vite.dev/config/
export default defineConfig({
	plugins: [
		react(),
		tailwindcss(),
		{
			name: "debug-wat-before-tests",
			enforce: "pre",
			buildStart() {
				try {
					execSync("npm run debug:wat", { stdio: "inherit" });
				} catch (err) {
					console.error(
						"debug:wat failed but continuing test run...\n",
						err.message || err,
					);
				}
			},
		},
		{
			name: "pinky-loader",
			enforce: "pre",
			transform(code, id) {
				if (id.endsWith(".pinky")) {
					return {
						code: `export default ${JSON.stringify(code)}`,
						map: null,
					};
				}
			},
			handleHotUpdate({ file, server }) {
				if (file.endsWith(".pinky")) {
					server.ws.send({ type: "full-reload" });
				}
			},
		},
	],
	test: {
		coverage: {
			reporter: ["text", "json-summary", "json"],
			reportOnFailure: false,
		},
	},
});
