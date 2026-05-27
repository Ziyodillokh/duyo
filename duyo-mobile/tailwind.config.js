/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // DUYO brand palette (source: duyo-web-prototype/src/styles/theme.css)
        'duyo-primary': '#2563EB',
        'duyo-navy': '#102033',
        'duyo-star': '#FFC700',
        'duyo-sky': '#F4F8FF',
        'duyo-success': '#22C55E',
        'duyo-warning': '#FACC15',
        'duyo-crisis': '#EF4444',
        'duyo-white': '#FFFFFF',
        'duyo-muted': '#64748B',

        // Semantic tokens (mirror web prototype semantic layer)
        primary: '#2563EB',
        'primary-foreground': '#FFFFFF',
        secondary: '#F4F8FF',
        'secondary-foreground': '#102033',
        background: '#F4F8FF',
        foreground: '#102033',
        card: '#FFFFFF',
        'card-foreground': '#102033',
        muted: '#E0E7FF',
        'muted-foreground': '#64748B',
        accent: '#FFC700',
        'accent-foreground': '#102033',
        destructive: '#EF4444',
        'destructive-foreground': '#FFFFFF',
        success: '#22C55E',
        'success-foreground': '#FFFFFF',
        warning: '#FACC15',
        'warning-foreground': '#102033',
        border: 'rgba(37, 99, 235, 0.1)',
        ring: '#2563EB',
      },
      borderRadius: {
        sm: '12px',
        md: '14px',
        lg: '16px',
        xl: '20px',
      },
    },
  },
  plugins: [],
};
