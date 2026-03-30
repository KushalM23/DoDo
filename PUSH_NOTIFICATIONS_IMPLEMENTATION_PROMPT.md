# Firebase Messaging + Notifee Implementation Prompt

I want you to implement production-ready push notifications in my bare React Native app using Firebase Messaging + Notifee.

## Goal

- Use Firebase Messaging to receive remote push notifications
- Use Notifee to display and customize notifications on-device
- Keep implementation clean, typed, and aligned with my existing app architecture

## What to do end-to-end

1. Inspect my project and identify where notification bootstrap logic should live.
2. Install and configure required dependencies for bare React Native:
   - @react-native-firebase/app
   - @react-native-firebase/messaging
   - @notifee/react-native
3. Configure Android:
   - Notification permission handling for Android 13+
   - Default notification channel setup
   - High-importance channel for task reminders
   - Background message handling
   - Ensure app receives and displays notifications in foreground and background
4. Configure iOS:
   - Request notification permissions
   - APNs + Firebase Messaging setup checks
   - Foreground presentation behavior
   - Background/quit-state handling
5. Create a notification service module that:
   - Requests permission
   - Gets and refreshes FCM token
   - Creates notification channels
   - Handles foreground messages with Notifee displayNotification
   - Handles notification open events and initial notification
6. Wire app lifecycle integration:
   - Initialize once on app startup
   - Register listeners with proper cleanup
   - Avoid duplicate listeners
7. Add actionable notification UX:
   - Title/body
   - Optional data payload support
   - Press action routing (deep link or screen navigation hook)
8. Add backend token sync integration:
   - Send FCM token to my backend API using existing API client patterns
   - Update token on refresh
   - Handle auth/no-auth states gracefully
9. Add robust error handling + logs for development only.
10. Document setup and run steps clearly:

- Required Firebase console setup
- Android/iOS native config checklist
- How to test with a sample FCM payload

## Implementation constraints

- Do not rewrite unrelated architecture
- Follow existing naming/style conventions
- Keep code modular and strongly typed
- Prefer minimal, focused changes
- If you need environment variables, add them consistently with current env patterns

## Validation checklist before finishing

- App requests permission correctly
- Foreground message shows via Notifee
- Background message shows notification
- Notification tap routes correctly
- FCM token is obtained and synced to backend
- No duplicate notifications for same event
- Build passes for Android and iOS (or explain any local blockers)

## Output format

- Show a concise change summary first
- Then list exact files changed and why
- Then provide manual test steps with expected results
- Include any follow-up commands I need to run locally only if necessary
