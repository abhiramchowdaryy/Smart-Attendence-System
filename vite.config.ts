import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Camera + geolocation are same-origin APIs; an explicit Permissions-Policy
// documents intent (mirrors the header the old next.config.mjs set).
const permissionsPolicy = "camera=(self), geolocation=(self)";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "permissions-policy-header",
      configureServer(server) {
        server.middlewares.use((_req, res, next) => {
          res.setHeader("Permissions-Policy", permissionsPolicy);
          next();
        });
      },
      configurePreviewServer(server) {
        server.middlewares.use((_req, res, next) => {
          res.setHeader("Permissions-Policy", permissionsPolicy);
          next();
        });
      },
    },
  ],
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
  server: { port: 3000 },
  preview: { port: 3000 },
});
