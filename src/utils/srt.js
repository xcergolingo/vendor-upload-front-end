export function parseSrt(content) {
  if (!content) return [];
  const blocks = content.replace(/\r/g, '').trim().split(/\n\n+/);
  return blocks
    .map(block => {
      const lines = block.split('\n');
      if (lines.length < 3) return null;
      const index = lines[0].trim();
      const times = lines[1].split('-->');
      const start = times[0]?.trim() || '';
      const end = times[1]?.trim() || '';
      const text = lines.slice(2).join(' ').trim();
      return { index, start, end, text };
    })
    .filter(Boolean);
}

export function entriesToSrt(entries = []) {
  return entries
    .map(
      (entry, idx) =>
        `${idx + 1}\n${entry.start} --> ${entry.end}\n${entry.text}`.trim()
    )
    .join('\n\n');
}
