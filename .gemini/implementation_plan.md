# DoDo App — Feature Implementation Plan

## Codebase Analysis Summary

**Technology**: React Native (TypeScript) mobile app with FastAPI backend + Supabase  
**Architecture**: Context-based state management (Auth, Tasks, Habits, Categories, Preferences), screen-based routing via React Navigation

### Key Files
| Area | Files |
|------|-------|
| Task Screen | `src/screens/tasks/TasksScreen.tsx`, `TaskDetailScreen.tsx` |
| Habit Screen | `src/screens/habit/HabitScreen.tsx`, `HabitDetailScreen.tsx` |
| Calendar | `src/screens/calendar/CalendarScreen.tsx` |
| Profile | `src/screens/profile/ProfileScreen.tsx`, `SettingsScreen.tsx` |
| Components | `TaskItem.tsx`, `DateStrip.tsx`, `CategoryBar.tsx`, `HabitForm.tsx`, `TaskForm.tsx`, `HoldToConfirmButton.tsx`, `AppIcon.tsx`, `LoadingScreen.tsx`, `SortModal.tsx`, `CustomDateTimePicker.tsx` |
| State | `TasksContext.tsx`, `HabitsContext.tsx`, `CategoriesContext.tsx`, `AuthContext.tsx`, `PreferencesContext.tsx` |
| Types | `task.ts`, `habit.ts`, `category.ts`, `auth.ts` |
| Utils | `habits.ts`, `dateTime.ts`, `taskSort.ts` |
| Theme | `ThemeProvider.tsx`, `colors.ts` |
| Navigation | `RootNavigator.tsx`, `MainTabs.tsx` |
| Backend | `routes/habits.py`, `routes/tasks.py`, `progression.py` |

---

## Changes To Implement (7 items)

### 1. Dot Indicator for Dates with Incomplete Tasks (DateStrip)
**Files to modify**: `DateStrip.tsx`, `TasksScreen.tsx`

**Current**: `DateStrip` is a simple date strip showing ±10 days around today. It has no awareness of tasks.

**Plan**:
- Pass an `incompleteDateKeys: Set<string>` prop from `TasksScreen` → `DateStrip`
- In `TasksScreen`, compute which dates in the ±10 day range have incomplete (non-habit) tasks using `tasks.filter(t => !t.completed)`
- In `DateStrip`, render a small colored dot below the date number for any date in the `incompleteDateKeys` set
- Style: small 5px accent-colored dot below the dayNum, similar to the `todayDot` but using a different color (e.g., `colors.danger` or `colors.accent`)

---

### 2. Replace All Native Alerts with Custom Popup
**Files to modify**: ALL files with `Alert.alert` calls (37 occurrences across 9 files)

**Current**: Uses `Alert.alert(title, message)` and `Alert.alert(title, message, buttons)` throughout.

**Plan**:
- Create a new component `src/components/CustomAlert.tsx`:
  - Modal overlay with themed styling matching the app's design system
  - Props: `visible`, `title`, `message`, `buttons` (array of `{text, style?, onPress?}`)
  - Supports simple dismiss (just "OK") and confirmation dialogs (Cancel + destructive action)
- Create a context provider `src/state/AlertContext.tsx` for global imperative access:
  - `showAlert(title, message, buttons?)` — drop-in replacement for `Alert.alert`
  - This allows calling `showAlert()` from any screen without managing modal state locally
- Replace all `Alert.alert(...)` calls with `showAlert(...)` across all 9 files

---

### 3. Fix Last 7 Days Checkmarks in HabitDetailScreen
**Files to modify**: `HabitDetailScreen.tsx`, possibly `HabitsContext.tsx`

**Current Bug**: The "Last 7 Days" section in habit detail screen computes `weekDays` using `useMemo(() => new Date(), [])` for `today`. Then on line 73-78, it calls `loadHistory({ habitId, startDate, endDate })`. The `isHabitCompletedOn` reads from `completionMap` — BUT the `loadHistory` call clears date ranges in `completionMap` before populating with new data, which is correct.

**Root Cause Analysis**: The `weekDays` array uses `new Date()` memoized with `[]` dependency (never re-creates). The history is loaded for those 7 days. The `isHabitCompletedOn` function reads `completionMap[habitId]?.[dateKey]`. The issue is likely that `loadHistory` is called with `{ habitId: habit.id, startDate: start, endDate: end }` which should clear only that habit's dates in range and repopulate. But the `clearDatesInRange` in `loadHistory` (HabitsContext line 161-178) only clears when `params.habitId` is set — and it IS set on this screen.

**Actual root cause**: Looking more carefully, `weekDays` is computed from a `today` that is memoized with `[]`. The `todayWeekKey` (line 71) is `dateKey(weekDays[weekDays.length - 1])`. But `todayKey` (line 59) is `dateKey(today)` — these should always match since `weekDays[6]` is constructed from `today - 0 = today`. 

The real bug: `isHabitCompletedOn` depends on `completionMap`, and `loadHistory` is called as an effect. But the effect depends on `[habit, loadHistory, weekDays]` — `loadHistory` is a `useCallback` with `[]` dependencies so it's stable. But the initial state of `completionMap` is `{}`. The first render will show nothing. After the effect fires and loads history, `completionMap` updates and should trigger a re-render.

Wait — I need to check more carefully. The real issue might be that when navigating from TasksScreen (which loads history for the selected date), the completion map data for those 7 days might not be loaded yet, or the `loadHistory` call's range-clear logic might clobber data loaded by TasksScreen.

**Fix plan**:
- Add `completionMap` to the dependencies or ensure the loadHistory properly triggers re-render
- The key insight: `isHabitCompletedOn` is a callback that depends on `completionMap` in `HabitsContext`. When this screen renders, `completionMap` might be empty for the 7-day range. The effect fires `loadHistory` which should populate it. The re-render should then show the checks.
- Need to verify: is the issue that the data loads correctly but the view doesn't update? Or that the data doesn't load? Most likely the issue is that `today` is memoized and on subsequent visits to the screen, the weekDays don't update. But more importantly, the `loadHistory` might NOT be called again because `habit` object reference changes on each render but `loadHistory` and `weekDays` don't change, so the effect does fire again.

**Likely fix**: The `completionMap` needs to be a dependency of the rendering. Let me check — `isHabitCompletedOn` IS a `useCallback` that depends on `completionMap`. So `completed = isHabitCompletedOn(currentHabit.id, key)` should re-evaluate when `completionMap` changes.

**Alternative root cause**: Maybe the initial `loadHistory` call on `TasksScreen` for `selectedDate` (just today) loads history, and then when navigating here, the `loadHistory` with the 7-day range fires but some timing issue causes it to not populate correctly. OR the effect never fires because habit reference is unstable.

**My fix**: Ensure the effect dependencies are correct and add defensive re-loading. Also ensure `completionMap` changes propagate correctly.

---

### 4. Landscape Layout for Calendar Screen
**Files to modify**: `CalendarScreen.tsx`

**Current**: Calendar and timeline are stacked vertically (calendar on top, timeline below).

**Plan**:
- Use `useWindowDimensions()` to detect orientation (width > height = landscape)
- In landscape mode:
  - Set `flexDirection: 'row'` on the content container
  - Calendar section takes ~40% width on the left
  - Timeline section takes ~60% width on the right
  - Both fill the full available height
- In portrait mode: keep current vertical stacking
- Make `CELL_SIZE` responsive to the actual available width (not just screen width)

---

### 5. Long Press Multi-Select for Tasks and Habits
**Files to modify**: `TasksScreen.tsx`, `HabitScreen.tsx`, `TaskItem.tsx`

**Plan for TasksScreen**:
- Add `multiSelectMode` state and `selectedIds: Set<string>` state
- Long press on any task item activates multi-select mode
- In multi-select mode:
  - Show checkmarks for selected items instead of normal task checkboxes
  - Tapping selects/deselects
  - Show a bottom action bar with: Start, Complete, Delete buttons
  - "Start" → starts timer on all selected tasks
  - "Complete" → marks all selected as completed
  - "Delete" → bulk deletes all selected
  - A close/cancel button to exit multi-select mode
- Habits shown as tasks in TasksScreen should NOT be selectable (they're managed in HabitScreen)

**Plan for HabitScreen**:
- Same multi-select pattern but only with Delete button
- Long press on any habit card activates multi-select mode
- Selected habits are highlighted with accent border
- Bottom action bar with only a Delete button
- Delete sends `removeHabit` for each selected habit

---

### 6. Visual Timer Display
**Files to modify**: `TaskDetailScreen.tsx`, `HabitDetailScreen.tsx`, `TasksScreen.tsx` (lock-in mode)

**Current**: Tasks/habits have `timerStartedAt` which indicates when the timer was started. There's no elapsed-time display anywhere.

**Plan**:
- Create a `src/components/ElapsedTimer.tsx` component:
  - Props: `startedAt: string` (ISO date), `trackedSeconds?: number` (already accumulated)
  - Displays "HH:MM:SS" or "MM:SS" elapsed since `startedAt` + `trackedSeconds`
  - Uses `useEffect/setInterval` every 1 second to update
  - Styled as a prominent display: large monospace text, accent color
- **TaskDetailScreen**: Show `ElapsedTimer` when `task.timerStartedAt` is set (timer is running):
  - Place it in the info card section, prominently visible
  - Also show in the lock-in focus mode view
- **HabitDetailScreen**: Show `ElapsedTimer` when `currentHabit.timerStartedAt` is set:
  - Place it prominently between the streak cards and the session actions
  - Also show in the lock-in focus mode view
- For focus/lock-in modes on both screens, display the elapsed timer prominently (large text below the clock)

---

### 7. Streak Calculation Should Include Habit Completions
**Files to modify**: `ProfileScreen.tsx`

**Current**: `calculateStreaks()` in `ProfileScreen.tsx` only uses `completedDateKeys` from task completions. Habit completions are tracked separately via `completionMap`.

**Plan**:
- Merge habit completion dates into the streak calculation
- Extract dates from `completionMap` where any habit was completed on that date
- Combine with task `completedDateKeys` and pass the merged set to `calculateStreaks()`
- This way, if a user completes either a task OR a habit on a day, it counts toward their streak

---

## Implementation Order

1. **CustomAlert component + AlertContext** (foundational — needed by everything)
2. **ElapsedTimer component** (standalone, reusable)
3. **DateStrip dot indicators** (small, self-contained)
4. **Fix Last 7 Days checkmarks** (bug fix)
5. **Replace all Alert.alert calls** (uses CustomAlert from step 1)
6. **Calendar landscape layout** (standalone)
7. **Multi-select for Tasks and Habits** (complex, standalone)
8. **Streak calculation fix** (simple, standalone)
