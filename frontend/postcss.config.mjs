// Used by the production build (webpack). The dev server uses Turbopack with @tailwindcss/turbopack (see next.config.mjs).
const config = { plugins: { "@tailwindcss/postcss": {} } };
export default config;
