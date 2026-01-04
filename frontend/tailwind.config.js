/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: 'class',
    content: [
        "./app/**/*.{js,ts,tsx,jsx}",
        "./components/**/*.{js,ts,tsx,jsx}",
    ],
    theme: {
        extend: {
            colors: {
                hpe: {
                    DEFAULT: '#01a982', // HPE Emerald
                    dark: '#018f6d',
                }
            }
        },
    },
    plugins: [],
}
