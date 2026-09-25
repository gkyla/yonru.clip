export interface SubtitlePreset {
  id: string
  name: string
  category: 'viral' | 'minimal' | 'podcast' | 'creative'
  icon: string
  font: string
  fontSize: number
  fontWeight: number
  color: string
  highlightColor: string
  animation: 'pop' | 'slide-up' | 'fade' | 'bounce' | 'typewriter' | 'karaoke'
  highlightMode: 'color' | 'scale' | 'underline' | 'box' | 'none'
  background: 'none' | 'box' | 'blur'
  strokeWidth: number
  textTransform: 'uppercase' | 'capitalize' | 'none'
  description: string
  tags?: string[]
}

export interface PresetCategory {
  id: 'all' | 'viral' | 'minimal' | 'podcast' | 'creative'
  label: string
  icon: string
}

export const PRESET_CATEGORIES: PresetCategory[] = [
  { id: 'all', label: 'All Presets', icon: 'ri:apps-2-line' },
  { id: 'viral', label: 'Viral Hooks', icon: 'ri:flashlight-fill' },
  { id: 'minimal', label: 'Minimalist', icon: 'ri:sparkling-line' },
  { id: 'podcast', label: 'Podcast & Talk', icon: 'ri:mic-line' },
  { id: 'creative', label: 'Creative & Docu', icon: 'ri:magic-line' },
]

export const SUBTITLE_PRESETS: SubtitlePreset[] = [
  // 1. Hormozi Bold (Original)
  {
    id: 'bold-podcast',
    name: 'Hormozi Bold',
    category: 'viral',
    icon: 'ri:mic-fill',
    font: 'Montserrat',
    fontSize: 50,
    fontWeight: 900,
    color: '#FFFFFF',
    highlightColor: '#CFFF50',
    animation: 'pop',
    highlightMode: 'color',
    background: 'none',
    strokeWidth: 0,
    textTransform: 'uppercase',
    description: 'Punchy uppercase captions with electric lime word pop.'
  },
  // 2. Minimal Glass (Original)
  {
    id: 'clean-vlog',
    name: 'Minimal Glass',
    category: 'minimal',
    icon: 'ri:sparkling-line',
    font: 'Outfit',
    fontSize: 50,
    fontWeight: 700,
    color: '#FFFFFF',
    highlightColor: '#A78BFA',
    animation: 'karaoke',
    highlightMode: 'scale',
    background: 'blur',
    strokeWidth: 0,
    textTransform: 'capitalize',
    description: 'Frosted blur pill with smooth scale highlight.'
  },
  // 3. Urban Street (Original)
  {
    id: 'street',
    name: 'Urban Street',
    category: 'viral',
    icon: 'ri:fire-fill',
    font: 'Outfit',
    fontSize: 50,
    fontWeight: 900,
    color: '#FFFFFF',
    highlightColor: '#E2F952',
    animation: 'pop',
    highlightMode: 'color',
    background: 'none',
    strokeWidth: 3,
    textTransform: 'uppercase',
    description: 'Bold stroke contrast designed for fast-paced shorts.'
  },
  // 4. Cinematic Docu (Original)
  {
    id: 'documentary',
    name: 'Cinematic Docu',
    category: 'creative',
    icon: 'ri:film-line',
    font: 'Noto Sans',
    fontSize: 50,
    fontWeight: 600,
    color: '#FFFBEB',
    highlightColor: '#F59E0B',
    animation: 'typewriter',
    highlightMode: 'underline',
    background: 'none',
    strokeWidth: 2,
    textTransform: 'capitalize',
    description: 'Warm editorial tone with dynamic amber underline.'
  },
  // 5. Rhythm Karaoke (Original)
  {
    id: 'karaoke',
    name: 'Rhythm Karaoke',
    category: 'creative',
    icon: 'ri:disc-line',
    font: 'Oswald',
    fontSize: 50,
    fontWeight: 700,
    color: '#F1F5F9',
    highlightColor: '#FFD700',
    animation: 'karaoke',
    highlightMode: 'color',
    background: 'none',
    strokeWidth: 4,
    textTransform: 'uppercase',
    description: 'Continuous flowing karaoke highlight in radiant gold.'
  },
  // 6. Modern Vlog (Original)
  {
    id: 'minimal',
    name: 'Modern Vlog',
    category: 'minimal',
    icon: 'ri:video-line',
    font: 'Poppins',
    fontSize: 50,
    fontWeight: 700,
    color: '#FFFFFF',
    highlightColor: '#38BDF8',
    animation: 'slide-up',
    highlightMode: 'scale',
    background: 'none',
    strokeWidth: 3,
    textTransform: 'capitalize',
    description: 'Clean geometric typography with subtle sky-blue accents.'
  },
  // 7. MrBeast Impact (New)
  {
    id: 'beast-punch',
    name: 'MrBeast Impact',
    category: 'viral',
    icon: 'ri:flashlight-fill',
    font: 'Lilita One',
    fontSize: 54,
    fontWeight: 400,
    color: '#FFFFFF',
    highlightColor: '#FFD700',
    animation: 'bounce',
    highlightMode: 'scale',
    background: 'none',
    strokeWidth: 4,
    textTransform: 'uppercase',
    description: 'High-energy bouncy typography with chunky black stroke.'
  },
  // 8. Breaking Alert (New)
  {
    id: 'red-alert',
    name: 'Breaking Alert',
    category: 'viral',
    icon: 'ri:alarm-warning-fill',
    font: 'Bebas Neue',
    fontSize: 56,
    fontWeight: 400,
    color: '#FFFFFF',
    highlightColor: '#EF4444',
    animation: 'pop',
    highlightMode: 'box',
    background: 'box',
    strokeWidth: 2,
    textTransform: 'uppercase',
    description: 'Heavy condensed text with striking crimson highlight box.'
  },
  // 9. Deep Podcast (New)
  {
    id: 'studio-talk',
    name: 'Deep Podcast',
    category: 'podcast',
    icon: 'ri:voiceprint-line',
    font: 'Inter',
    fontSize: 48,
    fontWeight: 800,
    color: '#F8FAFC',
    highlightColor: '#38BDF8',
    animation: 'pop',
    highlightMode: 'color',
    background: 'box',
    strokeWidth: 0,
    textTransform: 'none',
    description: 'Dark translucent backdrop for maximum dialogue clarity.'
  },
  // 10. Broadcast Host (New)
  {
    id: 'interview-pro',
    name: 'Broadcast Host',
    category: 'podcast',
    icon: 'ri:broadcast-line',
    font: 'Roboto Condensed',
    fontSize: 50,
    fontWeight: 700,
    color: '#FFFFFF',
    highlightColor: '#CFFF50',
    animation: 'slide-up',
    highlightMode: 'color',
    background: 'none',
    strokeWidth: 2,
    textTransform: 'capitalize',
    description: 'Professional broadcast news aesthetic with crisp pacing.'
  },
  // 11. Cyber Neon (New)
  {
    id: 'cyber-neon',
    name: 'Cyber Neon',
    category: 'creative',
    icon: 'ri:cpu-line',
    font: 'Russo One',
    fontSize: 50,
    fontWeight: 400,
    color: '#E0F2FE',
    highlightColor: '#22D3EE',
    animation: 'pop',
    highlightMode: 'color',
    background: 'blur',
    strokeWidth: 3,
    textTransform: 'uppercase',
    description: 'Sci-fi futuristic aesthetic with cyan electric glow.'
  },
  // 12. Comic Story (New)
  {
    id: 'comic-pop',
    name: 'Comic Story',
    category: 'creative',
    icon: 'ri:bubble-chart-fill',
    font: 'Bangers',
    fontSize: 56,
    fontWeight: 400,
    color: '#FEF08A',
    highlightColor: '#F43F5E',
    animation: 'bounce',
    highlightMode: 'scale',
    background: 'none',
    strokeWidth: 4,
    textTransform: 'uppercase',
    description: 'Graphic novel style with playful bounce and thick stroke.'
  },
  // 13. Video Essay (New)
  {
    id: 'noir-essay',
    name: 'Video Essay',
    category: 'creative',
    icon: 'ri:quill-pen-line',
    font: 'Playfair Display',
    fontSize: 46,
    fontWeight: 700,
    color: '#F8FAFC',
    highlightColor: '#E2E8F0',
    animation: 'fade',
    highlightMode: 'underline',
    background: 'none',
    strokeWidth: 1,
    textTransform: 'none',
    description: 'Elegant serif typography for long-form thought pieces.'
  },
  // 14. Nordic Minimal (New)
  {
    id: 'clean-caption',
    name: 'Nordic Minimal',
    category: 'minimal',
    icon: 'ri:layout-2-line',
    font: 'Inter',
    fontSize: 46,
    fontWeight: 600,
    color: '#FFFFFF',
    highlightColor: '#94A3B8',
    animation: 'fade',
    highlightMode: 'none',
    background: 'box',
    strokeWidth: 0,
    textTransform: 'none',
    description: 'Subtle, unobtrusive captions with dark contrast backplate.'
  },
  // 15. TikTok Spark (New)
  {
    id: 'tiktok-fast',
    name: 'TikTok Spark',
    category: 'viral',
    icon: 'ri:tiktok-line',
    font: 'Montserrat',
    fontSize: 52,
    fontWeight: 900,
    color: '#FFFFFF',
    highlightColor: '#F472B6',
    animation: 'pop',
    highlightMode: 'scale',
    background: 'none',
    strokeWidth: 3,
    textTransform: 'uppercase',
    description: 'Punchy viral pop with high-retention neon pink pulse.'
  },
  // 16. Aesthetic Chill (New)
  {
    id: 'soft-aesthetic',
    name: 'Aesthetic Chill',
    category: 'minimal',
    icon: 'ri:heart-3-line',
    font: 'Poppins',
    fontSize: 48,
    fontWeight: 600,
    color: '#FEF3C7',
    highlightColor: '#FBBF24',
    animation: 'fade',
    highlightMode: 'underline',
    background: 'blur',
    strokeWidth: 0,
    textTransform: 'capitalize',
    description: 'Warm pastel tones over a smooth frosted backdrop.'
  }
]
