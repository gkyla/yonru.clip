// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import PipelineProgressStepper from '../../app/components/home/PipelineProgressStepper.vue';
import type { LastAnalysisRequest } from '../../app/types/clipper';

const mockJobStatus = ref('transcribing');
const mockJobId = ref('job-xyz-123');
const mockVideoTitle = ref('');
const mockVideoDuration = ref(0);
const mockVideoFps = ref(30);
const mockFolderName = ref<string | null>(null);
const mockYoutubeUrl = ref('');
const mockVideoUrl = ref<string | null>(null);
const mockHasHeatmap = ref(false);
const mockWhisperModel = ref('base');
const mockGeminiModel = ref('gemini-3.5-flash-lite');
const mockSelectedPrompt = ref('prompt.json');
const mockSelectedPresetId = ref('educational');
const mockExtractionMode = ref('preset');
const mockPromptsList = ref<any[]>([]);
const mockCachedVideos = ref<any[]>([]);
const mockIsCachedAnalysis = ref(false);
const mockLastAnalysisRequest = ref<LastAnalysisRequest | null>(null);

vi.mock('../../app/composables/useClipperState', () => ({
  useClipperState: () => ({
    jobStatus: mockJobStatus,
    jobId: mockJobId,
    videoTitle: mockVideoTitle,
    videoDuration: mockVideoDuration,
    videoFps: mockVideoFps,
    folderName: mockFolderName,
    youtubeUrl: mockYoutubeUrl,
    videoUrl: mockVideoUrl,
    hasHeatmap: mockHasHeatmap,
    whisperModel: mockWhisperModel,
    geminiModel: mockGeminiModel,
    selectedPrompt: mockSelectedPrompt,
    selectedPresetId: mockSelectedPresetId,
    extractionMode: mockExtractionMode,
    promptsList: mockPromptsList,
    cachedVideos: mockCachedVideos,
    isCachedAnalysis: mockIsCachedAnalysis,
    lastAnalysisRequest: mockLastAnalysisRequest
  })
}));

const defaultStages = [
  {
    id: '1',
    name: 'Ingestion',
    description: 'Checking url',
    icon: 'ri:link',
    state: 'completed'
  },
  {
    id: '2',
    name: 'AI Analysis',
    description: 'Generating hooks',
    icon: 'ri:magic-line',
    state: 'active'
  }
];

const globalStubs = {
  Icon: {
    template: '<span class="icon-stub" :data-name="$attrs.name"></span>'
  },
  NuxtIcon: { template: '<span class="nuxt-icon-stub"></span>' },
  Transition: { template: '<div><slot /></div>' },
  ClientOnly: { template: '<div><slot /></div>' }
};

describe('PipelineProgressStepper Component', () => {
  beforeEach(() => {
    mockJobStatus.value = 'transcribing';
    mockJobId.value = 'job-xyz-123';
    mockVideoTitle.value = '';
    mockVideoDuration.value = 0;
    mockVideoFps.value = 30;
    mockFolderName.value = null;
    mockYoutubeUrl.value = '';
    mockVideoUrl.value = null;
    mockHasHeatmap.value = false;
    mockWhisperModel.value = 'base';
    mockGeminiModel.value = 'gemini-3.5-flash-lite';
    mockSelectedPrompt.value = 'prompt.json';
    mockSelectedPresetId.value = 'educational';
    mockExtractionMode.value = 'preset';
    mockPromptsList.value = [];
    mockCachedVideos.value = [];
    mockIsCachedAnalysis.value = false;
    mockLastAnalysisRequest.value = null;
  });

  it('renders clean shimmer skeleton when video metadata is not yet resolved', () => {
    const wrapper = mount(PipelineProgressStepper, {
      props: {
        stages: defaultStages,
        progressPercent: 40,
        loadingLabel: 'TRANSCRIBING AUDIO...'
      },
      global: {
        stubs: globalStubs
      }
    });

    const skeleton = wrapper.find('.animate-pulse');
    expect(skeleton.exists()).toBe(true);
    expect(wrapper.text()).not.toContain('PIPELINE STAGE');
    expect(wrapper.text()).not.toContain('SYSTEM METADATA');
    expect(wrapper.text()).not.toContain('Active Task:');
  });

  it('renders rich source video metadata when videoTitle and duration are available', () => {
    mockVideoTitle.value = 'How to Master Machine Learning';
    mockVideoDuration.value = 754; // 12:34
    mockVideoFps.value = 60;
    mockHasHeatmap.value = true;
    mockYoutubeUrl.value = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    mockWhisperModel.value = 'base';
    mockSelectedPrompt.value = 'prompt.json';
    mockSelectedPresetId.value = 'educational';
    mockCachedVideos.value = [
      {
        video_id: 'dQw4w9WgXcQ',
        title: 'How to Master Machine Learning',
        duration: 754,
        fps: 60,
        channel: 'Tech Academy',
        thumbnail_url: '/assets/sources/sample/thumb.jpg',
        added_at: 1725710000000,
        has_heatmap: true
      }
    ];

    const wrapper = mount(PipelineProgressStepper, {
      props: {
        stages: defaultStages,
        progressPercent: 75,
        loadingLabel: 'TRANSCRIBING AUDIO...'
      },
      global: {
        stubs: globalStubs
      }
    });

    // Left Column: Video details
    expect(wrapper.text()).toContain('How to Master Machine Learning');
    expect(wrapper.text()).toContain('Tech Academy');
    expect(wrapper.text()).toContain('12:34');
    expect(wrapper.text()).toContain('Added:');

    // Right Column: Hook Discovery Model, Whisper model and prompt template
    expect(wrapper.text()).toContain('Hook Discovery Model');
    expect(wrapper.text()).toContain('Gemini 3.5 Flash-Lite');
    expect(wrapper.text()).toContain('Whisper Model');
    expect(wrapper.text()).toContain('BASE');
    expect(wrapper.text()).toContain('Prompt Template');
    expect(wrapper.text()).toContain('Edukasi & Debunk');

    // External link to YouTube
    const externalLink = wrapper.find(
      'a[href="https://www.youtube.com/watch?v=dQw4w9WgXcQ"]'
    );
    expect(externalLink.exists()).toBe(true);
    expect(externalLink.attributes('target')).toBe('_blank');

    // Confirms removal of 30 fps, AI Intent, and robotic technical headers/labels
    expect(wrapper.text()).not.toContain('FPS');
    expect(wrapper.text()).not.toContain('AI Intent');
    expect(wrapper.text()).not.toContain('PIPELINE STAGE');
    expect(wrapper.text()).not.toContain('SYSTEM METADATA');
    expect(wrapper.text()).not.toContain('Active Task:');
    expect(wrapper.text()).not.toContain('Engine Stack:');
    expect(wrapper.text()).not.toContain('job-xyz-123');
  });

  it('renders custom prompt template name when custom extraction mode is active', () => {
    mockVideoTitle.value = 'Podcast Deep Dive Episode 42';
    mockVideoDuration.value = 3600;
    mockExtractionMode.value = 'custom';
    mockSelectedPrompt.value = 'podcast_blak_blakan_v2.json';
    mockPromptsList.value = [
      {
        id: 'podcast_blak_blakan_v2.json',
        name: 'Podcast Blak-Blakan V2 (Deep & Raw)'
      }
    ];
    mockCachedVideos.value = [
      {
        video_id: 'sample-podcast',
        title: 'Podcast Deep Dive Episode 42',
        duration: 3600,
        channel: 'Creator Hub',
        thumbnail_url: '/assets/thumb.jpg',
        added_at: 1725710000000
      }
    ];

    const wrapper = mount(PipelineProgressStepper, {
      props: {
        stages: defaultStages,
        progressPercent: 60,
        loadingLabel: 'ANALYZING...'
      },
      global: {
        stubs: globalStubs
      }
    });

    expect(wrapper.text()).toContain('Prompt Template');
    expect(wrapper.text()).toContain('Podcast Blak-Blakan V2 (Deep & Raw)');
    expect(wrapper.text()).not.toContain('AI Intent');
  });

  it('handles thumbnail error gracefully by setting thumbnailLoadError flag', async () => {
    mockVideoTitle.value = 'Sample Video';
    mockVideoDuration.value = 100;
    mockCachedVideos.value = [
      {
        video_id: 'sample-1',
        title: 'Sample Video',
        duration: 100,
        thumbnail_url: '/invalid/thumb.jpg'
      }
    ];

    const wrapper = mount(PipelineProgressStepper, {
      props: {
        stages: defaultStages,
        progressPercent: 50,
        loadingLabel: 'PROCESSING...'
      },
      global: {
        stubs: globalStubs
      }
    });

    const img = wrapper.find('img');
    expect(img.exists()).toBe(true);
    await img.trigger('error');
    expect((wrapper.vm as any).thumbnailLoadError).toBe(true);
  });

  it('emits cancel event when cancel button is clicked', async () => {
    const wrapper = mount(PipelineProgressStepper, {
      props: {
        stages: defaultStages,
        progressPercent: 50,
        loadingLabel: 'PROCESSING...'
      },
      global: {
        stubs: globalStubs
      }
    });

    const cancelBtn = wrapper.find('button');
    await cancelBtn.trigger('click');
    expect(wrapper.emitted('cancel')).toBeTruthy();
  });

  it('displays updated active Hook Discovery Model when non-default tier is selected', () => {
    mockVideoTitle.value = 'Reasoning Showcase';
    mockVideoDuration.value = 300;
    mockGeminiModel.value = 'gemini-3.8-flash';

    const wrapper = mount(PipelineProgressStepper, {
      props: {
        stages: defaultStages,
        progressPercent: 50,
        loadingLabel: 'ANALYZING...'
      },
      global: {
        stubs: globalStubs
      }
    });

    expect(wrapper.text()).toContain('Hook Discovery Model');
    expect(wrapper.text()).toContain('Gemini 3.8 Flash');
  });

  it('displays Smart Preset name when preset mode is active even if selectedPrompt holds a UUID', () => {
    mockVideoTitle.value = 'Long Podcast';
    mockVideoDuration.value = 1800;
    mockExtractionMode.value = 'preset';
    mockSelectedPresetId.value = 'auto';
    mockSelectedPrompt.value = '78204419-c347-4df2-8a72-bb6cdf2ef134';
    mockPromptsList.value = [
      {
        id: '78204419-c347-4df2-8a72-bb6cdf2ef134',
        name: 'Podcast Blak-Blakan V2 (Deep & Raw)'
      }
    ];

    const wrapper = mount(PipelineProgressStepper, {
      props: {
        stages: defaultStages,
        progressPercent: 50,
        loadingLabel: 'ANALYZING...'
      },
      global: {
        stubs: globalStubs
      }
    });

    expect(wrapper.text()).toContain('Auto Virality');
    expect(wrapper.text()).not.toContain('Podcast Blak-Blakan V2 (Deep & Raw)');
  });

  it('displays the custom template selected in ReanalyzeModal during cached reanalysis', () => {
    mockVideoTitle.value = 'Cached Episode';
    mockVideoDuration.value = 1200;
    mockIsCachedAnalysis.value = true;
    mockExtractionMode.value = 'preset';
    mockSelectedPresetId.value = 'auto';
    mockSelectedPrompt.value = 'uuid-1';
    mockPromptsList.value = [
      { id: 'uuid-1', name: 'Template One' },
      { id: 'uuid-2', name: 'Template Two' }
    ];
    mockLastAnalysisRequest.value = {
      type: 'cached',
      videoId: 'vid-1',
      force: true,
      options: {
        extractionMode: 'custom',
        promptFile: 'uuid-2',
        presetId: 'auto'
      }
    };

    const wrapper = mount(PipelineProgressStepper, {
      props: {
        stages: defaultStages,
        progressPercent: 50,
        loadingLabel: 'ANALYZING...',
        isReanalyzingCached: true
      },
      global: {
        stubs: globalStubs
      }
    });

    expect(wrapper.text()).toContain('Template Two');
    expect(wrapper.text()).not.toContain('Template One');
    expect(wrapper.text()).not.toContain('Auto Virality');
  });

  it('displays the Smart Preset selected in ReanalyzeModal during cached reanalysis even when promptFile is present', () => {
    mockVideoTitle.value = 'Cached Episode';
    mockVideoDuration.value = 1200;
    mockIsCachedAnalysis.value = true;
    mockExtractionMode.value = 'custom';
    mockSelectedPrompt.value = 'uuid-1';
    mockPromptsList.value = [{ id: 'uuid-1', name: 'Template One' }];
    mockLastAnalysisRequest.value = {
      type: 'cached',
      videoId: 'vid-1',
      force: true,
      options: {
        extractionMode: 'preset',
        presetId: 'humor',
        promptFile: 'uuid-1'
      }
    };

    const wrapper = mount(PipelineProgressStepper, {
      props: {
        stages: defaultStages,
        progressPercent: 50,
        loadingLabel: 'ANALYZING...',
        isReanalyzingCached: true
      },
      global: {
        stubs: globalStubs
      }
    });

    expect(wrapper.text()).toContain('Funny & Relatable');
    expect(wrapper.text()).not.toContain('Template One');
  });

  it('displays Cached Hooks instead of a stale template name during plain cache lookup', () => {
    mockVideoTitle.value = 'Cached Episode';
    mockVideoDuration.value = 1200;
    mockIsCachedAnalysis.value = true;
    mockExtractionMode.value = 'custom';
    mockSelectedPrompt.value = 'uuid-1';
    mockPromptsList.value = [
      { id: 'uuid-1', name: 'Podcast Blak-Blakan V2 (Deep & Raw)' }
    ];

    const wrapper = mount(PipelineProgressStepper, {
      props: {
        stages: defaultStages,
        progressPercent: 50,
        loadingLabel: 'LOADING FROM CACHE...'
      },
      global: {
        stubs: globalStubs
      }
    });

    expect(wrapper.text()).toContain('Cached Hooks');
    expect(wrapper.text()).not.toContain('Podcast Blak-Blakan V2 (Deep & Raw)');
  });
});
