/**
 * Prepares the optional faces feature at server start. The database only serves face recognition, so a database
 * that is down must not stop the rest of the club's system (Ingreso by DNI, payments, members) from starting.
 * Returns whether the faces are available; when they are not, the caller wires the 503 router until restart.
 */
export async function startFaces({
  migrate,
  log,
  connectionString,
}: {
  migrate: () => Promise<string[]>;
  log: (message: string) => void;
  connectionString: string;
}): Promise<boolean> {
  try {
    const applied = await migrate();
    if (applied.length > 0) log(`Applied ${applied.length} database migration(s)`);
    return true;
  } catch (error) {
    log(`Database unavailable. Face recognition is disabled until the server restarts (${describe(error, connectionString)}).`);
    return false;
  }
}

// One line, with the connection string (which holds the password) removed wherever the driver quoted it.
function describe(error: unknown, connectionString: string): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code: unknown }).code) : '';
  const message = error instanceof Error ? error.message : String(error);
  const text = [code, message].filter(Boolean).join(' ').split(connectionString).join('[redacted]');
  return text.replace(/\s+/g, ' ').slice(0, 300);
}
