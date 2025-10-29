module.exports = {
  root: true,
  env: {
    node: true,
    es2021: true
  },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module"
  },
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended", "prettier"],
  ignorePatterns: ["dist/", "coverage/", "*.d.ts"],
  rules: {
    "@typescript-eslint/consistent-type-imports": "error",
    "no-console": [
      "warn",
      {
        allow: ["warn", "error", "info"]
      }
    ]
  },
  overrides: [
    {
      files: ["*.test.ts", "*.spec.ts"],
      rules: {
        "no-console": "off"
      }
    },
    {
      files: ["cli/src/**/*.ts"],
      rules: {
        "no-console": "off"
      }
    }
  ]
};
