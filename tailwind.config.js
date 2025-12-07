/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1c1c1a",
        parchment: "#f8f5f0",
        accent: "#b5302f",
        stone: "#ded7cb"
      },
      fontFamily: {
        serif: ["\"Playfair Display\"", "Georgia", "Times New Roman", "serif"],
        sans: ["\"Source Sans Pro\"", "Helvetica Neue", "Helvetica", "Arial", "sans-serif"]
      },
      letterSpacing: {
        wideish: "0.12em"
      },
      boxShadow: {
        editorial: "0 10px 40px rgba(0,0,0,0.08)"
      }
    }
  },
  plugins: []
};
