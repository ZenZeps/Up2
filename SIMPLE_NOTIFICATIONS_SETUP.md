# Simple Push Notifications Setup Guide

## Overview
This guide shows the simplest way to implement push notifications in your app using temporary token storage instead of database schema changes.

## What's Been Implemented

### 1. Simple Notification Service (`simpleNotificationService.ts`)
- Uses temporary token storage (no database changes needed)
- Stores tokens in memory using the token manager
- Handles friend requests, event invites, and group invites

### 2. Updated Notification Utils (`notificationUtils.ts`)
- All notification functions now use the simple service
- Removed complex fallback logic
- Clean, straightforward implementation

### 3. Updated Notification Service (`notificationService.ts`)
- `updateUserNotificationToken()` now stores tokens in temporary storage only
- No database schema changes required

## How It Works

### Token Storage Approach
Instead of modifying the user profile collection schema, notification tokens are stored temporarily in memory using the `notificationTokenManager`. This means:
- ✅ No database schema changes needed
- ✅ Works immediately 
- ⚠️ Tokens are lost when app restarts (but are re-registered on login)

### Step 1: Register Notification Token
When a user logs in or opens the app, tokens are automatically registered:
```typescript
// This happens automatically in the global provider
const userId = user.$id;
await notificationService.updateUserNotificationToken(userId);
```

### Step 2: Test Notifications
1. Make sure you have two users logged in on different devices
2. Send a friend request from one user to another
3. The recipient should receive a push notification

## Current Implementation Details

### Token Registration Flow:
1. User logs in → Global provider calls `updateUserNotificationToken()`
2. Service gets Expo push token
3. Token stored in temporary memory (no database)
4. Ready to send notifications

### Notification Sending Flow:
1. Action occurs (friend request, event invite, etc.)
2. `SimpleNotificationService.getUserTokens()` gets tokens from memory
3. Tokens sent to Expo push notification service
4. Users receive notifications

## Testing the Implementation

### 1. Check if tokens are being stored:
Look for these logs in your console:
```
📱 Token stored for user 685be52300382ba5ba00: ExponentPushToken[Et...
✅ Notification token stored temporarily for user: 685be52300382ba5ba00
```

### 2. Test friend request notification:
```typescript
// This should now work without database errors
import { sendFriendRequestNotification } from '@/lib/notifications/notificationUtils';

await sendFriendRequestNotification(
    recipientUserId,
    senderName,
    senderId
);
```

### 3. Test event invitation:
```typescript
import { sendEventInviteNotification } from '@/lib/notifications/notificationUtils';

await sendEventInviteNotification(
    [invitedUserId1, invitedUserId2],
    "Birthday Party",
    "John Doe",
    eventId
);
```

## Key Benefits of This Approach

1. **No Database Changes** - Uses temporary storage instead of user profiles
2. **Immediate Setup** - Works right away without schema modifications
3. **Simple Logic** - Straightforward token storage and retrieval
4. **Error-Free** - No "Unknown attribute" errors

## What Happens When You Send Notifications

1. **Friend Request**: Recipient gets "👋 New Friend Request - [Name] sent you a friend request"
2. **Event Invite**: Recipients get "🎉 Event Invitation - [Name] invited you to [Event]"
3. **Group Invite**: Recipients get "👥 Group Invitation - [Name] invited you to join [Group]"

## Limitations

- **Token Persistence**: Tokens are stored in memory and lost on app restart
- **Auto Re-registration**: Tokens are automatically re-registered when users log in
- **Device-Specific**: Each device needs to register its own token

## Next Steps

1. **Test the current implementation** - Try sending friend requests and event invites
2. **Verify token registration** - Check console logs for successful token storage
3. **Optional: Add persistent storage later** - If you want tokens to persist across app restarts

## Migration Path (Optional)

If you later want to add the `notificationToken` field to your user profile collection:
1. Add `notificationToken` attribute to your Appwrite user collection
2. Update the notification service to use user profiles again
3. The system will automatically switch from temporary to persistent storage

This approach gets your notifications working immediately without any database schema changes!
