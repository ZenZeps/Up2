# 🔄 Complete Relationship Setup Guide for Up2

## 📋 **All Collections & Relationships Overview**

Based on your Up2 app structure, here are ALL the relationships you need to configure:

### **Core Collections:**
- `users` - User accounts
- `events` - Events/activities  
- `event_attendances` - Junction table for event attendance
- `groups` - User groups
- `group_memberships` - Junction table for group membership  
- `user_friendships` - Junction table for friendships
- `chats` - Chat containers
- `messages` - Chat messages
- `travel` - Travel announcements

---

## 🛠️ **Step-by-Step Relationship Configuration**

### **🎯 Step 1: Event Attendances Collection**

Go to **Appwrite Console → Database → Event Attendances Collection**:

```
Add Attribute #1:
- Name: event
- Type: Relationship
- Related Collection: events
- Relation Type: many_to_one
- On Delete: cascade ⚠️
- Two Way: NO ❌
- Two Way Key: (leave empty)
```

```
Add Attribute #2:
- Name: user
- Type: Relationship
- Related Collection: users
- Relation Type: many_to_one
- On Delete: cascade ⚠️
- Two Way: NO ❌
- Two Way Key: (leave empty)
```

### **🎯 Step 2: Events Collection**

Go to **Appwrite Console → Database → Events Collection**:

```
Add Attribute #1:
- Name: attendances
- Type: Relationship
- Related Collection: event_attendances
- Relation Type: one_to_many
- On Delete: cascade ⚠️
- Two Way: NO ❌ (we already have reverse from Step 1)
- Two Way Key: (leave empty)
```

```
Add Attribute #2:
- Name: creator
- Type: Relationship
- Related Collection: users
- Relation Type: many_to_one
- On Delete: cascade ⚠️
- Two Way: YES ✅ (creates users.created_events)
- Two Way Key: created_events
```

### **🎯 Step 3: Group Memberships Collection**

Go to **Appwrite Console → Database → Group Memberships Collection**:

```
Add Attribute #1:
- Name: group
- Type: Relationship
- Related Collection: groups
- Relation Type: many_to_one
- On Delete: cascade ⚠️
- Two Way: NO ❌
- Two Way Key: (leave empty)
```

```
Add Attribute #2:
- Name: user
- Type: Relationship
- Related Collection: users
- Relation Type: many_to_one
- On Delete: cascade ⚠️
- Two Way: NO ❌
- Two Way Key: (leave empty)
```

### **🎯 Step 4: Groups Collection**

Go to **Appwrite Console → Database → Groups Collection**:

```
Add Attribute #1:
- Name: memberships
- Type: Relationship
- Related Collection: group_memberships
- Relation Type: one_to_many
- On Delete: cascade ⚠️
- Two Way: NO ❌ (we already have reverse from Step 3)
- Two Way Key: (leave empty)
```

```
Add Attribute #2:
- Name: creator
- Type: Relationship
- Related Collection: users
- Relation Type: many_to_one
- On Delete: cascade ⚠️
- Two Way: YES ✅ (creates users.created_groups)
- Two Way Key: created_groups
```

### **🎯 Step 5: User Friendships Collection**

Go to **Appwrite Console → Database → User Friendships Collection**:

```
Add Attribute #1:
- Name: user1
- Type: Relationship
- Related Collection: users
- Relation Type: many_to_one
- On Delete: cascade ⚠️
- Two Way: NO ❌
- Two Way Key: (leave empty)
```

```
Add Attribute #2:
- Name: user2
- Type: Relationship
- Related Collection: users
- Relation Type: many_to_one
- On Delete: cascade ⚠️
- Two Way: NO ❌
- Two Way Key: (leave empty)
```

### **🎯 Step 6: Messages Collection**

Go to **Appwrite Console → Database → Messages Collection**:

```
Add Attribute #1:
- Name: chat
- Type: Relationship
- Related Collection: chats
- Relation Type: many_to_one
- On Delete: cascade ⚠️
- Two Way: NO ❌
- Two Way Key: (leave empty)
```

```
Add Attribute #2:
- Name: sender
- Type: Relationship
- Related Collection: users
- Relation Type: many_to_one
- On Delete: cascade ⚠️
- Two Way: NO ❌
- Two Way Key: (leave empty)
```

### **🎯 Step 7: Chats Collection**

Go to **Appwrite Console → Database → Chats Collection**:

```
Add Attribute #1:
- Name: messages
- Type: Relationship
- Related Collection: messages
- Relation Type: one_to_many
- On Delete: cascade ⚠️
- Two Way: NO ❌ (we already have reverse from Step 6)
- Two Way Key: (leave empty)
```

### **🎯 Step 8: Travel Collection**

Go to **Appwrite Console → Database → Travel Collection**:

```
Add Attribute #1:
- Name: user
- Type: Relationship
- Related Collection: users
- Relation Type: many_to_one
- On Delete: cascade ⚠️
- Two Way: YES ✅ (creates users.travel_announcements)
- Two Way Key: travel_announcements
```

---

## ✅ **Final Relationship Structure**

After completing all steps, you'll have:

### **Event Attendances:**
- `event_attendances.event` → Events (many-to-one)
- `event_attendances.user` → Users (many-to-one)

### **Events:**
- `events.attendances` → Event Attendances (one-to-many)
- `events.creator` → Users (many-to-one)

### **Group Memberships:**
- `group_memberships.group` → Groups (many-to-one)
- `group_memberships.user` → Users (many-to-one)

### **Groups:**
- `groups.memberships` → Group Memberships (one-to-many)
- `groups.creator` → Users (many-to-one)

### **User Friendships:**
- `user_friendships.user1` → Users (many-to-one)
- `user_friendships.user2` → Users (many-to-one)

### **Messages:**
- `messages.chat` → Chats (many-to-one)
- `messages.sender` → Users (many-to-one)

### **Chats:**
- `chats.messages` → Messages (one-to-many)

### **Travel:**
- `travel.user` → Users (many-to-one)

### **Users (Auto-Created):**
- `users.created_events` → Events (one-to-many)
- `users.created_groups` → Groups (one-to-many)
- `users.travel_announcements` → Travel (one-to-many)

---

## 🎯 **Cascade Deletion Results**

Once configured, deleting will cascade:

**Delete User** →
- ✅ All their created events
- ✅ All their event attendances
- ✅ All their created groups
- ✅ All their group memberships
- ✅ All their friendships (both directions)
- ✅ All their sent messages
- ✅ All their travel announcements

**Delete Event** →
- ✅ All attendances for that event

**Delete Group** →
- ✅ All memberships for that group

**Delete Chat** →
- ✅ All messages in that chat

Your code is already creating documents with both relationship and string fields, so this will work immediately once you configure the relationships! 🚀