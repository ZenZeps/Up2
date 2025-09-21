#!/usr/bin/env ts-node

// Debug script to check feed data
import { fetchEvents } from './lib/api/event';
import { getUserFriends } from './lib/api/friendship';
import { getUserGroups } from './lib/api/group';
import { account } from './lib/appwrite/appwrite';

async function debugFeedData() {
    try {
        // Get current user
        const user = await account.get();
        console.log('Current user:', user.$id, user.name);

        // Check friends
        const friends = await getUserFriends(user.$id);
        console.log('User friends:', friends.length, friends);

        // Check groups
        const groups = await getUserGroups(user.$id);
        console.log('User groups:', groups.length, groups.map(g => ({ id: g.$id, title: g.title })));

        // Check all events
        const allEvents = await fetchEvents();
        console.log('Total events in database:', allEvents.length);

        // Check friend events
        const friendEvents = allEvents.filter(event => friends.includes(event.creatorId));
        console.log('Friend events:', friendEvents.length);

        // Check group events
        const groupEvents = allEvents.filter(event => event.groupId && groups.some(g => g.$id === event.groupId));
        console.log('Group events:', groupEvents.length);

        // Show sample of all events to see what's available
        console.log('\nSample events:');
        allEvents.slice(0, 5).forEach(event => {
            console.log('- Event:', event.title, 'Creator:', event.creatorId, 'Group:', event.groupId || 'none');
        });

    } catch (error) {
        console.error('Error debugging feed data:', error);
    }
}

debugFeedData();
