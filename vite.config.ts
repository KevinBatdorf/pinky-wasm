import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
	plugins: [
		react(),
		tailwindcss(),
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
});
