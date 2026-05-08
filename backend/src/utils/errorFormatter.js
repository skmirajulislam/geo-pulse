/**
 * Format error responses as HTML or JSON based on Accept header
 * Allows frontend to display friendly error pages
 */
function formatErrorHTML(statusCode = 500, error = 'Internal Server Error') {
	const isDev = process.env.NODE_ENV === 'development';
	
	return `
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Error ${statusCode}</title>
	<style>
		* { margin: 0; padding: 0; box-sizing: border-box; }
		body {
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', sans-serif;
			background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
			min-height: 100vh;
			display: flex;
			align-items: center;
			justify-content: center;
			padding: 20px;
		}
		.container {
			max-width: 600px;
			background: rgba(255, 255, 255, 0.95);
			border-radius: 12px;
			box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
			padding: 40px;
			text-align: center;
		}
		.error-code {
			font-size: 72px;
			font-weight: bold;
			color: #e74c3c;
			margin-bottom: 10px;
		}
		.error-title {
			font-size: 24px;
			color: #2c3e50;
			margin-bottom: 15px;
		}
		.error-message {
			font-size: 16px;
			color: #7f8c8d;
			margin-bottom: 30px;
			line-height: 1.6;
		}
		.details {
			background: #ecf0f1;
			border-left: 4px solid #3498db;
			padding: 15px;
			margin: 20px 0;
			text-align: left;
			border-radius: 4px;
			${!isDev ? 'display: none;' : ''}
		}
		.details code {
			background: #fff;
			padding: 10px;
			border-radius: 4px;
			display: block;
			overflow-x: auto;
			font-family: 'Courier New', monospace;
			font-size: 12px;
			color: #c0392b;
		}
		.actions {
			display: flex;
			gap: 10px;
			justify-content: center;
			margin-top: 30px;
		}
		button {
			padding: 12px 24px;
			border: none;
			border-radius: 6px;
			font-size: 14px;
			font-weight: 600;
			cursor: pointer;
			transition: all 0.3s;
		}
		.btn-retry {
			background: #3498db;
			color: white;
		}
		.btn-retry:hover {
			background: #2980b9;
		}
		.btn-home {
			background: #95a5a6;
			color: white;
		}
		.btn-home:hover {
			background: #7f8c8d;
		}
		.timestamp {
			font-size: 12px;
			color: #95a5a6;
			margin-top: 20px;
		}
	</style>
</head>
<body>
	<div class="container">
		<div class="error-code">${statusCode}</div>
		<div class="error-title">
			${statusCode === 500 ? 'Internal Server Error' :
			  statusCode === 503 ? 'Service Unavailable' :
			  statusCode === 504 ? 'Gateway Timeout' :
			  'Server Error'}
		</div>
		<div class="error-message">
			${error}
		</div>
		<div class="details">
			<strong>Error Details:</strong>
			<code>${error}</code>
		</div>
		<div class="actions">
			<button class="btn-retry" onclick="location.reload()">Retry</button>
			<button class="btn-home" onclick="location.href='/'">Go Home</button>
		</div>
		<div class="timestamp">
			Timestamp: ${new Date().toISOString()}
		</div>
	</div>
</body>
</html>
	`.trim();
}

module.exports = { formatErrorHTML };
