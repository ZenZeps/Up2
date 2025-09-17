// Debug import test - now using dynamic import to avoid binding issues
export default async function testImport() {
    try {
        const { getFriendsTravelAnnouncements } = await import('@/lib/api');
        console.log('getFriendsTravelAnnouncements (dynamic):', typeof getFriendsTravelAnnouncements);
        return getFriendsTravelAnnouncements;
    } catch (err) {
        console.error('Dynamic import failed:', err);
        return null;
    }
}
