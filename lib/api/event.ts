import { databases } from "@/lib/appwrite";
import { config } from "@/lib/appwrite";
import { Event } from "@/app/(root)/types/Events";

export async function fetchEvents(): Promise<Event[]> {
  const res = await databases.listDocuments(
    config.databaseID!,
    config.eventsCollectionID!
  );

  return res.documents.map((doc): Event => ({
    id: doc.$id,
    title: doc.title,
    location: doc.location,
    dateTime: doc.dateTime,
    duration: doc.duration,
    creatorId: doc.creatorId,
    inviteeIds: doc.inviteeIds,
  }));
}

export async function fetchEventById(id: string): Promise<Event | null> {
  try {
    const doc = await databases.getDocument(
      config.databaseID!,
      config.eventsCollectionID!,
      id
    );
    return {
      id: doc.$id,
      title: doc.title,
      location: doc.location,
      dateTime: doc.dateTime,
      duration: doc.duration,
      creatorId: doc.creatorId,
      inviteeIds: doc.inviteeIds,
    };
  } catch (err) {
    return null;
  }
}

