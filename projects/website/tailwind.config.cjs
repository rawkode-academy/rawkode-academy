module.exports = {
  content: ["./src/**/*.{astro,html,js,jsx,md,svelte,ts,tsx,vue}"],
  theme: {
    extend: {
      colors: {
        black: withOpacityValue("--color-black"),
        primary: withOpacityValue("--color-primary"),
        secondary: withOpacityValue("--color-secondary"),
      },
    },
  },
  plugins: [],
};

function withOpacityValue(variable) {
  return ({ opacityValue }) => {
    if (opacityValue === undefined) {
      return `rgb(var(${variable}))`;
    }
    return `rgb(var(${variable}) / ${opacityValue})`;
  };
}
