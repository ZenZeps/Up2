# 🔔 NOTIFICATION TOKENS COLLECTION SETUP GUIDE

## 🚨 ISSUE RESOLVED
**Error**: `❌ Error registering notification token: [AppwriteException: Invalid query: Attribute not found in schema: userId]`

**Root Cause**: The notification tokens collection doesn't exist in your Appwrite database or is missing required attributes.

**Status**: ✅ **Code updated to handle missing collection gracefully**

---

## 📋 APPWRITE COLLECTION SETUP

To enable push notifications, create a new collection in your Appwrite database:

### 1. **Create Collection**
- **Collection ID**: `notification_tokens`
- **Collection Name**: "Notification Tokens"

### 2. **Required Attributes**

| Attribute Name | Type | Size | Required | Default | Index |
|----------------|------|------|----------|---------|-------|
| `userId` | String | 255 | ✅ Yes | - | ✅ Index |
| `deviceToken` | String | 500 | ✅ Yes | - | - |
| `deviceType` | String | 20 | ✅ Yes | - | - |
| `deviceId` | String | 255 | ❌ No | - | - |
| `enabled` | Boolean | - | ✅ Yes | `true` | ✅ Index |
| `lastUsed` | String | 50 | ✅ Yes | - | - |
| `appVersion` | String | 20 | ❌ No | - | - |

### 3. **Permissions**
- **Create**: `Users`
- **Read**: `Users`
- **Update**: `Users` 
- **Delete**: `Users`

### 4. **Indexes** (Recommended)
- Index on `userId` for fast user token lookups
- Index on `enabled` to filter active tokens

---

## 🔧 ENVIRONMENT VARIABLES

Add to your `.env` file (optional - defaults to 'notification_tokens'):
```env
EXPO_PUBLIC_APPWRITE_NOTIFICATION_TOKENS_ID=notification_tokens
```

---

## ✅ CURRENT STATUS

### **Code Improvements Applied**:
1. **Graceful Degradation**: App continues working without notification collection
2. **Collection Detection**: Automatically checks if collection exists
3. **Clear Error Messages**: Provides setup instructions when collection is missing
4. **Non-Blocking Errors**: Missing collection won't crash the app

### **User Experience**:
- ✅ App works normally without notification collection
- ✅ Clear console messages guide setup
- ✅ Notifications will work once collection is created
- ✅ No app crashes or blocking errors

---

## 🚀 TESTING

### **Before Collection Setup**:
```
🔕 Skipping notification token registration - collection not configured
⚠️ Notification tokens collection not found or improperly configured.
📋 To enable push notifications, create a collection in Appwrite with ID: notification_tokens
```

### **After Collection Setup**:
```
📱 Registered new notification token
✅ Push notifications fully operational
```

---

## 🎯 NEXT STEPS

1. **Immediate**: App is working fine without push notifications
2. **Optional**: Create the collection following the guide above
3. **Production**: Set up push notifications before app store release

**The error is now resolved and your app will continue working smoothly!** 🎉
