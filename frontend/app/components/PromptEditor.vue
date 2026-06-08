<template>
  <ClientOnly>
    <div class="w-full bg-[#111318] border border-surface-border rounded-lg overflow-hidden focus-within:border-accent-500/50 transition-all flex flex-col min-h-[400px]">
      <!-- Toolbar -->
      <div v-if="editor" class="flex flex-wrap items-center gap-1 p-2 border-b border-surface-border bg-surface-dark/50">
        <button 
          @click="editor.chain().focus().toggleBold().run()"
          :class="{ 'bg-accent-500 text-black': editor.isActive('bold'), 'text-slate-400 hover:text-white hover:bg-surface-panel': !editor.isActive('bold') }"
          class="p-1.5 rounded transition-all"
          title="Bold"
        >
          <Icon name="ri:bold" class="text-lg" />
        </button>
        <button 
          @click="editor.chain().focus().toggleItalic().run()"
          :class="{ 'bg-accent-500 text-black': editor.isActive('italic'), 'text-slate-400 hover:text-white hover:bg-surface-panel': !editor.isActive('italic') }"
          class="p-1.5 rounded transition-all"
          title="Italic"
        >
          <Icon name="ri:italic" class="text-lg" />
        </button>
        <button 
          @click="editor.chain().focus().toggleCode().run()"
          :class="{ 'bg-accent-500 text-black': editor.isActive('code'), 'text-slate-400 hover:text-white hover:bg-surface-panel': !editor.isActive('code') }"
          class="p-1.5 rounded transition-all"
          title="Inline Code"
        >
          <Icon name="ri:code-line" class="text-lg" />
        </button>
        
        <div class="w-px h-4 bg-surface-border mx-1"></div>
        
        <button 
          @click="editor.chain().focus().toggleBulletList().run()"
          :class="{ 'bg-accent-500 text-black': editor.isActive('bulletList'), 'text-slate-400 hover:text-white hover:bg-surface-panel': !editor.isActive('bulletList') }"
          class="p-1.5 rounded transition-all"
          title="Bullet List"
        >
          <Icon name="ri:list-unordered" class="text-lg" />
        </button>
        <button 
          @click="editor.chain().focus().toggleOrderedList().run()"
          :class="{ 'bg-accent-500 text-black': editor.isActive('orderedList'), 'text-slate-400 hover:text-white hover:bg-surface-panel': !editor.isActive('orderedList') }"
          class="p-1.5 rounded transition-all"
          title="Ordered List"
        >
          <Icon name="ri:list-ordered" class="text-lg" />
        </button>
        <button 
          @click="editor.chain().focus().toggleCodeBlock().run()"
          :class="{ 'bg-accent-500 text-black': editor.isActive('codeBlock'), 'text-slate-400 hover:text-white hover:bg-surface-panel': !editor.isActive('codeBlock') }"
          class="p-1.5 rounded transition-all"
          title="Code Block"
        >
          <Icon name="ri:code-box-line" class="text-lg" />
        </button>

        <div class="w-px h-4 bg-surface-border mx-1"></div>

        <button 
          @click="editor.chain().focus().undo().run()"
          class="p-1.5 text-slate-400 hover:text-white hover:bg-surface-panel rounded transition-all"
          title="Undo"
        >
          <Icon name="ri:arrow-go-back-line" class="text-lg" />
        </button>
        <button 
          @click="editor.chain().focus().redo().run()"
          class="p-1.5 text-slate-400 hover:text-white hover:bg-surface-panel rounded transition-all"
          title="Redo"
        >
          <Icon name="ri:arrow-go-forward-line" class="text-lg" />
        </button>
      </div>

      <!-- Editor Content -->
      <editor-content :editor="editor" class="flex-1 custom-scrollbar overflow-y-auto p-4" />
    </div>
  </ClientOnly>
</template>

<script setup lang="ts">
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { watch, onBeforeUnmount } from 'vue'

const props = defineProps<{
  modelValue: string
  variables?: Record<string, string>
}>()

const emit = defineEmits(['update:modelValue'])

const VariableHighlight = Extension.create({
  name: 'variableHighlight',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('variableHighlight'),
        state: {
          init(config, state) {
            const decorations: Decoration[] = []
            
            state.doc.descendants((node, pos) => {
              if (node.isText && node.text) {
                const regex = /\{([a-zA-Z0-9_]+)\}/g
                let match
                while ((match = regex.exec(node.text)) !== null) {
                  const fullMatch = match[0]
                  const varName = match[1]
                  const varValue = props.variables?.[varName] || fullMatch
                  
                  decorations.push(
                    Decoration.inline(pos + match.index, pos + match.index + fullMatch.length, {
                      class: 'tiptap-variable-badge',
                      'data-variable': varName,
                      'data-value': varValue,
                      title: `Variable: {${varName}}`,
                    })
                  )
                }
              }
            })
            
            return DecorationSet.create(state.doc, decorations)
          },
          apply(tr, old) {
            const decorations: Decoration[] = []
            
            tr.doc.descendants((node, pos) => {
              if (node.isText && node.text) {
                const regex = /\{([a-zA-Z0-9_]+)\}/g
                let match
                while ((match = regex.exec(node.text)) !== null) {
                  const fullMatch = match[0]
                  const varName = match[1]
                  const varValue = props.variables?.[varName] || fullMatch
                  
                  decorations.push(
                    Decoration.inline(pos + match.index, pos + match.index + fullMatch.length, {
                      class: 'tiptap-variable-badge',
                      'data-variable': varName,
                      'data-value': varValue,
                      title: `Variable: {${varName}}`,
                    })
                  )
                }
              }
            })
            
            return DecorationSet.create(tr.doc, decorations)
          },
        },
        props: {
          decorations(state) {
            return this.getState(state)
          },
        },
      }),
    ]
  },
})

const editor = useEditor({
  content: props.modelValue,
  extensions: [
    StarterKit.configure({
      codeBlock: {
        HTMLAttributes: {
          class: 'bg-surface-dark p-3 rounded-md font-mono text-xs my-2 border border-surface-border',
        },
      },
    }),
    VariableHighlight,
  ],
  editorProps: {
    attributes: {
      class: 'prose prose-invert max-w-none focus:outline-none text-sm leading-relaxed min-h-full',
    },
  },
  onUpdate: ({ editor }) => {
    emit('update:modelValue', editor.getHTML())
  },
})

// Sync external changes to editor
watch(() => props.modelValue, (newValue) => {
  if (editor.value && newValue !== editor.value.getHTML()) {
    editor.value.commands.setContent(newValue, { emitUpdate: false })
  }
})

// Force update Prosemirror decorations when external variables change
watch(() => props.variables, () => {
  if (editor.value && editor.value.view) {
    const view = editor.value.view
    view.dispatch(view.state.tr.setMeta('forceUpdate', true))
  }
}, { deep: true })

defineExpose({
  editor
})

onBeforeUnmount(() => {
  editor.value?.destroy()
})
</script>

<style lang="postcss">
.tiptap p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  float: left;
  color: #64748b;
  pointer-events: none;
  height: 0;
}

.tiptap {
  @apply text-slate-200;
  
  & p {
    @apply my-2;
  }

  & ul {
    @apply list-disc ml-5 my-2;
  }

  & ol {
    @apply list-decimal ml-5 my-2;
  }

  & code {
    @apply bg-surface-dark px-1.5 py-0.5 rounded text-accent-500 font-mono text-[13px];
  }

  & pre {
    @apply bg-surface-dark p-4 rounded-lg my-4 font-mono text-xs border border-surface-border overflow-x-auto;
    & code {
      @apply bg-transparent p-0 text-slate-300;
    }
  }

  & strong {
    @apply text-white font-bold;
  }

  & em {
    @apply italic text-slate-300;
  }
}

.tiptap-variable-badge {
  font-size: 0 !important;
  display: inline-flex !important;
  align-items: center;
  vertical-align: middle;
}

.tiptap-variable-badge::before {
  content: attr(data-value);
  font-size: 13px !important;
  font-family: monospace;
  font-weight: 500;
  color: #CFFF50; /* accent-500 */
  background: rgba(207, 255, 80, 0.12); /* accent-500/12 */
  border: 1px dashed rgba(207, 255, 80, 0.4);
  padding: 1px 5px;
  border-radius: 4px;
  margin: 0 2px;
  white-space: pre-wrap;
  display: inline-block;
  vertical-align: middle;
}

.tiptap-variable-badge::after {
  content: "{" attr(data-variable) "}";
  font-size: 9px !important;
  font-family: monospace;
  color: #64748b; /* slate-500 */
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 0 3px;
  border-radius: 3px;
  margin-left: 4px;
  font-weight: bold;
  vertical-align: middle;
  display: inline-block;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.06); 
  border-radius: 0;
}
</style>
