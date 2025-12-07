import React, { useEffect, useState } from 'react';
import { Contact } from '../types';
import Avatar from './Avatar';
import { PhoneOff, Mic, MicOff, Video, VideoOff } from 'lucide-react';

interface CallOverlayProps {
  contact: Contact;
  onEndCall: () => void;
}

const CallOverlay: React.FC<CallOverlayProps> = ({ contact, onEndCall }) => {
  const [status, setStatus] = useState('Вызов...');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideo, setIsVideo] = useState(false);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    // Simulate connection flow
    const connectTimer = setTimeout(() => {
      setStatus('Соединение установлено');
    }, 2000);

    return () => clearTimeout(connectTimer);
  }, []);

  useEffect(() => {
    let interval: any;
    if (status === 'Соединение установлено') {
      interval = setInterval(() => {
        setDuration(d => d + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [status]);

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/95 backdrop-blur-md text-white animate-in fade-in duration-300">
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-md space-y-8 p-6">
        
        <div className="relative">
          {status === 'Вызов...' && (
            <div className="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-20 scale-150"></div>
          )}
          <Avatar src={contact.avatarUrl} alt={contact.name} size="xl" />
        </div>

        <div className="text-center space-y-2">
          <h2 className="text-3xl font-light tracking-tight">{contact.name}</h2>
          <p className="text-blue-200 text-lg font-medium">
            {status === 'Соединение установлено' ? formatDuration(duration) : status}
          </p>
        </div>

      </div>

      <div className="pb-12 w-full max-w-md flex justify-center items-center gap-6">
         <button 
            onClick={() => setIsMuted(!isMuted)}
            className={`p-4 rounded-full transition-all ${isMuted ? 'bg-white text-slate-900' : 'bg-slate-800 text-white hover:bg-slate-700'}`}
         >
            {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
         </button>

         <button 
            onClick={onEndCall}
            className="p-5 bg-red-500 hover:bg-red-600 rounded-full text-white shadow-lg transform hover:scale-105 transition-all"
         >
            <PhoneOff size={32} />
         </button>

         <button 
            onClick={() => setIsVideo(!isVideo)}
            className={`p-4 rounded-full transition-all ${isVideo ? 'bg-white text-slate-900' : 'bg-slate-800 text-white hover:bg-slate-700'}`}
         >
            {isVideo ? <Video size={24} /> : <VideoOff size={24} />}
         </button>
      </div>
    </div>
  );
};

export default CallOverlay;
