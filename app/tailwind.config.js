module.exports = {
  content: ["./App.tsx", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        canvas: "rgb(var(--canvas) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        accent: "rgb(var(--accent) / <alpha-value>)",
        lilac: "rgb(var(--lilac) / <alpha-value>)",
        peach: "rgb(var(--peach) / <alpha-value>)",
        edge: "rgb(var(--edge) / <alpha-value>)",
        balance: "rgb(var(--balance) / <alpha-value>)",
        blue: "#3769ff",
      },
    },
  },
  plugins: [],
};
