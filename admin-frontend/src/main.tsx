import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary.tsx'
import './index.css'

// 全局错误处理
window.onerror = function(message, source, lineno, colno, error) {
  console.error('[Global Error]', message, 'at', source, lineno, colno, error);
  return false;
};

window.onunhandledrejection = function(event) {
  console.error('[Unhandled Promise Rejection]', event.reason);
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
