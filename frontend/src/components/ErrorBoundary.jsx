import React from 'react';
import { AlertOctagon, RefreshCw, Home } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    // Production client error telemetry / console log
    console.error('Unhandled Application Error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/dashboard';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#F7F6F2',
            padding: '24px',
            fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          }}
        >
          <div
            style={{
              maxWidth: '480px',
              width: '100%',
              background: '#FFFFFF',
              border: '1px solid #DDDCD6',
              borderRadius: '8px',
              padding: '32px',
              boxShadow: '0 2px 8px rgba(32, 40, 45, 0.06)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: '#FDF0EF',
                color: '#B34F4A',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '14px',
              }}
            >
              <AlertOctagon size={24} />
            </div>

            <h2
              style={{
                fontSize: '18px',
                fontWeight: 700,
                color: '#20282D',
                marginBottom: '6px',
              }}
            >
              Application Error
            </h2>

            <p
              style={{
                fontSize: '13px',
                color: '#69737A',
                lineHeight: 1.6,
                marginBottom: '20px',
              }}
            >
              An unexpected error occurred while rendering this view. The error details have been logged.
            </p>

            {this.state.error?.message && (
              <div
                style={{
                  background: '#F7F6F2',
                  border: '1px solid #DDDCD6',
                  borderRadius: '6px',
                  padding: '10px 12px',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  color: '#69737A',
                  textAlign: 'left',
                  marginBottom: '20px',
                  wordBreak: 'break-all',
                }}
              >
                {this.state.error.message}
              </div>
            )}

            <div
              style={{
                display: 'flex',
                gap: '10px',
                justifyContent: 'center',
              }}
            >
              <button
                type="button"
                onClick={this.handleReload}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#2F6B62',
                  color: '#ffffff',
                  border: 'none',
                  padding: '9px 16px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <RefreshCw size={14} />
                Reload
              </button>

              <button
                type="button"
                onClick={this.handleGoHome}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#FFFFFF',
                  color: '#20282D',
                  border: '1px solid #DDDCD6',
                  padding: '9px 16px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Home size={14} />
                Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
