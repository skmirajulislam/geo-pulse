import { defineConfig, loadEnv } from "vite";
import preact from "@preact/preset-vite";
import path from "node:path";

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), "");

	return {
		plugins: [preact()],
		resolve: {
			alias: [
				{ find: "@", replacement: path.resolve(__dirname, "src") },
				{ find: "react-dom/test-utils", replacement: "preact/test-utils" },
				{ find: "react-dom", replacement: "preact/compat" },
				{ find: "react", replacement: "preact/compat" },
				{ find: "react/jsx-runtime", replacement: "preact/jsx-runtime" },
			],
		},
		define: {
			"process.env": {
				NODE_ENV: mode,
				REACT_APP_BACKEND_URL: env.REACT_APP_BACKEND_URL || "http://localhost:8080",
				ENABLE_HEALTH_CHECK: env.ENABLE_HEALTH_CHECK || "false",
			},
		},
	};
});
