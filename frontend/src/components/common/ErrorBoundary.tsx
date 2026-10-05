import { Component, type ErrorInfo, type ReactNode } from 'react'
import { TriangleAlert } from 'lucide-react'
import { Button } from '../ui/button'

interface State {
  error: Error | null
  info: string | null
}

/**
 * Top-level error boundary. Keeps a rendering failure inside one route from
 * blanking the whole workspace, and always offers a recovery path.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, info: null }

  static getDerivedStateFromError(error: Error): State {
    return { error, info: null }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ info: info.componentStack?.split('\n').slice(1, 4).join('\n') ?? null })
    if (import.meta.env.DEV) console.error('[LogiSense] render error', error, info)
  }

  reset = () => this.setState({ error: null, info: null })

  render() {
    const { error, info } = this.state
    if (!error) return this.props.children

    return (
      <div className="flex min-h-dvh items-center justify-center bg-canvas p-6">
        <div className="w-full max-w-lg rounded-xl border border-line bg-surface p-6 shadow-pop">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-danger-soft text-danger">
              <TriangleAlert className="size-4.5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-[15px] font-semibold text-fg">This view failed to render</h1>
              <p className="mt-1 text-[13px] leading-5 text-fg-muted">
                The rest of the workspace is still usable. Reloading the view usually clears it.
              </p>
            </div>
          </div>

          <pre className="scrollbar-thin mt-4 max-h-40 overflow-auto rounded-md border border-line bg-surface-sunken p-3 font-mono text-[11px] leading-[1.6] text-danger-fg">
            {error.message}
            {info ? `\n${info}` : ''}
          </pre>

          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={this.reset}>
              Dismiss
            </Button>
            <Button variant="secondary" size="sm" onClick={() => window.location.reload()}>
              Reload app
            </Button>
          </div>
        </div>
      </div>
    )
  }
}