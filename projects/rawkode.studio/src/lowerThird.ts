export function buildLowerThirdHtml(speaker: string, comment: string): string {
  return `<div class="lower-third">
  <span class="name">${escapeHtml(speaker || "Comment")}</span>
  <span class="topic">${escapeHtml(comment || " ")}</span>
</div>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
