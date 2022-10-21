import { defineConfig } from "astro/config";
import netlify from "@astrojs/netlify/functions";
import compress from "astro-compress";

// https://astro.build/config
export default defineConfig({
  server: (command) => ({ port: command === "dev" ? 3333 : 8080 }),
  integrations: [compress()],
  output: "server",
  adapter: netlify(),
  build: {
    sitemap: true,
  },
  site: "https://jerecho.com",
});
