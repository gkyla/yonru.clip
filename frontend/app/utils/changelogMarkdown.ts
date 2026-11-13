export type SemverTuple = [number, number, number];

export type InlineSpan =
  | { type: 'text'; text: string }
  | { type: 'strong'; text: string }
  | { type: 'em'; text: string }
  | { type: 'code'; text: string }
  | { type: 'link'; text: string; href: string };

export interface ChangelogListItemNode {
  inlines: InlineSpan[];
  children: ChangelogListItemNode[];
}

export type ChangelogBlock =
  | { type: 'heading'; id: string; text: string }
  | { type: 'paragraph'; inlines: InlineSpan[] }
  | { type: 'list'; items: ChangelogListItemNode[] }
  | { type: 'codeblock'; language?: string; code: string };

const SEMVER_REGEX = /^[vV]?(\d+)\.(\d+)\.(\d+)$/;

/** Strip an optional leading `v` prefix and trim whitespace. */
export function normalizeVersion(version: string): string {
  return version.trim().replace(/^[vV]/, '');
}

/** Parse a strict `X.Y.Z` semantic version string into numeric components. */
export function parseSemver(version: string): SemverTuple | null {
  const match = SEMVER_REGEX.exec(version.trim());
  if (!match) return null;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  if (Number.isNaN(major) || Number.isNaN(minor) || Number.isNaN(patch)) {
    return null;
  }
  return [major, minor, patch];
}

/** Compare two semantic versions numerically (`1` if a > b, `-1` if a < b, `0` if equal). */
export function compareSemver(a: string, b: string): number {
  const parsedA = parseSemver(a);
  const parsedB = parseSemver(b);

  if (parsedA && parsedB) {
    for (let i = 0; i < 3; i += 1) {
      const partA = parsedA[i] ?? 0;
      const partB = parsedB[i] ?? 0;
      if (partA > partB) return 1;
      if (partA < partB) return -1;
    }
    return 0;
  }

  if (parsedA && !parsedB) return 1;
  if (!parsedA && parsedB) return -1;
  return normalizeVersion(a).localeCompare(normalizeVersion(b));
}

/** Allow only safe external `http:` or `https:` URLs. */
export function sanitizeExternalUrl(
  rawUrl: string | null | undefined
): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString().replace(/\/$/, trimmed.endsWith('/') ? '/' : '');
    }
    return null;
  } catch {
    return null;
  }
}

function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function stripUnsafeHtmlOutsideCode(input: string): string {
  // Preserve fenced and inline code spans verbatim while removing HTML comments/scripts/tags in prose.
  const segments = input.split(/(```[\s\S]*?```|`[^`]+`)/g);
  return segments
    .map((segment, index) => {
      if (index % 2 === 1) {
        return segment;
      }
      return segment
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<\/?[a-zA-Z][a-zA-Z0-9-]*(?:[\s/][^>]*)?>/g, '');
    })
    .join('');
}

function pushTextSpan(spans: InlineSpan[], text: string): void {
  if (!text) return;
  const prev = spans[spans.length - 1];
  if (prev && prev.type === 'text') {
    prev.text += text;
    return;
  }
  spans.push({ type: 'text', text });
}

function parseInlines(raw: string): InlineSpan[] {
  const cleaned = stripUnsafeHtmlOutsideCode(raw);
  const spans: InlineSpan[] = [];
  const tokenRegex =
    /(`[^`]+`)|(\*\*[^*]+\*\*|__[^_]+__)|(\[[^\]]+\]\((?:[^()]+|\([^()]*\))+\))|(\*[^*\s][^*]*?\*)/g;

  let cursor = 0;
  for (const match of cleaned.matchAll(tokenRegex)) {
    const matchIndex = match.index ?? 0;
    if (matchIndex > cursor) {
      pushTextSpan(spans, cleaned.slice(cursor, matchIndex));
    }

    const token = match[0];
    if (match[1]) {
      spans.push({ type: 'code', text: token.slice(1, -1) });
    } else if (match[2]) {
      spans.push({ type: 'strong', text: token.slice(2, -2) });
    } else if (match[3]) {
      const linkMatch = /^\[([^\]]+)\]\((.+)\)$/.exec(token);
      if (linkMatch) {
        const label = linkMatch[1] ?? '';
        const rawHref = linkMatch[2] ?? '';
        const safeHref = sanitizeExternalUrl(rawHref);
        if (safeHref) {
          spans.push({ type: 'link', text: label, href: safeHref });
        } else {
          pushTextSpan(spans, label);
        }
      } else {
        pushTextSpan(spans, token);
      }
    } else if (match[4]) {
      spans.push({ type: 'em', text: token.slice(1, -1) });
    }

    cursor = matchIndex + token.length;
  }

  if (cursor < cleaned.length) {
    pushTextSpan(spans, cleaned.slice(cursor));
  }

  return spans;
}

/** Parse and sanitize remote release Markdown into declarative block AST nodes. */
export function parseChangelogMarkdown(markdown: string): ChangelogBlock[] {
  if (!markdown || typeof markdown !== 'string') return [];

  const sanitizedMarkdown = stripUnsafeHtmlOutsideCode(markdown);
  const lines = sanitizedMarkdown.replace(/\r\n?/g, '\n').split('\n');
  const blocks: ChangelogBlock[] = [];
  let paragraphLines: string[] = [];
  let listItems: ChangelogListItemNode[] = [];
  let activeFenceLang: string | null = null;
  let fenceLines: string[] = [];

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    const text = paragraphLines.join(' ').trim();
    paragraphLines = [];
    if (!text) return;
    const inlines = parseInlines(text);
    if (inlines.length > 0) {
      blocks.push({ type: 'paragraph', inlines });
    }
  };

  const flushList = () => {
    if (listItems.length === 0) return;
    blocks.push({ type: 'list', items: listItems });
    listItems = [];
  };

  const flushCodeBlock = () => {
    if (activeFenceLang === null) return;
    const language = activeFenceLang || undefined;
    const code = fenceLines.join('\n');
    activeFenceLang = null;
    fenceLines = [];
    blocks.push(
      language
        ? { type: 'codeblock', language, code }
        : { type: 'codeblock', code }
    );
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    if (activeFenceLang !== null) {
      if (/^```\s*$/.test(trimmed)) {
        flushCodeBlock();
      } else {
        fenceLines.push(rawLine);
      }
      continue;
    }

    const fenceOpenMatch = /^```([a-zA-Z0-9_-]*)\s*$/.exec(trimmed);
    if (fenceOpenMatch) {
      flushParagraph();
      flushList();
      activeFenceLang = (fenceOpenMatch[1] ?? '').trim();
      continue;
    }

    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    const headingMatch = /^#{2,4}\s+(.+)$/.exec(trimmed);
    if (headingMatch) {
      flushParagraph();
      flushList();
      const headingText = (headingMatch[1] ?? '').trim();
      if (headingText) {
        blocks.push({
          type: 'heading',
          id: slugifyHeading(headingText),
          text: headingText
        });
      }
      continue;
    }

    const listMatch = /^(\s*)[-*]\s+(.+)$/.exec(rawLine);
    if (listMatch) {
      flushParagraph();
      const indent = (listMatch[1] ?? '').replace(/\t/g, '  ').length;
      const itemText = (listMatch[2] ?? '').trim();
      const node: ChangelogListItemNode = {
        inlines: parseInlines(itemText),
        children: []
      };

      const parent = listItems[listItems.length - 1];
      if (indent >= 2 && parent) {
        parent.children.push(node);
      } else {
        listItems.push(node);
      }
      continue;
    }

    flushList();
    paragraphLines.push(trimmed);
  }

  flushCodeBlock();
  flushParagraph();
  flushList();

  return blocks;
}
