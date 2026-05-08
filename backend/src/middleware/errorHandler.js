const logger = require("../utils/logger");
const { formatErrorHTML } = require("../utils/errorFormatter");

// Standard error response schema
const formatErrorResponse = (err, statusCode = 500) => {
	const isDev = process.env.NODE_ENV === "development";
	return {
		success: false,
		error: err.message || "Internal Server Error",
		statusCode,
		...(isDev && { stack: err.stack, details: err.toString() }),
		timestamp: new Date().toISOString(),
	};
};

// Global error handler middleware (attach to app LAST)
const globalErrorHandler = (err, req, res, next) => {
	const start = Date.now();
	let statusCode = err.statusCode || err.status || 500;

	// Normalize statusCode to valid HTTP range
	if (!Number.isFinite(statusCode) || statusCode < 100 || statusCode > 599) {
		statusCode = 500;
	}

	// Specific error handling
	if (err.name === "CastError") statusCode = 400;
	if (err.name === "ValidationError") statusCode = 422;
	if (err.name === "TimeoutError" || err.message?.includes("timeout")) statusCode = 504;
	if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND") statusCode = 503;

	const duration = Date.now() - start;
	const requestId = req.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`;

	logger.error(
		`[${requestId}] ${req.method} ${req.path} → ${statusCode} (${duration}ms) | Error: ${err.message}`,
		"errorHandler",
		{ stack: err.stack, code: err.code }
	);

	// Check if client accepts HTML (browser) or prefers JSON (API client)
	const acceptHeader = req.headers.accept || '';
	const prefersHTML = acceptHeader.includes('text/html') && !acceptHeader.includes('application/json');
	const isAPIRequest = req.path.startsWith('/api');

	// Return HTML for browser requests to error pages, JSON for API requests
	if (prefersHTML && statusCode >= 500 && !isAPIRequest) {
		return res.status(statusCode).type('text/html').send(
			formatErrorHTML(statusCode, err.message)
		);
	}

	// Return JSON for API requests
	res.status(statusCode).json(formatErrorResponse(err, statusCode));
};

// Timeout error handler
const timeoutHandler = (timeout = 30000) => (req, res, next) => {
	const timeoutId = setTimeout(() => {
		const err = new Error(`Request timeout after ${timeout}ms`);
		err.statusCode = 504;
		err.name = "TimeoutError";
		next(err);
	}, timeout);

	res.on("finish", () => clearTimeout(timeoutId));
	next();
};

// 404 handler
const notFoundHandler = (req, res, next) => {
	const err = new Error(`Route ${req.method} ${req.path} not found`);
	err.statusCode = 404;
	next(err);
};

// Health check endpoint (never fails even if components down)
const healthCheck = (req, res) => {
	res.status(200).json({
		success: true,
		status: "operational",
		timestamp: new Date().toISOString(),
		uptime: process.uptime(),
		memory: process.memoryUsage(),
	});
};

module.exports = {
	globalErrorHandler,
	timeoutHandler,
	notFoundHandler,
	healthCheck,
	formatErrorResponse,
};
