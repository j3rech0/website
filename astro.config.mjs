import { defineConfig } from "astro/config";
import netlify from "@astrojs/netlify/functions";
// import compress from "astro-compress";

// https://astro.build/config
export default defineConfig({
  server: (command) => ({ port: command === "dev" ? 3333 : 8080 }),
  // integrations: [
  //   compress({
  //     logger: 2,
  //     css: true,
  //     html: true,
  //     js: true,
  //     img: true,
  //     svg: true,
  //   }),
  // ],
  output: "server",
  adapter: netlify(),
  site: "https://j3rech0.netlify.app",
});
