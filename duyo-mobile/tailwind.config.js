const plugin = require('tailwindcss/plugin');

/**
 * Each Inter weight is its own font family (see src/lib/fonts.ts for why),
 * so a weight utility has to name the family as well as the weight —
 * `font-bold` alone would set fontWeight 700 on the SYSTEM face and Inter
 * would never appear.
 *
 * This lives here rather than in the Text wrapper because NativeWind
 * resolves className below the wrapper, where it cannot be read. The two
 * halves are deliberately exclusive: components/text.tsx supplies a family
 * only when NO weight utility is present.
 *
 * Weights the app does not ship round to the nearest face it does, so a
 * stray `font-extrabold` still looks like the app.
 */
const INTER = {
  thin: 'Inter_400Regular',
  extralight: 'Inter_400Regular',
  light: 'Inter_400Regular',
  normal: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_700Bold',
  black: 'Inter_700Bold',
};
const WEIGHT = {
  thin: '100',
  extralight: '200',
  light: '300',
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
  black: '900',
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  // 'class', not NativeWind's default 'media': the app ships a manual theme
  // switch (settings.tsx) whose state lives in the persisted theme store and is
  // pushed into NativeWind via setColorScheme() in store/theme.ts. Under
  // 'media' that call is illegal — NativeWind throws "Cannot manually set
  // color scheme, as dark mode is type 'media'" and the app fails to boot on
  // web — and the switch could never override the OS setting anyway.
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // DUYO brand palette (Light theme — onboarding)
        'duyo-primary': '#2563EB',
        'duyo-navy': '#102033',
        'duyo-star': '#FFC700',
        'duyo-sky': '#F4F8FF',
        'duyo-success': '#22C55E',
        'duyo-warning': '#FACC15',
        'duyo-crisis': '#EF4444',
        'duyo-white': '#FFFFFF',
        'duyo-muted': '#64748B',
        'tutor-teal': '#006687',

        // Light theme semantic tokens
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

        // Dark theme palette (main app)
        // Surfaces
        'dark-bg-from': '#3C0366', // gradient start (purple)
        'dark-bg-mid': '#510424', // gradient middle (burgundy)
        'dark-bg-to': '#162456', // gradient end (navy)
        'dark-surface': '#132340', // card/header/footer base
        'dark-surface-soft': 'rgba(22, 36, 86, 0.3)', // subtle overlay
        'dark-track': '#364153', // progress bar track
        // Text
        'dark-heading': '#C27AFF', // purple-pink heading
        'dark-subtitle': '#DAB2FF', // light lavender subtitle
        'dark-text': '#E0E7FF', // body text on dark
        'dark-muted': '#94A3B8', // muted gray
        // Neon accents
        'neon-pink': '#FB64B6',
        'neon-magenta': '#E60076',
        'neon-cyan': '#51A2FF',
        'neon-blue': '#60A5FA',
        'neon-purple': '#8200DB',
        'neon-green': '#05DF72',
        'neon-orange': '#FF8904',
        'neon-yellow': '#FDC700',
        'neon-gold': '#D08700',
        // Glow borders
        'glow-purple': '#8200DB',
        'glow-magenta': '#A3004C',
        'glow-orange': '#CA3500',
        'glow-green': '#008236',
        'glow-blue': '#1447E6',
        'glow-pink': '#C6005C',
      },
      borderRadius: {
        sm: '12px',
        md: '14px',
        lg: '16px',
        xl: '20px',
        '2xl': '24px',
      },
    },
  },
  plugins: [
    plugin(({ addUtilities }) => {
      addUtilities(
        Object.fromEntries(
          Object.entries(INTER).map(([name, fontFamily]) => [
            `.font-${name}`,
            { fontFamily, fontWeight: WEIGHT[name] },
          ]),
        ),
      );
    }),
  ],
};
