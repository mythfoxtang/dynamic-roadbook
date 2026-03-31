/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
    "./lib/**/*.{js,jsx}"
  ],
  theme: {
    extend: {
      colors: {
        base: "#121212",
        panel: "#191919",
        panelSoft: "#202020",
        track: "#2b2b2b",
        accent: "#ff7a18",
        accentAlt: "#7c3aed",
        warning: "#ff4d4f",
        success: "#34d399"
      },
      fontFamily: {
        mono: [
          "IBM Plex Mono",
          "JetBrains Mono",
          "SFMono-Regular",
          "ui-monospace",
          "monospace"
        ]
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(255,122,24,0.16), 0 0 32px rgba(124,58,237,0.18)"
      }
    }
  },
  plugins: []
};
