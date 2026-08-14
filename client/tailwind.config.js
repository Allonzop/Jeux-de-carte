/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        felt: {
          900: '#0f261c',
          800: '#143a2a',
          700: '#1b4d38',
        },
        parchment: '#e9e2cf',
        boloss: {
          gold: '#f2c14e',
          red: '#d1495b',
          ink: '#1a1a1a',
        },
      },
      fontFamily: {
        display: ['"Bangers"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 6px 18px rgba(0,0,0,0.45)',
        glow: '0 0 0 3px rgba(242,193,78,0.9), 0 0 22px rgba(242,193,78,0.55)',
        target: '0 0 0 3px rgba(209,73,91,0.95), 0 0 22px rgba(209,73,91,0.55)',
      },
      keyframes: {
        pop: { '0%': { transform: 'scale(0.9)', opacity: '0' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        pulseTarget: { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.55' } },
      },
      animation: {
        pop: 'pop 0.18s ease-out',
        pulseTarget: 'pulseTarget 1.1s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
