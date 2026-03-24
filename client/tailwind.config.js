/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        void:          '#060610',
        panel:         '#0d0d24',
        'panel-light': '#131330',
        frost:         '#c8d8ff',
        ghost:         '#4a5580',
        'neon-cyan':   '#00d4ff',
        'neon-green':  '#39ff14',
        'neon-orange': '#ff6b35',
        'neon-red':    '#ff2244',
        'neon-gold':   '#ffd700',
        'neon-purple': '#a855f7',
      },
      fontFamily: {
        display: ['Orbitron',         'monospace'],
        body:    ['Rajdhani',         'sans-serif'],
        mono:    ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        'glow-cyan':   '0 0 20px rgba(0,212,255,0.4), 0 0 40px rgba(0,212,255,0.15)',
        'glow-green':  '0 0 20px rgba(57,255,20,0.4), 0 0 40px rgba(57,255,20,0.15)',
        'glow-red':    '0 0 20px rgba(255,34,68,0.4),  0 0 40px rgba(255,34,68,0.15)',
        'glow-orange': '0 0 20px rgba(255,107,53,0.4), 0 0 40px rgba(255,107,53,0.15)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'slide-in':   'slideIn 0.3s ease-out',
        'fade-in':    'fadeIn 0.4s ease-out',
        'score-pop':  'scorePop 0.5s cubic-bezier(0.34,1.56,0.64,1)',
      },
      keyframes: {
        slideIn:  { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        fadeIn:   { from: { opacity: 0 },                               to: { opacity: 1 } },
        scorePop: { '0%': { transform: 'scale(1)' }, '50%': { transform: 'scale(1.08)' }, '100%': { transform: 'scale(1)' } },
      },
    },
  },
  plugins: [],
}