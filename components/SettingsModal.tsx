
import React, { useState, useRef, useEffect } from 'react';
import { X, Bell, Moon, Globe, Shield, Smartphone, ChevronRight, ArrowLeft, Camera, Trash2, Monitor, LogOut, User, AtSign, Fingerprint, Loader2, Save } from 'lucide-react';
import Avatar from './Avatar';
import { UserProfile, AppSettings, DeviceSession } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile;
  onUpdateProfile: (profile: UserProfile) => Promise<void>; // Changed to Promise
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
  devices: DeviceSession[];
  onTerminateSessions: () => void;
  onLogout: () => void;
}

type SettingsView = 'main' | 'notifications' | 'privacy' | 'appearance' | 'devices' | 'edit_profile';

const BG_COLORS = [
    { id: 'default', light: 'bg-[#f8fafc]', dark: 'bg-slate-900' },
    { id: 'blue', light: 'bg-blue-50', dark: 'bg-blue-950' },
    { id: 'green', light: 'bg-green-50', dark: 'bg-green-950' },
    { id: 'pink', light: 'bg-pink-50', dark: 'bg-pink-950' },
    { id: 'slate', light: 'bg-slate-200', dark: 'bg-slate-800' },
    { id: 'yellow', light: 'bg-yellow-50', dark: 'bg-yellow-950' },
    { id: 'purple', light: 'bg-purple-50', dark: 'bg-purple-950' },
    { id: 'red', light: 'bg-red-50', dark: 'bg-red-950' },
];

const SettingsModal: React.FC<SettingsModalProps> = ({ 
    isOpen, 
    onClose, 
    userProfile, 
    onUpdateProfile,
    settings,
    onUpdateSettings,
    devices,
    onTerminateSessions,
    onLogout
}) => {
  const [view, setView] = useState<SettingsView>('main');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Profile Edit State
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Reset view on open
  useEffect(() => {
    if (isOpen) {
        setView('main');
        setEditName(userProfile.name);
        setEditUsername(userProfile.username || '');
        setSaveError('');
    }
  }, [isOpen, userProfile]);

  if (!isOpen) return null;

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const newUrl = ev.target?.result as string;
        await onUpdateProfile({ ...userProfile, avatarUrl: newUrl });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async () => {
      setIsSaving(true);
      setSaveError('');
      try {
          await onUpdateProfile({
              ...userProfile,
              name: editName,
              username: editUsername
          });
          setView('main');
      } catch (e: any) {
          setSaveError(e.message || 'Ошибка сохранения');
      } finally {
          setIsSaving(false);
      }
  };

  const updateNestedSetting = (category: 'notifications' | 'privacy' | 'appearance', key: string, value: any) => {
      onUpdateSettings({
          ...settings,
          [category]: {
              ...settings[category],
              [key]: value
          }
      });
  };

  const cyclePrivacyOption = (key: keyof AppSettings['privacy']) => {
      if (typeof settings.privacy[key] === 'boolean') return;
      
      const options: ('Все' | 'Мои контакты' | 'Никто')[] = ['Все', 'Мои контакты', 'Никто'];
      const current = settings.privacy[key] as string;
      const nextIndex = (options.indexOf(current as any) + 1) % options.length;
      updateNestedSetting('privacy', key, options[nextIndex]);
  };

  const renderHeader = (title: string, onBack?: () => void) => (
    <div className="flex items-center p-4 border-b border-gray-100 dark:border-slate-700 relative bg-white dark:bg-slate-800 sticky top-0 z-10">
      {onBack && (
        <button onClick={onBack} className="absolute left-4 p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full text-slate-600 dark:text-slate-300 transition-colors">
          <ArrowLeft size={20} />
        </button>
      )}
      <h2 className={`text-lg font-semibold text-slate-800 dark:text-white w-full text-center ${onBack ? 'ml-0' : 'ml-2 text-left'}`}>{title}</h2>
      {!onBack && (
        <button onClick={onClose} className="absolute right-4 p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full text-gray-500 dark:text-gray-400 transition-colors">
          <X size={20} />
        </button>
      )}
    </div>
  );

  const renderMenuItem = (icon: React.ReactNode, label: string, colorClass: string, onClick: () => void, value?: string) => (
    <div onClick={onClick} className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-xl cursor-pointer transition-colors group">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-full transition-colors ${colorClass}`}>
          {icon}
        </div>
        <span className="text-slate-700 dark:text-slate-200 font-medium">{label}</span>
      </div>
      <div className="flex items-center gap-2">
         {value && <span className="text-sm text-gray-400">{value}</span>}
         <ChevronRight size={18} className="text-gray-300 dark:text-gray-600" />
      </div>
    </div>
  );

  const renderToggle = (label: string, enabled: boolean, onChange: (val: boolean) => void) => (
      <div 
        onClick={() => onChange(!enabled)}
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 rounded-xl transition-colors"
      >
          <span className="text-slate-700 dark:text-slate-200">{label}</span>
          <div className={`w-11 h-6 flex items-center rounded-full p-1 duration-300 ease-in-out ${enabled ? 'bg-blue-500' : 'bg-gray-300 dark:bg-slate-600'}`}>
              <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-300 ease-in-out ${enabled ? 'translate-x-5' : ''}`}></div>
          </div>
      </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-800 w-full max-w-md h-[90vh] md:h-auto md:max-h-[85vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        
        {view === 'main' && (
            <>
                {renderHeader('Настройки')}
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {/* Profile Section */}
                    <div className="flex flex-col items-center p-6 bg-gray-50 dark:bg-slate-900/50 rounded-2xl border border-gray-100 dark:border-slate-700">
                        <div className="relative group cursor-pointer mb-3" onClick={() => fileInputRef.current?.click()}>
                            <Avatar src={userProfile.avatarUrl} alt={userProfile.name} size="xl" />
                            <div className="absolute inset-0 bg-black/30 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Camera className="text-white" size={24} />
                            </div>
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                className="hidden" 
                                accept="image/*"
                                onChange={handleAvatarChange}
                            />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white">{userProfile.name}</h3>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
                            {userProfile.username ? `@${userProfile.username}` : userProfile.email}
                        </p>
                        
                        <button 
                            onClick={() => setView('edit_profile')}
                            className="text-blue-500 hover:text-blue-600 font-medium text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20 px-4 py-1.5 rounded-full transition-colors"
                        >
                            Изменить профиль
                        </button>
                    </div>

                    <div className="space-y-1">
                        {renderMenuItem(<Bell size={20} className="text-orange-500" />, 'Уведомления', 'bg-orange-100 dark:bg-orange-900/20', () => setView('notifications'))}
                        {renderMenuItem(<Shield size={20} className="text-green-500" />, 'Конфиденциальность', 'bg-green-100 dark:bg-green-900/20', () => setView('privacy'))}
                        {renderMenuItem(<Moon size={20} className="text-purple-500" />, 'Оформление', 'bg-purple-100 dark:bg-purple-900/20', () => setView('appearance'))}
                        {renderMenuItem(<Smartphone size={20} className="text-blue-500" />, 'Устройства', 'bg-blue-100 dark:bg-blue-900/20', () => setView('devices'))}
                        {renderMenuItem(<Globe size={20} className="text-cyan-500" />, 'Язык', 'bg-cyan-100 dark:bg-cyan-900/20', () => {}, settings.language)}
                    </div>

                    <div className="pt-4 border-t border-gray-100 dark:border-slate-700">
                         <button 
                            onClick={onLogout}
                            className="w-full p-3 flex items-center justify-center gap-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors font-medium"
                         >
                             <LogOut size={20} />
                             Выйти
                         </button>
                    </div>
                </div>
            </>
        )}

        {view === 'edit_profile' && (
            <>
                {renderHeader('Изменить профиль', () => setView('main'))}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {saveError && (
                        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm text-center">
                            {saveError}
                        </div>
                    )}
                    
                    <div className="space-y-4">
                        <div className="space-y-1">
                             <label className="text-xs font-semibold text-gray-500 uppercase ml-1">Имя</label>
                             <div className="flex items-center bg-gray-50 dark:bg-slate-700 rounded-xl border border-gray-200 dark:border-slate-600 px-3">
                                 <User size={18} className="text-gray-400" />
                                 <input 
                                    type="text" 
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="flex-1 bg-transparent border-none focus:ring-0 py-3 text-slate-800 dark:text-white"
                                    placeholder="Ваше имя"
                                 />
                             </div>
                        </div>

                        <div className="space-y-1">
                             <label className="text-xs font-semibold text-gray-500 uppercase ml-1">Имя пользователя</label>
                             <div className="flex items-center bg-gray-50 dark:bg-slate-700 rounded-xl border border-gray-200 dark:border-slate-600 px-3">
                                 <AtSign size={18} className="text-gray-400" />
                                 <input 
                                    type="text" 
                                    value={editUsername}
                                    onChange={(e) => setEditUsername(e.target.value)}
                                    className="flex-1 bg-transparent border-none focus:ring-0 py-3 text-slate-800 dark:text-white"
                                    placeholder="username"
                                 />
                             </div>
                             <p className="text-xs text-gray-400 ml-1">
                                 Это имя смогут использовать другие люди, чтобы найти вас. Минимум 5 символов (a-z, 0-9, _).
                             </p>
                        </div>

                        <div className="space-y-1 pt-2">
                             <label className="text-xs font-semibold text-gray-500 uppercase ml-1">Информация об аккаунте</label>
                             <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 divide-y divide-gray-100 dark:divide-slate-700">
                                 <div className="flex justify-between items-center p-3">
                                     <span className="text-gray-500 dark:text-gray-400 text-sm">Email</span>
                                     <span className="text-slate-800 dark:text-white font-medium text-sm">{userProfile.email}</span>
                                 </div>
                                 <div className="flex justify-between items-center p-3">
                                     <span className="text-gray-500 dark:text-gray-400 text-sm flex items-center gap-1"><Fingerprint size={14}/> ID</span>
                                     <span className="text-slate-800 dark:text-white font-mono text-sm bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded">
                                         {userProfile.id}
                                     </span>
                                 </div>
                             </div>
                        </div>
                    </div>

                    <div className="pt-4">
                        <button 
                            onClick={handleSaveProfile}
                            disabled={isSaving}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-70"
                        >
                            {isSaving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                            Сохранить изменения
                        </button>
                    </div>
                </div>
            </>
        )}

        {view === 'notifications' && (
            <>
                {renderHeader('Уведомления', () => setView('main'))}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {renderToggle('Показывать уведомления', settings.notifications.show, (v) => updateNestedSetting('notifications', 'show', v))}
                    {renderToggle('Предпросмотр сообщения', settings.notifications.preview, (v) => updateNestedSetting('notifications', 'preview', v))}
                    {renderToggle('Звук', settings.notifications.sound, (v) => updateNestedSetting('notifications', 'sound', v))}
                    {renderToggle('Звуки в чате', settings.notifications.chatSounds, (v) => updateNestedSetting('notifications', 'chatSounds', v))}
                    {renderToggle('Вибрация', settings.notifications.vibration, (v) => updateNestedSetting('notifications', 'vibration', v))}
                </div>
            </>
        )}

        {view === 'privacy' && (
            <>
                {renderHeader('Конфиденциальность', () => setView('main'))}
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    <div className="space-y-2">
                        <h4 className="text-xs font-semibold text-gray-400 uppercase ml-2">Кто видит</h4>
                        <div className="bg-gray-50 dark:bg-slate-900/50 rounded-2xl overflow-hidden border border-gray-100 dark:border-slate-700">
                            {renderMenuItem(<span className="text-xl">📞</span>, 'Номер телефона', 'bg-transparent', () => cyclePrivacyOption('email'), settings.privacy.email)}
                            {renderMenuItem(<span className="text-xl">👀</span>, 'Последняя активность', 'bg-transparent', () => cyclePrivacyOption('lastSeen'), settings.privacy.lastSeen)}
                            {renderMenuItem(<span className="text-xl">📷</span>, 'Фото профиля', 'bg-transparent', () => cyclePrivacyOption('profilePhoto'), settings.privacy.profilePhoto)}
                        </div>
                    </div>
                    
                    <div className="space-y-2">
                         <h4 className="text-xs font-semibold text-gray-400 uppercase ml-2">Безопасность</h4>
                         <div className="bg-gray-50 dark:bg-slate-900/50 rounded-2xl overflow-hidden border border-gray-100 dark:border-slate-700">
                            {renderToggle('Код-пароль', settings.privacy.passcode, (v) => updateNestedSetting('privacy', 'passcode', v))}
                            {renderToggle('Двухэтапная аутентификация', settings.privacy.twoFactor, (v) => updateNestedSetting('privacy', 'twoFactor', v))}
                         </div>
                    </div>
                </div>
            </>
        )}

        {view === 'appearance' && (
            <>
                {renderHeader('Оформление', () => setView('main'))}
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    <div className="space-y-4">
                        {renderToggle('Темная тема', settings.appearance.darkMode, (v) => updateNestedSetting('appearance', 'darkMode', v))}
                        
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3 ml-1">Размер текста: {settings.appearance.textSize}%</label>
                            <input 
                                type="range" 
                                min="80" 
                                max="150" 
                                step="10" 
                                value={settings.appearance.textSize}
                                onChange={(e) => updateNestedSetting('appearance', 'textSize', parseInt(e.target.value))}
                                className="w-full accent-blue-500 h-2 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>

                        <div>
                             <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3 ml-1">Фон чата</label>
                             <div className="grid grid-cols-4 gap-3">
                                 {BG_COLORS.map((bg) => (
                                     <button
                                        key={bg.id}
                                        onClick={() => updateNestedSetting('appearance', 'chatBackground', bg.id)}
                                        className={`w-full aspect-square rounded-full border-2 transition-all ${bg.light} ${bg.dark} ${settings.appearance.chatBackground === bg.id ? 'border-blue-500 scale-110' : 'border-transparent hover:scale-105'}`}
                                     />
                                 ))}
                             </div>
                        </div>
                    </div>
                </div>
            </>
        )}

        {view === 'devices' && (
            <>
                 {renderHeader('Устройства', () => setView('main'))}
                 <div className="flex-1 overflow-y-auto p-4 space-y-6">
                     
                     <div className="text-center py-6">
                         <Monitor size={64} className="mx-auto text-blue-500 mb-4" />
                         <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Активные сеансы</h3>
                         <p className="text-gray-500 text-sm">Управляйте устройствами, на которых выполнен вход.</p>
                     </div>

                     <button 
                        onClick={onTerminateSessions}
                        className="w-full py-3 text-red-500 font-medium border border-red-200 dark:border-red-900/30 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                     >
                         Завершить все другие сеансы
                     </button>

                     <div className="space-y-3">
                         {devices.map((device) => (
                             <div key={device.id} className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-slate-900/50 rounded-xl">
                                 <div className={`p-2.5 rounded-full ${device.isCurrent ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-500 dark:bg-slate-700 dark:text-gray-400'}`}>
                                     {device.icon === 'mobile' ? <Smartphone size={20} /> : <Monitor size={20} />}
                                 </div>
                                 <div className="flex-1">
                                     <h4 className="font-medium text-slate-800 dark:text-white flex items-center gap-2">
                                         {device.name}
                                         {device.isCurrent && <span className="text-[10px] bg-green-500 text-white px-1.5 rounded font-bold">ЭТО</span>}
                                     </h4>
                                     <p className="text-xs text-gray-500">{device.platform} • {device.lastActive}</p>
                                 </div>
                             </div>
                         ))}
                     </div>
                 </div>
            </>
        )}
      </div>
    </div>
  );
};

export default SettingsModal;
