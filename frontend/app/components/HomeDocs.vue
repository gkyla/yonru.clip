<template>
  <div class="w-full max-w-4xl z-10 flex flex-col mt-12 mb-10">
    <h2 class="text-4xl font-bold tracking-tight text-white mb-4">Documentation</h2>
    <p class="text-slate-400 mb-8">Learn how to use Yonru to its full potential.</p>

    <div class="bg-surface-panel border border-surface-border rounded-xl overflow-hidden shadow-xl">
      <div class="p-6 border-b border-surface-border">
        <h3 class="text-xl font-bold text-white mb-2">Getting Started</h3>
        <p class="text-sm text-slate-400">Follow these simple steps to start clipping videos.</p>
      </div>

      <div class="p-6 flex flex-col gap-8">
        <!-- Step 1 -->
        <div class="flex gap-4">
          <div class="w-8 h-8 rounded-full bg-accent-500/10 border border-accent-500/30 text-accent-500 flex items-center justify-center font-bold shrink-0">1</div>
          <div>
            <h4 class="text-white font-bold mb-1">Paste a YouTube URL</h4>
            <p class="text-sm text-slate-400">Head over to the Home tab and paste any valid YouTube video link (Long form or Shorts). Yonru will automatically analyze the transcript and download the 1080p source.</p>
          </div>
        </div>

        <!-- Step 2 -->
        <div class="flex gap-4">
          <div class="w-8 h-8 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-500 flex items-center justify-center font-bold shrink-0">2</div>
          <div>
            <h4 class="text-white font-bold mb-1">Select an AI Prompt</h4>
            <p class="text-sm text-slate-400">Before analyzing, choose the right AI Prompt from the dropdown. This tells Gemini what kind of hooks or viral moments to look for in the video.</p>
          </div>
        </div>

        <!-- Step 3 -->
        <div class="flex gap-4">
          <div class="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-500 flex items-center justify-center font-bold shrink-0">3</div>
          <div>
            <h4 class="text-white font-bold mb-1">Review & Edit</h4>
            <p class="text-sm text-slate-400">Once the AI generates the hooks, select one to enter the Editor. Here you can tweak the subtitle styles, adjust the timing precisely, and save the segment.</p>
          </div>
        </div>

        <!-- Step 4 -->
        <div class="flex gap-4">
          <div class="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 flex items-center justify-center font-bold shrink-0">4</div>
          <div>
            <h4 class="text-white font-bold mb-1">Render the Clip</h4>
            <p class="text-sm text-slate-400">Click Export in the Editor to bake your subtitles and edits into a final MP4 ready for TikTok, Shorts, or Reels!</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
</script>
