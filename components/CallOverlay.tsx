
import React, { useEffect, useState, useRef } from 'react';
import { Contact } from '../types';
import Avatar from './Avatar';
import { PhoneOff, Mic, MicOff } from 'lucide-react';

interface CallOverlayProps {
  contact: Contact | { name: string; avatarUrl: string }; // Handle both Contact and simple object
  onEndCall: () => void;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  onToggleMute: () => void;
  status?: string;
}

const CallOverlay: React.FC<CallOverlayProps> = ({ 
    contact, 
    onEndCall, 
    localStream, 
    remoteStream,
    isMuted,
    onToggleMute,
    status = 'Соединение...'
}) => {
  const [duration, setDuration] = useState(0);
  
  // Audio refs are needed for audio playback
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  // When remote stream attaches, play it
  useEffect(() => {
    if (remoteAudioRef.current && remoteStream) {
        remoteAudioRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  useEffect(() => {
    let interval: any;
    if (status === 'Идет разговор') {
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
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-900 text-white overflow-hidden animate-in fade-in duration-300">
      
      {/* Invisible Audio Element for Remote Stream */}
      {remoteStream && (
          <audio 
            ref={remoteAudioRef} 
            autoPlay 
            className="hidden"
          />
      )}

      {/* Backdrop */}
      <div className="absolute inset-0 z-10 bg-gradient-to-br from-slate-800 to-slate-900"></div>

      {/* Decorative Circles */}
      <div className="absolute inset-0 z-10 overflow-hidden pointer-events-none">
          <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      {/* Main Info */}
      <div className="relative z-30 flex-1 flex flex-col items-center justify-center w-full max-w-md space-y-12 p-6">
        
        <div className="relative">
            {status !== 'Идет разговор' && (
                <div className="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-20 scale-150 duration-1000"></div>
            )}
            <Avatar src={contact.avatarUrl} alt={contact.name} size="xl" />
        </div>

        <div className="text-center space-y-3 drop-shadow-md">
          <h2 className="text-3xl font-light tracking-tight text-white">{contact.name}</h2>
          <p className={`text-lg font-medium tracking-wide ${status === 'Идет разговор' ? 'text-white/80' : 'text-blue-300'}`}>
            {status === 'Идет разговор' ? formatDuration(duration) : status}
          </p>
        </div>

      </div>

      {/* Controls */}
      <div className="relative z-30 pb-20 w-full max-w-md flex justify-center items-center gap-10">
         <button 
            onClick={onToggleMute}
            className={`p-5 rounded-full transition-all shadow-xl transform active:scale-95 ${isMuted ? 'bg-white text-slate-900' : 'bg-white/10 text-white hover:bg-white/20 backdrop-blur-md'}`}
         >
            {isMuted ? <MicOff size={28} /> : <Mic size={28} />}
         </button>

         <button 
            onClick={onEndCall}
            className="p-6 bg-red-500 hover:bg-red-600 rounded-full text-white shadow-2xl transform hover:scale-105 active:scale-95 transition-all"
         >
            <PhoneOff size={36} />
         </button>
      </div>
    </div>
  );
};

export default CallOverlay;
