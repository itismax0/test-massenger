import React, { useState, useRef, useEffect } from 'react';
import { Message } from '../types';
import { CURRENT_USER_ID } from '../constants';
import ReactMarkdown from 'react-markdown';
import { FileText, Download, MapPin, Play, Pause, Check, CheckCheck, Clock } from 'lucide-react';
import './MessageBubble.css';

interface MessageBubbleProps {
  message: Message;
  currentUserId?: string;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, currentUserId }) => {
  // Use currentUserId if available, otherwise fallback to constant (for dev/local mode)
  const isMe = message.senderId === (currentUserId || CURRENT_USER_ID);
  
  const isSticker = message.type === 'sticker';
  const isImage = message.type === 'image';
  const isFile = message.type === 'file';
  const isLocation = message.type === 'location';
  const isVoice = message.type === 'voice';

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (isVoice && message.attachmentUrl) {
        audioRef.current = new Audio(message.attachmentUrl);
        
        audioRef.current.addEventListener('ended', () => {
            setIsPlaying(false);
            setProgress(0);
        });

        audioRef.current.addEventListener('timeupdate', () => {
            if (audioRef.current) {
                const percent = (audioRef.current.currentTime / audioRef.current.duration) * 100;
                setProgress(percent || 0);
            }
        });

        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
        };
    }
  }, [isVoice, message.attachmentUrl]);

  const togglePlay = () => {
      if (audioRef.current) {
          if (isPlaying) {
              audioRef.current.pause();
          } else {
              audioRef.current.play();
          }
          setIsPlaying(!isPlaying);
      }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDuration = (seconds: number) => {
      const m = Math.floor(seconds / 60);
      const s = Math.floor(seconds % 60);
      return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const renderStatus = () => {
    if (!isMe) return null;
    return (
      <span className="message-status">
        {message.status === 'sending' && <Clock size={10} className="text-gray-300" />}
        {message.status === 'sent' && <Check size={14} />}
        {message.status === 'read' && <CheckCheck size={14} className="read-icon" />}
      </span>
    );
  };

  if (isSticker && message.attachmentUrl) {
    return (
      <div className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'} mb-4 group`}>
        <div className="relative max-w-[50%]">
          <img 
            src={message.attachmentUrl} 
            alt="Sticker" 
            className="w-32 h-32 object-contain drop-shadow-sm hover:scale-105 transition-transform duration-200" 
          />
          <div className={`text-[10px] mt-1 opacity-70 flex items-center gap-1 ${isMe ? 'text-slate-400 justify-end' : 'text-slate-400 justify-start'}`}>
             <span>{formatTime(message.timestamp)}</span>
             {renderStatus()}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'} mb-4 group`}>
      <div
        className={`max-w-[85%] lg:max-w-[65%] px-4 py-2 rounded-2xl shadow-sm relative text-sm md:text-base transition-colors ${
          isMe
            ? 'bg-slate-800 text-white rounded-tr-sm dark:bg-blue-600'
            : 'bg-white border border-gray-100 text-slate-800 rounded-tl-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white'
        } ${isImage ? 'p-1' : ''}`}
      >
        {/* Image Attachment */}
        {isImage && message.attachmentUrl && (
          <div className="mb-2 rounded-lg overflow-hidden relative group/image">
             <img 
               src={message.attachmentUrl} 
               alt="Attachment" 
               className="max-w-full h-auto max-h-72 object-cover rounded-lg cursor-pointer" 
             />
          </div>
        )}

        {/* File Attachment */}
        {isFile && (
          <div className={`flex items-center gap-3 p-2 rounded-lg mb-2 ${isMe ? 'bg-slate-700 dark:bg-blue-500' : 'bg-slate-50 border border-slate-200 dark:bg-slate-600 dark:border-slate-500'}`}>
            <div className={`p-2 rounded-full ${isMe ? 'bg-slate-600 dark:bg-blue-400' : 'bg-white dark:bg-slate-500'}`}>
              <FileText size={24} className={isMe ? 'text-blue-300 dark:text-white' : 'text-blue-500 dark:text-white'} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate text-sm">{message.fileName || 'Документ'}</p>
              <p className={`text-xs ${isMe ? 'text-slate-400 dark:text-blue-100' : 'text-gray-500 dark:text-gray-300'}`}>{message.fileSize || 'неизв.'}</p>
            </div>
            <button className={`p-2 rounded-full hover:bg-black/10 transition-colors`}>
              <Download size={18} />
            </button>
          </div>
        )}

        {/* Voice Message */}
        {isVoice && (
            <div className={`flex items-center gap-3 p-1 min-w-[200px] ${isMe ? 'pr-2' : ''}`}>
                <button 
                    onClick={togglePlay}
                    className={`p-2.5 rounded-full flex-shrink-0 transition-colors ${
                        isMe 
                        ? 'bg-slate-700 text-blue-300 dark:bg-blue-500 dark:text-white' 
                        : 'bg-blue-100 text-blue-600 dark:bg-slate-600 dark:text-white'
                    }`}
                >
                    {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
                </button>
                <div className="flex-1 flex flex-col justify-center gap-1">
                    <div className="h-1 bg-gray-200 dark:bg-slate-600 rounded-full overflow-hidden w-full">
                        <div 
                            className={`h-full rounded-full transition-all duration-100 ${isMe ? 'bg-blue-300 dark:bg-white' : 'bg-blue-500 dark:bg-blue-400'}`} 
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <div className={`text-[10px] font-medium ${isMe ? 'text-slate-300 dark:text-blue-100' : 'text-gray-500 dark:text-gray-300'}`}>
                        {isPlaying && audioRef.current 
                            ? formatDuration(audioRef.current.currentTime) 
                            : formatDuration(message.duration || 0)
                        }
                    </div>
                </div>
            </div>
        )}

        {/* Location Attachment */}
        {isLocation && message.latitude && message.longitude && (
            <div className="mb-2">
                <a 
                    href={`https://www.google.com/maps?q=${message.latitude},${message.longitude}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="block rounded-lg overflow-hidden relative"
                >
                    <div className="h-32 w-full bg-slate-100 dark:bg-slate-600 flex items-center justify-center relative">
                        {/* Mock Map View */}
                        <div className="absolute inset-0 opacity-50 bg-[url('https://maps.googleapis.com/maps/api/staticmap?center=40.714728,-73.998672&zoom=12&size=400x400&key=YOUR_API_KEY')] bg-cover bg-center"></div>
                        <MapPin size={32} className="text-red-500 relative z-10" />
                    </div>
                    <div className={`p-2 text-xs font-medium ${isMe ? 'text-blue-100' : 'text-slate-500 dark:text-slate-300'}`}>
                        Геолокация
                    </div>
                </a>
            </div>
        )}

        {/* Text Content */}
        {message.text && (
          <div className="markdown-content">
            {isMe ? (
              <p>{message.text}</p>
            ) : (
              <ReactMarkdown 
                components={{
                  p: ({node, ...props}) => <p className="mb-1 last:mb-0" {...props} />,
                  code: ({node, ...props}) => <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded text-pink-600 dark:text-pink-400 font-mono text-xs" {...props} />
                }}
              >
                {message.text}
              </ReactMarkdown>
            )}
          </div>
        )}
        
        <div className={`text-[10px] mt-1 opacity-70 flex items-center gap-1 ${isMe ? 'text-slate-300 justify-end' : 'text-slate-400 dark:text-slate-300 justify-start'}`}>
          <span>{formatTime(message.timestamp)}</span>
          {renderStatus()}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
