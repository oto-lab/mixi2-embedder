type Segment =
  | { type: 'text'; value: string }
  | { type: 'url'; value: string }
  | { type: 'mention'; value: string; handle: string }
  | { type: 'hashtag'; value: string; tag: string };

const TOKEN_RE =
  /(https?:\/\/[^\s<>"']+)|(@[A-Za-z0-9_.]+)|(#[\p{L}\p{N}_]+)/gu;

export function segmentText(text: string): Segment[] {
  const segments: Segment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(TOKEN_RE)) {
    const idx = match.index ?? 0;
    if (idx > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, idx) });
    }

    const [, url, mention, hashtag] = match;
    if (url) {
      segments.push({ type: 'url', value: url });
    } else if (mention) {
      segments.push({
        type: 'mention',
        value: mention,
        handle: mention.slice(1),
      });
    } else if (hashtag) {
      segments.push({ type: 'hashtag', value: hashtag, tag: hashtag.slice(1) });
    }

    lastIndex = idx + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) });
  }

  return segments;
}

export function formatTimestamp(date: Date | null): string {
  if (!date) return '';
  const fmt = new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  return fmt.format(date);
}

export function isoTimestamp(date: Date | null): string {
  if (!date) return '';
  return date.toISOString();
}
