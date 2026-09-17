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
