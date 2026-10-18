import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
) => Promise<Buffer>;

const KEY_LENGTH = 64;
const SALT_BYTES = 16;
const ALGORITHM = "scrypt";

/**
 * Password hashing.
 *
 * SERVER ONLY — this module imports `node:crypto`. Never import it from a file
 * that carries `"use client"`, or the Node built-ins end up in the browser
 * bundle and hydration fails. Browser-safe password helpers live in
 * `password-strength.ts`.
 *
 * Uses Node's built-in scrypt, which is memory-hard and therefore resistant to
 * GPU cracking. Format: `scrypt$<salt-hex>$<derived-key-hex>` — the algorithm
 * and salt are stored with the hash so the parameters can be upgraded later
 * without invalidating existing passwords.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES).toString("hex");
  const derived = await scrypt(password.normalize("NFKC"), salt, KEY_LENGTH);
  return `${ALGORITHM}$${salt}$${derived.toString("hex")}`;
}

/** Constant-time verification of a password against a stored hash. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 3) return false;

  const [algorithm, salt, hash] = parts;
  if (algorithm !== ALGORITHM || !salt || !hash) return false;

  let expected: Buffer;
  try {
    expected = Buffer.from(hash, "hex");
  } catch {
    return false;
  }
  if (expected.length !== KEY_LENGTH) return false;

  const derived = await scrypt(password.normalize("NFKC"), salt, KEY_LENGTH);
  return timingSafeEqual(expected, derived);
}
