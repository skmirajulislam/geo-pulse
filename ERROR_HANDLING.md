# GeoPulse Resilience & Error Handling Documentation

## Overview
This document describes the production-ready error handling and resilience features implemented for GeoPulse, a real-time geopolitical intelligence dashboard.

## Backend Resilience

### 1. Global Error Handler (`src/middleware/errorHandler.js`)
- **Purpose**: Catches all unhandled errors and returns formatted responses
- **Features**:
  - Automatic HTTP status code mapping (400, 422, 503, 504)
  - Request ID generation for debugging
  - Dual-mode response (HTML for browsers, JSON for API clients)
  - Development vs. production error details
  - Error logging with context

**Usage**:
```javascript
// Attach LAST in app.js
app.use(globalErrorHandler);
```

### 2. Request Timeout Handler (`src/middleware/errorHandler.js`)
- **Purpose**: Prevents hanging requests that exceed timeout threshold
- **Default**: 30 seconds per request
- **Returns**: HTTP 504 Gateway Timeout

**Usage**:
```javascript
// Attach early in middleware stack
app.use(timeoutHandler(30000)); // 30s timeout
```

### 3. Async Route Wrapper (`src/utils/asyncHandler.js`)
- **Purpose**: Wraps async route handlers to automatically catch errors
- **Benefits**: Eliminates repetitive try-catch blocks in routes

**Usage**:
```javascript
router.get(
  '/path',
  asyncHandler(async (req, res, next) => {
    // Errors automatically passed to globalErrorHandler
    const data = await riskyOperation();
    res.json({ success: true, data });
  })
);
```

### 4. Circuit Breaker Pattern (`src/utils/circuitBreaker.js`)
- **Purpose**: Prevents cascading failures from external APIs
- **States**:
  - `CLOSED`: Normal operation, requests pass through
  - `OPEN`: Service failing, requests fail fast
  - `HALF_OPEN`: Testing if service recovered

**Configured Services**:
- GDACS (Global Disaster Alert & Coordination System)
- USGS (US Geological Survey)
- NASA EONET (Earth Observatory Natural Event Tracking)
- UNHCR (UN Refugee Agency)
- Open-Meteo (Weather data)
- WorldPop (Population data)
- RSS Feeds (News aggregation)

**Usage**:
```javascript
const { breakers } = require('../utils/circuitBreaker');

try {
  const data = await breakers.gdacs.execute(() => fetchGDACS());
} catch (err) {
  logger.warn(`GDACS unavailable: ${err.message}`);
  // Fallback to cached or default data
}
```

### 5. Retry Logic with Exponential Backoff (`src/utils/retry.js`)
- **Purpose**: Automatically retry failed operations
- **Default**: 3 attempts with exponential backoff (100ms, 200ms, 400ms)
- **Skips**: Client errors (4xx) to avoid waste

**Usage**:
```javascript
const { retryWithBackoff } = require('../utils/retry');

try {
  const data = await retryWithBackoff(
    () => riskyFetch(),
    3,      // maxAttempts
    100,    // initialDelay
    2,      // backoffFactor
    'my-operation'
  );
} catch (err) {
  // Failed after all retries
}
```

### 6. Database Fallback Pattern (`src/cache/cacheFactory.js`)
- **Behavior**: Redis → MongoDB fallback
- **Advantages**:
  - Automatic failover if Redis is down
  - No blocking - always responsive
  - Transparent to API layer

**Workflow**:
```
1. Try Redis (fast, in-memory)
   ↓ (on error)
2. Fall back to MongoDB (persistent)
   ↓ (if still no data)
3. Return empty array (graceful degradation)
```

### 7. Rate Limiter with Store Error Handling
- **Flag**: `passOnStoreError: true`
- **Behavior**: If Redis store fails, let requests through (don't drop traffic)
- **Benefit**: Rate limiting is advisory, not blocking for outages

## Frontend Resilience

### 1. Error Boundary Component (`src/components/ErrorBoundary.jsx`)
- **Purpose**: Catches React component render errors
- **Shows**: User-friendly error page instead of blank screen
- **In Development**: Shows error stack trace

**Usage**:
```jsx
<ErrorBoundary>
  <App />
</ErrorBoundary>
```

### 2. Error Page Component (`src/components/ErrorPage.jsx`)
- **Displays**:
  - Network errors (offline detection)
  - Server errors (5xx)
  - Timeout errors (504)
  - Connection failures

- **Features**:
  - Context-specific error icons and colors
  - Retry button
  - Online/offline indicator
  - Developer details in dev mode
  - Troubleshooting tips

### 3. API Client with Retries (`src/services/apiClient.js`)
- **Features**:
  - Fetch with timeout (30s default)
  - Automatic retry with exponential backoff
  - Offline detection (checks `navigator.onLine`)
  - Detailed error classification
  - Response validation

**Error Types**:
- `offline`: Device is offline
- `timeout`: Request exceeded 30s
- `server`: HTTP 5xx error
- `network`: Connection refused
- `unknown`: Other errors

**Usage**:
```javascript
import { apiCall, apiGet, apiPost } from '../services/apiClient';

try {
  const data = await apiGet('/weather');
} catch (err) {
  if (err.errorType === 'offline') {
    // Show offline page
  } else if (err.errorType === 'timeout') {
    // Show timeout message
  }
}
```

### 4. Error Hooks (`src/hooks/useApiError.js`, `src/hooks/useOffline.js`)

**useApiError**:
```javascript
const { error, isLoading, handleError, retry } = useApiError();
```

**useAsyncData**:
```javascript
const { data, isLoading, error, retry } = useAsyncData(
  () => fetchData(),
  [dependencies]
);
```

**useNetworkStatus**:
```javascript
const isOnline = useNetworkStatus();
```

**useBackendHealth**:
```javascript
const { isHealthy, lastCheck } = useBackendHealth(30000); // check every 30s
```

**useOfflineData**:
```javascript
const [data, saveData] = useOfflineData('cache-key', defaultValue);
```

### 5. Global Error Boundary in App
- **Wraps**: All routes
- **Effect**: Single point of catch for any render crash

```jsx
<ErrorBoundary>
  <BrowserRouter>
    <Routes>...</Routes>
  </BrowserRouter>
</ErrorBoundary>
```

## Health Checks

### Backend Health Endpoint
```
GET /api/health
```

**Response**:
```json
{
  "success": true,
  "status": "operational",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600,
  "memory": { "heapUsed": 50000000, ... }
}
```

**Features**:
- No rate limiting
- Always available (never times out)
- Shows server uptime
- Memory usage tracking

### Frontend Health Monitoring
```javascript
const { isHealthy, lastCheck } = useBackendHealth(30000);
```

- Polls `/api/health` every 30s
- Detects server availability
- Can trigger UI state changes (offline mode)

## Graceful Degradation Patterns

### 1. Cache-First Strategy
```
Try cache → on error → use stale data → show fallback UI
```

### 2. Partial Data Loading
```
Load critical data → ignore non-critical errors → show partial dashboard
```

### 3. Feature Fallback
```
Try feature → on error → disable feature gracefully
```

## Worst-Case Scenarios & Handling

### Scenario 1: Redis Down
- **Impact**: Cache unavailable
- **Handling**: Automatic fallback to MongoDB
- **User Experience**: Slight performance degradation, full functionality

### Scenario 2: MongoDB Down
- **Impact**: Persistent storage unavailable
- **Handling**: Circuit breaker opens, cache-only mode
- **User Experience**: Limited to cached/real-time data only

### Scenario 3: External API (GDACS, USGS, etc.) Down
- **Impact**: New data unavailable
- **Handling**: Circuit breaker prevents retries, use stale data
- **User Experience**: Stale data shown with timestamp

### Scenario 4: Network Timeout (>30s)
- **Backend**: Request terminated, 504 returned
- **Frontend**: Error displayed, user can retry
- **User Experience**: Clear error message with retry button

### Scenario 5: Frontend Render Error
- **Handling**: ErrorBoundary catches, fallback UI shown
- **User Experience**: "Something went wrong" page with reload button

### Scenario 6: Complete Server Down
- **Backend**: All requests fail with connection refused
- **Frontend**: Error page shown, suggests offline mode
- **User Experience**: "Backend unavailable" page with troubleshooting tips

### Scenario 7: Rate Limit Exceeded
- **Behavior**: Request blocked with HTTP 429
- **With passOnStoreError**: Request succeeds if rate limiter store fails
- **User Experience**: Limited requests honored, no errors if store fails

## Configuration

### Timeout Settings
```javascript
// Backend (app.js)
app.use(timeoutHandler(30000)); // 30 seconds

// Frontend (apiClient.js)
const DEFAULT_TIMEOUT = 30000; // 30 seconds
```

### Retry Settings
```javascript
// Frontend (apiClient.js)
const MAX_RETRIES = 2;
const INITIAL_RETRY_DELAY = 100; // ms
```

### Circuit Breaker Settings
```javascript
// src/utils/circuitBreaker.js
new CircuitBreaker(
  'service-name',
  5,      // threshold (failures before opening)
  60000,  // timeout (ms before half-open)
  1       // halfOpenRequests (max requests in half-open state)
)
```

### Health Check Interval
```javascript
// Frontend
const { isHealthy } = useBackendHealth(30000); // check every 30s
```

## Testing Error Scenarios

### Test Redis Failure
```bash
# Stop Redis
docker stop <redis-container>

# Test endpoint - should fallback to MongoDB
curl http://localhost:5000/api/weather
```

### Test MongoDB Failure
```bash
# Stop MongoDB
docker stop <mongodb-container>

# Test endpoint - circuit breaker opens, cached data returned
curl http://localhost:5000/api/weather
```

### Test Timeout
```bash
# Intentionally slow endpoint (debugging)
# In route: await new Promise(r => setTimeout(r, 40000));

# Frontend shows 504 error after 30s timeout
```

### Test Offline Mode
```javascript
// In browser console
navigator.onLine = false;

// Frontend detects offline and shows offline page
```

## Logging

All errors are logged with:
- **Timestamp**: ISO 8601 format
- **Context**: Which service/middleware
- **Error Message**: Human-readable error
- **Request ID**: For tracing
- **Stack Trace**: In development mode

**Log Levels**:
- `error`: Critical failures
- `warn`: Recoverable issues (fallbacks triggered)
- `info`: Normal operations

## Security Considerations

1. **Error Details in Production**: Disabled in non-development mode
2. **Error Pages**: HTML pages don't leak sensitive info
3. **Status Codes**: Informative but don't expose internal details
4. **Rate Limiting**: Protected against brute force attacks
5. **CORS**: Configured in `app.js` with environment variables

## Performance Impact

- **Timeouts**: No performance impact (passes through)
- **Retries**: Increases latency on errors (acceptable trade-off)
- **Circuit Breaker**: Fails fast after threshold (saves resources)
- **Error Handling**: Minimal overhead (<1ms per request)

## Monitoring & Alerting

For production deployments, monitor:
1. `/api/health` endpoint (should always return 200)
2. Error rate (log 5xx errors)
3. Circuit breaker state changes
4. Average response time (should be <500ms)
5. Redis/MongoDB connection status

## Future Improvements

1. Add distributed tracing (OpenTelemetry)
2. Implement bulkhead pattern (resource isolation)
3. Add adaptive timeout (based on historical latency)
4. Implement feature flags (disable features on error)
5. Add automatic incident reporting (Sentry, etc.)

---

**Last Updated**: January 2024
**Version**: 1.0
**Status**: Production Ready
