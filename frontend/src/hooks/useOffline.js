import { useState, useEffect } from 'react';

/**
 * useNetworkStatus hook - Detects online/offline status
 */
export function useNetworkStatus() {
	const [isOnline, setIsOnline] = useState(navigator.onLine);

	useEffect(() => {
		const handleOnline = () => setIsOnline(true);
		const handleOffline = () => setIsOnline(false);

		window.addEventListener('online', handleOnline);
		window.addEventListener('offline', handleOffline);

		return () => {
			window.removeEventListener('online', handleOnline);
			window.removeEventListener('offline', handleOffline);
		};
	}, []);

	return isOnline;
}

/**
 * useLocalStorage with fallback for offline mode
 */
export function useOfflineData(key, defaultValue = null) {
	const [data, setData] = useState(() => {
		try {
			const stored = localStorage.getItem(key);
			return stored ? JSON.parse(stored) : defaultValue;
		} catch (err) {
			console.warn(`Failed to read localStorage key "${key}":`, err);
			return defaultValue;
		}
	});

	const saveData = (newData) => {
		try {
			localStorage.setItem(key, JSON.stringify(newData));
			setData(newData);
		} catch (err) {
			console.warn(`Failed to save localStorage key "${key}":`, err);
		}
	};

	return [data, saveData];
}

/**
 * useBackendHealth hook - Periodically checks if backend is accessible
 */
export function useBackendHealth(interval = 30000) {
	const [isHealthy, setIsHealthy] = useState(true);
	const [lastCheck, setLastCheck] = useState(null);

	useEffect(() => {
		const checkHealth = async () => {
			try {
				const response = await fetch('/api/health', {
					method: 'GET',
					signal: AbortSignal.timeout(5000),
				});
				setIsHealthy(response.ok);
				setLastCheck(new Date());
			} catch (err) {
				setIsHealthy(false);
				setLastCheck(new Date());
			}
		};

		// Check immediately
		checkHealth();

		// Then check periodically
		const timer = setInterval(checkHealth, interval);
		return () => clearInterval(timer);
	}, [interval]);

	return { isHealthy, lastCheck };
}
