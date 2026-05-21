/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          base: '#0A0E27',
          surface: '#111830',
          overlay: 'rgba(255,255,255,0.05)',
        },
        accent: {
          pink: '#E91E8C',
          blue: '#5B63EB',
        },
        brand: {
          border: '#2A3858',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Poppins', 'Outfit', 'sans-serif'],
      },
      borderRadius: {
        sm: '6px',
        md: '10px',
        lg: '16px',
        xl: '24px',
      },
    },
  },
  plugins: [],
};
