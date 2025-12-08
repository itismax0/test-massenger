
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CURRENT_USER_ID, INITIAL_DEVICES, INITIAL_SETTINGS, CONTACTS, SAVED_MESSAGES_ID, SAVED_MESSAGES_CONTACT } from './constants';
import { Message, Contact, MessageType, AppSettings, DeviceSession, ContactType, UserProfile, UserData } from './types';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';
import SettingsModal from './components/SettingsModal';
import CreateChatModal from './components/CreateChatModal';
import AuthScreen from './components/AuthScreen';
import ProfileInfo from './components/ProfileInfo';
import CallOverlay from './components/CallOverlay';
import IncomingCallModal from './components/IncomingCallModal';
import { geminiService } from './services/geminiService';
import { db } from './services/db';
import { socketService } from './services/socketService';

// Add type definitions for SimplePeer which is loaded via CDN script
interface SimplePeerInstance {
    on(event: string, callback: (data: any) => void): void;
    signal(data: any): void;
    destroy(): void;
}

declare global {
    interface Window {
        SimplePeer: any;
    }
}

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

  // --- Call State ---
  const [callStatus, setCallStatus] = useState<'idle' | 'calling' | 'receiving' | 'connected'>('idle');
  const [incomingCallData, setIncomingCallData] = useState<{ from: string; name: string; signal: any } | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  // Video state removed since calls are audio-only
  
  // Ref changed from RTCPeerConnection to SimplePeerInstance
  const connectionRef = useRef<SimplePeerInstance | null>(null);

  // Refs for state access inside callbacks/effects
  const userProfileRef = useRef(userProfile);
  const contactsRef = useRef(contacts);
  const chatHistoryRef = useRef(chatHistory);

  useEffect(() => {
    userProfileRef.current = userProfile;
    contactsRef.current = contacts;
    chatHistoryRef.current = chatHistory;
  }, [userProfile, contacts, chatHistory]);

  // Load User Data Helper
  const loadUserData = (userId: string) => {
      try {
          const data = db.getData(userId);
          
          // Safety checks to prevent white screen crashes
          const safeProfile = data.profile || { id: userId, name: 'User', email: '', avatarUrl: '' };
          setUserProfile(safeProfile);
          
          // Ensure Saved Messages is in contacts if missing (for legacy data)
          let loadedContacts = Array.isArray(data.contacts) ? data.contacts : [];
          if (!loadedContacts.some(c => c && c.id === SAVED_MESSAGES_ID)) {
             loadedContacts = [SAVED_MESSAGES_CONTACT, ...loadedContacts];
          }

          setContacts(loadedContacts);
          setChatHistory(data.chatHistory || {});
          setSettings(data.settings || INITIAL_SETTINGS);
          setDevices(data.devices || INITIAL_DEVICES);
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

  // --- SOCKET CONNECTION & LISTENERS ---
  useEffect(() => {
    if (isAuthenticated && userProfile.id) {
        socketService.connect(userProfile.id);

        // --- Connection / Reconnection Handling ---
        socketService.onConnect(async () => {
            console.log("Socket connected/reconnected. Syncing data...");
            // When we come back online, we MUST sync with the server to get missed messages
            try {
                await db.syncWithServer(userProfile.id);
                loadUserData(userProfile.id); // Reload state from the fresh DB data
            } catch (e) {
                console.error("Failed to sync on reconnect", e);
            }
        });

        // Listen for incoming messages
        socketService.onMessage((message) => {
            const senderId = message.senderId;
            const currentHistory = chatHistoryRef.current;
            const currentContacts = contactsRef.current;
            
            db.syncWithServer(userProfileRef.current.id).then(() => {
                loadUserData(userProfileRef.current.id);
            });
            
        });

        // Listen for message status updates
        socketService.onMessageSent(({ tempId, status }) => {
            setChatHistory(prev => {
                const newHistory = { ...prev };
                let found = false;

                Object.keys(newHistory).forEach(contactId => {
                    const messages = newHistory[contactId];
                    if (!Array.isArray(messages)) return;
                    
                    const msgIndex = messages.findIndex(m => m.id === tempId);
                    if (msgIndex !== -1) {
                        const updatedMsgs = [...messages];
                        updatedMsgs[msgIndex] = { ...updatedMsgs[msgIndex], status: status as 'sending' | 'sent' | 'read' | 'error' };
                        newHistory[contactId] = updatedMsgs;
                        found = true;
                    }
                });

                if (found) {
                   persistState({ chatHistory: newHistory });
                   return newHistory;
                }
                return prev;
            });
        });

        // Call Listeners
        socketService.onIncomingCall(({ from, name, signal }) => {
            console.log("Incoming call from:", name);
            setIncomingCallData({ from, name, signal });
            setCallStatus('receiving');
        });

        socketService.onCallAccepted((signal) => {
             setCallStatus('connected');
             connectionRef.current?.signal(signal);
        });

        socketService.onIceCandidate(({ candidate }) => {
             connectionRef.current?.signal(candidate);
        });

        socketService.onCallEnded(() => {
            leaveCall();
        });

        return () => {
            socketService.disconnect();
        };
    }
  }, [isAuthenticated, userProfile.id]); 

  // --- CALL LOGIC ---
  const startCall = async () => {
      if (!activeContactId) return;
      const contactToCall = contacts.find(c => c.id === activeContactId);
      if (!contactToCall) return;

      setCallStatus('calling');
      
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
          setLocalStream(stream);

          if (!window.SimplePeer) {
              console.error("SimplePeer library not loaded");
              alert("Ошибка инициализации звонка. Попробуйте обновить страницу.");
              setCallStatus('idle');
              return;
          }

          const peer = new window.SimplePeer({
              initiator: true,
              trickle: false,
              stream: stream
          });

          peer.on('signal', (data: any) => {
              socketService.callUser(activeContactId, data, userProfile.name);
          });

          peer.on('stream', (stream: MediaStream) => {
              setRemoteStream(stream);
          });
          
          peer.on('error', (err: any) => {
              console.error("Peer error:", err);
              leaveCall();
          });

          connectionRef.current = peer;

      } catch (err) {
          console.error("Error accessing media devices", err);
          alert("Не удалось получить доступ к микрофону. Проверьте разрешения.");
          setCallStatus('idle');
      }
  };

  const answerCall = async () => {
      if (!incomingCallData) return;
      
      setCallStatus('connected');

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        setLocalStream(stream);

        if (!window.SimplePeer) {
              console.error("SimplePeer library not loaded");
              alert("Ошибка инициализации звонка.");
              leaveCall();
              return;
        }

        const peer = new window.SimplePeer({
            initiator: false,
            trickle: false,
            stream: stream
        });

        peer.on('signal', (data: any) => {
            socketService.answerCall(incomingCallData.from, data);
        });

        peer.on('stream', (stream: MediaStream) => {
            setRemoteStream(stream);
        });
        
        peer.on('error', (err: any) => {
             console.error("Peer error:", err);
             leaveCall();
        });

        peer.signal(incomingCallData.signal);
        connectionRef.current = peer;

      } catch (err) {
         console.error("Error answering call", err);
         alert("Не удалось получить доступ к микрофону.");
         leaveCall();
      }
  };

  const leaveCall = () => {
      setCallStatus('idle');
      
      if (connectionRef.current) {
          try {
            connectionRef.current.destroy();
          } catch(e) { console.error("Error destroying peer", e) }
          connectionRef.current = null;
      }
      
      if (localStream) {
          localStream.getTracks().forEach(track => track.stop());
          setLocalStream(null);
      }
      
      setRemoteStream(null);
      setIncomingCallData(null);
      setIsMuted(false);
      
      if (activeContactId && callStatus === 'connected') {
          socketService.endCall(activeContactId);
      } else if (incomingCallData) {
          socketService.endCall(incomingCallData.from);
      }
  };

  const toggleMute = () => {
      if (localStream) {
          const audioTrack = localStream.getAudioTracks()[0];
          if (audioTrack) {
              audioTrack.enabled = !audioTrack.enabled;
              setIsMuted(!audioTrack.enabled);
          }
      }
  };

  // --- STANDARD APP LOGIC ---

  const handleLoginSuccess = (profile: UserProfile) => {
      loadUserData(profile.id);
  };

  const handleLogout = async () => {
      socketService.disconnect();
      await db.logout();
      setIsAuthenticated(false);
      setActiveContactId(null);
      setContacts([]);
  };

  useEffect(() => {
    // Check if settings.appearance exists before accessing darkMode
    const isDark = settings?.appearance?.darkMode || false;
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings?.appearance?.darkMode]); // Use optional chaining in dependency array too

  useEffect(() => {
    if (isAuthenticated && !activeContactId && window.innerWidth >= 768 && contacts.length > 0) {
        setActiveContactId(contacts[0].id);
    }
  }, [isAuthenticated, activeContactId, contacts]);

  const activeContact = contacts.find((c) => c && c.id === activeContactId);
  const activeMessages = activeContactId ? (chatHistory[activeContactId] || []) : [];

  const handleTerminateSessions = () => {
    const newDevices = devices.filter(d => d.isCurrent);
    setDevices(newDevices);
    persistState({ devices: newDevices });
  };

  const handleUpdateSettings = (newSettings: AppSettings) => {
      setSettings(newSettings);
      persistState({ settings: newSettings });
  };

  const handleUpdateProfile = async (newProfile: UserProfile) => {
      if (!userProfile.id) return;
      try {
        const updatedProfile = await db.updateProfile(userProfile.id, newProfile);
        setUserProfile(updatedProfile);
      } catch (e) {
        console.error("Failed to update profile", e);
      }
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

      const updatedContacts = [newContact, ...contacts];
      const updatedHistory = { ...chatHistory, [profile.id]: [] };

      setContacts(updatedContacts);
      setChatHistory(updatedHistory);
      setActiveContactId(profile.id);
      
      persistState({ contacts: updatedContacts, chatHistory: updatedHistory });
  };

  const handleCreateChat = async (name: string, members: string[], avatarUrl: string) => {
    if (createChatType === 'user') return;

    try {
        await db.createGroup(name, createChatType, members, avatarUrl, userProfile.id);
        
        // Sync to get the new group
        await db.syncWithServer(userProfile.id);
        loadUserData(userProfile.id);
        
        setIsCreateChatOpen(false);
    } catch (e) {
        console.error("Failed to create group", e);
        alert("Не удалось создать группу");
    }
  };

  const handleSendMessage = useCallback(async (text: string, file?: File | null, type: MessageType = 'text', duration?: number) => {
    if (!activeContactId) return;

    const currentContactId = activeContactId;
    const currentContact = contacts.find(c => c.id === currentContactId);
    
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
      attachmentUrl: attachmentUrl,
      fileName: file?.name,
      fileSize: file ? (file.size / 1024).toFixed(1) + ' КБ' : undefined,
      duration: duration
    };

    const updatedMessages = [...(chatHistory[currentContactId] || []), newMessage];
    const newHistory = { ...chatHistory, [currentContactId]: updatedMessages };
    setChatHistory(newHistory);

    const previewText = type === 'image' ? '📷 Фото' : (type === 'file' ? '📄 Файл' : (type === 'voice' ? '🎤 Голосовое сообщение' : text));
    const updatedContacts = contacts.map(c => c.id === currentContactId ? {
        ...c, 
        lastMessage: previewText, 
        lastMessageTime: Date.now() 
    } : c);
    setContacts(updatedContacts);

    persistState({ chatHistory: newHistory, contacts: updatedContacts });

    if (currentContactId !== 'gemini-ai') {
        const messageToSend = {
            ...newMessage,
            attachmentUrl: base64Data || attachmentUrl
        };
        socketService.sendMessage(messageToSend, currentContactId);
    }
    
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
                ...newHistory,
                [currentContactId]: updatedMessages.map(m => m.id === newMessage.id ? {...m, status: 'read' as const} : m).concat(aiMessage)
            };
            
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
          senderId: userProfile.id || CURRENT_USER_ID,
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

      if (currentContactId !== 'gemini-ai') {
          socketService.sendMessage(newMessage, currentContactId);
      }

      if (currentContactId === 'gemini-ai') {
        setTypingStatus(prev => ({ ...prev, [currentContactId]: true }));
        try {
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
        senderId: userProfile.id || CURRENT_USER_ID,
        timestamp: Date.now(),
        status: 'sending',
        type: 'sticker',
        attachmentUrl: url
      };

      const updatedMessages = [...(chatHistory[currentContactId] || []), newMessage];
      const newHistory = { ...chatHistory, [currentContactId]: updatedMessages };
      setChatHistory(newHistory);
      persistState({ chatHistory: newHistory });

      if (currentContactId !== 'gemini-ai') {
          socketService.sendMessage(newMessage, currentContactId);
      }

      if (currentContactId === 'gemini-ai') {
        setTypingStatus(prev => ({ ...prev, [currentContactId]: true }));
        setTimeout(async () => {
             // ... AI Sticker response (same as before) ...
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
            onCall={startCall}
            currentUserId={userProfile.id}
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

      {/* CALL OVERLAYS */}
      {callStatus === 'receiving' && incomingCallData && (
          <IncomingCallModal 
              callerName={incomingCallData.name} 
              onAccept={answerCall}
              onDecline={leaveCall}
          />
      )}

      {(callStatus === 'calling' || callStatus === 'connected') && (
          <CallOverlay 
              contact={contacts.find(c => c && c.id === activeContactId) || { name: incomingCallData?.name || 'Unknown', avatarUrl: '' }} 
              onEndCall={leaveCall}
              localStream={localStream}
              remoteStream={remoteStream}
              isMuted={isMuted}
              onToggleMute={toggleMute}
              status={callStatus === 'calling' ? 'Звоним...' : 'Идет разговор'}
          />
      )}

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
        contacts={contacts}
        onSearchUsers={handleSearchUsers}
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
