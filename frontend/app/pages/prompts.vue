<template>
  <NuxtLayout>
    <HomePrompts ref="homePromptsRef" />
  </NuxtLayout>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'

const homePromptsRef = ref<any>(null)

onBeforeRouteLeave((to, from, next) => {
  if (homePromptsRef.value?.handleRouteLeave) {
    homePromptsRef.value.handleRouteLeave(to, from, next)
  } else {
    next()
  }
})
</script>
