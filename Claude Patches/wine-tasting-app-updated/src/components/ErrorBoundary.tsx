import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

// Without this, a single render error anywhere in the tree unmounts the whole
// app and drops the person on the start screen with no explanation. The boundary
// catches the error and offers a way back instead.
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : String(error),
    };
  }

  componentDidCatch(error: unknown, info: unknown): void {
    // Surface it in the console for anyone debugging a live event.
    console.error('Grand Taste Tourney hit a render error:', error, info);
  }

  handleReload = (): void => {
    window.location.reload();
  };

  handleReturnToStart = (): void => {
    // Clear the tab hash so the reload lands on a known-good screen rather than
    // the view that just failed.
    window.location.hash = '';
    window.location.reload();
  };

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen flex items-center justify-center px-6 py-16">
        <div className="glass-panel rounded-2xl p-8 max-w-md w-full space-y-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-wine-900/60 border border-wine-800/50 flex items-center justify-center mx-auto">
            <AlertCircle className="w-7 h-7 text-wine-300" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold font-serif text-slate-100">
              This view stopped responding
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              The tasting data is safe on the server. Reload to pick up where you
              left off, or head back to the start screen if the same view keeps
              failing.
            </p>
          </div>

          {this.state.message && (
            <p className="text-xs font-mono text-slate-500 bg-slate-950/60 border border-slate-850 rounded-lg px-3 py-2 break-words">
              {this.state.message}
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <button
              onClick={this.handleReload}
              className="flex-1 py-2.5 px-4 bg-wine-800 hover:bg-wine-700 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Reload
            </button>
            <button
              onClick={this.handleReturnToStart}
              className="flex-1 py-2.5 px-4 bg-slate-900 border border-slate-800 hover:border-wine-800 hover:text-wine-200 text-slate-300 text-sm font-semibold rounded-lg transition-colors"
            >
              Return to start
            </button>
          </div>
        </div>
      </div>
    );
  }
}
