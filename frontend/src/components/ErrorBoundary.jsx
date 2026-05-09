import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        // You can log this to an external service like Sentry
        console.error("Site Crash:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            // Fallback UI using your theme colors
            return (
                <div>
                    <h2>
                        Reporting Blockage
                    </h2>
                    <p style={{ color: 'var(--ink)' }}>
                        Something went wrong loading this section. Please refresh or contact the PM.
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="btn-primary"
                    >
                        Reload Component
                    </button>
                </div >
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;