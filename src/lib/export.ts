export function downloadFile(content: string, filename: string, mime: string = 'text/markdown') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportMarkdown(title: string, content: string, meta: Record<string, unknown>) {
  const frontmatter = Object.entries(meta)
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? `[${v.join(', ')}]` : v}`)
    .join('\n');
  const md = `---\n${frontmatter}\n---\n\n${content}`;
  downloadFile(md, `${title.replace(/[<>:"/\\|?*]/g, '_')}.md`);
}
