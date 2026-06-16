export function formatRisDateTime(value?: string | null): string {
  const raw = String(value || '').trim();
  if (!raw) return '-';

  const mysqlDateTime = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (mysqlDateTime) {
    const [, year, month, day, hour = '00', minute = '00'] = mysqlDateTime;
    return `${day}/${month}/${year.slice(2)} : ${hour}:${minute}`;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;

  const pad = (part: number) => String(part).padStart(2, '0');
  return `${pad(parsed.getDate())}/${pad(parsed.getMonth() + 1)}/${String(parsed.getFullYear()).slice(2)} : ${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
}
