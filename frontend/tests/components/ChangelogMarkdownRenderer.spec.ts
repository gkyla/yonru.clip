import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import ChangelogMarkdownRenderer from '../../app/components/ChangelogMarkdownRenderer.vue';

const IconStub = {
  props: ['name'],
  template: '<span class="icon-stub" :data-icon="name"></span>'
};

describe('ChangelogMarkdownRenderer Component', () => {
  it('renders headings via ChangelogCategoryHeading, nested ADR 0027 lists, and safe links', () => {
    const markdown = [
      'Yonru Clip **v0.4.0** introduces remote checks.',
      '',
      '### Features',
      '',
      '- **Changelog**:',
      '  - Show `Available Update` badge',
      '  - Link to [GitHub Release](https://github.com/gkyla/yonru.clip/releases/tag/v0.4.0)',
      '',
      '### Bug Fixes',
      '',
      '- Ignore [unsafe](javascript:alert(1)) links and <script>alert(1)</script>',
      '',
      '```bash',
      'git pull && python run.py',
      '```'
    ].join('\n');

    const wrapper = mount(ChangelogMarkdownRenderer, {
      props: { markdown },
      global: {
        stubs: {
          Icon: IconStub,
          NuxtIcon: IconStub
        }
      }
    });

    const headings = wrapper.findAll('h3.changelog-category-header');
    expect(headings.length).toBe(2);
    expect(headings[0]?.text()).toContain('👨‍🍳');
    expect(headings[0]?.text()).toContain('Features');
    expect(headings[1]?.text()).toContain('🐞');
    expect(headings[1]?.text()).toContain('Bug Fixes');

    // Nested list structure (ul > li > ul > li)
    const nestedItems = wrapper.findAll('ul ul li');
    expect(nestedItems.length).toBe(2);
    expect(nestedItems[0]?.find('code').text()).toBe('Available Update');

    // Safe external link
    const link = wrapper.find(
      'a[href="https://github.com/gkyla/yonru.clip/releases/tag/v0.4.0"]'
    );
    expect(link.exists()).toBe(true);
    expect(link.attributes('target')).toBe('_blank');
    expect(link.attributes('rel')).toBe('noopener noreferrer');

    // Unsafe script & javascript URL stripped
    expect(wrapper.html()).not.toContain('<script');
    expect(wrapper.html()).not.toContain('javascript:');

    // Fenced codeblock rendered safely inside pre > code
    const preCode = wrapper.find('pre code');
    expect(preCode.exists()).toBe(true);
    expect(preCode.text()).toBe('git pull && python run.py');
  });
});
