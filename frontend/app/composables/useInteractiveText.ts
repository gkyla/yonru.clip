// useInteractiveText.ts - Encapsulates dynamic web font preloading, Konva stage text transformations, and contenteditable HTML inputs
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useClipperState } from './useClipperState'
import { getEditingStyle } from '../utils/styleHelpers'

export const useInteractiveText = (
  transformerRef: { value: any }
) => {
  const state = useClipperState()
  
  // Font loading sync
  const fontsLoaded = ref(0)
  const loadedFonts = new Set<string>()

  const allUsedFonts = computed(() => {
    const fonts = new Set<string>()
    state.thumbnailTextOverlays.value.forEach(o => {
      fonts.add(`${o.fontWeight || 900}-${o.fontFamily || 'Montserrat'}`)
    })
    const track = state.timelineTracks.value.find(t => t.id === 'text')
    if (track && track.items) {
      track.items.forEach((item: any) => {
        fonts.add(`${item.fontWeight || 900}-${item.font || 'Outfit'}`)
      })
    }
    return Array.from(fonts)
  })

  watch(allUsedFonts, (fontKeys) => {
    if (typeof document === 'undefined' || !(document as any).fonts) return
    fontKeys.forEach(fontKey => {
      if (!loadedFonts.has(fontKey)) {
        loadedFonts.add(fontKey)
        const parts = fontKey.split('-')
        const weight = parts[0]
        const family = parts.slice(1).join('-')
        
        ;(document as any).fonts.load(`${weight} 10px "${family}"`).then(() => {
          fontsLoaded.value++
        }).catch((e: any) => console.warn('Font load error:', e))
      }
    })
  }, { immediate: true, deep: true })

  onMounted(() => {
    if (typeof document !== 'undefined' && (document as any).fonts) {
      ;(document as any).fonts.ready.then(() => {
        fontsLoaded.value++
      })
    }
  })

  // Timeline Text Overlays
  const activeTextItems = computed(() => {
    const textTrack = state.timelineTracks.value.find(t => t.id === 'text')
    if (!textTrack) return []
    return textTrack.items.filter((item: any) => 
      state.currentTime.value >= item.start && 
      state.currentTime.value <= (item.start + item.duration)
    )
  })

  function onTextDragEnd(e: any, item: any) {
    item.x = Math.round(e.target.x())
    item.y = Math.round(e.target.y())
  }

  function isCurrentItemActive(item: any) {
    if (!item) return false
    return state.currentTime.value >= item.start && state.currentTime.value <= (item.start + item.duration)
  }

  const isTimelineTextActiveAndSelected = computed(() => {
    const item = state.selectedTimelineItem.value
    if (!item || item.type !== 'text' || editingItemId.value === item.id) return false
    return isCurrentItemActive(item)
  })

  function updateTransformer() {
    if (!transformerRef.value) return
    const transformerNode = transformerRef.value.getNode()
    const stage = transformerNode.getStage()
    if (!stage) return

    const item = state.selectedTimelineItem.value
    if (item && item.type === 'text' && isTimelineTextActiveAndSelected.value) {
      const selectedNode = stage.findOne('.' + item.id)
      if (selectedNode) {
        transformerNode.nodes([selectedNode])
        transformerNode.getLayer().batchDraw()
        return
      }
    }
    transformerNode.nodes([])
    transformerNode.getLayer().batchDraw()
  }

  watch([() => state.selectedTimelineItem.value, () => state.currentTime.value, isTimelineTextActiveAndSelected], () => {
    nextTick(() => {
      updateTransformer()
    })
  })

  function handleTransform(e: any, item: any) {
    const node = e.target
    const scaleX = node.scaleX()
    const currentFontSize = item.fontSize || 80
    const newSize = Math.max(12, Math.round(currentFontSize * scaleX))
    item.fontSize = newSize
    node.scaleX(1)
    node.scaleY(1)
    const width = node.width()
    const height = node.height()
    node.offsetX(width / 2)
    node.offsetY(height / 2)
    node.getLayer().batchDraw()
  }

  function onLabelRender(e: any) {
    const node = e.target
    const width = node.width()
    const height = node.height()
    node.offsetX(width / 2)
    node.offsetY(height / 2)
  }

  function handleStageClick(e: any) {
    const clickedOnStage = e.target === e.target.getStage()
    if (clickedOnStage) {
      state.selectedTimelineItem.value = null
    }
  }

  function handleMouseEnterLabel(e: any) {
    const stage = e.target.getStage()
    if (stage) stage.container().style.cursor = 'move'
  }

  function handleMouseLeaveLabel(e: any) {
    const stage = e.target.getStage()
    if (stage) stage.container().style.cursor = ''
  }

  function selectItem(item: any) {
    state.selectedTimelineItem.value = item
  }

  // Inline Text Editing State & Logic
  const editingItemId = ref<string | null>(null)
  const originalContent = ref<string>('')
  const editingInputRef = ref<HTMLElement | null>(null)

  const setEditingInputRef = (el: any) => {
    editingInputRef.value = el
  }



  function startEditing(item: any) {
    editingItemId.value = item.id
    originalContent.value = item.content || ''
    nextTick(() => {
      const el = editingInputRef.value
      if (el) {
        el.innerText = item.content || ''
        el.focus()
        
        const range = document.createRange()
        range.selectNodeContents(el)
        const sel = window.getSelection()
        sel?.removeAllRanges()
        sel?.addRange(range)
      }
    })
  }

  function stopEditing(item: any, shouldSave = true) {
    if (editingItemId.value === item.id) {
      if (shouldSave) {
        const el = editingInputRef.value
        if (el) {
          item.content = el.innerText.trim() || 'NEW TEXT'
        }
      } else {
        item.content = originalContent.value
      }
      editingItemId.value = null
      state.saveTimelineTracks()
    }
  }

  function handleEditingKeydown(e: KeyboardEvent, item: any) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      stopEditing(item, true)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      stopEditing(item, false)
    }
  }

  function onEditingInput(e: any, item: any) {
    item.content = e.target.innerText
  }

  return {
    fontsLoaded,
    activeTextItems,
    isTimelineTextActiveAndSelected,
    editingItemId,
    originalContent,
    editingInputRef,
    setEditingInputRef,
    onTextDragEnd,
    updateTransformer,
    handleTransform,
    onLabelRender,
    handleStageClick,
    handleMouseEnterLabel,
    handleMouseLeaveLabel,
    selectItem,
    getEditingStyle,
    startEditing,
    stopEditing,
    handleEditingKeydown,
    onEditingInput
  }
}
