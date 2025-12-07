
import React, { useState, useEffect, useCallback } from 'react';
import { CURRENT_USER_ID, INITIAL_DEVICES, INITIAL_SETTINGS, CONTACTS } from './constants';
import { Message, Contact, MessageType, AppSettings, DeviceSession, ContactType, UserProfile, UserData } from './types';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';
import SettingsModal from './components/SettingsModal';
import CreateChatModal from './components/CreateChatModal';
import AuthScreen from './components/AuthScreen';
import ProfileInfo from './components/ProfileInfo';
import { geminiService } from './services/geminiService';
import { db } from './services/db';

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

  // Load User Data Helper
  const loadUserData = (userId: string) => {
      try {
          const data = db.getData(userId);
          setUserProfile(data.profile);
          setContacts(data.contacts);
          setChatHistory(data.chatHistory);
          setSettings(data.settings);
          setDevices(data.devices);
          setIsAuthenticated(true);
      } catch (error) {
          console.error("Failed to load user data:", error);
          // Safety fallback: logout to clear bad session state
          db.logout();
          setIsAuthenticated(false);
      }
  };

  // Helper to persist state updates
  const persistState = (overrides: Partial<UserData>) => {
      if (!userProfile.id) return;
      db.saveData(userProfile.id, overrides);
  };

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

  // Auto-select first contact on desktop load
  useEffect(() => {
    if (isAuthenticated && !activeContactId && window.innerWidth >= 768 && contacts.length > 0) {
        setActiveContactId(contacts[0].id);
    }
  }, [isAuthenticated, activeContactId, contacts]);

  const activeContact = contacts.find((c) => c.id === activeContactId);
  const activeMessages = activeContactId ? (chatHistory[activeContactId] || []) : [];

  const handleTerminateSessions = () => {
    const newDevices = devices.filter(d => d.isCurrent);
    setDevices(newDevices);
    persistState({ devices: newDevices });
  };

  // Update Settings Wrapper
  const handleUpdateSettings = (newSettings: AppSettings) => {
      setSettings(newSettings);
      persistState({ settings: newSettings });
  };

  // Update Profile Wrapper - Now Async to handle validation
  const handleUpdateProfile = async (newProfile: UserProfile) => {
      if (!userProfile.id) return;
      // Use db.updateProfile to handle username uniqueness checks
      const updatedProfile = await db.updateProfile(userProfile.id, newProfile);
      setUserProfile(updatedProfile);
  };

  // Search Users Handler
  const handleSearchUsers = async (query: string): Promise<UserProfile[]> => {
      if (!userProfile.id) return [];
      return await db.searchUsers(query, userProfile.id);
  };

  // Add Found User to Contacts
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
          email: profile.username ? `@${profile.username}` : profile.email // Store display handle
      };

      const updatedContacts = [newContact, ...contacts];
      const updatedHistory = { ...chatHistory, [profile.id]: [] };

      setContacts(updatedContacts);
      setChatHistory(updatedHistory);
      setActiveContactId(profile.id);
      
      persistState({ contacts: updatedContacts, chatHistory: updatedHistory });
  };

  const handleCreateChat = (name: string) => {
    const newId = Date.now().toString();
    const isGroup = createChatType === 'group';
    
    // Gemini acts as assistant for groups/channels
    const newContact: Contact = {
        id: newId,
        name: name,
        avatarUrl: '', // Use empty string to let Avatar component generate initials
        lastMessage: isGroup ? 'Группа создана' : 'Канал создан',
        lastMessageTime: Date.now(),
        unreadCount: 0,
        isOnline: false,
        type: createChatType,
        membersCount: 1,
        systemInstruction: isGroup 
            ? 'Ты — полезный ассистент и модератор в групповом чате. Отвечай кратко и помогай участникам.' 
            : 'Ты — редактор канала. Помогай создавать интересные посты и отвечай на вопросы подписчиков.'
    };

    const updatedContacts = [newContact, ...contacts];
    const updatedHistory = { ...chatHistory, [newId]: [] };

    setContacts(updatedContacts);
    setChatHistory(updatedHistory);
    setActiveContactId(newId);

    persistState({ contacts: updatedContacts, chatHistory: updatedHistory });
  };

  const handleSendMessage = useCallback(async (text: string, file?: File | null, type: MessageType = 'text', duration?: number) => {
    if (!activeContactId) return;

    const currentContactId = activeContactId;
    const currentContact = contacts.find(c => c.id === currentContactId);
    
    // Prepare attachment data if exists
    let attachmentUrl = '';
    let base64Data = '';
    if (file) {
        // Create a fake local URL for immediate display
        attachmentUrl = URL.createObjectURL(file);
        // Convert to base64 for API
        base64Data = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.readAsDataURL(file);
        });
    }

    const newMessage: Message = {
      id: Date.now().toString(),
      text,
      senderId: CURRENT_USER_ID,
      timestamp: Date.now(),
      status: 'sending',
      type: type,
      attachmentUrl: attachmentUrl,
      fileName: file?.name,
      fileSize: file ? (file.size / 1024).toFixed(1) + ' КБ' : undefined,
      duration: duration
    };

    // Update state
    const updatedMessages = [...(chatHistory[currentContactId] || []), newMessage];
    const newHistory = { ...chatHistory, [currentContactId]: updatedMessages };
    setChatHistory(newHistory);

    // Update last message preview
    const previewText = type === 'image' ? '📷 Фото' : (type === 'file' ? '📄 Файл' : (type === 'voice' ? '🎤 Голосовое сообщение' : text));
    const updatedContacts = contacts.map(c => c.id === currentContactId ? {
        ...c, 
        lastMessage: previewText, 
        lastMessageTime: Date.now() 
    } : c);
    setContacts(updatedContacts);

    // Save to DB
    persistState({ chatHistory: newHistory, contacts: updatedContacts });

    // Simulate network delay
    setTimeout(() => {
        setChatHistory((prev) => {
            const msgs = prev[currentContactId] || [];
            return {
                ...prev,
                [currentContactId]: msgs.map(m => m.id === newMessage.id ? {...m, status: 'sent'} : m)
            }
        });
    }, 500);

    // AI Response Logic
    // Only respond if it's the Gemini AI contact
    if (currentContactId === 'gemini-ai') {
        setTypingStatus(prev => ({ ...prev, [currentContactId]: true }));

        try {
            const responseText = await geminiService.sendMessage(
                currentContactId, 
                text, 
                currentContact?.systemInstruction,
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

            const historyWithAI = { 
                ...newHistory, // use the history from before delay closure
                [currentContactId]: [...updatedMessages, aiMessage] 
            };
            
            // Re-update contacts for AI reply
            const contactsWithAI = updatedContacts.map(c => c.id === currentContactId ? {
                ...c, 
                lastMessage: responseText, 
                lastMessageTime: Date.now() 
            } : c);

            setChatHistory(historyWithAI);
            setContacts(contactsWithAI);

            persistState({ chatHistory: historyWithAI, contacts: contactsWithAI });

        } catch (error) {
            setTypingStatus(prev => ({ ...prev, [currentContactId]: false }));
            console.error("Failed to get response", error);
        }
    }

  }, [activeContactId, contacts, chatHistory, userProfile.id]);

  const handleSendLocation = useCallback(async (latitude: number, longitude: number) => {
      if (!activeContactId) return;
      const currentContactId = activeContactId;

      const newMessage: Message = {
          id: Date.now().toString(),
          text: '',
          senderId: CURRENT_USER_ID,
          timestamp: Date.now(),
          status: 'sent',
          type: 'location',
          latitude,
          longitude
      };

      const updatedMessages = [...(chatHistory[currentContactId] || []), newMessage];
      const newHistory = { ...chatHistory, [currentContactId]: updatedMessages };
      
      const updatedContacts = contacts.map(c => c.id === currentContactId ? {
          ...c, 
          lastMessage: '📍 Геолокация', 
          lastMessageTime: Date.now() 
      } : c);

      setChatHistory(newHistory);
      setContacts(updatedContacts);
      persistState({ chatHistory: newHistory, contacts: updatedContacts });

      // If engaging with Gemini, send the location to it so it can use Google Maps Grounding
      if (currentContactId === 'gemini-ai') {
        setTypingStatus(prev => ({ ...prev, [currentContactId]: true }));
        try {
            // Inform Gemini about the user's location using the text prompt and toolConfig
            const responseText = await geminiService.sendMessage(
                currentContactId, 
                "Это моя текущая геолокация. Что находится рядом?", 
                contacts.find(c => c.id === currentContactId)?.systemInstruction,
                undefined,
                undefined,
                { latitude, longitude }
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

            const historyWithAI = {
                ...newHistory,
                [currentContactId]: [...updatedMessages, aiMessage]
            };
            
            setChatHistory(historyWithAI);
            setContacts(updatedContacts.map(c => c.id === currentContactId ? {
                ...c, 
                lastMessage: responseText, 
                lastMessageTime: Date.now() 
            } : c));

            persistState({ chatHistory: historyWithAI });

        } catch(e) {
             setTypingStatus(prev => ({ ...prev, [currentContactId]: false }));
        }
      }

  }, [activeContactId, chatHistory, contacts, userProfile.id]);

  const handleSendSticker = useCallback((url: string) => {
      if (!activeContactId) return;
      const currentContactId = activeContactId;

      const newMessage: Message = {
        id: Date.now().toString(),
        text: '',
        senderId: CURRENT_USER_ID,
        timestamp: Date.now(),
        status: 'read',
        type: 'sticker',
        attachmentUrl: url
      };

      const updatedMessages = [...(chatHistory[currentContactId] || []), newMessage];
      const newHistory = { ...chatHistory, [currentContactId]: updatedMessages };
      setChatHistory(newHistory);
      persistState({ chatHistory: newHistory });

      // Respond to sticker only if Gemini
      if (currentContactId === 'gemini-ai') {
        setTypingStatus(prev => ({ ...prev, [currentContactId]: true }));
        
        setTimeout(async () => {
            try {
                // Send a hidden prompt to Gemini representing the sticker
                const responseText = await geminiService.sendMessage(
                    currentContactId, 
                    "[Пользователь отправил стикер]", 
                    contacts.find(c => c.id === currentContactId)?.systemInstruction
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

                const historyWithAI = {
                    ...newHistory,
                    [currentContactId]: [...updatedMessages, aiMessage]
                };

                setChatHistory(historyWithAI);
                persistState({ chatHistory: historyWithAI });

            } catch(e) {
                setTypingStatus(prev => ({ ...prev, [currentContactId]: false }));
            }
        }, 1000);
      }

  }, [activeContactId, contacts, chatHistory, userProfile.id]);

  if (!isAuthenticated) {
      return <AuthScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-slate-900 overflow-hidden text-slate-900 dark:text-white font-inter">
      <Sidebar
        contacts={contacts}
        activeContactId={activeContactId}
        onSelectContact={(id) => {
            setActiveContactId(id);
        }}
        isOpenMobile={isMobileSidebarOpen}
        closeMobile={() => setIsMobileSidebarOpen(false)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onCreateChat={(type) => {
            setCreateChatType(type);
            setIsCreateChatOpen(true);
        }}
        onSearchUsers={handleSearchUsers}
        onAddContact={handleAddContact}
      />
      
      <main className={`flex-1 flex flex-col h-full relative transition-all duration-300 ${activeContactId ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`}>
        {activeContact ? (
          <ChatWindow
            contact={activeContact}
            messages={activeMessages}
            onSendMessage={handleSendMessage}
            onSendSticker={handleSendSticker}
            onSendLocation={handleSendLocation}
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

      {/* Settings Modal */}
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

      {/* Create Chat Modal */}
      <CreateChatModal 
        isOpen={isCreateChatOpen}
        onClose={() => setIsCreateChatOpen(false)}
        onCreate={handleCreateChat}
        type={createChatType}
      />

      {/* Profile Info Modal */}
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
