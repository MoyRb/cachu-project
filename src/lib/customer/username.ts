// Utilidades compartidas para el manejo de usernames de clientes Cachu.
// Usadas tanto en servidor (API routes) como en cliente (páginas de login/registro).

const USERNAME_REGEX = /^[a-z0-9._-]+$/;
const INTERNAL_EMAIL_DOMAIN = 'clientes.cachu.invalid';

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 32;
export const PASSWORD_MIN = 6;

/**
 * Normaliza el username: trim + lowercase.
 * El resultado debe ser validado con validateCustomerUsername.
 */
export function normalizeCustomerUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Valida un username ya normalizado.
 * Retorna un mensaje de error en español o null si es válido.
 */
export function validateCustomerUsername(username: string): string | null {
  if (!username) {
    return 'El nombre de usuario es requerido.';
  }
  if (username.length < USERNAME_MIN) {
    return `El nombre de usuario debe tener al menos ${USERNAME_MIN} caracteres.`;
  }
  if (username.length > USERNAME_MAX) {
    return `El nombre de usuario no puede superar ${USERNAME_MAX} caracteres.`;
  }
  if (!USERNAME_REGEX.test(username)) {
    return 'Solo se permiten letras, números, punto (.), guion (-) y guion bajo (_).';
  }
  if (username.startsWith('.') || username.endsWith('.')) {
    return 'El nombre de usuario no puede comenzar ni terminar con punto.';
  }
  if (username.includes('..')) {
    return 'El nombre de usuario no puede contener puntos consecutivos.';
  }
  return null;
}

/**
 * Convierte un username normalizado en el email técnico interno que usa Supabase Auth.
 * NUNCA se muestra al usuario. Es un detalle de implementación.
 */
export function customerUsernameToInternalEmail(username: string): string {
  return `${username}@${INTERNAL_EMAIL_DOMAIN}`;
}
