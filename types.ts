
export interface User {
  id: string;
  name: string;
  avatarUrl: string;
  isSelf: boolean;
}

export type MessageType = 'text' | 'image' | 'sticker' | 'file' | 'location' | 'voice';

export type ContactType = 'user' | 'group' | 'channel';

export interface GroupMember {
  id: string;
  name: string;
  avatarUrl: string;
  role: 'admin' | 'member' | 'owner';
  lastSeen?: string;
}

export interface Message {
  id: string;
  text: string;
  senderId: string;
  timestamp: number;
  status: 'sending' | 'sent' | 'read' | 'error';
  type?: MessageType;
  attachmentUrl?: string; // For images/stickers/files/voice
  fileName?: string;      // For files
  fileSize?: string;      // For files
  latitude?: number;      // For location
  longitude?: number;     // For location
  duration?: number;      // For voice messages (seconds)
}

export interface Contact {
  id: string;
  name: string;
  avatarUrl: string;
  lastMessage?: string;
  lastMessageTime?: number;
  unreadCount: number;
  isOnline: boolean;
  systemInstruction?: string; // For Gemini persona
  type: ContactType;
  membersCount?: number;
  members?: GroupMember[]; // Added for Groups
  email?: string; // For user profile info
  description?: string; // For groups/channels
  settings?: {
      historyVisible?: boolean;
      sendMessages?: boolean;
      autoDeleteMessages?: number; // Added: 0 = off, otherwise seconds
  };
}

export interface ChatSession {
  contactId: string;
  messages: Message[];
  draft: string;
}

export enum SendingStatus {
  Idle = 'idle',
  Loading = 'loading',
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  username?: string; // New field for Telegram-style username
}

export interface DeviceSession {
  id: string;
  name: string;
  platform: string;
  lastActive: string;
  isCurrent: boolean;
  icon: 'desktop' | 'mobile' | 'tablet';
}

export interface AppSettings {
  notifications: {
    show: boolean;
    preview: boolean;
    sound: boolean;
    chatSounds: boolean;
    vibration: boolean;
  };
  privacy: {
    email: 'Все' | 'Мои контакты' | 'Никто'; // Changed from phoneNumber
    lastSeen: 'Все' | 'Мои контакты' | 'Никто';
    profilePhoto: 'Все' | 'Мои контакты' | 'Никто';
    passcode: boolean;
    twoFactor: boolean;
  };
  appearance: {
    darkMode: boolean;
    chatBackground: string; // css class for background color
    textSize: number; // percentage, 100 is default
  };
  language: string;
}

// Data structure stored in DB for each user
export interface UserData {
    profile: UserProfile;
    contacts: Contact[];
    chatHistory: Record<string, Message[]>;
    settings: AppSettings;
    devices: DeviceSession[];
}
