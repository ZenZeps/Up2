# Cross-Platform Event Invite System

## Overview

This feature allows users to share event invites via social media platforms (WhatsApp, Instagram, Messenger) and other sharing methods. The system intelligently routes users based on whether they have the Up2 app installed.

## Features Implemented

### 1. Invite Link Generation
- **Web Links**: `https://up2-app.com/invite?eventId={id}&inviter={userId}&type=event-invite`
- **Deep Links**: `up2://invite?eventId={id}&inviter={userId}&type=event-invite`
- Automatically generated with event and inviter information

### 2. Cross-Platform Sharing
- **WhatsApp**: Direct sharing via WhatsApp URL schemes
- **Instagram**: Fallback to general sharing (Instagram Stories doesn't support direct text)
- **Messenger**: Facebook Messenger URL schemes with fallback
- **General**: Native sharing sheet for other apps

### 3. Smart Landing Pages
- **InviteLanding.tsx**: For users with the app (handles authentication state)
- **PublicInviteLanding.tsx**: For users without the app or web access
- Automatic detection of user account status

### 4. Deep Link Routing
- Enhanced `_layout.tsx` to handle invite deep links
- Routes to appropriate landing page based on user status
- Seamless integration with existing auth flows

## Files Added/Modified

### New Files
- `/lib/utils/invites.ts` - Core invite functionality
- `/components/ShareInviteModal.tsx` - Sharing modal component
- `/app/(root)/InviteLanding.tsx` - In-app invite landing page
- `/app/PublicInviteLanding.tsx` - Public web invite landing page
- `/lib/utils/inviteTracking.ts` - Analytics tracking (optional)

### Modified Files
- `/app/_layout.tsx` - Added invite deep link handling
- `/app/(root)/event/[eventId].tsx` - Added share functionality
- `/app/(root)/components/EventDetailsModal.tsx` - Added share button
- `/app.json` - Updated web routing configuration
- `/package.json` - Added expo-sharing dependency

## Setup Instructions

### 1. Install Dependencies
```bash
npm install expo-sharing
```

### 2. Configure App Store URLs
Update the URLs in both landing pages:
```typescript
// Replace these with your actual URLs
const appStoreUrl = 'https://apps.apple.com/app/up2';
const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.nikolajszeps.up2';
```

### 3. Configure Web Domain
Update the base URL in `lib/utils/invites.ts`:
```typescript
const baseUrl = 'https://your-actual-domain.com';
```

### 4. Set up Web Hosting (Optional)
For the public landing page to work on web:
1. Deploy the web version of your app
2. Configure proper routing for `/invite` path
3. Ensure the domain matches what you use in invite links

### 5. Analytics Collection (Optional)
To track invite statistics:
1. Create an `invites_sent` collection in Appwrite console with fields:
   - `eventId` (String)
   - `inviterUserId` (String)
   - `platform` (Enum: whatsapp, instagram, messenger, general)
   - `sentAt` (DateTime)
2. Update the `logInviteSent` function in `lib/utils/invites.ts`

## Usage

### For Developers
1. Import the `ShareInviteModal` component
2. Add share button to event interfaces
3. Pass the `eventId` to the modal

```typescript
import ShareInviteModal from '../../components/ShareInviteModal';

// In your component
const [showShareModal, setShowShareModal] = useState(false);

// Render the modal
<ShareInviteModal
  visible={showShareModal}
  onClose={() => setShowShareModal(false)}
  eventId={eventId}
/>
```

### For Users
1. Open any event in the app
2. Tap the share button (send icon)
3. Choose sharing method (WhatsApp, Messenger, Instagram, or general)
4. Share the generated link via chosen platform

## How It Works

### User Flow
1. **User A** creates/views an event
2. **User A** taps share button and selects platform
3. System generates invite link with event and inviter info
4. **User B** receives shared link via social media
5. **User B** clicks link:
   - If app installed → Opens app directly to event
   - If no app → Shows web landing page with download options
6. **User B** can join event or download app

### Technical Flow
1. `getEventInviteData()` fetches event and user info
2. `generateInviteLink()` creates web and deep links
3. Platform-specific sharing functions handle different apps
4. Deep link handler in `_layout.tsx` routes incoming links
5. Landing pages handle different user states
6. Optional analytics tracking via `logInviteSent()`

## Testing

### Test Deep Links
```bash
# Test with iOS Simulator
xcrun simctl openurl booted "up2://invite?eventId=EVENT_ID&inviter=USER_ID&type=event-invite"

# Test with Android Emulator
adb shell am start -W -a android.intent.action.VIEW -d "up2://invite?eventId=EVENT_ID&inviter=USER_ID&type=event-invite" com.nikolajszeps.up2
```

### Test Web Links
Visit: `http://localhost:8081/invite?eventId=EVENT_ID&inviter=USER_ID&type=event-invite`

## Customization

### Add New Platforms
To add support for new sharing platforms:
1. Add platform option to `shareOptions` array in `ShareInviteModal.tsx`
2. Create sharing function in `lib/utils/invites.ts`
3. Add platform type to `logInviteSent()` function

### Modify Invite Content
Update `createShareContent()` in `lib/utils/invites.ts` to customize:
- Message text
- Emoji usage
- Link formatting
- Platform-specific content

## Security Considerations

- Event IDs are exposed in invite links (consider this when designing events)
- Public events work best with this system
- Private events should validate inviter relationships
- Consider rate limiting for invite generation
- Web landing page should handle invalid/expired event IDs gracefully

## Future Enhancements

- [ ] QR code generation for in-person sharing
- [ ] Referral tracking (who invited whom)
- [ ] Invite expiration dates
- [ ] Custom invite messages
- [ ] Batch invite sharing
- [ ] Integration with calendar apps
- [ ] Social media preview cards (Open Graph tags)
