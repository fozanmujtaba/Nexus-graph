/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ['class'],
    content: [
        './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
        './src/components/**/*.{js,ts,jsx,tsx,mdx}',
        './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            colors: {
                // Primary brand colors - Deep purple to cyan gradient feel
                primary: {
                    50: '#f0f5ff',
                    100: '#e0eaff',
                    200: '#c7d9fe',
                    300: '#a4c0fd',
                    400: '#7a9ff9',
                    500: '#5b7cf3',
                    600: '#4558e7',
                    700: '#3844d4',
                    800: '#3039ab',
                    900: '#2d3687',
                    950: '#1e2252',
                },
                // Accent - Electric cyan
                accent: {
                    50: '#ecfeff',
                    100: '#cffafe',
                    200: '#a5f3fc',
                    300: '#67e8f9',
                    400: '#22d3ee',
                    500: '#06b6d4',
                    600: '#0891b2',
                    700: '#0e7490',
                    800: '#155e75',
                    900: '#164e63',
                    950: '#083344',
                },
                // Glass effect backgrounds
                glass: {
                    light: 'rgba(255, 255, 255, 0.1)',
                    medium: 'rgba(255, 255, 255, 0.15)',
                    heavy: 'rgba(255, 255, 255, 0.25)',
                    dark: 'rgba(0, 0, 0, 0.3)',
                },
                // Status colors
                success: {
                    DEFAULT: '#10b981',
                    light: '#34d399',
                    dark: '#059669',
                },
                warning: {
                    DEFAULT: '#f59e0b',
                    light: '#fbbf24',
                    dark: '#d97706',
                },
                error: {
                    DEFAULT: '#ef4444',
                    light: '#f87171',
                    dark: '#dc2626',
                },
                // Dark theme backgrounds
                surface: {
                    50: '#fafafa',
                    100: '#f4f4f5',
                    200: '#e4e4e7',
                    300: '#d4d4d8',
                    400: '#a1a1aa',
                    500: '#71717a',
                    600: '#52525b',
                    700: '#3f3f46',
                    800: '#27272a',
                    900: '#18181b',
                    950: '#09090b',
                },
            },
            backgroundImage: {
                // Gradient backgrounds
                'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
                'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
                'gradient-mesh': `
          radial-gradient(at 40% 20%, rgba(91, 124, 243, 0.3) 0px, transparent 50%),
          radial-gradient(at 80% 0%, rgba(6, 182, 212, 0.2) 0px, transparent 50%),
          radial-gradient(at 0% 50%, rgba(91, 124, 243, 0.2) 0px, transparent 50%),
          radial-gradient(at 80% 50%, rgba(6, 182, 212, 0.15) 0px, transparent 50%),
          radial-gradient(at 0% 100%, rgba(91, 124, 243, 0.25) 0px, transparent 50%),
          radial-gradient(at 80% 100%, rgba(6, 182, 212, 0.2) 0px, transparent 50%)
        `,
            },
            boxShadow: {
                'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
                'glass-sm': '0 4px 16px 0 rgba(31, 38, 135, 0.2)',
                'glow': '0 0 20px rgba(91, 124, 243, 0.5)',
                'glow-accent': '0 0 20px rgba(6, 182, 212, 0.5)',
                'inner-glow': 'inset 0 0 20px rgba(91, 124, 243, 0.2)',
            },
            backdropBlur: {
                xs: '2px',
            },
            animation: {
                'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
                'slide-up': 'slideUp 0.3s ease-out',
                'slide-down': 'slideDown 0.3s ease-out',
                'fade-in': 'fadeIn 0.3s ease-out',
                'scale-in': 'scaleIn 0.2s ease-out',
                'spin-slow': 'spin 3s linear infinite',
                'float': 'float 6s ease-in-out infinite',
                'shimmer': 'shimmer 2s linear infinite',
            },
            keyframes: {
                pulseGlow: {
                    '0%, 100%': { boxShadow: '0 0 10px rgba(91, 124, 243, 0.3)' },
                    '50%': { boxShadow: '0 0 30px rgba(91, 124, 243, 0.6)' },
                },
                slideUp: {
                    '0%': { transform: 'translateY(10px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
                slideDown: {
                    '0%': { transform: 'translateY(-10px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                scaleIn: {
                    '0%': { transform: 'scale(0.95)', opacity: '0' },
                    '100%': { transform: 'scale(1)', opacity: '1' },
                },
                float: {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-10px)' },
                },
                shimmer: {
                    '0%': { backgroundPosition: '-200% 0' },
                    '100%': { backgroundPosition: '200% 0' },
                },
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
                mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
            },
            borderRadius: {
                '4xl': '2rem',
                '5xl': '2.5rem',
            },
            typography: {
                DEFAULT: {
                    css: {
                        maxWidth: 'none',
                        color: 'rgb(228 228 231)',
                        a: {
                            color: 'rgb(34 211 238)',
                            '&:hover': {
                                color: 'rgb(103 232 249)',
                            },
                        },
                        strong: {
                            color: 'rgb(250 250 250)',
                        },
                        code: {
                            color: 'rgb(103 232 249)',
                            backgroundColor: 'rgb(39 39 42)',
                            borderRadius: '0.25rem',
                            paddingLeft: '0.375rem',
                            paddingRight: '0.375rem',
                            paddingTop: '0.125rem',
                            paddingBottom: '0.125rem',
                        },
                        'code::before': {
                            content: '""',
                        },
                        'code::after': {
                            content: '""',
                        },
                        pre: {
                            backgroundColor: 'rgb(24 24 27)',
                            borderColor: 'rgb(63 63 70)',
                            borderWidth: '1px',
                        },
                        blockquote: {
                            borderLeftColor: 'rgb(91 124 243)',
                            color: 'rgb(161 161 170)',
                        },
                        h1: {
                            color: 'rgb(250 250 250)',
                        },
                        h2: {
                            color: 'rgb(250 250 250)',
                        },
                        h3: {
                            color: 'rgb(250 250 250)',
                        },
                        h4: {
                            color: 'rgb(250 250 250)',
                        },
                    },
                },
            },
        },
    },
    plugins: [
        require('@tailwindcss/typography'),
    ],
};
