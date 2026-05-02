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
                },
            },
        },
        outDir: "dist",
        minify: true,
        sourcemap: true,
    },
    server: {
        port: 5173,
        open: true,
    },
});
