// useInteractiveText.ts - Encapsulates dynamic web font preloading, Konva stage text transformations, and contenteditable HTML inputs
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useClipperState } from './useClipperState'

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

  function hexToRgba(hex: string, opacity: number) {
    let c = hex.replace('#', '')
    if (c.length === 3) {
      c = c.charAt(0) + c.charAt(0) + c.charAt(1) + c.charAt(1) + c.charAt(2) + c.charAt(2)
    }
    const r = parseInt(c.substring(0, 2), 16)
    const g = parseInt(c.substring(2, 4), 16)
    const b = parseInt(c.substring(4, 6), 16)
    return `rgba(${r}, ${g}, ${b}, ${opacity})`
  }

  function getEditingStyle(item: any) {
    const showBackground = item.showBackground
    const bgColor = item.backgroundColor || '#000000'
    const bgOpacity = item.showBackground ? (item.backgroundOpacity ?? 0.7) : 0
    const color = item.color || '#FFFFFF'
    const fontSize = item.fontSize || 80
    const fontFamily = item.font || 'Outfit'
    const fontWeight = item.fontWeight ? String(item.fontWeight) : '900'
    const textTransform = item.textTransform || 'none'
    const align = item.align || 'center'
    const lineHeight = item.lineHeight ?? 1.1
    const letterSpacing = item.letterSpacing ?? 0
    const opacity = item.opacity ?? 1
    const padding = '15px'
    
    const showStroke = item.showStroke
    const strokeWidth = showStroke ? (item.strokeWidth ?? 5) : 0
    const strokeColor = item.strokeColor || '#000000'
    
    const shadowColor = item.shadowColor || '#000000'
    const shadowBlur = item.shadowBlur ?? 10
    const shadowOffsetX = item.shadowOffsetX ?? 5
    const shadowOffsetY = item.shadowOffsetY ?? 5
    const shadowOpacity = item.shadowOpacity ?? 0.5
    
    const rgbaBg = showBackground ? hexToRgba(bgColor, bgOpacity) : 'transparent'
    const rgbaShadow = hexToRgba(shadowColor, shadowOpacity)
    
    return {
      position: 'absolute' as const,
      left: `${item.x ?? 540}px`,
      top: `${item.y ?? 960}px`,
      
      fontFamily: `"${fontFamily}", sans-serif`,
      fontSize: `${fontSize}px`,
      fontWeight: fontWeight,
      textTransform: textTransform,
      textAlign: align,
      lineHeight: lineHeight,
      letterSpacing: `${letterSpacing}px`,
      color: color,
      opacity: opacity,
      
      backgroundColor: rgbaBg,
      borderRadius: '10px',
      padding: padding,
      
      '-webkit-text-stroke': showStroke ? `${strokeWidth}px ${strokeColor}` : 'none',
      textShadow: `${shadowOffsetX}px ${shadowOffsetY}px ${shadowBlur}px ${rgbaShadow}`,
      
      caretColor: color,
      minWidth: '100px',
      minHeight: '1em',
      maxWidth: '1000px',
      display: 'inline-block',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word' as const,
    }
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
