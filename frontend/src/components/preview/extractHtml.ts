export function extractHtml(code: string): string {
  const cleaned = code
    .trim()
    .replace(/^```(?:html|xml|text)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  if (!cleaned) return "";

  const htmlStartMatch = [...cleaned.matchAll(/<html\b[^>]*>/gi)].pop();
  const lastHtmlStartIndex = htmlStartMatch?.index ?? -1;

  if (lastHtmlStartIndex !== -1) {
    let htmlEndIndex = cleaned.toLowerCase().indexOf("</html>", lastHtmlStartIndex);
    if (htmlEndIndex !== -1) {
      htmlEndIndex += "</html>".length;
      const beforeHtml = cleaned.slice(0, lastHtmlStartIndex);
      const doctypeMatch = beforeHtml.match(/<!doctype html>/i);
      const doctype = doctypeMatch ? "<!DOCTYPE html>\n" : "";
      return doctype + cleaned.slice(lastHtmlStartIndex, htmlEndIndex);
    }
    return cleaned.slice(lastHtmlStartIndex);
  }

  const doctypeMatch = cleaned.match(/<!doctype html>/i);
  if (doctypeMatch?.index !== undefined) {
    return cleaned.slice(doctypeMatch.index);
  }

  const bodyMatch = cleaned.match(/<body\b[^>]*>[\s\S]*?<\/body>/i);
  if (bodyMatch) return bodyMatch[0];

  const fragmentStart = cleaned.search(/<(main|section|div|header|nav|article|aside|footer|form|button|h1|h2|p)\b/i);
  if (fragmentStart !== -1) return cleaned.slice(fragmentStart);

  return cleaned;
}
