<template>
  <div ref="containerRef" class="remotion-player-container w-full h-full relative" />
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { RemotionPlayerView } from './preview/RemotionPlayerView'
import type { DirectPlayerBridge } from '../utils/playerBridge'

const props = withDefaults(defineProps<{
  bridge: DirectPlayerBridge
  compositionWidth?: number
  compositionHeight?: number
}>(), {
  compositionWidth: 1080,
  compositionHeight: 1920
})

const containerRef = ref<HTMLDivElement | null>(null)
let reactRoot: Root | null = null

function renderPlayer() {
  if (!reactRoot && containerRef.value) {
    reactRoot = createRoot(containerRef.value)
  }
  if (reactRoot) {
    reactRoot.render(
      React.createElement(RemotionPlayerView, {
        bridge: props.bridge,
        compositionWidth: props.compositionWidth,
        compositionHeight: props.compositionHeight
      })
    )
  }
}

onMounted(() => {
  renderPlayer()
})

watch(() => [props.bridge, props.compositionWidth, props.compositionHeight], () => {
  renderPlayer()
})

onBeforeUnmount(() => {
  if (reactRoot) {
    reactRoot.unmount()
    reactRoot = null
  }
})
</script>
