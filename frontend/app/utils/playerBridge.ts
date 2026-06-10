export interface PlayerBridge {
  updateProps(props: any): void
  seek(frame: number): void
  play(): void
  pause(): void
  onMessage(listener: (data: any) => void): () => void
  destroy(): void
}

export class IframePostMessageBridge implements PlayerBridge {
  private iframeRef: { value: HTMLIFrameElement | null }
  private listeners: Set<(data: any) => void> = new Set()
  private boundOnMessage: (event: MessageEvent) => void

  constructor(iframeRef: { value: HTMLIFrameElement | null }) {
    this.iframeRef = iframeRef
    this.boundOnMessage = this.handleMessage.bind(this)
    if (import.meta.client) {
      window.addEventListener('message', this.boundOnMessage)
    }
  }

  private handleMessage(event: MessageEvent) {
    const data = event.data
    if (!data) return
    this.listeners.forEach((listener) => listener(data))
  }

  public updateProps(props: any): void {
    const iframe = this.iframeRef.value
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({
        type: 'UPDATE_PROPS',
        payload: props
      }, '*')
    }
  }

  public seek(frame: number): void {
    const iframe = this.iframeRef.value
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({
        type: 'SEEK',
        frame
      }, '*')
    }
  }

  public play(): void {
    const iframe = this.iframeRef.value
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({
        type: 'PLAY'
      }, '*')
    }
  }

  public pause(): void {
    const iframe = this.iframeRef.value
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({
        type: 'PAUSE'
      }, '*')
    }
  }

  public onMessage(listener: (data: any) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  public destroy(): void {
    if (import.meta.client) {
      window.removeEventListener('message', this.boundOnMessage)
    }
    this.listeners.clear()
  }
}

export class MockPlayerBridge implements PlayerBridge {
  public calls: { type: string; payload?: any; frame?: number }[] = []
  private listeners: Set<(data: any) => void> = new Set()

  public updateProps(props: any): void {
    this.calls.push({ type: 'updateProps', payload: props })
  }

  public seek(frame: number): void {
    this.calls.push({ type: 'seek', frame })
  }

  public play(): void {
    this.calls.push({ type: 'play' })
  }

  public pause(): void {
    this.calls.push({ type: 'pause' })
  }

  public onMessage(listener: (data: any) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  public emitMessage(data: any): void {
    this.listeners.forEach((listener) => listener(data))
  }

  public destroy(): void {
    this.listeners.clear()
  }
}
