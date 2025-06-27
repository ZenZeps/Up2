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
    startTime: doc.startTime,
    endTime: doc.endTime,
    creatorId: doc.creatorId,
    inviteeIds: doc.inviteeIds,
    description: doc.description,
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

export async function getAllEvents() {
  try {
    const res = await databases.listDocuments(
      config.databaseID!,
      config.eventsCollectionID!
    );

    return res.documents;
  } catch (err) {
    console.error("Error fetching events:", err);
    return [];
  }
}


export async function getEventById(id: string) {
  try {
    const doc = await databases.getDocument(
      config.databaseID!,
      config.eventsCollectionID!,
      id
    );
    return doc;
  } catch (err) {
    console.error('Error fetching event by ID:', err);
    return null;
  }
}