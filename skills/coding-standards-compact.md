---
name: coding-standards-compact
description: Compact coding standards — core rules only, no verbose examples.
---

# Coding Standards (Compact)

## Principles
- **Readability first** — clear names, self-documenting code
- **KISS** — simplest solution that works
- **DRY** — extract common logic, no copy-paste
- **YAGNI** — don't build what's not needed yet

## TypeScript Rules
- Descriptive variable names (`marketSearchQuery`, not `q`)
- Verb-noun function names (`fetchMarketData`, `calculateSimilarity`)
- **Immutability**: Always `{ ...obj, key: val }` and `[...arr, item]` — NEVER mutate
- Comprehensive error handling with try/catch on all async ops
- Use `Promise.all()` for parallel async operations
- Proper types — no `any`

## React Rules
- Typed functional components with interface for props
- `useMemo` for expensive computations, `useCallback` for callbacks passed to children
- Functional state updates: `setCount(prev => prev + 1)`
- Clear conditional rendering: `{isLoading && <Spinner />}`

## API Design
- REST conventions: GET list, GET :id, POST create, PATCH update, DELETE remove
- Zod schema validation on all inputs
- Consistent response format: `{ success, data?, error?, meta? }`

## Code Quality
- Functions < 50 lines, files < 800 lines
- No deep nesting (> 4 levels) — use early returns
- Named constants instead of magic numbers
- No `console.log` in production code
- No hardcoded values
