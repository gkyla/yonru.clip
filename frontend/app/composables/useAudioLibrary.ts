import type {
  AudioLibraryItem,
  AudioLibraryUploadResult
} from '../types/clipper';
import { resolveApiBase } from '../utils/apiBase';
import { useAppNotifier } from './useAppNotifier';

export const useAudioLibrary = (notifier = useAppNotifier()) => {
  const API_BASE = resolveApiBase();

  const audioLibrary = useState<AudioLibraryItem[]>('audioLibrary', () => []);
  const isAudioLibraryLoading = useState<boolean>(
    'isAudioLibraryLoading',
    () => false
  );

  function normalizeItem(raw: Partial<AudioLibraryItem>): AudioLibraryItem {
    const url = raw.url || `/assets/audio_library/${raw.filename || ''}`;
    const cacheBust = raw.updated_at || raw.created_at;
    const baseSrc = url.startsWith('http') ? url : `${API_BASE}${url}`;
    const src = cacheBust ? `${baseSrc}?t=${Math.floor(cacheBust)}` : baseSrc;
    return {
      id: raw.id || '',
      name: raw.name || raw.filename || 'audio.mp3',
      filename: raw.filename || raw.name || 'audio.mp3',
      url,
      src,
      duration: Number(raw.duration || 0),
      size: Number(raw.size || 0),
      sha256: raw.sha256,
      created_at: raw.created_at,
      updated_at: raw.updated_at
    };
  }

  async function fetchAudioLibrary(): Promise<void> {
    isAudioLibraryLoading.value = true;
    try {
      const res = await $fetch<{
        status: string;
        items: Partial<AudioLibraryItem>[];
      }>(`${API_BASE}/api/audio-library`);
      audioLibrary.value = (res.items || []).map(normalizeItem);
    } catch (e) {
      console.error('Failed to fetch audio library', e);
    } finally {
      isAudioLibraryLoading.value = false;
    }
  }

  async function uploadAudioFile(
    file: File,
    duration: number,
    onDuplicate: 'prompt' | 'replace' | 'use_existing' = 'prompt'
  ): Promise<AudioLibraryUploadResult | null> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('duration', String(duration || 0));
      formData.append('on_duplicate', onDuplicate);

      const res = await $fetch<{
        status: 'created' | 'duplicate' | 'existing' | 'replaced';
        item: Partial<AudioLibraryItem>;
      }>(`${API_BASE}/api/audio-library`, {
        method: 'POST',
        body: formData
      });

      const normalized = normalizeItem(res.item);

      if (res.status === 'created') {
        audioLibrary.value = [
          normalized,
          ...audioLibrary.value.filter(i => i.id !== normalized.id)
        ];
      } else if (res.status === 'replaced') {
        const idx = audioLibrary.value.findIndex(i => i.id === normalized.id);
        if (idx >= 0) {
          const next = [...audioLibrary.value];
          next[idx] = normalized;
          audioLibrary.value = next;
        } else {
          audioLibrary.value = [normalized, ...audioLibrary.value];
        }
      }

      return {
        status: res.status,
        item: normalized
      };
    } catch (e: unknown) {
      const errObj = e as { data?: { detail?: string }; message?: string };
      const msg =
        errObj?.data?.detail ||
        errObj?.message ||
        'Failed to upload audio file.';
      notifier.showToast(msg, 'error');
      return null;
    }
  }

  async function deleteAudioItem(id: string): Promise<boolean> {
    try {
      await $fetch(`${API_BASE}/api/audio-library/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
      audioLibrary.value = audioLibrary.value.filter(i => i.id !== id);
      return true;
    } catch (e) {
      notifier.showToast('Failed to remove audio from library.', 'error');
      return false;
    }
  }

  return {
    audioLibrary,
    isAudioLibraryLoading,
    fetchAudioLibrary,
    uploadAudioFile,
    deleteAudioItem
  };
};
