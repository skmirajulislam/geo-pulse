import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * Global Error Boundary Component
 * Catches React render errors and displays a fallback UI
 */
class ErrorBoundary extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			hasError: false,
			error: null,
			errorInfo: null,
		};
	}

	static getDerivedStateFromError(error) {
		return { hasError: true };
	}

	componentDidCatch(error, errorInfo) {
		console.error("ErrorBoundary caught:", error, errorInfo);
		this.setState({
			error,
			errorInfo,
		});
	}

	render() {
		if (this.state.hasError) {
			return (
				<div className="min-h-screen bg-gradient-to-br from-red-950 to-red-900 flex items-center justify-center p-4">
					<div className="max-w-lg w-full bg-red-900/40 border border-red-700/50 rounded-lg p-8 backdrop-blur">
						<div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-700/30 rounded-full mb-6">
							<AlertTriangle className="w-6 h-6 text-red-400" />
						</div>
						<h1 className="text-2xl font-bold text-red-200 text-center mb-2">
							Rendering Error
						</h1>
						<p className="text-red-300 text-center mb-4">
							Something went wrong while rendering the application.
						</p>
						{process.env.NODE_ENV === 'development' && this.state.error && (
							<div className="bg-red-950/50 border border-red-700/50 rounded p-3 mb-4 max-h-32 overflow-auto">
								<p className="text-xs font-mono text-red-200 break-words">
									{this.state.error.toString()}
								</p>
							</div>
						)}
						<button
							onClick={() => window.location.reload()}
							className="w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded flex items-center justify-center gap-2 transition"
						>
							<RefreshCw className="w-4 h-4" />
							Reload Page
						</button>
					</div>
				</div>
			);
		}

		return this.props.children;
	}
}

export default ErrorBoundary;
