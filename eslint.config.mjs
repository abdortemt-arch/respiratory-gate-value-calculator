import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // The domain layer is pure TypeScript: no framework, database or UI imports.
    files: ["src/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["react", "react/*", "react-dom", "next", "next/*"], message: "src/domain must stay framework-free." },
            { group: ["@supabase/*"], message: "src/domain must not access the database." },
            { group: ["@/server/*", "@/app/*", "@/components/*", "@/lib/*"], message: "src/domain must not depend on outer layers." },
          ],
        },
      ],
    },
  },
  {
    // UI components receive data as props; only src/server talks to Supabase.
    files: ["src/components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@/server/*"], message: "Components receive data via props; call server code from routes or actions." },
            { group: ["@supabase/*"], message: "Only src/server talks to Supabase." },
          ],
        },
      ],
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "coverage/**", "playwright-report/**", "test-results/**"]),
]);

export default eslintConfig;
