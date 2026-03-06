---
name: frontend-patterns
description: Frontend development patterns for React, Next.js, state management, performance optimization, and UI best practices.
---

# Frontend Development Patterns

## Component Patterns

### Composition Over Inheritance
Use compound components with Context for complex UI (Tabs, Accordion, Dropdown).
Prefer `children` prop and slot-based composition over deep prop drilling.

### Render Props / Children as Function
For data-loading wrappers: pass `(data, loading, error)` to children function.

## Custom Hooks

### Key Patterns
- **useToggle** — `[value, toggle]` for boolean state
- **useDebounce** — Debounce rapidly changing values (search input)
- **useQuery** — Async data fetching with `{ data, loading, error, refetch }`

### Rules
- Always prefix with `use`
- Return stable references (`useCallback` for returned functions)
- Handle cleanup in `useEffect` return

## State Management

### Context + Reducer
For domain state shared across components:
1. Define `State` interface and `Action` union type
2. Create reducer with immutable spread patterns
3. Wrap in Context Provider
4. Export `useXxx()` hook with context guard

### When to Use What
| Scope | Solution |
|-------|----------|
| Component-local | `useState` / `useReducer` |
| Subtree (2-5 components) | Context + Provider |
| Global / complex | Zustand or Redux Toolkit |

## Performance

### Memoization
- `useMemo` for expensive computations (sorting, filtering large arrays)
- `useCallback` for functions passed as props to memoized children
- `React.memo` for pure components that re-render unnecessarily

### Code Splitting
- `lazy()` + `Suspense` for heavy components (charts, editors, 3D)
- Route-level splitting in Next.js is automatic

### Virtualization
Use `@tanstack/react-virtual` for lists > 100 items.

## Form Handling

### Pattern
1. Controlled inputs with `useState` or `useForm`
2. Validate with Zod schema on submit
3. Show errors inline near the field
4. Disable submit button during async operation

## Error Boundaries
Wrap critical sections with ErrorBoundary component.
Log errors in `componentDidCatch`, show fallback UI.

## Animation
- Use Framer Motion `AnimatePresence` for enter/exit animations
- Keep durations 150-300ms for micro-interactions
- Use `transform` and `opacity` only (GPU-accelerated)
- Respect `prefers-reduced-motion`

## Accessibility
- Keyboard navigation: `ArrowDown/Up` for lists, `Escape` to close, `Enter` to select
- Focus management: trap focus in modals, restore on close
- ARIA: `role`, `aria-expanded`, `aria-haspopup`, `aria-modal`
