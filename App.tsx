import React, { useState, useEffect, useCallback } from 'react';
import { CURRENT_USER_ID, INITIAL_DEVICES, INITIAL_SETTINGS } from './constants';
import { Message, Contact, MessageType, AppSettings, DeviceSession, ContactType, UserProfile, UserData } from './types';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';
import SettingsModal from './components/SettingsModal';
import CreateChatModal from './components/CreateChatModal';
import AuthScreen from './components/AuthScreen';
import ProfileInfo from './components/ProfileInfo';
import { geminiService } from './services/geminiService';
import { db } from './services/db';
import { socketService } from './services/socketService';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // Data State
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [chatHistory, setChatHistory] = useState<Record<string, Message[]>>({});
  const [settings, setSettings] = useState<AppSettings>(INITIAL_SETTINGS);
  const [devices, setDevices] = useState<DeviceSession[]>(INITIAL_DEVICES);
  const [userProfile, setUserProfile] = useState<UserProfile>({
      id: '', name: '', email: '', avatarUrl: ''
  });

  const [activeContactId, setActiveContactId] = useState<string | null>(null);
  const [typingStatus, setTypingStatus] = useState<Record<string, boolean>>({});
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProfileInfoOpen, setIsProfileInfoOpen] = useState(false);
  
  // Create Chat State
  const [isCreateChatOpen, setIsCreateChatOpen] = useState(false);
  const [createChatType, setCreateChatType] = useState<ContactType>('group');

  // Load User Data Wrapper
  const loadUserData = async (userId: string) => {
      try {
          const data = await db.fetchUserData(userId);
          setUserProfile(data.profile);
          setContacts(data.contacts);
          setChatHistory(data.chatHistory);
          setSettings(data.settings);
          setDevices(data.devices);
          setIsAuthenticated(true);
          
          // Connect Socket
          socketService.connect(userId);
      } catch (error) {
          console.error("Failed to load user data:", error);
          db.logout();
          setIsAuthenticated(false);
      }
  };

  // Socket Listeners
  useEffect(() => {
    if (isAuthenticated && userProfile.id) {
        socketService.onReceiveMessage((msg) => {
            const contactId = msg.senderId;
            
            setChatHistory(prev => {
                const currentMsgs = prev[contactId] || [];
                // Prevent duplicates
                if (currentMsgs.find(m => m.id === msg.id)) return prev;
                return { ...prev, [contactId]: [...currentMsgs, msg] };
            });

            // Update contact last message
            setContacts(prev => {
                const exists = prev.find(c => c.id === contactId);
                const previewText = msg.type === 'image' ? '📷 Фото' : (msg.type === 'voice' ? '🎤 Голосовое сообщение' : msg.text);
                
                if (exists) {
                    return prev.map(c => c.id === contactId ? {
                        ...c,
                        lastMessage: previewText,
                        lastMessageTime: msg.timestamp,
                        unreadCount: activeContactId === contactId ? 0 : c.unreadCount + 1
                    } : c);
                } else {
                    // New contact from incoming message (need to fetch details in real app)
                    // For now, we wait for next refresh or simplistic add
                    return prev; 
                }
            });
        });
    }
  }, [isAuthenticated, userProfile.id, activeContactId]);

  // Check auth on mount
  useEffect(() => {
    const activeSessionId = db.checkSession();
    if (activeSessionId) {
        loadUserData(activeSessionId);
    }
  }, []);

  const handleLoginSuccess = (profile: UserProfile) => {
      loadUserData(profile.id);
  };

  const handleLogout = async () => {
      await db.logout();
      socketService.disconnect();
      setIsAuthenticated(false);
      setActiveContactId(null);
  };

  // Apply Dark Mode
  useEffect(() => {
    if (settings.appearance.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.appearance.darkMode]);

  const activeContact = contacts.find((c) => c.id === activeContactId);
  const activeMessages = activeContactId ? (chatHistory[activeContactId] || []) : [];

  const handleTerminateSessions = () => {
    const newDevices = devices.filter(d => d.isCurrent);
    setDevices(newDevices);
  };

  const handleUpdateSettings = (newSettings: AppSettings) => {
      setSettings(newSettings);
      // db.saveSettings(newSettings); // TODO: Implement API
  };

  const handleUpdateProfile = async (newProfile: UserProfile) => {
      if (!userProfile.id) return;
      const updatedProfile = await db.updateProfile(userProfile.id, newProfile);
      setUserProfile(updatedProfile);
  };

  const handleSearchUsers = async (query: string): Promise<UserProfile[]> => {
      if (!userProfile.id) return [];
      return await db.searchUsers(query, userProfile.id);
  };

  const handleAddContact = (profile: UserProfile) => {
      const existing = contacts.find(c => c.id === profile.id);
      if (existing) {
          setActiveContactId(existing.id);
          return;
      }

      const newContact: Contact = {
          id: profile.id,
          name: profile.name,
          avatarUrl: profile.avatarUrl,
          lastMessage: 'Начать общение',
          lastMessageTime: Date.now(),
          unreadCount: 0,
          isOnline: false,
          type: 'user',
          email: profile.username ? `@${profile.username}` : profile.email
      };

      setContacts([newContact, ...contacts]);
      setChatHistory({ ...chatHistory, [profile.id]: [] });
      setActiveContactId(profile.id);
  };

  const handleCreateChat = (name: string) => {
    const newId = Date.now().toString();
    // ... same local logic for groups for now ...
    const newContact: Contact = {
        id: newId,
        name: name,
        avatarUrl: '',
        lastMessage: 'Группа создана',
        lastMessageTime: Date.now(),
        unreadCount: 0,
        isOnline: false,
        type: createChatType,
        membersCount: 1
    };
    setContacts([newContact, ...contacts]);
    setChatHistory({ ...chatHistory, [newId]: [] });
    setActiveContactId(newId);
  };

  const handleSendMessage = useCallback(async (text: string, file?: File | null, type: MessageType = 'text', duration?: number) => {
    if (!activeContactId) return;

    const currentContactId = activeContactId;
    
    // Prepare attachment
    let attachmentUrl = '';
    let base64Data = '';
    if (file) {
        attachmentUrl = URL.createObjectURL(file);
        base64Data = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.readAsDataURL(file);
        });
    }

    const newMessage: Message = {
      id: Date.now().toString(),
      text,
      senderId: userProfile.id || CURRENT_USER_ID,
      timestamp: Date.now(),
      status: 'sending',
      type: type,
      attachmentUrl: attachmentUrl, // Use local blob for immediate display
      fileName: file?.name,
      fileSize: file ? (file.size / 1024).toFixed(1) + ' КБ' : undefined,
      duration: duration
    };

    // Optimistic Update
    setChatHistory(prev => ({
        ...prev,
        [currentContactId]: [...(prev[currentContactId] || []), newMessage]
    }));

    setContacts(prev => prev.map(c => c.id === currentContactId ? {
        ...c, 
        lastMessage: type === 'text' ? text : (type === 'image' ? 'Фото' : 'Файл'), 
        lastMessageTime: Date.now() 
    } : c));

    // Send Logic
    if (currentContactId === 'gemini-ai') {
        // ... Gemini Logic (Keep existing) ...
        setTypingStatus(prev => ({ ...prev, [currentContactId]: true }));
        try {
            const responseText = await geminiService.sendMessage(
                currentContactId, text, undefined, 
                (type === 'image' || type === 'voice') ? base64Data : undefined,
                file?.type
            );
            setTypingStatus(prev => ({ ...prev, [currentContactId]: false }));
            
            const aiMessage: Message = {
                id: (Date.now() + 1).toString(),
                text: responseText,
                senderId: currentContactId,
                timestamp: Date.now(),
                status: 'read',
                type: 'text'
            };
            
            setChatHistory(prev => ({
                ...prev,
                [currentContactId]: [...(prev[currentContactId] || []), aiMessage]
            }));
        } catch (e) { console.error(e); }
    } else {
        // REAL USER MESSAGE via Socket
        // We need to send the base64 data to server if it's a file
        const socketMessage = { 
            ...newMessage, 
            recipientId: currentContactId,
            attachmentUrl: base64Data || attachmentUrl // Send base64 to server
        };
        socketService.sendMessage(socketMessage);
    }

  }, [activeContactId, contacts, chatHistory, userProfile.id]);

  // Keep other handlers (Sticker, Location) similar, just adding socket emit logic if needed
  const handleSendLocation = useCallback((lat: number, lng: number) => {
      if(!activeContactId) return;
      // ... logic similar to text, but type='location'
  }, [activeContactId]);

  const handleSendSticker = useCallback((url: string) => {
       // ... logic similar to text, but type='sticker'
  }, [activeContactId]);

  if (!isAuthenticated) {
      return <AuthScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-slate-900 overflow-hidden text-slate-900 dark:text-white font-inter">
      <Sidebar
        contacts={contacts}
        activeContactId={activeContactId}
        onSelectContact={setActiveContactId}
        isOpenMobile={isMobileSidebarOpen}
        closeMobile={() => setIsMobileSidebarOpen(false)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onCreateChat={(type) => { setCreateChatType(type); setIsCreateChatOpen(true); }}
        onSearchUsers={handleSearchUsers}
        onAddContact={handleAddContact}
      />
      
      <main className={`flex-1 flex flex-col h-full relative transition-all duration-300 ${activeContactId ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`}>
        {activeContact ? (
          <ChatWindow
            contact={activeContact}
            messages={activeMessages}
            onSendMessage={handleSendMessage}
            onSendSticker={(url) => { /* Implement similarly to handleSendMessage */ }}
            onSendLocation={(lat, lng) => { /* Implement similarly */ }}
            isTyping={!!typingStatus[activeContact.id]}
            onBack={() => setIsMobileSidebarOpen(true)}
            appearance={settings.appearance}
            onOpenProfile={() => setIsProfileInfoOpen(true)}
          />
        ) : (
          <div className="hidden md:flex flex-1 items-center justify-center bg-[#f8fafc] dark:bg-slate-900 flex-col text-gray-400">
             <div className="w-24 h-24 bg-gray-200 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                <span className="text-4xl">👋</span>
            </div>
            <p className="text-lg font-medium">Выберите чат для начала общения</p>
          </div>
        )}
      </main>

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)}
        userProfile={userProfile}
        onUpdateProfile={handleUpdateProfile}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        devices={devices}
        onTerminateSessions={handleTerminateSessions}
        onLogout={handleLogout}
      />

      <CreateChatModal 
        isOpen={isCreateChatOpen}
        onClose={() => setIsCreateChatOpen(false)}
        onCreate={handleCreateChat}
        type={createChatType}
      />

      {activeContact && (
        <ProfileInfo 
            isOpen={isProfileInfoOpen}
            onClose={() => setIsProfileInfoOpen(false)}
            contact={activeContact}
            messages={activeMessages}
        />
      )}
    </div>
  );
};

export default App;