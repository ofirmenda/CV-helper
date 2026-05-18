/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Satoshi', 'Inter', 'system-ui', 'sans-serif'],
        display: ['Satoshi', 'Inter', 'sans-serif'],
        accent: ['Caveat', 'cursive'],
      },
      colors: {
        // Warm near-blacks
        ink: {
          950: '#1a1916',
          900: '#262626',
          700: '#4c4c4c',
          500: '#616161',
          400: '#9a9690',
          300: '#d1d1d1',
        },
        // Warm cream / paper surfaces
        cream: {
          50: '#fefdfa',
          100: '#f5f4f0',
          200: '#e8e4dc',
          300: '#d6d0c4',
        },
        // Soft warm accents (peachy)
        peach: {
          100: '#fef0e8',
          300: '#fad5c2',
          500: '#f07040',
          600: '#d75a2c',
        },
        // Electric accent
        spark: {
          400: '#33adff',
          500: '#0099ff',
          600: '#0085e0',
        },
        // Semantic for matched/partial/missing
        match: {
          green: '#22c55e',
          amber: '#eab308',
          rose: '#ef4444',
        },
      },
      boxShadow: {
        soft: '0 1px 2px rgba(26, 25, 22, 0.04), 0 4px 16px rgba(26, 25, 22, 0.06)',
        card: '0 1px 2px rgba(26, 25, 22, 0.05), 0 8px 24px rgba(26, 25, 22, 0.06)',
        glow: '0 0 0 1px rgba(0, 153, 255, 0.18), 0 6px 24px rgba(0, 153, 255, 0.18)',
        glowPeach: '0 0 0 1px rgba(240, 112, 64, 0.22), 0 6px 24px rgba(240, 112, 64, 0.18)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: 0, transform: 'translateY(6px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};
