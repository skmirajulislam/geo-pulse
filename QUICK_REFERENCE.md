# GeoPulse Error Handling Quick Reference

## 🎯 Common Scenarios

### 1. Backend Route Error

**Before:**
```javascript
router.get('/data', async (req, res) => {
  try {
    const data = await risky();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});
```

**After (Now):**
```javascript
router.get('/data',
  asyncHandler(async (req, res, next) => {
    const data = await risky();
    res.json({ success: true, data });
    // Error automatically caught & handled globally
  })
);
```

---

### 2. External API Call

**Before:**
```javascript
const data = await fetch('https://api.example.com/data');
// No retry, might fail silently
```

**After (Now):**
```javascript
const { breakers } = require('../utils/circuitBreaker');
const { retryWithBackoff } = require('../utils/retry');

try {
  const data = await breakers.gdacs.execute(() =>
    retryWithBackoff(() => fetch('https://gdacs.com/data'))
  );
} catch (err) {
  // Circuit breaker prevented cascading failure
  // Use fallback data
}
```

---

### 3. Frontend API Call

**Before:**
```javascript
const data = await fetch('/api/weather')
  .then(r => r.json());
// No retry, no timeout, might hang forever
```

**After (Now):**
```javascript
import { apiGet } from '../services/apiClient';

try {
  const { data } = await apiGet('/api/weather');
  // Automatic retry (2x), timeout (30s), offline check
} catch (err) {
  if (err.errorType === 'offline') {
    showOfflineUI();
  } else if (err.errorType === 'timeout') {
    showTimeoutUI();
  } else {
    showErrorUI(err);
  }
}
```

---

### 4. Component Render Error

**Before:**
```jsx
function MyComponent() {
  return (
    <div>
      {mayThrowError()}  // If throws, whole app breaks
    </div>
  );
}
```

**After (Now):**
```jsx
import ErrorBoundary from './ErrorBoundary';

function MyComponent() {
  return (
    <ErrorBoundary>
      <div>
        {mayThrowError()}  // If throws, ErrorBoundary catches
      </div>
    </ErrorBoundary>
  );
}
```

---

### 5. Network Offline

**Before:**
```javascript
// App continues running, requests silently fail
// No indication to user
```

**After (Now):**
```javascript
import { useNetworkStatus } from '../hooks/useOffline';

function MyComponent() {
  const isOnline = useNetworkStatus();
  
  if (!isOnline) {
    return <OfflineUI />;  // Clear indication
  }
  return <OnlineUI />;
}
```

---

### 6. Long Running Request

**Before:**
```javascript
// Request hangs for minutes if server doesn't respond
// Browser gets stuck
```

**After (Now):**
```javascript
// Backend: 30s timeout → 504 Gateway Timeout
// Frontend: Detects timeout → shows error with retry

// User sees error after 30s, not stuck forever
```

---

## 🔧 Configuration

### Adjust Timeout (30s default)
```javascript
// Backend (src/app.js)
app.use(timeoutHandler(60000)); // 60 seconds

// Frontend (src/services/apiClient.js)
const DEFAULT_TIMEOUT = 60000; // 60 seconds
```

### Adjust Retry Attempts
```javascript
// Frontend (src/services/apiClient.js)
const MAX_RETRIES = 3; // Default is 2
```

### Adjust Circuit Breaker
```javascript
// Backend (src/utils/circuitBreaker.js)
new CircuitBreaker(
  'service-name',
  5,      // Open after 5 failures (default)
  60000,  // Try recovery after 60s (default)
  1       // Max 1 request during half-open (default)
)
```

---

## 🐛 Debugging

### Check Backend Errors
```bash
# Error logs include:
# - Timestamp
# - Request ID (for tracing)
# - HTTP status code
# - Error message
# - Stack trace (in dev mode)

# Example:
# [2024-01-01T00:00:00] ERROR: [req-123] GET /api/weather → 500
# Error: Database connection failed
```

### Check Frontend Errors
```javascript
// Browser console shows:
// - [API Error] Error message
// - Error type (offline, timeout, server, etc.)
// - Request URL and method
// - Full error object in dev tools
```

### Monitor Circuit Breaker
```javascript
const { breakers } = require('../utils/circuitBreaker');

// Check status anytime
console.log(breakers.gdacs.getStatus());
// Output: {
//   name: 'GDACS',
//   state: 'CLOSED' | 'OPEN' | 'HALF_OPEN',
//   failureCount: 0,
//   nextAttempt: 1704067200000
// }
```

---

## 📊 Error Response Examples

### Success Response
```json
{
  "success": true,
  "data": { ... }
}
```

### API Client Error (JSON)
```json
{
  "success": false,
  "error": "Request timeout after 30000ms",
  "statusCode": 504,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### API Client Error (HTML) - Only in development
```html
<!DOCTYPE html>
<html>
  <body>
    <h1>504 Gateway Timeout</h1>
    <p>Request timeout after 30000ms</p>
    <button>Retry</button>
  </body>
</html>
```

### Frontend Error (JavaScript)
```javascript
{
  title: "Request Timeout",
  message: "Request timeout after 30000ms",
  errorType: "timeout",  // offline | timeout | server | network | unknown
  statusCode: 504
}
```

---

## 🚨 Emergency Procedures

### If Redis is Down
```bash
# Backend continues working with MongoDB
# Performance slightly degraded
# No action needed - automatic fallback
```

### If MongoDB is Down
```bash
# Backend returns cached data or empty array
# No new data persisted
# Action: Bring MongoDB back online
```

### If External API is Down
```bash
# Circuit breaker opens after 5 failures
# Backend returns stale data from cache
# No action needed - circuit breaker handles it
# Circuit auto-recovers after 60s
```

### If Backend is Down
```javascript
// Frontend shows error page
// User can refresh or go offline mode
// No automatic recovery (requires server restart)
```

---

## ✅ Health Checks

### Check Backend Health
```bash
curl http://localhost:5000/api/health

# Response:
{
  "success": true,
  "status": "operational",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600,
  "memory": { ... }
}
```

### Check Frontend Health (React)
```javascript
import { useBackendHealth } from '../hooks/useOffline';

function Status() {
  const { isHealthy, lastCheck } = useBackendHealth(30000);
  
  return (
    <div>
      Backend: {isHealthy ? '✓ OK' : '✗ Down'}
      Last check: {lastCheck?.toLocaleTimeString()}
    </div>
  );
}
```

---

## 📚 File Quick Reference

| File | Purpose |
|------|---------|
| `src/middleware/errorHandler.js` | Global error handler |
| `src/utils/asyncHandler.js` | Async route wrapper |
| `src/utils/retry.js` | Retry with backoff |
| `src/utils/circuitBreaker.js` | Circuit breaker for APIs |
| `src/utils/errorFormatter.js` | HTML error pages |
| `src/routes/*.js` | All routes use asyncHandler |
| `frontend/src/components/ErrorBoundary.jsx` | React error catch |
| `frontend/src/components/ErrorPage.jsx` | Error UI |
| `frontend/src/services/apiClient.js` | Resilient fetch |
| `frontend/src/hooks/useApiError.js` | Error state |
| `frontend/src/hooks/useOffline.js` | Network status |

---

## 🎓 Key Concepts

### Circuit Breaker States
1. **CLOSED** - Normal, requests pass through
2. **OPEN** - Service failing, requests rejected fast
3. **HALF_OPEN** - Testing recovery, limited requests

### Error Types (Frontend)
- `offline` - Device has no internet
- `timeout` - Request took >30s
- `server` - Backend returned 5xx
- `network` - Connection refused
- `unknown` - Other errors

### Fallback Strategy
1. Try primary (cache/API)
2. On error, try secondary (MongoDB/stale data)
3. On error, return empty/default
4. Show error UI to user

---

## 💡 Best Practices

✅ **DO:**
- Use `asyncHandler` for all route handlers
- Use `apiGet`/`apiPost` for all API calls
- Wrap components that might error in ErrorBoundary
- Check `useNetworkStatus()` before critical ops
- Log errors with context for debugging

❌ **DON'T:**
- Use bare `try-catch` in routes (use asyncHandler)
- Use bare `fetch()` (use apiGet/apiPost)
- Ignore errors silently
- Assume network is always available
- Over-catch errors (let ErrorBoundary handle render errors)

---

**Last Updated**: January 2024  
**Version**: 1.0  
**Status**: Production Ready
