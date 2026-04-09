import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#0a0e27] text-white p-8">
          <div className="max-w-2xl">
            <h1 className="text-2xl font-bold text-red-400 mb-4">页面发生错误</h1>
            <div className="bg-[rgba(255,255,255,0.1)] rounded-lg p-4 mb-4">
              <p className="text-red-300 mb-2">错误信息:</p>
              <pre className="text-sm text-gray-300 overflow-auto">
                {this.state.error?.toString()}
              </pre>
            </div>
            {this.state.errorInfo && (
              <div className="bg-[rgba(255,255,255,0.1)] rounded-lg p-4">
                <p className="text-red-300 mb-2">错误堆栈:</p>
                <pre className="text-xs text-gray-400 overflow-auto max-h-96">
                  {this.state.errorInfo.componentStack}
                </pre>
              </div>
            )}
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors"
            >
              刷新页面
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
