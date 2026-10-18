import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // This codebase renders icons through a module-level registry of stable
      // lucide component references (`const Icon = getIcon(name)`). The rule
      // cannot see through the registry lookup and reports each usage as a
      // component "created during render", which is not what happens — no
      // component is constructed and no state is reset. The pattern is the
      // documented shadcn/ui approach for data-driven icons.
      "react-hooks/static-components": "off",
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "src/generated/**"]),
]);

export default eslintConfig;
