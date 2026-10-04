import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Checks a static export before it is published: the 404 page exists and every absolute asset
 * or link in the home page starts with the base path the site is served under.
 *
 * @param outDir Folder holding the static export.
 * @param basePath Path the site is served under, such as /album-wall, or "" for the root.
 * @returns One message per problem; empty when the export looks right.
 */
export function findOutputProblems(outDir: string, basePath: string): string[] {
  const problems: string[] = [];

  if (!existsSync(join(outDir, "404.html"))) problems.push("404.html is missing from the build.");

  const indexPath = join(outDir, "index.html");
  if (!existsSync(indexPath)) {
    problems.push("index.html is missing from the build.");
    return problems;
  }

  if (basePath) {
    const html = readFileSync(indexPath, "utf8");
    const wrong = new Set<string>();
    for (const match of html.matchAll(/\b(?:src|href)="(\/[^"/][^"]*|\/)"/g)) {
      const target = match[1] ?? "";
      if (target !== basePath && !target.startsWith(`${basePath}/`)) wrong.add(target);
    }
    for (const target of [...wrong].slice(0, 5)) {
      problems.push(`index.html points at ${target}, outside the base path ${basePath}.`);
    }
    if (!html.includes(`"${basePath}/_next/`)) {
      problems.push(`index.html has no assets under ${basePath}/_next/.`);
    }
  }

  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const problems = findOutputProblems("out", process.env.NEXT_PUBLIC_BASE_PATH?.trim() ?? "");
  if (problems.length > 0) {
    console.error("The static build output is not ready to publish:");
    for (const problem of problems) console.error(`- ${problem}`);
    process.exit(1);
  }
  console.log("Static build output looks right.");
}
