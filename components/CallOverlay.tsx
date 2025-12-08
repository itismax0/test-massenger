import React, { useEffect, useState, useRef } from 'react';
import { Contact } from '../types';
import Avatar from './Avatar';
import { PhoneOff, Mic, MicOff, Video, VideoOff } from 'lucide-react';

interface CallOverlayProps {
  contact: Contact | { name: string; avatarUrl: string }; // Handle both Contact and simple object
  onEndCall: () => void;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  onToggleMute: () => void;
  isVideoEnabled: boolean;
  onToggleVideo: () => void;
  status?: string;
}

const CallOverlay: React.FC<CallOverlayProps> = ({ 
    contact, 
    onEndCall, 
    localStream, 
    remoteStream,
    isMuted,
    onToggleMute,
    isVideoEnabled,
    onToggleVideo,
    status = 'Соединение...'
}) => {
  const [duration, setDuration] = useState(0);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
        localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
        remoteVideoRef.current.srcObject = remoteStream;
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
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-900 text-white overflow-hidden">
      
      {/* Remote Video (Full Screen) */}
      {remoteStream && (
          <video 
            ref={remoteVideoRef} 
            playsInline 
            autoPlay 
            className="absolute inset-0 w-full h-full object-cover z-0"
          />
      )}

      {/* Backdrop if no video */}
      <div className={`absolute inset-0 z-10 bg-slate-900/40 backdrop-blur-sm ${remoteStream ? 'bg-black/20' : 'bg-slate-900'}`}></div>

      {/* Local Video (PiP) */}
      {localStream && isVideoEnabled && (
          <div className="absolute top-4 right-4 w-32 h-48 bg-black rounded-xl overflow-hidden shadow-2xl border border-white/20 z-20">
              <video 
                ref={localVideoRef} 
                playsInline 
                autoPlay 
                muted 
                className="w-full h-full object-cover transform -scale-x-100" 
              />
          </div>
      )}

      {/* Main Info */}
      <div className="relative z-30 flex-1 flex flex-col items-center justify-center w-full max-w-md space-y-8 p-6">
        
        {!remoteStream && (
            <div className="relative">
            {status !== 'Идет разговор' && (
                <div className="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-20 scale-150"></div>
            )}
            <Avatar src={contact.avatarUrl} alt={contact.name} size="xl" />
            </div>
        )}

        <div className="text-center space-y-2 drop-shadow-md">
          <h2 className="text-3xl font-light tracking-tight">{contact.name}</h2>
          <p className="text-blue-200 text-lg font-medium">
            {status === 'Идет разговор' ? formatDuration(duration) : status}
          </p>
        </div>

      </div>

      {/* Controls */}
      <div className="relative z-30 pb-12 w-full max-w-md flex justify-center items-center gap-6">
         <button 
            onClick={onToggleMute}
            className={`p-4 rounded-full transition-all shadow-lg ${isMuted ? 'bg-white text-slate-900' : 'bg-slate-800/80 text-white hover:bg-slate-700 backdrop-blur-md'}`}
         >
            {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
         </button>

         <button 
            onClick={onEndCall}
            className="p-5 bg-red-500 hover:bg-red-600 rounded-full text-white shadow-xl transform hover:scale-105 transition-all"
         >
            <PhoneOff size={32} />
         </button>

         <button 
            onClick={onToggleVideo}
            className={`p-4 rounded-full transition-all shadow-lg ${!isVideoEnabled ? 'bg-white text-slate-900' : 'bg-slate-800/80 text-white hover:bg-slate-700 backdrop-blur-md'}`}
         >
            {!isVideoEnabled ? <VideoOff size={24} /> : <Video size={24} />}
         </button>
      </div>
    </div>
  );
};

export default CallOverlay;