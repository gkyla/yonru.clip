<template>
  <div class="changelog-remote-markdown">
    <template v-for="(block, idx) in blocks" :key="idx">
      <ChangelogCategoryHeading v-if="block.type === 'heading'" :id="block.id">
        {{ block.text }}
      </ChangelogCategoryHeading>

      <p v-else-if="block.type === 'paragraph'">
        <InlineRuns :spans="block.inlines" />
      </p>

      <ListItems v-else-if="block.type === 'list'" :items="block.items" />

      <pre
        v-else-if="block.type === 'codeblock'"
        class="mb-4 overflow-x-auto rounded-xl bg-[#09090b]/90 border border-white/10 p-3.5 text-xs font-mono text-slate-100"
      ><code>{{ block.code }}</code></pre>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, h, type VNode } from 'vue';
import ChangelogCategoryHeading from './ChangelogCategoryHeading.vue';
import {
  parseChangelogMarkdown,
  type ChangelogListItemNode,
  type InlineSpan
} from '~/utils/changelogMarkdown';

const props = defineProps<{
  markdown: string;
}>();

const blocks = computed(() => parseChangelogMarkdown(props.markdown));

function renderSpan(span: InlineSpan): string | VNode {
  if (span.type === 'strong') return h('strong', span.text);
  if (span.type === 'em') return h('em', span.text);
  if (span.type === 'code') return h('code', span.text);
  if (span.type === 'link') {
    return h(
      'a',
      {
        href: span.href,
        target: '_blank',
        rel: 'noopener noreferrer'
      },
      span.text
    );
  }
  return span.text;
}

function InlineRuns(runProps: { spans: InlineSpan[] }): (string | VNode)[] {
  return runProps.spans.map(renderSpan);
}

function ListItems(listProps: { items: ChangelogListItemNode[] }): VNode {
  return h(
    'ul',
    listProps.items.map(item => {
      const children: Array<string | VNode | (string | VNode)[]> = [
        item.inlines.map(renderSpan)
      ];
      if (item.children.length > 0) {
        children.push(ListItems({ items: item.children }));
      }
      return h('li', children);
    })
  );
}
</script>
