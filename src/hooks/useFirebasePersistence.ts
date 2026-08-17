import { useEffect, Dispatch, SetStateAction } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot, query, where, or } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { User, AppAction } from '../types';
import { mapFirestoreUser, safeLocalStorageSet } from '../utils';
import { saveCachedUsersBatch } from '../lib/offlineDb';

export const useFirebasePersistence = (
  setRegisteredUsers: Dispatch<SetStateAction<User[]>>,
  setIsUsersLoaded: Dispatch<SetStateAction<boolean>>,
  dispatch: Dispatch<AppAction>,
  syncOwnerId: string | null
) => {
  useEffect(() => {
    // If we have a local cache, load it immediately to speed up UI
    const saved = localStorage.getItem('OPay_Registered_Users_v4');
    if (saved) {
      try {
        const list = JSON.parse(saved);
        if (Array.isArray(list)) {
          setRegisteredUsers(list);
          dispatch({ type: 'SET_REGISTERED_USERS', payload: list });
          setIsUsersLoaded(true); // Allow login immediately if we have cached users
        }
      } catch (e) {
        console.error('[Persistence] Failed to load from local storage');
      }
    }

    console.log('[Persistence] Initializing real-time users sync with Firestore...');
    const usersRef = collection(db, 'users');
    const usersQuery = syncOwnerId ? query(usersRef, where('ownerId', '==', syncOwnerId)) : query(usersRef);

    const unsubscribeSnapshot = onSnapshot(usersQuery, (snap) => {
      console.log(`[Persistence] Received users snapshot: ${snap.size} documents from Firebase console`);
      
      const cloudUsersList = snap.docs.map(docSnap => mapFirestoreUser(docSnap.data(), docSnap.id));
      
      setRegisteredUsers(cloudUsersList);
      dispatch({ type: 'SET_REGISTERED_USERS', payload: cloudUsersList });
      
      safeLocalStorageSet('OPay_Registered_Users_v4', JSON.stringify(cloudUsersList));
      
      // Pass replaceAll=true to purge any local cached accounts in IndexedDB that do not exist on Firebase console
      saveCachedUsersBatch(cloudUsersList, true).catch(err => console.error('[Persistence] IndexedDB user cache failed:', err));
      
      setIsUsersLoaded(true);
    }, (err) => {
      const errStr = err?.message || String(err);
      if (errStr.includes("Quota limit exceeded") || errStr.includes("quota") || errStr.includes("unavailable") || errStr.includes("offline")) {
        console.warn('[Persistence] Users sync halted / offline mode:', errStr);
      } else {
        console.error('[Persistence] Users sync failed:', err);
      }
      
      const saved = localStorage.getItem('OPay_Registered_Users_v4');
      if (saved) {
        try {
          const list = JSON.parse(saved);
          setRegisteredUsers(list);
          dispatch({ type: 'SET_REGISTERED_USERS', payload: list });
        } catch (e) {
          console.error('[Persistence] Failed to load from local storage fallback');
        }
      }
      setIsUsersLoaded(true);
    });

    return () => {
      unsubscribeSnapshot();
    };
  }, [setRegisteredUsers, setIsUsersLoaded, dispatch, syncOwnerId]);
};
