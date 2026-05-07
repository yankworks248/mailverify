export default {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular'],
      },
      colors: {
        accent: {
          DEFAULT: '#059669',
          hover:   '#047857',
          soft:    '#ecfdf5',
          border:  '#a7f3d0',
        },
      },
      boxShadow: {
        'card':       '0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 3px 0 rgb(0 0 0 / 0.05)',
        'card-hover': '0 4px 12px -2px rgb(0 0 0 / 0.08)',
      },
    },
  },
  plugins: [],
};
