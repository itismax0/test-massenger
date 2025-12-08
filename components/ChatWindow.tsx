
import React, { useState, useRef, useEffect } from 'react';
import { Contact, Message, AppSettings, MessageType } from '../types';
import { Send, Paperclip, Smile, MoreVertical, Phone, ArrowLeft, Image as ImageIcon, File as FileIcon, X, MapPin, Mic, Trash2, Lock } from 'lucide-react';
import MessageBubble from './MessageBubble';
import Avatar from './Avatar';
import EmojiPicker from './EmojiPicker';
// CallOverlay moved to App level
import EncryptionModal from './EncryptionModal';

interface ChatWindowProps {
  contact: Contact;
  messages: Message[];
  onSendMessage: (text: string, file?: File | null, type?: MessageType, duration?: number) => void;
  onSendSticker: (url: string) => void;
  onSendLocation: (lat: number, lng: number) => void;
  isTyping: boolean;
  onBack: () => void; 
  appearance: AppSettings['appearance'];
  onOpenProfile: () => void;
  onCall?: () => void; // Added onCall prop
  currentUserId?: string; // Prop for identifying "Me"
}

const BACKGROUND_THEMES: Record<string, string> = {
  default: 'bg-[#f8fafc] dark:bg-slate-900',
  blue: 'bg-blue-50 dark:bg-blue-950',
  green: 'bg-green-50 dark:bg-green-950',
  pink: 'bg-pink-50 dark:bg-pink-950',
  yellow: 'bg-yellow-50 dark:bg-yellow-950',
  purple: 'bg-purple-50 dark:bg-purple-950',
  slate: 'bg-slate-200 dark:bg-slate-800',
  red: 'bg-red-50 dark:bg-red-950',
};

const ChatWindow: React.FC<ChatWindowProps> = ({ 
    contact, 
    messages, 
    onSendMessage, 
    onSendSticker, 
    onSendLocation,
    isTyping, 
    onBack, 
    appearance,
    onOpenProfile,
    onCall, // Destructure onCall
    currentUserId
}) => {
  const [inputValue, setInputValue] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showEncryptionModal, setShowEncryptionModal] = useState(false);

  // Safe fallback for appearance if it's undefined/null to prevent crashes
  const safeAppearance = appearance || { chatBackground: 'default', textSize: 100, darkMode: false };

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, previewUrl]);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (!target.closest('.emoji-trigger') && !target.closest('.attach-trigger')) {
            setShowEmojiPicker(false);
            setShowAttachMenu(false);
        }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
        if (recordingTimerRef.current) {
            clearInterval(recordingTimerRef.current);
        }
    };
  }, []);

  const handleSend = () => {
    if (inputValue.trim() || selectedFile) {
      onSendMessage(
          inputValue, 
          selectedFile, 
          selectedFile ? (selectedFile.type.startsWith('image/') ? 'image' : 'file') : 'text'
      );
      setInputValue('');
      setSelectedFile(null);
      setPreviewUrl(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          setSelectedFile(file);
          setShowAttachMenu(false);
          
          if (file.type.startsWith('image/')) {
              const reader = new FileReader();
              reader.onload = (ev) => {
                  setPreviewUrl(ev.target?.result as string);
              };
              reader.readAsDataURL(file);
          } else {
              setPreviewUrl(null);
          }
      }
  };

  const handleLocationClick = () => {
    setShowAttachMenu(false);
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                onSendLocation(position.coords.latitude, position.coords.longitude);
            },
            (error) => {
                console.error("Error getting location", error);
                alert("Не удалось получить геолокацию");
            }
        );
    } else {
        alert("Геолокация не поддерживается вашим браузером");
    }
  };

  // --- Voice Recording Logic ---
  const startRecording = async () => {
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const mediaRecorder = new MediaRecorder(stream);
          mediaRecorderRef.current = mediaRecorder;
          audioChunksRef.current = [];

          mediaRecorder.ondataavailable = (event) => {
              if (event.data.size > 0) {
                  audioChunksRef.current.push(event.data);
              }
          };

          mediaRecorder.start();
          setIsRecording(true);
          setRecordingDuration(0);

          recordingTimerRef.current = setInterval(() => {
              setRecordingDuration(prev => prev + 1);
          }, 1000);

      } catch (err) {
          console.error("Error accessing microphone:", err);
          alert("Не удалось получить доступ к микрофону. Проверьте разрешения.");
      }
  };

  const stopRecording = (send: boolean) => {
      if (mediaRecorderRef.current && isRecording) {
          mediaRecorderRef.current.onstop = () => {
              if (send) {
                  const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' }); 
                  const audioFile = new File([audioBlob], 'voice-message.webm', { type: 'audio/webm' });
                  
                  onSendMessage('', audioFile, 'voice', recordingDuration);
              }
              
              mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop());
              
              setIsRecording(false);
              setRecordingDuration(0);
              mediaRecorderRef.current = null;
              audioChunksRef.current = [];
          };
          
          mediaRecorderRef.current.stop();
          if (recordingTimerRef.current) {
              clearInterval(recordingTimerRef.current);
              recordingTimerRef.current = null;
          }
      } else {
          setIsRecording(false);
          setRecordingDuration(0);
      }
  };

  const formatTime = (seconds: number) => {
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const getStatusText = () => {
      if (isTyping) return 'печатает...';
      if (contact.type === 'channel') return `${contact.membersCount || 245} подписчиков`;
      if (contact.type === 'group') return `${contact.membersCount || 3} участников`;
      return contact.isOnline ? 'в сети' : 'был(а) недавно';
  };

  const bgClass = BACKGROUND_THEMES[safeAppearance.chatBackground] || BACKGROUND_THEMES['default'];
  const showMic = !inputValue.trim() && !selectedFile;

  return (
    <div 
        className={`flex flex-col h-full relative transition-colors duration-200 ${bgClass}`}
        style={{ fontSize: `${safeAppearance.textSize}%` }}
    >
       <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none" 
            style={{ 
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
            }} 
       />

      <EncryptionModal 
        isOpen={showEncryptionModal}
        onClose={() => setShowEncryptionModal(false)}
        contact={contact}
      />

      <input type="file" ref={imageInputRef} accept="image/*" className="hidden" onChange={handleFileSelect} />
      <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} />

      {/* Header */}
      <header 
        className="flex-none px-4 py-3 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md border-b border-gray-200 dark:border-slate-700 flex justify-between items-center z-10 sticky top-0 transition-colors"
      >
        <div className="flex items-center gap-3 cursor-pointer" onClick={onOpenProfile}>
          <button onClick={(e) => { e.stopPropagation(); onBack(); }} className="md:hidden text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            <ArrowLeft size={20} />
          </button>
          <Avatar src={contact.avatarUrl} alt={contact.name} size="md" id={contact.id} />
          <div>
            <div className="flex items-center gap-1.5">
                <h2 className="text-slate-900 dark:text-white font-semibold text-sm leading-tight">
                    {contact.name}
                </h2>
                <button 
                    onClick={(e) => { e.stopPropagation(); setShowEncryptionModal(true); }}
                    className="text-gray-400 hover:text-green-500 transition-colors focus:outline-none"
                    title="Зашифровано"
                >
                    <Lock size={12} strokeWidth={2.5} />
                </button>
            </div>
            <p className="text-blue-500 text-xs font-medium">
              {getStatusText()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-gray-400">
          <button 
            onClick={(e) => { e.stopPropagation(); onCall?.(); }} 
            className="hover:text-blue-500 transition-colors"
          >
            <Phone size={20} />
          </button>
          <button className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors"><MoreVertical size={20} /></button>
        </div>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 z-0">
        <div className="max-w-3xl mx-auto flex flex-col justify-end min-h-full">
            
            <div className="flex justify-center mb-6">
                <button 
                    onClick={() => setShowEncryptionModal(true)}
                    className="bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 text-[10px] md:text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 hover:bg-yellow-200 dark:hover:bg-yellow-900/40 transition-colors cursor-pointer"
                >
                    <Lock size={10} />
                    <span>Сообщения и звонки защищены сквозным шифрованием</span>
                </button>
            </div>

            <div className="text-center text-xs text-gray-400 my-4 uppercase tracking-widest">Сегодня</div>
            
            {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} currentUserId={currentUserId} />
            ))}

            {isTyping && (
                <div className="flex justify-start mb-4">
                    <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm transition-colors">
                        <div className="flex space-x-1 h-2 items-center">
                            <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                            <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                            <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
                        </div>
                    </div>
                </div>
            )}
            
            <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="flex-none bg-white dark:bg-slate-800 p-3 md:p-4 border-t border-gray-200 dark:border-slate-700 z-10 transition-colors">
        <div className="max-w-3xl mx-auto flex items-end gap-2 relative">
          
          {selectedFile && (
              <div className="absolute bottom-full left-0 mb-3 ml-12 bg-white dark:bg-slate-800 p-2 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700 flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2">
                  {previewUrl ? (
                      <img src={previewUrl} alt="Preview" className="w-16 h-16 object-cover rounded-md" />
                  ) : (
                      <div className="w-16 h-16 bg-gray-100 dark:bg-slate-700 rounded-md flex items-center justify-center">
                          <FileIcon size={24} className="text-gray-400" />
                      </div>
                  )}
                  <div className="max-w-[150px]">
                      <p className="text-sm font-medium truncate text-slate-700 dark:text-slate-200">{selectedFile.name}</p>
                      <p className="text-xs text-gray-500">{(selectedFile.size / 1024).toFixed(1)} КБ</p>
                  </div>
                  <button 
                    onClick={() => { setSelectedFile(null); setPreviewUrl(null); }}
                    className="text-gray-400 hover:text-red-500"
                  >
                      <X size={16} />
                  </button>
              </div>
          )}

          {!isRecording ? (
              <>
                <div className="relative attach-trigger">
                    <button 
                        onClick={(e) => { e.stopPropagation(); setShowAttachMenu(!showAttachMenu); setShowEmojiPicker(false); }}
                        className={`p-2 transition-colors rounded-full ${showAttachMenu ? 'bg-gray-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300' : 'text-gray-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                    >
                        <Paperclip size={20} />
                    </button>
                    {showAttachMenu && (
                        <div className="absolute bottom-full left-0 mb-2 w-52 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-200 dark:border-slate-700 overflow-hidden py-1 z-20 animate-in fade-in zoom-in-95 duration-200">
                            <button 
                                onClick={() => imageInputRef.current?.click()}
                                className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
                            >
                                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                                    <ImageIcon size={18} />
                                </div>
                                <span className="text-sm font-medium">Фото или видео</span>
                            </button>
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
                            >
                                <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center">
                                    <FileIcon size={18} />
                                </div>
                                <span className="text-sm font-medium">Файл</span>
                            </button>
                            <button 
                                onClick={handleLocationClick}
                                className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
                            >
                                <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                                    <MapPin size={18} />
                                </div>
                                <span className="text-sm font-medium">Геолокация</span>
                            </button>
                        </div>
                    )}
                </div>
                
                <div className="flex-1 bg-gray-50 dark:bg-slate-700/50 rounded-2xl border border-gray-200 dark:border-slate-600 focus-within:ring-2 focus-within:ring-blue-100 dark:focus-within:ring-blue-900 focus-within:border-blue-300 dark:focus-within:border-blue-500 transition-all flex items-end">
                    <textarea
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={contact.type === 'channel' ? "Опубликовать в канал..." : (selectedFile ? "Добавить подпись..." : "Написать сообщение...")}
                        rows={1}
                        className="w-full bg-transparent border-none focus:ring-0 resize-none py-3 px-4 text-slate-800 dark:text-white placeholder-gray-400 max-h-32 min-h-[44px]"
                        style={{ height: 'auto', overflow: 'hidden' }}
                        onInput={(e) => {
                            const target = e.target as HTMLTextAreaElement;
                            target.style.height = 'auto';
                            target.style.height = `${target.scrollHeight}px`;
                        }}
                    />
                    
                    <div className="relative emoji-trigger">
                        <button 
                            onClick={(e) => { e.stopPropagation(); setShowEmojiPicker(!showEmojiPicker); setShowAttachMenu(false); }}
                            className={`p-3 transition-colors rounded-full ${showEmojiPicker ? 'text-slate-600 dark:text-slate-300' : 'text-gray-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                        >
                            <Smile size={20} />
                        </button>
                        {showEmojiPicker && (
                           <EmojiPicker 
                                onSelectEmoji={(emoji) => setInputValue(prev => prev + emoji)} 
                                onSelectSticker={(url) => {
                                    onSendSticker(url);
                                    setShowEmojiPicker(false);
                                }}
                           />
                        )}
                    </div>
                </div>

                <button 
                    onClick={showMic ? startRecording : handleSend}
                    className={`p-3 rounded-full shadow-md text-white transition-all transform hover:scale-105 active:scale-95 flex-shrink-0 flex items-center justify-center ${
                        showMic 
                            ? 'bg-blue-500 hover:bg-blue-600' 
                            : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                >
                    {showMic ? <Mic size={20} /> : <Send size={20} className={inputValue.trim() || selectedFile ? 'ml-0.5' : ''} />}
                </button>
              </>
          ) : (
              <div className="flex-1 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-between px-2 animate-in fade-in duration-200">
                  <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                      <span className="text-slate-800 dark:text-white font-mono font-medium">
                          {formatTime(recordingDuration)}
                      </span>
                      <span className="text-sm text-gray-400">Запись...</span>
                  </div>
                  <div className="flex items-center gap-2">
                      <button 
                          onClick={() => stopRecording(false)}
                          className="p-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                      >
                          <Trash2 size={20} />
                      </button>
                      <button 
                          onClick={() => stopRecording(true)}
                          className="p-3 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors shadow-md"
                      >
                          <Send size={20} className="ml-0.5" />
                      </button>
                  </div>
              </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default ChatWindow;
