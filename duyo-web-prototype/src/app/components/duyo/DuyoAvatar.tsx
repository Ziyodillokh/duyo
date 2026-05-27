import React from 'react';
import { cn } from '../../lib/utils';

export type DuyoState =
  | 'idle'
  | 'talking'
  | 'thinking'
  | 'sleeping'
  | 'happy'
  | 'sad'
  | 'low-energy'
  | 'reading'
  | 'celebrating'
  | 'encouraging'
  | 'crisis-support';

interface DuyoAvatarProps {
  state?: DuyoState;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  bodyShape?: 'spherical' | 'cubic' | 'vertical';
  primaryColor?: string;
  accentColor?: string;
  faceStyle?: number;
  className?: string;
}

export const DuyoAvatar: React.FC<DuyoAvatarProps> = ({
  state = 'idle',
  size = 'md',
  bodyShape = 'spherical',
  primaryColor = '#2563EB',
  accentColor = '#FFC700',
  faceStyle = 1,
  className,
}) => {
  const sizeMap = {
    sm: 'w-16 h-16',
    md: 'w-24 h-24',
    lg: 'w-40 h-40',
    xl: 'w-64 h-64',
  };

  const getEyeState = () => {
    switch (state) {
      case 'sleeping':
        return 'h-1';
      case 'happy':
      case 'celebrating':
        return 'h-4 scale-110';
      case 'sad':
        return 'h-3 opacity-70';
      case 'thinking':
        return 'h-3 animate-pulse';
      default:
        return 'h-3';
    }
  };

  const getMouthState = () => {
    switch (state) {
      case 'happy':
      case 'celebrating':
        return 'w-8 h-4 border-b-4 rounded-b-full';
      case 'sad':
        return 'w-8 h-3 border-t-4 rounded-t-full opacity-60';
      case 'sleeping':
        return 'w-6 h-1 bg-current opacity-50 rounded-full';
      case 'talking':
        return 'w-6 h-3 border-2 rounded-full animate-pulse';
      default:
        return 'w-6 h-2 border-b-2 rounded-b-full';
    }
  };

  const getAntennaGlow = () => {
    if (state === 'thinking' || state === 'reading') {
      return 'shadow-lg shadow-yellow-400 animate-pulse';
    }
    return '';
  };

  const getBodyAnimation = () => {
    if (state === 'celebrating') {
      return 'animate-bounce';
    }
    if (state === 'talking') {
      return 'animate-pulse';
    }
    return '';
  };

  return (
    <div className={cn('relative flex items-center justify-center', sizeMap[size], className)}>
      {/* Main body */}
      <div
        className={cn(
          'relative flex flex-col items-center justify-center transition-all duration-300',
          bodyShape === 'spherical' && 'w-full h-full rounded-full',
          bodyShape === 'cubic' && 'w-full h-full rounded-3xl',
          bodyShape === 'vertical' && 'w-3/4 h-full rounded-[2rem]',
          getBodyAnimation()
        )}
        style={{ backgroundColor: primaryColor }}
      >
        {/* Antenna with star */}
        <div className="absolute -top-2 flex flex-col items-center">
          <div className="w-1 h-6 bg-current opacity-70" style={{ color: accentColor }} />
          <div
            className={cn("w-3 h-3 rotate-45 transition-all duration-300", getAntennaGlow())}
            style={{ backgroundColor: accentColor }}
          />
        </div>

        {/* Face container */}
        <div className="flex flex-col items-center gap-2">
          {/* Eyes */}
          <div className="flex gap-3">
            <div
              className={cn(
                'w-3 rounded-full bg-white transition-all duration-300',
                getEyeState()
              )}
            />
            <div
              className={cn(
                'w-3 rounded-full bg-white transition-all duration-300',
                getEyeState()
              )}
            />
          </div>

          {/* Mouth */}
          <div className={cn('border-white transition-all duration-300', getMouthState())} />
        </div>

        {/* Body accent stripe */}
        <div
          className="absolute bottom-0 left-0 right-0 h-1/4 opacity-30 rounded-b-full"
          style={{ backgroundColor: accentColor }}
        />
      </div>

      {/* Status indicators for different states */}
      {state === 'crisis-support' && (
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-warning rounded-full border-2 border-white" />
      )}
      {state === 'low-energy' && (
        <div className="absolute bottom-0 left-0 right-0 h-2 bg-destructive/20 rounded-full" />
      )}
    </div>
  );
};
