import React, { useState, useEffect } from 'react';

interface AvatarProps {
  src?: string;
  alt: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  status?: boolean; // isOnline
}

const Avatar: React.FC<AvatarProps> = ({ src, alt, size = 'md', status }) => {
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [src]);

  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-12 h-12 text-lg',
    lg: 'w-16 h-16 text-xl',
    xl: 'w-24 h-24 text-3xl',
  };

  const getInitials = (name: string) => {
    return name ? name.charAt(0).toUpperCase() : '?';
  };

  // Generate a consistent pastel color from the name string
  const getBackgroundColor = (name: string) => {
    const colors = [
      '#ef4444', // red-500
      '#f97316', // orange-500
      '#f59e0b', // amber-500
      '#84cc16', // lime-500
      '#10b981', // emerald-500
      '#06b6d4', // cyan-500
      '#3b82f6', // blue-500
      '#6366f1', // indigo-500
      '#8b5cf6', // violet-500
      '#d946ef', // fuchsia-500
      '#f43f5e', // rose-500
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash % colors.length)];
  };

  const hasValidImage = src && !imageError;

  return (
    <div className="relative inline-block">
      {hasValidImage ? (
        <img
          src={src}
          alt={alt}
          onError={() => setImageError(true)}
          className={`${sizeClasses[size]} rounded-full object-cover border border-gray-100 bg-gray-200`}
        />
      ) : (
        <div 
            className={`${sizeClasses[size]} rounded-full flex items-center justify-center font-bold text-white shadow-inner border border-white/20`}
            style={{ backgroundColor: getBackgroundColor(alt) }}
        >
            {getInitials(alt)}
        </div>
      )}
      
      {status !== undefined && (
        <span
          className={`absolute bottom-0 right-0 block h-3 w-3 rounded-full ring-2 ring-white ${
            status ? 'bg-green-400' : 'bg-gray-400'
          }`}
        />
      )}
    </div>
  );
};

export default Avatar;