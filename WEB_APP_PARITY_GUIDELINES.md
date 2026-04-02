# Web to Mobile Design Principle Parity Protocol

This document defines the required process for making dodoweb visually and behaviorally identical to dodomobile at the component level.

Primary priority is not implementation speed. Primary priority is design-principle research depth and strict comparison accuracy.

If research and comparison are done correctly, implementation is straightforward.

## 1. Mission and Scope

The mission is exact principle parity, not approximate similarity.

- Component internals must match.
- Surface treatment must match.
- Typography hierarchy must match.
- Interaction feedback must match.
- Motion feel must match.

Layout may adapt for desktop. Design principles may not.

## 2. Strict Priority Order

All work must follow this order:

1. Research mobile design principles deeply, down to each component detail.
2. Compare those principles against web with zero tolerance for drift.
3. Fix the web differences.

Do not skip to step 3 before steps 1 and 2 are complete.

## 3. Research Phase (Highest Emphasis)

Research must be forensic, not superficial.

### 3.1 Research Target

Research every component used by the target screen, including all nested pieces:

- Screen wrapper and containers.
- Headers and title treatments.
- Buttons and chips.
- Toggles and segmented controls.
- Inputs and text fields.
- Pickers and wheel controls.
- Modals, overlays, and dim layers.
- List items and row affordances.
- Status indicators and icon treatments.
- Empty states and helper text.

### 3.2 Research Dimensions (Mandatory Checklist)

For each component, extract and document:

#### Visual Principles

- Background color token and effective color.
- Foreground text color token and effective color.
- Border presence, width, color, and opacity.
- Ring presence and behavior.
- Radius style and exact shape intent (true pill vs rounded block).
- Shadow style and depth.
- Spacing rhythm: padding, gaps, vertical density.
- Typography: family, weight, size, letter spacing, case.
- Icon: size, stroke weight impression, color rules.
- Focus, pressed, hover, active, disabled, selected states.
- Animation type, timing, easing, and transition direction.

#### Behavioral & Functional Principles

- Component input/output: what props or state trigger what rendering?
- Validation logic: what rules are enforced and when?
- State transitions: what sequence of states is possible?
- Form behavior: required fields, error states, success feedback, submission flow?
- Data transformation: how is input data formatted or calculated?
- Interaction sequences: what happens when user takes action? (tap/click/long-press/drag)
- Scroll or swipe physics: snap behavior, inertia, boundary conditions?
- Keyboard interaction: tab order, enter/escape handling, arrow key behavior?
- Filtering or sorting logic: what options, default order, search behavior?
- Gesture recognizers: swipe up/down, double-tap, long-press, pinch expectations?
- Error handling: what errors surface, how are they surfaced to user?
- Async behavior: loading states, spinners, retry logic, timeout handling?
- Persistence: what data is saved locally vs server-synced?
- Animations and transitions: when do they trigger, duration, curve, exit behavior?

### 3.3 Zero-Assumption Rule

Never infer from memory.

- Read actual mobile source for the exact component.
- Validate tokens and style objects in theme files.
- Check variant logic and conditional rendering branches.

## 4. Comparison Phase (Second Highest Emphasis)

Comparison must be strict and explicit. "Close enough" is not allowed.

### 4.1 Difference Recording Format

For each component, produce a principle-diff list:

- Mobile principle.
- Current web behavior.
- Exact mismatch.
- Severity: critical, major, minor.

### 4.2 Micro-Difference Detection

Small differences are mandatory to flag. This includes both visual and behavioral differences.

#### Visual Micro-Differences

Examples of visual differences that must be called out immediately:

- Mobile uses black/dark overlay background, web uses lighter surface tint.
- Mobile has no visible border, web has subtle ring.
- Mobile selected state uses accent fill, web uses text fill.
- Mobile text is semibold heading, web is medium sans.
- Mobile chip radius is full pill, web uses generic rounded large.
- Mobile has stronger dim layer opacity, web is too transparent.
- Mobile component is compact, web has extra vertical padding.
- Mobile icon color follows semantic token, web uses default muted token.

#### Behavioral Micro-Differences

Examples of behavioral/functional differences that must be called out immediately:

- Mobile date picker snaps to day with inertia, web picker doesn't snap or uses different physics.
- Mobile category reorder uses drag-and-drop gestures, web doesn't support drag or uses click-based workflow.
- Mobile duration input clamps to max value silently, web shows validation error.
- Mobile time picker wraps from 23:00 to 00:00, web prevents wrapping.
- Mobile filters persist across screen navigation, web resets on visit.
- Mobile form saves progress to local storage, web only saves on submit.
- Mobile task priority icon shows filled vs outline, web always uses outline.
- Mobile validation fires on blur, web fires on input change.
- Mobile date selection allows multi-select, web allows single-select.
- Mobile scrolling has momentum, web scrolling stops immediately.
- Mobile required field shows asterisk with specific color, web uses different indicator.
- Mobile keyboard appears automatically, web requires user tap.

If a difference is visible, behavioral, or state-dependent, it must be recorded.

### 4.3 Tolerance Policy

Tolerance is effectively zero for principle mismatches.

Allowed differences:

- Only macro responsive layout adaptations for larger screens.

Not allowed differences:

- Any atomic visual or interaction principle drift.

## 5. Fix Phase (Lower Emphasis, Still Required)

Fixing is expected after research and comparison are complete.

- Apply fixes in priority order: critical, major, then minor.
- Preserve component architecture while aligning principle behavior.
- Keep custom controls instead of browser-native replacements.
- Verify all states after fixes, not just default state.

## 6. Non-Negotiable Design & Behavioral Rules

### 6.1 Pill Geometry First

- Prefer rounded-full or equivalent high-radius pills.
- Avoid generic rounded-md or rounded-lg for pill components.

### 6.2 No Browser-Native UI Controls for Complex Inputs

- Do not use native select for custom selector experiences.
- Do not use native date/time inputs when mobile uses custom pickers.

### 6.3 Native-App Focus Behavior

- Remove default browser glow states.
- Use intentional theme-based focus treatment only.

### 6.4 Motion Must Feel Native

- Use transitions and entry/exit animations for modal/tab/content changes.
- Avoid abrupt, snap-only transitions where mobile implies motion.

### 6.5 Wheel and Snap Interactions

- For wheel-like pickers, preserve snap and inertial feel on web.

### 6.6 Form Validation Parity

- Validation timing must match: on blur, on submit, or real-time must match mobile exactly.
- Error messages must surface in the same location and style.
- Required field indicators must match mobile in appearance and behavior.

### 6.7 State Persistence Parity

- If mobile persists form drafts to local storage, web must do the same.
- If mobile clears form on navigation, web must do the same.
- Sync behavior with server must match timing and trigger points.

### 6.8 Interaction Physics Parity

- Scroll behavior: momentum vs no momentum must match.
- Snap points and velocity must match.
- Drag operations must follow same gesture recognition.
- Swipe detection and threshold must match mobile.

### 6.9 Async & Loading State Parity

- Loading spinner style and duration must match.
- Timeout durations must match.
- Retry logic and attempt counts must match.
- Success/error feedback must appear in same locations with same styling.

## 7. Required Execution Workflow

Before editing:

1. Enumerate all mobile source components used by the target screen.
2. Build a component-by-component principle inventory.
3. Build a strict principle diff against web.

During editing:

1. Fix only recorded mismatches.
2. Re-check against the principle inventory after each group of edits.

After editing:

1. Re-run the strict diff list and confirm each mismatch is resolved.
2. Validate state parity: default, hover, active, selected, disabled, focused.
3. Confirm no regression to browser-native controls.

## 8. Definition of Done

A task is done only when all are true:

- Mobile principles were researched at component-detail level (both visual and behavioral).
- Web was compared strictly against every researched principle.
- All identified visual mismatches were fixed or explicitly justified.
- All identified behavioral mismatches were fixed or explicitly justified.
- Remaining differences are layout-only and intentional.
- Form validation, error handling, and data persistence behaviors match mobile.
- Interaction physics (scroll, snap, drag, swipe) match mobile expectations.
- Async states, loading indicators, and success/error feedback match mobile.
- All states (default, hover, active, selected, disabled, focused, loading, error) are functionally identical.
- All animations and transitions follow mobile timing and easing curves.

If any principle mismatch (visual, behavioral, or functional) remains undocumented, the task is not done.

## 9. Iteration Governance for Smoother Future Passes

This section defines how to run parity iterations so future passes are faster, clearer, and less likely to loop on avoidable review feedback.

### 9.1 Principle Over Pixel Cargo-Culting

- Match the underlying design principle, not just a one-off screenshot state.
- If a proposed change solves one issue but breaks composition balance, it is not acceptable.
- Preserve intentional structure when polishing (do not accidentally flatten or over-nest surfaces).

### 9.2 Layout Adaptation Guardrails

- Desktop and large-screen adaptation is allowed only at macro layout level.
- Atomic principles must remain stable across breakpoints:
  - hierarchy,
  - spacing rhythm,
  - control prominence,
  - state feedback,
  - motion feel.
- Do not introduce structural rewrites during polish unless there is a documented parity reason.

### 9.3 Alignment Is a Functional Quality Signal

- Visual alignment is not cosmetic; it is part of perceived parity and usability.
- Validate alignment intentionally for all major regions:
  - headers and section starts,
  - form groups and field baselines,
  - control clusters and action rows,
  - cross-column vertical rhythm.
- If users report the UI feels misaligned, treat it as a concrete defect even if logic works.

### 9.4 Interaction Synchronization Rule

- When multiple interaction channels control the same state (for example gesture, scroll, button, keyboard), they must stay synchronized.
- Indicator state must reflect actual content state, not optimistic or stale derived state.
- Any interaction race condition is a parity issue and must be fixed before sign-off.

### 9.5 Styling Consistency and Browser-Default Rejection

- Browser-default visuals that leak into custom UI are parity failures.
- Focus, rings, borders, padding, and native control chrome must be intentional and theme-consistent.
- If accessibility treatment is required, implement explicit design-system focus states rather than UA defaults.

### 9.6 Iterative Feedback Integration Protocol

- Convert repeated review feedback into explicit written rules in this document.
- If a user requests reverting a previous change, record the root principle and update guidance to prevent repeat drift.
- Distinguish clearly between:
  - parity bugs,
  - optional enhancements,
  - subjective experiments.
- Resolve parity bugs first; do not mix them with exploratory redesign.

### 9.7 Regression Prevention Checklist Per Iteration

After each edit batch, explicitly verify:

- visual parity (tokens, geometry, density),
- behavioral parity (state transitions, interactions, persistence),
- composition quality (alignment, grouping clarity, surface hierarchy),
- interaction coherence (no desync between controls and content),
- accessibility intent (custom focus behavior remains intentional).

If any item fails, the iteration is incomplete.

### 9.8 Decision Logging Requirement

For each meaningful change, keep a short decision record with:

- observed mismatch,
- chosen fix,
- why this fix matches mobile principle,
- what was intentionally not changed.

This prevents future iterations from reintroducing previously rejected directions.
