export function rowsToObjects(headers: string[], rows: any[][]): Record<string, any>[] {
  if (!Array.isArray(headers) || !Array.isArray(rows)) return [];
  return rows.map((row) => {
    const item: Record<string, any> = {};
    headers.forEach((header: string, index: number) => {
      if (header) {
        item[header] = row[index];
      }
    });
    return item;
  });
}