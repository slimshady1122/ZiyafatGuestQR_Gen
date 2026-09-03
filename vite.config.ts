import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    https: false,
    allowedHosts: ["footless-recapture-surely.ngrok-free.dev"],
  },
});
