import React, { createContext, useContext, useState, ReactNode } from 'react';

export type AgeSegment = 'junior' | 'explorer' | 'companion';
export type UserRole = 'child' | 'parent' | 'admin';
export type SubscriptionTier = 'free' | 'standard' | 'premium';

export interface ChildProfile {
  id: string;
  name: string;
  age: number;
  ageSegment: AgeSegment;
  interests: string[];
  language: 'uz' | 'ru' | 'en';
  avatarConfig: AvatarConfig;
  xp: number;
  level: number;
  streak: number;
  coins: number;
  energy: number;
  learning: number;
  joy: number;
  health: number;
  subscription: SubscriptionTier;
}

export interface AvatarConfig {
  bodyShape: 'spherical' | 'cubic' | 'vertical';
  primaryColor: string;
  accentColor: string;
  faceStyle: number;
  accessories: string[];
}

interface UserContextType {
  userRole: UserRole;
  setUserRole: (role: UserRole) => void;
  childProfile: ChildProfile | null;
  setChildProfile: (profile: ChildProfile | null) => void;
  isAuthenticated: boolean;
  setIsAuthenticated: (auth: boolean) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within UserProvider');
  }
  return context;
};

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [userRole, setUserRole] = useState<UserRole>('child');
  const [childProfile, setChildProfile] = useState<ChildProfile | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  return (
    <UserContext.Provider
      value={{
        userRole,
        setUserRole,
        childProfile,
        setChildProfile,
        isAuthenticated,
        setIsAuthenticated,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};
