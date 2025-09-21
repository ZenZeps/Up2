import { stripSystemTimestamps } from '@/lib/utils/appwriteSanitizer';
import { databases } from './appwrite';

/**
 * Safe wrappers around Appwrite database write operations.
 * These strip `createdAt` / `updatedAt` (custom) fields from payloads before
 * sending to Appwrite to avoid document_invalid_structure errors when the
 * collection schema doesn't include custom timestamp attributes.
 */
export async function createDocumentSafe(databaseId: string, collectionId: string, documentId: string, payload: any, permissions?: any) {
    const clean = stripSystemTimestamps(payload);
    // Diagnostic logging
    try {
        console.log('safeDb: createDocumentSafe called with', {
            databaseId,
            collectionId,
            documentId,
            dataKeys: Object.keys(clean),
            hasPermissions: !!permissions,
        });
    } catch (e) {
        // ignore logging errors
    }

    if (permissions) {
        return await databases.createDocument(databaseId, collectionId, documentId, clean, permissions as any);
    }
    return await databases.createDocument(databaseId, collectionId, documentId, clean);
}

export async function updateDocumentSafe(databaseId: string, collectionId: string, documentId: string, payload: any) {
    const clean = stripSystemTimestamps(payload);
    return await databases.updateDocument(databaseId, collectionId, documentId, clean);
}

export default { createDocumentSafe, updateDocumentSafe };
