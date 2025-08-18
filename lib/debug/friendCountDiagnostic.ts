/**
 * Friend Count Diagnostic Tool
 * 
 * Helps diagnose and fix friend count synchronization issues.
 */

import { fixUserFriendCount, getUserFriends } from '../api/friendship';
import { getUserProfile } from '../api/user';
import { authDebug } from '../debug/authDebug';

export interface FriendCountDiagnostic {
    userId: string;
    profileFriendCount: number;
    actualFriendCount: number;
    isConsistent: boolean;
    friendIds: string[];
}

/**
 * Diagnose friend count consistency for a user
 */
export async function diagnoseFriendCount(userId: string): Promise<FriendCountDiagnostic> {
    try {
        // Get profile and actual friends in parallel
        const [userProfile, friendIds] = await Promise.all([
            getUserProfile(userId),
            getUserFriends(userId)
        ]);

        const profileFriendCount = userProfile?.friendCount || 0;
        const actualFriendCount = friendIds.length;
        const isConsistent = profileFriendCount === actualFriendCount;

        const diagnostic: FriendCountDiagnostic = {
            userId,
            profileFriendCount,
            actualFriendCount,
            isConsistent,
            friendIds
        };

        authDebug.info(`Friend count diagnostic for ${userId}:`, {
            profile: profileFriendCount,
            actual: actualFriendCount,
            consistent: isConsistent
        });

        return diagnostic;
    } catch (error) {
        authDebug.error(`Error diagnosing friend count for ${userId}:`, error);
        return {
            userId,
            profileFriendCount: 0,
            actualFriendCount: 0,
            isConsistent: false,
            friendIds: []
        };
    }
}

/**
 * Auto-fix friend count for a user if inconsistent
 */
export async function autoFixFriendCount(userId: string): Promise<{
    fixed: boolean;
    oldCount: number;
    newCount: number;
    diagnostic: FriendCountDiagnostic;
}> {
    try {
        // First diagnose the issue
        const diagnostic = await diagnoseFriendCount(userId);

        if (diagnostic.isConsistent) {
            return {
                fixed: false,
                oldCount: diagnostic.profileFriendCount,
                newCount: diagnostic.actualFriendCount,
                diagnostic
            };
        }

        // Fix the inconsistency
        const fixResult = await fixUserFriendCount(userId);

        // Re-diagnose to confirm fix
        const postFixDiagnostic = await diagnoseFriendCount(userId);

        return {
            fixed: fixResult.success,
            oldCount: fixResult.oldCount,
            newCount: fixResult.newCount,
            diagnostic: postFixDiagnostic
        };
    } catch (error) {
        authDebug.error(`Error auto-fixing friend count for ${userId}:`, error);
        const diagnostic = await diagnoseFriendCount(userId);
        return {
            fixed: false,
            oldCount: 0,
            newCount: 0,
            diagnostic
        };
    }
}

/**
 * Get a detailed report of friend count issues
 */
export async function generateFriendCountReport(userId: string): Promise<string> {
    try {
        const diagnostic = await diagnoseFriendCount(userId);

        let report = `=== Friend Count Report for User: ${userId} ===\n\n`;
        report += `Profile Friend Count: ${diagnostic.profileFriendCount}\n`;
        report += `Actual Friend Count: ${diagnostic.actualFriendCount}\n`;
        report += `Status: ${diagnostic.isConsistent ? '✅ CONSISTENT' : '❌ INCONSISTENT'}\n\n`;

        if (diagnostic.friendIds.length > 0) {
            report += `Friend IDs (${diagnostic.friendIds.length}):\n`;
            diagnostic.friendIds.forEach((friendId, index) => {
                report += `  ${index + 1}. ${friendId}\n`;
            });
        } else {
            report += 'No friends found.\n';
        }

        if (!diagnostic.isConsistent) {
            report += `\n⚠️ ISSUE DETECTED: Database friendCount (${diagnostic.profileFriendCount}) does not match actual friendships (${diagnostic.actualFriendCount})\n`;
            report += `Recommendation: Run autoFixFriendCount() to resolve this inconsistency.\n`;
        }

        return report;
    } catch (error) {
        return `Error generating friend count report for ${userId}: ${error}`;
    }
}
