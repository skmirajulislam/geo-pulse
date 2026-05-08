/**
 * API client with error handling, retries, and timeout management
 */

const DEFAULT_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 2;
const INITIAL_RETRY_DELAY = 100; // ms

class APIError extends Error {
	constructor(message, statusCode, errorType = 'unknown') {
		super(message);
		this.name = 'APIError';
		this.statusCode = statusCode;
		this.errorType = errorType; // 'network', 'timeout', 'server', 'offline'
	}
}

/**
 * Fetch with timeout
 */
async function fetchWithTimeout(url, options = {}, timeout = DEFAULT_TIMEOUT) {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeout);

	try {
		const response = await fetch(url, {
			...options,
			signal: controller.signal,
		});
		clearTimeout(timeoutId);
		return response;
	} catch (err) {
		clearTimeout(timeoutId);
		if (err.name === 'AbortError') {
			throw new APIError(
				`Request timeout after ${timeout}ms`,
				504,
				'timeout'
			);
		}
		throw err;
	}
}

/**
 * Retry logic with exponential backoff
 */
async function retryFetch(url, options = {}, maxAttempts = MAX_RETRIES) {
	let lastError;

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			const response = await fetchWithTimeout(url, options);

			// Handle HTTP errors
			if (!response.ok) {
				const errorType = response.status >= 500 ? 'server' : 'unknown';
				throw new APIError(
					`HTTP ${response.status}: ${response.statusText}`,
					response.status,
					errorType
				);
			}

			return response;
		} catch (err) {
			lastError = err;

			// Don't retry on client errors (4xx)
			if (err.statusCode && err.statusCode < 500) {
				throw err;
			}

			// Retry on network errors or server errors
			if (attempt < maxAttempts) {
				const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1);
				console.warn(`[API] Attempt ${attempt}/${maxAttempts} failed (${err.message}), retrying in ${delay}ms`);
				await new Promise((resolve) => setTimeout(resolve, delay));
			}
		}
	}

	throw lastError;
}

/**
 * Main API fetch function with full error handling
 */
export async function apiCall(endpoint, options = {}) {
	// Check offline status
	if (!navigator.onLine) {
		throw new APIError(
			'You are offline. Please check your internet connection.',
			0,
			'offline'
		);
	}

	const url = endpoint.startsWith('http') ? endpoint : `/api${endpoint}`;
	const fetchOptions = {
		method: options.method || 'GET',
		headers: {
			'Content-Type': 'application/json',
			...options.headers,
		},
		...options,
	};

	if (options.body && typeof options.body === 'object') {
		fetchOptions.body = JSON.stringify(options.body);
	}

	try {
		const response = await retryFetch(url, fetchOptions, MAX_RETRIES);
		const data = await response.json();

		// Check for API-level errors
		if (!data.success && data.error) {
			throw new APIError(
				data.error,
				response.status,
				response.status >= 500 ? 'server' : 'unknown'
			);
		}

		return data;
	} catch (err) {
		// Enhance network errors
		if (err instanceof TypeError && err.message.includes('fetch')) {
			throw new APIError(
				'Failed to connect to the server',
				0,
				'network'
			);
		}

		// Re-throw APIError or convert to APIError
		if (err instanceof APIError) {
			throw err;
		}

		throw new APIError(
			err.message || 'Unknown error occurred',
			0,
			'unknown'
		);
	}
}

/**
 * GET request shorthand
 */
export async function apiGet(endpoint, options = {}) {
	return apiCall(endpoint, { ...options, method: 'GET' });
}

/**
 * POST request shorthand
 */
export async function apiPost(endpoint, body, options = {}) {
	return apiCall(endpoint, { ...options, method: 'POST', body });
}

/**
 * Create error handler for React components
 */
export function getErrorDetails(err) {
	if (err instanceof APIError) {
		return {
			title: err.errorType === 'timeout' ? 'Request Timeout' : 'Connection Error',
			message: err.message,
			errorType: err.errorType,
			statusCode: err.statusCode,
		};
	}

	return {
		title: 'Unknown Error',
		message: err?.message || 'An unexpected error occurred',
		errorType: 'unknown',
		statusCode: null,
	};
}

export { APIError };
