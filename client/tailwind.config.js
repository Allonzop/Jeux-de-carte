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
        floatUp: {
          '0%': { transform: 'translateY(6px) scale(0.8)', opacity: '0' },
          '25%': { transform: 'translateY(-4px) scale(1.1)', opacity: '1' },
          '100%': { transform: 'translateY(-28px) scale(1)', opacity: '0' },
        },
        shake: {
          '0%,100%': { transform: 'translateX(0)' },
          '20%': { transform: 'translateX(-4px)' },
          '40%': { transform: 'translateX(4px)' },
          '60%': { transform: 'translateX(-3px)' },
          '80%': { transform: 'translateX(3px)' },
        },
      },
      animation: {
        pop: 'pop 0.18s ease-out',
        pulseTarget: 'pulseTarget 1.1s ease-in-out infinite',
        floatUp: 'floatUp 0.85s ease-out forwards',
        shake: 'shake 0.35s ease-in-out',
      },
    },
  },
  plugins: [],
};
