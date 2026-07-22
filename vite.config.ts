import { defineConfig } from "vite";

export default defineConfig({
    root: ".",
    build: {
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (id.includes("leafer-game")) {
                        return "leafer";
                    }
                    if (id.includes("@leafer-ui")) {
                        return "leafer-ui";
                    }
                },
            },
        },
        outDir: "dist",
        minify: true,
        sourcemap: false,
    },
    server: {
        port: 5173,
        open: true,
        allowedHosts: ['.monkeycode-ai.online'],
    },
});
