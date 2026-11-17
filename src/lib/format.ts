/** Display helpers (UI layer only). */
export function formatCustomerId(id: string): string {
  return /^\d{10}$/.test(id) ? `${id.slice(0, 3)}-${id.slice(3, 6)}-${id.slice(6)}` : id;
}

export function formatDateTime(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "never";
}
