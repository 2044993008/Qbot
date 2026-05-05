# 椤圭洰鍏ㄩ潰瀹℃煡涓庢祴璇曟柟妗?
## TL;DR

> **Quick Summary**: 瀵逛豢 QQ 缃戦〉绔簲鐢ㄨ繘琛屽叏鏍堝璁′笌淇鈥斺€旇鐩?6 涓ā鍧椼€?1 涓凡璇嗗埆闂锛? Critical + 12 High + 10 Medium锛夛紝閲囩敤 TDD 鏂规硶琛ュ叏娴嬭瘯瑕嗙洊锛屾秷闄ら€昏緫缂洪櫡鍜屾湭浣跨敤璧勬簮銆?> 
> **Deliverables**:
> - 鎵€鏈?Critical/High 瀹夊叏闂淇锛圝WT 鍔犲浐銆丆SRF 琛ュ叏銆丅ot 鍚庨棬灏佸牭銆丷LS 绛栫暐锛?> - 15+ 涓己澶辩殑娴嬭瘯鏂囦欢锛坢essages route銆乻cheduler銆乥ot agent銆乻ocket-client 绛夛級
> - 鍓嶇鐨勬灦鏋勪慨澶嶏紙鍙岄噸璺敱鍚堝苟銆丼idebar 鎻愬彇銆侀敊璇竟鐣岋級
> - 鏈娇鐢ㄨ祫婧愭竻鐞嗭紙3 涓緷璧栧寘銆? 涓?hook銆? 涓?Zod schema銆? 涓被鍨嬪鍑猴級
> - E2E 娴嬭瘯琛ュ叏锛? 涓叧閿敤鎴锋祦绋嬶級
>
> **Estimated Effort**: Large
> **Parallel Execution**: YES - 4 waves with max 5 concurrent
> **Critical Path**: Module 1 (Auth Infra) 鈫?Module 2 (Chat) 鈫?Module 4 (Bot) 鈫?Module 6 (Final cleanup)

---

## Context

### Original Request
"瀹℃煡褰撳墠椤圭洰骞舵祴璇曞綋鍓嶉」鐩紝鍒跺畾璇︾粏鐨勫鏌ュ拰娴嬭瘯鏂规锛岀‘淇濇瘡涓€澶勭粏鑺傦紝姣忎竴涓ā鍧楋紝姣忎竴鏉￠€昏緫鎬э紝浠庡墠绔埌鍚庣閮借兘鎵撻€氾紝閲嶇偣鐪嬫湁娌℃湁閫昏緫锛岃祫婧愭湭浣跨敤鐨勯棶棰?

### Interview Summary
**Key Discussions**:
- **Scope**: 鍏ㄩ潰瀹℃煡 + 琛ュ叏娴嬭瘯 + Critical/High 淇锛堜笉鍚€ц兘鍩哄噯銆丆I/CD 鏂板缓璁剧疆锛?- **Test Strategy**: TDD锛堢孩鈫掔豢鈫掗噸鏋勶級锛屾瘡涓慨澶嶅厛鍐欐祴璇曗啋楠岃瘉澶辫触鈫掑疄鐜扳啋楠岃瘉閫氳繃
- **Priority**: 鎸?6 涓ā鍧楀垎缁勬墽琛岋紙Auth 鈫?Chat 鈫?Friends/Moments 鈫?Bot 鈫?Tasks 鈫?Infrastructure锛?- **Breaking Changes**: 鎺ュ彈鐮村潖鎬у彉鏇达紙JWT 瀛樺偍杩佺Щ銆丆SRF 鍔犲浐鍚庣敤鎴烽渶閲嶆柊鐧诲綍锛?
**Research Findings** (4 涓帰绱唬鐞嗭紝鎬昏 7+ 鍒嗛挓鍒嗘瀽):
- **鍓嶇**: 鍙岄噸鑱婂ぉ璺敱鏋舵瀯锛坄/app` SPA vs `/app/chat/[id]` 鐙珛椤碉級銆乽seMessages 绔炴€佹潯浠躲€佹墍鏈夐〉闈㈡棤閿欒杈圭晫銆丼idebar 鍦?6 椤典腑閲嶅銆乣useIsMobile()` hook 瀹屽叏鏈敤
- **鍚庣**: Bot `execute_tool` CSRF 缁曡繃锛堝彲鐩存帴鍒犲ソ鍙?閫€缇わ級銆丄uthContext `login()` 閿欒浼犳挱 bug銆乣relations.ts` 涓虹┖銆佹棤 RLS 琛岀骇瀹夊叏銆? 涓?API 绔偣缂哄皯 CSRF銆乣zod@v4` 涓?`drizzle-zod@v3` 鐗堟湰鍐茬獊銆佸凡鎻愪氦鐨?OpenAI API Key
- **娴嬭瘯**: 34 涓?Vitest 娴嬭瘯 + 5 涓?E2E锛屼絾 `messages/route.ts`锛堟渶澶嶆潅璺敱锛夈€乣scheduler.ts`锛?32 琛岋級銆丅ot agent 閫昏緫锛?297 琛岋級銆乣server.ts`銆乣socket-client.ts`銆乣validation.ts` 鍧囨棤娴嬭瘯
- **渚濊禆**: `@aws-sdk/client-s3` + `@aws-sdk/lib-storage`锛?00% 鏈娇鐢級銆乣happy-dom`锛堝畨瑁呬絾鐢?jsdom锛夈€乣.env.local` 鍚湡瀹?API Key

### Metis Review
**Identified Gaps** (addressed):
- "Tasks" 妯″潡瀹氫箟锛氬凡纭鎸?瀹氭椂浠诲姟锛圫cheduled Tasks锛夋ā鍧?- 鐮村潖鎬у彉鏇村鐞嗭細鐢ㄦ埛纭鎺ュ彈锛岀珛鍗宠縼绉?JWT/CSRF 鏈哄埗
- Socket.IO 娴嬭瘯绛栫暐锛氫娇鐢ㄤ笓鐢ㄦ祴璇曟湇鍔″櫒瀹炰緥锛屼笉杩炴帴鐢熶骇鏈嶅姟鍣?- Bot AI 娴嬭瘯绛栫暐锛歁ock OpenAI 瀹㈡埛绔紝浠呭仛 input/output contract 娴嬭瘯
- 鏁版嵁搴撳彉鏇磋寖鍥达細浠呬唬鐮佸眰鍙樻洿锛堝 zod 楠岃瘉锛夛紝涓嶆秹鍙?Supabase RLS 绛栫暐閮ㄧ讲
- Test Completion 瀹氫箟锛氭墍鏈?Critical/High bug 鏈夊洖褰掓祴璇?+ 鎵€鏈夋湭瑕嗙洊鐨勫鏉傛枃浠讹紙闈?UI/shader 鐢熸垚鏂囦欢锛夋湁鏈€灏?contract/integration 娴嬭瘯

---

## Work Objectives

### Core Objective
瀵逛豢 QQ 缃戦〉绔繘琛屽叏闈㈠畨鍏ㄥ璁°€侀€昏緫楠岃瘉鍜屾祴璇曡ˉ鍏紝淇鎵€鏈?Critical/High 闂锛屾秷闄ゆ湭浣跨敤璧勬簮鍜岄噸澶嶄唬鐮侊紝纭繚浠庡墠绔埌鍚庣鐨勬瘡涓€澶勭粏鑺傞兘鑳芥墦閫氥€?
### Concrete Deliverables
- 淇 9 涓?Critical 鍜?12 涓?High 闂锛堣鎯呰鍚勬ā鍧?TODOs锛?- 鏂板 15+ 涓祴璇曟枃浠惰鐩栧綋鍓嶆棤娴嬭瘯鐨勬牳蹇冩ā鍧?- 琛ュ叏 6 涓?E2E 娴佺▼锛圔ot 瀵硅瘽銆佺┖闂村彂甯冦€佺兢鑱?@鎻愬強銆佷换鍔?CRUD銆佷釜浜鸿缃慨鏀广€佸璁℃棩蹇楋級
- 绉婚櫎 3 涓湭浣跨敤渚濊禆鍖咃紙`@aws-sdk/client-s3`銆乣@aws-sdk/lib-storage`銆乣happy-dom`锛?- 娓呯悊鏈娇鐢ㄤ唬鐮侊紙`useIsMobile()` hook銆乣LoginResponse`/`ApiResponse<T>` 绫诲瀷銆? 涓湭浣跨敤 Zod schema锛?
### Definition of Done
- [ ] `pnpm run ts-check` 鈫?闆堕敊璇?- [ ] `pnpm test` (vitest run) 鈫?鎵€鏈夋祴璇曢€氳繃锛岃鐩栫巼 鈮?55% (lines)
- [ ] `pnpm test:e2e` (playwright test) 鈫?鎵€鏈?11 涓?E2E spec 閫氳繃
- [ ] `pnpm run lint` 鈫?闆堕敊璇?- [ ] 鎵€鏈?Critical/High 闂宸蹭慨澶嶅苟鏈夊洖褰掓祴璇曚繚鎶?- [ ] 鏈娇鐢ㄨ祫婧愬凡娓呯悊锛堜緷璧栥€乭ook銆佺被鍨嬨€乻chema锛?- [ ] 鏈€缁堥獙璇?Wave锛團1-F4锛夊叏閮?APPROVE

### Must Have
- 闈欐€佺被鍨嬫鏌ラ浂閿欒 (`tsc --noEmit`)
- 鎵€鏈?API 璺敱鏈?TDD 娴嬭瘯淇濇姢
- JWT 瀛樺偍鍦?HttpOnly Cookie锛堥潪 localStorage锛?- CSRF 淇濇姢瑕嗙洊鎵€鏈夌姸鎬佸彉鏇寸鐐?- Bot `execute_tool` 闇€缁忚繃棰勮纭娴佺▼
- 鍓嶇鏈夐敊璇竟鐣屽鐞嗭紙`error.tsx`锛?- 鏈娇鐢ㄤ緷璧栧寘宸茬Щ闄?
### Must NOT Have (Guardrails)
- **绂佹寮曞叆鏂板姛鑳?* 鈥?涓嶆坊鍔犳柊鐨?API 绔偣銆侀〉闈㈣矾鐢辨垨 UI 鍔熻兘
- **绂佹 UI 閲嶆柊璁捐** 鈥?涓嶄慨鏀圭幇鏈夌晫闈㈠竷灞€/鏍峰紡锛堥櫎闈炰慨澶?CLS 闂锛?- **绂佹鍗囩骇澶х増鏈緷璧?* 鈥?涓嶅崌绾?`next`銆乣react`銆乣zod` 涓荤増鏈?- **绂佹瑙﹀強 Supabase 鏁版嵁搴撶瓥鐣?* 鈥?鍙仛搴旂敤灞傚彉鏇达紝涓嶄慨鏀?RLS policies
- **绂佹閲嶆瀯鏃?bug 浠ｇ爜** 鈥?濡?`relations.ts` 涓虹┖涓嶆槸 bug锛屽彧鏍囪涓嶄慨鏀?- **绂佹娣诲姞 CI/CD pipeline** 鈥?涓嶅湪鏈鑼冨洿
- **AI Slop 闃叉**: 涓嶈繃搴︽敞閲娿€佷笉杩囨棭鎶借薄銆佷笉楠岃瘉杩囧害銆佷笉鏂囨。鑶ㄨ儉

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** - ALL verification is agent-executed. No exceptions.
> Acceptance criteria requiring "user manually tests/confirms" are FORBIDDEN.

### Test Decision
- **Infrastructure exists**: YES (Vitest + Playwright + MSW + Testing Library)
- **Automated tests**: TDD (Red 鈫?Green 鈫?Refactor)
- **Framework**: vitest (unit/integration) + playwright (E2E)
- **TDD workflow**: Each fix/feature task: RED (write failing test) 鈫?GREEN (minimal implementation) 鈫?REFACTOR (clean up)

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Frontend/UI**: Playwright 鈥?Navigate, interact, assert DOM, screenshot
- **API/Backend**: Bash (curl) 鈥?Send requests, assert status + response fields
- **Library/Module**: Bash (bun/node REPL) 鈥?Import, call functions, compare output
- **Socket.IO**: Dedicated test server 鈥?Start/stop per test file, verify event flow

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Module 1: Auth & Security Infrastructure):
鈹溾攢鈹€ Task 1: Extract auth middleware [deep]
鈹溾攢鈹€ Task 2: JWT + CSRF hardening (HttpOnly cookie) [deep]
鈹溾攢鈹€ Task 3: TDD tests for auth routes (login/register/logout/verify) [medium]
鈹溾攢鈹€ Task 4: Fix AuthContext login() error propagation bug [medium]
鈹斺攢鈹€ Task 5: CSRF protection for unprotected endpoints [medium]

Wave 2 (Modules 2-3: Chat & Friends/Moments 鈥?MAX PARALLEL):
鈹溾攢鈹€ Task 6: Fix dual chat routing + TDD test [deep]
鈹溾攢鈹€ Task 7: Fix useMessages race condition + TDD test [deep]
鈹溾攢鈹€ Task 8: TDD tests for messages/route.ts (most complex route) [deep]
鈹溾攢鈹€ Task 9: Add conversation ownership validation [medium]
鈹溾攢鈹€ Task 10: Moments privacy/visibility TDD [deep]
鈹溾攢鈹€ Task 11: Fix upload fake success URL + TDD [medium]
鈹溾攢鈹€ Task 12: TDD tests for moments routes (like/comment) [medium]
鈹溾攢鈹€ Task 13: Friend list dedup + unique constraint [medium]
鈹斺攢鈹€ Task 14: Extract Sidebar to AppLayout (de-duplicate 6 pages) [medium]

Wave 3 (Module 4-5: Bot & Tasks):
鈹溾攢鈹€ Task 15: Bot execute_tool CSRF fix + TDD [deep]
鈹溾攢鈹€ Task 16: Bot AI agent contract tests (mock OpenAI) [deep]
鈹溾攢鈹€ Task 17: TDD tests for scheduler.ts [deep]
鈹溾攢鈹€ Task 18: Rate limiting for unprotected endpoints [medium]
鈹斺攢鈹€ Task 19: Settings key whitelist + TDD [medium]

Wave 4 (Module 6: Infrastructure Cleanup & E2E):
鈹溾攢鈹€ Task 20: Remove unused dependencies (aws-sdk, happy-dom) [quick]
鈹溾攢鈹€ Task 21: Clean unused code (hook, types, schemas) [quick]
鈹溾攢鈹€ Task 22: Install error boundaries (error.tsx) for all routes [medium]
鈹溾攢鈹€ Task 23: Replace <img> with next/image (moments + chat) [medium]
鈹溾攢鈹€ Task 24: Add ARIA labels to icon-only buttons [quick]
鈹溾攢鈹€ Task 25: E2E test: Bot conversation flow [medium]
鈹溾攢鈹€ Task 26: E2E test: Moments publish + like + comment [medium]
鈹溾攢鈹€ Task 27: E2E test: Group chat @mention flow [medium]
鈹溾攢鈹€ Task 28: E2E test: Scheduled task CRUD [medium]
鈹溾攢鈹€ Task 29: E2E test: Profile settings update [medium]
鈹斺攢鈹€ Task 30: E2E test: Audit logs viewer [medium]

Wave FINAL (After ALL 鈥?4 parallel reviews, then user okay):
鈹溾攢鈹€ Task F1: Plan Compliance Audit (oracle)
鈹溾攢鈹€ Task F2: Code Quality Review (unspecified-high)
鈹溾攢鈹€ Task F3: Real Manual QA (unspecified-high + playwright)
鈹斺攢鈹€ Task F4: Scope Fidelity Check (deep)
```

**Critical Path**: Task 1 鈫?Task 2 鈫?Task 5 鈫?Task 6 鈫?Task 7 鈫?Task 15 鈫?Wave FINAL
**Parallel Speedup**: ~60% faster than sequential

### Agent Dispatch Summary

- **Wave 1**: 5 tasks 鈥?T1鈫抈deep`, T2鈫抈deep`, T3鈫抈medium`, T4鈫抈medium`, T5鈫抈medium`
- **Wave 2**: 9 tasks 鈥?T6鈫抈deep`, T7鈫抈deep`, T8鈫抈deep`, T9鈫抈medium`, T10鈫抈deep`, T11鈫抈medium`, T12鈫抈medium`, T13鈫抈medium`, T14鈫抈medium`
- **Wave 3**: 5 tasks 鈥?T15鈫抈deep`, T16鈫抈deep`, T17鈫抈deep`, T18鈫抈medium`, T19鈫抈medium`
- **Wave 4**: 11 tasks 鈥?T20鈫抈quick`, T21鈫抈quick`, T22鈫抈medium`, T23鈫抈medium`, T24鈫抈quick`, T25-T30鈫抈medium`
- **Wave FINAL**: 4 tasks 鈥?F1鈫抈oracle`, F2鈫抈unspecified-high`, F3鈫抈unspecified-high`, F4鈫抈deep`

---

## TODOs

### Wave 1: Module 1 鈥?Auth & Security Infrastructure

- [x] 1. Extract auth middleware to middleware.ts

  **What to do**:
  - Create `src/middleware.ts` with Next.js Edge-compatible middleware
  - Extract `verifyToken()` call pattern from ALL 26 API routes into centralized `verifyAuth()` middleware function
  - Configure matcher to exclude `/api/auth/login`, `/api/auth/register`, `/api/auth/logout`
  - Remove individual `verifyToken()` calls from each route handler (keep in `auth-utils.ts` for direct usage in Socket.IO)
  - Ensure middleware returns 401 JSON (`{ error: "鏈櫥褰?, code: "UNAUTHORIZED" }`) for unauthenticated requests
  - TDD: Write test first 鈥?middleware returns 401 without token, 200 with valid token
  - Handle edge case: expired JWT 鈫?401; malformed token 鈫?401; missing Authorization header 鈫?401

  **Must NOT do**:
  - Do NOT modify auth-utils.ts `verifyToken` function (Socket.IO still uses it)
  - Do NOT change JWT format or cookie structure (that's Task 2)

  **Recommended Agent Profile**:
  > Backend auth infrastructure task. Needs deep understanding of Next.js middleware and JWT flow.
  - **Category**: `deep`
    - Reason: Cross-cutting architectural change touching 26 route files; requires careful migration to avoid breaking existing auth
  - **Skills**: [`backend-patterns`, `security-review`]
    - `backend-patterns`: Next.js middleware patterns and API route conventions
    - `security-review`: JWT verification, auth bypass prevention
  - **Skills Evaluated but Omitted**:
    - `frontend-patterns`: No UI changes involved
    - `tdd-workflow`: TDD approach is already specified in plan

  **Parallelization**:
  - **Can Run In Parallel**: NO (Blocks Task 2-5)
  - **Parallel Group**: Wave 1, sequential
  - **Blocks**: Task 2 (JWT hardening), Task 5 (CSRF cleanup)
  - **Blocked By**: None (can start immediately)

  **References**:
  - `src/lib/auth-utils.ts:verifyToken()` 鈥?Current token verification logic to extract into middleware
  - `src/app/api/messages/route.ts:30-34` 鈥?Example of how verifyToken is called per-route (pattern to remove)
  - `src/app/api/auth/login/route.ts` 鈥?Login endpoint (must be excluded from middleware matcher)
  - `src/app/api/auth/register/route.ts` 鈥?Register endpoint (must be excluded)
  - `src/app/api/auth/logout/route.ts` 鈥?Logout endpoint (must be excluded)

  **Acceptance Criteria**:
  - [ ] `src/middleware.ts` file exists with `verifyAuth` middleware function
  - [ ] Test file `src/middleware.test.ts` created
  - [ ] `vitest run src/middleware.test.ts` 鈫?PASS (tests: valid token 鈫?200, no token 鈫?401, expired token 鈫?401, malformed token 鈫?401)
  - [ ] All 24 protected API routes NO LONGER call `verifyToken()` inline (verified by grep)
  - [ ] `pnpm run ts-check` 鈫?zero errors

  **QA Scenarios**:

  ```
  Scenario: Happy path 鈥?authenticated request passes middleware
    Tool: Bash (curl)
    Preconditions: Valid JWT token from login endpoint
    Steps:
      1. Login: curl -X POST http://localhost:5000/api/auth/login -H "Content-Type: application/json" -d '{"qq_number":"10001","password":"123456"}' 鈫?capture Set-Cookie qq_token
      2. Request protected route: curl http://localhost:5000/api/user -H "Cookie: qq_token=<captured>" 
      3. Assert status code is 200 (not 401)
    Expected Result: HTTP 200 with user data
    Failure Indicators: HTTP 401 鈥?middleware blocking valid requests
    Evidence: .sisyphus/evidence/task-1-auth-success.txt

  Scenario: Failure 鈥?unauthenticated request rejected
    Tool: Bash (curl)
    Preconditions: No valid auth cookie/header
    Steps:
      1. curl http://localhost:5000/api/user
      2. Assert status code is 401
      3. Assert response body contains {"error":"鏈櫥褰?,"code":"UNAUTHORIZED"}
    Expected Result: HTTP 401 with UNAUTHORIZED code
    Failure Indicators: HTTP 200 (bypass) or HTTP 500 (middleware crash)
    Evidence: .sisyphus/evidence/task-1-auth-fail.txt
  ```

  **Commit**: YES
  - Message: `feat(auth): extract centralized auth middleware to middleware.ts`
  - Files: `src/middleware.ts`, `src/middleware.test.ts`, all modified API routes
  - Pre-commit: `pnpm test`

- [x] 2. JWT + CSRF hardening (HttpOnly cookie migration)

  **What to do**:
  - Remove JWT from `localStorage` (currently stored as `qq_token` 鈥?visible to all JS)
  - Ensure JWT is ONLY in HttpOnly cookie (enforced in `auth-utils.ts` `generateToken`)
  - Remove CSRF token from `localStorage` (`qq_csrf_token`) 鈥?CSRF becomes server-only validation
  - Update `auth-context.tsx`: remove `localStorage.setItem/getItem` for `qq_token` and `qq_csrf_token`
  - Update `api.ts`: remove `Authorization: Bearer ${token}` header (cookie handles auth)
  - Update login response: return user info WITHOUT token in body (token is cookie-only)
  - TDD: Write test verifying token is NOT in localStorage after login; verify cookie is HttpOnly
  - Handle edge case: existing localStorage tokens should be cleared on upgrade

  **Must NOT do**:
  - Do NOT change JWT secret generation (keep using `JWT_SECRET` env var)
  - Do NOT remove the dev fallback 鈥?instead throw error in production if JWT_SECRET missing
  - Do NOT break socket-client auth (Socket.IO still sends token in `auth.token`)

  **Recommended Agent Profile**:
  > Security-critical auth migration. Needs careful handling of cookie settings and client-side cleanup.
  - **Category**: `deep`
    - Reason: Breaking change affecting all auth flows; requires precise cookie configuration and migration logic
  - **Skills**: [`security-review`, `coding-standards`]
    - `security-review`: HttpOnly/Secure/SameSite cookie configuration, JWT best practices
    - `coding-standards`: Consistent error handling and TypeScript patterns

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Task 1)
  - **Parallel Group**: Wave 1, sequential
  - **Blocks**: Task 4 (AuthContext error fix)
  - **Blocked By**: Task 1 (middleware extraction)

  **References**:
  - `src/lib/auth-utils.ts:16` 鈥?Hardcoded JWT dev fallback `'qq-chat-dev-secret-only'` (must guard with env check)
  - `src/lib/auth-utils.ts:generateToken()` 鈥?Function generating JWT with cookie settings
  - `src/lib/auth-context.tsx:31-36` 鈥?localStorage token read/write (must remove)
  - `src/lib/api.ts:18` 鈥?Authorization header injection (must remove)
  - `src/lib/auth-context.tsx:54` 鈥?CSRF token localStorage read (must remove)
  - `src/lib/csrf.ts` 鈥?CSRF generation/verification (keep server-side)

  **Acceptance Criteria**:
  - [ ] Test file `src/lib/auth-migration.test.ts` created
  - [ ] `vitest run src/lib/auth-migration.test.ts` 鈫?PASS (tests: token not in localStorage, cookie is HttpOnly+Secure+SameSite, old localStorage tokens cleared)
  - [ ] `localStorage.getItem('qq_token')` returns `null` after login (verify via browser/Playwright)
  - [ ] `localStorage.getItem('qq_csrf_token')` returns `null` after login
  - [ ] Login response body does NOT contain `token` or `csrf_token` fields
  - [ ] Socket.IO connection still works (token sent via `auth.token` in handshake)

  **QA Scenarios**:

  ```
  Scenario: Login stores JWT exclusively in HttpOnly cookie
    Tool: Playwright (playwright skill)
    Preconditions: Fresh browser context (no existing cookies/localStorage)
    Steps:
      1. Navigate to http://localhost:5000/login
      2. Fill QQ number: "10001", Password: "123456"
      3. Click "鐧诲綍" button
      4. Wait for redirect to /app
      5. Execute: localStorage.getItem('qq_token') 鈫?should be null
      6. Execute: document.cookie 鈫?should NOT contain 'qq_token' (HttpOnly invisible to JS)
    Expected Result: localStorage empty, cookie set as HttpOnly
    Failure Indicators: Token visible in localStorage or document.cookie
    Evidence: .sisyphus/evidence/task-2-jwt-httponly.png

  Scenario: Old localStorage tokens cleared on page load
    Tool: Playwright
    Preconditions: Manually set localStorage qq_token and qq_csrf_token
    Steps:
      1. Navigate to http://localhost:5000/app
      2. Wait for auth initialization
      3. Execute: localStorage.getItem('qq_token') 鈫?should be null or cleared
      4. Execute: localStorage.getItem('qq_csrf_token') 鈫?should be null or cleared
    Expected Result: Old tokens cleared automatically
    Failure Indicators: Old tokens remain in localStorage
    Evidence: .sisyphus/evidence/task-2-old-tokens-cleared.png
  ```

  **Commit**: YES
  - Message: `security(auth): migrate JWT+CSRF to HttpOnly cookie, remove from localStorage`
  - Files: `src/lib/auth-context.tsx`, `src/lib/api.ts`, `src/lib/auth-utils.ts`, `src/app/api/auth/login/route.ts`
  - Pre-commit: `pnpm test`

- [x] 3. TDD tests for auth API routes

  **What to do**:
  - Review existing tests: `auth/login/route.test.ts`, `auth/register/route.test.ts`, `auth/logout/route.test.ts`, `auth/verify/route.test.ts`
  - Verify existing tests still pass after Task 1+2 changes (update mocks as needed)
  - Add missing test cases:
    - Login: brute force protection (rate limit 5/min/IP 鈫?429), empty/invalid JSON body
    - Register: duplicate QQ number 鈫?409, password too short 鈫?400, auto-friend bot on success
    - Logout: add auth check 鈫?401 without token, add CSRF check 鈫?403 without CSRF
    - Verify: expired token 鈫?`authenticated: false`, missing token 鈫?`authenticated: false`
  - TDD: Write failing tests for each missing case FIRST, then verify they pass

  **Must NOT do**:
  - Do NOT rewrite passing tests 鈥?only add missing test cases
  - Do NOT change API response format (keep existing contract)

  **Recommended Agent Profile**:
  > Test completion task for auth module. Focused on adding edge case coverage.
  - **Category**: `deep`
    - Reason: Requires understanding of auth security edge cases and rate limiting mechanics
  - **Skills**: [`tdd-workflow`, `security-review`]
    - `tdd-workflow`: Structured RED-GREEN-REFACTOR for test-first approach
    - `security-review`: Auth edge case identification (rate limiting, brute force, CSRF)

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 4, after Task 2)
  - **Parallel Group**: Wave 1 (with Task 4, Task 5)
  - **Blocks**: None
  - **Blocked By**: Task 2 (JWT migration must be complete)

  **References**:
  - `src/app/api/auth/login/route.test.ts` 鈥?Existing login tests
  - `src/app/api/auth/register/route.test.ts` 鈥?Existing register tests
  - `src/app/api/auth/logout/route.test.ts` 鈥?Existing logout tests
  - `src/app/api/auth/verify/route.test.ts` 鈥?Existing verify tests
  - `src/lib/test-utils.ts:createAuthenticatedRequest()` 鈥?Test helper for authenticated requests
  - `src/lib/validation.ts:loginSchema,registerSchema` 鈥?Zod schemas for input validation

  **Acceptance Criteria**:
  - [ ] All 4 existing auth route test files still pass
  - [ ] New test cases added (count: 鈮?8 new test cases across 4 files)
  - [ ] `vitest run src/app/api/auth/` 鈫?all tests PASS
  - [ ] Coverage: auth routes 鈮?80%

  **QA Scenarios**:

  ```
  Scenario: Rate limit enforced on login attempts
    Tool: Bash (curl)
    Preconditions: Clean rate limit state
    Steps:
      1. Send 6 rapid POST /api/auth/login requests (within 60s)
      2. Assert first 5 return HTTP 200 or 401 (not 429)
      3. Assert 6th request returns HTTP 429 with Retry-After header
    Expected Result: 429 Too Many Requests after exceeding 5/min limit
    Failure Indicators: All requests succeed (rate limit not working)
    Evidence: .sisyphus/evidence/task-3-rate-limit-login.txt

  Scenario: Duplicate registration rejected
    Tool: Bash (curl)
    Preconditions: Existing user qq_number=10001
    Steps:
      1. POST /api/auth/register with {"qq_number":"10001","nickname":"Dup","password":"123456"}
      2. Assert HTTP status is 409
      3. Assert error message contains "宸插瓨鍦? or "already exists"
    Expected Result: HTTP 409 Conflict
    Failure Indicators: HTTP 200 (duplicate created) or HTTP 500 (server error)
    Evidence: .sisyphus/evidence/task-3-dup-register.txt
  ```

  **Commit**: YES
  - Message: `test(auth): add edge case coverage for login/register/logout/verify routes`
  - Files: All 4 auth route test files
  - Pre-commit: `pnpm test src/app/api/auth/`

- [x] 4. Fix AuthContext login() error propagation bug

  **What to do**:
  - Fix: `auth-context.tsx:82-101` 鈥?the `finally { setIsLoading(false) }` block runs before thrown errors propagate to caller
  - Restructure: move `setIsLoading(false)` to `then()` block for success path, keep in `catch()` for error path
  - Ensure: LoginPage catch handler receives the `Error` object (not stale state)
  - Ensure: `isLoading` returns to `false` in BOTH success and error cases
  - TDD: Write test 鈥?login fail 鈫?LoginPage catches error AND `isLoading` is false

  **Must NOT do**:
  - Do NOT change the public API of `login()` and `register()` functions (return types, parameters)
  - Do NOT touch unrelated AuthContext logic (token storage, getUser, logout)

  **Recommended Agent Profile**:
  > React state management bug fix. Requires understanding of async error propagation in React.
  - **Category**: `medium`
    - Reason: Single file, focused fix with clear failure pattern
  - **Skills**: [`coding-standards`]
    - `coding-standards`: Proper async error handling patterns

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 3 and Task 5, after Task 2)
  - **Parallel Group**: Wave 1 (with Task 3, Task 5)
  - **Blocks**: None
  - **Blocked By**: Task 2 (auth-context.tsx modified by JWT migration)

  **References**:
  - `src/lib/auth-context.tsx:82-101` 鈥?`login()` function with buggy finally block
  - `src/lib/auth-context.tsx:103-122` 鈥?`register()` function (same pattern, fix both)
  - `src/app/login/page.tsx:33-42` 鈥?LoginPage catch handler that currently fails to catch errors

  **Acceptance Criteria**:
  - [ ] Test file `src/lib/auth-context.test.tsx` created
  - [ ] `vitest run src/lib/auth-context.test.tsx` 鈫?PASS (tests: login success鈫抜sLoading false, login fail鈫抏rror caught+isLoading false)
  - [ ] LoginPage displays error message when login fails (not just generic "鐧诲綍澶辫触")
  - [ ] LoginPage submit button re-enabled after failed login attempt

  **QA Scenarios**:

  ```
  Scenario: Login failure shows error and re-enables button
    Tool: Playwright
    Preconditions: Start at /login
    Steps:
      1. Fill QQ number: "99999" (non-existent), Password: "wrong"
      2. Click "鐧诲綍" button
      3. Wait for error banner to appear (`.text-red-500` or error container)
      4. Assert submit button is NOT disabled
      5. Assert can click submit again
    Expected Result: Error message visible, button re-enabled
    Failure Indicators: Button stays disabled forever (stuck loading), no error shown
    Evidence: .sisyphus/evidence/task-4-login-error.png
  ```

  **Commit**: YES
  - Message: `fix(auth): correct error propagation in login/register functions`
  - Files: `src/lib/auth-context.tsx`
  - Pre-commit: `pnpm test src/lib/auth-context.test.tsx`

- [x] 5. CSRF protection for currently unprotected endpoints

  **What to do**:
  - Add CSRF verification to these 5 unprotected state-changing endpoints:
    - `POST /api/auth/logout` 鈥?add auth check + CSRF verify
    - `POST /api/moments/like` 鈥?add CSRF verify (zod schema exists but unused)
    - `POST /api/moments/comment` 鈥?add CSRF verify (zod schema exists but unused)
    - `PUT /api/settings` 鈥?add CSRF verify + key whitelist validation
    - `POST /api/bot/stream` 鈥?add CSRF verify
  - TDD: Write test for each endpoint 鈥?request without CSRF token 鈫?403
  - Use existing `verifyCsrfToken()` from `src/lib/csrf.ts`
  - Use existing Zod schemas from `validation.ts` where defined (momentCommentSchema, momentLikeSchema, updateSettingsSchema)

  **Must NOT do**:
  - Do NOT change the CSRF mechanism (keep HMAC-SHA256 approach from csrf.ts)
  - Do NOT add CSRF to GET endpoints
  - Do NOT break existing CSRF-protected endpoints

  **Recommended Agent Profile**:
  > Security hardening task. Requires adding CSRF checks to 5 endpoints.
  - **Category**: `medium`
    - Reason: Pattern-based work across 5 endpoints; each follows the same template
  - **Skills**: [`security-review`]
    - `security-review`: CSRF protection patterns, endpoint security classification

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 3 and Task 4, after Task 2)
  - **Parallel Group**: Wave 1 (with Task 3, Task 4)
  - **Blocks**: None
  - **Blocked By**: Task 2 (CSRF mechanism may change with JWT migration)

  **References**:
  - `src/lib/csrf.ts:verifyCsrfToken()` 鈥?CSRF verification function
  - `src/lib/csrf.ts:extractCsrfToken()` 鈥?Extract CSRF token from header
  - `src/app/api/messages/route.ts:35-38` 鈥?Example of CSRF check pattern (follow this template)
  - `src/app/api/auth/logout/route.ts` 鈥?Logout endpoint (currently no auth/CSRF)
  - `src/app/api/moments/like/route.ts` 鈥?Like endpoint (missing CSRF)
  - `src/app/api/moments/comment/route.ts` 鈥?Comment endpoint (missing CSRF)
  - `src/app/api/settings/route.ts` 鈥?Settings endpoint (missing CSRF)
  - `src/app/api/bot/stream/route.ts` 鈥?Bot stream endpoint (missing CSRF)
  - `src/lib/validation.ts:momentLikeSchema,momentCommentSchema,updateSettingsSchema` 鈥?Zod schemas to use

  **Acceptance Criteria**:
  - [ ] All 5 endpoints return 403 when X-CSRF-Token header missing/invalid
  - [ ] All 5 endpoints return 200 when X-CSRF-Token header valid
  - [ ] Test files updated: logout route test, moments/like test, moments/comment test
  - [ ] `vitest run` 鈫?all affected tests PASS

  **QA Scenarios**:

  ```
  Scenario: POST /api/moments/like rejected without CSRF
    Tool: Bash (curl)
    Preconditions: Valid auth cookie, no CSRF header
    Steps:
      1. Login to get auth cookie: curl -X POST localhost:5000/api/auth/login -H "Content-Type: application/json" -d '{"qq_number":"10001","password":"123456"}' -c cookies.txt
      2. Request like without CSRF: curl -X POST localhost:5000/api/moments/like -H "Content-Type: application/json" -d '{"moment_id":1}' -b cookies.txt
      3. Assert HTTP status is 403
    Expected Result: HTTP 403 Forbidden
    Failure Indicators: HTTP 200 (CSRF bypass)
    Evidence: .sisyphus/evidence/task-5-csrf-like-rejected.txt

  Scenario: POST /api/moments/like accepted WITH valid CSRF
    Tool: Bash (curl)
    Preconditions: Valid auth cookie + fresh CSRF token
    Steps:
      1. Login to get cookie + CSRF: curl .../api/auth/login 鈫?capture csrf_token from response
      2. Request like with CSRF: curl -X POST .../api/moments/like -H "X-CSRF-Token: <captured>" -d '{"moment_id":1}' -b cookies.txt
      3. Assert HTTP status is 200
    Expected Result: HTTP 200 OK
    Failure Indicators: HTTP 403 (CSRF check too broad)
    Evidence: .sisyphus/evidence/task-5-csrf-like-accepted.txt
  ```

  **Commit**: YES
  - Message: `security(csrf): add CSRF protection to 5 unprotected endpoints`
  - Files: `logout/route.ts`, `moments/like/route.ts`, `moments/comment/route.ts`, `settings/route.ts`, `bot/stream/route.ts`
  - Pre-commit: `pnpm test`

---

---

### Wave 2: Modules 2-3 鈥?Chat & Friends/Moments

- [x] 6. Fix dual chat routing architecture

  **What to do**:
  - Problem: `/app` (SPA state) and `/app/chat/[id]` (standalone page) have separate, unsynchronized chat implementations
  - Solution: Make `/app/chat/[id]` the canonical route; remove SPA state from `/app` page
  - Update `src/app/app/page.tsx`: remove `chatTarget` state, always render ChatList
  - Update ChatList `onSelectChat`: use `router.push('/app/chat/${id}')` instead of `setChatTarget()`
  - Update FriendsPage: route to `/app/chat/[id]` for starting chat (already does this)
  - Ensure ChatWindow in `/app/chat/[id]/page.tsx` handles all chat types (private, group, bot)
  - TDD: Write test verifying both routes render identical message data for same conversation

  **Must NOT do**:
  - Do NOT remove ChatWindow from chat/[id] page 鈥?it's the canonical location
  - Do NOT break the existing bot conversation flow
  - Do NOT remove `onSelectChat` prop from chat-list (backward compatibility)

  **Recommended Agent Profile**:
  > Architecture consolidation task. Merges two competing routing patterns.
  - **Category**: `deep`
    - Reason: Architectural change affecting 3+ pages and component prop contracts
  - **Skills**: [`frontend-patterns`, `coding-standards`]
    - `frontend-patterns`: Next.js App Router routing patterns, SPA vs page-based navigation
    - `coding-standards`: Clean component extraction and prop management

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Task 1-5 auth hardening)
  - **Parallel Group**: Wave 2, sequential entry point
  - **Blocks**: Task 7 (race condition fix depends on routing consolidation)
  - **Blocked By**: Task 5 (CSRF hardening must be complete)

  **References**:
  - `src/app/app/page.tsx:18-25` 鈥?Current dual-state approach
  - `src/app/app/chat/[id]/page.tsx` 鈥?Standalone chat page (canonical location)
  - `src/components/chat-list.tsx:onSelectChat` 鈥?Chat selection callback to update

  **Acceptance Criteria**:
  - [ ] `/app/page.tsx` no longer renders ChatWindow directly
  - [ ] ChatList click navigates to `/app/chat/[id]` via `router.push()`
  - [ ] `/app/chat/[id]` correctly renders ALL chat types (private, group, bot)
  - [ ] Both routes show identical messages for same conversation (verified via test)
  - [ ] Test file `src/app/app/chat-routing.test.tsx` created

  **QA Scenarios**:

  ```
  Scenario: Clicking friend in chat list navigates to dedicated chat page
    Tool: Playwright
    Preconditions: Logged in, friend list loaded
    Steps:
      1. Navigate to /app
      2. Wait for chat list to load
      3. Click on a friend in the chat list
      4. Assert URL changes to /app/chat/<friendId>
      5. Assert ChatWindow renders with friend name
    Expected Result: Navigation to dedicated chat page with correct friend
    Failure Indicators: URL stays at /app, chat window not rendered
    Evidence: .sisyphus/evidence/task-6-chat-navigation.png

  Scenario: Direct URL /app/chat/[id] works without /app first
    Tool: Playwright
    Preconditions: Logged in
    Steps:
      1. Navigate directly to /app/chat/<valid-conversation-id>
      2. Assert ChatWindow renders with messages
      3. Assert no white screen or loading error
    Expected Result: Chat loads correctly from direct URL
    Failure Indicators: White screen, 404, or missing Sidebar
    Evidence: .sisyphus/evidence/task-6-direct-chat-url.png
  ```

  **Commit**: YES
  - Message: `refactor(chat): consolidate dual routing to single /app/chat/[id] canonical route`
  - Files: `src/app/app/page.tsx`, `src/components/chat-list.tsx`
  - Pre-commit: `pnpm test`

- [x] 7. Fix useMessages race condition (double fetchMessages)

  **What to do**:
  - Problem: `useMessages` hook (hooks.ts:132) calls `fetchMessages()` in its own effect AND ChatWindow (chat-window.tsx:105) calls it separately
  - Solution: Make `useMessages` the single source of truth; ChatWindow consumes data from hook, never calls `fetchMessages` directly
  - In hooks.ts: consolidate `fetchMessages` to run ONLY from the WebSocket subscription effect
  - In chat-window.tsx: remove the `useEffect` that calls `fetchMessages` on conversationId change
  - Add a shared `fetchMessagesRef` to prevent duplicate calls when WebSocket event fires simultaneously
  - TDD: Write test 鈥?conversationId change triggers exactly 1 API call, not 2

  **Must NOT do**:
  - Do NOT remove the WebSocket subscription (keep real-time message delivery)
  - Do NOT change the public API of `useMessages` hook

  **Recommended Agent Profile**:
  > Race condition fix in custom hook. Requires understanding of React useEffect timing.
  - **Category**: `deep`
    - Reason: Subtle race condition requiring careful refactoring of effect dependencies
  - **Skills**: [`frontend-patterns`, `coding-standards`]

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 9, after Task 6)
  - **Parallel Group**: Wave 2 (after Task 6)
  - **Blocks**: Task 8 (messages route tests depend on stable API)
  - **Blocked By**: Task 6 (routing consolidation)

  **References**:
  - `src/lib/hooks.ts:122-159` 鈥?useMessages hook with WebSocket + fetchMessages effect
  - `src/components/chat-window.tsx:105-110` 鈥?Duplicate fetchMessages call in ChatWindow useEffect
  - `src/lib/socket-client.ts:onNewMessage` 鈥?WebSocket message handler that triggers re-fetch

  **Acceptance Criteria**:
  - [ ] Test file `src/lib/hooks-race-condition.test.ts` created
  - [ ] `vitest run src/lib/hooks-race-condition.test.ts` 鈫?PASS
  - [ ] ChatWindow receives messages without calling `fetchMessages` directly
  - [ ] WebSocket message delivery still works (online users get real-time messages)

  **QA Scenarios**:

  ```
  Scenario: Changing conversation fetches once (network tab verification)
    Tool: Playwright
    Preconditions: Logged in, network interception enabled
    Steps:
      1. Navigate to /app/chat/conversation-A
      2. Record number of GET /api/messages requests
      3. Navigate to /app/chat/conversation-B
      4. Assert exactly 1 new GET /api/messages request was made (not 2)
    Expected Result: Single API call per conversation change
    Failure Indicators: 2+ GET /api/messages calls visible in network tab
    Evidence: .sisyphus/evidence/task-7-single-fetch.png
  ```

  **Commit**: YES
  - Message: `fix(chat): eliminate double fetchMessages race condition in useMessages`
  - Files: `src/lib/hooks.ts`, `src/components/chat-window.tsx`
  - Pre-commit: `pnpm test src/lib/hooks-race-condition.test.ts`

- [x] 8. TDD tests for messages/route.ts (most complex route)
- [x] 9. Add conversation ownership validation
- [x] 10. Moments privacy/visibility control TDD
- [x] 11. Fix upload fake success URL + TDD
- [x] 13. Friend list dedup + unique constraint
- [x] 14. Extract Sidebar to AppLayout (de-duplicate 7 pages)

  **What to do**: Move Sidebar rendering from 7 page files into `src/app/app/layout.tsx`
  **Must NOT do**: Do NOT change Sidebar functionality
  **Recommended Agent Profile**: `medium` with `frontend-patterns`
  **Parallelization**: YES with Tasks 8-13

  **Acceptance Criteria**:
  - [ ] Sidebar rendered in AppLayout (not individual pages)
  - [ ] 7 page files no longer import/render Sidebar directly
  - [ ] All pages still show Sidebar on desktop and MobileNav on mobile

  **QA Scenarios**:

  ```
  Scenario: Sidebar visible on all /app/* pages
    Tool: Playwright
    Steps:
      1. Navigate to each: /app, /app/chat/1, /app/friends, /app/moments, /app/profile, /app/scheduled-tasks, /app/audit-logs
      2. For each: assert Sidebar is visible, navigation links functional
    Evidence: .sisyphus/evidence/task-14-sidebar-consistency.png
  ```

  **Commit**: YES 鈥?Message: `refactor(layout): extract Sidebar/MobileNav to AppLayout, remove from 7 pages`

---

### Wave 3: Modules 4-5 鈥?Bot & Tasks

- [x] 15. Bot execute_tool CSRF fix + confirmation gate

  **What to do**:
  - Problem: `bot/route.ts:2140-2148` 鈥?`execute_tool` early-return runs BEFORE CSRF check at line 2167
  - Move CSRF check to TOP of POST handler (before any branching)
  - Add mandatory `confirmation_id` for high-risk tools (delete_friend, leave_group, edit_moment, delete_moment)
  - Fix: tools can only be executed through the preview鈫抍onfirm flow, never directly
  - TDD: Write test 鈥?POST /api/bot with execute_tool and no CSRF 鈫?403; with CSRF but no confirmation 鈫?400

  **Must NOT do**:
  - Do NOT break the existing bot flow (preview鈫抍onfirm should still work)
  - Do NOT change the tool function signatures

  **Recommended Agent Profile**:
  > Critical security fix in the most complex file. Requires careful code path analysis.
  - **Category**: `deep`
    - Reason: 2297-line file with multiple code paths; CSRF must be at the right position
  - **Skills**: [`security-review`]
    - `security-review`: CSRF bypass prevention, authorization gates

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Wave 1-2 security fixes)
  - **Parallel Group**: Wave 3, sequential entry
  - **Blocks**: Task 16 (bot tests depend on fixed security)
  - **Blocked By**: Task 5 (CSRF infrastructure), Task 7 (chat fixes)

  **References**:
  - `src/app/api/bot/route.ts:2140-2148` 鈥?execute_tool early-return that bypasses CSRF
  - `src/app/api/bot/route.ts:2167-2169` 鈥?CSRF check that comes TOO LATE
  - `src/app/api/bot/route.ts:400-450` 鈥?Preview confirmation flow (keep this pattern)
  - `src/app/api/bot/route.test.ts` 鈥?Existing bot tests

  **Acceptance Criteria**:
  - [ ] CSRF check at TOP of POST /api/bot handler (before any branching)
  - [ ] execute_tool with high-risk tool 鈫?requires confirmation_id 鈫?verified
  - [ ] execute_tool without CSRF 鈫?403
  - [ ] execute_tool without confirmation for high-risk 鈫?400
  - [ ] Test file updated: `bot/route.test.ts` with CSRF bypass test

  **QA Scenarios**:

  ```
  Scenario: execute_tool delete_friend blocked without confirmation
    Tool: Bash (curl)
    Preconditions: Valid auth cookie + CSRF token, no confirmation_id
    Steps:
      1. POST /api/bot with {"execute_tool":true,"tool":"delete_friend","params":{"friend_id":10002}}
      2. Assert HTTP status is 400
      3. Assert error mentions "confirmation_id" or "闇€瑕佺‘璁?
    Expected Result: HTTP 400, tool not executed
    Failure Indicators: HTTP 200 (friend deleted without confirmation)
    Evidence: .sisyphus/evidence/task-15-execute-tool-blocked.txt

  Scenario: bot request without CSRF rejected
    Tool: Bash (curl)
    Preconditions: Valid auth cookie, no CSRF header
    Steps:
      1. POST /api/bot with valid message body, no X-CSRF-Token header
      2. Assert HTTP status is 403
    Expected Result: HTTP 403 Forbidden
    Failure Indicators: HTTP 200 (CSRF bypass)
    Evidence: .sisyphus/evidence/task-15-bot-csrf-rejected.txt
  ```

  **Commit**: YES
  - Message: `security(bot): fix execute_tool CSRF bypass 鈥?enforce confirmation gate for high-risk tools`
  - Files: `src/app/api/bot/route.ts`
  - Pre-commit: `pnpm test src/app/api/bot/`

- [x] 16. Bot AI agent contract tests (mock OpenAI)
- [x] 17. TDD tests for scheduler.ts
- [x] 18. Rate limiting for unprotected endpoints
- [x] 19. Settings key whitelist + TDD

  **What to do**:
  - Problem: `PUT /api/settings` allows writing ANY key 鈥?user can override `bot_memory`, `bot_identity`, etc.
  - Add key whitelist: only allow `['theme', 'language', 'notification_enabled', 'avatar_color']` (user-facing settings)
  - Block write access to internal keys: `bot_*`, `memory_*`, `tasks_*`
  - Use `updateSettingsSchema` from validation.ts (currently defined but UNUSED)
  - TDD: Write test 鈥?PUT with internal key 'bot_identity' 鈫?400/403

  **Must NOT do**:
  - Do NOT remove existing settings 鈥?just restrict which keys can be written
  - Do NOT change GET behavior (read all settings is fine for the user's own data)

  **Recommended Agent Profile**:
  > Settings security hardening. Simple whitelist addition.
  - **Category**: `medium`
    - Reason: Adding validation to existing endpoint with defined whitelist
  - **Skills**: [`security-review`]

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 16, Task 17, Task 18)
  - **Parallel Group**: Wave 3
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `src/app/api/settings/route.ts:108` 鈥?PUT handler accepting any key
  - `src/lib/validation.ts:updateSettingsSchema` 鈥?Zod schema defined but unused
  - `src/app/api/settings/route.test.ts` 鈥?Existing settings tests

  **Acceptance Criteria**:
  - [ ] `updateSettingsSchema` includes key whitelist validation
  - [ ] PUT with internal key (bot_*) 鈫?400
  - [ ] PUT with allowed key (theme) 鈫?200
  - [ ] Test cases updated in `settings/route.test.ts`

  **QA Scenarios**:

  ```
  Scenario: Cannot write internal bot settings via PUT /api/settings
    Tool: Bash (curl)
    Preconditions: Valid auth + CSRF
    Steps:
      1. PUT /api/settings with {"key":"bot_identity","value":"hacked"}
      2. Assert HTTP status is 400
      3. Assert error message mentions "not allowed" or "涓嶅厑璁?
    Expected Result: HTTP 400, key rejected
    Failure Indicators: HTTP 200 (arbitrary key written)
    Evidence: .sisyphus/evidence/task-19-settings-whitelist.txt
  ```

  **Commit**: YES
  - Message: `security(settings): add key whitelist to prevent arbitrary settings writes`
  - Files: `src/app/api/settings/route.ts`, `src/lib/validation.ts`
  - Pre-commit: `pnpm test src/app/api/settings/`

---

### Wave 4: Module 6 鈥?Infrastructure Cleanup & E2E Completion

- [x] 20. Remove unused dependencies
- [x] 21. Clean unused code (hook, types, schemas)
- [x] 22. Install error boundaries for all routes
- [x] 23. Replace `<img>` with `next/image`
- [x] 24. Add ARIA labels to icon-only buttons
- [x] 25. E2E test: Bot conversation flow
- [x] 26. E2E test: Moments publish + like + comment
- [x] 27. E2E test: Group chat @mention flow
- [x] 28. E2E test: Scheduled task CRUD
- [x] 29. E2E test: Profile settings update
- [x] 30. E2E test: Audit logs viewer

  Create `e2e/audit-logs.spec.ts`. Cover: navigate 鈫?verify entries 鈫?paginate 鈫?expand details.
  **Recommended Agent Profile**: `medium` with `playwright` skill 路 **Parallelization**: YES
  **Commit**: YES 鈥?`test(e2e): add audit logs viewer flow test`

---
  - In chat-window.tsx: remove the `useEffect` that calls `fetchMessages` on conversationId change
  - Add a shared `fetchMessagesRef` to prevent duplicate calls when WebSocket event fires simultaneously
  - TDD: Write test 鈥?conversationId change triggers exactly 1 API call, not 2

  **Must NOT do**:
  - Do NOT remove the WebSocket subscription (keep real-time message delivery)
  - Do NOT change the public API of `useMessages` hook

  **Recommended Agent Profile**:
  > Race condition fix in custom hook. Requires understanding of React useEffect timing.
  - **Category**: `deep`
    - Reason: Subtle race condition requiring careful refactoring of effect dependencies
  - **Skills**: [`frontend-patterns`, `coding-standards`]
    - `frontend-patterns`: React hooks patterns, useEffect dependency management
    - `coding-standards`: Clean refactoring without breaking contract

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 9, after Task 6)
  - **Parallel Group**: Wave 2 (with Task 8 after Task 7, Task 9, Task 13, Task 14)
  - **Blocks**: Task 8 (messages route tests depend on stable API)
  - **Blocked By**: Task 6 (routing consolidation)

  **References**:
  - `src/lib/hooks.ts:122-159` 鈥?useMessages hook with WebSocket + fetchMessages effect
---

## Success Criteria

### Verification Commands
```bash
pnpm run ts-check        # Expected: zero errors
pnpm test                # Expected: all vitest tests pass, coverage 鈮?55%
pnpm test:e2e            # Expected: all 11 playwright specs pass
pnpm run lint            # Expected: zero eslint errors
```

### Final Checklist
- [ ] All Must Have items present and verified
- [ ] All Must NOT Have items confirmed absent
- [ ] Zero TypeScript errors
- [ ] All 34 existing + 15+ new vitest tests pass
- [ ] All 5 existing + 6 new E2E tests pass
- [ ] 3 unused dependencies removed from package.json
- [ ] Unused code (hook, types, schemas) removed or annotated
- [ ] JWT stored in HttpOnly cookie only
- [ ] CSRF enforced on all state-changing endpoints
- [ ] Bot execute_tool CSRF gate in place
