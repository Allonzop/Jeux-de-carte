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

        /* --- Écran de chargement ------------------------------------- */
        introGlow: { '0%,100%': { opacity: '0.35' }, '50%': { opacity: '0.8' } },
        introIdle: { '0%,100%': { transform: 'scale(0.5)' }, '50%': { transform: 'scale(0.53)' } },
        shockwave: {
          '0%': { transform: 'scale(0.35)', opacity: '0.85' },
          '100%': { transform: 'scale(1.7)', opacity: '0' },
        },

        /* --- Game feel : vie des cartes ------------------------------- */
        // Pioche : la carte est distribuée par le bas, avec un léger dépassement.
        dealIn: {
          '0%': { transform: 'translateY(64px) scale(0.6) rotate(-9deg)', opacity: '0' },
          '60%': { transform: 'translateY(-7px) scale(1.05) rotate(1.5deg)', opacity: '1' },
          '100%': { transform: 'none', opacity: '1' },
        },
        // Pose sur le plateau : la carte s'écrase depuis le haut.
        slamIn: {
          '0%': { transform: 'translateY(-40px) scale(1.65)', opacity: '0', filter: 'blur(6px)' },
          '55%': { transform: 'translateY(0) scale(0.9)', opacity: '1', filter: 'blur(0)' },
          '76%': { transform: 'scale(1.07)' },
          '100%': { transform: 'none' },
        },
        // Attaque : petit recul, puis charge vers l'adversaire.
        lungeUp: {
          '0%,100%': { transform: 'translateY(0)' },
          '22%': { transform: 'translateY(9px) scale(0.95)' },
          '52%': { transform: 'translateY(-32px) scale(1.12)' },
        },
        lungeDown: {
          '0%,100%': { transform: 'translateY(0)' },
          '22%': { transform: 'translateY(-9px) scale(0.95)' },
          '52%': { transform: 'translateY(32px) scale(1.12)' },
        },
        // Mort : la carte se fige, blanchit et part au cimetière.
        deathPuff: {
          '0%': { transform: 'none', opacity: '1' },
          '28%': { transform: 'scale(1.09) rotate(-4deg)', opacity: '1', filter: 'grayscale(1) brightness(1.7)' },
          '100%': {
            transform: 'scale(0.5) rotate(16deg) translateY(22px)',
            opacity: '0',
            filter: 'grayscale(1) brightness(0.6)',
          },
        },
        // Éclair doré au moment précis où la carte touche le plateau.
        slamFlash: {
          '0%,44%': { opacity: '0' },
          '58%': { opacity: '0.85' },
          '100%': { opacity: '0' },
        },
        // Bandeau « À toi de jouer » qui balaie l'écran.
        turnBanner: {
          '0%': { transform: 'translateX(-55%)', opacity: '0' },
          '16%': { transform: 'translateX(0)', opacity: '1' },
          '74%': { transform: 'translateX(0)', opacity: '1' },
          '100%': { transform: 'translateX(55%)', opacity: '0' },
        },
      },
      animation: {
        pop: 'pop 0.18s ease-out',
        pulseTarget: 'pulseTarget 1.1s ease-in-out infinite',
        floatUp: 'floatUp 0.85s ease-out forwards',
        shake: 'shake 0.35s ease-in-out',
        introGlow: 'introGlow 3s ease-in-out infinite',
        introIdle: 'introIdle 2.2s ease-in-out infinite',
        shockwave: 'shockwave 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        dealIn: 'dealIn 0.42s cubic-bezier(0.22, 1.2, 0.36, 1) both',
        slamIn: 'slamIn 0.42s cubic-bezier(0.2, 0.9, 0.25, 1) both',
        lungeUp: 'lungeUp 0.45s cubic-bezier(0.3, 0.9, 0.3, 1)',
        lungeDown: 'lungeDown 0.45s cubic-bezier(0.3, 0.9, 0.3, 1)',
        deathPuff: 'deathPuff 0.45s ease-in forwards',
        slamFlash: 'slamFlash 0.42s ease-out both',
        turnBanner: 'turnBanner 1.6s cubic-bezier(0.22, 1, 0.36, 1) forwards',
      },
    },
  },
  plugins: [],
};
