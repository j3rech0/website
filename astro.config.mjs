import { defineConfig } from "astro/config";
import netlify from '@astrojs/netlify/functions';

// https://astro.build/config
export default defineConfig({
  server: { port: 8080 },
  output: 'server',
  adapter: netlify(),
});
