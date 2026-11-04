export async function readCustomerSpreadsheet(file: File): Promise<Record<string, any>[]> {
  if (file.size > 5 * 1024 * 1024) throw new Error("Spreadsheet exceeds 5 MiB");
  const buffer = await file.arrayBuffer();
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./spreadsheet.worker.ts", import.meta.url));
    const timeout = setTimeout(() => {
      worker.terminate();
      reject(new Error("Spreadsheet parsing exceeded 10 seconds"));
    }, 10000);
    const cleanup = () => { clearTimeout(timeout); worker.terminate(); };
    worker.onmessage = (event) => {
      cleanup();
      if (event.data.error) reject(new Error(event.data.error));
      else resolve(event.data.rows);
    };
    worker.onerror = () => { cleanup(); reject(new Error("Spreadsheet parsing failed")); };
    worker.postMessage(buffer, [buffer]);
  });
}
