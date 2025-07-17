import { Event } from '@/lib/types/Events';
import { UserProfile } from '@/lib/types/Users';

export const validateInput = {
    email: (email: string): boolean => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    },

    password: (password: string): boolean => {
        // Require at least one uppercase, one lowercase, one number, and one special character
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        return passwordRegex.test(password);
    },

    name: (name: string): boolean => {
        return name.length >= 2 && name.length <= 50 && /^[a-zA-Z\s-']+$/.test(name);
    },

    firstName: (firstName: string): boolean => {
        return firstName.length >= 1 && firstName.length <= 25 && /^[a-zA-Z\s-']+$/.test(firstName);
    },

    lastName: (lastName: string): boolean => {
        return lastName.length >= 1 && lastName.length <= 25 && /^[a-zA-Z\s-']+$/.test(lastName);
    },

    // File validation for future profile photo upload
    imageFile: (file: File): boolean => {
        const validTypes = ['image/jpeg', 'image/png', 'image/gif'];
        const maxSize = 5 * 1024 * 1024; // 5MB
        return validTypes.includes(file.type) && file.size <= maxSize;
    },

    // Profile validation
    profile: (profile: Partial<UserProfile>): boolean => {
        if (!profile) return false;
        if (profile.firstName && !validateInput.firstName(profile.firstName)) return false;
        if (profile.lastName && !validateInput.lastName(profile.lastName)) return false;
        if (profile.email && !validateInput.email(profile.email)) return false;
        return true;
    },

    // Event validation
    event: (event: Partial<Event>): boolean => {
        if (!event) return false;
        if (!event.title || event.title.length < 3) return false;
        if (!event.startTime || !event.endTime) return false;
        if (new Date(event.startTime) >= new Date(event.endTime)) return false;
        return true;
    }
};

export const sanitizeInput = {
    text: (input: string): string => {
        // Remove potentially dangerous characters and HTML
        return input
            .replace(/<[^>]*>/g, '') // Remove HTML tags
            .replace(/[<>]/g, '') // Remove < and >
            .trim();
    },

    name: (name: string): string => {
        return name
            .replace(/[^a-zA-Z\s-']/g, '') // Only allow letters, spaces, hyphens, and apostrophes
            .trim();
    }
};

export const errorMessages = {
    email: 'Please enter a valid email address',
    password: 'Password must be at least 8 characters long and contain uppercase, lowercase, number, and special character',
    name: 'Name must be 2-50 characters long and contain only letters, spaces, hyphens, and apostrophes',
    imageFile: 'Please upload an image file (JPEG, PNG, or GIF) under 5MB',
    event: {
        title: 'Event title must be at least 3 characters long',
        time: 'End time must be after start time'
    }
}; 