// pdf.js, mammoth, and JSZip are loaded from a CDN only when a file needs them,
// so they never slow down the first page load.
type PdfItem = { str: string; hasEOL?: boolean; transform?: number[]; height?: number };
type PdfPage = { getTextContent(): Promise<{ items: PdfItem[] }> };
type PdfLib = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument(src: { data: ArrayBuffer }): { promise: Promise<{ numPages: number; getPage(n: number): Promise<PdfPage> }> };
};
type Mammoth = {
  extractRawText(src: { arrayBuffer: ArrayBuffer }): Promise<{ value: string }>;
  convertToHtml(src: { arrayBuffer: ArrayBuffer }): Promise<{ value: string }>;
};
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

// Headings are written as "# Heading" lines (Markdown style). generate.ts uses them to split the
// notes into sections, so questions can be spread across the lesson and labelled by topic.
const decode = (s: string) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&");

function htmlToText(html: string) {
  return decode(
    html
      .replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, level: string, inner: string) => `\n${"#".repeat(Number(level))} ${inner.replace(/<[^>]+>/g, "")}\n`)
      .replace(/<\/(?:p|li|tr|div|table|ul|ol)>|<br\s*\/?>/gi, "\n")
      .replace(/<\/t[dh]>/gi, " ")
      .replace(/<[^>]+>/g, ""),
  ).replace(/\n{3,}/g, "\n\n");
}

// PDFs have no real headings, but headings are printed in a bigger font than the body text.
async function readPdf(buffer: ArrayBuffer) {
  const pdf = await (await getPdf()).getDocument({ data: buffer }).promise;
  const lines: { text: string; size: number }[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const { items } = await (await pdf.getPage(i)).getTextContent();
    let cur = "";
    let size = 0;
    let y: number | undefined;
    const flush = () => {
      const text = cur.replace(/\s+/g, " ").trim();
      if (text) lines.push({ text, size });
      cur = "";
      size = 0;
    };
    for (const t of items) {
      const ty = t.transform?.[5];
      if (cur && y !== undefined && ty !== undefined && Math.abs(ty - y) > 2) flush();
      if (ty !== undefined) y = ty;
      cur += t.str + (t.hasEOL ? "" : " ");
      if (t.str.trim()) size = Math.max(size, Math.round(t.height || Math.abs(t.transform?.[3] ?? 0)));
      if (t.hasEOL) flush();
    }
    flush();
    lines.push({ text: "", size: 0 }); // blank line between pages
  }
  // The most common font size (counted in characters) is the body text.
  const chars = new Map<number, number>();
  for (const l of lines) if (l.size) chars.set(l.size, (chars.get(l.size) ?? 0) + l.text.length);
  const body = [...chars.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
  return lines
    .map((l) => {
      const heading = body > 0 && l.size >= body * 1.15 && l.text.split(" ").length <= 12 && !/[.!?,;]$/.test(l.text);
      return heading ? `# ${l.text}` : l.text;
    })
    .join("\n");
}

export async function readFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  const buffer = await file.arrayBuffer();

  if (name.endsWith(".pdf")) return readPdf(buffer);

  if (name.endsWith(".docx")) {
    await loadScript(`${CDN}/mammoth/1.6.0/mammoth.browser.min.js`);
    try {
      // Keeps Word's Heading 1, 2, 3 styles as sections.
      return htmlToText((await window.mammoth!.convertToHtml({ arrayBuffer: buffer })).value);
    } catch {
      return (await window.mammoth!.extractRawText({ arrayBuffer: buffer })).value;
    }
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
      // A slide's title placeholder becomes a "# heading"; tables (outside shapes) are kept too.
      const paragraph = (p: string) => [...p.matchAll(/<a:t(?: [^>]*)?>([^<]*)<\/a:t>/g)].map((m) => m[1]).join("");
      const out: string[] = [];
      for (const block of xml.match(/<p:sp[ >][\s\S]*?<\/p:sp>|<a:p[ >][\s\S]*?<\/a:p>/g) ?? []) {
        const paras = (block.match(/<a:p[ >][\s\S]*?<\/a:p>/g) ?? []).map(paragraph).filter(Boolean);
        if (block.startsWith("<p:sp") && /<p:ph[^>]*type="(?:title|ctrTitle)"/.test(block)) {
          if (paras.length) out.push(`# ${paras.join(" ")}`);
        } else {
          out.push(...paras);
        }
      }
      text += decode(out.join("\n")) + "\n\n";
    }
    return text;
  }

  return new TextDecoder().decode(buffer);
}
