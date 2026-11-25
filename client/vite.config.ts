import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin, type ResolvedConfig } from "vite";
import { fileURLToPath } from "node:url";
import { assertSafeViteConfig } from "../scripts/build-safety.mjs";

/** configResolved antecede renderStart/prepareOutDir no Vite 8.3.1. */
function protecaoDoBuild(): Plugin {
  let resolved: ResolvedConfig;
  const origins = [process.cwd(), fileURLToPath(new URL(".", import.meta.url))];
  return {
    name: "obsyrium-protecao-do-build",
    enforce: "pre",
    configResolved(config) {
      resolved = config;
      if (config.command === "build") assertSafeViteConfig(config, origins);
    },
    buildStart: {
      order: "pre",
      handler() {
        if (resolved?.command === "build") {
          assertSafeViteConfig(resolved, origins);
          assertSafeViteConfig(this.environment.config, origins);
        }
      },
    },
  };
}

/**
 * Em desenvolvimento o frontend roda no Vite (porta 5173) e repassa
 * `/api` e `/socket.io` para o backend Node (porta 3000), evitando CORS.
 *
 * Em produção não existe proxy: o Express serve o build do client na mesma
 * origem, então os caminhos relativos continuam funcionando.
 */
export default defineConfig({
  plugins: [protecaoDoBuild(), react()],
  server: {
    host: true, // permite acessar pelo IP da máquina
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:3000", changeOrigin: true },
      "/socket.io": {
        target: "http://localhost:3000",
        ws: true,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
