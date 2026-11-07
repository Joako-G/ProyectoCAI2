/**
 * The PostgreSQL connection string. Unset or blank means the database features are off and the rest of the
 * app keeps working on its JSON files exactly as before.
 */
export function databaseUrl(env: NodeJS.ProcessEnv = process.env): string | undefined {
  return env.DATABASE_URL?.trim() || undefined;
}
