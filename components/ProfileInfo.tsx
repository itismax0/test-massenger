
import React, { useState } from 'react';
import { Contact, Message } from '../types';
import Avatar from './Avatar';
import { X, Mail, Bell, Image as ImageIcon, FileText, Link as LinkIcon, Users, ChevronRight, Shield, UserX, Clock, Brush, Ban, Heart, Link, Activity } from 'lucide-react';

interface ProfileInfoProps {
  contact: Contact;
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
}

const ProfileInfo: React.FC<ProfileInfoProps> = ({ contact, isOpen, onClose, messages }) => {
  const [activeTab, setActiveTab] = useState<'media' | 'files' | 'links'>('media');
  const [showMembers, setShowMembers] = useState(false);

  if (!isOpen) return null;

  const isUser = contact.type === 'user';
  const isGroup = contact.type === 'group';
  const isChannel = contact.type === 'channel';

  // Filter messages
  const mediaMessages = messages.filter(m => m.type === 'image' && m.attachmentUrl);
  const fileMessages = messages.filter(m => m.type === 'file');
  const linkMessages = messages.filter(m => m.type === 'text' && /(https?:\/\/[^\s]+)/g.test(m.text));

  const extractFirstLink = (text: string) => {
    const match = text.match(/(https?:\/\/[^\s]+)/);
    return match ? match[0] : '';
  };

  const renderGroupMenu = () => (
      <div className="p-4 space-y-1">
          <div className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-xl cursor-pointer transition-colors">
              <div className="flex items-center gap-3">
                  <div className="p-1.5 bg-green-500 text-white rounded-lg">
                    <Clock size={18} />
                  </div>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">История чата</span>
              </div>
              <span className="text-sm text-gray-400 flex items-center gap-1">
                  Видна <ChevronRight size={16} />
              </span>
          </div>

          <div className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-xl cursor-pointer transition-colors">
              <div className="flex items-center gap-3">
                  <div className="p-1.5 bg-blue-500 text-white rounded-lg">
                    <Link size={18} />
                  </div>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Пригласительные ссылки</span>
              </div>
              <span className="text-sm text-gray-400 flex items-center gap-1">
                  1 <ChevronRight size={16} />
              </span>
          </div>

          <div className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-xl cursor-pointer transition-colors">
              <div className="flex items-center gap-3">
                  <div className="p-1.5 bg-pink-500 text-white rounded-lg">
                    <Heart size={18} />
                  </div>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Реакции</span>
              </div>
              <span className="text-sm text-gray-400 flex items-center gap-1">
                  Все реакции <ChevronRight size={16} />
              </span>
          </div>

          <div className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-xl cursor-pointer transition-colors mb-4">
              <div className="flex items-center gap-3">
                  <div className="p-1.5 bg-orange-500 text-white rounded-lg">
                    <Brush size={18} />
                  </div>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Оформление</span>
              </div>
              <ChevronRight size={16} className="text-gray-400" />
          </div>

          {/* Spacer / Divider */}
          <div className="h-2 bg-transparent"></div>

          <div 
            onClick={() => setShowMembers(true)}
            className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-xl cursor-pointer transition-colors"
          >
              <div className="flex items-center gap-3">
                  <div className="p-1.5 bg-cyan-500 text-white rounded-lg">
                    <Users size={18} />
                  </div>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Участники</span>
              </div>
              <span className="text-sm text-gray-400 flex items-center gap-1">
                  {contact.members?.length || contact.membersCount || 1} <ChevronRight size={16} />
              </span>
          </div>

          <div className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-xl cursor-pointer transition-colors">
              <div className="flex items-center gap-3">
                  <div className="p-1.5 bg-gray-400 text-white rounded-lg">
                    <Shield size={18} />
                  </div>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Разрешения</span>
              </div>
              <span className="text-sm text-gray-400 flex items-center gap-1">
                  13/13 <ChevronRight size={16} />
              </span>
          </div>

          <div className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-xl cursor-pointer transition-colors">
              <div className="flex items-center gap-3">
                  <div className="p-1.5 bg-green-500 text-white rounded-lg">
                    <Shield size={18} />
                  </div>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Администраторы</span>
              </div>
              <span className="text-sm text-gray-400 flex items-center gap-1">
                  {contact.members?.filter(m => m.role === 'admin' || m.role === 'owner').length || 1} <ChevronRight size={16} />
              </span>
          </div>

          <div className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-xl cursor-pointer transition-colors">
              <div className="flex items-center gap-3">
                  <div className="p-1.5 bg-red-500 text-white rounded-lg">
                    <Ban size={18} />
                  </div>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Чёрный список</span>
              </div>
              <ChevronRight size={16} className="text-gray-400" />
          </div>

           <div className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-xl cursor-pointer transition-colors">
              <div className="flex items-center gap-3">
                  <div className="p-1.5 bg-orange-400 text-white rounded-lg">
                    <Activity size={18} />
                  </div>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Недавние действия</span>
              </div>
              <ChevronRight size={16} className="text-gray-400" />
          </div>
      </div>
  );

  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-black/20 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div 
        className="w-full sm:w-96 bg-white dark:bg-slate-800 h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 flex items-center justify-between border-b border-gray-100 dark:border-slate-700">
            {showMembers ? (
                 <div className="flex items-center gap-2">
                     <button onClick={() => setShowMembers(false)} className="text-blue-500 flex items-center gap-1 text-sm font-medium">
                         <ChevronRight className="rotate-180" size={20} />
                         Назад
                     </button>
                     <h3 className="text-lg font-semibold text-slate-800 dark:text-white ml-14">Участники</h3>
                 </div>
            ) : (
                <>
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Информация</h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full text-gray-500 dark:text-gray-400 transition-colors">
                        <X size={20} />
                    </button>
                </>
            )}
        </div>

        <div className="flex-1 overflow-y-auto">
            {!showMembers ? (
                <>
                    {/* Profile Header */}
                    <div className="p-6 flex flex-col items-center border-b border-gray-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                        <div className="mb-4 shadow-lg rounded-full">
                            <Avatar src={contact.avatarUrl} alt={contact.name} size="xl" id={contact.id} />
                        </div>
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white text-center">{contact.name}</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            {isUser && (contact.isOnline ? 'в сети' : 'был(а) недавно')}
                            {isGroup && `${contact.membersCount || contact.members?.length || 0} участников`}
                            {isChannel && `${contact.membersCount || 0} подписчиков`}
                        </p>
                    </div>

                    {/* Group Specific Menu */}
                    {(isGroup || isChannel) && renderGroupMenu()}

                    {/* User Info Section */}
                    {isUser && (
                         <div className="p-4 space-y-4">
                            {contact.email && (
                                <div className="flex items-center gap-4 p-2">
                                    <Mail className="text-gray-400" size={22} />
                                    <div>
                                        <p className="text-slate-800 dark:text-white text-sm">{contact.email}</p>
                                        <p className="text-xs text-gray-500">Email</p>
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
                    )}

                    {/* Media Tabs */}
                    <div className="mt-2 border-t border-gray-100 dark:border-slate-700">
                        <div className="flex overflow-x-auto scrollbar-hide p-2 gap-2">
                            <button 
                                onClick={() => setActiveTab('media')}
                                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'media' ? 'bg-gray-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200' : 'hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-500 dark:text-gray-400'}`}
                            >
                                Медиа
                            </button>
                            <button 
                                onClick={() => setActiveTab('files')}
                                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'files' ? 'bg-gray-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200' : 'hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-500 dark:text-gray-400'}`}
                            >
                                Файлы
                            </button>
                            <button 
                                onClick={() => setActiveTab('links')}
                                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'links' ? 'bg-gray-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200' : 'hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-500 dark:text-gray-400'}`}
                            >
                                Ссылки
                            </button>
                        </div>
                        
                        <div className="min-h-[200px]">
                            {activeTab === 'media' && (
                                mediaMessages.length > 0 ? (
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
                                )
                            )}

                            {activeTab === 'files' && (
                                fileMessages.length > 0 ? (
                                    <div className="p-2 space-y-2">
                                        {fileMessages.map(msg => (
                                            <div key={msg.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-slate-700/50 rounded-lg transition-colors cursor-pointer">
                                                <div className="p-2.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                                                    <FileText size={20} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-slate-800 dark:text-white truncate">{msg.fileName || 'Документ'}</p>
                                                    <p className="text-xs text-gray-500">{msg.fileSize || 'unknown'} • {new Date(msg.timestamp).toLocaleDateString()}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-8 text-center text-gray-400 text-sm">
                                        Нет файлов
                                    </div>
                                )
                            )}

                            {activeTab === 'links' && (
                                linkMessages.length > 0 ? (
                                    <div className="p-2 space-y-2">
                                        {linkMessages.map(msg => {
                                            const link = extractFirstLink(msg.text);
                                            return (
                                                <div key={msg.id} className="flex items-start gap-3 p-2 hover:bg-gray-50 dark:hover:bg-slate-700/50 rounded-lg transition-colors cursor-pointer">
                                                    <div className="p-2.5 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 rounded-lg mt-0.5">
                                                        <LinkIcon size={20} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <a href={link} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-500 hover:underline truncate block" onClick={e => e.stopPropagation()}>
                                                            {link}
                                                        </a>
                                                        <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 mt-0.5">
                                                            {msg.text.replace(link, '').trim() || 'Ссылка'}
                                                        </p>
                                                        <p className="text-[10px] text-gray-400 mt-1">{new Date(msg.timestamp).toLocaleDateString()}</p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="p-8 text-center text-gray-400 text-sm">
                                        Нет ссылок
                                    </div>
                                )
                            )}
                        </div>
                    </div>
                </>
            ) : (
                <div className="p-4 space-y-2">
                    {contact.members && contact.members.length > 0 ? (
                        contact.members.map((member) => (
                            <div key={member.id} className="flex items-center p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                                <Avatar src={member.avatarUrl} alt={member.name} size="md" />
                                <div className="ml-3 flex-1">
                                    <h4 className="text-sm font-medium text-slate-800 dark:text-white flex items-center gap-1">
                                        {member.name}
                                        {member.role === 'owner' && <span className="text-[10px] text-gray-400 ml-auto">владелец</span>}
                                        {member.role === 'admin' && <span className="text-[10px] text-gray-400 ml-auto">админ</span>}
                                    </h4>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {member.lastSeen || 'был(а) недавно'}
                                    </p>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-center text-gray-500 p-4">Нет участников</p>
                    )}
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default ProfileInfo;
