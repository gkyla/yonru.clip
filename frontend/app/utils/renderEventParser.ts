/**
 * Render Event Parser — pure-function state machine extraction from useClipperExport composable.
 */

export interface RenderState {
  progress: number
  stage: string
  eta: number
  status: string
  outputUrl: string | null
  videoUrl: string | null
  jobError: string
}

export function parseRenderEvent(
  data: any,
  currentState: RenderState,
  apiBase: string
): RenderState {
  const nextState = { ...currentState }
  if (!data) return nextState

  if (data.stage === 'bundling') {
    nextState.progress = data.percent || 0
    nextState.stage = 'bundling'
    nextState.eta = 0
  } else if (data.stage === 'rendering') {
    nextState.progress = data.percent || 0
    nextState.stage = 'rendering'
    nextState.eta = data.etaSeconds || 0
  } else if (data.stage === 'encoding') {
    nextState.stage = 'encoding'
    nextState.progress = data.percent || 96
  } else if (data.stage === 'starting') {
    nextState.stage = 'starting'
    nextState.progress = 0
  } else if (data.stage === 'done') {
    nextState.status = 'done'
    nextState.progress = 100
    nextState.stage = ''
    nextState.eta = 0
    nextState.outputUrl = `${apiBase}${data.outputUrl || ''}`
    nextState.videoUrl = nextState.outputUrl
  } else if (data.stage === 'error') {
    nextState.status = 'error'
    nextState.jobError = data.message || 'Render failed'
    nextState.progress = 0
    nextState.stage = ''
  }

  return nextState
}
