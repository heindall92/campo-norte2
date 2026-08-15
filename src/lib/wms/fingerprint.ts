/**
 * Huella dactilar: el navegador no lee lectores ZKTeco.
 * Existe tecnología open source en GitHub (pyzk, zk-protocol) para un
 * agente local que empuje punches. Aquí solo hay PIN de verificación
 * y un ingest de adaptador — nunca se fabrica una lectura biométrica.
 *
 * @see docs/WMS-HUELLA.md
 */

export const FINGERPRINT_STACK = {
  protocol: "ZKTeco standalone · TCP/UDP 4370",
  repos: [
    { name: "fananimi/pyzk", url: "https://github.com/fananimi/pyzk" },
    { name: "adrobinoga/zk-protocol", url: "https://github.com/adrobinoga/zk-protocol" },
    { name: "adrobinoga/pyzatt", url: "https://github.com/adrobinoga/pyzatt" },
    { name: "sowrensen/zkconnect", url: "https://github.com/sowrensen/zkconnect" },
  ],
  browserCanReadSensor: false,
} as const;

export function hashIdentityPin(pin: string): string {
  const trimmed = pin.trim();
  let h = 2166136261;
  for (let i = 0; i < trimmed.length; i += 1) {
    h ^= trimmed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

export function pinLooksValid(pin: string): boolean {
  return /^\d{4,6}$/.test(pin.trim());
}

export function pinsMatch(pin: string, pinHash: string | null): boolean {
  if (!pinHash) return false;
  return hashIdentityPin(pin) === pinHash;
}
