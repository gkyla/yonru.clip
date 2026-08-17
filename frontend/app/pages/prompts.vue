<template>
  <HomePrompts ref="homePromptsRef" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'

const homePromptsRef = ref<any>(null)

onBeforeRouteLeave((to, from) => {
  if (homePromptsRef.value?.handleRouteLeave) {
    return homePromptsRef.value.handleRouteLeave(to, from)
  }
  return true
})
</script>
