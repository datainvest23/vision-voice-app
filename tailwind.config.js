/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",  // All source files
    "./app/**/*.{js,ts,jsx,tsx,mdx}",  // App directory
    "./components/**/*.{js,ts,jsx,tsx,mdx}",  // Components
    "./pages/**/*.{js,ts,jsx,tsx,mdx}"  // Pages directory
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
    },
  },
  plugins: [],
}; 