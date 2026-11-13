import { describe, it, expect } from 'vitest';
import {
  normalizeVersion,
  parseSemver,
  compareSemver,
  sanitizeExternalUrl,
  parseChangelogMarkdown
} from '../../app/utils/changelogMarkdown';

describe('changelogMarkdown utilities', () => {
  it('normalizes and compares SemVer numerically', () => {
    expect(normalizeVersion('v0.3.0')).toBe('0.3.0');
    expect(normalizeVersion(' 0.4.0 ')).toBe('0.4.0');
    expect(parseSemver('v0.10.2')).toEqual([0, 10, 2]);
    expect(parseSemver('0.4.0-rc.1')).toBeNull();

    expect(compareSemver('0.10.0', '0.3.0')).toBe(1);
    expect(compareSemver('v0.3.0', '0.3.0')).toBe(0);
    expect(compareSemver('0.2.9', '0.3.0')).toBe(-1);
  });

  it('sanitizes external URLs to allow only http and https protocols', () => {
    expect(
      sanitizeExternalUrl(
        'https://github.com/gkyla/yonru.clip/releases/tag/v0.4.0'
      )
    ).toBe('https://github.com/gkyla/yonru.clip/releases/tag/v0.4.0');
    expect(sanitizeExternalUrl('http://localhost:8765')).toBe(
      'http://localhost:8765'
    );
    expect(sanitizeExternalUrl('javascript:alert(1)')).toBeNull();
    expect(
      sanitizeExternalUrl('data:text/html,<script>alert(1)</script>')
    ).toBeNull();
    expect(sanitizeExternalUrl('/relative/path')).toBeNull();
  });

  it('parses ADR 0027 headings, paragraphs, nested lists, and inline formatting safely', () => {
    const md = [
      '<!-- Auto-generated comment -->',
      'Yonru Clip **v0.4.0** adds `GET /api/releases` and [Release Link](https://github.com/gkyla/yonru.clip).',
      '',
      '### Features',
      '',
      '- **Editor**:',
      '  - Sync studio preview (#306)',
      '  - Support `<version>` token inside code',
      '- **Home**: Show update banner',
      '',
      '### Bug Fixes',
      '',
      '- Fix [bad link](javascript:alert(1)) safely',
      '<script>alert("xss")</script>',
      '<img src="x" onerror="alert(2)">',
      '<svg/onload="alert(3)">',
      '',
      '```bash',
      'git pull && python run.py',
      '```'
    ].join('\n');

    const blocks = parseChangelogMarkdown(md);

    expect(blocks[0]).toEqual({
      type: 'paragraph',
      inlines: [
        { type: 'text', text: 'Yonru Clip ' },
        { type: 'strong', text: 'v0.4.0' },
        { type: 'text', text: ' adds ' },
        { type: 'code', text: 'GET /api/releases' },
        { type: 'text', text: ' and ' },
        {
          type: 'link',
          text: 'Release Link',
          href: 'https://github.com/gkyla/yonru.clip'
        },
        { type: 'text', text: '.' }
      ]
    });

    expect(blocks[1]).toEqual({
      type: 'heading',
      id: 'features',
      text: 'Features'
    });

    expect(blocks[2]?.type).toBe('list');
    if (blocks[2]?.type === 'list') {
      expect(blocks[2].items.length).toBe(2);
      expect(blocks[2].items[0]?.inlines).toEqual([
        { type: 'strong', text: 'Editor' },
        { type: 'text', text: ':' }
      ]);
      expect(blocks[2].items[0]?.children.length).toBe(2);
      expect(blocks[2].items[0]?.children[1]?.inlines).toEqual([
        { type: 'text', text: 'Support ' },
        { type: 'code', text: '<version>' },
        { type: 'text', text: ' token inside code' }
      ]);
      expect(blocks[2].items[1]?.inlines).toEqual([
        { type: 'strong', text: 'Home' },
        { type: 'text', text: ': Show update banner' }
      ]);
    }

    expect(blocks[3]).toEqual({
      type: 'heading',
      id: 'bug-fixes',
      text: 'Bug Fixes'
    });

    expect(blocks[4]?.type).toBe('list');
    if (blocks[4]?.type === 'list') {
      const fixInlines = blocks[4].items[0]?.inlines ?? [];
      expect(fixInlines.some(span => span.type === 'link')).toBe(false);
      expect(fixInlines.map(span => span.text).join('')).toBe(
        'Fix bad link safely'
      );
    }

    const serialized = JSON.stringify(blocks);
    expect(serialized).not.toContain('alert("xss")');
    expect(serialized).not.toContain('onerror');
    expect(serialized).not.toContain('onload');
    expect(serialized).not.toContain('<script');
    expect(serialized).not.toContain('<img');
    expect(serialized).not.toContain('<svg');
    expect(blocks[5]).toEqual({
      type: 'codeblock',
      language: 'bash',
      code: 'git pull && python run.py'
    });
  });
});
