 // CSV utility functions for import/export
 
 export function parseCSV<T>(
   csvText: string,
   columnMapping: Record<string, keyof T>
 ): { data: Partial<T>[]; errors: string[] } {
   const lines = csvText.trim().split(/\r?\n/);
   if (lines.length < 2) {
     return { data: [], errors: ["CSV must have a header row and at least one data row"] };
   }
 
   const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/"/g, ""));
   const data: Partial<T>[] = [];
   const errors: string[] = [];
 
   for (let i = 1; i < lines.length; i++) {
     const values = parseCSVLine(lines[i]);
     if (values.length !== headers.length) {
       errors.push(`Row ${i + 1}: Column count mismatch (expected ${headers.length}, got ${values.length})`);
       continue;
     }
 
     const row: Partial<T> = {};
     headers.forEach((header, index) => {
       const mappedKey = columnMapping[header];
       if (mappedKey) {
         const value = values[index]?.trim();
         (row as Record<string, unknown>)[mappedKey as string] = value || null;
       }
     });
 
     if (Object.keys(row).length > 0) {
       data.push(row);
     }
   }
 
   return { data, errors };
 }
 
 function parseCSVLine(line: string): string[] {
   const result: string[] = [];
   let current = "";
   let inQuotes = false;
 
   for (let i = 0; i < line.length; i++) {
     const char = line[i];
     if (char === '"') {
       if (inQuotes && line[i + 1] === '"') {
         current += '"';
         i++;
       } else {
         inQuotes = !inQuotes;
       }
     } else if (char === "," && !inQuotes) {
       result.push(current);
       current = "";
     } else {
       current += char;
     }
   }
   result.push(current);
   return result;
 }
 
 export function generateCSV<T>(
   data: T[],
   columns: { key: keyof T; header: string }[]
 ): string {
   const headers = columns.map((c) => `"${c.header}"`).join(",");
   const rows = data.map((row) =>
     columns
       .map((c) => {
         const value = row[c.key];
         if (value === null || value === undefined) return "";
         const str = String(value).replace(/"/g, '""');
         return `"${str}"`;
       })
       .join(",")
   );
   return [headers, ...rows].join("\n");
 }
 
 export function downloadCSV(content: string, filename: string) {
   const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
   const link = document.createElement("a");
   link.href = URL.createObjectURL(blob);
   link.download = filename;
   document.body.appendChild(link);
   link.click();
   document.body.removeChild(link);
   URL.revokeObjectURL(link.href);
 }