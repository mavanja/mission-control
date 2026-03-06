---
name: ui-ux-pro-max
description: "UI/UX design intelligence. Styles, palettes, font pairings, charts, and stacks. Actions: plan, build, create, design, implement, review, fix, improve UI/UX code."
---

# UI/UX Pro Max - Design Intelligence

## Rule Categories by Priority

| Priority | Category | Impact |
|----------|----------|--------|
| 1 | Accessibility | CRITICAL |
| 2 | Touch & Interaction | CRITICAL |
| 3 | Performance | HIGH |
| 4 | Layout & Responsive | HIGH |
| 5 | Typography & Color | MEDIUM |
| 6 | Animation | MEDIUM |
| 7 | Style Selection | MEDIUM |

## Quick Reference

### 1. Accessibility (CRITICAL)
- `color-contrast` — Minimum 4.5:1 ratio for normal text
- `focus-states` — Visible focus rings on interactive elements
- `alt-text` — Descriptive alt text for meaningful images
- `aria-labels` — aria-label for icon-only buttons
- `keyboard-nav` — Tab order matches visual order
- `form-labels` — Use label with for attribute

### 2. Touch & Interaction (CRITICAL)
- `touch-target-size` — Minimum 44x44px touch targets
- `hover-vs-tap` — Use click/tap for primary interactions
- `loading-buttons` — Disable button during async operations
- `error-feedback` — Clear error messages near problem
- `cursor-pointer` — Add cursor-pointer to clickable elements

### 3. Performance (HIGH)
- `image-optimization` — Use WebP, srcset, lazy loading
- `reduced-motion` — Check prefers-reduced-motion
- `content-jumping` — Reserve space for async content

### 4. Layout & Responsive (HIGH)
- `viewport-meta` — width=device-width initial-scale=1
- `readable-font-size` — Minimum 16px body text on mobile
- `horizontal-scroll` — Ensure content fits viewport width
- `z-index-management` — Define z-index scale (10, 20, 30, 50)

### 5. Typography & Color (MEDIUM)
- `line-height` — Use 1.5-1.75 for body text
- `line-length` — Limit to 65-75 characters per line
- `font-pairing` — Match heading/body font personalities

### 6. Animation (MEDIUM)
- `duration-timing` — Use 150-300ms for micro-interactions
- `transform-performance` — Use transform/opacity, not width/height
- `loading-states` — Skeleton screens or spinners

## Common Rules for Professional UI

### Icons & Visual Elements
| Rule | Do | Don't |
|------|----|----- |
| **No emoji icons** | Use SVG icons (Heroicons, Lucide) | Use emojis as UI icons |
| **Stable hover** | Color/opacity transitions | Scale transforms that shift layout |
| **Consistent sizing** | Fixed viewBox (24x24) w-6 h-6 | Mix different icon sizes |

### Interaction & Cursor
| Rule | Do | Don't |
|------|----|----- |
| **Cursor pointer** | `cursor-pointer` on all clickable | Default cursor on interactive |
| **Smooth transitions** | `transition-colors duration-200` | Instant or >500ms changes |

### Light/Dark Mode
| Rule | Do | Don't |
|------|----|----- |
| **Glass light mode** | `bg-white/80` or higher | `bg-white/10` (too transparent) |
| **Text contrast** | `slate-900` for text | `slate-400` for body text |
| **Borders** | `border-gray-200` in light | `border-white/10` (invisible) |

## Pre-Delivery Checklist

### Visual Quality
- [ ] No emojis as icons (use SVG)
- [ ] Consistent icon set (Heroicons/Lucide)
- [ ] Hover states don't cause layout shift

### Interaction
- [ ] All clickable elements have `cursor-pointer`
- [ ] Transitions 150-300ms
- [ ] Focus states visible for keyboard nav

### Responsive
- [ ] Works at 375px, 768px, 1024px, 1440px
- [ ] No horizontal scroll on mobile

### Accessibility
- [ ] All images have alt text
- [ ] Form inputs have labels
- [ ] Color is not the only indicator
- [ ] `prefers-reduced-motion` respected
