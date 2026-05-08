/**
 * Async route wrapper for Express
 * Automatically catches errors in async route handlers and passes to next()
 */
function asyncHandler(fn) {
	return (req, res, next) => {
		Promise.resolve(fn(req, res, next)).catch(next);
	};
}

module.exports = asyncHandler;
