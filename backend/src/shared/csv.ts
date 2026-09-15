function escapeCsvCell(value: unknown): string {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function formatCsvRow(values: unknown[]): string {
  return values.map(escapeCsvCell).join(',') + '\r\n';
}

export function formatCsvHeaders(headers: string[]): string {
  return formatCsvRow(headers);
}
