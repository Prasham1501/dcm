import { Component, ErrorInfo, ReactNode } from 'react';

interface State { error: Error | null; info: string }

export class Volume3DErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, info: '' };

  static getDerivedStateFromError(error: Error): State {
    return { error, info: '' };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[Volume3DErrorBoundary] caught', error, info);
    this.setState({ info: info.componentStack || '' });
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ position: 'fixed', inset: 0, background: '#0a0a0a', color: '#f87171', padding: 24, fontFamily: 'monospace', fontSize: 13, overflow: 'auto' }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>3D Volume Viewer crashed</div>
          <div style={{ whiteSpace: 'pre-wrap', marginBottom: 12 }}>{String(this.state.error?.stack || this.state.error?.message || this.state.error)}</div>
          {this.state.info && (
            <details style={{ marginTop: 12, color: '#9ca3af' }}>
              <summary style={{ cursor: 'pointer' }}>Component stack</summary>
              <pre style={{ whiteSpace: 'pre-wrap' }}>{this.state.info}</pre>
            </details>
          )}
          <button
            onClick={() => { this.setState({ error: null, info: '' }); location.reload(); }}
            style={{ marginTop: 16, padding: '6px 12px', background: '#dc2626', color: 'white', border: 0, borderRadius: 4, cursor: 'pointer' }}
          >Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}
