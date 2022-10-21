import Swup from "swup";
import SwupA11yPlugin from "@swup/a11y-plugin";
import SwupHeadPlugin from "@swup/head-plugin";
import SwupSlideTheme from "@swup/slide-theme";

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(function () {
    const options = { cache: true };
    new Swup({
      plugins: [
        new SwupA11yPlugin(),
        new SwupHeadPlugin(),
        new SwupSlideTheme(),
      ],
      options,
    });
  }, 300);
});

