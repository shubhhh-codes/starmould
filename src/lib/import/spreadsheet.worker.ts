import * as XLSX from "xlsx";

self.onmessage = (event: MessageEvent<ArrayBuffer>) => {
  try {
    if (!(event.data instanceof ArrayBuffer) || event.data.byteLength > 5 * 1024 * 1024) throw new Error("Spreadsheet exceeds 5 MiB");
    const workbook = XLSX.read(event.data, { type: "array", sheetRows: 10002 });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) throw new Error("Spreadsheet has no worksheet");
    const rows = XLSX.utils.sheet_to_json(sheet);
    if (rows.length > 10000) throw new Error("Import supports at most 10,000 rows");
    self.postMessage({ rows });
  } catch {
    self.postMessage({ error: "Unable to parse spreadsheet within import limits" });
  }
};
