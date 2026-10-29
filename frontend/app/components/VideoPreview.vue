<template>
  <div
    v-if="state"
    ref="container"
    class="relative shrink-0 flex items-center justify-center transition-all duration-500 self-center mx-auto"
    :style="containerStyle"
  >
    <!-- 1080x1920 Canvas scaled to fit container -->
    <div
      class="absolute top-1/2 left-1/2 w-[1080px] h-[1920px] overflow-hidden rounded-[36px] bg-black"
      :style="contentStyle"
    >
      <!-- Rendered video output (Rendered Clip Preview Canvas) -->
      <div
        v-if="state?.outputUrl?.value"
        data-testid="rendered-clip-preview"
        class="absolute inset-0 z-30 bg-black flex flex-col items-center justify-center select-none overflow-hidden"
        @mousemove="onPlayerMouseMove"
        @mouseleave="onPlayerMouseLeave"
      >
        <!-- The Rendered Video Element -->
        <video
          ref="renderedVideo"
          data-testid="rendered-video-element"
          :src="state?.outputUrl?.value"
          class="w-full h-full object-contain cursor-pointer"
          playsinline
          preload="auto"
          @timeupdate="onRenderedTimeUpdate"
          @loadedmetadata="onRenderedLoadedMetadata"
          @ended="onRenderedEnded"
          @click="toggleRenderedPlayback"
        ></video>

        <!-- Center Play/Pause Flash Indicator -->
        <Transition
          enter-active-class="transition duration-150 ease-out"
          enter-from-class="opacity-0 scale-75"
          enter-to-class="opacity-100 scale-100"
          leave-active-class="transition duration-300 ease-in"
          leave-from-class="opacity-100 scale-100"
          leave-to-class="opacity-0 scale-125"
        >
          <div
            v-if="showCenterPlayFlash"
            class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-40 w-36 h-36 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-white"
          >
            <Icon
              :name="isRenderedPlaying ? 'ri:play-fill' : 'ri:pause-fill'"
              class="text-6xl text-white ml-1"
            />
          </div>
        </Transition>

        <!-- Top Floating Header Action Bar -->
        <div
          class="absolute top-10 left-10 right-10 z-40 flex items-center justify-between pointer-events-auto transition-opacity duration-300 ease-out"
          :class="
            isControlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
          "
        >
          <!-- Back to Editor button -->
          <button
            data-testid="back-to-editor-btn"
            class="bg-surface-dark/90 hover:bg-surface-panel/90 border border-surface-border text-white text-[28px] font-bold px-7 py-3.5 rounded-2xl flex items-center gap-3 transition-all backdrop-blur-md shadow-xl hover:scale-[1.02] active:scale-[0.98]"
            @click="exitRenderPreview"
          >
            <Icon
              name="ri:arrow-left-line"
              class="text-[32px] text-accent-500"
            />
            <span>Back to Editor</span>
          </button>

          <!-- Right Action Pill: Open Folder & Download -->
          <div class="flex items-center gap-4">
            <button
              data-testid="open-folder-canvas-btn"
              class="bg-surface-dark/90 hover:bg-surface-panel/90 border border-surface-border text-slate-200 hover:text-white text-[28px] font-bold px-7 py-3.5 rounded-2xl flex items-center gap-3 transition-all backdrop-blur-md shadow-xl hover:scale-[1.02] active:scale-[0.98]"
              @click="openRenderFolder"
            >
              <Icon
                name="ri:folder-open-line"
                class="text-[32px] text-accent-400"
              />
              <span>Open Folder</span>
            </button>
            <a
              data-testid="download-canvas-btn"
              :href="state?.outputUrl?.value"
              download
              class="bg-accent-500 hover:bg-accent-400 text-black text-[28px] font-extrabold px-8 py-3.5 rounded-2xl flex items-center gap-3 transition-all shadow-xl hover:scale-[1.02] active:scale-[0.98]"
            >
              <Icon name="ri:download-2-fill" class="text-[32px]" />
              <span>Download</span>
            </a>
          </div>
        </div>

        <!-- Studio Playback Control Deck (Bottom Floating Deck) -->
        <div
          data-testid="studio-control-deck"
          class="absolute bottom-10 left-8 right-8 z-40 bg-[#060608]/90 backdrop-blur-2xl border border-white/10 rounded-[32px] px-8 py-5 flex items-center gap-6 shadow-2xl transition-opacity duration-300 ease-out pointer-events-auto"
          :class="
            isControlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
          "
        >
          <!-- Play / Pause Button -->
          <button
            data-testid="player-play-btn"
            class="text-white hover:text-accent-500 transition-colors shrink-0 flex items-center justify-center p-2 rounded-xl active:scale-95"
            @click.stop="toggleRenderedPlayback"
          >
            <Icon
              :name="isRenderedPlaying ? 'ri:pause-fill' : 'ri:play-fill'"
              class="text-[44px]"
            />
          </button>

          <!-- Scrubber Container -->
          <div
            ref="scrubberTrackRef"
            data-testid="player-scrubber"
            class="flex-1 relative flex items-center h-12 cursor-pointer group/scrub"
            @mousedown="startRenderedScrub"
            @touchstart.passive="startRenderedScrubTouch"
          >
            <!-- Background Track -->
            <div
              class="w-full h-3 bg-white/20 rounded-full overflow-hidden group-hover/scrub:h-4 transition-all"
            >
              <!-- Filled Progress Track (Matte Gold, NO glow) -->
              <div
                class="h-full bg-accent-500 rounded-full"
                :style="{ width: `${renderedProgressPercent}%` }"
              ></div>
            </div>

            <!-- Scrubber Thumb (White circle) -->
            <div
              class="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-white border-2 border-black/40 shadow-md group-hover/scrub:scale-125 transition-transform pointer-events-none"
              :style="{ left: `${renderedProgressPercent}%` }"
            ></div>
          </div>

          <!-- Time Display (Sans-serif, Tabular Nums, NO Monospace) -->
          <div
            data-testid="player-time-display"
            class="text-slate-300 font-sans font-medium tabular-nums text-[26px] tracking-normal shrink-0 select-none whitespace-nowrap"
          >
            {{ formatTimeDisplay(renderedCurrentTime) }} /
            {{ formatTimeDisplay(renderedDuration) }}
          </div>

          <!-- Volume Control with Vertical Slider Popover -->
          <div
            data-testid="player-volume-control"
            class="relative shrink-0 flex items-center justify-center group/volume"
            @mouseenter="onVolumeMouseEnter"
            @mouseleave="onVolumeMouseLeave"
          >
            <!-- Vertical Volume Slider Popover -->
            <div
              data-testid="player-volume-popover"
              class="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 bg-[#060608]/95 backdrop-blur-2xl border border-white/10 rounded-[24px] py-4 px-3 flex flex-col items-center gap-3 shadow-2xl select-none z-50 w-16 transition-all duration-200"
              :class="
                isVolumePopoverOpen
                  ? 'opacity-100 translate-y-0 pointer-events-auto'
                  : 'opacity-0 translate-y-2 pointer-events-none group-hover/volume:opacity-100 group-hover/volume:translate-y-0 group-hover/volume:pointer-events-auto'
              "
            >
              <!-- Percentage text (clean sans-serif, tabular-nums, no monospace) -->
              <span
                data-testid="player-volume-percent"
                class="text-[20px] font-sans font-medium tabular-nums text-slate-300"
              >
                {{ Math.round((isRenderedMuted ? 0 : renderedVolume) * 100) }}%
              </span>

              <!-- Vertical Track Container -->
              <div
                ref="volumeTrackRef"
                data-testid="player-vertical-volume-bar"
                class="w-8 h-36 relative flex items-center justify-center cursor-pointer group/vtrack py-1"
                @mousedown="startVolumeScrub"
                @touchstart.passive="startVolumeScrubTouch"
              >
                <!-- Background Track -->
                <div
                  class="w-2.5 h-full bg-white/20 rounded-full relative overflow-hidden group-hover/vtrack:w-3.5 transition-all flex flex-col justify-end"
                >
                  <!-- Filled Level Track (Matte Gold) -->
                  <div
                    class="w-full bg-accent-500 rounded-full transition-all"
                    :style="{
                      height: `${isRenderedMuted ? 0 : renderedVolume * 100}%`
                    }"
                  ></div>
                </div>

                <!-- Volume Thumb Handle -->
                <div
                  class="absolute left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-white border-2 border-black/40 shadow-md group-hover/vtrack:scale-125 transition-transform pointer-events-none"
                  :style="{
                    bottom: `calc(${isRenderedMuted ? 0 : renderedVolume * 100}% - 12px)`
                  }"
                ></div>
              </div>
            </div>

            <!-- Mute / Unmute Button -->
            <button
              data-testid="player-mute-btn"
              class="text-slate-300 hover:text-white transition-colors p-2 rounded-xl active:scale-95 flex items-center justify-center"
              @click.stop="toggleRenderedMute"
            >
              <Icon :name="renderedVolumeIcon" class="text-[36px]" />
            </button>
          </div>

          <!-- Fullscreen Button -->
          <button
            data-testid="player-fullscreen-btn"
            class="text-slate-300 hover:text-white transition-colors shrink-0 p-2 rounded-xl active:scale-95"
            @click.stop="toggleRenderedFullscreen"
          >
            <Icon
              :name="
                isRenderedFullscreen
                  ? 'ri:fullscreen-exit-line'
                  : 'ri:fullscreen-line'
              "
              class="text-[36px]"
            />
          </button>
        </div>
      </div>

      <!-- Draggable crop preview -->
      <div
        v-if="state?.videoUrl?.value && !state?.outputUrl?.value"
        class="absolute inset-0 z-30 bg-black select-none"
        :class="
          canDragCanvas
            ? 'cursor-grab active:cursor-grabbing'
            : 'cursor-default'
        "
        @mousedown="startDrag"
        @mousemove="onDrag"
        @mouseup="stopDrag"
        @mouseleave="stopDrag"
        @touchstart.prevent="startDragTouch"
        @touchmove.prevent="onDragTouch"
        @touchend="stopDrag"
      >
        <video
          id="preview-video-element"
          ref="previewVideo"
          :src="state?.videoUrl?.value"
          :muted="false"
          class="absolute inset-0 pointer-events-none transition-opacity duration-300"
          :class="state?.useNativePlayer?.value ? 'opacity-100' : 'opacity-0'"
          :style="videoTransformStyle"
          playsinline
          crossorigin="anonymous"
          preload="auto"
          @loadedmetadata="onVideoLoaded"
          @loadeddata="onVideoReady"
          @canplay="onVideoReady"
          @canplaythrough="onVideoReady"
          @timeupdate="onNativeTimeUpdate"
          @ended="onNativeVideoEnded"
          @error="e => onNativeVideoError(e)"
        ></video>

        <!-- Remotion In-Memory Player -->
        <ClientOnly>
          <RemotionPlayer
            v-if="!state?.useNativePlayer?.value"
            :bridge="directBridge"
            class="absolute inset-0 w-full h-full pointer-events-none z-20 transition-opacity duration-300"
            :class="!state.useNativePlayer.value ? 'opacity-100' : 'opacity-0'"
          />
          <template #fallback>
            <div
              v-if="!state?.useNativePlayer?.value"
              class="absolute inset-0 w-full h-full bg-black/40 flex items-center justify-center pointer-events-none z-20"
            >
              <div
                class="flex items-center gap-3 text-slate-400 text-[20px] font-mono"
              >
                <Icon
                  name="ri:loader-4-line"
                  class="animate-spin text-[28px] text-accent-500"
                />
                <span>Loading video player...</span>
              </div>
            </div>
          </template>
        </ClientOnly>

        <!-- Crop guide lines (Vertical only) -->
        <div
          v-if="state?.videoLayout?.value !== 'landscape'"
          class="absolute inset-0 pointer-events-none z-10"
        >
          <div
            class="absolute inset-y-0 w-[3px] bg-white/20"
            style="left: 33.33%"
          ></div>
          <div
            class="absolute inset-y-0 w-[3px] bg-white/20"
            style="left: 66.66%"
          ></div>
          <div
            class="absolute inset-x-0 h-[3px] bg-white/20"
            style="top: 33.33%"
          ></div>
          <div
            class="absolute inset-x-0 h-[3px] bg-white/20"
            style="top: 66.66%"
          ></div>
        </div>

        <!-- Drag indicator (Vertical only) -->
        <div
          v-if="state?.videoLayout?.value !== 'landscape'"
          class="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 pointer-events-none flex flex-col items-center gap-2"
        >
          <!-- Override toast -->
          <Transition
            enter-active-class="transition duration-300 ease-out"
            enter-from-class="transform -translate-y-2 opacity-0"
            enter-to-class="transform translate-y-0 opacity-100"
            leave-active-class="transition duration-200 ease-in"
            leave-from-class="transform translate-y-0 opacity-100"
            leave-to-class="transform -translate-y-2 opacity-0"
          >
            <div
              v-if="showOverrideToast"
              class="bg-amber-400 text-black px-6 py-2 rounded-full text-[24px] font-bold shadow-2xl flex items-center gap-2 backdrop-blur-md mb-3"
            >
              <Icon name="ri:cursor-line" class="text-[36px]" />
              Switched to Manual Pan
            </div>
          </Transition>

          <div
            class="bg-black/70 backdrop-blur-3xl px-8 py-4 rounded-full border-[3px] border-white/20 text-[28px] mono text-white flex items-center gap-3 shadow-xl"
          >
            <Icon
              :name="
                state.cropMode.value === 'face_tracking'
                  ? 'ri:scan-line'
                  : 'ri:drag-move-2-line'
              "
              class="text-accent-500 text-[36px]"
            />
            <span
              v-if="state.cropMode.value === 'face_tracking'"
              class="text-white/90 ml-2"
            >
              FACE TRACKING
            </span>
            <span v-else>
              MANUAL PAN • {{ Math.round(state.cropPercentX.value) }}%
            </span>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div
        v-if="
          !state.videoUrl.value &&
          !state.outputUrl.value &&
          !isProcessing &&
          !state.isMediaLoading.value
        "
        class="text-center flex flex-col items-center justify-center text-slate-500 p-12 absolute inset-0 z-0 bg-surface-dark/80 text-[42px]"
      >
        <div
          class="w-[192px] h-[192px] rounded-full bg-surface-panel border-[3px] border-surface-border flex items-center justify-center mb-12"
        >
          <Icon name="ri:play-line" class="text-[96px] text-slate-400" />
        </div>
        <h3 class="font-medium text-slate-300">NO MEDIA LOADED</h3>
        <p
          class="text-[32px] mt-4 max-w-[600px] text-slate-500 leading-relaxed"
        >
          Paste a YouTube URL and click extract to begin processing.
        </p>
      </div>

      <!-- Subtitle Overlay / position indicator (Hidden if Remotion handles it) -->
      <div
        class="absolute left-1/2 -translate-x-1/2 z-40 pointer-events-none w-full px-[5%] flex justify-center transition-opacity duration-300"
        :class="
          state.useNativePlayer.value ? 'opacity-100' : 'opacity-0 hidden'
        "
        :style="subtitleIndicatorStyle"
      >
        <div
          v-if="activeSubtitleWords && activeSubtitleWords.length > 0"
          class="font-bold text-center leading-tight tracking-wide flex flex-wrap justify-center items-center gap-x-4 gap-y-2"
          :style="{
            fontFamily: state.font.value,
            fontSize: `${state.fontSize.value}px`,
            color: 'white',
            fontWeight: state.subtitleFontWeight.value
              ? String(state.subtitleFontWeight.value)
              : '900',
            wordSpacing: `${state.subtitleWordSpacing.value}px`,
            ...subtitleBackgroundStyle
          }"
        >
          <template v-for="(w, idx) in activeSubtitleWords" :key="idx">
            <span :style="getWordStyle(w)" class="relative inline-block">
              {{ formatWordText(w.text) }}
              <span
                v-if="
                  state.subtitleHighlightMode.value === 'underline' &&
                  w.isActive
                "
                class="absolute -bottom-1 left-0.5 right-0.5 h-1.5 rounded-full pointer-events-none"
                :style="{
                  backgroundColor: state.subtitleHighlightColor.value,
                  boxShadow: `0 0 10px ${state.subtitleHighlightColor.value}80`
                }"
              ></span>
            </span>
            <span
              v-if="idx < activeSubtitleWords.length - 1"
              style="display: inline-block; white-space: pre"
              class="select-none"
            >
            </span>
          </template>
        </div>
        <div
          v-else
          class="bg-accent-500/20 border-[3px] border-accent-500/40 rounded-xl px-12 py-4 text-[30px] text-accent-500 mono text-center whitespace-nowrap backdrop-blur-md transition-opacity duration-500"
          :class="state.isPlaying.value ? 'opacity-0' : 'opacity-100'"
        >
          SUBTITLE — {{ state.font.value }} {{ state.fontSize.value }}px
        </div>
      </div>

      <!-- Text Layers (Konva) -->
      <ClientOnly>
        <div
          v-if="state.videoUrl.value && !state.thumbnailEditMode.value"
          class="absolute inset-0 z-[45]"
          :class="
            activeTextItems.length > 0
              ? 'pointer-events-auto'
              : 'pointer-events-none'
          "
        >
          <v-stage
            :config="{ width: 1080, height: 1920 }"
            @click="handleStageClick"
            @tap="handleStageClick"
          >
            <v-layer>
              <v-label
                v-for="item in activeTextItems"
                :key="`${fontsLoaded}-${item.id}-${item.content}-${item.fontSize}-${item.font}-${item.fontWeight}-${item.showStroke}-${item.showBackground}-${item.textTransform}-${item.color}`"
                :config="{
                  x: item.x ?? 540,
                  y: item.y ?? 960,
                  name: item.id,
                  draggable: true,
                  offset: { x: 0, y: 0 },
                  visible: editingItemId !== item.id
                }"
                @dragend="onTextDragEnd($event, item)"
                @dragmove="onTextDragMove($event, item)"
                @transform="handleTransform($event, item)"
                @click="selectItem(item)"
                @tap="selectItem(item)"
                @dblclick="startEditing(item)"
                @dbltap="startEditing(item)"
                @mouseenter="handleMouseEnterLabel"
                @mouseleave="handleMouseLeaveLabel"
                @draw="onLabelRender"
              >
                <v-tag
                  :config="{
                    fill: item.backgroundColor || '#000000',
                    opacity: item.showBackground
                      ? (item.backgroundOpacity ?? 0.7)
                      : 0,
                    cornerRadius: 10,
                    padding: 0,
                    listening: false
                  }"
                />
                <v-text
                  :config="{
                    text: transformText(
                      item.content || 'NEW TEXT',
                      item.textTransform
                    ),
                    fontSize: item.fontSize || 80,
                    fill: item.color || '#FFFFFF',
                    fontFamily: item.font || 'Outfit',
                    fontStyle: item.fontWeight
                      ? String(item.fontWeight)
                      : '900',
                    align: item.align || 'center',
                    verticalAlign: 'middle',
                    lineHeight: item.lineHeight ?? 1.1,
                    stroke: item.strokeColor || '#000000',
                    strokeWidth: item.showStroke ? (item.strokeWidth ?? 5) : 0,
                    strokeEnabled: item.showStroke,
                    shadowColor: item.shadowColor || '#000000',
                    shadowBlur: item.shadowBlur ?? 10,
                    shadowOffset: {
                      x: item.shadowOffsetX ?? 5,
                      y: item.shadowOffsetY ?? 5
                    },
                    shadowOpacity: item.shadowOpacity ?? 0.5,
                    shadowEnabled: true,
                    letterSpacing: item.letterSpacing ?? 0,
                    opacity: item.opacity ?? 1,
                    padding: 15,
                    perfectDrawEnabled: false
                  }"
                />
              </v-label>
              <v-transformer
                v-if="isTimelineTextActiveAndSelected"
                ref="transformerRef"
                :config="{
                  enabledAnchors: [
                    'top-left',
                    'top-right',
                    'bottom-left',
                    'bottom-right'
                  ],
                  rotateEnabled: false,
                  keepRatio: true,
                  borderStroke: '#ef4444',
                  anchorStroke: '#ef4444',
                  anchorFill: '#ffffff',
                  anchorSize: 12,
                  borderDash: [3, 3]
                }"
              />
            </v-layer>
          </v-stage>

          <!-- HTML Text Editor Overlay for 1:1 editing -->
          <template v-for="item in activeTextItems" :key="'edit-' + item.id">
            <div
              v-if="editingItemId === item.id"
              :ref="setEditingInputRef"
              contenteditable="true"
              class="absolute z-[48] outline-none border-none resize-none overflow-hidden select-text whitespace-pre text-center"
              :style="getEditingStyle(item)"
              @blur="stopEditing(item, true)"
              @keydown="handleEditingKeydown($event, item)"
              @input="onEditingInput($event, item)"
            ></div>
          </template>
        </div>
      </ClientOnly>

      <!-- Thumbnail Preview Mode (active in edit mode OR during thumbnail time window) -->
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-show="
            (state.thumbnailEditMode.value || isInThumbnailWindow) &&
            state.thumbnailUrl.value
          "
          class="absolute inset-0 z-[50] bg-black select-none"
          :class="
            isInThumbnailWindow
              ? isThumbBgDragging
                ? 'cursor-grabbing'
                : 'cursor-grab'
              : 'cursor-default'
          "
        >
          <!-- Thumbnail Background Image -->
          <img
            :src="state.thumbnailUrl.value ?? undefined"
            class="absolute inset-0 w-full h-full object-cover select-none"
            :style="{
              objectPosition: `${state.thumbnailXOffset.value}% center`
            }"
          />

          <!-- Thumbnail Text Overlays (Konva for dragging) -->
          <ClientOnly>
            <div class="absolute inset-0 z-[55]">
              <v-stage :config="{ width: 1080, height: 1920 }">
                <v-layer>
                  <!-- Background click/drag area for panning the background image -->
                  <v-rect
                    :config="{
                      width: 1080,
                      height: 1920,
                      fill: 'transparent',
                      name: 'thumb-bg-rect'
                    }"
                    @mousedown="startThumbBgDrag"
                    @touchstart="startThumbBgDragTouch"
                  />
                  <v-label
                    v-for="overlay in state.thumbnailTextOverlays.value"
                    :key="`${fontsLoaded}-${overlay.id}-${overlay.text}-${overlay.fontSize}-${overlay.fontFamily}-${overlay.fontWeight}-${overlay.showStroke}-${overlay.showBackground}-${overlay.backgroundPadding}-${overlay.textTransform}-${overlay.color}`"
                    :config="{
                      x: overlay.x ?? 540,
                      y: overlay.y ?? 960,
                      rotation: overlay.rotation ?? 0,
                      draggable: true,
                      offset: { x: 0, y: 0 },
                      visible: editingThumbOverlayId !== overlay.id
                    }"
                    @mousedown="selectThumbnailOverlay(overlay)"
                    @touchstart="selectThumbnailOverlay(overlay)"
                    @pointerdown="selectThumbnailOverlay(overlay)"
                    @click="selectThumbnailOverlay(overlay)"
                    @tap="selectThumbnailOverlay(overlay)"
                    @dragstart="selectThumbnailOverlay(overlay)"
                    @dragmove="onThumbnailLabelDragMove($event, overlay)"
                    @dragend="onThumbnailLabelDragEnd($event, overlay)"
                    @dblclick="startEditingThumbOverlay(overlay)"
                    @dbltap="startEditingThumbOverlay(overlay)"
                    @mouseenter="handleMouseEnterLabel"
                    @mouseleave="handleMouseLeaveLabel"
                  >
                    <v-tag
                      :config="{
                        fill: overlay.backgroundColor || '#000000',
                        opacity: overlay.showBackground
                          ? (overlay.backgroundOpacity ?? 0.7)
                          : 0,
                        cornerRadius: 10,
                        padding: 0,
                        listening: false
                      }"
                    />
                    <v-text
                      :config="{
                        text: transformText(
                          overlay.text || '',
                          overlay.textTransform
                        ),
                        fontSize: overlay.fontSize ?? 100,
                        fill: overlay.color || '#FFFFFF',
                        fontFamily: overlay.fontFamily || 'Montserrat',
                        fontStyle: overlay.fontWeight
                          ? String(overlay.fontWeight)
                          : '900',
                        align: 'center',
                        verticalAlign: 'middle',
                        lineHeight: 1.1,
                        stroke: overlay.strokeColor || '#000000',
                        strokeWidth:
                          overlay.showStroke !== false
                            ? (overlay.strokeWidth ?? 5)
                            : 0,
                        strokeEnabled: overlay.showStroke !== false,
                        shadowColor: 'black',
                        shadowBlur: 15,
                        shadowOffset: { x: 3, y: 5 },
                        shadowOpacity: 0.6,
                        offsetX: 0,
                        offsetY: 0,
                        padding: overlay.backgroundPadding ?? 20,
                        perfectDrawEnabled: false
                      }"
                    />
                  </v-label>
                </v-layer>
              </v-stage>
            </div>
          </ClientOnly>

          <!-- HTML Text Editor Overlay for 1:1 Thumbnail editing -->
          <template
            v-for="overlay in state.thumbnailTextOverlays.value"
            :key="'edit-thumb-' + overlay.id"
          >
            <div
              v-if="editingThumbOverlayId === overlay.id"
              :ref="setEditingThumbInputRef"
              contenteditable="true"
              class="absolute z-[56] outline-none border-none resize-none overflow-hidden select-text whitespace-pre text-center"
              :style="getThumbOverlayEditingStyle(overlay)"
              @blur="stopEditingThumbOverlay(overlay, true)"
              @keydown="handleEditingThumbKeydown($event, overlay)"
              @input="onEditingThumbInput($event, overlay)"
            ></div>
          </template>
        </div>
      </Transition>

      <!-- Editing indicator (moved outside of the z-[50] container to escape its CSS stacking context) -->
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-show="
            (state.thumbnailEditMode.value || isInThumbnailWindow) &&
            state.thumbnailUrl.value
          "
          class="absolute left-1/2 -translate-x-1/2 z-[80] pointer-events-none"
        >
          <div
            class="bg-emerald-500/90 backdrop-blur-md text-black px-8 py-2 rounded-full text-[28px] font-black uppercase tracking-widest flex items-center gap-3 shadow-2xl transition-transform"
            :class="{
              'translate-y-6': activeSafeZone === 'none',
              'translate-y-4': activeSafeZone !== 'none'
            }"
          >
            <Icon name="ri:image-edit-fill" class="text-[32px]" />
            {{
              state.thumbnailEditMode.value
                ? 'THUMBNAIL EDIT MODE'
                : 'THUMBNAIL'
            }}
          </div>
        </div>
      </Transition>

      <!-- Premium Glassmorphic Capturing Overlay -->
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition duration-500 ease-in-out"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-show="state.isCapturingThumbnail.value"
          class="absolute inset-0 z-[90] flex items-center justify-center bg-black/90 backdrop-blur-3xl"
        >
          <div
            class="flex flex-col items-center justify-center bg-black/60 border border-white/10 p-12 rounded-[48px] max-w-[650px] shadow-[0_24px_50px_-12px_rgba(0,0,0,0.8)]"
          >
            <!-- Spinner Container -->
            <div
              class="relative w-32 h-32 flex items-center justify-center mb-8"
            >
              <!-- Background Ring -->
              <div
                class="absolute inset-0 rounded-full border-[8px] border-emerald-500/20"
              ></div>
              <!-- Spinning Ring -->
              <div
                class="absolute inset-0 rounded-full border-[8px] border-transparent border-t-emerald-500 animate-spin"
              ></div>
              <!-- Inner Pulsing Glow -->
              <div
                class="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 animate-pulse flex items-center justify-center"
              >
                <Icon
                  name="ri:camera-lens-line"
                  class="text-[36px] text-emerald-400"
                />
              </div>
            </div>
            <!-- Typography -->
            <h3
              class="text-[32px] font-black text-white tracking-widest text-center animate-pulse mb-3"
            >
              CAPTURING FRAME...
            </h3>
            <p
              class="text-[24px] font-medium text-slate-400 text-center px-4 leading-relaxed"
            >
              Generating high-quality cover slide preview from frame
            </p>
          </div>
        </div>
      </Transition>

      <!-- Title safe area -->
      <div
        class="absolute border-[6px] border-red-500/20 pointer-events-none rounded-[24px] z-10 mix-blend-screen border-dashed"
        style="top: 10%; bottom: 15%; left: 10%; right: 10%"
      ></div>

      <!-- TikTok Safe Zone Simulation Overlay -->
      <TikTokSafeZoneOverlay
        v-if="activeSafeZone === 'tiktok'"
        :opacity="safeZoneOpacity"
      />

      <!-- Instagram Reels Safe Zone Simulation Overlay -->
      <ReelsSafeZoneOverlay
        v-else-if="activeSafeZone === 'reels'"
        :opacity="safeZoneOpacity"
      />

      <!-- YouTube Shorts Safe Zone Simulation Overlay -->
      <YouTubeShortsSafeZoneOverlay
        v-else-if="activeSafeZone === 'shorts'"
        :opacity="safeZoneOpacity"
      />

      <!-- Canvas Snapping Guides (Dynamic Alignment & Boundaries) -->
      <svg
        v-if="snapping.isSnappingEnabled.value"
        data-testid="canvas-snapping-guides"
        class="absolute inset-0 w-full h-full pointer-events-none z-[70]"
        viewBox="0 0 1080 1920"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <!-- Vertical Guide Line -->
        <Transition
          enter-active-class="transition-opacity duration-150 ease-out"
          enter-from-class="opacity-0"
          enter-to-class="opacity-100"
          leave-active-class="transition-opacity duration-150 ease-in"
          leave-from-class="opacity-100"
          leave-to-class="opacity-0"
        >
          <line
            v-if="snapping.activeGuides.value.vertical"
            data-guide="vertical"
            :x1="snapping.activeGuides.value.vertical.position"
            y1="0"
            :x2="snapping.activeGuides.value.vertical.position"
            y2="1920"
            :stroke="
              snapping.activeGuides.value.vertical.type === 'center'
                ? '#06b6d4'
                : '#ffd700'
            "
            stroke-width="3"
            :class="
              snapping.activeGuides.value.vertical.type === 'center'
                ? 'drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]'
                : 'drop-shadow-[0_0_8px_rgba(255,215,0,0.8)]'
            "
          />
        </Transition>

        <!-- Horizontal Guide Line -->
        <Transition
          enter-active-class="transition-opacity duration-150 ease-out"
          enter-from-class="opacity-0"
          enter-to-class="opacity-100"
          leave-active-class="transition-opacity duration-150 ease-in"
          leave-from-class="opacity-100"
          leave-to-class="opacity-0"
        >
          <line
            v-if="snapping.activeGuides.value.horizontal"
            data-guide="horizontal"
            x1="0"
            :y1="snapping.activeGuides.value.horizontal.position"
            x2="1080"
            :y2="snapping.activeGuides.value.horizontal.position"
            :stroke="
              snapping.activeGuides.value.horizontal.type === 'center'
                ? '#06b6d4'
                : '#ffd700'
            "
            stroke-width="3"
            :class="
              snapping.activeGuides.value.horizontal.type === 'center'
                ? 'drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]'
                : 'drop-shadow-[0_0_8px_rgba(255,215,0,0.8)]'
            "
          />
        </Transition>
      </svg>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { useClipperState } from '../composables/useClipperState';
import { useCropDrag } from '../composables/useCropDrag';
import { useRemotionBridge } from '../composables/useRemotionBridge';
import { useInteractiveText } from '../composables/useInteractiveText';
import { DirectPlayerBridge } from '../utils/playerBridge';
import { transformText } from '../utils/styleHelpers';
import { getCropEntryAtMediaTime } from '../utils/timelineHelpers';
import RemotionPlayer from './RemotionPlayer.client.vue';
import TikTokSafeZoneOverlay from './preview/TikTokSafeZoneOverlay.vue';
import ReelsSafeZoneOverlay from './preview/ReelsSafeZoneOverlay.vue';
import YouTubeShortsSafeZoneOverlay from './preview/YouTubeShortsSafeZoneOverlay.vue';

const state = useClipperState();
const { activeSafeZone, safeZoneOpacity, safeZoneColor } = state;

const previewVideo = ref<HTMLVideoElement | null>(null);
const renderedVideo = ref<HTMLVideoElement | null>(null);
const transformerRef = ref<any>(null);
const stableVideoBuster = ref<string>(Date.now().toString());

// --- RENDERED VIDEO CUSTOM STUDIO PLAYBACK DECK ---
const isRenderedPlaying = ref(false);
const renderedCurrentTime = ref(0);
const renderedDuration = ref(0);
const renderedVolume = ref(1);
const lastUnmutedVolume = ref(1);
const isRenderedMuted = ref(false);
const isRenderedFullscreen = ref(false);
const isControlsVisible = ref(true);
const isVolumePopoverOpen = ref(false);
const showCenterPlayFlash = ref(false);
const isScrubbingRendered = ref(false);
const scrubberTrackRef = ref<HTMLElement | null>(null);
const isScrubbingVolume = ref(false);
const volumeTrackRef = ref<HTMLElement | null>(null);

let controlsHideTimer: ReturnType<typeof setTimeout> | null = null;
let centerFlashTimer: ReturnType<typeof setTimeout> | null = null;
let volumePopoverTimer: ReturnType<typeof setTimeout> | null = null;

function onVolumeMouseEnter() {
  isVolumePopoverOpen.value = true;
  if (volumePopoverTimer) {
    clearTimeout(volumePopoverTimer);
    volumePopoverTimer = null;
  }
}

function onVolumeMouseLeave() {
  volumePopoverTimer = setTimeout(() => {
    if (!isScrubbingVolume.value) {
      isVolumePopoverOpen.value = false;
    }
  }, 350);
}

const renderedVolumeIcon = computed(() => {
  if (isRenderedMuted.value || renderedVolume.value === 0) {
    return 'ri:volume-mute-fill';
  }
  if (renderedVolume.value < 0.5) {
    return 'ri:volume-down-fill';
  }
  return 'ri:volume-up-fill';
});

function resetControlsHideTimer() {
  isControlsVisible.value = true;
  if (controlsHideTimer) {
    clearTimeout(controlsHideTimer);
    controlsHideTimer = null;
  }
  if (isRenderedPlaying.value) {
    controlsHideTimer = setTimeout(() => {
      isControlsVisible.value = false;
    }, 2500);
  }
}

function onPlayerMouseMove() {
  resetControlsHideTimer();
}

function onPlayerMouseLeave() {
  if (isRenderedPlaying.value) {
    isControlsVisible.value = false;
  }
}

function triggerCenterFlash() {
  showCenterPlayFlash.value = true;
  if (centerFlashTimer) clearTimeout(centerFlashTimer);
  centerFlashTimer = setTimeout(() => {
    showCenterPlayFlash.value = false;
  }, 350);
}

function toggleRenderedPlayback() {
  if (!renderedVideo.value) return;
  if (renderedVideo.value.paused) {
    renderedVideo.value
      .play()
      .then(() => {
        isRenderedPlaying.value = true;
        triggerCenterFlash();
        resetControlsHideTimer();
      })
      .catch(() => {});
  } else {
    renderedVideo.value.pause();
    isRenderedPlaying.value = false;
    triggerCenterFlash();
    isControlsVisible.value = true;
    if (controlsHideTimer) {
      clearTimeout(controlsHideTimer);
      controlsHideTimer = null;
    }
  }
}

function onRenderedTimeUpdate() {
  if (!renderedVideo.value || isScrubbingRendered.value) return;
  renderedCurrentTime.value = renderedVideo.value.currentTime;
}

function onRenderedLoadedMetadata() {
  if (!renderedVideo.value) return;
  renderedDuration.value = renderedVideo.value.duration || 0;
  isRenderedMuted.value = renderedVideo.value.muted;
  renderedVolume.value = renderedVideo.value.volume;
}

function onRenderedEnded() {
  isRenderedPlaying.value = false;
  isControlsVisible.value = true;
  if (controlsHideTimer) {
    clearTimeout(controlsHideTimer);
    controlsHideTimer = null;
  }
}

function toggleRenderedMute() {
  if (!renderedVideo.value) return;
  if (isRenderedMuted.value) {
    renderedVideo.value.muted = false;
    isRenderedMuted.value = false;
    if (renderedVolume.value === 0) {
      renderedVolume.value = lastUnmutedVolume.value || 0.8;
      renderedVideo.value.volume = renderedVolume.value;
    }
  } else {
    lastUnmutedVolume.value = renderedVolume.value;
    renderedVideo.value.muted = true;
    isRenderedMuted.value = true;
  }
  resetControlsHideTimer();
}

function calculateVolumeFromY(clientY: number): number {
  if (!volumeTrackRef.value) return 1;
  const rect = volumeTrackRef.value.getBoundingClientRect();
  if (!rect.height) return 1;
  const pct = (rect.bottom - clientY) / rect.height;
  return Math.max(0, Math.min(1, pct));
}

function setVolumeFromEvent(clientY: number) {
  const newVol = calculateVolumeFromY(clientY);
  renderedVolume.value = newVol;
  if (renderedVideo.value) {
    renderedVideo.value.volume = newVol;
    if (newVol > 0 && isRenderedMuted.value) {
      renderedVideo.value.muted = false;
      isRenderedMuted.value = false;
    }
  }
}

function startVolumeScrub(e: MouseEvent) {
  isScrubbingVolume.value = true;
  isVolumePopoverOpen.value = true;
  setVolumeFromEvent(e.clientY);
  window.addEventListener('mousemove', onVolumeScrubMove);
  window.addEventListener('mouseup', stopVolumeScrub);
}

function onVolumeScrubMove(e: MouseEvent) {
  if (!isScrubbingVolume.value) return;
  setVolumeFromEvent(e.clientY);
}

function stopVolumeScrub() {
  isScrubbingVolume.value = false;
  window.removeEventListener('mousemove', onVolumeScrubMove);
  window.removeEventListener('mouseup', stopVolumeScrub);
  resetControlsHideTimer();
}

function startVolumeScrubTouch(e: TouchEvent) {
  if (!e.touches[0]) return;
  isScrubbingVolume.value = true;
  isVolumePopoverOpen.value = true;
  setVolumeFromEvent(e.touches[0].clientY);
  window.addEventListener('touchmove', onVolumeScrubTouchMove, {
    passive: false
  });
  window.addEventListener('touchend', stopVolumeScrubTouch);
}

function onVolumeScrubTouchMove(e: TouchEvent) {
  if (!isScrubbingVolume.value || !e.touches[0]) return;
  setVolumeFromEvent(e.touches[0].clientY);
}

function stopVolumeScrubTouch() {
  isScrubbingVolume.value = false;
  window.removeEventListener('touchmove', onVolumeScrubTouchMove);
  window.removeEventListener('touchend', stopVolumeScrubTouch);
  resetControlsHideTimer();
}

function toggleRenderedFullscreen() {
  if (!renderedVideo.value) return;
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
    isRenderedFullscreen.value = false;
  } else {
    renderedVideo.value.requestFullscreen?.().catch(() => {});
    isRenderedFullscreen.value = true;
  }
  resetControlsHideTimer();
}

const renderedProgressPercent = computed(() => {
  if (!renderedDuration.value || renderedDuration.value <= 0) return 0;
  return Math.min(
    100,
    Math.max(0, (renderedCurrentTime.value / renderedDuration.value) * 100)
  );
});

function formatTimeDisplay(seconds: number): string {
  if (!seconds || isNaN(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function calculateScrubTime(clientX: number): number {
  if (!scrubberTrackRef.value || !renderedDuration.value) return 0;
  const rect = scrubberTrackRef.value.getBoundingClientRect();
  const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  return pct * renderedDuration.value;
}

function startRenderedScrub(e: MouseEvent) {
  isScrubbingRendered.value = true;
  const newTime = calculateScrubTime(e.clientX);
  renderedCurrentTime.value = newTime;
  if (renderedVideo.value) {
    renderedVideo.value.currentTime = newTime;
  }
  window.addEventListener('mousemove', onRenderedScrubMove);
  window.addEventListener('mouseup', stopRenderedScrub);
}

function onRenderedScrubMove(e: MouseEvent) {
  if (!isScrubbingRendered.value) return;
  const newTime = calculateScrubTime(e.clientX);
  renderedCurrentTime.value = newTime;
  if (renderedVideo.value) {
    renderedVideo.value.currentTime = newTime;
  }
}

function stopRenderedScrub() {
  isScrubbingRendered.value = false;
  window.removeEventListener('mousemove', onRenderedScrubMove);
  window.removeEventListener('mouseup', stopRenderedScrub);
  resetControlsHideTimer();
}

function startRenderedScrubTouch(e: TouchEvent) {
  if (!e.touches[0]) return;
  isScrubbingRendered.value = true;
  const newTime = calculateScrubTime(e.touches[0].clientX);
  renderedCurrentTime.value = newTime;
  if (renderedVideo.value) {
    renderedVideo.value.currentTime = newTime;
  }
  window.addEventListener('touchmove', onRenderedScrubTouchMove, {
    passive: false
  });
  window.addEventListener('touchend', stopRenderedScrubTouch);
}

function onRenderedScrubTouchMove(e: TouchEvent) {
  if (!isScrubbingRendered.value || !e.touches[0]) return;
  const newTime = calculateScrubTime(e.touches[0].clientX);
  renderedCurrentTime.value = newTime;
  if (renderedVideo.value) {
    renderedVideo.value.currentTime = newTime;
  }
}

function stopRenderedScrubTouch() {
  isScrubbingRendered.value = false;
  window.removeEventListener('touchmove', onRenderedScrubTouchMove);
  window.removeEventListener('touchend', stopRenderedScrubTouch);
  resetControlsHideTimer();
}

function exitRenderPreview() {
  if (controlsHideTimer) {
    clearTimeout(controlsHideTimer);
    controlsHideTimer = null;
  }
  if (centerFlashTimer) {
    clearTimeout(centerFlashTimer);
    centerFlashTimer = null;
  }
  if (renderedVideo.value) {
    try {
      renderedVideo.value.pause();
    } catch {
      // ignore
    }
  }
  isRenderedPlaying.value = false;
  if (state?.outputUrl) {
    state.outputUrl.value = null;
  }
}

async function openRenderFolder() {
  if (state?.openRenderFolder) {
    await state.openRenderFolder(state.outputUrl?.value);
  }
}

function handleRenderedKeydown(e: KeyboardEvent) {
  if (!state?.outputUrl?.value) return;

  const target = e.target as HTMLElement | null;
  if (
    target &&
    (target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable)
  ) {
    return;
  }

  if (e.key === ' ' || e.code === 'Space') {
    e.preventDefault();
    toggleRenderedPlayback();
  } else if (e.key === 'Escape') {
    e.preventDefault();
    exitRenderPreview();
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleRenderedKeydown);
});

watch(
  () => state?.shouldPlayRendered?.value,
  async shouldPlay => {
    if (shouldPlay) {
      await nextTick();
      if (renderedVideo.value) {
        renderedVideo.value
          .play()
          .then(() => {
            isRenderedPlaying.value = true;
            resetControlsHideTimer();
          })
          .catch(() => {});
      }
      if (state?.shouldPlayRendered) {
        state.shouldPlayRendered.value = false;
      }
    }
  }
);

// --- LAYOUT & SIZING LOGIC ---
const videoAspect = ref(16 / 9);
const container = ref<HTMLElement | null>(null);
const containerHeight = ref(640);
const previewScale = computed(() => containerHeight.value / 1920);
const displayWidth = computed(() => 1080 * previewScale.value);

// 1080x1920 literal canvas parameters
const CONTAINER_W = 1080;
const CONTAINER_H = 1920;
const videoDisplayW = computed(() => CONTAINER_H * videoAspect.value);
const maxOffset = computed(() =>
  Math.max(0, videoDisplayW.value - CONTAINER_W)
);

const containerStyle = computed(() => ({
  height: '100%',
  maxHeight: '90vh',
  width: `${displayWidth.value}px`,
  outline: '1px solid rgba(255,255,255,0.1)',
  outlineOffset: '6px',
  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
  borderRadius: `${Math.round(36 * previewScale.value)}px`
}));

const contentStyle = computed(() => ({
  transform: `translate(-50%, -50%) scale(${previewScale.value})`
}));

const videoTransformStyle = computed(() => {
  const pct = state.cropPercentX.value / 100;
  const offset = -(pct * maxOffset.value);
  return {
    width: `${videoDisplayW.value}px`,
    transform: `translateX(${offset}px)`
  };
});

// Observe height changes
if (import.meta.client) {
  const updateSize = () => {
    if (container.value) {
      containerHeight.value = container.value.offsetHeight;
    }
  };
  const observer = new ResizeObserver(updateSize);
  onMounted(() => {
    if (container.value) observer.observe(container.value);
    updateSize();
  });
  onUnmounted(() => observer.disconnect());
  window.addEventListener('resize', updateSize);
}

// --- TIMING & THUMBNAIL TIMINGS ---
const thumbOffset = computed(() =>
  state.thumbnailEnabled.value ? state.thumbnailDuration.value : 0
);
const isInThumbnailWindow = computed(
  () =>
    state.thumbnailEnabled.value &&
    state.currentTime.value < thumbOffset.value &&
    !state.isCapturingThumbnail.value
);

const videoTime = computed(() => {
  const t = Math.max(0, state.currentTime.value - thumbOffset.value);
  const videoTrack = state.timelineTracks.value.find(
    (tr: any) => tr.id === 'video'
  );
  if (!videoTrack || !videoTrack.items || videoTrack.items.length === 0)
    return t;

  const activeItem =
    videoTrack.items.find(
      (i: any) => t >= i.start && t <= i.start + i.duration
    ) || videoTrack.items[videoTrack.items.length - 1];

  if (activeItem) {
    const mediaStart =
      activeItem.mediaStart !== undefined
        ? activeItem.mediaStart
        : activeItem.start;
    return mediaStart + (t - activeItem.start);
  }
  return t;
});

// --- SUB-COMPOSABLES INSTANTIATION ---
const textState = useInteractiveText(transformerRef);
const {
  fontsLoaded,
  activeTextItems,
  isTimelineTextActiveAndSelected,
  editingItemId,
  editingInputRef,
  setEditingInputRef,
  onLabelRender,
  getEditingStyle,
  stopEditing,
  handleEditingKeydown,
  onEditingInput,
  handleMouseEnterLabel,
  handleMouseLeaveLabel,
  handleStageClick,
  onTextDragMove,
  onTextDragEnd,
  snapping,
  handleTransform,
  selectItem,
  startEditing
} = textState;

const isProcessing = computed(() => {
  return [
    'queued',
    'checking_transcript',
    'downloading_video',
    'downloading_ai_models',
    'transcribing',
    'generating_hooks',
    'cutting',
    'extracting_video'
  ].includes(state.jobStatus.value);
});

const cropState = useCropDrag(
  computed(() => previewScale.value),
  computed(() => maxOffset.value),
  computed(() => activeTextItems.value.length > 0),
  container
);
const {
  isDragging,
  showOverrideToast,
  startDrag,
  onDrag,
  stopDrag,
  startDragTouch,
  onDragTouch
} = cropState;

const directBridge = new DirectPlayerBridge();
const bridgeState = useRemotionBridge(
  directBridge,
  previewVideo,
  computed(() => videoTime.value),
  computed(() => isInThumbnailWindow.value),
  stableVideoBuster
);
const { isInternalTimeUpdate, setNativeVideoStarted, syncRemotionProps } =
  bridgeState;

// --- VIDEO LOADER EVENTS ---
let readyTimeout: any = null;

function onVideoReady() {
  if (!state.videoUrl.value) return;

  if (previewVideo.value) {
    const targetTime = videoTime.value;
    if (Math.abs(previewVideo.value.currentTime - targetTime) > 0.01) {
      previewVideo.value.currentTime = targetTime;
    }
  }

  if (readyTimeout) clearTimeout(readyTimeout);
  readyTimeout = setTimeout(() => {
    state.isMediaLoading.value = false;
    if (previewVideo.value) {
      previewVideo.value.currentTime = videoTime.value;
    }
  }, 400);
}

function onVideoLoaded(e: Event) {
  onVideoReady();
  const target = e.target as HTMLVideoElement;
  if (target.duration && isFinite(target.duration)) {
    state.videoDuration.value = target.duration;
  }
  if (target.videoWidth && target.videoHeight) {
    videoAspect.value = target.videoWidth / target.videoHeight;
  }
}

function onNativeTimeUpdate(e: Event) {
  if (!state.useNativePlayer.value) return;
  const video = e.target as HTMLVideoElement;
  if (!video || video.paused) return;

  isInternalTimeUpdate.value = true;
  const thumbSec = state.thumbnailEnabled.value
    ? state.thumbnailDuration.value
    : 0;
  const videoTrack = state.timelineTracks.value.find(
    (tr: any) => tr.id === 'video'
  );

  if (!videoTrack || !videoTrack.items || videoTrack.items.length === 0) {
    state.currentTime.value = video.currentTime + thumbSec;
  } else {
    const activeItem =
      videoTrack.items.find((i: any) => {
        const mediaStart = i.mediaStart !== undefined ? i.mediaStart : i.start;
        return (
          video.currentTime >= mediaStart &&
          video.currentTime <= mediaStart + i.duration
        );
      }) || videoTrack.items[videoTrack.items.length - 1];

    if (activeItem) {
      const mediaStart =
        activeItem.mediaStart !== undefined
          ? activeItem.mediaStart
          : activeItem.start;
      const relativeOffset = video.currentTime - mediaStart;
      state.currentTime.value = activeItem.start + relativeOffset + thumbSec;
    } else {
      state.currentTime.value = video.currentTime + thumbSec;
    }
  }

  if (state.currentTime.value >= state.timelineDuration.value) {
    state.currentTime.value = state.timelineDuration.value;
    state.isPlaying.value = false;
    video.pause();
  }

  nextTick(() => {
    isInternalTimeUpdate.value = false;
  });
}

function onNativeVideoError(e: Event) {
  console.error('[VideoPreview] Native video error:', e);
  state.isMediaLoading.value = false;
}

function onNativeVideoEnded() {
  state.isPlaying.value = false;
}

let safetyTimeout: any = null;
watch(
  () => state.videoUrl.value,
  url => {
    if (url) {
      stableVideoBuster.value = Date.now().toString();
      setNativeVideoStarted(false);
    }
    if (readyTimeout) clearTimeout(readyTimeout);
    if (safetyTimeout) clearTimeout(safetyTimeout);
    if (url) {
      state.isMediaLoading.value = true;
      safetyTimeout = setTimeout(() => {
        if (state.isMediaLoading.value) state.isMediaLoading.value = false;
      }, 4000);
    }
  },
  { immediate: true }
);

// --- THUMBNAIL BACKGROUND INTERACTION ---
const isThumbBgDragging = ref(false);
const thumbBgDragStartX = ref(0);
const thumbBgDragStartOffset = ref(50);

function handleWindowMouseMove(e: MouseEvent) {
  if (!isThumbBgDragging.value) return;
  const dx = e.clientX - thumbBgDragStartX.value;
  const scaledDx = dx / previewScale.value;
  const srcW = previewVideo.value?.videoWidth || 1920;
  const srcH = previewVideo.value?.videoHeight || 1080;
  const imgWidth = 1920 * (srcW / srcH);
  const excessWidth = Math.max(1, imgWidth - 1080);
  const percentDelta = (scaledDx / excessWidth) * -100;
  state.thumbnailXOffset.value = Math.max(
    0,
    Math.min(100, thumbBgDragStartOffset.value + percentDelta)
  );
}

function handleWindowMouseUp() {
  if (isThumbBgDragging.value) {
    isThumbBgDragging.value = false;
    window.removeEventListener('mousemove', handleWindowMouseMove);
    window.removeEventListener('mouseup', handleWindowMouseUp);
    state.saveThumbnailConfig();
  }
}

function startThumbBgDrag(e: any) {
  if (!isInThumbnailWindow.value) return;
  if (e.target.name() !== 'thumb-bg-rect') return;
  const evt = e.evt || e;
  isThumbBgDragging.value = true;
  thumbBgDragStartX.value = evt.clientX;
  thumbBgDragStartOffset.value = state.thumbnailXOffset.value;
  window.addEventListener('mousemove', handleWindowMouseMove);
  window.addEventListener('mouseup', handleWindowMouseUp);
}

function handleWindowTouchMove(e: TouchEvent) {
  if (!isThumbBgDragging.value || !e.touches.length) return;
  const touch = e.touches[0];
  if (touch) {
    const dx = touch.clientX - thumbBgDragStartX.value;
    const scaledDx = dx / previewScale.value;
    const srcW = previewVideo.value?.videoWidth || 1920;
    const srcH = previewVideo.value?.videoHeight || 1080;
    const imgWidth = 1920 * (srcW / srcH);
    const excessWidth = Math.max(1, imgWidth - 1080);
    const percentDelta = (scaledDx / excessWidth) * -100;
    state.thumbnailXOffset.value = Math.max(
      0,
      Math.min(100, thumbBgDragStartOffset.value + percentDelta)
    );
  }
}

function handleWindowTouchEnd() {
  if (isThumbBgDragging.value) {
    isThumbBgDragging.value = false;
    window.removeEventListener('touchmove', handleWindowTouchMove);
    window.removeEventListener('touchend', handleWindowTouchEnd);
    state.saveThumbnailConfig();
  }
}

function startThumbBgDragTouch(e: any) {
  if (!isInThumbnailWindow.value) return;
  if (e.target.name() !== 'thumb-bg-rect') return;
  const evt = e.evt || e;
  if (!evt.touches || !evt.touches.length) return;
  isThumbBgDragging.value = true;
  thumbBgDragStartX.value = evt.touches[0].clientX;
  thumbBgDragStartOffset.value = state.thumbnailXOffset.value;
  window.addEventListener('touchmove', handleWindowTouchMove);
  window.addEventListener('touchend', handleWindowTouchEnd);
}

function selectThumbnailOverlay(overlay: any) {
  if (state?.activeThumbnailTextId && overlay?.id) {
    state.activeThumbnailTextId.value = overlay.id;
  }
}

function onThumbnailLabelDragMove(e: any, _overlay: any) {
  const node = e.target;
  const isAltPressed = !!(
    e.evt &&
    (e.evt.altKey || e.evt.metaKey || (e.evt as MouseEvent).altKey)
  );
  const { snappedX, snappedY } = snapping.calculateSnap({
    x: node.x(),
    y: node.y(),
    width: node.width(),
    height: node.height(),
    isCentered: false,
    platform: activeSafeZone.value,
    isAltPressed
  });
  node.position({ x: snappedX, y: snappedY });
}

function onThumbnailLabelDragEnd(e: any, overlay: any) {
  selectThumbnailOverlay(overlay);
  overlay.x = e.target.x();
  overlay.y = e.target.y();
  snapping.clearGuides();
  state.saveThumbnailConfig();
}

// --- THUMBNAIL TEXT DIRECT EDITING ---
const editingThumbOverlayId = ref<string | null>(null);
const originalThumbContent = ref<string>('');
const editingThumbInputRef = ref<HTMLElement | null>(null);

function setEditingThumbInputRef(el: any) {
  editingThumbInputRef.value = el;
}

function startEditingThumbOverlay(overlay: any) {
  selectThumbnailOverlay(overlay);
  editingThumbOverlayId.value = overlay.id;
  originalThumbContent.value = overlay.text || '';
  nextTick(() => {
    const el = editingThumbInputRef.value;
    if (el) {
      el.innerText = overlay.text || '';
      el.focus();

      const range = document.createRange();
      range.selectNodeContents(el);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  });
}

function stopEditingThumbOverlay(overlay: any, shouldSave = true) {
  if (editingThumbOverlayId.value === overlay.id) {
    if (shouldSave) {
      const el = editingThumbInputRef.value;
      if (el) {
        overlay.text = el.innerText.trim() || 'YOUR TEXT';
      }
    } else {
      overlay.text = originalThumbContent.value;
    }
    editingThumbOverlayId.value = null;
    state.saveThumbnailConfig();
  }
}

function handleEditingThumbKeydown(e: KeyboardEvent, overlay: any) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    stopEditingThumbOverlay(overlay, true);
  } else if (e.key === 'Escape') {
    e.preventDefault();
    stopEditingThumbOverlay(overlay, false);
  }
}

function onEditingThumbInput(e: any, overlay: any) {
  overlay.text = e.target.innerText;
}

function hexToRgba(hex: string, opacity: number) {
  let c = hex.replace('#', '');
  if (c.length === 3) {
    c =
      c.charAt(0) +
      c.charAt(0) +
      c.charAt(1) +
      c.charAt(1) +
      c.charAt(2) +
      c.charAt(2);
  }
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function getThumbOverlayEditingStyle(overlay: any) {
  const showBackground = overlay.showBackground;
  const bgColor = overlay.backgroundColor || '#000000';
  const bgOpacity = overlay.showBackground
    ? (overlay.backgroundOpacity ?? 0.7)
    : 0;
  const color = overlay.color || '#FFFFFF';
  const fontSize = overlay.fontSize ?? 100;
  const fontFamily = overlay.fontFamily || 'Montserrat';
  const fontWeight = overlay.fontWeight ? String(overlay.fontWeight) : '900';
  const textTransform = overlay.textTransform || 'uppercase';
  const padding = `${overlay.backgroundPadding ?? 20}px`;

  const showStroke = overlay.showStroke !== false;
  const strokeWidth = showStroke ? (overlay.strokeWidth ?? 5) : 0;
  const strokeColor = overlay.strokeColor || '#000000';

  const rgbaBg = showBackground ? hexToRgba(bgColor, bgOpacity) : 'transparent';
  const rgbaShadow = `rgba(0, 0, 0, 0.6)`;

  return {
    position: 'absolute' as const,
    left: `${overlay.x ?? 540}px`,
    top: `${overlay.y ?? 960}px`,
    transform: overlay.rotation
      ? `rotate(${overlay.rotation ?? 0}deg)`
      : undefined,
    transformOrigin: 'top left',

    fontFamily: `"${fontFamily}", sans-serif`,
    fontSize: `${fontSize}px`,
    fontWeight: fontWeight,
    textTransform: textTransform,
    textAlign: 'center' as const,
    lineHeight: '1.1',
    color: color,

    backgroundColor: rgbaBg,
    borderRadius: '10px',
    padding: padding,

    '-webkit-text-stroke': showStroke
      ? `${strokeWidth}px ${strokeColor}`
      : 'none',
    textShadow: `3px 5px 15px ${rgbaShadow}`,

    caretColor: color,
    minWidth: '100px',
    minHeight: '1em',
    maxWidth: '1000px',
    display: 'inline-block',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word' as const
  };
}

onUnmounted(() => {
  handleWindowMouseUp();
  handleWindowTouchEnd();
  if (readyTimeout) clearTimeout(readyTimeout);
  if (safetyTimeout) clearTimeout(safetyTimeout);
  if (controlsHideTimer) clearTimeout(controlsHideTimer);
  if (centerFlashTimer) clearTimeout(centerFlashTimer);
  if (volumePopoverTimer) clearTimeout(volumePopoverTimer);
  window.removeEventListener('mousemove', onRenderedScrubMove);
  window.removeEventListener('mouseup', stopRenderedScrub);
  window.removeEventListener('touchmove', onRenderedScrubTouchMove);
  window.removeEventListener('touchend', stopRenderedScrubTouch);
  window.removeEventListener('mousemove', onVolumeScrubMove);
  window.removeEventListener('mouseup', stopVolumeScrub);
  window.removeEventListener('touchmove', onVolumeScrubTouchMove);
  window.removeEventListener('touchend', stopVolumeScrubTouch);
  window.removeEventListener('keydown', handleRenderedKeydown);
  directBridge.destroy();
});

const statusLabel = computed(() => {
  if (state.renderStatus.value === 'rendering') return 'RENDERING VIDEO...';
  const map: Record<string, string> = {
    queued: 'QUEUED...',
    downloading_video: 'DOWNLOADING 1080p...',
    extracting_audio: 'EXTRACTING AUDIO...',
    downloading_ai_models: 'FETCHING AI MODELS...',
    transcribing: 'TRANSCRIBING (WHISPER)...',
    generating_hooks: 'AI ANALYZING...',
    cutting: 'CUTTING SEGMENT...'
  };
  return map[state.jobStatus.value] || 'PROCESSING...';
});

const progressWidth = computed(() => {
  if (state.renderStatus.value === 'rendering') return '90%';
  const map: Record<string, string> = {
    queued: '5%',
    downloading_video: '20%',
    extracting_audio: '35%',
    downloading_ai_models: '50%',
    transcribing: '65%',
    generating_hooks: '80%',
    cutting: '95%',
    ready: '100%'
  };
  return map[state.jobStatus.value] || '0%';
});

const isSplitActive = computed(() => {
  if (!state.cropMap?.value || state.cropMap.value.length === 0) return false;
  const active = getCropEntryAtMediaTime(state.cropMap.value, videoTime.value);
  return active?.mode === 'split';
});

const canDragCanvas = computed(() => {
  if (state?.videoLayout?.value === 'landscape') return false;
  if (state?.cropMode?.value === 'manual') return true;
  if (state?.cropMode?.value === 'face_tracking' && isSplitActive.value) {
    return (
      (state.splitZoomTop?.value ?? 1.0) > 1.0 ||
      (state.splitZoomBottom?.value ?? 1.0) > 1.0
    );
  }
  return false;
});

const subtitleIndicatorStyle = computed(() => {
  const isSplit =
    isSplitActive.value && (state.autoAdaptiveSubtitles?.value ?? true);
  if (isSplit) {
    return { top: '50%', transform: 'translate(-50%, -50%)' };
  }
  const pos = state.subtitlePosition.value;
  const offset = state.subtitleOffset.value;
  if (pos === 'top') return { top: `${offset}px` };
  if (pos === 'bottom') return { bottom: `${offset}px` };
  return { top: '50%', transform: 'translate(-50%, -50%)' };
});

// Memoized subtitle segments grouped by mode to prevent heavy re-calculation on every tick
const groupedSegments = computed(() => {
  if (!state?.fullTranscript?.value || !state?.activeHook?.value) return [];

  // 1. Flatten all segments in fullTranscript into individual words
  const flatWords: {
    text: string;
    start: number;
    duration: number;
    end: number;
  }[] = [];

  for (const seg of state.fullTranscript.value) {
    const segText = (seg.text || '').trim();
    if (!segText) continue;

    const words = segText.split(/\s+/);
    if (words.length === 1) {
      flatWords.push({
        text: words[0] || '',
        start: seg.start,
        duration: seg.duration,
        end: seg.start + seg.duration
      });
    } else {
      const wordDur = seg.duration / words.length;
      words.forEach((w: string, idx: number) => {
        flatWords.push({
          text: w,
          start: seg.start + idx * wordDur,
          duration: wordDur,
          end: seg.start + (idx + 1) * wordDur
        });
      });
    }
  }

  if (flatWords.length === 0) return [];

  const mode: string = state.subtitleMode.value;

  // 2. Group flatWords based on subtitleMode
  let groups: {
    words: typeof flatWords;
    start: number;
    duration: number;
    end: number;
  }[] = [];

  if (mode === 'word' || mode === '1_word') {
    groups = flatWords.map(w => ({
      words: [w],
      start: w.start,
      duration: w.duration,
      end: w.end
    }));
  } else if (mode.endsWith('_words')) {
    let numWords = 1;
    const match = mode.match(/^(\d+)_(?:word|words)$/);
    if (match && match[1]) {
      numWords = parseInt(match[1]) || 1;
    }

    for (let i = 0; i < flatWords.length; i += numWords) {
      const chunk = flatWords.slice(i, i + numWords);
      if (chunk.length > 0) {
        const first = chunk[0];
        const last = chunk[chunk.length - 1];
        if (first && last) {
          const start = first.start;
          const end = last.end;
          groups.push({ words: chunk, start, duration: end - start, end });
        }
      }
    }
  } else {
    groups = flatWords.map(w => ({
      words: [w],
      start: w.start,
      duration: w.duration,
      end: w.end
    }));
  }

  return groups;
});

const activeSubtitleWords = computed(() => {
  if (!state?.fullTranscript?.value || !state?.activeHook?.value) return [];

  const offsetSec = state.subtitleSyncOffset.value / 1000;
  const firstStart = state.fullTranscript.value[0]?.start || 0;
  const isTranscriptZeroBased =
    firstStart < (state?.activeHook?.value?.start || 0) - 2;

  const thumbSec = state.thumbnailEnabled.value
    ? state.thumbnailDuration.value
    : 0;
  const relativeTime = Math.max(0, state.currentTime.value - thumbSec);

  const searchTime = isTranscriptZeroBased
    ? relativeTime + offsetSec
    : (state?.activeHook?.value?.start || 0) + relativeTime + offsetSec;

  // 3. Find the active grouped segment matching searchTime from pre-memoized groups
  const activeGroup = groupedSegments.value.find(
    s => searchTime >= s.start && searchTime <= s.end
  );
  if (!activeGroup) return [];

  // 4. Return the words in the active group, with their individual timing and state relative to searchTime
  return activeGroup.words.map(w => {
    const isActive = searchTime >= w.start && searchTime <= w.end;
    const isPast = searchTime > w.end;
    return {
      text: w.text,
      start: w.start,
      end: w.end,
      isActive,
      isPast
    };
  });
});

const subtitleBackgroundStyle = computed(() => {
  const bg = state.subtitleBackground.value;
  const opacity = state.subtitleBackgroundOpacity.value;

  if (bg === 'box') {
    return {
      background: `rgba(0,0,0,${opacity})`,
      borderRadius: '16px',
      padding: '16px 32px'
    };
  }
  if (bg === 'blur') {
    return {
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      background: `rgba(0,0,0,${opacity * 0.4})`,
      borderRadius: '20px',
      padding: '16px 32px',
      border: '1px solid rgba(255,255,255,0.1)'
    };
  }
  return {};
});

const getWordStyle = (w: {
  text: string;
  isActive: boolean;
  isPast: boolean;
}) => {
  const hlMode = state.subtitleHighlightMode.value;
  const hlColor = state.subtitleHighlightColor.value;
  const strokeWidth = state.subtitleStrokeWidth.value;
  const strokeColor = state.subtitleStrokeColor.value;

  const baseStyle: Record<string, string | number> = {
    display: 'inline-block',
    transition: 'all 0.1s ease',
    position: 'relative'
  };

  // Apply base stroke/textShadow to each word span
  if (strokeWidth > 0) {
    baseStyle.paintOrder = 'stroke fill';
    baseStyle.WebkitTextStroke = `${strokeWidth * 2}px ${strokeColor}`;
    baseStyle.textShadow = `-${strokeWidth}px -${strokeWidth}px 0 ${strokeColor}, ${strokeWidth}px -${strokeWidth}px 0 ${strokeColor}, -${strokeWidth}px ${strokeWidth}px 0 ${strokeColor}, ${strokeWidth}px ${strokeWidth}px 0 ${strokeColor}, 0 8px 16px rgba(0,0,0,0.8)`;
  } else {
    baseStyle.textShadow = '0 8px 16px rgba(0,0,0,0.8)';
  }

  if (w.isActive) {
    if (hlMode === 'color') {
      baseStyle.color = hlColor;
      baseStyle.transform = 'scale(1.08)';
    } else if (hlMode === 'scale') {
      baseStyle.transform = 'scale(1.15)';
    } else if (hlMode === 'underline') {
      // Capsule marker rendered via pseudo pill in template
    } else if (hlMode === 'box') {
      baseStyle.background = hlColor;
      baseStyle.color = '#000000';
      baseStyle.borderRadius = '12px';
      baseStyle.padding = '4px 16px';
      baseStyle.textShadow = 'none'; // Remove text shadow for box highlight
      baseStyle.transform = 'scale(1.05)';
    }
  }

  return baseStyle;
};

const formatWordText = (text: string) => {
  return transformText(text, state.subtitleTextTransform.value);
};
</script>
