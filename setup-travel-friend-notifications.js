#!/usr/bin/env node

/**
 * 🌍 Travel Friend Notifications - Appwrite Setup Script
 * 
 * This script adds the necessary attributes to your existing travel collection
 * to enable location-based friend notifications.
 * 
 * Run with: node setup-travel-friend-notifications.js
 */

const { Client, Databases } = require('node-appwrite');
require('dotenv').config();

// Appwrite configuration
const client = new Client()
    .setEndpoint(process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1')
    .setProject(process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY); // You'll need an API key for this

const databases = new Databases(client);

const DATABASE_ID = process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID;
const TRAVEL_COLLECTION_ID = process.env.EXPO_PUBLIC_APPWRITE_TRAVEL_COLLECTION_ID;

async function setupTravelFriendNotifications() {
    console.log('🌍 Setting up Travel Friend Notifications...\n');

    try {
        // 1. Add destination coordinates for location matching
        console.log('📍 Adding destination coordinates...');

        try {
            await databases.createDoubleAttribute(
                DATABASE_ID,
                TRAVEL_COLLECTION_ID,
                'destinationLat',
                false // not required
            );
            console.log('✅ destinationLat attribute created');
        } catch (error) {
            if (error.message?.includes('already exists')) {
                console.log('✓ destinationLat attribute already exists');
            } else {
                throw error;
            }
        }

        try {
            await databases.createDoubleAttribute(
                DATABASE_ID,
                TRAVEL_COLLECTION_ID,
                'destinationLng',
                false // not required
            );
            console.log('✅ destinationLng attribute created');
        } catch (error) {
            if (error.message?.includes('already exists')) {
                console.log('✓ destinationLng attribute already exists');
            } else {
                throw error;
            }
        }

        // 2. Add location name for user-friendly display
        console.log('\n🏷️ Adding location name...');

        try {
            await databases.createStringAttribute(
                DATABASE_ID,
                TRAVEL_COLLECTION_ID,
                'locationName',
                500,
                false // not required
            );
            console.log('✅ locationName attribute created');
        } catch (error) {
            if (error.message?.includes('already exists')) {
                console.log('✓ locationName attribute already exists');
            } else {
                throw error;
            }
        }

        // 3. Add friends notified tracking
        console.log('\n👥 Adding friends notification tracking...');

        try {
            await databases.createStringAttribute(
                DATABASE_ID,
                TRAVEL_COLLECTION_ID,
                'friendsNotified',
                5000,
                false, // not required
                undefined, // default value
                true // array
            );
            console.log('✅ friendsNotified attribute created');
        } catch (error) {
            if (error.message?.includes('already exists')) {
                console.log('✓ friendsNotified attribute already exists');
            } else {
                throw error;
            }
        }

        // Wait a moment for attributes to be ready
        console.log('\n⏳ Waiting for attributes to be ready...');
        await new Promise(resolve => setTimeout(resolve, 5000));

        // 4. Create indexes for efficient queries
        console.log('\n📊 Creating performance indexes...');

        // Location-based queries (CRITICAL for friend discovery)
        try {
            await databases.createIndex(
                DATABASE_ID,
                TRAVEL_COLLECTION_ID,
                'destination_coordinates',
                'key',
                ['destinationLat', 'destinationLng']
            );
            console.log('✅ destination_coordinates index created');
        } catch (error) {
            if (error.message?.includes('already exists')) {
                console.log('✓ destination_coordinates index already exists');
            } else {
                console.warn('⚠️ Could not create destination_coordinates index:', error.message);
            }
        }

        // Location + time overlap queries (CRITICAL for friend matching)
        try {
            await databases.createIndex(
                DATABASE_ID,
                TRAVEL_COLLECTION_ID,
                'location_time_overlap',
                'key',
                ['destinationLat', 'destinationLng', 'startDate', 'endDate']
            );
            console.log('✅ location_time_overlap index created');
        } catch (error) {
            if (error.message?.includes('already exists')) {
                console.log('✓ location_time_overlap index already exists');
            } else {
                console.warn('⚠️ Could not create location_time_overlap index:', error.message);
            }
        }

        // User's travel posts (for getting user's travel history)
        try {
            await databases.createIndex(
                DATABASE_ID,
                TRAVEL_COLLECTION_ID,
                'user_travel_posts',
                'key',
                ['userId']
            );
            console.log('✅ user_travel_posts index created');
        } catch (error) {
            if (error.message?.includes('already exists')) {
                console.log('✓ user_travel_posts index already exists');
            } else {
                console.warn('⚠️ Could not create user_travel_posts index:', error.message);
            }
        }

        // Friends notification tracking
        try {
            await databases.createIndex(
                DATABASE_ID,
                TRAVEL_COLLECTION_ID,
                'friends_notified',
                'key',
                ['friendsNotified']
            );
            console.log('✅ friends_notified index created');
        } catch (error) {
            if (error.message?.includes('already exists')) {
                console.log('✓ friends_notified index already exists');
            } else {
                console.warn('⚠️ Could not create friends_notified index:', error.message);
            }
        }

        console.log('\n🎉 Travel Friend Notifications setup complete!');
        console.log('\n📋 Summary:');
        console.log('✅ Added destination coordinates (destinationLat, destinationLng)');
        console.log('✅ Added location name (locationName)');
        console.log('✅ Added friends notification tracking (friendsNotified)');
        console.log('✅ Created performance indexes for location queries');
        console.log('\n🚀 Ready to use! Check TRAVEL_FRIEND_NOTIFICATIONS_COMPLETE.md for implementation guide.');

    } catch (error) {
        console.error('❌ Setup failed:', error);
        console.log('\n🔧 Troubleshooting:');
        console.log('1. Make sure APPWRITE_API_KEY is set in your .env file');
        console.log('2. Ensure your API key has database permissions');
        console.log('3. Check that EXPO_PUBLIC_APPWRITE_DATABASE_ID and EXPO_PUBLIC_APPWRITE_TRAVEL_COLLECTION_ID are correct');
        console.log('\n📚 Get API key from: https://cloud.appwrite.io/console/project-[PROJECT_ID]/overview/keys');
    }
}

// Run the setup
if (require.main === module) {
    setupTravelFriendNotifications();
}

module.exports = { setupTravelFriendNotifications };
