import { config, account } from './lib/appwrite/appwrite';

// Test Appwrite connection and configuration
export async function debugAppwriteConnection() {
  console.log('🔍 Debugging Appwrite Connection...');
  
  // Check configuration
  console.log('📋 Configuration:');
  console.log('  Endpoint:', config.endpoint);
  console.log('  Project ID:', config.projectID);
  console.log('  Platform:', config.platform);
  
  try {
    // Test if we can reach Appwrite
    console.log('\n🌐 Testing connection...');
    const health = await fetch(`${config.endpoint}/health/version`);
    const healthData = await health.text();
    console.log('  Appwrite server response:', healthData);
    
    // Test current session
    console.log('\n👤 Checking current session...');
    try {
      const currentUser = await account.get();
      console.log('  Current user found:', currentUser.email);
    } catch (error: any) {
      console.log('  No current session (expected for login test)');
    }
    
    // Test if we can list sessions
    try {
      const sessions = await account.listSessions();
      console.log('  Active sessions:', sessions.sessions.length);
      if (sessions.sessions.length > 0) {
        console.log('  ⚠️  Found existing sessions - this might cause login issues');
        // Optionally clear them
        console.log('  Clearing existing sessions...');
        for (const session of sessions.sessions) {
          await account.deleteSession(session.$id);
        }
        console.log('  ✅ Cleared all sessions');
      }
    } catch (error) {
      console.log('  Could not check sessions (expected for guest user)');
    }
    
  } catch (error) {
    console.error('❌ Connection test failed:', error);
  }
}

// Test login with specific credentials
export async function testLogin(email: string, password: string) {
  console.log('\n🔐 Testing login...');
  console.log('  Email:', email.substring(0, 3) + '****');
  
  try {
    // Clear any existing sessions first
    try {
      const sessions = await account.listSessions();
      for (const session of sessions.sessions) {
        await account.deleteSession(session.$id);
      }
    } catch (e) {
      // Ignore errors here
    }
    
    // Attempt login
    const session = await account.createEmailPasswordSession(email, password);
    console.log('✅ Login successful!');
    console.log('  Session ID:', session.$id);
    
    // Get user info
    const user = await account.get();
    console.log('  User ID:', user.$id);
    console.log('  User Email:', user.email);
    console.log('  Email Verified:', user.emailVerification);
    
    return { success: true, user, session };
    
  } catch (error: any) {
    console.error('❌ Login failed:', error.message);
    console.error('  Error type:', error.type);
    console.error('  Error code:', error.code);
    return { success: false, error };
  }
}
