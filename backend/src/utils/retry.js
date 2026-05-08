const logger = require("./logger");

/**
 * Retry logic with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {number} maxAttempts - Max retry attempts (default 3)
 * @param {number} delayMs - Initial delay in ms (default 100)
 * @param {number} backoffFactor - Multiplier for each retry (default 2)
 * @param {string} context - Log context identifier
 * @returns {Promise} Result of fn if successful
 */
async function retryWithBackoff(
	fn,
	maxAttempts = 3,
	delayMs = 100,
	backoffFactor = 2,
	context = "retry"
) {
	let lastError;

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			return await fn();
		} catch (err) {
			lastError = err;
			if (attempt < maxAttempts) {
				const waitMs = delayMs * Math.pow(backoffFactor, attempt - 1);
				logger.warn(
					`[${context}] Attempt ${attempt}/${maxAttempts} failed: ${err.message} (retry in ${waitMs}ms)`,
					"retry"
				);
				await new Promise((resolve) => setTimeout(resolve, waitMs));
			} else {
				logger.error(
					`[${context}] All ${maxAttempts} attempts failed: ${err.message}`,
					"retry"
				);
			}
		}
	}

	throw lastError;
}

/**
 * Quick retry for network requests (max 1-2 attempts)
 */
async function quickRetry(fn, maxAttempts = 2, delayMs = 50) {
	return retryWithBackoff(fn, maxAttempts, delayMs, 2, "quickRetry");
}

module.exports = {
	retryWithBackoff,
	quickRetry,
};
