# Fixing Appwrite Permissions for Messaging System

## Quick Fix - Set Permissions in Appwrite Console

You're getting "not authorized" errors because the Chats and Messages collections need proper permissions.

### Step 1: Fix Chats Collection Permissions

1. **Go to Appwrite Console**: https://cloud.appwrite.io
2. **Navigate to**: Your Project → Databases → Your Database → **Chats Collection**
3. **Click on "Settings" tab**
4. **Scroll to "Permissions" section**
5. **Add these permissions**:

#### Read Permissions:
- Click **"+ Add Role"**
- Select **"Users"** 
- Choose **"Any authenticated user"**
- This allows all logged-in users to read chats

#### Create Permissions:
- Click **"+ Add Role"**
- Select **"Users"**
- Choose **"Any authenticated user"**
- This allows all logged-in users to create chats

#### Update Permissions:
- Click **"+ Add Role"**
- Select **"Users"**
- Choose **"Any authenticated user"**
- This allows all logged-in users to update chats

#### Delete Permissions:
- Click **"+ Add Role"**
- Select **"Users"**
- Choose **"Any authenticated user"**
- This allows all logged-in users to delete chats

### Step 2: Fix Messages Collection Permissions

1. **Navigate to**: Your Project → Databases → Your Database → **Messages Collection**
2. **Click on "Settings" tab**
3. **Add these permissions**:

#### Read Permissions:
- Click **"+ Add Role"**
- Select **"Users"**
- Choose **"Any authenticated user"**

#### Create Permissions:
- Click **"+ Add Role"**
- Select **"Users"**
- Choose **"Any authenticated user"**

#### Update Permissions:
- Click **"+ Add Role"**
- Select **"Users"**
- Choose **"Any authenticated user"**

#### Delete Permissions:
- Click **"+ Add Role"**
- Select **"Users"**
- Choose **"Any authenticated user"**

### Step 3: Test the Fix

After setting up permissions, try using the messaging feature again. The errors should be resolved.

## Alternative: More Secure Permissions (Optional)

For better security, you can set more restrictive permissions:

### Messages Collection (More Secure):
- **Read**: "Any authenticated user" 
- **Create**: "Any authenticated user"
- **Update**: "Document owner" only
- **Delete**: "Document owner" only

This ensures users can only edit/delete their own messages while still allowing everyone to read and create messages.

## Collection IDs Used:
- **Chats**: `6884691f0009edd8eb94`
- **Messages**: `688469c90007a5bde3c1`

## Troubleshooting

If you still get errors after setting permissions:
1. **Clear app cache**: Close and restart your Expo development server
2. **Check authentication**: Make sure you're logged in to the app
3. **Verify collection IDs**: Ensure the IDs in your environment variables match the actual collection IDs in Appwrite
