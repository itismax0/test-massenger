
import React from 'react';
import { Contact, Message } from '../types';
import Avatar from './Avatar';
import { X, Phone, Mail, Bell, Image as ImageIcon, FileText, Link as LinkIcon, Users, Megaphone } from 'lucide-react';

interface ProfileInfoProps {
  contact: Contact;
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
}

const ProfileInfo: React.FC<ProfileInfoProps> = ({ contact, isOpen, onClose, messages }) => {
  if (!isOpen) return null;

  const isUser = contact.type === 'user';
  const isGroup = contact.type === 'group';
  const isChannel = contact.type === 'channel';

  // Filter for images only
  const mediaMessages = messages.filter(m => m.type === 'image' && m.attachmentUrl);

  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-black/20 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div 
        className="w-full sm:w-96 bg-white dark:bg-slate-800 h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 flex items-center justify-between border-b border-gray-100 dark:border-slate-700">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Информация</h3>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full text-gray-500 dark:text-gray-400 transition-colors">
                <X size={20} />
            </button>
        </div>

        <div className="flex-1 overflow-y-auto">
            {/* Profile Header */}
            <div className="p-6 flex flex-col items-center border-b border-gray-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                <div className="mb-4 shadow-lg rounded-full">
                    <Avatar src={contact.avatarUrl} alt={contact.name} size="xl" />
                </div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-white text-center">{contact.name}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {isUser && (contact.isOnline ? 'в сети' : 'был(а) недавно')}
                    {isGroup && `${contact.membersCount || 3} участников`}
                    {isChannel && `${contact.membersCount || 245} подписчиков`}
                </p>
            </div>

            {/* Info Section */}
            <div className="p-4 space-y-4">
                {isUser && contact.email && (
                    <div className="flex items-center gap-4 p-2">
                        <Mail className="text-gray-400" size={22} />
                        <div>
                            <p className="text-slate-800 dark:text-white text-sm">{contact.email}</p>
                            <p className="text-xs text-gray-500">Email</p>
                        </div>
                    </div>
                )}
                
                {(isGroup || isChannel) && (
                    <div className="flex items-center gap-4 p-2">
                        {isGroup ? <Users className="text-gray-400" size={22} /> : <Megaphone className="text-gray-400" size={22} />}
                        <div>
                            <p className="text-slate-800 dark:text-white text-sm">
                                {contact.description || (isGroup ? 'Групповой чат для общения' : 'Канал для новостей и обновлений')}
                            </p>
                            <p className="text-xs text-gray-500">Описание</p>
                        </div>
                    </div>
                )}

                <div className="flex items-center gap-4 p-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 rounded-lg transition-colors">
                    <Bell className="text-gray-400" size={22} />
                    <div className="flex-1">
                        <p className="text-slate-800 dark:text-white text-sm">Уведомления</p>
                        <p className="text-xs text-gray-500">Включены</p>
                    </div>
                    <div className="w-10 h-5 bg-blue-500 rounded-full relative">
                        <div className="absolute top-0.5 right-0.5 w-4 h-4 bg-white rounded-full"></div>
                    </div>
                </div>
            </div>

            {/* Media Tabs */}
            <div className="mt-2 border-t border-gray-100 dark:border-slate-700">
                <div className="flex overflow-x-auto scrollbar-hide p-2 gap-2">
                    <button className="px-4 py-2 bg-gray-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-full text-sm font-medium whitespace-nowrap">
                        Медиа
                    </button>
                    <button className="px-4 py-2 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-500 dark:text-gray-400 rounded-full text-sm font-medium whitespace-nowrap">
                        Файлы
                    </button>
                    <button className="px-4 py-2 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-500 dark:text-gray-400 rounded-full text-sm font-medium whitespace-nowrap">
                        Ссылки
                    </button>
                </div>
                
                {mediaMessages.length > 0 ? (
                    <div className="grid grid-cols-3 gap-1 p-1">
                        {mediaMessages.map((msg) => (
                            <div key={msg.id} className="aspect-square bg-gray-100 dark:bg-slate-700 rounded overflow-hidden">
                                 <img src={msg.attachmentUrl} alt="media" className="w-full h-full object-cover opacity-90 hover:opacity-100 transition-opacity cursor-pointer" />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="p-8 text-center text-gray-400 text-sm">
                        Нет фотографий
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileInfo;
