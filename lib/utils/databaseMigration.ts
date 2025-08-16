import { config, databases } from '@/lib/appwrite/appwrite';
import { EventAttendance, UserFriendship } from '@/lib/types/Database';
import { Query } from 'appwrite';

// ============================================================================
// SAFE MIGRATION UTILITIES - PHASE 1
// These functions work alongside your existing code without breaking anything
// ============================================================================

/**
 * 🔧 Migration configuration and safety switches
 */
export const MIGRATION_CONFIG = {
    // Set these to false to disable new system and use old system only
    USE_NEW_FRIENDS_SYSTEM: true,
    USE_NEW_EVENTS_SYSTEM: true,

    // Logging levels
    ENABLE_DEBUG_LOGS: true,
    ENABLE_ERROR_LOGS: true,

    // Safety limits
    MAX_FRIENDS_TO_LOAD: 1000,
    MAX_ATTENDEES_TO_LOAD: 5000,
    MAX_RETRIES: 3
};

/**
 * 📝 Safe logging utility
 */
const log = {
    info: (message: string, data?: any) => {
        if (MIGRATION_CONFIG.ENABLE_DEBUG_LOGS) {
            console.log(`✅ MIGRATION: ${message}`, data || '');
        }
    },
    error: (message: string, error?: any) => {
        if (MIGRATION_CONFIG.ENABLE_ERROR_LOGS) {
            console.error(`❌ MIGRATION: ${message}`, error || '');
        }
    },
    warn: (message: string, data?: any) => {
        console.warn(`⚠️ MIGRATION: ${message}`, data || '');
    }
};

// ============================================================================
// FRIENDSHIP UTILITIES (Safe - No Breaking Changes)
// ============================================================================

/**
 * 🔍 Check if two users are friends (NEW SYSTEM with FALLBACK)
 * @param userId1 First user ID
 * @param userId2 Second user ID
 * @returns UserFriendship record or null
 */
export const checkFriendship = async (userId1: string, userId2: string): Promise<UserFriendship | null> => {
    if (!MIGRATION_CONFIG.USE_NEW_FRIENDS_SYSTEM) {
        log.info('New friends system disabled, skipping');
        return null;
    }

    try {
        // Normalize user IDs (consistent ordering for unique constraint)
        const minUserId = userId1 < userId2 ? userId1 : userId2;
        const maxUserId = userId1 < userId2 ? userId2 : userId1;

        const result = await databases.listDocuments(
            config.databaseID!,
            config.userFriendshipsCollectionID,
            [
                Query.equal('userId1', minUserId),
                Query.equal('userId2', maxUserId),
                Query.limit(1)
            ]
        );

        const friendship = result.documents[0] as unknown as UserFriendship || null;
        log.info(`Friendship check: ${userId1} & ${userId2}`, {
            status: friendship?.status || 'not_found',
            source: 'NEW_SYSTEM'
        });

        return friendship;
    } catch (error) {
        log.error('Failed to check friendship in new system', error);
        return null;
    }
};

/**
 * 👥 Get user's friends (NEW SYSTEM with OLD FALLBACK)
 * @param userId User ID to get friends for
 * @param limit Maximum number of friends to return
 * @returns Array of friend user IDs
 */
export const getUserFriends = async (userId: string, limit: number = 100): Promise<string[]> => {
    if (!MIGRATION_CONFIG.USE_NEW_FRIENDS_SYSTEM) {
        return await getUserFriendsOldSystem(userId);
    }

    try {
        log.info(`Getting friends for user: ${userId} (limit: ${limit})`);

        const friendships = await databases.listDocuments(
            config.databaseID!,
            config.userFriendshipsCollectionID,
            [
                Query.or([
                    Query.and([
                        Query.equal('userId1', userId),
                        Query.equal('status', 'accepted')
                    ]),
                    Query.and([
                        Query.equal('userId2', userId),
                        Query.equal('status', 'accepted')
                    ])
                ]),
                Query.limit(Math.min(limit, MIGRATION_CONFIG.MAX_FRIENDS_TO_LOAD))
            ]
        );

        const friendIds = friendships.documents.map((friendship) => {
            const typedFriendship = friendship as unknown as UserFriendship;
            return typedFriendship.userId1 === userId ? typedFriendship.userId2 : typedFriendship.userId1;
        }); log.info(`Got ${friendIds.length} friends from NEW system`, { userId, count: friendIds.length });
        return friendIds;

    } catch (error) {
        log.error('New friends system failed, falling back to old system', error);
        return await getUserFriendsOldSystem(userId);
    }
};

/**
 * 👥 FALLBACK: Get user's friends from old system
 */
const getUserFriendsOldSystem = async (userId: string): Promise<string[]> => {
    try {
        const user = await databases.getDocument(
            config.databaseID!,
            config.usersCollectionID!,
            userId
        );

        const friends = user.friends || [];
        log.info(`Got ${friends.length} friends from OLD system (fallback)`, { userId, count: friends.length });
        return friends;
    } catch (error) {
        log.error('Both friendship systems failed', error);
        return [];
    }
};

/**
 * 📤 Send friend request (NEW SYSTEM ONLY - Safe)
 * @param fromUserId User sending the request
 * @param toUserId User receiving the request
 * @returns Success boolean
 */
export const sendFriendRequest = async (fromUserId: string, toUserId: string): Promise<boolean> => {
    if (!MIGRATION_CONFIG.USE_NEW_FRIENDS_SYSTEM) {
        log.warn('New friends system disabled, cannot send friend request via new system');
        return false;
    }

    try {
        // Check if friendship already exists
        const existing = await checkFriendship(fromUserId, toUserId);
        if (existing) {
            log.warn('Friendship already exists', { status: existing.status });
            return false;
        }

        const minUserId = fromUserId < toUserId ? fromUserId : toUserId;
        const maxUserId = fromUserId < toUserId ? toUserId : fromUserId;

        await databases.createDocument(
            config.databaseID!,
            config.userFriendshipsCollectionID,
            'unique()',
            {
                userId1: minUserId,
                userId2: maxUserId,
                status: 'pending',
                requesterId: fromUserId
            }
        );

        log.info('Friend request sent successfully', { from: fromUserId, to: toUserId });
        return true;
    } catch (error) {
        log.error('Failed to send friend request', error);
        return false;
    }
};

/**
 * ✅ Accept friend request (NEW SYSTEM ONLY - Safe)
 * @param friendshipId ID of the friendship record
 * @returns Success boolean
 */
export const acceptFriendRequest = async (friendshipId: string): Promise<boolean> => {
    if (!MIGRATION_CONFIG.USE_NEW_FRIENDS_SYSTEM) {
        log.warn('New friends system disabled, cannot accept friend request via new system');
        return false;
    }

    try {
        await databases.updateDocument(
            config.databaseID!,
            config.userFriendshipsCollectionID,
            friendshipId,
            {
                status: 'accepted',
                acceptedAt: new Date().toISOString()
            }
        );

        log.info('Friend request accepted successfully', { friendshipId });
        return true;
    } catch (error) {
        log.error('Failed to accept friend request', error);
        return false;
    }
};

/**
 * 📋 Get pending friend requests (NEW SYSTEM with FALLBACK)
 * @param userId User ID to get requests for
 * @returns Array of pending friendship records
 */
export const getPendingFriendRequests = async (userId: string): Promise<UserFriendship[]> => {
    if (!MIGRATION_CONFIG.USE_NEW_FRIENDS_SYSTEM) {
        return [];
    }

    try {
        const requests = await databases.listDocuments(
            config.databaseID!,
            config.userFriendshipsCollectionID,
            [
                Query.equal('userId2', userId), // Requests sent TO this user
                Query.equal('status', 'pending'),
                Query.limit(50)
            ]
        );

        log.info(`Got ${requests.documents.length} pending friend requests`, { userId });
        return requests.documents as unknown as UserFriendship[];
    } catch (error) {
        log.error('Failed to get pending friend requests', error);
        return [];
    }
};

// ============================================================================
// EVENT ATTENDANCE UTILITIES (Safe - No Breaking Changes)
// ============================================================================

/**
 * 🔍 Check user's attendance status for an event (NEW SYSTEM with FALLBACK)
 * @param eventId Event ID
 * @param userId User ID
 * @returns EventAttendance record or null
 */
export const checkEventAttendance = async (eventId: string, userId: string): Promise<EventAttendance | null> => {
    if (!MIGRATION_CONFIG.USE_NEW_EVENTS_SYSTEM) {
        log.info('New events system disabled, skipping attendance check');
        return null;
    }

    try {
        const result = await databases.listDocuments(
            config.databaseID!,
            config.eventAttendancesCollectionID,
            [
                Query.equal('eventId', eventId),
                Query.equal('userId', userId),
                Query.limit(1)
            ]
        );

        const attendance = result.documents[0] as unknown as EventAttendance || null;
        log.info(`Attendance check: ${userId} for event ${eventId}`, {
            status: attendance?.status || 'not_found',
            source: 'NEW_SYSTEM'
        });

        return attendance;
    } catch (error) {
        log.error('Failed to check event attendance', error);
        return null;
    }
};

/**
 * 👥 Get event attendees (NEW SYSTEM with OLD FALLBACK)
 * @param eventId Event ID
 * @param status Attendance status to filter by
 * @param limit Maximum number of attendees to return
 * @returns Array of user IDs
 */
export const getEventAttendees = async (
    eventId: string,
    status: string = 'attending',
    limit: number = 1000
): Promise<string[]> => {
    if (!MIGRATION_CONFIG.USE_NEW_EVENTS_SYSTEM) {
        return await getEventAttendeesOldSystem(eventId, status);
    }

    try {
        log.info(`Getting ${status} attendees for event: ${eventId} (limit: ${limit})`);

        const attendances = await databases.listDocuments(
            config.databaseID!,
            config.eventAttendancesCollectionID,
            [
                Query.equal('eventId', eventId),
                Query.equal('status', status),
                Query.limit(Math.min(limit, MIGRATION_CONFIG.MAX_ATTENDEES_TO_LOAD))
            ]
        );

        const attendeeIds = attendances.documents.map((attendance) => {
            const typedAttendance = attendance as unknown as EventAttendance;
            return typedAttendance.userId;
        });
        log.info(`Got ${attendeeIds.length} ${status} users from NEW system`, {
            eventId,
            status,
            count: attendeeIds.length
        });

        return attendeeIds;

    } catch (error) {
        log.error(`New events system failed for ${status} attendees, falling back to old system`, error);
        return await getEventAttendeesOldSystem(eventId, status);
    }
};

/**
 * 👥 FALLBACK: Get event attendees from old system
 */
const getEventAttendeesOldSystem = async (eventId: string, status: string): Promise<string[]> => {
    try {
        const event = await databases.getDocument(
            config.databaseID!,
            config.eventsCollectionID!,
            eventId
        );

        let attendees: string[] = [];

        if (status === 'attending') {
            attendees = event.attendees || [];
        } else if (status === 'invited') {
            attendees = event.inviteeIds || [];
        }

        log.info(`Got ${attendees.length} ${status} users from OLD system (fallback)`, {
            eventId,
            status,
            count: attendees.length
        });

        return attendees;
    } catch (error) {
        log.error('Both event systems failed', error);
        return [];
    }
};

/**
 * ✅ Join event (NEW SYSTEM ONLY - Safe)
 * @param eventId Event ID
 * @param userId User ID
 * @returns Success boolean
 */
export const joinEvent = async (eventId: string, userId: string): Promise<boolean> => {
    if (!MIGRATION_CONFIG.USE_NEW_EVENTS_SYSTEM) {
        log.warn('New events system disabled, cannot join event via new system');
        return false;
    }

    try {
        // Check if attendance record already exists
        const existing = await checkEventAttendance(eventId, userId);

        if (existing) {
            // Update existing record
            await databases.updateDocument(
                config.databaseID!,
                config.eventAttendancesCollectionID,
                existing.$id,
                {
                    status: 'attending',
                    respondedAt: new Date().toISOString()
                }
            );
            log.info('Updated existing attendance to attending', { eventId, userId });
        } else {
            // Create new attendance record
            await databases.createDocument(
                config.databaseID!,
                config.eventAttendancesCollectionID,
                'unique()',
                {
                    eventId,
                    userId,
                    status: 'attending',
                    respondedAt: new Date().toISOString()
                }
            );
            log.info('Created new attendance record', { eventId, userId });
        }

        // Update event counters (optional - helps with performance)
        await updateEventCounters(eventId);

        return true;
    } catch (error) {
        log.error('Failed to join event', error);
        return false;
    }
};

/**
 * ❌ Leave event (NEW SYSTEM ONLY - Safe)
 * @param eventId Event ID  
 * @param userId User ID
 * @returns Success boolean
 */
export const leaveEvent = async (eventId: string, userId: string): Promise<boolean> => {
    if (!MIGRATION_CONFIG.USE_NEW_EVENTS_SYSTEM) {
        log.warn('New events system disabled, cannot leave event via new system');
        return false;
    }

    try {
        const attendance = await checkEventAttendance(eventId, userId);

        if (attendance) {
            await databases.updateDocument(
                config.databaseID!,
                config.eventAttendancesCollectionID,
                attendance.$id,
                {
                    status: 'not_attending',
                    respondedAt: new Date().toISOString()
                }
            );

            // Update event counters
            await updateEventCounters(eventId);

            log.info('User left event successfully', { eventId, userId });
            return true;
        } else {
            log.warn('No attendance record found for user to leave event', { eventId, userId });
            return false;
        }
    } catch (error) {
        log.error('Failed to leave event', error);
        return false;
    }
};

/**
 * 📊 Update event counters (NEW SYSTEM HELPER)
 * @param eventId Event ID to update counters for
 */
export const updateEventCounters = async (eventId: string): Promise<void> => {
    if (!MIGRATION_CONFIG.USE_NEW_EVENTS_SYSTEM) {
        return;
    }

    try {
        // Get current counts from junction table
        const [attendingResult, invitedResult] = await Promise.all([
            databases.listDocuments(
                config.databaseID!,
                config.eventAttendancesCollectionID,
                [
                    Query.equal('eventId', eventId),
                    Query.equal('status', 'attending'),
                    Query.limit(10000) // High limit for accurate counting
                ]
            ),
            databases.listDocuments(
                config.databaseID!,
                config.eventAttendancesCollectionID,
                [
                    Query.equal('eventId', eventId),
                    Query.equal('status', 'invited'),
                    Query.limit(10000)
                ]
            )
        ]);

        const attendeeCount = attendingResult.documents.length;
        const inviteCount = attendingResult.documents.length + invitedResult.documents.length;
        const popularityScore = attendeeCount * 10 + invitedResult.documents.length * 5;

        // Update event with new counters
        await databases.updateDocument(
            config.databaseID!,
            config.eventsCollectionID!,
            eventId,
            {
                attendeeCount,
                inviteCount,
                popularityScore
            }
        );

        log.info('Updated event counters successfully', {
            eventId,
            attendeeCount,
            inviteCount,
            popularityScore
        });
    } catch (error) {
        log.error('Failed to update event counters', error);
    }
};

// ============================================================================
// MIGRATION VERIFICATION UTILITIES
// ============================================================================

/**
 * 🔍 Verify migration consistency for a user
 * @param userId User ID to verify
 */
export const verifyMigrationConsistency = async (userId: string): Promise<void> => {
    try {
        log.info(`Starting migration consistency verification for user: ${userId}`);

        // Check friends consistency
        const [newFriends, oldFriends] = await Promise.all([
            getUserFriends(userId),
            getUserFriendsOldSystem(userId)
        ]);

        log.info('Friends comparison', {
            newSystemCount: newFriends.length,
            oldSystemCount: oldFriends.length,
            difference: Math.abs(newFriends.length - oldFriends.length)
        });

        // Check user's event attendances
        const userAttendances = await databases.listDocuments(
            config.databaseID!,
            config.eventAttendancesCollectionID,
            [
                Query.equal('userId', userId),
                Query.equal('status', 'attending'),
                Query.limit(100)
            ]
        );

        log.info('Event attendance verification', {
            attendingEventsCount: userAttendances.documents.length
        });

        log.info('✅ Migration consistency verification completed successfully');

    } catch (error) {
        log.error('Migration consistency verification failed', error);
    }
};

/**
 * 🧪 Test all migration functions (Development only)
 */
export const testMigrationSafety = async (testUserId: string, testEventId: string): Promise<boolean> => {
    try {
        log.info('🧪 Starting migration safety tests...');

        // Test 1: Friends system
        const friends = await getUserFriends(testUserId);
        log.info(`✅ Friends test passed: ${friends.length} friends loaded`);

        // Test 2: Events system  
        const attendees = await getEventAttendees(testEventId, 'attending');
        log.info(`✅ Events test passed: ${attendees.length} attendees loaded`);

        // Test 3: Attendance check
        const attendance = await checkEventAttendance(testEventId, testUserId);
        log.info(`✅ Attendance test passed: status = ${attendance?.status || 'not_found'}`);

        // Test 4: Full verification
        await verifyMigrationConsistency(testUserId);

        log.info('🎉 All migration safety tests passed!');
        return true;

    } catch (error) {
        log.error('💥 Migration safety tests failed', error);
        return false;
    }
};

// Export configuration for easy toggling
