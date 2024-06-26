import { defineConfig } from "astro/config";
import netlify from "@astrojs/netlify/functions";

// https://astro.build/config
export default defineConfig({
  server: (command) => ({ port: command === "dev" ? 3333 : 8080 }),
  output: "server",
  adapter: netlify(),
  build: {
    sitemap: true,
  },
  site: "https://jeeech.netlify.com/",
});
