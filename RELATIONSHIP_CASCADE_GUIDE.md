# 🚀 Relationship-Based Cascade Deletion Implementation

## 📋 Overview

This guide implements **Appwrite's built-in relationship attributes** with cascade deletion instead of custom Functions. This is the superior approach because:

- ✅ **Built into Appwrite core** - No deployment needed
- ✅ **Automatic cascade deletion** - Database handles everything
- ✅ **Better performance** - Database-level operations
- ✅ **Data consistency** - ACID transactions guaranteed
- ✅ **Simpler maintenance** - No custom code to manage

## 🎯 Migration Strategy

### Phase 1: Add Relationship Attributes (Parallel to existing fields)
### Phase 2: Populate Relationships from Existing Data  
### Phase 3: Update Application Code
### Phase 4: Remove Old String Fields

## 🔍 Your Current Collection Structure

Based on your codebase, here are the collections that need relationship updates:

```typescript
// Current Collections:
- users: "685bb460000e2c55b3a5"
- events: "68594f3e0030d3de2a3c" 
- groups: "687ef8b7003cc206308f"
- chats: "6884691f0009edd8eb94"
- messages: "688469c90007a5bde3c1"
- user_friendships: "6860ad7600142dc61426" 
- event_attendances: "event_attendances" (from config)
- group_memberships: "68a1bee20031a75f55e6"
```

## 🛠️ Step-by-Step Implementation

### Step 1: Backup Your Database
Before making any changes, **export your database** from Appwrite Console.

### Step 2: Add Relationship Attributes

Go to **Appwrite Console → Database → Collections** and add these relationship attributes:

#### **Events Collection** (`68594f3e0030d3de2a3c`)
```
Add Attribute:
- Name: creator
- Type: Relationship
- Related Collection: users
- Relation Type: many_to_one
- On Delete: cascade
- Two Way: Yes
- Two Way Key: created_events
```

#### **Event Attendances Collection** (`event_attendances`)
```
Add Attribute #1:
- Name: event
- Type: Relationship  
- Related Collection: events
- Relation Type: many_to_one
- On Delete: cascade

Add Attribute #2:
- Name: user
- Type: Relationship
- Related Collection: users
- Relation Type: many_to_one
- On Delete: cascade
```

#### **Group Memberships Collection** (`68a1bee20031a75f55e6`)
```
Add Attribute #1:
- Name: group
- Type: Relationship
- Related Collection: groups
- Relation Type: many_to_one
- On Delete: cascade

Add Attribute #2:
- Name: user
- Type: Relationship
- Related Collection: users
- Relation Type: many_to_one
- On Delete: cascade
```

#### **User Friendships Collection** (`6860ad7600142dc61426`)
```
Add Attribute #1:
- Name: user1
- Type: Relationship
- Related Collection: users
- Relation Type: many_to_one
- On Delete: cascade

Add Attribute #2:
- Name: user2
- Type: Relationship
- Related Collection: users
- Relation Type: many_to_one
- On Delete: cascade
```

#### **Messages Collection** (`688469c90007a5bde3c1`)
```
Add Attribute #1:
- Name: sender
- Type: Relationship
- Related Collection: users
- Relation Type: many_to_one
- On Delete: cascade

Add Attribute #2:
- Name: chat
- Type: Relationship
- Related Collection: chats
- Relation Type: many_to_one
- On Delete: cascade
```

#### **Groups Collection** (if you want events to cascade when groups are deleted)
```
Add Attribute:
- Name: events
- Type: Relationship
- Related Collection: events
- Relation Type: one_to_many
- On Delete: cascade
- Two Way: Yes
- Two Way Key: group
```

### Step 3: Run Migration Script

After adding all relationship attributes, run the migration script to populate them from existing data:

```bash
# Run the migration script
node migrate-to-relationships.js
```

This script will:
- Populate `creator` relationships from `creatorId` strings in events
- Populate `event` and `user` relationships in attendances
- Populate `group` and `user` relationships in memberships
- Populate `user1` and `user2` relationships in friendships
- Populate `sender` and `chat` relationships in messages

### Step 4: Test Cascade Deletion

Run the test script to verify cascade deletion is working:

```bash
# Test cascade deletion functionality
node test-cascade-deletion.js
```

This will create test users, events, and attendances, then delete them to verify cascade deletion works correctly.

### Step 5: Update Application Code

Use the relationship API helpers during transition:

```typescript
import { 
  createEventWithRelationship,
  createEventAttendanceWithRelationship,
  getEventsByCreatorRelationship 
} from '@/lib/api/relationships';

// Create events with both relationship and string fields
const event = await createEventWithRelationship(eventData, userId);

// Query using relationships with fallback to strings
const userEvents = await getEventsByCreatorRelationship(userId);
```

### Step 6: Remove Old Fields

Once confirmed working and all code updated, remove the old string reference fields from your collections.

## 🎉 Expected Results

After implementation:

- **Delete a user** → All their events, attendances, group memberships, friendships, and messages automatically deleted
- **Delete an event** → All attendances automatically deleted
- **Delete a group** → All memberships and group events automatically deleted
- **Delete a chat** → All messages automatically deleted

**No custom code needed** - Appwrite handles everything automatically!

## 📁 Files Created

1. **`RELATIONSHIP_CASCADE_GUIDE.md`** - This comprehensive guide
2. **`migrate-to-relationships.js`** - Migration script to populate relationships from existing data
3. **`lib/api/relationships.ts`** - API helpers that work with both string and relationship fields
4. **`test-cascade-deletion.js`** - Test script to verify cascade deletion is working

## 🚀 Quick Start

1. **Add relationship attributes** in Appwrite Console (see Step 2 above)
2. **Run migration**: `node migrate-to-relationships.js`
3. **Test cascade deletion**: `node test-cascade-deletion.js`
4. **Update your code** to use the relationship API helpers
5. **Remove old fields** once everything is working

---

🎉 **This approach is much better than custom Functions!** Ready to implement relationship-based cascade deletion?