/**
 * Parent PIN (spec §10.1): stored only as a SHA-256 hash with a random salt.
 * The PIN keeps a curious child out of the settings; it is not a security
 * boundary for the data, which never leaves the device.
 */
const PIN_PATTERN = /^\d{4}$/u;

export function isValidPin(pin: string): boolean {
  return PIN_PATTERN.test(pin);
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function newSalt(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(16)));
}

export async function hashPin(pin: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  return toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', data)));
}

export async function createPin(pin: string): Promise<{ pinHash: string; pinSalt: string }> {
  if (!isValidPin(pin)) throw new Error('The PIN must be exactly 4 digits.');
  const pinSalt = newSalt();
  return { pinHash: await hashPin(pin, pinSalt), pinSalt };
}

export async function verifyPin(
  pin: string,
  stored: { pinHash?: string; pinSalt?: string },
): Promise<boolean> {
  if (!stored.pinHash || !stored.pinSalt || !isValidPin(pin)) return false;
  return (await hashPin(pin, stored.pinSalt)) === stored.pinHash;
}
