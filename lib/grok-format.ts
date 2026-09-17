export function splitHtmlReply(text: string): { prose: string; html: string | null } {
  const stripped = String(text || "")
    .replace(/html\s*Copy\s*Download\s*Run/gi, "\n")
    .replace(/\bCopy\s*Download\s*Run\b/gi, "")
    .trim();
  const idx = stripped.search(/<!DOCTYPE html>|<html[\s>]/i);
  if (idx < 0) return { prose: stripped, html: null };
  return {
    prose: stripped.slice(0, idx).trim(),
    html: stripped.slice(idx).trim(),
  };
}

export function downloadTextFile(filename: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const ALLOWED = new Set([
  "H1", "H2", "H3", "H4", "H5", "H6",
  "P", "UL", "OL", "LI", "BR", "HR", "BLOCKQUOTE",
  "TABLE", "THEAD", "TBODY", "TR", "TH", "TD",
  "STRONG", "B", "EM", "I", "CODE", "PRE", "A",
  "DIV", "SPAN", "SECTION",
]);

export function looksLikeHtml(text: string): boolean {
  return /<\/?(h[1-6]|p|ul|ol|li|table|thead|tbody|tr|th|td|pre|strong|em|blockquote)\b/i.test(text);
}

export function sanitizeHtml(html: string): string {
  if (typeof window === "undefined") return "";
  const doc = new DOMParser().parseFromString(`<div id="grok-root">${html}</div>`, "text/html");
  const root = doc.getElementById("grok-root");
  if (!root) return "";

  const walk = (node: Node) => {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType !== 1) return;
      const el = child as HTMLElement;
      const tag = el.tagName;
      if (tag === "SCRIPT" || tag === "STYLE" || tag === "IFRAME" || tag === "OBJECT" || tag === "LINK") {
        el.remove();
        return;
      }
      if (!ALLOWED.has(tag)) {
        walk(el);
        const parent = el.parentNode;
        if (parent) {
          while (el.firstChild) parent.insertBefore(el.firstChild, el);
          parent.removeChild(el);
        }
        return;
      }
      [...el.attributes].forEach((attr) => {
        const name = attr.name.toLowerCase();
        if (tag === "A" && name === "href" && /^(https?:|mailto:|#)/i.test(attr.value)) return;
        el.removeAttribute(attr.name);
      });
      walk(el);
    });
  };

  walk(root);
  return root.innerHTML.trim();
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inlineMarkdown(s: string): string {
  return s
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function isBlockStart(line: string): boolean {
  return /^(#{1,3} |\s*[-*] |\s*\d+\. |\s*\|)/.test(line) || /^%%FENCE\d+%%$/.test(line.trim());
}

function tableHtml(rows: string[]): string {
  const parse = (row: string) =>
    row
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((c) => inlineMarkdown(c.trim()));
  const header = parse(rows[0] || "");
  const body = rows.slice(2).map(parse);
  return `<div class="grok-table-wrap"><table><thead><tr>${header.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>${body
    .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`)
    .join("")}</tbody></table></div>`;
}

export function markdownToHtml(raw: string): string {
  const text = String(raw || "").replace(/\r\n/g, "\n").trim();
  if (!text) return "";
  const fences: string[] = [];
  let src = text.replace(/```[\w]*\n?([\s\S]*?)```/g, (_, code) => {
    const i = fences.length;
    fences.push(`<pre><code>${escapeHtml(String(code).trim())}</code></pre>`);
    return `\n%%FENCE${i}%%\n`;
  });
  src = escapeHtml(src);

  const lines = src.split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const fence = line.trim().match(/^%%FENCE(\d+)%%$/);
    if (fence) {
      out.push(fences[Number(fence[1])]);
      i += 1;
      continue;
    }
    if (line.startsWith("### ")) {
      out.push(`<h3>${inlineMarkdown(line.slice(4))}</h3>`);
      i += 1;
      continue;
    }
    if (line.startsWith("## ")) {
      out.push(`<h2>${inlineMarkdown(line.slice(3))}</h2>`);
      i += 1;
      continue;
    }
    if (line.startsWith("# ")) {
      out.push(`<h1>${inlineMarkdown(line.slice(2))}</h1>`);
      i += 1;
      continue;
    }
    if (line.trim().startsWith("|") && i + 1 < lines.length && /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/.test(lines[i + 1])) {
      const rows: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(lines[i]);
        i += 1;
      }
      out.push(tableHtml(rows));
      continue;
    }
    if (/^\s*[-*] /.test(line)) {
      out.push("<ul>");
      while (i < lines.length && /^\s*[-*] /.test(lines[i])) {
        out.push(`<li>${inlineMarkdown(lines[i].replace(/^\s*[-*] /, ""))}</li>`);
        i += 1;
      }
      out.push("</ul>");
      continue;
    }
    if (/^\s*\d+\. /.test(line)) {
      out.push("<ol>");
      while (i < lines.length && /^\s*\d+\. /.test(lines[i])) {
        out.push(`<li>${inlineMarkdown(lines[i].replace(/^\s*\d+\. /, ""))}</li>`);
        i += 1;
      }
      out.push("</ol>");
      continue;
    }
    if (!line.trim()) {
      i += 1;
      continue;
    }
    const para = [line];
    i += 1;
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) {
      para.push(lines[i]);
      i += 1;
    }
    out.push(`<p>${para.map(inlineMarkdown).join("<br/>")}</p>`);
  }
  return out.join("\n");
}

export function formatBotHtml(text: string): string {
  const src = String(text || "").trim();
  if (!src) return "";
  if (looksLikeHtml(src)) return sanitizeHtml(src) || markdownToHtml(src.replace(/<[^>]+>/g, " "));
  return markdownToHtml(src);
}
