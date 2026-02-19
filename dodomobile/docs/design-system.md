# Dodo UI Design System

## 1. Design Principles
- Keep UI dense and readable for quick task capture.
- Prefer clean geometry over fully rounded "bubble" components.
- Use one accent color for focus/action and neutral surfaces for structure.
- Keep interactions obvious: primary actions are filled, secondary actions are outlined.

## 2. Color Tokens
- Background: `#0D0D0D`
- Surface: `#1A1A1A`
- Surface (raised): `#252525`
- Border: `#2A2A2A`
- Primary text: `#F5F5F5`
- Secondary text: `#E0E0E0`
- Muted text: `#888888`
- Accent: `#E8651A`
- Accent subtle: `rgba(232, 101, 26, 0.15)`
- Success: `#30A46C`
- Success subtle: `rgba(48, 164, 108, 0.15)`
- Danger: `#E5484D`
- Danger subtle: `rgba(229, 72, 77, 0.15)`
- Priority high: `#E5484D`
- Priority medium: `#F5A623`
- Priority low: `#30A46C`

## 3. Typography
- Family (default): `System`
- Weights:
- Regular text: `400-500`
- Labels + secondary controls: `600`
- Primary actions + key headings: `700`
- Hero/app title: `800`
- Sizes:
- `xs`: 11
- `sm`: 13
- `md`: 15
- `lg`: 18
- `xl`: 22
- `xxl`: 28

## 4. Spacing Scale
- `xs`: 4
- `sm`: 8
- `md`: 12
- `lg`: 16
- `xl`: 20
- `xxl`: 24

Usage rules:
- Internal control padding: `sm` to `md`
- Card padding: `md` to `lg`
- Section spacing: `lg` or `xl`
- Screen horizontal padding: `lg`

## 5. Radius Scale
- `sm`: 6
- `md`: 10
- `lg`: 14
- `xl`: 18

Usage rules:
- Inputs/chips: `md`
- Cards/modals: `lg`
- Bottom sheets: `lg` top corners
- Avoid pill radius by default.
- Use full round only for avatars or circular icon-only affordances that require it.

## 6. Component Standards
- Buttons:
- Primary: filled accent, white text, `md` radius.
- Secondary: surface background, border, muted/neutral text.
- Danger: danger subtle background + danger text/icon.
- Inputs:
- Surface raised background, 1px border, `md` radius.
- Category chips:
- Rectangular chips with `md` radius.
- Active state uses accent subtle background + accent border/text.
- Cards:
- Surface background, 1px border, `md` or `lg` radius.
- Keep icon badges small and square-rounded (`sm`).

## 7. Motion and Gestures
- Swipe gestures should reveal contextual actions with clear color coding:
- Right swipe: delete (danger)
- Left swipe: complete/undo (success)
- Keep swipe distances constrained to avoid overdraw and accidental triggers.
- Always spring card back to resting state if threshold is not met.

## 8. Accessibility and Contrast
- Body text must stay high-contrast on dark surfaces.
- Muted text is only for metadata, never for critical actions.
- Icon-only controls should be at least `28x28` touch targets.
- Primary tappable controls should be >= `44px` height where possible.

## 9. Layout Consistency
- Standard header:
- App title row with `lg` horizontal padding and compact bottom spacing.
- Lists:
- Use consistent top padding and `sm` vertical item gap.
- Bottom bars:
- 1px top border, same surface/background palette as screen.

## 10. Implementation Source
- Theme tokens are defined in `dodomobile/src/theme/colors.ts`.
- Reusable icon adapter is defined in `dodomobile/src/components/AppIcon.tsx`.
