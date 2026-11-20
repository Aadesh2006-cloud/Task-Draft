import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleAuthProvider = new GoogleAuthProvider();
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

if (typeof window !== 'undefined') {
  void testConnection();
}

function clampString(value: string, maxLength: number): string {
  return value.trim().slice(0, maxLength);
}

/**
 * Mirrors an authenticated, email-verified Firebase user's core profile to Firestore `/users/{uid}`.
 * Payloads strictly match `firebase-blueprint.json` boundaries and server timestamps.
 */
export async function syncUserProfileToFirestore(profile: {
  name: string;
  email: string;
  activeRole: string;
  canBuy: boolean;
  canSell: boolean;
}): Promise<void> {
  const fbUser = auth.currentUser;
  if (!fbUser || !fbUser.emailVerified) return;

  const docPath = `users/${fbUser.uid}`;
  const ref = doc(db, 'users', fbUser.uid);
  const safeRole = profile.activeRole === 'seller' ? 'seller' : 'buyer';
  const safeName = clampString(profile.name || fbUser.displayName || 'Briefline User', 120) || 'Briefline User';
  const safeEmail = clampString(profile.email || fbUser.email || '', 254);
  if (safeEmail.length < 3) return;

  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, {
        name: safeName,
        activeRole: safeRole,
        canBuy: Boolean(profile.canBuy),
        canSell: Boolean(profile.canSell),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        uid: fbUser.uid,
        name: safeName,
        email: safeEmail,
        activeRole: safeRole,
        canBuy: Boolean(profile.canBuy),
        canSell: Boolean(profile.canSell),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

/**
 * Mirrors a buyer-published project brief to Firestore `/project_briefs/{briefId}` when signed in via Firebase Auth.
 */
export async function syncProjectBriefToFirestore(input: {
  projectId: number;
  title: string;
  category: string;
  subcategory: string;
  budgetType: 'fixed' | 'hourly';
  budgetMin: number;
  budgetMax: number;
  currency: string;
  status: 'draft' | 'open' | 'paused' | 'hired' | 'closed' | 'cancelled';
  skills: string[];
}): Promise<void> {
  const fbUser = auth.currentUser;
  if (!fbUser || !fbUser.emailVerified) return;

  const briefId = `brief_${input.projectId}`;
  const docPath = `project_briefs/${briefId}`;
  const ref = doc(db, 'project_briefs', briefId);
  const safeSkills = input.skills
    .map((s) => clampString(s, 60))
    .filter(Boolean)
    .slice(0, 15);
  const safeTitle = clampString(input.title, 180);
  if (safeTitle.length < 3) return;

  try {
    const snap = await getDoc(ref);
    const commonFields = {
      title: safeTitle,
      category: clampString(input.category || 'Custom Brief', 80) || 'Custom Brief',
      subcategory: clampString(input.subcategory || '', 80),
      budgetType: input.budgetType === 'hourly' ? 'hourly' : 'fixed',
      budgetMin: Math.max(0, Math.min(10000000, Math.round(input.budgetMin || 0))),
      budgetMax: Math.max(0, Math.min(10000000, Math.round(input.budgetMax || 0))),
      currency: clampString(input.currency || 'USD', 6) || 'USD',
      status: input.status,
      skills: safeSkills,
      updatedAt: serverTimestamp(),
    };

    if (snap.exists()) {
      await updateDoc(ref, commonFields);
    } else {
      await setDoc(ref, {
        briefId,
        buyerUid: fbUser.uid,
        projectId: input.projectId,
        ...commonFields,
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}
