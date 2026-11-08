// pdf.js, mammoth, and JSZip are loaded from a CDN only when a file needs them,
// so they never slow down the first page load.
type PdfPage = { getTextContent(): Promise<{ items: { str: string; hasEOL?: boolean }[] }> };
type PdfLib = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument(src: { data: ArrayBuffer }): { promise: Promise<{ numPages: number; getPage(n: number): Promise<PdfPage> }> };
};
type Mammoth = { extractRawText(src: { arrayBuffer: ArrayBuffer }): Promise<{ value: string }> };
type JSZipLib = { loadAsync(data: ArrayBuffer): Promise<{ files: Record<string, { async(type: "string"): Promise<string> }> }> };

declare global {
  interface Window {
    pdfjsLib?: PdfLib;
    mammoth?: Mammoth;
    JSZip?: JSZipLib;
  }
}

const CDN = "https://cdnjs.cloudflare.com/ajax/libs";
const loading = new Map<string, Promise<void>>();

function loadScript(src: string) {
  if (!loading.has(src)) {
    loading.set(
      src,
      new Promise<void>((resolve, reject) => {
        const el = document.createElement("script");
        el.src = src;
        el.onload = () => resolve();
        el.onerror = () => {
          loading.delete(src);
          reject(new Error(`Could not load ${src}`));
        };
        document.head.appendChild(el);
      }),
    );
  }
  return loading.get(src)!;
}

async function getPdf() {
  await loadScript(`${CDN}/pdf.js/3.11.174/pdf.min.js`);
  const lib = window.pdfjsLib!;
  lib.GlobalWorkerOptions.workerSrc = `${CDN}/pdf.js/3.11.174/pdf.worker.min.js`;
  return lib;
}

export async function readFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  const buffer = await file.arrayBuffer();

  if (name.endsWith(".pdf")) {
    const pdf = await (await getPdf()).getDocument({ data: buffer }).promise;
    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const content = await (await pdf.getPage(i)).getTextContent();
      text += content.items.map((t) => t.str + (t.hasEOL ? "\n" : " ")).join("") + "\n";
    }
    return text;
  }

  if (name.endsWith(".docx")) {
    await loadScript(`${CDN}/mammoth/1.6.0/mammoth.browser.min.js`);
    return (await window.mammoth!.extractRawText({ arrayBuffer: buffer })).value;
  }

  if (name.endsWith(".pptx")) {
    await loadScript(`${CDN}/jszip/3.10.1/jszip.min.js`);
    const zip = await window.JSZip!.loadAsync(buffer);
    const slides = Object.keys(zip.files)
      .filter((k) => /^ppt\/slides\/slide\d+\.xml$/.test(k))
      .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
    let text = "";
    for (const key of slides) {
      const xml = await zip.files[key].async("string");
      // One line per paragraph. Text inside a paragraph is split into "runs" by formatting,
      // so runs are joined with no space; otherwise words get cut in half.
      const paragraphs = xml.match(/<a:p[ >][\s\S]*?<\/a:p>/g) ?? [];
      text +=
        paragraphs
          .map((p) => [...p.matchAll(/<a:t(?: [^>]*)?>([^<]*)<\/a:t>/g)].map((m) => m[1]).join(""))
          .filter(Boolean)
          .join("\n")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">") + "\n\n";
    }
    return text;
  }

  return new TextDecoder().decode(buffer);
}
