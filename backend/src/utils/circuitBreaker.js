const logger = require("../utils/logger");

/**
 * Circuit Breaker pattern for external API calls
 * Prevents cascading failures by failing fast when service is down
 *
 * States:
 * - CLOSED: Normal operation, requests go through
 * - OPEN: Service is failing, requests fail immediately
 * - HALF_OPEN: Testing if service recovered, limited requests allowed
 */
class CircuitBreaker {
	constructor(name, threshold = 5, timeout = 60000, halfOpenRequests = 1) {
		this.name = name;
		this.threshold = threshold; // consecutive failures to open circuit
		this.timeout = timeout; // ms before attempting half-open
		this.halfOpenRequests = halfOpenRequests; // max requests allowed in half-open
		this.state = "CLOSED";
		this.failureCount = 0;
		this.successCount = 0;
		this.nextAttempt = Date.now();
		this.halfOpenCounter = 0;
	}

	async execute(fn) {
		if (this.state === "OPEN") {
			// If timeout passed, try half-open
			if (Date.now() >= this.nextAttempt) {
				logger.info(`[CircuitBreaker] ${this.name} → HALF_OPEN (attempting recovery)`, "circuitBreaker");
				this.state = "HALF_OPEN";
				this.halfOpenCounter = 0;
			} else {
				const waitMs = Math.round(this.nextAttempt - Date.now());
				throw new Error(`[CircuitBreaker] ${this.name} is OPEN (will retry in ${waitMs}ms)`);
			}
		}

		if (this.state === "HALF_OPEN") {
			if (this.halfOpenCounter >= this.halfOpenRequests) {
				throw new Error(`[CircuitBreaker] ${this.name} is HALF_OPEN (max requests reached)`);
			}
			this.halfOpenCounter++;
		}

		try {
			const result = await fn();
			this._onSuccess();
			return result;
		} catch (err) {
			this._onFailure();
			throw err;
		}
	}

	_onSuccess() {
		if (this.state === "HALF_OPEN") {
			logger.info(`[CircuitBreaker] ${this.name} → CLOSED (service recovered)`, "circuitBreaker");
			this.state = "CLOSED";
			this.failureCount = 0;
			this.successCount = 0;
		}
	}

	_onFailure() {
		this.failureCount++;
		if (this.failureCount >= this.threshold) {
			logger.warn(
				`[CircuitBreaker] ${this.name} → OPEN (${this.failureCount}/${this.threshold} failures)`,
				"circuitBreaker"
			);
			this.state = "OPEN";
			this.nextAttempt = Date.now() + this.timeout;
			this.failureCount = 0;
		}
	}

	getStatus() {
		return {
			name: this.name,
			state: this.state,
			failureCount: this.failureCount,
			nextAttempt: this.nextAttempt,
		};
	}
}

// Create circuit breakers for each external service
const breakers = {
	gdacs: new CircuitBreaker("GDACS", 5, 60000),
	usgs: new CircuitBreaker("USGS", 5, 60000),
	nasaEonet: new CircuitBreaker("NASA-EONET", 5, 60000),
	unhcr: new CircuitBreaker("UNHCR", 5, 60000),
	openMeteo: new CircuitBreaker("OpenMeteo", 5, 60000),
	worldPop: new CircuitBreaker("WorldPop", 5, 60000),
	rss: new CircuitBreaker("RSS-Feeds", 5, 60000),
};

module.exports = {
	CircuitBreaker,
	breakers,
};
