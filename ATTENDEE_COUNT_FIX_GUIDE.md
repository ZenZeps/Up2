# Attendee Count Fix Implementation Guide

## Problem Identified

The attendee count issue is caused by the Event Attendances junction table not being properly configured. The app is checking for a collection ID that points to a placeholder value `"event_attendances"` instead of a real Appwrite collection ID.

## Root Cause

1. **Environment Configuration**: `EXPO_PUBLIC_APPWRITE_EVENTATTENDANCES_COLLECTION_ID=event_attendances`
2. **Junction Table Check**: The app checks if this is a valid collection ID and finds it's a placeholder
3. **Function Returns False**: `addEventAttendee()` returns `false` without updating counts
4. **Zero Attendee Count**: Events are created with `attendeeCount: 0` and never updated

## Solutions Implemented

### 1. Enhanced Junction Table Detection
Updated all junction table functions to detect `"event_attendances"` as a placeholder:
- `addEventAttendee()`
- `removeEventAttendee()`
- `addEventInvitation()`
- `getEventAttendees()`
- `getEventAttendeesFor()`

### 2. Fallback Attendee Management
Created `attendeeCountManager.ts` with:
- `addAttendeeWithFallback()`: Tries junction table, falls back to manual count update
- `removeAttendeeWithFallback()`: Same for removal
- `syncEventAttendeeCounts()`: Fixes all existing events
- `validateEventAttendeeCount()`: Checks if counts are accurate

### 3. Updated Event Creation
Modified `createEvent()` to use the fallback system, ensuring creators are always marked as attending with correct counts.

## Immediate Fix

### Option A: Create Proper Junction Table (Recommended)
1. **Create Collection in Appwrite**:
   - Collection Name: `event_attendances`
   - Schema:
     ```json
     {
       "eventId": "string (required)",
       "userId": "string (required)",
       "status": "string (required)", // 'attending', 'invited', 'not_attending'
       "invitedBy": "string (optional)",
       "respondedAt": "datetime (optional)"
     }
     ```

2. **Update Environment Variable**:
   ```bash
   EXPO_PUBLIC_APPWRITE_EVENTATTENDANCES_COLLECTION_ID=<actual_collection_id>
   ```

3. **Set Indexes**:
   - Index on `eventId` (for fast event queries)
   - Index on `userId` (for fast user queries)
   - Composite index on `eventId,userId` (for existence checks)

### Option B: Use Fallback System
The fallback system is now implemented and will work even without the junction table.

## Testing & Validation

### 1. Run Attendee Count Fix Script
```typescript
import { fixAttendeeCountIssues } from '@/fix-attendee-counts';
await fixAttendeeCountIssues();
```

### 2. Validate Specific Event
```typescript
import { validateEventAttendeeCount } from '@/lib/utils/attendeeCountManager';
const result = await validateEventAttendeeCount(eventId);
console.log('Attendee count validation:', result);
```

### 3. Create New Event Test
Create a new event and verify:
- Creator is automatically attending
- `attendeeCount` shows `1` not `0`
- Other users can join/leave properly

## Implementation Status

### ✅ Completed
- Enhanced junction table detection
- Fallback attendee count management
- Updated event creation process
- Sync utility for fixing existing events
- Validation utilities

### 🔧 Next Steps
1. **Choose Option A or B** based on your infrastructure preferences
2. **Run the fix script** on existing events
3. **Test event creation** to ensure attendee counts work
4. **Monitor logs** for any remaining issues

## Files Modified

- `/lib/api/event.ts` - Enhanced junction table checks and event creation
- `/lib/utils/attendeeCountManager.ts` - New fallback management system
- `/fix-attendee-counts.ts` - Utility to fix existing events

## Expected Outcome

After implementation:
- ✅ New events will have correct attendee counts (creator = 1)
- ✅ Existing events can be fixed with the sync script
- ✅ Join/leave functionality will work with proper counts
- ✅ System works whether junction table exists or not

## Monitoring

Check these logs to ensure the fix is working:
- `"Creator successfully marked as attending event"` - Success message
- `"Fallback: Updated attendee count"` - Fallback system working
- `"Junction table not configured"` - Expected when using fallback

The system is now robust and handles both scenarios gracefully.
