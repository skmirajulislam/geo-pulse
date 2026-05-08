import React from 'react';
import { AlertTriangle, Wifi, WifiOff, Server, RefreshCw, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * Error Page Component for Critical Failures
 * Displays when:
 * - Backend unreachable (503/504)
 * - Network offline
 * - All data sources failed
 * - Critical initialization error
 */
function ErrorPage({ 
	title = "Critical Error",
	message = "Unable to connect to the dashboard",
	errorCode = null,
	errorType = "unknown", // "network", "server", "timeout", "offline"
	onRetry = null,
	details = null,
}) {
	const navigate = useNavigate();
	const [isOnline, setIsOnline] = React.useState(navigator.onLine);

	React.useEffect(() => {
		const handleOnline = () => setIsOnline(true);
		const handleOffline = () => setIsOnline(false);

		window.addEventListener("online", handleOnline);
		window.addEventListener("offline", handleOffline);

		return () => {
			window.removeEventListener("online", handleOnline);
			window.removeEventListener("offline", handleOffline);
		};
	}, []);

	const getErrorIcon = () => {
		switch (errorType) {
			case "offline":
				return <WifiOff className="w-12 h-12 text-red-400" />;
			case "server":
				return <Server className="w-12 h-12 text-orange-400" />;
			case "timeout":
				return <AlertTriangle className="w-12 h-12 text-yellow-400" />;
			default:
				return <AlertTriangle className="w-12 h-12 text-red-400" />;
		}
	};

	const getErrorColor = () => {
		switch (errorType) {
			case "offline":
				return "from-red-950 to-red-900 border-red-700";
			case "server":
				return "from-orange-950 to-orange-900 border-orange-700";
			case "timeout":
				return "from-yellow-950 to-yellow-900 border-yellow-700";
			default:
				return "from-red-950 to-red-900 border-red-700";
		}
	};

	const getBackgroundColor = () => {
		switch (errorType) {
			case "offline":
				return "bg-gradient-to-br from-red-950 to-red-900";
			case "server":
				return "bg-gradient-to-br from-orange-950 to-orange-900";
			case "timeout":
				return "bg-gradient-to-br from-yellow-950 to-yellow-900";
			default:
				return "bg-gradient-to-br from-red-950 to-red-900";
		}
	};

	return (
		<div className={`min-h-screen ${getBackgroundColor()} flex items-center justify-center p-4`}>
			<div className={`max-w-lg w-full bg-opacity-40 border rounded-lg p-8 backdrop-blur ${getErrorColor()}`}>
				{/* Icon */}
				<div className="flex items-center justify-center w-14 h-14 mx-auto bg-opacity-30 rounded-full mb-6 bg-gradient-to-br from-current">
					{getErrorIcon()}
				</div>

				{/* Title & Message */}
				<h1 className="text-2xl font-bold text-center mb-2 text-white">
					{title}
				</h1>
				<p className="text-center mb-6 text-gray-200">
					{message}
				</p>

				{/* Error Code */}
				{errorCode && (
					<div className="text-center mb-4 text-sm font-mono text-gray-300">
						Error Code: <span className="font-bold">{errorCode}</span>
					</div>
				)}

				{/* Online Status */}
				{!isOnline && (
					<div className="bg-red-900/50 border border-red-700/50 rounded px-4 py-2 mb-4 text-center text-sm text-red-200 flex items-center justify-center gap-2">
						<WifiOff className="w-4 h-4" />
						You are offline. Check your internet connection.
					</div>
				)}

				{/* Dev Details */}
				{process.env.NODE_ENV === 'development' && details && (
					<div className="bg-gray-900/50 border border-gray-700/50 rounded p-3 mb-4 max-h-32 overflow-auto">
						<p className="text-xs font-mono text-gray-300 break-words whitespace-pre-wrap">
							{details}
						</p>
					</div>
				)}

				{/* Actions */}
				<div className="space-y-2">
					{onRetry && (
						<button
							onClick={onRetry}
							className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-3 rounded font-semibold flex items-center justify-center gap-2 transition"
						>
							<RefreshCw className="w-4 h-4" />
							Retry Connection
						</button>
					)}
					<button
						onClick={() => window.location.reload()}
						className="w-full bg-gray-700 hover:bg-gray-600 text-white py-3 rounded font-semibold flex items-center justify-center gap-2 transition"
					>
						<RefreshCw className="w-4 h-4" />
						Reload Page
					</button>
					<button
						onClick={() => navigate("/")}
						className="w-full bg-gray-800 hover:bg-gray-700 text-white py-3 rounded font-semibold flex items-center justify-center gap-2 transition"
					>
						<Home className="w-4 h-4" />
						Go Home
					</button>
				</div>

				{/* Help Text */}
				<div className="mt-6 p-3 bg-gray-900/30 rounded text-xs text-gray-300 border border-gray-700/30">
					<p className="font-semibold mb-1">Troubleshooting:</p>
					<ul className="list-disc list-inside space-y-1">
						<li>Check your internet connection</li>
						<li>Try reloading the page</li>
						<li>Clear browser cache if issues persist</li>
						<li>Check backend server status</li>
					</ul>
				</div>
			</div>
		</div>
	);
}

export default ErrorPage;
