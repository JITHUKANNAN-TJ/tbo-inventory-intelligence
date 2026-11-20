import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button, Card, CardHeader } from './ui'

interface Props {
  children: ReactNode
  fallbackTitle?: string
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('UI error boundary caught:', error, info.componentStack)
  }

  reset = () => this.setState({ error: null })

  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto max-w-2xl px-4 py-10">
          <Card>
            <CardHeader
              title={this.props.fallbackTitle ?? 'Something went wrong'}
              description="An unexpected error occurred while rendering this view."
            />
            <div className="space-y-3 px-5 py-4 text-xs text-ink-muted">
              <p className="flex items-center gap-2 text-bad">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {this.state.error.message || 'Unknown error'}
              </p>
              <p className="leading-relaxed">
                The rest of the workspace is unaffected. Try reloading the page; if the problem persists, reset the
                workspace from Settings.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" size="sm" onClick={this.reset}>
                  <RefreshCw className="h-3.5 w-3.5" /> Try again
                </Button>
                <Button variant="secondary" size="sm" onClick={() => window.location.reload()}>
                  Reload page
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )
    }
    return this.props.children
  }
}