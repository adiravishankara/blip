import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';

// Vite-friendly worker path (bundled).
GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

export async function extractPdfText(file: File, maxChars = 120_000): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdf = await getDocument({ data: bytes }).promise;

  let out = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => (typeof item?.str === 'string' ? item.str : ''))
      .join(' ');

    out += `${pageText}\n`;
    if (out.length >= maxChars) break;
  }

  return out.replace(/\s+/g, ' ').trim();
}

