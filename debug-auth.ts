import { account, config } from './lib/appwrite/appwrite';

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

// Test event fetching for current user
export async function debugUserEvents() {
    console.log('\n📅 Testing event fetching...');

    try {
        // Get current user
        const currentUser = await account.get();
        console.log('  Current user:', currentUser.email);

        // Import the fetchUserEvents function
        const { fetchUserEvents } = await import('./lib/api/event');

        // Fetch events for current user
        console.log('  Fetching events for user:', currentUser.$id);
        const events = await fetchUserEvents(currentUser.$id);

        console.log('✅ Event fetch completed!');
        console.log('  Events found:', events.length);

        if (events.length > 0) {
            events.forEach((event, index) => {
                console.log(`  Event ${index + 1}:`);
                console.log(`    Title: ${event.title}`);
                console.log(`    Creator: ${event.creatorId}`);
                console.log(`    Start: ${event.startTime}`);
                console.log(`    Attendees: ${event.attendees?.length || 0}`);
                console.log(`    Tags: ${event.tags?.join(', ') || 'No tags'}`);
            });
        } else {
            console.log('  ⚠️  No events found for this user');
        }

        return { success: true, events };

    } catch (error: any) {
        console.error('❌ Event fetch failed:', error.message);
        return { success: false, error };
    }
}

// Test cache clearing
export async function debugCacheClear() {
    console.log('\n🧹 Testing cache clearing...');

    try {
        // Import cache manager
        const { cacheManager } = await import('./lib/debug/cacheManager');

        console.log('  Clearing all cache...');
        cacheManager.clear();
        console.log('✅ Cache cleared successfully!');

        // Test if cache is empty by trying to fetch user data
        try {
            const currentUser = await account.get();
            console.log('  Current user after cache clear:', currentUser.email);

            // Try to get cached profile (should be null)
            const { getUserProfile } = await import('./lib/api/user');
            console.log('  Testing profile fetch after cache clear...');
            const profile = await getUserProfile(currentUser.$id);
            console.log('  Profile fetch completed - this should trigger a fresh database call');

        } catch (e) {
            console.log('  No current user (expected after logout)');
        }

        return { success: true };

    } catch (error: any) {
        console.error('❌ Cache clear test failed:', error.message);
        return { success: false, error };
    }
}

// Test complete logout and login cycle
export async function debugLoginCycle(email1: string, password1: string, email2: string, password2: string) {
    console.log('\n🔄 Testing complete login cycle...');

    try {
        // Step 1: Login as first user
        console.log('  Step 1: Login as first user...');
        const login1 = await testLogin(email1, password1);
        if (!login1.success) throw new Error('First login failed');

        // Get first user's events
        console.log('  Step 2: Get first user events...');
        const events1 = await debugUserEvents();

        // Step 3: Logout
        console.log('  Step 3: Logout...');
        const { logout } = await import('./lib/appwrite/appwrite');
        await logout();

        // Step 4: Test cache clear
        console.log('  Step 4: Verify cache cleared...');
        await debugCacheClear();

        // Step 5: Login as second user
        console.log('  Step 5: Login as second user...');
        const login2 = await testLogin(email2, password2);
        if (!login2.success) throw new Error('Second login failed');

        // Step 6: Get second user's events
        console.log('  Step 6: Get second user events...');
        const events2 = await debugUserEvents();

        console.log('✅ Login cycle test completed!');
        console.log(`  First user events: ${events1.events?.length || 0}`);
        console.log(`  Second user events: ${events2.events?.length || 0}`);

        return { success: true, events1, events2 };

    } catch (error: any) {
        console.error('❌ Login cycle test failed:', error.message);
        return { success: false, error };
    }
}

// Test event color functionality
export async function debugEventColors() {
    console.log('\n🎨 Testing event color system...');

    try {
        // Import functions
        const { CATEGORIES, getEventColor } = await import('./constants/categories');

        console.log('  Available categories and colors:');
        CATEGORIES.forEach(category => {
            console.log(`    ${category.emoji} ${category.label}: ${category.color}`);
        });

        console.log('\n  Testing color selection logic:');

        // Test different tag combinations
        const testCases = [
            { tags: ['sports'], expected: 'Red' },
            { tags: ['music', 'party'], expected: 'Purple (first tag wins)' },
            { tags: ['family', 'food'], expected: 'Pink (first tag wins)' },
            { tags: ['nature'], expected: 'Green' },
            { tags: ['study', 'outdoors'], expected: 'Orange (first tag wins)' },
            { tags: [], expected: 'Default blue' },
        ];

        testCases.forEach(({ tags, expected }) => {
            const color = getEventColor(tags);
            console.log(`    Tags: [${tags.join(', ')}] -> Color: ${color} (${expected})`);
        });

        console.log('\n✅ Color system test completed!');

        return { success: true, categories: CATEGORIES };

    } catch (error: any) {
        console.error('❌ Color system test failed:', error.message);
        return { success: false, error };
    }
}
