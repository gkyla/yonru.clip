<template>
  <div class="w-full max-w-5xl z-10 flex flex-col mt-6 mb-10 gap-5">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-border/50 pb-5">
      <div>
        <h2 class="text-3xl font-bold tracking-tight text-white mb-1 flex items-center gap-2.5">
          <span>Settings</span>
        </h2>
        <p class="text-slate-400 text-sm">Configure your API keys, local software tools, and transcription engines.</p>
      </div>

      <!-- Quick Health Refresh Action -->
      <button 
        @click="checkSystemHealth" 
        :disabled="checkingHealth"
        class="flex items-center gap-1.5 px-3.5 py-2 bg-surface-dark/80 hover:bg-surface-dark border border-surface-border hover:border-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-medium transition-all disabled:opacity-50 self-start sm:self-auto cursor-pointer shadow-sm"
      >
        <Icon name="ri:refresh-line" :class="{ 'animate-spin': checkingHealth }" class="text-accent-500 text-sm" />
        {{ checkingHealth ? 'Checking Health...' : 'Refresh Health' }}
      </button>
    </div>

    <!-- Global Prerequisite Alert Banner -->
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0 -translate-y-4"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-4"
    >
      <div 
        v-if="state.isAnyPrerequisiteMissing.value"
        class="p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div class="flex items-start sm:items-center gap-3">
          <div class="p-2 rounded-xl bg-amber-500/10 text-amber-400 shrink-0">
            <Icon :name="warningDetails.icon" class="text-lg" />
          </div>
          <div>
            <h4 class="text-sm font-bold text-white leading-snug">{{ warningDetails.title }}</h4>
            <p class="text-xs text-slate-400 mt-0.5 leading-relaxed">{{ warningDetails.description }}</p>
          </div>
        </div>
        
        <button 
          @click="switchTab(normalizeTab(firstMissingPrerequisiteSection))"
          class="px-3.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 font-bold text-xs rounded-lg transition-all shrink-0 self-start sm:self-center cursor-pointer"
        >
          {{ warningDetails.buttonText }}
        </button>
      </div>
    </Transition>

    <!-- Two-Column Settings Layout -->
    <div class="flex flex-col md:flex-row gap-6 items-start w-full">
      <!-- Left Column / Navigation Sidebar -->
      <aside class="w-full md:w-60 lg:w-64 shrink-0 flex flex-col gap-3 md:sticky md:top-2 self-start">
        <!-- Navigation Panel -->
        <div ref="navContainerRef" class="bg-surface-panel border border-surface-border rounded-2xl p-2 flex flex-row md:flex-col gap-1 shadow-xl overflow-x-auto md:overflow-visible custom-scrollbar relative">
          <!-- Animated Sliding Indicator Line (Desktop) -->
          <div 
            class="hidden md:block absolute left-0 w-[2.5px] bg-accent-500 rounded-r-full pointer-events-none transition-all duration-300 ease-out shadow-[0_0_8px_rgba(207,255,80,0.4)]"
            :style="{
              top: `${indicatorTop}px`,
              height: `${indicatorHeight}px`,
              opacity: indicatorOpacity
            }"
          ></div>

          <div class="px-3 pt-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 hidden md:block">
            Preferences
          </div>

          <button
            v-for="section in sections"
            :key="section.id"
            :ref="(el) => setButtonRef(section.id, el)"
            @click="switchTab(section.id)"
            class="flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all duration-150 group relative shrink-0 cursor-pointer outline-none select-none min-h-[42px] md:min-h-0"
            :class="activeTab === section.id 
              ? 'text-white font-medium bg-surface-dark/40' 
              : 'text-slate-400 hover:text-slate-200 hover:bg-surface-dark/30'"
          >
            <div class="flex items-center gap-2.5 min-w-0">
              <Icon 
                :name="section.icon" 
                class="text-base shrink-0 transition-colors" 
                :class="activeTab === section.id ? 'text-accent-500' : 'text-slate-500 group-hover:text-slate-300'"
              />
              <div class="flex flex-col min-w-0">
                <span class="text-xs truncate font-medium leading-tight" :class="activeTab === section.id ? 'text-white' : 'text-slate-300 group-hover:text-white'">
                  {{ section.label }}
                </span>
                <span class="text-[10px] text-slate-500 hidden md:block truncate mt-1 leading-none">
                  {{ section.desc }}
                </span>
              </div>
            </div>

            <!-- Status Badges (Subtle / Monochromatic) -->
            <div v-if="section.badgeType !== 'none'" class="ml-2 shrink-0 flex items-center">
              <!-- Warning Pill -->
              <span 
                v-if="section.badgeType === 'warning'"
                class="text-[9px] px-1.5 py-0.5 rounded font-mono font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20"
              >
                {{ section.badgeText }}
              </span>

              <!-- Neutral / Info Pill -->
              <span 
                v-else-if="section.badgeText"
                class="text-[9px] px-1.5 py-0.5 rounded font-mono font-medium bg-black/40 border border-white/5 text-slate-400"
              >
                {{ section.badgeText }}
              </span>
            </div>
          </button>

          <!-- Discreet Footer Notice -->
          <div class="hidden md:flex items-center gap-1.5 px-3 pt-3 pb-1 mt-1 border-t border-surface-border/40 text-[11px] text-slate-500">
            <Icon name="ri:lock-line" class="text-slate-400 shrink-0 text-xs" />
            <span class="truncate">Stored locally in <code class="font-mono text-slate-400 text-[10px]">.env</code></span>
          </div>
        </div>
      </aside>

      <!-- Right Column / Active Section Panel -->
      <main class="flex-1 min-w-0 w-full bg-surface-panel border border-surface-border rounded-2xl p-6 sm:p-8 shadow-xl relative min-h-[560px] self-start">
        <Transition name="section-fade" mode="out-in">
          
          <!-- System Health Diagnostics Dashboard -->
          <div v-if="activeTab === 'health'" key="health" id="settings-health" class="scroll-mt-24 flex flex-col gap-6">
            <div>
              <div class="flex justify-between items-center mb-2">
                <h3 class="text-lg font-bold text-white flex items-center gap-2">
                  <Icon name="ri:shield-cross-line" class="text-accent-500" />
                  <span>Prerequisite Health & Diagnostics</span>
                </h3>
                <span 
                  class="text-[10px] font-mono font-medium px-2 py-0.5 rounded flex items-center gap-1.5"
                  :class="isHealthOk ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'"
                >
                  <span class="w-1.5 h-1.5 rounded-full" :class="isHealthOk ? 'bg-emerald-400' : 'bg-amber-400'"></span>
                  {{ isHealthOk ? 'Operational' : 'Action Required' }}
                </span>
              </div>
              <p class="text-sm text-slate-400">Verify the health and directory paths of local software components and APIs required for rendering and AI generation.</p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <!-- FFmpeg Diagnostics -->
              <div class="p-3.5 rounded-xl border bg-surface-dark/40 border-surface-border/60 flex flex-col gap-2.5">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <Icon name="ri:movie-2-line" class="text-accent-500 text-sm" />
                    <span class="text-xs font-bold text-slate-200">FFmpeg</span>
                  </div>
                  <span 
                    class="text-[9px] px-1.5 py-0.5 rounded font-mono font-medium flex items-center gap-1"
                    :class="healthData?.ffmpeg?.status === 'OK' ? 'bg-black/40 border border-white/5 text-emerald-400' : 'bg-amber-500/10 border border-amber-500/20 text-amber-400'"
                  >
                    <span class="w-1 h-1 rounded-full" :class="healthData?.ffmpeg?.status === 'OK' ? 'bg-emerald-400' : 'bg-amber-400'"></span>
                    {{ healthData?.ffmpeg?.status || 'Detecting...' }}
                  </span>
                </div>
                <p class="text-[11px] text-slate-500 truncate font-mono" :title="healthData?.ffmpeg?.path">
                  {{ healthData?.ffmpeg?.path ? `Path: ${healthData.ffmpeg.path}` : 'Path: Not detected' }}
                </p>
                <!-- If missing: 1-click copy install command & docs link -->
                <div v-if="healthData && healthData.ffmpeg?.status !== 'OK'" class="pt-2 border-t border-surface-border/40 flex flex-col gap-1.5">
                  <span class="text-[10px] text-amber-400 font-medium">Missing dependency</span>
                  <div class="flex items-center justify-between gap-2 bg-[#0c0e14] border border-surface-border/60 rounded-lg px-2.5 py-1.5 text-[10px] font-mono text-slate-300">
                    <span class="truncate">brew install ffmpeg</span>
                    <div class="flex items-center gap-2 shrink-0">
                      <button 
                        @click="copyToClipboard('brew install ffmpeg', 'FFmpeg install command')" 
                        class="text-slate-400 hover:text-white transition-colors cursor-pointer"
                        title="Copy macOS brew command"
                      >
                        <Icon name="ri:file-copy-line" class="text-xs" />
                      </button>
                      <a href="https://ffmpeg.org" target="_blank" class="text-slate-500 hover:text-slate-300 transition-colors" title="Official Website">
                        <Icon name="ri:external-link-line" class="text-xs" />
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Node.js Diagnostics -->
              <div class="p-3.5 rounded-xl border bg-surface-dark/40 border-surface-border/60 flex flex-col gap-2.5">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <Icon name="ri:nodejs-line" class="text-accent-500 text-sm" />
                    <span class="text-xs font-bold text-slate-200">Node.js</span>
                  </div>
                  <span 
                    class="text-[9px] px-1.5 py-0.5 rounded font-mono font-medium flex items-center gap-1"
                    :class="healthData?.node?.status === 'OK' ? 'bg-black/40 border border-white/5 text-emerald-400' : 'bg-amber-500/10 border border-amber-500/20 text-amber-400'"
                  >
                    <span class="w-1 h-1 rounded-full" :class="healthData?.node?.status === 'OK' ? 'bg-emerald-400' : 'bg-amber-400'"></span>
                    {{ healthData?.node?.status || 'Detecting...' }}
                  </span>
                </div>
                <p class="text-[11px] text-slate-500 truncate font-mono" :title="healthData?.node?.path">
                  {{ healthData?.node?.path ? `Path: ${healthData.node.path}` : 'Path: Not detected' }}
                </p>
                <!-- If missing: 1-click copy install command & docs link -->
                <div v-if="healthData && healthData.node?.status !== 'OK'" class="pt-2 border-t border-surface-border/40 flex flex-col gap-1.5">
                  <span class="text-[10px] text-amber-400 font-medium">Missing dependency</span>
                  <div class="flex items-center justify-between gap-2 bg-[#0c0e14] border border-surface-border/60 rounded-lg px-2.5 py-1.5 text-[10px] font-mono text-slate-300">
                    <span class="truncate">brew install node</span>
                    <div class="flex items-center gap-2 shrink-0">
                      <button 
                        @click="copyToClipboard('brew install node', 'Node.js install command')" 
                        class="text-slate-400 hover:text-white transition-colors cursor-pointer"
                        title="Copy macOS brew command"
                      >
                        <Icon name="ri:file-copy-line" class="text-xs" />
                      </button>
                      <a href="https://nodejs.org" target="_blank" class="text-slate-500 hover:text-slate-300 transition-colors" title="Official Website">
                        <Icon name="ri:external-link-line" class="text-xs" />
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Python Virtual Environment Diagnostics -->
              <div class="p-3.5 rounded-xl border bg-surface-dark/40 border-surface-border/60 flex flex-col gap-2.5">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <Icon name="ri:terminal-box-line" class="text-accent-500 text-sm" />
                    <span class="text-xs font-bold text-slate-200">Python Virtualenv</span>
                  </div>
                  <span 
                    class="text-[9px] px-1.5 py-0.5 rounded font-mono font-medium flex items-center gap-1"
                    :class="healthData?.python_env?.status === 'OK' ? 'bg-black/40 border border-white/5 text-emerald-400' : 'bg-amber-500/10 border border-amber-500/20 text-amber-400'"
                  >
                    <span class="w-1 h-1 rounded-full" :class="healthData?.python_env?.status === 'OK' ? 'bg-emerald-400' : 'bg-amber-400'"></span>
                    {{ healthData?.python_env?.status || 'Detecting...' }}
                  </span>
                </div>
                <p class="text-[11px] text-slate-500 truncate">
                  FastAPI backend and AI dependencies runtime.
                </p>
                <!-- If missing: 1-click copy install command -->
                <div v-if="healthData && healthData.python_env?.status !== 'OK'" class="pt-2 border-t border-surface-border/40 flex flex-col gap-1.5">
                  <span class="text-[10px] text-amber-400 font-medium">Missing packages</span>
                  <div class="flex items-center justify-between gap-2 bg-[#0c0e14] border border-surface-border/60 rounded-lg px-2.5 py-1.5 text-[10px] font-mono text-slate-300">
                    <span class="truncate">pip install -r requirements.txt</span>
                    <button 
                      @click="copyToClipboard('pip install -r requirements.txt', 'Pip command')" 
                      class="text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
                      title="Copy command"
                    >
                      <Icon name="ri:file-copy-line" class="text-xs" />
                    </button>
                  </div>
                </div>
              </div>

              <!-- Gemini AI Key Card -->
              <div class="p-3.5 rounded-xl border bg-surface-dark/40 border-surface-border/60 flex flex-col gap-2.5">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <Icon name="ri:key-2-line" class="text-accent-500 text-sm" />
                    <span class="text-xs font-bold text-slate-200">Gemini AI Key</span>
                  </div>
                  <span 
                    class="text-[9px] px-1.5 py-0.5 rounded font-mono font-medium flex items-center gap-1"
                    :class="healthData?.gemini_api?.has_key ? 'bg-black/40 border border-white/5 text-emerald-400' : 'bg-amber-500/10 border border-amber-500/20 text-amber-400'"
                  >
                    <span class="w-1 h-1 rounded-full" :class="healthData?.gemini_api?.has_key ? 'bg-emerald-400' : 'bg-amber-400'"></span>
                    {{ healthData?.gemini_api?.has_key ? 'Configured' : 'Missing' }}
                  </span>
                </div>
                <p class="text-[11px] text-slate-500 truncate">
                  AI transcript analysis and hook title detection.
                </p>
                <div v-if="healthData && !healthData.gemini_api?.has_key" class="pt-2 border-t border-surface-border/40 flex items-center justify-between">
                  <span class="text-[10px] text-amber-400 font-medium">Key not configured</span>
                  <button 
                    @click="switchTab('api')" 
                    class="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
                  >
                    Configure API Key &rarr;
                  </button>
                </div>
              </div>

              <!-- YouTube Cookies Diagnostics -->
              <div class="p-3.5 rounded-xl border bg-surface-dark/40 border-surface-border/60 flex flex-col gap-2.5 md:col-span-2">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <Icon name="ri:shield-keyhole-line" class="text-accent-500 text-sm" />
                    <span class="text-xs font-bold text-slate-200">YouTube Cookies</span>
                  </div>
                  <span 
                    class="text-[9px] px-1.5 py-0.5 rounded font-mono font-medium flex items-center gap-1"
                    :class="healthData?.cookies?.exists ? 'bg-black/40 border border-white/5 text-emerald-400' : 'bg-black/40 border border-white/5 text-slate-500'"
                  >
                    <span class="w-1 h-1 rounded-full" :class="healthData?.cookies?.exists ? 'bg-emerald-400' : 'bg-slate-600'"></span>
                    {{ healthData?.cookies?.exists ? 'Configured' : 'Optional' }}
                  </span>
                </div>
                <div class="flex items-center justify-between gap-2">
                  <p class="text-[11px] text-slate-500 truncate">
                    {{ healthData?.cookies?.exists ? 'Active cookies.txt file for yt-dlp authentication.' : 'Optional yt-dlp authorization file to bypass download limits.' }}
                  </p>
                  <button 
                    @click="switchTab('cookies')" 
                    class="text-[10px] text-slate-400 hover:text-white underline cursor-pointer shrink-0"
                  >
                    {{ healthData?.cookies?.exists ? 'Manage Cookies &rarr;' : 'Upload Cookies &rarr;' }}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- API Key Setting -->
          <div v-else-if="activeTab === 'api'" key="api" id="settings-api" class="scroll-mt-24 flex flex-col gap-6">
            <div>
              <div class="flex justify-between items-center mb-2">
                <h3 class="text-lg font-bold text-white flex items-center gap-2">
                  <Icon name="ri:key-2-fill" class="text-accent-500" />
                  <span>Gemini API Keys</span>
                </h3>

                <button 
                  v-if="keysList.length > 0"
                  @click="addKey"
                  class="flex items-center gap-1.5 px-3.5 py-1.5 bg-surface-dark hover:bg-surface-card border border-surface-border hover:border-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-medium transition-all shrink-0 cursor-pointer shadow-sm"
                >
                  <Icon name="ri:add-line" class="text-accent-500 text-sm" />
                  <span>Add Fallback Key</span>
                </button>
              </div>
              <p class="text-sm text-slate-400">Configure fallback Gemini API keys to ensure high availability. The first valid key in the list is treated as the Primary key.</p>
            </div>
            
            <TransitionGroup name="list-keys" tag="div" class="flex flex-col gap-2.5 relative">
              <div 
                v-for="(keyItem, index) in keysList" 
                :key="keyItem.id"
                draggable="true"
                @dragstart="dragStart(index, $event)"
                @dragover.prevent
                @dragenter="dragEnter(index)"
                @dragend="dragEnd"
                class="group p-3 rounded-xl border bg-surface-dark/40 border-surface-border/60 hover:border-slate-700/80 transition-all duration-200 flex flex-col gap-2 shadow-sm"
                :class="{ 
                  'border-accent-500 shadow-[0_0_12px_rgba(207,255,80,0.15)]': keyItem.activeFlash,
                  'opacity-30 border-dashed border-accent-500/50 bg-accent-500/5 cursor-grabbing': index === draggedIndex
                }"
              >
                <!-- Main Single-Row Layout -->
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <!-- Left: Drag handle, Order Badge, Reorder buttons -->
                  <div class="flex items-center gap-2 shrink-0">
                    <!-- Drag handle -->
                    <span class="cursor-grab active:cursor-grabbing text-slate-500 hover:text-slate-300 p-0.5 flex items-center justify-center w-5" title="Drag to reorder">
                      <Icon name="ri:draggable" class="text-base" />
                    </span>

                    <!-- Order badge with fixed width for pixel-perfect vertical alignment -->
                    <span 
                      class="text-[10px] font-mono font-medium px-2 py-0.5 rounded-md border flex items-center justify-center gap-1.5 w-[94px] shrink-0 select-none"
                      :class="index === 0 
                        ? 'bg-accent-500/10 border-accent-500/30 text-accent-400 font-bold' 
                        : 'bg-black/40 border-white/5 text-slate-400'"
                    >
                      <span class="w-1.5 h-1.5 rounded-full shrink-0" :class="index === 0 ? 'bg-accent-500' : 'bg-slate-500'"></span>
                      <span class="truncate">#{{ index + 1 }} {{ index === 0 ? 'Primary' : 'Fallback' }}</span>
                    </span>

                    <!-- Compact Reorder Buttons -->
                    <div class="flex items-center bg-black/40 border border-white/5 rounded-md p-0.5 shrink-0">
                      <button 
                        @click="moveKey(index, -1)"
                        :disabled="index === 0"
                        class="p-0.5 text-slate-500 hover:text-white transition-colors disabled:opacity-20 disabled:hover:text-slate-500 cursor-pointer flex items-center justify-center"
                        title="Move Up"
                      >
                        <Icon name="ri:arrow-up-s-line" class="text-xs" />
                      </button>
                      <button 
                        @click="moveKey(index, 1)"
                        :disabled="index === keysList.length - 1"
                        class="p-0.5 text-slate-500 hover:text-white transition-colors disabled:opacity-20 disabled:hover:text-slate-500 cursor-pointer flex items-center justify-center"
                        title="Move Down"
                      >
                        <Icon name="ri:arrow-down-s-line" class="text-xs" />
                      </button>
                    </div>
                  </div>

                  <!-- Middle: Inline Split Columns (Label + Key) -->
                  <div class="flex-1 flex flex-col sm:flex-row items-center gap-2 min-w-0">
                    <!-- Title/Alias input -->
                    <div class="w-full sm:w-1/3 min-w-[120px]">
                      <input 
                        v-model="keyItem.title"
                        type="text"
                        placeholder="Label (e.g. Work Key)" 
                        class="w-full bg-[#0c0e14] border border-surface-border/60 hover:border-slate-700 focus:border-accent-500/50 text-slate-200 placeholder-slate-600 px-2.5 py-1.5 rounded-lg focus:outline-none transition-all text-xs"
                      />
                    </div>

                    <!-- Key input with eye toggle -->
                    <div class="w-full sm:flex-1 relative">
                      <input 
                        v-model="keyItem.value"
                        :type="keyItem.show ? 'text' : 'password'" 
                        placeholder="AIzaSy..." 
                        class="w-full bg-[#0c0e14] border border-surface-border/60 hover:border-slate-700 focus:border-accent-500/50 text-white placeholder-slate-600 px-2.5 py-1.5 rounded-lg focus:outline-none transition-all font-mono text-xs pr-8"
                      />
                      <button 
                        @click="keyItem.show = !keyItem.show" 
                        class="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center justify-center text-slate-500 hover:text-slate-300 transition-colors cursor-pointer p-0.5"
                        :title="keyItem.show ? 'Hide key' : 'Reveal key'"
                      >
                        <Icon :name="keyItem.show ? 'ri:eye-off-line' : 'ri:eye-line'" class="text-xs" />
                      </button>
                    </div>
                  </div>

                  <!-- Right: Status Badge & Delete Button -->
                  <div class="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <!-- Status Badge -->
                    <span 
                      class="text-[9px] px-2 py-0.5 rounded font-mono font-medium flex items-center gap-1 border"
                      :class="{
                        'bg-emerald-500/10 border-emerald-500/20 text-emerald-400': keyItem.status === 'valid',
                        'bg-red-500/10 border-red-500/20 text-red-400': keyItem.status === 'invalid',
                        'bg-black/40 border-white/5 text-slate-500': keyItem.status === 'idle',
                        'bg-amber-500/10 border-amber-500/20 text-amber-400 animate-pulse': keyItem.status === 'testing'
                      }"
                    >
                      <span 
                        class="w-1 h-1 rounded-full"
                        :class="{
                          'bg-emerald-400': keyItem.status === 'valid',
                          'bg-red-400': keyItem.status === 'invalid',
                          'bg-slate-500': keyItem.status === 'idle',
                          'bg-amber-400': keyItem.status === 'testing'
                        }"
                      ></span>
                      {{ keyItem.status === 'valid' ? 'Valid' : keyItem.status === 'invalid' ? 'Invalid' : keyItem.status === 'testing' ? 'Testing...' : 'Not Tested' }}
                    </span>

                    <!-- Delete Button -->
                    <button 
                      @click="removeKey(index)" 
                      class="p-1 text-slate-500 hover:text-red-400 transition-colors cursor-pointer rounded hover:bg-red-500/10"
                      title="Remove Key"
                    >
                      <Icon name="ri:delete-bin-6-line" class="text-xs" />
                    </button>
                  </div>
                </div>

                <!-- Micro Error Drawer (Expanded only when status is invalid) -->
                <div 
                  v-if="keyItem.status === 'invalid' && keyItem.error"
                  class="pt-2 border-t border-red-500/20 flex flex-col gap-2 bg-red-500/5 -mx-3 -mb-3 p-3 rounded-b-xl"
                >
                  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div class="flex items-start gap-1.5 min-w-0">
                      <Icon name="ri:error-warning-line" class="text-sm shrink-0 mt-0.5 text-red-400" />
                      <span class="text-[11px] leading-relaxed text-red-300 font-medium">{{ keyItem.error }}</span>
                    </div>

                    <!-- Inline Action Pills -->
                    <div class="flex items-center gap-1.5 shrink-0 self-start sm:self-center">
                      <a 
                        href="https://aistudio.google.com/app/apikey" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        class="text-[10px] px-2 py-0.5 bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 rounded-md font-medium transition-colors flex items-center gap-1 cursor-pointer"
                        title="Open Google AI Studio"
                      >
                        AI Studio
                        <Icon name="ri:external-link-line" class="text-[10px]" />
                      </a>

                      <button 
                        v-if="keyItem.raw_error"
                        @click="keyItem.showRawError = !keyItem.showRawError"
                        class="text-[10px] px-2 py-0.5 bg-black/40 hover:bg-black/60 text-slate-400 hover:text-slate-200 border border-white/10 rounded-md font-mono transition-colors flex items-center gap-1 cursor-pointer"
                        :title="keyItem.showRawError ? 'Hide technical details' : 'Show technical details'"
                      >
                        {{ keyItem.showRawError ? 'Hide Details' : 'Details' }}
                        <Icon :name="keyItem.showRawError ? 'ri:arrow-up-s-line' : 'ri:arrow-down-s-line'" class="text-xs" />
                      </button>
                    </div>
                  </div>

                  <!-- Expandable Raw Error Codeblock -->
                  <div 
                    v-if="keyItem.showRawError && keyItem.raw_error" 
                    class="mt-1 p-2 rounded-lg bg-[#08090d] border border-red-500/20 text-[10px] font-mono text-slate-400 overflow-x-auto select-all max-h-32 custom-scrollbar"
                  >
                    {{ keyItem.raw_error }}
                  </div>
                </div>
              </div>

              <!-- Empty state if all keys removed -->
              <div 
                v-if="keysList.length === 0"
                :key="'empty'"
                class="p-6 rounded-xl border border-dashed border-surface-border bg-surface-dark/10 text-center flex flex-col items-center justify-center gap-2"
              >
                <p class="text-xs text-slate-500">No API keys configured. Gemini features will not be available.</p>
                <button 
                  @click="addKey"
                  class="px-3.5 py-1.5 bg-surface-card border border-surface-border hover:border-accent-500/50 text-white rounded-lg text-xs font-medium transition-all cursor-pointer"
                >
                  Add API Key
                </button>
              </div>
            </TransitionGroup>

            <!-- Bottom Action Toolbar -->
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-2 border-t border-surface-border/40">
              <div class="text-[11px] text-slate-500 flex items-center gap-1.5">
                <Icon name="ri:shield-check-line" class="text-accent-500 text-xs" />
                <span>Saved locally to <code class="text-slate-400 font-mono">.env</code></span>
              </div>

              <div class="flex items-center gap-2.5 sm:ml-auto w-full sm:w-auto justify-end">
                <!-- Unsaved Status Pill -->
                <Transition
                  enter-active-class="transition duration-200 ease-out"
                  enter-from-class="opacity-0 translate-x-2"
                  enter-to-class="opacity-100 translate-x-0"
                  leave-active-class="transition duration-150 ease-in"
                  leave-from-class="opacity-100 translate-x-0"
                  leave-to-class="opacity-0 translate-x-2"
                >
                  <span 
                    v-if="hasUnsavedChanges" 
                    class="text-[10px] text-amber-400 flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-md shrink-0"
                  >
                    <span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                    Unsaved changes
                  </span>
                </Transition>

                <!-- Save Keys Button -->
                <button 
                  v-if="keysList.length > 0"
                  @click="saveApiKeys"
                  class="px-3.5 py-1.5 bg-surface-dark hover:bg-surface-card border border-surface-border hover:border-slate-700 text-slate-200 hover:text-white font-medium text-xs rounded-lg transition-all shrink-0 cursor-pointer shadow-sm"
                >
                  Save Keys
                </button>

                <!-- Test Connections Button -->
                <button 
                  v-if="keysList.length > 0"
                  @click="testApiKeys"
                  :disabled="testingKey"
                  class="px-3.5 py-1.5 bg-accent-500 hover:bg-accent-400 text-black font-bold text-xs rounded-lg transition-all flex items-center gap-1.5 disabled:opacity-50 shrink-0 cursor-pointer shadow-sm"
                >
                  <Icon name="ri:flashlight-fill" class="text-xs" />
                  {{ testingKey ? 'Testing...' : 'Test Connections' }}
                </button>
              </div>
            </div>

            <!-- Live Test Result Banner -->
            <Transition
              enter-active-class="transition duration-300 ease-out"
              enter-from-class="opacity-0 -translate-y-2"
              enter-to-class="opacity-100 translate-y-0"
              leave-active-class="transition duration-200 ease-in"
              leave-from-class="opacity-100 translate-y-0"
              leave-to-class="opacity-0 -translate-y-2"
            >
              <div 
                v-if="testResult.status !== 'idle'" 
                class="p-3 rounded-xl border text-xs leading-normal flex items-start gap-2.5"
                :class="testResult.status === 'valid' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'"
              >
                <Icon :name="testResult.status === 'valid' ? 'ri:checkbox-circle-fill' : 'ri:error-warning-fill'" class="text-base shrink-0 mt-0.5" />
                <div>
                  <span class="font-bold block mb-0.5">{{ testResult.status === 'valid' ? 'Gemini API keys verified successfully' : 'Connection check failed' }}</span>
                  <p class="text-slate-300 text-[11px]">{{ testResult.message }}</p>
                </div>
              </div>
            </Transition>
          </div>

          <!-- Whisper AI Configuration -->
          <div v-else-if="activeTab === 'whisper'" key="whisper" id="settings-whisper" class="scroll-mt-24 flex flex-col gap-6">
            <div>
              <h3 class="text-lg font-bold text-white mb-2 flex items-center gap-2">
                <Icon name="ri:cpu-fill" class="text-accent-500" /> Transcription Engine (Whisper)
              </h3>
              <p class="text-sm text-slate-400">Choose the AI model size used for local transcription. Larger models are more accurate but slower and require more VRAM/CPU.</p>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <button 
                v-for="model in state.whisperModels" 
                :key="model.id"
                @click="state.whisperModel.value = model.id"
                class="flex flex-col p-4 rounded-xl border text-left transition-all group relative cursor-pointer"
                :class="state.whisperModel.value === model.id 
                  ? 'bg-accent-500/10 border-accent-500' 
                  : 'bg-surface-dark/50 border-surface-border hover:border-accent-500/30'"
              >
                <div class="flex justify-between items-start mb-2">
                  <span class="font-black uppercase tracking-widest text-xs" :class="state.whisperModel.value === model.id ? 'text-accent-500' : 'text-slate-300'">{{ model.name }}</span>
                  <Icon v-if="state.whisperModel.value === model.id" name="ri:checkbox-circle-fill" class="text-accent-500 text-lg" />
                </div>
                <div class="flex gap-2 mb-3">
                  <span class="text-[9px] px-1.5 py-0.5 rounded bg-surface-dark border border-surface-border text-slate-400 font-bold uppercase tracking-tighter">{{ model.speed }}</span>
                  <span class="text-[9px] px-1.5 py-0.5 rounded bg-surface-dark border border-surface-border text-slate-400 font-bold uppercase tracking-tighter">{{ model.acc }}</span>
                </div>
                <p class="text-[11px] leading-relaxed text-slate-500 group-hover:text-slate-400 transition-colors">{{ model.desc }}</p>
              </button>
            </div>
          </div>

          <!-- YouTube Cookies Configuration -->
          <div v-else-if="activeTab === 'cookies'" key="cookies" id="settings-cookies" class="scroll-mt-24 flex flex-col gap-6">
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h3 class="text-lg font-bold text-white mb-1 flex items-center gap-2">
                  <Icon name="ri:shield-keyhole-fill" class="text-accent-500" /> YouTube Cookies (yt-dlp)
                </h3>
                <p class="text-sm text-slate-400">Import your YouTube cookies to bypass rate limits, captchas, and bot detection when fetching or downloading videos.</p>
              </div>
            </div>
            
            <!-- Section 1: Active Status / Uploader Box -->
            <div class="flex flex-col gap-4">
              <!-- Active Cookies Card (When Configured - Flat Surface Monokrom) -->
              <div v-if="cookiesStatus.exists" class="p-4 sm:p-5 rounded-xl border border-surface-border bg-surface-dark/40 flex flex-col gap-4 shadow-sm">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div class="flex items-start sm:items-center gap-3.5">
                    <div class="w-10 h-10 rounded-lg bg-[#111318] border border-surface-border flex items-center justify-center text-accent-500 shrink-0">
                      <Icon name="ri:file-text-fill" class="text-xl" />
                    </div>
                    <div class="flex flex-col">
                      <div class="flex items-center gap-2">
                        <span class="text-sm font-bold text-white font-mono">cookies.txt</span>
                        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Active
                        </span>
                      </div>
                      <span class="text-xs text-slate-400 font-mono mt-0.5">
                        Size: {{ formatBytes(cookiesStatus.size_bytes) }} • Updated: {{ formatDate(cookiesStatus.last_modified) }}
                      </span>
                    </div>
                  </div>
                  
                  <div class="flex items-center gap-2 self-end sm:self-center">
                    <button 
                      @click="deleteCookies"
                      :disabled="deletingCookies"
                      class="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 rounded-lg text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-sm"
                    >
                      <Icon name="ri:delete-bin-line" class="text-sm" />
                      {{ deletingCookies ? 'Deleting...' : 'Delete' }}
                    </button>
                  </div>
                </div>

                <!-- Integrated Replace Dropzone (Always Open) -->
                <div 
                  @dragover.prevent="dragOver = true"
                  @dragleave.prevent="dragOver = false"
                  @drop.prevent="handleFileDrop"
                  :class="dragOver ? 'border-accent-500 bg-accent-500/5 ring-2 ring-accent-500/20' : 'border-surface-border/80 bg-[#0e1015]/90 hover:border-slate-600'"
                  class="py-5 px-4 rounded-lg border-2 border-dashed flex flex-col items-center justify-center text-center transition-all cursor-pointer group"
                  @click="fileInput?.click()"
                >
                  <input 
                    ref="fileInput" 
                    type="file" 
                    accept=".txt" 
                    class="hidden" 
                    @change="handleFileSelect" 
                  />
                  <div class="w-8 h-8 rounded-lg bg-surface-dark border border-surface-border/80 flex items-center justify-center text-slate-400 group-hover:text-accent-500 group-hover:border-accent-500/30 transition-all mb-1 shadow-inner">
                    <Icon name="ri:upload-cloud-2-line" class="text-base" :class="{ 'text-accent-500 scale-110': dragOver }" />
                  </div>
                  <div class="flex items-center gap-1.5 text-xs text-slate-300 group-hover:text-white font-medium">
                    <span>Drop new <span class="text-accent-400 font-semibold font-mono">cookies.txt</span> here to replace or <span class="text-accent-500 underline underline-offset-2">browse</span></span>
                  </div>
                  <span class="text-[11px] text-slate-500 mt-0.5">This will immediately overwrite your active cookies file.</span>
                </div>
              </div>

              <!-- Unconfigured Notice (When No Cookies) -->
              <div v-else class="flex items-start gap-3 p-3.5 rounded-xl border border-surface-border bg-surface-dark/40 text-slate-300 text-xs leading-relaxed">
                <Icon name="ri:alert-fill" class="text-amber-400 text-base shrink-0 mt-0.5" />
                <div class="flex flex-col gap-0.5">
                  <span class="font-bold text-white">No cookies configured</span>
                  <p class="text-slate-400">Video downloads and metadata fetching may work, but remain vulnerable to YouTube's "Sign in to confirm you're not a bot" restriction.</p>
                </div>
              </div>

              <!-- Upload Drag & Drop Area (When No Cookies Exist) -->
              <div 
                v-if="!cookiesStatus.exists"
                @dragover.prevent="dragOver = true"
                @dragleave.prevent="dragOver = false"
                @drop.prevent="handleFileDrop"
                :class="dragOver ? 'border-accent-500 bg-accent-500/5 ring-4 ring-accent-500/10' : 'border-surface-border bg-surface-dark/30 hover:border-slate-600 hover:bg-surface-dark/50'"
                class="w-full min-h-36 rounded-xl border-2 border-dashed flex flex-col items-center justify-center p-6 text-center transition-all duration-200 cursor-pointer relative group"
                @click="fileInput?.click()"
              >
                <input 
                  ref="fileInput" 
                  type="file" 
                  accept=".txt" 
                  class="hidden" 
                  @change="handleFileSelect" 
                />
                
                <div class="w-10 h-10 rounded-xl bg-surface-dark border border-surface-border flex items-center justify-center text-slate-400 group-hover:text-accent-500 group-hover:border-accent-500/30 group-hover:scale-105 transition-all duration-200 mb-2.5 shadow-inner">
                  <Icon 
                    name="ri:upload-cloud-2-line" 
                    class="text-xl transition-transform"
                    :class="{ 'text-accent-500 scale-110': dragOver }"
                  />
                </div>
                <span class="text-sm font-bold text-slate-200 group-hover:text-white transition-colors">
                  Drag & drop your <span class="font-mono text-accent-500">cookies.txt</span> here
                </span>
                <span class="text-xs text-slate-500 mt-1.5">
                  or <span class="text-accent-500 font-semibold underline underline-offset-2">browse file</span> from your computer (Netscape format)
                </span>
              </div>
            </div>

            <!-- Section 2: Bento Grid 3-Step Guide -->
            <div class="flex flex-col gap-3">
              <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pl-0.5">
                <div class="flex items-center gap-2">
                  <Icon name="ri:compass-3-line" class="text-accent-500 text-sm" />
                  <h4 class="text-xs font-bold uppercase tracking-wider text-slate-300">How to obtain cookies?</h4>
                </div>
                <a 
                  href="https://github.com/yt-dlp/yt-dlp/wiki/Extractors#exporting-youtube-cookies" 
                  target="_blank"
                  class="inline-flex items-center gap-1.5 text-xs text-accent-500 hover:text-accent-400 font-semibold transition-colors"
                >
                  <Icon name="ri:github-fill" class="text-sm" /> Official yt-dlp Cookies Wiki
                  <Icon name="ri:external-link-line" class="text-xs" />
                </a>
              </div>
              
              <div class="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                <!-- Step 01 Bento Card -->
                <div class="p-4 rounded-xl border border-surface-border bg-surface-dark/40 flex flex-col justify-between hover:border-slate-700 transition-colors">
                  <div class="flex flex-col">
                    <div class="flex items-center justify-between">
                      <span class="w-6 h-6 rounded-lg bg-accent-500/10 border border-accent-500/20 text-accent-500 flex items-center justify-center text-[11px] font-black">01</span>
                      <Icon name="ri:puzzle-2-line" class="text-slate-500 text-base" />
                    </div>
                    <h5 class="text-xs font-bold text-slate-200 mt-3 mb-1">Install Browser Extension</h5>
                    <p class="text-[11px] leading-relaxed text-slate-400">
                      Install open-source <strong class="text-slate-300">"Get cookies.txt LOCALLY"</strong> to extract Netscape cookies:
                    </p>
                  </div>
                  
                  <div class="flex flex-col gap-1.5 mt-4 pt-3 border-t border-surface-border/40">
                    <a 
                      href="https://chromewebstore.google.com/detail/get-cookiestxt-locally/ccloeocionehidjhhicdjiijlkocoodm" 
                      target="_blank"
                      class="inline-flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#111318] border border-surface-border text-[11px] font-semibold text-slate-300 hover:text-white hover:border-accent-500/40 hover:bg-accent-500/5 transition-all"
                    >
                      <span class="flex items-center gap-1.5">
                        <Icon name="ri:chrome-fill" class="text-accent-500 text-xs" /> Chrome / Edge / Brave
                      </span>
                      <Icon name="ri:external-link-line" class="text-slate-500 text-[10px]" />
                    </a>
                    <a 
                      href="https://addons.mozilla.org/en-US/firefox/addon/get-cookies-txt-locally/" 
                      target="_blank"
                      class="inline-flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#111318] border border-surface-border text-[11px] font-semibold text-slate-300 hover:text-white hover:border-accent-500/40 hover:bg-accent-500/5 transition-all"
                    >
                      <span class="flex items-center gap-1.5">
                        <Icon name="ri:firefox-fill" class="text-accent-500 text-xs" /> Firefox
                      </span>
                      <Icon name="ri:external-link-line" class="text-slate-500 text-[10px]" />
                    </a>
                  </div>
                </div>

                <!-- Step 02 Bento Card -->
                <div class="p-4 rounded-xl border border-surface-border bg-surface-dark/40 flex flex-col justify-between hover:border-slate-700 transition-colors">
                  <div class="flex flex-col">
                    <div class="flex items-center justify-between">
                      <span class="w-6 h-6 rounded-lg bg-accent-500/10 border border-accent-500/20 text-accent-500 flex items-center justify-center text-[11px] font-black">02</span>
                      <Icon name="ri:youtube-line" class="text-slate-500 text-base" />
                    </div>
                    <h5 class="text-xs font-bold text-slate-200 mt-3 mb-1">Sign In to YouTube</h5>
                    <p class="text-[11px] leading-relaxed text-slate-400">
                      Open YouTube in a new tab and ensure your Google account is logged in for a valid active session.
                    </p>
                  </div>
                  
                  <div class="flex flex-col gap-1.5 mt-4 pt-3 border-t border-surface-border/40">
                    <a 
                      href="https://youtube.com" 
                      target="_blank"
                      class="inline-flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg bg-[#111318] border border-surface-border text-[11px] font-semibold text-slate-300 hover:text-white hover:border-accent-500/40 hover:bg-accent-500/5 transition-all"
                    >
                      <span class="flex items-center gap-1.5">
                        <Icon name="ri:youtube-fill" class="text-red-500 text-xs" /> Open youtube.com
                      </span>
                      <Icon name="ri:external-link-line" class="text-slate-500 text-[10px]" />
                    </a>
                    <div class="flex items-center gap-1 px-1 text-[10px] text-slate-500">
                      <Icon name="ri:information-line" class="text-xs" />
                      <span>Google Account required</span>
                    </div>
                  </div>
                </div>

                <!-- Step 03 Bento Card -->
                <div class="p-4 rounded-xl border border-surface-border bg-surface-dark/40 flex flex-col justify-between hover:border-slate-700 transition-colors">
                  <div class="flex flex-col">
                    <div class="flex items-center justify-between">
                      <span class="w-6 h-6 rounded-lg bg-accent-500/10 border border-accent-500/20 text-accent-500 flex items-center justify-center text-[11px] font-black">03</span>
                      <Icon name="ri:file-download-line" class="text-slate-500 text-base" />
                    </div>
                    <h5 class="text-xs font-bold text-slate-200 mt-3 mb-1">Export as Netscape & Drop File</h5>
                    <p class="text-[11px] leading-relaxed text-slate-400">
                      Click the extension <strong class="text-slate-300">"Get cookies.txt LOCALLY"</strong> icon on the YouTube tab, choose <strong class="text-slate-300">"Export as Netscape format"</strong>, and drop the file above.
                    </p>
                  </div>
                  
                  <div class="flex flex-col gap-1.5 mt-4 pt-3 border-t border-surface-border/40">
                    <div class="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#111318] border border-surface-border text-[11px] text-accent-400 font-mono">
                      <Icon name="ri:file-text-line" class="text-xs shrink-0" />
                      <span class="truncate">youtube.com_cookies.txt</span>
                    </div>
                    <div class="flex items-center gap-1 px-1 text-[10px] text-slate-500">
                      <Icon name="ri:check-line" class="text-xs text-emerald-400" />
                      <span>Netscape format (.txt)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Environment Setup -->
          <div v-else-if="activeTab === 'env'" key="env" id="settings-env" class="scroll-mt-24 flex flex-col gap-6">
            <div>
              <h3 class="text-lg font-bold text-white mb-2 flex items-center gap-2">
                <Icon name="ri:terminal-window-fill" class="text-accent-500" /> Environment Paths
              </h3>
              <p class="text-sm text-slate-400">If your prerequisite tools are installed in custom locations, provide their absolute paths. Otherwise, leave them blank to use system defaults.</p>
            </div>
            
            <div class="flex flex-col gap-5">
              <!-- FFmpeg Card -->
              <div class="p-4 rounded-xl border border-surface-border bg-surface-dark/30 flex flex-col gap-3.5 transition-all" data-testid="ffmpeg-env-card">
                <div class="flex items-center justify-between flex-wrap gap-2">
                  <div class="flex items-center gap-2">
                    <div class="w-7 h-7 rounded-lg bg-surface-dark border border-surface-border flex items-center justify-center text-accent-400">
                      <Icon name="ri:movie-2-line" class="text-sm text-accent-500" />
                    </div>
                    <div>
                      <h4 class="text-sm font-bold text-white">FFmpeg Binary</h4>
                      <p class="text-[11px] text-slate-400">Required for video slicing, thumbnail extraction, and 9:16 rendering.</p>
                    </div>
                  </div>
                  <!-- Status Badge -->
                  <div class="flex items-center gap-2">
                    <span 
                      class="text-[9px] px-1.5 py-0.5 rounded font-mono font-medium flex items-center gap-1"
                      :class="ffmpegStatusBadge.class"
                    >
                      <span class="w-1 h-1 rounded-full" :class="ffmpegStatusBadge.dotClass"></span>
                      {{ ffmpegStatusBadge.label }}
                    </span>
                  </div>
                </div>

                <!-- Active Binary Display -->
                <div class="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0c0e14] border border-surface-border/60 text-xs">
                  <span class="text-slate-400 text-[11px] font-semibold uppercase tracking-wider shrink-0">Active Path:</span>
                  <span class="font-mono text-[11px] text-slate-200 truncate" :title="healthData?.ffmpeg?.path || 'Not detected'">
                    {{ healthData?.ffmpeg?.path || 'Not detected in system PATH' }}
                  </span>
                </div>

                <!-- Input & Test Button -->
                <div class="flex flex-col gap-1.5">
                  <div class="flex items-center justify-between">
                    <label class="text-xs font-bold text-slate-400 uppercase tracking-widest pl-0.5 flex items-center gap-1.5">
                      <span>Custom Path Override</span>
                      <span class="text-[10px] lowercase font-normal px-1.5 py-0.2 rounded bg-surface-dark border border-surface-border text-slate-400">optional</span>
                    </label>
                    <button 
                      v-if="ffmpegPath"
                      @click="resetEnvPath('ffmpeg')"
                      type="button"
                      class="text-[11px] text-slate-400 hover:text-rose-400 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Icon name="ri:close-circle-line" class="text-xs" /> Clear Override
                    </button>
                  </div>
                  
                  <div class="flex items-center gap-2">
                    <input 
                      v-model="ffmpegPath"
                      type="text" 
                      placeholder="e.g. C:\ffmpeg\bin or /opt/homebrew/bin/ffmpeg" 
                      class="w-full bg-[#111318] border border-surface-border text-white px-3.5 py-2 rounded-lg focus:outline-none focus:border-accent-500/50 transition-all font-mono text-xs"
                      @input="ffmpegValidation.tested = false"
                    />
                    <button 
                      @click="testBinaryPath('ffmpeg')"
                      :disabled="ffmpegValidation.testing"
                      type="button"
                      class="px-4 py-2 bg-surface-card border border-surface-border text-slate-200 hover:text-white hover:border-accent-500/40 text-xs font-semibold rounded-lg shrink-0 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <Icon v-if="ffmpegValidation.testing" name="ri:loader-4-line" class="text-xs animate-spin text-accent-500" />
                      <Icon v-else name="ri:search-eye-line" class="text-xs text-accent-500" />
                      <span>Test Path</span>
                    </button>
                  </div>

                  <!-- Inline Validation Result Feedback -->
                  <div v-if="ffmpegValidation.tested" class="mt-1">
                    <div 
                      v-if="ffmpegValidation.valid" 
                      class="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs"
                    >
                      <Icon name="ri:checkbox-circle-fill" class="text-emerald-400 text-sm shrink-0" />
                      <div class="flex flex-col gap-0.5 truncate">
                        <span class="font-semibold">{{ ffmpegValidation.message }}</span>
                        <span v-if="ffmpegValidation.detectedPath" class="font-mono text-[10px] text-emerald-400 truncate">{{ ffmpegValidation.detectedPath }}</span>
                      </div>
                    </div>
                    <div 
                      v-else 
                      class="flex items-center gap-2 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs"
                    >
                      <Icon name="ri:error-warning-fill" class="text-rose-400 text-sm shrink-0" />
                      <span class="font-medium">{{ ffmpegValidation.message }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Node.js Card -->
              <div class="p-4 rounded-xl border border-surface-border bg-surface-dark/30 flex flex-col gap-3.5 transition-all" data-testid="node-env-card">
                <div class="flex items-center justify-between flex-wrap gap-2">
                  <div class="flex items-center gap-2">
                    <div class="w-7 h-7 rounded-lg bg-surface-dark border border-surface-border flex items-center justify-center text-accent-400">
                      <Icon name="ri:nodejs-line" class="text-sm text-accent-500" />
                    </div>
                    <div>
                      <h4 class="text-sm font-bold text-white">Node.js Runtime</h4>
                      <p class="text-[11px] text-slate-400">Optional runtime for extractor JavaScript helpers & extensions.</p>
                    </div>
                  </div>
                  <!-- Status Badge -->
                  <div class="flex items-center gap-2">
                    <span 
                      class="text-[9px] px-1.5 py-0.5 rounded font-mono font-medium flex items-center gap-1"
                      :class="nodeStatusBadge.class"
                    >
                      <span class="w-1 h-1 rounded-full" :class="nodeStatusBadge.dotClass"></span>
                      {{ nodeStatusBadge.label }}
                    </span>
                  </div>
                </div>

                <!-- Active Binary Display -->
                <div class="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0c0e14] border border-surface-border/60 text-xs">
                  <span class="text-slate-400 text-[11px] font-semibold uppercase tracking-wider shrink-0">Active Path:</span>
                  <span class="font-mono text-[11px] text-slate-200 truncate" :title="healthData?.node?.path || 'Not detected'">
                    {{ healthData?.node?.path || 'Not detected in system PATH' }}
                  </span>
                </div>

                <!-- Input & Test Button -->
                <div class="flex flex-col gap-1.5">
                  <div class="flex items-center justify-between">
                    <label class="text-xs font-bold text-slate-400 uppercase tracking-widest pl-0.5 flex items-center gap-1.5">
                      <span>Custom Path Override</span>
                      <span class="text-[10px] lowercase font-normal px-1.5 py-0.2 rounded bg-surface-dark border border-surface-border text-slate-400">optional</span>
                    </label>
                    <button 
                      v-if="nodePath"
                      @click="resetEnvPath('node')"
                      type="button"
                      class="text-[11px] text-slate-400 hover:text-rose-400 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Icon name="ri:close-circle-line" class="text-xs" /> Clear Override
                    </button>
                  </div>
                  
                  <div class="flex items-center gap-2">
                    <input 
                      v-model="nodePath"
                      type="text" 
                      placeholder="e.g. C:\Program Files\nodejs or /usr/local/bin/node" 
                      class="w-full bg-[#111318] border border-surface-border text-white px-3.5 py-2 rounded-lg focus:outline-none focus:border-accent-500/50 transition-all font-mono text-xs"
                      @input="nodeValidation.tested = false"
                    />
                    <button 
                      @click="testBinaryPath('node')"
                      :disabled="nodeValidation.testing"
                      type="button"
                      class="px-4 py-2 bg-surface-card border border-surface-border text-slate-200 hover:text-white hover:border-accent-500/40 text-xs font-semibold rounded-lg shrink-0 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <Icon v-if="nodeValidation.testing" name="ri:loader-4-line" class="text-xs animate-spin text-accent-500" />
                      <Icon v-else name="ri:search-eye-line" class="text-xs text-accent-500" />
                      <span>Test Path</span>
                    </button>
                  </div>

                  <!-- Inline Validation Result Feedback -->
                  <div v-if="nodeValidation.tested" class="mt-1">
                    <div 
                      v-if="nodeValidation.valid" 
                      class="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs"
                    >
                      <Icon name="ri:checkbox-circle-fill" class="text-emerald-400 text-sm shrink-0" />
                      <div class="flex flex-col gap-0.5 truncate">
                        <span class="font-semibold">{{ nodeValidation.message }}</span>
                        <span v-if="nodeValidation.detectedPath" class="font-mono text-[10px] text-emerald-400 truncate">{{ nodeValidation.detectedPath }}</span>
                      </div>
                    </div>
                    <div 
                      v-else 
                      class="flex items-center gap-2 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs"
                    >
                      <Icon name="ri:error-warning-fill" class="text-rose-400 text-sm shrink-0" />
                      <span class="font-medium">{{ nodeValidation.message }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Footer Actions -->
              <div class="flex items-center justify-end gap-3 mt-2">
                <button 
                  @click="saveEnvPaths"
                  :disabled="savingEnvPaths"
                  class="px-4 py-2 bg-surface-dark hover:bg-surface-card border border-surface-border hover:border-slate-700 text-slate-200 hover:text-white font-medium text-xs rounded-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-sm"
                >
                  <Icon v-if="savingEnvPaths" name="ri:loader-4-line" class="text-xs animate-spin text-accent-500" />
                  <Icon v-else name="ri:save-line" class="text-xs text-accent-500" />
                  <span>{{ savingEnvPaths ? 'Saving Paths...' : 'Save Environment Paths' }}</span>
                </button>
              </div>
            </div>

          </div>

        </Transition>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from 'vue'

const state = useClipperState()
const route = useRoute()
const router = useRouter()
const API_BASE = 'http://localhost:8000'

const navContainerRef = ref<HTMLElement | null>(null)
const navButtonRefs = ref<Record<string, HTMLElement>>({})
const indicatorTop = ref(0)
const indicatorHeight = ref(18)
const indicatorOpacity = ref(0)

function setButtonRef(id: string, el: any) {
  if (el) {
    navButtonRefs.value[id] = (el.$el || el) as HTMLElement
  }
}

const updateIndicator = () => {
  nextTick(() => {
    const el = navButtonRefs.value[activeTab.value]
    const container = navContainerRef.value
    if (el && container) {
      const containerRect = container.getBoundingClientRect()
      const elRect = el.getBoundingClientRect()
      const barHeight = 18
      indicatorTop.value = (elRect.top - containerRect.top) + (elRect.height - barHeight) / 2
      indicatorHeight.value = barHeight
      indicatorOpacity.value = 1
    }
  })
}

export type SettingsTab = 'health' | 'api' | 'whisper' | 'cookies' | 'env'
const validTabs: SettingsTab[] = ['health', 'api', 'whisper', 'cookies', 'env']

const normalizeTab = (val: string | null | undefined): SettingsTab => {
  if (!val) return 'health'
  const clean = val.replace(/^settings-/, '')
  if (validTabs.includes(clean as SettingsTab)) {
    return clean as SettingsTab
  }
  return 'health'
}

// Active Tab state with URL query synchronization
const initialTab = typeof route.query.tab === 'string' ? normalizeTab(route.query.tab) : 'health'
const activeTab = ref<SettingsTab>(initialTab)

watch(activeTab, () => {
  updateIndicator()
})

function switchTab(tab: SettingsTab) {
  activeTab.value = tab
  if (route.query.tab !== tab) {
    router.replace({ query: { ...route.query, tab } }).catch(() => {})
  }
}

// Sync with programmatic scroll/tab targets (e.g. from topbar alerts)
watch(() => state.settingsScrollTarget.value, async (newTarget) => {
  if (newTarget) {
    await nextTick()
    const tab = normalizeTab(newTarget)
    switchTab(tab)
    state.settingsScrollTarget.value = null
  }
}, { immediate: true })

// Sync when URL query changes externally
watch(() => route.query.tab, (newTab) => {
  if (newTab && typeof newTab === 'string') {
    const tab = normalizeTab(newTab)
    if (activeTab.value !== tab) {
      activeTab.value = tab
    }
  }
})

// Section Status Computations
const isHealthOk = computed(() => {
  const health = state.systemHealth.value
  if (!health) return true
  const systemKeys = ['ffmpeg', 'node', 'python_env']
  return !systemKeys.some(key => {
    const item = (health as any)[key]
    return !item || item.status !== 'OK'
  })
})

const isEnvOk = computed(() => {
  const health = state.systemHealth.value
  if (!health) return true
  const ffmpegReady = Boolean(ffmpegPath.value.trim() || health.ffmpeg?.status === 'OK')
  const nodeReady = Boolean(nodePath.value.trim() || health.node?.status === 'OK')
  return ffmpegReady && nodeReady
})

const hasValidApiKey = computed(() => {
  const health = state.systemHealth.value
  if (health?.gemini_api?.has_key) return true
  return keysList.value.some(k => k.value.trim().length > 0 && (k.status === 'valid' || k.status === 'idle'))
})

const validKeysCount = computed(() => {
  return keysList.value.filter(k => k.value.trim().length > 0 && k.status === 'valid').length
})

// Sidebar Sections Definition
const sections = computed(() => [
  {
    id: 'health' as SettingsTab,
    label: 'System Health',
    desc: 'Prerequisites & diagnostics',
    icon: 'ri:shield-cross-line',
    badgeType: isHealthOk.value ? 'ok' : 'warning',
    badgeText: isHealthOk.value ? 'OK' : 'Missing'
  },
  {
    id: 'api' as SettingsTab,
    label: 'Gemini API Keys',
    desc: 'Key pool & failover',
    icon: 'ri:key-2-fill',
    badgeType: hasValidApiKey.value ? 'ok' : 'warning',
    badgeText: hasValidApiKey.value ? (validKeysCount.value > 0 ? `${validKeysCount.value} Valid` : 'Configured') : 'Required'
  },
  {
    id: 'whisper' as SettingsTab,
    label: 'Whisper Engine',
    desc: 'Local speech-to-text',
    icon: 'ri:cpu-fill',
    badgeType: 'neutral',
    badgeText: state.whisperModel.value.toUpperCase()
  },
  {
    id: 'cookies' as SettingsTab,
    label: 'YouTube Cookies',
    desc: 'yt-dlp authorization',
    icon: 'ri:shield-keyhole-fill',
    badgeType: cookiesStatus.value.exists ? 'ok' : 'neutral',
    badgeText: cookiesStatus.value.exists ? 'Active' : 'Optional'
  },
  {
    id: 'env' as SettingsTab,
    label: 'Environment Paths',
    desc: 'Custom binary locations',
    icon: 'ri:terminal-window-fill',
    badgeType: 'none',
    badgeText: ''
  }
])

const apiKey = ref('')
interface KeyListItem {
  id: string
  title: string
  value: string
  show: boolean
  status: 'idle' | 'valid' | 'invalid' | 'testing'
  error: string
  raw_error?: string
  showRawError?: boolean
  activeFlash: boolean
}
const keysList = ref<KeyListItem[]>([
  { id: Math.random().toString(36).substring(2, 9), title: '', value: '', show: false, status: 'idle', error: '', raw_error: '', showRawError: false, activeFlash: false }
])

const originalSerializedKeys = ref(JSON.stringify([{ title: '', value: '' }]))
const hasUnsavedChanges = computed(() => {
  const current = JSON.stringify(keysList.value.map(k => ({ title: k.title.trim(), value: k.value.trim() })))
  return current !== originalSerializedKeys.value
})

function addKey() {
  keysList.value.push({
    id: Math.random().toString(36).substring(2, 9),
    title: '',
    value: '',
    show: false,
    status: 'idle',
    error: '',
    raw_error: '',
    showRawError: false,
    activeFlash: false
  })
}

function removeKey(index: number) {
  keysList.value.splice(index, 1)
}

function moveKey(index: number, direction: number) {
  const newIndex = index + direction
  if (newIndex < 0 || newIndex >= keysList.value.length) return
  
  // Swap
  const itemCurrent = keysList.value[index]
  const itemNew = keysList.value[newIndex]
  if (itemCurrent && itemNew) {
    keysList.value[index] = itemNew
    keysList.value[newIndex] = itemCurrent
    
    // Flash
    itemCurrent.activeFlash = true
    itemNew.activeFlash = true
  }
  
  setTimeout(() => {
    const iCurrent = keysList.value[index]
    const iNew = keysList.value[newIndex]
    if (iCurrent) iCurrent.activeFlash = false
    if (iNew) iNew.activeFlash = false
  }, 600)
}

function getKeyPreview(value: string) {
  const val = value.trim()
  if (val.length > 10) {
    return val.substring(0, 6) + '...' + val.slice(-4)
  }
  return ''
}

const draggedIndex = ref<number | null>(null)
const lastSwapTime = ref(0)
const lastSwappedIds = ref<[string, string] | null>(null)

function dragStart(index: number, event: DragEvent) {
  draggedIndex.value = index
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', index.toString())
  }
}

function dragEnter(index: number) {
  if (draggedIndex.value === null || draggedIndex.value === index) return
  const oldIndex = draggedIndex.value
  
  const oldItem = keysList.value[oldIndex]
  const newItem = keysList.value[index]
  if (!oldItem || !newItem) return
  
  // Prevent infinite rapid swap back-and-forth glitch loops
  const now = Date.now()
  if (lastSwappedIds.value && 
      ((lastSwappedIds.value[0] === oldItem.id && lastSwappedIds.value[1] === newItem.id) ||
       (lastSwappedIds.value[0] === newItem.id && lastSwappedIds.value[1] === oldItem.id))) {
    if (now - lastSwapTime.value < 150) {
      return
    }
  }
  
  // Swap
  const itemOld = keysList.value[oldIndex]
  const itemIndex = keysList.value[index]
  if (itemOld && itemIndex) {
    keysList.value[oldIndex] = itemIndex
    keysList.value[index] = itemOld
    
    // Flash highlight on both swapped items
    itemOld.activeFlash = true
    itemIndex.activeFlash = true
  }
  
  draggedIndex.value = index
  lastSwappedIds.value = [oldItem.id, newItem.id]
  lastSwapTime.value = now
  
  const targetId1 = oldItem.id
  const targetId2 = newItem.id
  
  setTimeout(() => {
    const item1 = keysList.value.find(k => k.id === targetId1)
    if (item1) item1.activeFlash = false
    const item2 = keysList.value.find(k => k.id === targetId2)
    if (item2) item2.activeFlash = false
  }, 600)
}

function dragEnd() {
  draggedIndex.value = null
  lastSwappedIds.value = null
  lastSwapTime.value = 0
}
const ffmpegPath = ref('')
const nodePath = ref('')
const savingEnvPaths = ref(false)

interface PathValidationState {
  testing: boolean
  tested: boolean
  valid: boolean
  message: string
  detectedPath: string
  isSystemDefault?: boolean
}

const ffmpegValidation = ref<PathValidationState>({
  testing: false,
  tested: false,
  valid: false,
  message: '',
  detectedPath: ''
})

const nodeValidation = ref<PathValidationState>({
  testing: false,
  tested: false,
  valid: false,
  message: '',
  detectedPath: ''
})

const fileInput = ref<HTMLInputElement | null>(null)

// Health & Diagnostics state
interface HealthItem {
  status: string
  path?: string
  has_key?: boolean
  active?: boolean
  exists?: boolean
}
interface HealthResponse {
  ffmpeg: HealthItem
  node: HealthItem
  python_env: HealthItem
  gemini_api: HealthItem
  cookies: HealthItem
}
const healthData = computed(() => state.systemHealth.value)
const checkingHealth = computed(() => state.checkingHealth.value)

const firstMissingPrerequisiteSection = computed(() => {
  const health = state.systemHealth.value
  if (!health) return 'settings-health'
  
  // 1. Core system prerequisites (FFmpeg, Node, Python)
  const systemKeys = ['ffmpeg', 'node', 'python_env']
  const isSystemMissing = systemKeys.some(key => {
    const item = health[key]
    return !item || item.status !== 'OK'
  })
  if (isSystemMissing) {
    return 'settings-health'
  }
  
  // 2. Gemini API key
  if (!health.gemini_api?.has_key) {
    return 'settings-api'
  }
  
  // 3. YouTube Cookies
  if (health.cookies?.status !== 'Configured') {
    return 'settings-cookies'
  }
  
  return 'settings-health'
})

const warningDetails = computed(() => {
  const section = firstMissingPrerequisiteSection.value
  if (section === 'settings-api') {
    return {
      title: 'Gemini API Key Required',
      description: 'The Gemini API Key is missing or invalid. Please configure it to enable transcription analysis and AI clipping features.',
      icon: 'ri:key-2-fill',
      buttonText: 'Configure API Key'
    }
  } else if (section === 'settings-cookies') {
    return {
      title: 'YouTube Cookies Missing',
      description: 'A cookies.txt file has not been provided. Restricted or age-gated YouTube videos may fail to download without valid cookies.',
      icon: 'ri:shield-keyhole-fill',
      buttonText: 'Upload Cookies'
    }
  } else {
    return {
      title: 'System Prerequisites Missing',
      description: 'Essential system tools (FFmpeg, Node.js, or Python environment) are not fully configured. Let\'s fix them to enable all features.',
      icon: 'ri:alert-fill',
      buttonText: 'Resolve Prerequisites'
    }
  }
})

const dragOver = ref(false)
const deletingCookies = ref(false)
const cookiesStatus = ref<{ exists: boolean; size_bytes: number; last_modified: string | null }>({ exists: false, size_bytes: 0, last_modified: null })

const checkSystemHealth = () => state.checkSystemHealth()

// API Key Validation state
const testingKey = ref(false)
const testResult = ref<{ status: 'idle' | 'valid' | 'invalid'; message: string }>({ status: 'idle', message: '' })

async function testApiKeys() {
  const filledKeys = keysList.value.filter(k => k.value.trim().length > 0)
  if (filledKeys.length === 0) {
    state.showToast('No API keys to test.', 'error')
    return
  }
  
  testingKey.value = true
  testResult.value = { status: 'idle', message: '' }
  
  // Mark all filled keys as testing
  keysList.value.forEach(k => {
    if (k.value.trim()) {
      k.status = 'testing'
      k.error = ''
    }
  })

  try {
    const payload = JSON.stringify(
      keysList.value
        .map(k => ({ title: k.title.trim(), value: k.value.trim() }))
        .filter(k => k.value.length > 0)
    )

    const res = await $fetch<{
      status: 'valid' | 'invalid'
      results: Array<{ key: string; status: 'valid' | 'invalid'; error: string | null; raw_error?: string | null }>
      error?: string
    }>(`${API_BASE}/api/validate-gemini-key`, {
      method: 'POST',
      body: {
        api_key: payload
      }
    })

    if (res.results && res.results.length > 0) {
      res.results.forEach((r) => {
        const matchingKey = keysList.value.find(k => k.value.trim() === r.key)
        if (matchingKey) {
          matchingKey.status = r.status
          matchingKey.error = r.error || ''
          matchingKey.raw_error = r.raw_error || ''
          matchingKey.showRawError = false
        }
      })
    }

    if (res.status === 'valid') {
      testResult.value = {
        status: 'valid',
        message: 'All tested Gemini API keys are verified and functional!'
      }
      state.showToast('All API keys verified successfully!', 'success')
      checkSystemHealth()
    } else {
      testResult.value = {
        status: 'invalid',
        message: res.error || 'One or more API keys failed verification. Check details above.'
      }
      state.showToast('Validation failed for one or more keys.', 'error')
    }
  } catch (e: any) {
    const errMsg = e.data?.detail || e.message || 'Failed to connect to backend server'
    testResult.value = {
      status: 'invalid',
      message: errMsg
    }
    keysList.value.forEach(k => {
      if (k.value.trim()) {
        k.status = 'invalid'
        k.error = errMsg
        k.raw_error = typeof e === 'object' ? JSON.stringify(e, null, 2) : String(e)
        k.showRawError = false
      }
    })
    state.showToast(`Error testing keys: ${errMsg}`, 'error')
  } finally {
    testingKey.value = false
  }
}

async function fetchSettings() {
  try {
    const res = await $fetch<{ settings: Record<string, string> }>(`${API_BASE}/api/system-settings`)
    if (res.settings) {
      ffmpegPath.value = res.settings.FFMPEG_PATH || ''
      nodePath.value = res.settings.NODE_PATH || ''
      
      const rawGemini = res.settings.GEMINI_API_KEY || ''
      
      if (rawGemini.trim().startsWith('[')) {
        try {
          const parsed = JSON.parse(rawGemini)
          if (Array.isArray(parsed) && parsed.length > 0) {
            keysList.value = parsed.map((item: any) => ({
              id: Math.random().toString(36).substring(2, 9),
              title: item.title || '',
              value: item.value || '',
              show: false,
              status: 'idle',
              error: '',
              raw_error: '',
              showRawError: false,
              activeFlash: false
            }))
          }
        } catch (e) {
          console.error('Failed to parse GEMINI_API_KEY as JSON array', e)
        }
      } else if (rawGemini.trim()) {
        const parts = rawGemini.split(',').map(s => s.trim()).filter(Boolean)
        if (parts.length > 0) {
          keysList.value = parts.map(keyVal => ({
            id: Math.random().toString(36).substring(2, 9),
            title: '',
            value: keyVal,
            show: false,
            status: 'idle',
            error: '',
            raw_error: '',
            showRawError: false,
            activeFlash: false
          }))
        }
      }
      
      originalSerializedKeys.value = JSON.stringify(keysList.value.map(k => ({ title: k.title.trim(), value: k.value.trim() })))
    }
  } catch (e) {
    console.error('Failed to fetch system settings', e)
  }
}

async function saveApiKeys() {
  try {
    const payload = keysList.value
      .map(k => ({ title: k.title.trim(), value: k.value.trim() }))
      .filter(k => k.value.length > 0)
    
    await $fetch(`${API_BASE}/api/system-settings`, {
      method: 'PUT',
      body: {
        GEMINI_API_KEY: JSON.stringify(payload)
      }
    })
    
    originalSerializedKeys.value = JSON.stringify(keysList.value.map(k => ({ title: k.title.trim(), value: k.value.trim() })))
    state.showToast('API Keys saved successfully!', 'success')
    checkSystemHealth()
  } catch (e: any) {
    const errMsg = e.data?.detail || e.message || 'Failed to save API keys'
    state.showToast(`Failed to save API keys: ${errMsg}`, 'error')
  }
}

const ffmpegStatusBadge = computed(() => {
  if (ffmpegPath.value.trim()) {
    return {
      label: 'Custom Override',
      class: 'bg-black/40 border border-accent-500/30 text-accent-400',
      dotClass: 'bg-accent-400'
    }
  }
  if (healthData.value?.ffmpeg?.status === 'OK') {
    return {
      label: 'Auto-Detected (System PATH)',
      class: 'bg-black/40 border border-white/5 text-emerald-400',
      dotClass: 'bg-emerald-400'
    }
  }
  return {
    label: 'Missing from PATH',
    class: 'bg-amber-500/10 border border-amber-500/20 text-amber-400',
    dotClass: 'bg-amber-400'
  }
})

const nodeStatusBadge = computed(() => {
  if (nodePath.value.trim()) {
    return {
      label: 'Custom Override',
      class: 'bg-black/40 border border-accent-500/30 text-accent-400',
      dotClass: 'bg-accent-400'
    }
  }
  if (healthData.value?.node?.status === 'OK') {
    return {
      label: 'Auto-Detected (System PATH)',
      class: 'bg-black/40 border border-white/5 text-emerald-400',
      dotClass: 'bg-emerald-400'
    }
  }
  return {
    label: 'Optional (Not in PATH)',
    class: 'bg-black/40 border border-white/5 text-slate-400',
    dotClass: 'bg-slate-500'
  }
})

async function testBinaryPath(tool: 'ffmpeg' | 'node'): Promise<boolean> {
  const targetValidation = tool === 'ffmpeg' ? ffmpegValidation : nodeValidation
  const currentPath = tool === 'ffmpeg' ? ffmpegPath.value : nodePath.value

  targetValidation.value.testing = true
  targetValidation.value.tested = false

  try {
    const res = await $fetch<{ valid: boolean; detected_path: string; is_system_default?: boolean; message: string }>(`${API_BASE}/api/validate-binary-path`, {
      method: 'POST',
      body: {
        tool,
        path: currentPath
      }
    })
    targetValidation.value = {
      testing: false,
      tested: true,
      valid: res.valid,
      message: res.message,
      detectedPath: res.detected_path,
      isSystemDefault: res.is_system_default
    }
    return res.valid
  } catch (e: any) {
    const errMsg = e.data?.detail || e.message || `Failed to validate ${tool} path`
    targetValidation.value = {
      testing: false,
      tested: true,
      valid: false,
      message: errMsg,
      detectedPath: ''
    }
    return false
  }
}

function resetEnvPath(tool: 'ffmpeg' | 'node') {
  if (tool === 'ffmpeg') {
    ffmpegPath.value = ''
    ffmpegValidation.value = { testing: false, tested: false, valid: false, message: '', detectedPath: '' }
  } else {
    nodePath.value = ''
    nodeValidation.value = { testing: false, tested: false, valid: false, message: '', detectedPath: '' }
  }
}

async function saveEnvPaths() {
  savingEnvPaths.value = true
  try {
    // 1. Always validate both tools first before persisting
    const [ffmpegOk, nodeOk] = await Promise.all([
      testBinaryPath('ffmpeg'),
      testBinaryPath('node')
    ])

    if (!ffmpegOk || !nodeOk) {
      const failedTools: string[] = []
      if (!ffmpegOk) failedTools.push('FFmpeg')
      if (!nodeOk) failedTools.push('Node.js')
      state.showToast(`Validation failed for ${failedTools.join(' and ')}. Please provide valid executable locations before saving.`, 'error')
      return
    }

    // 2. Only save if validation succeeded
    await $fetch(`${API_BASE}/api/system-settings`, {
      method: 'PUT',
      body: {
        FFMPEG_PATH: ffmpegPath.value,
        NODE_PATH: nodePath.value
      }
    })
    state.showToast('Environment paths validated and saved successfully!', 'success')
    checkSystemHealth()
  } catch (e: any) {
    const errMsg = e.data?.detail || e.message || 'Failed to save environment paths'
    state.showToast(`Failed to save environment paths: ${errMsg}`, 'error')
  } finally {
    savingEnvPaths.value = false
  }
}

async function fetchCookiesStatus() {
  try {
    const res = await $fetch<{ exists: boolean; size_bytes: number; last_modified: string | null }>(`${API_BASE}/api/cookies-status`)
    cookiesStatus.value = res
  } catch (e) {
    console.error('Failed to fetch cookies status', e)
  }
}

async function uploadCookiesText(text: string) {
  try {
    const res = await $fetch<{ status: string; message: string }>(`${API_BASE}/api/upload-cookies`, {
      method: 'POST',
      body: { cookies_text: text }
    })
    if (res.status === 'ok') {
      state.showToast('cookies.txt uploaded successfully!', 'success')
      fetchCookiesStatus()
      checkSystemHealth()
    } else {
      state.showToast('Failed to upload cookies', 'error')
    }
  } catch (e: any) {
    const errDetail = e.data?.detail || 'Invalid cookies format. Ensure it is Netscape format.'
    state.showToast(errDetail, 'error')
  }
}

function handleFileSelect(event: any) {
  const file = event.target.files[0]
  if (!file) return
  
  const reader = new FileReader()
  reader.onload = (e) => {
    const text = e.target?.result as string
    uploadCookiesText(text)
  }
  reader.readAsText(file)
}

function handleFileDrop(event: any) {
  dragOver.value = false
  const file = event.dataTransfer?.files[0]
  if (!file) return
  
  if (!file.name.endsWith('.txt')) {
    state.showToast('Please upload a valid .txt cookie file', 'error')
    return
  }
  
  const reader = new FileReader()
  reader.onload = (e) => {
    const text = e.target?.result as string
    uploadCookiesText(text)
  }
  reader.readAsText(file)
}

async function deleteCookies() {
  deletingCookies.value = true
  try {
    await $fetch(`${API_BASE}/api/delete-cookies`, {
      method: 'DELETE'
    })
    state.showToast('cookies.txt deleted successfully', 'success')
    fetchCookiesStatus()
    checkSystemHealth()
  } catch (e) {
    state.showToast('Failed to delete cookies', 'error')
  } finally {
    deletingCookies.value = false
  }
}

// Helpers
function formatBytes(bytes: number) {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function formatDate(isoString: string | null) {
  if (!isoString) return 'Never'
  const date = new Date(isoString)
  return date.toLocaleString()
}

function copyToClipboard(text: string, label: string = 'Command') {
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    navigator.clipboard.writeText(text)
    state.showToast(`${label} copied to clipboard!`, 'success')
  }
}

onMounted(() => {
  fetchSettings()
  checkSystemHealth()
  fetchCookiesStatus()
  updateIndicator()
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', updateIndicator)
  }
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', updateIndicator)
  }
})
</script>

<style scoped>
@keyframes pulse-subtle {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.9; }
}
.animate-pulse-subtle {
  animation: pulse-subtle 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

/* Cross-fade transition for switching settings sections */
.section-fade-enter-active,
.section-fade-leave-active {
  transition: opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1), transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.section-fade-enter-from {
  opacity: 0;
  transform: translateY(4px);
}

.section-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* FLIP list transition for reordering fallback key cards */
.list-keys-move,
.list-keys-enter-active,
.list-keys-leave-active {
  transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.list-keys-enter-from,
.list-keys-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(-10px);
}

.list-keys-leave-active {
  position: absolute;
  left: 0;
  right: 0;
}
</style>
