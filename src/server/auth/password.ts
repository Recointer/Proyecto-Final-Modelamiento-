import { hash, verify } from "@node-rs/argon2";
import { randomBytes, createHash } from "node:crypto";

export async function hashPassword(password: string): Promise<string> {
  return hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

/** Mínimo 10 caracteres, con letras y números. */
export function validarFortaleza(password: string): boolean {
  return password.length >= 10 && /[A-Za-z]/.test(password) && /\d/.test(password);
}

/** Genera un token aleatorio (se entrega al usuario) y su hash (se guarda en BD). */
export function nuevoToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Contraseña inicial aleatoria legible para entregar una sola vez. */
export function generarPasswordInicial(): string {
  return `${randomBytes(6).toString("base64url")}-${Math.floor(1000 + Math.random() * 9000)}`;
}
