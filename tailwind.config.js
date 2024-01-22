/** @type {import('tailwindcss').Config} */
import headlessui from '@headlessui/tailwindcss'
export default {

  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        /*        backdrop: "rgba(0,0,0,.8)",
                white: "#ffffff",
                greyple: "#99aab5",
                gray: "#76787b",
                darker: "#2c2f33",
                notblack: "#23272a",
                yetnotblack: "#171717",
                menu: "#151515",
                almostblack: "hsla(0, 0%, 10%, 1)",
                black: "hsla(0, 0%, 5%, 1)",*/
        white: "rgb(var(--color-white) / <alpha-value>)",
        blurple: {
          50: "rgb(var(--color-blurple-50) / <alpha-value>)",
          100: "rgb(var(--color-blurple-100) / <alpha-value>)",
          200: "rgb(var(--color-blurple-200) / <alpha-value>)",
          300: "rgb(var(--color-blurple-300) / <alpha-value>)",
          400: "rgb(var(--color-blurple-400) / <alpha-value>)",
          500: "rgb(var(--color-blurple-500) / <alpha-value>)",
          600: "rgb(var(--color-blurple-600) / <alpha-value>)",
          700: "rgb(var(--color-blurple-700) / <alpha-value>)",
          800: "rgb(var(--color-blurple-800) / <alpha-value>)",
          900: "rgb(var(--color-blurple-900) / <alpha-value>)",
        },
        dark: {
          50: "rgb(var(--color-dark-50) / <alpha-value>)",
          100: "rgb(var(--color-dark-100) / <alpha-value>)",
          200: "rgb(var(--color-dark-200) / <alpha-value>)",
          300: "rgb(var(--color-dark-300) / <alpha-value>)",
          400: "rgb(var(--color-dark-400) / <alpha-value>)",
          500: "rgb(var(--color-dark-500) / <alpha-value>)",
          600: "rgb(var(--color-dark-600) / <alpha-value>)",
          700: "rgb(var(--color-dark-700) / <alpha-value>)",
          800: "rgb(var(--color-dark-800) / <alpha-value>)",
          900: "rgb(var(--color-dark-900) / <alpha-value>)",
        },
        redish: {
          50: "rgb(var(--color-redish-50) / <alpha-value>)",
          100: "rgb(var(--color-redish-100) / <alpha-value>)",
          200: "rgb(var(--color-redish-200) / <alpha-value>)",
          300: "rgb(var(--color-redish-300) / <alpha-value>)",
          400: "rgb(var(--color-redish-400) / <alpha-value>)",
          500: "rgb(var(--color-redish-500) / <alpha-value>)",
          600: "rgb(var(--color-redish-600) / <alpha-value>)",
          700: "rgb(var(--color-redish-700) / <alpha-value>)",
          800: "rgb(var(--color-redish-800) / <alpha-value>)",
          900: "rgb(var(--color-redish-900) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: "'Exo 2'",
      },
      boxShadow: {
        switch: 'inset 0 0 5px rgba(0,0,0,.35), 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)'
      }
    },
  },
  plugins: [headlessui()],
}