// Client/src/main.jsx
import React, { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './App.css';

// Register PWA only in production
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('NSEMS Service Worker registered with scope:', registration.scope);
      })
      .catch((error) => {
        console.error('NSEMS Service Worker registration failed:', error);
      });
  });
}

// Error Boundary for better debugging
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      errorInfo: errorInfo,
      error: error
    });
    console.error('React Error:', error);
    console.error('Error Info:', errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '20px',
          backgroundColor: '#fef2f2',
          border: '2px solid #ef4444',
          borderRadius: '8px',
          margin: '20px',
          color: '#991b1b'
        }}>
          <h2 style={{ color: '#dc2626' }}>Application Error</h2>
          <p><strong>Error:</strong> {this.state.error.toString()}</p>
          {this.state.errorInfo && (
            <details style={{ marginTop: '10px', fontFamily: 'monospace' }}>
              <summary>Stack Trace</summary>
              <pre>{this.state.errorInfo.componentStack}</pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error('❌ Root element not found! Check your index.html');
} else {
  console.log('✅ React root element found');
  console.log('🚀 Initializing NSEMS Digital Student ID System...');
  
  const root = createRoot(rootElement);
  root.render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>
  );
}