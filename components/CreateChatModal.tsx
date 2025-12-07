import React, { useState } from 'react';
import { X, Users, Megaphone, Check } from 'lucide-react';
import { ContactType } from '../types';

interface CreateChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
  type: ContactType;
}

const CreateChatModal: React.FC<CreateChatModalProps> = ({ isOpen, onClose, onCreate, type }) => {
  const [name, setName] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onCreate(name);
      setName('');
      onClose();
    }
  };

  const isGroup = type === 'group';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-2xl shadow-2xl p-6 m-4 animate-in zoom-in-95 duration-200">
        
        <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                {isGroup ? <Users size={24} className="text-blue-500" /> : <Megaphone size={24} className="text-orange-500" />}
                {isGroup ? 'Новая группа' : 'Новый канал'}
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X size={24} />
            </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
                <div className="flex justify-center mb-6">
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center overflow-hidden transition-colors ${name ? (isGroup ? 'bg-blue-600' : 'bg-orange-500') : (isGroup ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600')}`}>
                        {name ? (
                            <span className="text-3xl font-bold text-white uppercase">{name.charAt(0)}</span>
                        ) : (
                            isGroup ? <Users size={40} /> : <Megaphone size={40} />
                        )}
                    </div>
                </div>
                
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {isGroup ? 'Название группы' : 'Название канала'}
                </label>
                <input 
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={isGroup ? "Введите название группы..." : "Введите название канала..."}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    autoFocus
                />
            </div>

            <button 
                type="submit"
                disabled={!name.trim()}
                className={`w-full py-3.5 rounded-xl font-medium text-white flex items-center justify-center gap-2 transition-all ${
                    name.trim() 
                    ? 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/30 transform hover:-translate-y-0.5' 
                    : 'bg-gray-300 dark:bg-slate-700 cursor-not-allowed text-gray-500'
                }`}
            >
                <Check size={20} />
                Создать
            </button>
        </form>

      </div>
    </div>
  );
};

export default CreateChatModal;