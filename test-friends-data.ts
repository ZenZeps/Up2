import { getAllUsers, updateUserProfile } from '@/lib/api/user';

/**
 * Test script to check and create friends data
 */
async function testFriendsData() {
    try {
        console.log('=== TESTING FRIENDS DATA ===');

        // Get all users
        console.log('Fetching all users...');
        const users = await getAllUsers(false); // Don't use cache
        console.log('All users:', users.length, users.map(u => ({ id: u.$id, name: `${u.firstName} ${u.lastName}`, friends: u.friends })));

        if (users.length < 2) {
            console.log('Need at least 2 users to test friends. Current users:', users.length);
            return;
        }

        // Pick the first two users and make them friends
        const user1 = users[0];
        const user2 = users[1];

        console.log('Making users friends:', user1.firstName, 'and', user2.firstName);

        // Update user1 to have user2 as friend
        const updatedUser1 = {
            ...user1,
            friends: [...(user1.friends || []), user2.$id].filter((id, index, arr) => arr.indexOf(id) === index) // Remove duplicates
        };

        // Update user2 to have user1 as friend  
        const updatedUser2 = {
            ...user2,
            friends: [...(user2.friends || []), user1.$id].filter((id, index, arr) => arr.indexOf(id) === index) // Remove duplicates
        };

        await updateUserProfile(updatedUser1);
        await updateUserProfile(updatedUser2);

        console.log('Updated friends successfully');
        console.log('User1 friends:', updatedUser1.friends);
        console.log('User2 friends:', updatedUser2.friends);

    } catch (error) {
        console.error('Error testing friends data:', error);
    }
}

testFriendsData();
