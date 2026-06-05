import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const plugins: any[] = [react()];
  if (mode === "development") {
    plugins.push(componentTagger());
  }

  return {
    server: {
      host: "::",
      port: 8080,
    },
    plugins,
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      target: "es2020",
      minify: "esbuild",
      cssCodeSplit: true,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ["react", "react-dom"],
            router: ["react-router-dom"],
            ui: ["@radix-ui/react-dialog", "@radix-ui/react-dropdown-menu"],
          },
        },
      },
    },
    esbuild: {
      target: "es2020",
    },
  };
});
