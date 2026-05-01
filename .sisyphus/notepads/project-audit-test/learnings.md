## Task 1: Extract auth middleware

### Patterns Established
- `getAuthUser(request)` in auth-utils.ts reads `x-user-id` and `x-qq-number` from headers injected by middleware
- All 24 protected API routes now use `getAuthUser(request)` instead of `await verifyToken(request)`
- `verifyToken()` kept intact for login/register/logout routes (excluded from middleware matcher)
- `verifyTokenString()` used by middleware itself + Socket.IO
- `getJwtSecret()` centralized secret lookup with production guard

### Files Changed
- 51 files total: middleware.ts (new), middleware.test.ts (new), auth-utils.ts (modified), 24+ route files (modified), test files (updated mocks)

### Pre-existing Issues (NOT introduced by this task)
- Multiple test files have type narrowing issues with literal types ('online' | 'offline' | 'busy' vs string)
- logger.test.ts has NODE_ENV override issue
- These existed BEFORE Task 1 and are not caused by middleware changes

## Task 2: JWT + CSRF hardening — migrate tokens from localStorage to HttpOnly cookies

### Patterns Established
- JWT token (`qq_token`) exists ONLY in HttpOnly cookie; never in localStorage or response body
- CSRF token is server-side only; removed from response body and localStorage
- `auth-context.tsx` no longer manages token state; auth handled entirely by cookie + middleware
- `api.ts` no longer injects `Authorization: Bearer` header; cookie sent automatically via `credentials: 'include'`
- `getToken()` now reads from `document.cookie` (for Socket.IO handshake compatibility)
- Socket.IO server middleware falls back to reading `qq_token` from handshake cookies when `auth.token` is empty
- On mount, `AuthProvider` clears any legacy `qq_token` / `qq_csrf_token` from localStorage (migration cleanup)

### Files Changed
- `src/lib/auth-context.tsx` — removed all localStorage usage, removed token state, added migration cleanup
- `src/lib/api.ts` — removed Bearer header injection, removed localStorage CSRF, updated getToken() to parse cookie
- `src/app/api/auth/login/route.ts` — removed `token` and `csrf_token` from JSON response body
- `src/app/api/auth/register/route.ts` — removed `token` and `csrf_token` from JSON response body
- `src/server.ts` — Socket.IO middleware now reads `qq_token` from handshake cookies as fallback
- `src/components/chat-window.tsx` — removed manual Bearer + CSRF header injection for bot stream
- `src/lib/auth-migration.test.ts` — new test file verifying: no token in response body, HttpOnly cookie set, localStorage cleared on mount, no localStorage write on login
- `src/app/api/auth/login/route.test.ts` — updated to expect no `token` in response body
- `src/app/api/auth/register/route.test.ts` — updated to expect no `token` in response body

### Testing Notes
- Full suite: 349 tests across 36 files, all passing
- Auth migration tests use `React.createElement` instead of JSX to keep `.test.ts` extension (vitest + OXC compiler is strict about JSX in `.ts` files)
- Cookie assertions spy on mocked `next/headers` `cookies().set()` rather than inspecting `Set-Cookie` response header (Next.js cookie serialization is internal)
- Fetch mocking in auth-context tests must account for `refreshUser()` verify call on mount before login button click

### Pre-existing Issues (NOT introduced by this task)
- None identified; all 349 tests pass cleanly
