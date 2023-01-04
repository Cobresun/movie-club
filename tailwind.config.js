module.exports = {
  content: ["./index.html", "./src/**/*.{vue,js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#2196F3",
        highlight: "#6FBAFF",
        secondary: "#394B68",
        background: "#222831",
        lowBackground: "#393E46",
        highlightBackground: "#b1a005",
        text: "#FFFFFF",
      },
      gridTemplateColumns: {
        auto: "repeat( auto-fill, minmax(168px, 1fr) )",
        centerHeader: "1fr auto 1fr",
        leftHeader: "auto 1fr",
      },
      borderWidth: {
        10: "10px",
      },
      fontFamily: {
        default: "'Poppins', sans-serif",
      },
    },
  },
  plugins: [],
};
