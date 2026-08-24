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
        class="flex items-center gap-1.5 px-3.5 py-2 bg-surface-dark/80 hover:bg-surface-dark border border-surface-border hover:border-accent-500/30 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 self-start sm:self-auto cursor-pointer shadow-sm"
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
        class="mb-6 p-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-pulse-subtle"
      >
        <div class="flex items-start sm:items-center gap-3">
          <div class="p-2 rounded-xl bg-amber-500/10 text-amber-500 shrink-0">
            <Icon :name="warningDetails.icon" class="text-xl" />
          </div>
          <div>
            <h4 class="text-sm font-bold text-white leading-snug">{{ warningDetails.title }}</h4>
            <p class="text-xs text-slate-400 mt-0.5">{{ warningDetails.description }}</p>
          </div>
        </div>
        
        <button 
          @click="switchTab(normalizeTab(firstMissingPrerequisiteSection))"
          class="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold uppercase tracking-wider text-[10px] rounded-lg transition-all shrink-0 self-start sm:self-center cursor-pointer"
        >
          {{ warningDetails.buttonText }}
        </button>
      </div>
    </Transition>

    <!-- Two-Column Settings Layout -->
    <div class="flex flex-col md:flex-row gap-6 items-start w-full">
      <!-- Left Column / Category Sidebar -->
      <aside class="w-full md:w-64 lg:w-72 shrink-0 flex flex-col gap-3 md:sticky md:top-2 self-start">
        <!-- Navigation Panel -->
        <div class="bg-surface-panel border border-surface-border rounded-2xl p-2 sm:p-2.5 flex flex-row md:flex-col gap-1.5 shadow-xl overflow-x-auto md:overflow-visible custom-scrollbar">
          <div class="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hidden md:flex items-center justify-between">
            <span>Categories</span>
            <span class="text-[9px] text-slate-600 font-mono font-normal">5 sections</span>
          </div>

          <button
            v-for="section in sections"
            :key="section.id"
            @click="switchTab(section.id)"
            class="flex items-center justify-between px-3.5 py-3 rounded-xl text-left transition-all group relative shrink-0 cursor-pointer outline-none focus:outline-none focus-visible:ring-1 focus-visible:ring-accent-500/50 select-none"
            :class="activeTab === section.id 
              ? 'bg-accent-500/10 border border-accent-500/30 text-white' 
              : 'text-slate-400 hover:text-slate-200 hover:bg-surface-dark/70 border border-transparent'"
          >
            <!-- Active Indicator Bar (desktop) -->
            <div 
              v-if="activeTab === section.id"
              class="hidden md:block absolute left-0 top-2.5 bottom-2.5 w-1 bg-accent-500 rounded-r"
            ></div>

            <div class="flex items-center gap-3 min-w-0">
              <div 
                class="p-2 rounded-lg transition-colors shrink-0"
                :class="activeTab === section.id ? 'bg-accent-500/15 text-accent-500 border border-accent-500/30' : 'bg-surface-dark text-slate-400 group-hover:text-slate-200 border border-surface-border/60'"
              >
                <Icon :name="section.icon" class="text-base sm:text-lg block" />
              </div>
              <div class="flex flex-col min-w-0">
                <span class="text-xs font-bold truncate leading-tight" :class="activeTab === section.id ? 'text-white' : 'text-slate-300 group-hover:text-white'">
                  {{ section.label }}
                </span>
                <span class="text-[10px] text-slate-500 hidden lg:block truncate mt-0.5">
                  {{ section.desc }}
                </span>
              </div>
            </div>

            <!-- Status Badges -->
            <div class="ml-2 shrink-0 flex items-center">
              <!-- Warning Pill -->
              <span 
                v-if="section.badgeType === 'warning'"
                class="text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-tighter bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center gap-1 animate-pulse"
              >
                <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                <span class="hidden sm:inline">{{ section.badgeText }}</span>
              </span>

              <!-- OK Pill -->
              <span 
                v-else-if="section.badgeType === 'ok'"
                class="text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-tighter bg-accent-500/10 text-accent-500 border border-accent-500/20 flex items-center gap-1"
              >
                <span class="w-1.5 h-1.5 rounded-full bg-accent-500"></span>
                <span class="hidden sm:inline">{{ section.badgeText }}</span>
              </span>

              <!-- Neutral Tag -->
              <span 
                v-else-if="section.badgeType === 'neutral'"
                class="text-[9px] px-1.5 py-0.5 rounded font-mono font-bold uppercase tracking-tighter bg-surface-dark border border-surface-border text-slate-400 hidden sm:inline"
              >
                {{ section.badgeText }}
              </span>
            </div>
          </button>
        </div>

        <!-- Quick Summary Box (desktop only) -->
        <div class="hidden md:flex flex-col gap-2 p-3.5 bg-surface-panel/60 border border-surface-border/70 rounded-2xl text-xs text-slate-400">
          <div class="flex items-center justify-between text-[11px] font-bold text-slate-300">
            <span class="flex items-center gap-1.5">
              <Icon name="ri:information-line" class="text-accent-500" />
              Settings Scope
            </span>
            <span class="text-[9px] px-1.5 py-0.5 rounded bg-surface-dark border border-surface-border font-mono text-slate-400">
              Client & Local
            </span>
          </div>
          <p class="text-[11px] text-slate-500 leading-relaxed">
            All credentials and local paths are stored securely in your project configuration (<code class="text-slate-400">.env</code>).
          </p>
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
                  <Icon name="ri:shield-cross-line" class="text-accent-500" /> Prerequisite Health & Diagnostics
                </h3>
                <span 
                  class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                  :class="isHealthOk ? 'bg-accent-500/10 text-accent-500 border border-accent-500/20' : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'"
                >
                  {{ isHealthOk ? 'System Healthy' : 'Action Required' }}
                </span>
              </div>
              <p class="text-sm text-slate-400">Verify the health and directory paths of local software components and APIs required for rendering and AI generation.</p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <!-- FFmpeg Diagnostics -->
              <div class="p-4 rounded-xl border bg-[#111318] border-surface-border flex items-start gap-3">
                <div class="p-2.5 rounded-xl bg-surface-dark border border-surface-border/60 text-slate-300 shrink-0">
                  <Icon name="ri:movie-2-line" class="text-xl block text-accent-500" />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-black uppercase tracking-widest text-slate-300">FFmpeg (Video Engine)</span>
                    <span 
                      class="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter flex items-center gap-1" 
                      :class="healthData?.ffmpeg?.status === 'OK' ? 'bg-accent-500/10 text-accent-500 border border-accent-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'"
                    >
                      <Icon :name="healthData?.ffmpeg?.status === 'OK' ? 'ri:check-line' : 'ri:close-line'" class="text-xs font-bold" />
                      {{ healthData?.ffmpeg?.status || 'Detecting...' }}
                    </span>
                  </div>
                  <p class="text-[10px] text-slate-500 truncate font-mono mt-1.5" :title="healthData?.ffmpeg?.path">
                    Path: {{ healthData?.ffmpeg?.path || 'Not checked' }}
                  </p>
                  <p v-if="healthData && healthData.ffmpeg?.status !== 'OK'" class="text-[10px] text-amber-500 mt-1 leading-normal">
                    Missing! Install FFmpeg to extract audio and convert video. 
                    <span class="block text-slate-400 mt-1">
                      <strong>macOS:</strong> <code class="bg-black/30 px-1 py-0.5 rounded text-[9px] text-slate-300">brew install ffmpeg</code><br>
                      <strong>Ubuntu/Debian:</strong> <code class="bg-black/30 px-1 py-0.5 rounded text-[9px] text-slate-300">sudo apt install ffmpeg</code><br>
                      <strong>Windows:</strong> Download from <a href="https://ffmpeg.org" target="_blank" class="underline hover:text-white">ffmpeg.org</a> and add to system PATH.
                    </span>
                  </p>
                </div>
              </div>

              <!-- Node.js Diagnostics -->
              <div class="p-4 rounded-xl border bg-[#111318] border-surface-border flex items-start gap-3">
                <div class="p-2.5 rounded-xl bg-surface-dark border border-surface-border/60 text-slate-300 shrink-0">
                  <Icon name="ri:nodejs-line" class="text-xl block text-accent-500" />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-black uppercase tracking-widest text-slate-300">Node.js (Remotion Engine)</span>
                    <span 
                      class="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter flex items-center gap-1" 
                      :class="healthData?.node?.status === 'OK' ? 'bg-accent-500/10 text-accent-500 border border-accent-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'"
                    >
                      <Icon :name="healthData?.node?.status === 'OK' ? 'ri:check-line' : 'ri:close-line'" class="text-xs font-bold" />
                      {{ healthData?.node?.status || 'Detecting...' }}
                    </span>
                  </div>
                  <p class="text-[10px] text-slate-500 truncate font-mono mt-1.5" :title="healthData?.node?.path">
                    Path: {{ healthData?.node?.path || 'Not checked' }}
                  </p>
                  <p v-if="healthData && healthData.node?.status !== 'OK'" class="text-[10px] text-amber-500 mt-1 leading-normal">
                    Missing! Required to compile and render React Remotion video templates.
                    <span class="block text-slate-400 mt-1">
                      <strong>macOS:</strong> <code class="bg-black/30 px-1 py-0.5 rounded text-[9px] text-slate-300">brew install node</code><br>
                      <strong>Ubuntu/Debian:</strong> <code class="bg-black/30 px-1 py-0.5 rounded text-[9px] text-slate-300">curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs</code><br>
                      <strong>Windows/macOS:</strong> Download from <a href="https://nodejs.org" target="_blank" class="underline hover:text-white">nodejs.org</a>.
                    </span>
                  </p>
                </div>
              </div>

              <!-- Python Virtual Environment Diagnostics -->
              <div class="p-4 rounded-xl border bg-[#111318] border-surface-border flex items-start gap-3">
                <div class="p-2.5 rounded-xl bg-surface-dark border border-surface-border/60 text-slate-300 shrink-0">
                  <Icon name="ri:terminal-box-line" class="text-xl block text-accent-500" />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-black uppercase tracking-widest text-slate-300">Python Virtualenv</span>
                    <span 
                      class="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter flex items-center gap-1" 
                      :class="healthData?.python_env?.status === 'OK' ? 'bg-accent-500/10 text-accent-500 border border-accent-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'"
                    >
                      <Icon :name="healthData?.python_env?.status === 'OK' ? 'ri:check-line' : 'ri:close-line'" class="text-xs font-bold" />
                      {{ healthData?.python_env?.status || 'Detecting...' }}
                    </span>
                  </div>
                  <p class="text-[10px] text-slate-500 mt-1.5 leading-normal">
                    Virtual environment packages (FastAPI, google-genai) are loaded.
                  </p>
                  <p v-if="healthData && healthData.python_env?.status !== 'OK'" class="text-[10px] text-amber-500 mt-1 leading-normal">
                    Degraded! Essential virtual environment packages (FastAPI, google-genai) are not fully loaded.
                    <span class="block text-slate-400 mt-1">
                      Please run the setup script or install missing dependencies:<br>
                      <code class="bg-black/30 px-1 py-0.5 rounded text-[9px] text-slate-300">pip install -r requirements.txt</code>
                    </span>
                  </p>
                </div>
              </div>

              <!-- Gemini API Diagnostics -->
              <div class="p-4 rounded-xl border bg-[#111318] border-surface-border flex items-start gap-3">
                <div class="p-2.5 rounded-xl bg-surface-dark border border-surface-border/60 text-slate-300 shrink-0">
                  <Icon name="ri:key-2-line" class="text-xl block text-accent-500" />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-black uppercase tracking-widest text-slate-300">Gemini AI Key</span>
                    <span 
                      class="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter flex items-center gap-1" 
                      :class="healthData?.gemini_api?.has_key ? 'bg-accent-500/10 text-accent-500 border border-accent-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'"
                    >
                      <Icon :name="healthData?.gemini_api?.has_key ? 'ri:check-line' : 'ri:close-line'" class="text-xs font-bold" />
                      {{ healthData?.gemini_api?.status || 'Detecting...' }}
                    </span>
                  </div>
                  <p class="text-[10px] text-slate-500 mt-1.5 leading-normal">
                    Used to find viral hooks and generate engaging titles automatically.
                  </p>
                </div>
              </div>

              <!-- YouTube Cookies Diagnostics -->
              <div class="p-4 rounded-xl border bg-[#111318] border-surface-border flex items-start gap-3 md:col-span-2">
                <div class="p-2.5 rounded-xl bg-surface-dark border border-surface-border/60 text-slate-300 shrink-0">
                  <Icon name="ri:shield-keyhole-line" class="text-xl block text-accent-500" />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-black uppercase tracking-widest text-slate-300">YouTube Cookies</span>
                    <span 
                      class="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter flex items-center gap-1" 
                      :class="healthData?.cookies?.exists ? 'bg-accent-500/10 text-accent-500 border border-accent-500/20' : 'bg-surface-dark border border-surface-border text-slate-400'"
                    >
                      <Icon :name="healthData?.cookies?.exists ? 'ri:check-line' : 'ri:information-line'" class="text-xs font-bold" />
                      {{ healthData?.cookies?.status || 'Detecting...' }}
                    </span>
                  </div>
                  <p class="text-[10px] text-slate-500 mt-1.5 leading-normal">
                    Helps bypass YouTube's download rate-limits and bot-detection filters.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- API Key Setting -->
          <div v-else-if="activeTab === 'api'" key="api" id="settings-api" class="scroll-mt-24 flex flex-col gap-6">
            <div>
              <h3 class="text-lg font-bold text-white mb-2 flex items-center gap-2">
                <Icon name="ri:key-2-fill" class="text-accent-500" /> API Configuration
              </h3>
              <p class="text-sm text-slate-400">Configure fallback Gemini API keys to ensure high availability. The first valid key in the list is treated as the Primary key. Adjust ordering using up/down arrow buttons or drag & drop.</p>
            </div>
            
            <TransitionGroup name="list-keys" tag="div" class="flex flex-col gap-4 relative">
              <div 
                v-for="(keyItem, index) in keysList" 
                :key="keyItem.id"
                draggable="true"
                @dragstart="dragStart(index, $event)"
                @dragover.prevent
                @dragenter="dragEnter(index)"
                @dragend="dragEnd"
                class="p-4 rounded-xl border bg-[#111318] border-surface-border flex flex-col gap-3 transition-all duration-300"
                :class="{ 
                  'border-accent-500': keyItem.activeFlash,
                  'opacity-30 border-dashed border-accent-500/50 bg-accent-500/5 cursor-grabbing': index === draggedIndex
                }"
              >
                <div class="flex items-center justify-between">
                  <span class="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 cursor-grab">
                    <Icon name="ri:drag-move-2-fill" class="text-slate-300 hover:text-accent-500 active:text-accent-400 transition-colors text-base shrink-0 cursor-grab" />
                    Key #{{ index + 1 }} {{ index === 0 ? '(Primary)' : `(Fallback #${index})` }}
                    <span v-if="getKeyPreview(keyItem.value)" class="text-[10px] font-mono text-slate-500 normal-case ml-2">
                      ({{ getKeyPreview(keyItem.value) }})
                    </span>
                  </span>
                  <div class="flex items-center gap-3">
                    <!-- Reorder Controls -->
                    <div class="flex items-center gap-1 bg-surface-dark border border-surface-border/50 rounded-lg px-1.5 py-0.5">
                      <button 
                        @click="moveKey(index, -1)"
                        :disabled="index === 0"
                        class="p-1 text-slate-500 hover:text-white transition-colors disabled:opacity-20 disabled:hover:text-slate-500 cursor-pointer"
                        title="Move Up"
                      >
                        <Icon name="ri:arrow-up-line" class="text-xs" />
                      </button>
                      <button 
                        @click="moveKey(index, 1)"
                        :disabled="index === keysList.length - 1"
                        class="p-1 text-slate-500 hover:text-white transition-colors disabled:opacity-20 disabled:hover:text-slate-500 cursor-pointer"
                        title="Move Down"
                      >
                        <Icon name="ri:arrow-down-line" class="text-xs" />
                      </button>
                    </div>

                    <!-- Status Badge -->
                    <span 
                      class="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter" 
                      :class="{
                        'bg-accent-500/10 text-accent-500': keyItem.status === 'valid',
                        'bg-red-500/10 text-red-500': keyItem.status === 'invalid',
                        'bg-surface-dark border border-surface-border text-slate-500': keyItem.status === 'idle',
                        'bg-amber-500/10 text-amber-500 animate-pulse': keyItem.status === 'testing'
                      }"
                    >
                      {{ keyItem.status === 'valid' ? 'Valid' : keyItem.status === 'invalid' ? 'Invalid' : keyItem.status === 'testing' ? 'Testing...' : 'Not Tested' }}
                    </span>
                    
                    <!-- Delete Button -->
                    <button 
                      @click="removeKey(index)" 
                      class="p-1 text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                      title="Remove Key"
                    >
                      <Icon name="ri:delete-bin-6-line" class="text-sm" />
                    </button>
                  </div>
                </div>
                
                <div class="flex flex-col md:flex-row gap-3">
                  <!-- Title input -->
                  <div class="w-full md:w-1/3">
                    <input 
                      v-model="keyItem.title"
                      type="text"
                      placeholder="e.g. Work Key" 
                      class="w-full bg-surface-dark border border-surface-border text-white px-4 py-2.5 rounded-lg focus:outline-none focus:border-accent-500/50 transition-all text-xs"
                    />
                  </div>
                  
                  <!-- Key input -->
                  <div class="flex-1 relative">
                    <input 
                      v-model="keyItem.value"
                      :type="keyItem.show ? 'text' : 'password'" 
                      placeholder="AIzaSy..." 
                      class="w-full bg-surface-dark border border-surface-border text-white px-4 py-2.5 rounded-lg focus:outline-none focus:border-accent-500/50 transition-all font-mono text-xs pr-10"
                    />
                    <button @click="keyItem.show = !keyItem.show" class="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 cursor-pointer">
                      <Icon :name="keyItem.show ? 'ri:eye-off-fill' : 'ri:eye-fill'" class="text-base" />
                    </button>
                  </div>
                </div>

                <!-- Individual error message -->
                <div 
                  v-if="keyItem.status === 'invalid' && keyItem.error"
                  class="text-[11px] text-red-400 mt-1 flex items-start gap-1"
                >
                  <Icon name="ri:error-warning-line" class="text-sm shrink-0 mt-0.5" />
                  <span>{{ keyItem.error }}</span>
                </div>
              </div>

              <!-- Empty state if all keys removed -->
              <div 
                v-if="keysList.length === 0"
                :key="'empty'"
                class="p-6 rounded-xl border border-dashed border-surface-border bg-surface-dark/10 text-center"
              >
                <p class="text-sm text-slate-500 mb-3">No API keys configured. Gemini features will not be available.</p>
                <button 
                  @click="addKey"
                  class="px-4 py-2 bg-surface-card border border-surface-border hover:border-accent-500/50 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  Add API Key
                </button>
              </div>
            </TransitionGroup>

            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mt-2">
              <button 
                v-if="keysList.length > 0"
                @click="addKey"
                class="flex items-center gap-1.5 px-4 py-2.5 bg-surface-dark border border-surface-border text-slate-300 hover:text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
              >
                <Icon name="ri:add-line" />
                Add Fallback Key
              </button>
              
              <div class="flex items-center gap-3 sm:ml-auto w-full sm:w-auto justify-end">
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
                    class="text-[11px] text-amber-500 flex items-center gap-1.5 bg-amber-500/5 border border-amber-500/20 px-2.5 py-1.5 rounded-lg animate-pulse-subtle shrink-0"
                  >
                    <Icon name="ri:alert-line" class="text-xs shrink-0" />
                    Unsaved changes
                  </span>
                </Transition>

                <button 
                  v-if="keysList.length > 0"
                  @click="saveApiKeys"
                  class="px-5 py-2.5 bg-surface-card border border-surface-border text-white font-bold uppercase tracking-wider text-[10px] rounded-lg hover:border-accent-500/50 hover:text-accent-500 transition-all shrink-0 cursor-pointer"
                >
                  Save Keys
                </button>
                <button 
                  v-if="keysList.length > 0"
                  @click="testApiKeys"
                  :disabled="testingKey"
                  class="px-5 py-2.5 bg-accent-500 text-black font-bold uppercase tracking-wider text-[10px] rounded-lg hover:bg-accent-400 transition-all flex items-center gap-1.5 disabled:opacity-50 shrink-0 cursor-pointer"
                >
                  <Icon name="ri:flashlight-fill" />
                  {{ testingKey ? 'Testing...' : 'Test All Connections' }}
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
                class="p-3.5 rounded-lg border text-xs leading-normal flex items-start gap-2.5"
                :class="testResult.status === 'valid' ? 'bg-accent-500/10 border-accent-500/20 text-accent-400' : 'bg-red-500/10 border-red-500/20 text-red-400'"
              >
                <Icon :name="testResult.status === 'valid' ? 'ri:checkbox-circle-fill' : 'ri:error-warning-fill'" class="text-lg shrink-0 mt-0.5" />
                <div>
                  <span class="font-bold block mb-0.5">{{ testResult.status === 'valid' ? 'Gemini API keys are verified!' : 'Connection checks failed' }}</span>
                  <p class="text-slate-300">{{ testResult.message }}</p>
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
            <div>
              <h3 class="text-lg font-bold text-white mb-2 flex items-center gap-2">
                <Icon name="ri:shield-keyhole-fill" class="text-accent-500" /> YouTube Cookies (yt-dlp)
              </h3>
              <p class="text-sm text-slate-400">Import your YouTube cookies to bypass rate limits, captchas, and bot detection when fetching or downloading videos.</p>
            </div>
            
            <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <!-- Uploader / Manager Box -->
              <div class="lg:col-span-7 flex flex-col gap-4">
                
                <!-- Upload Drag & Drop Area -->
                <div 
                  @dragover.prevent="dragOver = true"
                  @dragleave.prevent="dragOver = false"
                  @drop.prevent="handleFileDrop"
                  :class="dragOver ? 'border-accent-500 bg-accent-500/5' : 'border-surface-border bg-surface-dark/30 hover:border-slate-700'"
                  class="w-full h-44 rounded-xl border-2 border-dashed flex flex-col items-center justify-center p-6 text-center transition-all cursor-pointer relative"
                  @click="fileInput?.click()"
                >
                  <input 
                    ref="fileInput" 
                    type="file" 
                    accept=".txt" 
                    class="hidden" 
                    @change="handleFileSelect" 
                  />
                  
                  <Icon 
                    name="ri:file-upload-line" 
                    class="text-4xl text-slate-500 mb-3 group-hover:text-accent-500 transition-colors"
                    :class="{ 'text-accent-500 scale-110': dragOver }"
                  />
                  <span class="text-sm font-bold text-slate-300">
                    Drag & drop your <code class="font-mono text-accent-500">cookies.txt</code> here
                  </span>
                  <span class="text-xs text-slate-500 mt-1.5">
                    Or click to browse files from your computer
                  </span>
                </div>

                <!-- Cookies Status / Actions -->
                <div v-if="cookiesStatus.exists" class="flex flex-col p-4 rounded-xl border border-surface-border bg-surface-dark/50">
                  <div class="flex justify-between items-center">
                    <div class="flex items-center gap-2">
                      <Icon name="ri:file-text-fill" class="text-accent-500 text-lg" />
                      <div class="flex flex-col">
                        <span class="text-xs font-bold text-white">cookies.txt (Active)</span>
                        <span class="text-[10px] text-slate-500 font-mono mt-0.5">
                          Size: {{ formatBytes(cookiesStatus.size_bytes) }} • Updated: {{ formatDate(cookiesStatus.last_modified) }}
                        </span>
                      </div>
                    </div>
                    
                    <button 
                      @click="deleteCookies"
                      :disabled="deletingCookies"
                      class="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 rounded-lg text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                    >
                      <Icon name="ri:delete-bin-line" />
                      {{ deletingCookies ? 'Deleting...' : 'Delete' }}
                    </button>
                  </div>
                </div>
                
                <div v-else class="flex items-center gap-2.5 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-500 text-xs leading-relaxed">
                  <Icon name="ri:alert-fill" class="text-lg shrink-0" />
                  <p>No cookies active. Downloads may succeed but are highly vulnerable to YouTube's "Sign in to confirm you're not a bot" restriction.</p>
                </div>

              </div>

              <!-- Interactive Guide Accordion -->
              <div class="lg:col-span-5 flex flex-col gap-3">
                <h4 class="text-xs font-black uppercase tracking-widest text-slate-500 mb-1 pl-1">How to obtain cookies?</h4>
                
                <div class="border border-surface-border rounded-xl overflow-hidden bg-surface-dark/30">
                  <!-- Step 1 Accordion -->
                  <div class="border-b border-surface-border">
                    <button 
                      @click="activeStep = activeStep === 1 ? 0 : 1"
                      class="w-full flex justify-between items-center p-3 text-left hover:bg-surface-dark/50 transition-colors cursor-pointer"
                    >
                      <span class="text-xs font-bold text-slate-300 flex items-center gap-2">
                        <span class="w-5 h-5 rounded-full bg-accent-500/10 text-accent-500 flex items-center justify-center text-[10px] font-black">1</span>
                        Install Browser Extension
                      </span>
                      <Icon :name="activeStep === 1 ? 'ri:arrow-up-s-line' : 'ri:arrow-down-s-line'" class="text-slate-500" />
                    </button>
                    <div v-show="activeStep === 1" class="p-3 bg-surface-dark/10 border-t border-surface-border/50 text-[11px] leading-relaxed text-slate-400 flex flex-col gap-2">
                      <p>Install the trusted, open-source <strong>"Get cookies.txt LOCALLY"</strong> extension in your browser:</p>
                      <a 
                        href="https://chromewebstore.google.com/detail/get-cookiestxt-locally/ccloeocionehidjhhicdjiijlkocoodm" 
                        target="_blank"
                        class="inline-flex items-center gap-1.5 self-start text-accent-500 font-bold hover:underline"
                      >
                        <Icon name="ri:chrome-fill" /> Get extension for Chrome / Brave
                      </a>
                      <a 
                        href="https://addons.mozilla.org/en-US/firefox/addon/get-cookies-txt-locally/" 
                        target="_blank"
                        class="inline-flex items-center gap-1.5 self-start text-accent-500 font-bold hover:underline"
                      >
                        <Icon name="ri:firefox-fill" /> Get extension for Firefox
                      </a>
                    </div>
                  </div>

                  <!-- Step 2 Accordion -->
                  <div class="border-b border-surface-border">
                    <button 
                      @click="activeStep = activeStep === 2 ? 0 : 2"
                      class="w-full flex justify-between items-center p-3 text-left hover:bg-surface-dark/50 transition-colors cursor-pointer"
                    >
                      <span class="text-xs font-bold text-slate-300 flex items-center gap-2">
                        <span class="w-5 h-5 rounded-full bg-accent-500/10 text-accent-500 flex items-center justify-center text-[10px] font-black">2</span>
                        Navigate & Log In
                      </span>
                      <Icon :name="activeStep === 2 ? 'ri:arrow-up-s-line' : 'ri:arrow-down-s-line'" class="text-slate-500" />
                    </button>
                    <div v-show="activeStep === 2" class="p-3 bg-surface-dark/10 border-t border-surface-border/50 text-[11px] leading-relaxed text-slate-400 flex flex-col gap-2">
                      <p>Go to <a href="https://youtube.com" target="_blank" class="text-accent-500 hover:underline font-bold">youtube.com</a> in a new tab.</p>
                      <p>For best results, make sure you are logged in to your Google Account. This ensures YouTube treats your request as a real session.</p>
                    </div>
                  </div>

                  <!-- Step 3 Accordion -->
                  <div>
                    <button 
                      @click="activeStep = activeStep === 3 ? 0 : 3"
                      class="w-full flex justify-between items-center p-3 text-left hover:bg-surface-dark/50 transition-colors cursor-pointer"
                    >
                      <span class="text-xs font-bold text-slate-300 flex items-center gap-2">
                        <span class="w-5 h-5 rounded-full bg-accent-500/10 text-accent-500 flex items-center justify-center text-[10px] font-black">3</span>
                        Export & Upload
                      </span>
                      <Icon :name="activeStep === 3 ? 'ri:arrow-up-s-line' : 'ri:arrow-down-s-line'" class="text-slate-500" />
                    </button>
                    <div v-show="activeStep === 3" class="p-3 bg-surface-dark/10 border-t border-surface-border/50 text-[11px] leading-relaxed text-slate-400 flex flex-col gap-2.5">
                      <p>1. While on the YouTube tab, click the <strong>Get cookies.txt LOCALLY</strong> extension icon in your toolbar.</p>
                      <p>2. Select the option <strong>"youtube.com"</strong> (under Active Tab) and click the <strong>"Export as Netscape format"</strong> or download icon.</p>
                      <p>3. Drop the downloaded <code class="font-mono text-accent-500">youtube.com_cookies.txt</code> file directly into the drag box on the left!</p>
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
            
            <div class="flex flex-col gap-4">
              <div class="flex flex-col gap-1.5">
                 <label class="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">FFmpeg Path (FFMPEG_PATH)</label>
                 <input 
                   v-model="ffmpegPath"
                   type="text" 
                   placeholder="e.g. C:\ffmpeg\bin" 
                   class="w-full bg-[#111318] border border-surface-border text-white px-4 py-2.5 rounded-lg focus:outline-none focus:border-accent-500/50 transition-all font-mono text-sm"
                 />
              </div>
              <div class="flex flex-col gap-1.5">
                 <label class="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Node.js Path (NODE_PATH)</label>
                 <input 
                   v-model="nodePath"
                   type="text" 
                   placeholder="e.g. C:\Program Files\nodejs" 
                   class="w-full bg-[#111318] border border-surface-border text-white px-4 py-2.5 rounded-lg focus:outline-none focus:border-accent-500/50 transition-all font-mono text-sm"
                 />
              </div>
              <div class="flex justify-end mt-2">
                <button 
                  @click="saveEnvPaths"
                  class="px-6 py-2.5 bg-surface-card border border-surface-border text-white font-bold uppercase tracking-wider text-xs rounded-lg hover:border-accent-500/50 hover:text-accent-500 transition-all cursor-pointer"
                >
                  Save Paths
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
import { ref, onMounted, computed, watch, nextTick } from 'vue'

const state = useClipperState()
const route = useRoute()
const router = useRouter()
const API_BASE = 'http://localhost:8000'

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
    desc: 'Prerequisites & tools',
    icon: 'ri:shield-cross-line',
    badgeType: isHealthOk.value ? 'ok' : 'warning',
    badgeText: isHealthOk.value ? 'OK' : 'Missing'
  },
  {
    id: 'api' as SettingsTab,
    label: 'Gemini API Keys',
    desc: 'Keys & failover pool',
    icon: 'ri:key-2-fill',
    badgeType: hasValidApiKey.value ? 'ok' : 'warning',
    badgeText: hasValidApiKey.value ? (validKeysCount.value > 0 ? `${validKeysCount.value} Valid` : 'Configured') : 'Required'
  },
  {
    id: 'whisper' as SettingsTab,
    label: 'Whisper Engine',
    desc: 'Transcription model',
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
    desc: 'Custom binaries',
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
  activeFlash: boolean
}
const keysList = ref<KeyListItem[]>([
  { id: Math.random().toString(36).substring(2, 9), title: '', value: '', show: false, status: 'idle', error: '', activeFlash: false }
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
const activeStep = ref(1)
const deletingCookies = ref(false)
const cookiesStatus = ref<{ exists: boolean; size_bytes: number; last_modified: string | null }>({ exists: false, size_bytes: 0, last_modified: null })

const checkSystemHealth = () => state.checkSystemHealth()

// API Key Validation state
const testingKey = ref(false)
const testResult = ref<{ status: 'idle' | 'valid' | 'invalid'; message: string }>({ status: 'idle', message: '' })

async function testApiKeys() {
  const filledKeys = keysList.value.map(k => k.value.trim()).filter(Boolean)
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
    const res = await $fetch<{
      status: string
      primary_valid: boolean
      results: Array<{ key_index: number; key_preview: string; valid: boolean; error: string | null }>
      message: string
    }>(`${API_BASE}/api/test-gemini-key`, {
      method: 'POST',
      body: {
        keys: filledKeys
      }
    })

    if (res.results && res.results.length > 0) {
      let filledCounter = 0
      keysList.value.forEach((k) => {
        if (k.value.trim()) {
          const r = res.results[filledCounter]
          if (r) {
            k.status = r.valid ? 'valid' : 'invalid'
            k.error = r.error || ''
          }
          filledCounter++
        }
      })
    }

    if (res.status === 'ok') {
      testResult.value = {
        status: 'valid',
        message: res.message || 'All tested API keys are operational!'
      }
      state.showToast('API Key verified successfully!', 'success')
      checkSystemHealth()
    } else {
      testResult.value = {
        status: 'invalid',
        message: res.message || 'Some or all API keys failed verification.'
      }
      state.showToast(res.message || 'Validation failed for some keys.', 'error')
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
      method: 'POST',
      body: {
        settings: {
          GEMINI_API_KEY: JSON.stringify(payload)
        }
      }
    })
    
    originalSerializedKeys.value = JSON.stringify(keysList.value.map(k => ({ title: k.title.trim(), value: k.value.trim() })))
    state.showToast('API Keys saved successfully!', 'success')
    checkSystemHealth()
  } catch (e) {
    state.showToast('Failed to save API keys', 'error')
  }
}

async function saveEnvPaths() {
  try {
    await $fetch(`${API_BASE}/api/system-settings`, {
      method: 'POST',
      body: {
        settings: {
          FFMPEG_PATH: ffmpegPath.value,
          NODE_PATH: nodePath.value
        }
      }
    })
    state.showToast('Environment paths saved successfully!', 'success')
    checkSystemHealth()
  } catch (e) {
    state.showToast('Failed to save environment paths', 'error')
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

onMounted(() => {
  fetchSettings()
  checkSystemHealth()
  fetchCookiesStatus()
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
