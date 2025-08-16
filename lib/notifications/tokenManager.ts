// Temporary notification token storage until database attributes are added
// This will store tokens in memory - they'll be lost on app restart
// TODO: Replace with proper database storage once attributes are added

class NotificationTokenManager {
    private tokens = new Map<string, { token: string; enabled: boolean }>();

    setUserToken(userId: string, token: string, enabled: boolean = true) {
        this.tokens.set(userId, { token, enabled });
        console.log(`📱 Token stored for user ${userId}: ${token.substring(0, 20)}...`);
    }

    getUserToken(userId: string): { token: string; enabled: boolean } | null {
        return this.tokens.get(userId) || null;
    }

    removeUserToken(userId: string) {
        this.tokens.delete(userId);
    }

    getAllTokens(): Array<{ userId: string; token: string; enabled: boolean }> {
        return Array.from(this.tokens.entries()).map(([userId, data]) => ({
            userId,
            ...data
        }));
    }

    isUserNotificationEnabled(userId: string): boolean {
        const tokenData = this.tokens.get(userId);
        return tokenData?.enabled ?? false;
    }
}

export const notificationTokenManager = new NotificationTokenManager();
