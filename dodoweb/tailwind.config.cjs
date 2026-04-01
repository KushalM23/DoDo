/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        surface: 'var(--surface)',
        'surface-light': 'var(--surface-light)',
        'surface-elevated': 'var(--surface-elevated)',
        text: 'var(--text)',
        'text-secondary': 'var(--text-secondary)',
        'muted-text': 'var(--muted-text)',
        border: 'var(--border)',
        'border-strong': 'var(--border-strong)',
        accent: 'var(--accent)',
        'accent-light': 'var(--accent-light)',
        danger: 'var(--danger)',
        'danger-light': 'var(--danger-light)',
        success: 'var(--success)',
        'success-light': 'var(--success-light)',
        'high-priority': 'var(--high-priority)',
        'medium-priority': 'var(--medium-priority)',
        'low-priority': 'var(--low-priority)',
        'habit-badge': 'var(--habit-badge)',
        'habit-badge-light': 'var(--habit-badge-light)',
      },
      fontFamily: {
        sans: ['Poppins-Regular', 'sans-serif'],
        'sans-medium': ['Poppins-Medium', 'sans-serif'],
        'sans-semibold': ['Poppins-SemiBold', 'sans-serif'],
        'sans-bold': ['Poppins-Bold', 'sans-serif'],
        display: ['Oswald-Bold', 'sans-serif'],
        'display-semibold': ['Oswald-SemiBold', 'sans-serif'],
        'display-medium': ['Oswald-Medium', 'sans-serif'],
        'display-regular': ['Oswald-Regular', 'sans-serif'],
      },
      boxShadow: {
        panel: '0 24px 60px var(--shadow)',
      },
    },
  },
  plugins: [],
};
