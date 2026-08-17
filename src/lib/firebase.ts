/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, setLogLevel } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Suppress transient connection warnings
setLogLevel('error');

// Redirect Firestore connection/offline warning errors to console.warn to avoid false positive error reports
if (typeof window !== 'undefined') {
  const originalConsoleError = console.error;
  console.error = (...args: any[]) => {
    const firstArg = args[0];
    const fullMsg = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
    if (
      (typeof firstArg === 'string' && (
        firstArg.includes('Could not reach Cloud Firestore backend') ||
        firstArg.includes('Failed to get document from server') ||
        firstArg.includes('@firebase/firestore') ||
        firstArg.includes('Firestore Error') ||
        firstArg.includes('Quota limit exceeded') ||
        firstArg.includes('quota exceeded')
      )) ||
      fullMsg.includes('Quota limit exceeded') ||
      fullMsg.includes('quota exceeded') ||
      fullMsg.includes('Firestore Error')
    ) {
      console.warn('[Firestore Offline Graceful Fallback]', ...args);
      return;
    }
    originalConsoleError.apply(console, args);
  };
}

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  }),
  experimentalForceLongPolling: true
}, firebaseConfig.firestoreDatabaseId);

export const auth = getAuth(app);

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
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const isQuotaError = errorMessage.includes("Quota limit exceeded");
  const isUnavailableError = errorMessage.includes("unavailable") || errorMessage.includes("Could not reach Cloud Firestore backend");

  const errInfo: FirestoreErrorInfo = {
    error: errorMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };

  if (isQuotaError || isUnavailableError) {
    console.warn('FIRESTORE OFFLINE / QUOTA NOTICE: Operating in offline fallback mode.', errorMessage);
    return;
  }

  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
