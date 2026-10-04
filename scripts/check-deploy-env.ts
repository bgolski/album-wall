import { fileURLToPath } from "node:url";

const REQUIRED = ["NEXT_PUBLIC_DISCOGS_PROXY_URL", "NEXT_PUBLIC_BASE_PATH"] as const;

/**
 * Lists what is wrong with the settings a static build bakes into the site. A missing proxy URL
 * would build and deploy fine, then fail for every visitor at their first search.
 *
 * @param env Environment variables to check.
 * @returns One message per problem; empty when the settings are usable.
 */
export function findEnvProblems(env: Record<string, string | undefined>): string[] {
  const problems: string[] = [];

  for (const name of REQUIRED) {
    if (!env[name]?.trim()) problems.push(`${name} is not set.`);
  }

  const proxyUrl = env.NEXT_PUBLIC_DISCOGS_PROXY_URL?.trim();
  if (proxyUrl) {
    try {
      if (new URL(proxyUrl).protocol !== "https:") {
        problems.push("NEXT_PUBLIC_DISCOGS_PROXY_URL must be an https:// URL.");
      }
    } catch {
      problems.push("NEXT_PUBLIC_DISCOGS_PROXY_URL is not a valid URL.");
    }
  }

  const basePath = env.NEXT_PUBLIC_BASE_PATH?.trim();
  if (basePath && (!basePath.startsWith("/") || basePath.endsWith("/"))) {
    problems.push(
      'NEXT_PUBLIC_BASE_PATH must start with "/" and not end with "/", like /album-wall.'
    );
  }

  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const problems = findEnvProblems(process.env);
  if (problems.length > 0) {
    console.error("The static build needs its deploy settings:");
    for (const problem of problems) console.error(`- ${problem}`);
    process.exit(1);
  }
  console.log("Deploy settings are present.");
}
