# Messaging System Setup Guide

This guide will walk you through setting up the messaging system with proper relationships in your Appwrite backend.

## Database Architecture

Based on your rules:
1. Each event has ONE chat that belongs to it
2. Each group has ONE chat that belongs to it  
3. A chat belongs to EITHER an event OR a group (not both)
4. Chats contain many messages, messages belong to ONE chat
5. When a chat is deleted, messages are automatically deleted (cascade)

## Step 1: Create the Chats Collection

1. **Go to your Appwrite Console** (https://cloud.appwrite.io)
2. Navigate to your project (`685944b1003ba9c421ea`)
3. Go to **Databases** → **Your Database** (`68594f14003e54ada2a4`)
4. Click **"Create Collection"**

### Collection Settings:
- **Collection Name**: `Chats`
- **Collection ID**: Use "auto" or specify a custom ID

### Chats Collection Attributes:

1. **eventId** (String, Optional)
   - Type: String
   - Size: 255
   - Required: No
   - Array: No

2. **groupId** (String, Optional)
   - Type: String
   - Size: 255
   - Required: No
   - Array: No

## Step 2: Create the Messages Collection

### Collection Settings:
- **Collection Name**: `Messages`
- **Collection ID**: Use "auto" or specify a custom ID

### Messages Collection Attributes:

1. **content** (String)
   - Type: String
   - Size: 1000
   - Required: Yes
   - Array: No

2. **authorId** (String)
   - Type: String
   - Size: 255
   - Required: Yes
   - Array: No

3. **chatId** (String)
   - Type: String
   - Size: 255
   - Required: Yes
   - Array: No

4. **isEdited** (Boolean)
   - Type: Boolean
   - Required: No
   - Default: false

5. **replyToId** (String, Optional)
   - Type: String
   - Size: 255
   - Required: No
   - Array: No

6. **attachments** (String Array, Optional)
   - Type: String
   - Size: 255
   - Required: No
   - Array: Yes

## Step 3: Set Up Relationships

### Events ↔ Chats (One-to-One)
In your **Events Collection**:
1. Add a **Relationship Attribute**:
   - **Attribute Key**: `chat`
   - **Related Collection**: Chats
   - **Relationship Type**: One to One
   - **Two-way relationship**: Yes
   - **On Delete**: Cascade

In your **Chats Collection**:
1. Add a **Relationship Attribute**:
   - **Attribute Key**: `event`
   - **Related Collection**: Events
   - **Relationship Type**: One to One
   - **Two-way relationship**: Yes (if not already set)

### Groups ↔ Chats (One-to-One)
In your **Groups Collection**:
1. Add a **Relationship Attribute**:
   - **Attribute Key**: `chat`
   - **Related Collection**: Chats
   - **Relationship Type**: One to One
   - **Two-way relationship**: Yes
   - **On Delete**: Cascade

In your **Chats Collection**:
1. Add a **Relationship Attribute**:
   - **Attribute Key**: `group`
   - **Related Collection**: Groups
   - **Relationship Type**: One to One
   - **Two-way relationship**: Yes (if not already set)

### Chats ↔ Messages (One-to-Many)
In your **Chats Collection**:
1. Add a **Relationship Attribute**:
   - **Attribute Key**: `messages`
   - **Related Collection**: Messages
   - **Relationship Type**: One to Many
   - **Two-way relationship**: Yes
   - **On Delete**: Cascade

In your **Messages Collection**:
1. Add a **Relationship Attribute**:
   - **Attribute Key**: `chat`
   - **Related Collection**: Chats
   - **Relationship Type**: Many to One
   - **Two-way relationship**: Yes (if not already set)

## Step 4: Set Up Indexes

### Chats Collection Indexes:
1. **eventId**
   - Type: Key
   - Attributes: `eventId`
   - Orders: `ASC`

2. **groupId**
   - Type: Key
   - Attributes: `groupId`
   - Orders: `ASC`

### Messages Collection Indexes:
1. **chatId_createdAt**
   - Type: Key
   - Attributes: `chatId`, `$createdAt`
   - Orders: `ASC`, `DESC`

2. **authorId**
   - Type: Key
   - Attributes: `authorId`
   - Orders: `ASC`

## Step 5: Configure Permissions

### Chats Collection Permissions:
- **Read**: `users` (any authenticated user)
- **Create**: `users` (any authenticated user)
- **Update**: `users` (any authenticated user)
- **Delete**: `users` (any authenticated user)

### Messages Collection Permissions:
- **Read**: `users` (any authenticated user)
- **Create**: `users` (any authenticated user)
- **Update**: Document owner only
- **Delete**: Document owner only

## Step 6: Update Environment Variables

After creating both collections, update your `eas.json` file:

```json
"EXPO_PUBLIC_APPWRITE_CHATS_COLLECTION_ID": "your_chats_collection_id_here",
"EXPO_PUBLIC_APPWRITE_MESSAGES_COLLECTION_ID": "your_messages_collection_id_here"
```

Update ALL build profiles (development, preview, production, testing).

## Benefits of This Architecture

✅ **Data Integrity**: Relationships ensure proper foreign key constraints
✅ **Cascade Deletion**: When event/group deleted → chat deleted → messages deleted  
✅ **Performance**: Proper indexes for fast message retrieval
✅ **Scalability**: Clean separation of concerns
✅ **Flexibility**: Easy to extend with features like message reactions
✅ **Security**: Granular permissions at each level

## Step 6: Test the Implementation

1. **Build and run your app**
2. **Go to the Feed page**
3. **Tap on an event's "Chat" button**
4. **Try sending a message**

## Optional Enhancements

### Real-time Updates (Future)
To enable real-time message updates, you can use Appwrite's Realtime API:

```typescript
import { client } from '@/lib/appwrite/appwrite';

// Subscribe to message updates
const unsubscribe = client.subscribe(
  `databases.${config.databaseID}.collections.${config.messagesCollectionID}.documents`,
  (response) => {
    // Handle real-time message updates
    console.log('New message:', response.payload);
  }
);
```

### Message Attachments (Future)
To support image/file attachments:

1. Create a new bucket in Appwrite Storage
2. Update the `attachments` array to store file IDs
3. Modify the MessageModal to support file uploads

### Message Notifications (Future)
To add push notifications for new messages:

1. Set up Appwrite Functions
2. Create a function triggered on message creation
3. Send push notifications to relevant users

## Troubleshooting

### Common Issues:

1. **"Collection not found" error**
   - Verify the collection ID in your environment variables
   - Ensure the collection exists in the correct database

2. **Permission denied errors**
   - Check collection permissions
   - Ensure users are properly authenticated

3. **Messages not loading**
   - Verify indexes are created
   - Check network connectivity
   - Review console logs for specific errors

### Debug Steps:

1. Check browser/app console for error messages
2. Verify Appwrite console for successful requests
3. Test with different user accounts
4. Ensure all environment variables are correctly set

## Features Implemented

✅ **Basic Messaging**
- Send messages to event chats
- View message history
- Real-time-ready architecture

✅ **Message Management**
- Edit your own messages
- Delete your own messages
- Message timestamps

✅ **User Experience**
- Chat-like interface
- Author avatars and names
- Dark mode support
- Keyboard handling

✅ **Security**
- User authentication required
- Message ownership validation
- Proper permissions setup

## Next Steps

After completing the basic setup, you can extend the messaging system with:

1. **Group messaging** (similar to event messaging)
2. **Real-time updates** using Appwrite Realtime
3. **Message attachments** using Appwrite Storage
4. **Push notifications** using Appwrite Functions
5. **Message search** and filtering
6. **Message reactions** and emoji support
