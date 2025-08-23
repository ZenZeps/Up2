/**
 * Utility helpers for sanitizing payloads before sending to Appwrite.
 * Appwrite manages system timestamps like $createdAt / $updatedAt itself; sending
 * custom `createdAt` or `updatedAt` attributes can cause document_invalid_structure
 * if the collection schema doesn't include them. Use these helpers to strip those
 * fields before calling databases.createDocument/updateDocument.
 */
export function stripSystemTimestamps<T extends Record<string, any>>(payload: T): T {
    const copy = { ...payload } as Record<string, any>;
    if ('createdAt' in copy) delete copy.createdAt;
    if ('updatedAt' in copy) delete copy.updatedAt;
    return copy as T;
}

export default { stripSystemTimestamps };
