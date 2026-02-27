import { defaultTheme } from "@vuepress/theme-default";
import { searchPlugin } from "@vuepress/plugin-search";
import sidebar from "./sidebar.generated.js";
import navbar from "./navbar.generated.js";

export default {
  lang: "en-US",
  title: "Community SDKs",
  description: "Multi-language community SDKs for popular APIs.",
  base: "/",

  head: [
    ["link", { rel: "icon", href: "/logo.png" }],
  ],

  theme: defaultTheme({
    logo: "/logo.png",
    repo: "community-sdks",
    navbar,
    sidebar,
    editLink: false,
    docsDir: "docs",
    colorMode: "auto",
    colorModeSwitch: true,
  }),

  plugins: [
    searchPlugin({
      // Default is fine, this keeps it simple and fast on GitHub Pages.
      maxSuggestions: 10,
    }),
  ],
};