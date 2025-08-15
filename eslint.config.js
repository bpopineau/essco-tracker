import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["dist/**", "build/**", "node_modules/**", "**/*.min.js"] },
  js.configs.recommended,
  {
    files: ["**/*.{js,mjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.browser,
    },
    rules: {
      "no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
        varsIgnorePattern: "^_"          // <-- add this
      }],
      "no-undef": "error",
      "no-empty": ["error", { allowEmptyCatch: true }]
    },
  },
];