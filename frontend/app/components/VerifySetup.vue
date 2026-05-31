<script setup lang="ts">
import { ref } from 'vue'

const count = ref(0)
function increment() {
  count.value++
}
</script>

<template>
  <div class="verify-setup p-4 bg-slate-900 text-white rounded-lg">
    <p data-testid="title">Nuxt Testing Environment Ready</p>
    <button data-testid="btn-increment" @click="increment">
      Count: {{ count }}
    </button>
  </div>
</template>
