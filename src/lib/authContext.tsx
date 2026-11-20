import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, googleAuthProvider, syncUserProfileToFirestore } from './firebase';
import { apiRequest, setAuthToken } from './api';

export interface UserSummary {
  id: number;
  uid: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  canBuy: boolean;
  canSell: boolean;
  activeRole: 'buyer' | 'seller' | 'admin';
  isAdmin: boolean;
  emailVerified: boolean;
  isRestricted: boolean;
  restrictionReason: string | null;
  isDemo: boolean;
}

export interface AccountState {
  user: UserSummary;
  buyerProfile: {
    organizationName: string;
    description: string;
    website: string;
    industry: string;
    contactPreference: string;
    location: string;
    timezone: string;
  } | null;
  sellerProfile: {
    headline: string;
    bio: string;
    skills: string[];
    experience: Array<{ role: string; company: string; period: string; summary: string }>;
    education: Array<{ degree: string; institution: string; year: string }>;
    languages: string[];
    pricingPreference: 'fixed' | 'hourly' | 'both';
    hourlyRate: number | null;
    currency: string;
    availability: 'available' | 'limited' | 'unavailable';
    location: string;
    timezone: string;
    cvFileId: number | null;
    portfolioLinks: Array<{ label: string; url: string }>;
  } | null;
  cvFile: { id: number; fileName: string; sizeBytes: number; createdAt: string } | null;
  portfolio: Array<{
    id: number;
    title: string;
    description: string;
    toolsUsed: string[];
    rolePerformed: string;
    externalUrl: string;
    imageUrl: string;
    verifiedContribution: boolean;
  }>;
  unreadNotifications: number;
  buyerCompletion: { percent: number; missing: string[] };
  sellerCompletion: { percent: number; missing: string[] };
}

interface AuthContextValue {
  account: AccountState | null;
  loading: boolean;
  loginWithEmail: (email: string, password: string) => Promise<AccountState>;
  registerWithEmail: (payload: {
    name: string;
    email: string;
    password: string;
    roleChoice: 'buyer' | 'seller' | 'both';
  }) => Promise<AccountState & { devVerificationCode?: string }>;
  loginWithDemo: (email: string) => Promise<AccountState>;
  loginWithGoogle: () => Promise<AccountState>;
  logout: () => Promise<void>;
  refreshAccount: () => Promise<void>;
  switchRole: (patch: { activeRole?: 'buyer' | 'seller' | 'admin'; canBuy?: boolean; canSell?: boolean }) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const SESSION_KEY = 'briefline_local_session_v1';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<AccountState | null>(null);
  const [loading, setLoading] = useState(true);

  const applyAccountSession = useCallback((token: string, data: AccountState) => {
    setAuthToken(token);
    if (token.startsWith('local.')) {
      sessionStorage.setItem(SESSION_KEY, token);
    }
    setAccount(data);
  }, []);

  const refreshAccount = useCallback(async () => {
    try {
      const data = await apiRequest<AccountState>('/api/auth/me');
      setAccount(data);
    } catch {
      setAccount(null);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const savedLocal = sessionStorage.getItem(SESSION_KEY);
    if (savedLocal) {
      setAuthToken(savedLocal);
      apiRequest<AccountState>('/api/auth/me', { token: savedLocal })
        .then((data) => {
          if (active) setAccount(data);
        })
        .catch(() => {
          sessionStorage.removeItem(SESSION_KEY);
          setAuthToken(null);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    } else {
      setLoading(false);
    }

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) return;
      try {
        const idToken = await fbUser.getIdToken();
        setAuthToken(idToken);
        const data = await apiRequest<AccountState>('/api/auth/me', { token: idToken });
        if (active) setAccount(data);
        void syncUserProfileToFirestore(data.user).catch(() => {});
      } catch (err) {
        console.error('Firebase auth sync failed:', err);
      } finally {
        if (active) setLoading(false);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const loginWithEmail = useCallback(
    async (email: string, password: string) => {
      const res = await apiRequest<AccountState & { token: string }>('/api/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      const { token, ...rest } = res;
      applyAccountSession(token, rest);
      return rest;
    },
    [applyAccountSession]
  );

  const registerWithEmail = useCallback(
    async (payload: { name: string; email: string; password: string; roleChoice: 'buyer' | 'seller' | 'both' }) => {
      const res = await apiRequest<AccountState & { token: string; devVerificationCode?: string }>('/api/auth/register', {
        method: 'POST',
        body: payload,
      });
      const { token, ...rest } = res;
      applyAccountSession(token, rest);
      return rest;
    },
    [applyAccountSession]
  );

  const loginWithDemo = useCallback(
    async (email: string) => {
      const res = await apiRequest<AccountState & { token: string }>('/api/auth/demo-login', {
        method: 'POST',
        body: { email },
      });
      const { token, ...rest } = res;
      applyAccountSession(token, rest);
      return rest;
    },
    [applyAccountSession]
  );

  const loginWithGoogle = useCallback(async () => {
    const cred = await signInWithPopup(auth, googleAuthProvider);
    const idToken = await cred.user.getIdToken();
    sessionStorage.removeItem(SESSION_KEY);
    setAuthToken(idToken);
    const data = await apiRequest<AccountState>('/api/auth/me', { token: idToken });
    setAccount(data);
    void syncUserProfileToFirestore(data.user).catch(() => {});
    return data;
  }, []);

  const logout = useCallback(async () => {
    sessionStorage.removeItem(SESSION_KEY);
    setAuthToken(null);
    setAccount(null);
    try {
      await firebaseSignOut(auth);
    } catch {
      // ignore if signed in with local credentials
    }
  }, []);

  const switchRole = useCallback(
    async (patch: { activeRole?: 'buyer' | 'seller' | 'admin'; canBuy?: boolean; canSell?: boolean }) => {
      const data = await apiRequest<AccountState>('/api/auth/role', {
        method: 'PATCH',
        body: patch,
      });
      setAccount(data);
      void syncUserProfileToFirestore(data.user).catch(() => {});
    },
    []
  );

  return (
    <AuthContext.Provider
      value={{
        account,
        loading,
        loginWithEmail,
        registerWithEmail,
        loginWithDemo,
        loginWithGoogle,
        logout,
        refreshAccount,
        switchRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
