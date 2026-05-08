import React, { useState, useCallback } from 'react';
import { APIError, getErrorDetails } from '../services/apiClient';

/**
 * useApiError hook for handling API errors in components
 * Returns error state, error details, and handlers
 */
export function useApiError() {
	const [error, setError] = useState(null);
	const [isLoading, setIsLoading] = useState(false);

	const handleError = useCallback((err) => {
		console.error('[API Error]', err);
		const details = getErrorDetails(err);
		setError({
			...details,
			raw: err,
			timestamp: new Date(),
		});
	}, []);

	const clearError = useCallback(() => {
		setError(null);
	}, []);

	const setLoading = useCallback((loading) => {
		setIsLoading(loading);
	}, []);

	return {
		error,
		isLoading,
		handleError,
		clearError,
		setLoading,
		hasError: !!error,
	};
}

/**
 * useAsyncData hook for fetching data with error handling
 */
export function useAsyncData(fetchFn, dependencies = []) {
	const [data, setData] = useState(null);
	const [isLoading, setIsLoading] = useState(false);
	const apiError = useApiError();

	const fetch = useCallback(async () => {
		setIsLoading(true);
		apiError.clearError();

		try {
			const result = await fetchFn();
			setData(result);
		} catch (err) {
			apiError.handleError(err);
			setData(null);
		} finally {
			setIsLoading(false);
		}
	}, [fetchFn, apiError]);

	// Auto-fetch on mount and when dependencies change
	React.useEffect(() => {
		fetch();
	}, dependencies);

	const retry = useCallback(() => {
		fetch();
	}, [fetch]);

	return {
		data,
		isLoading,
		error: apiError.error,
		hasError: apiError.hasError,
		retry,
		...apiError,
	};
}
