export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function offsetDate(days: number) {
  const d = new Date(`${today()}T12:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function daysLeft(date: string) {
  return Math.round(
    (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today()}T00:00:00Z`)) /
      86400000,
  );
}
export function formatDate(
  value: string | null,
  options?: Intl.DateTimeFormatOptions,
) {
  return value
    ? new Date(`${value}T12:00:00`).toLocaleDateString(
        "ru-RU",
        options || { day: "2-digit", month: "short", year: "numeric" },
      )
    : "Бессрочно";
}
export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1048576)
    return `${(bytes / 1024).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} КБ`;
  return `${(bytes / 1048576).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} МБ`;
}
export function plural(
  n: number,
  forms = ["документ", "документа", "документов"],
) {
  const v = Math.abs(n) % 100,
    last = v % 10;
  return `${n} ${v > 10 && v < 20 ? forms[2] : last === 1 ? forms[0] : last >= 2 && last <= 4 ? forms[1] : forms[2]}`;
}
export function retention(date: string | null) {
  if (!date) return { label: "Бессрочно", tone: "neutral" };
  const days = daysLeft(date);
  if (days < 0) return { label: "Срок истёк", tone: "danger" };
  if (days === 0) return { label: "Сегодня", tone: "danger" };
  if (days <= 30) return { label: `Через ${days} дн.`, tone: "warning" };
  return {
    label: formatDate(date, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
    tone: "neutral",
  };
}
export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export const normalize = (value: string) =>
  value.toLocaleLowerCase("ru-RU").replaceAll("ё", "е").trim();
export function csvCell(value: string) {
  // Spreadsheet applications may interpret these prefixes as formulas.
  const safe = /^[\s]*[=+@\-\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}
