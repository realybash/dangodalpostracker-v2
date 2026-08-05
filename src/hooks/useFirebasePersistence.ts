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
        setRegisteredUsers(list);
        dispatch({ type: 'SET_REGISTERED_USERS', payload: list });
        setIsUsersLoaded(true); // Allow login immediately if we have cached users
      } catch (e) {
        console.error('[Persistence] Failed to load from local storage');
      }
    }

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        console.log('[Persistence] User not authenticated yet, waiting...');
        return;
      }
      
      console.log('[Persistence] Initializing real-time users sync for UID:', user.uid);
      
      const usersRef = collection(db, 'users');
      
      // We filter by ownerId to enforce tenant isolation.
      // If syncOwnerId is not available, we might still want to fetch users related to auth.currentUser.uid.
      const queryOwnerId = syncOwnerId || user.uid;
      const usersQuery = query(usersRef, where('ownerId', '==', queryOwnerId));
      
      const unsubscribeSnapshot = onSnapshot(usersQuery, (snap) => {
        console.log(`[Persistence] Received users snapshot: ${snap.size} documents`);
        
        const cloudUsersList = snap.docs.map(docSnap => mapFirestoreUser(docSnap.data(), docSnap.id));
        
        setRegisteredUsers(cloudUsersList);
        dispatch({ type: 'SET_REGISTERED_USERS', payload: cloudUsersList });
        
        safeLocalStorageSet('OPay_Registered_Users_v4', JSON.stringify(cloudUsersList));
        
        // Also cache in IndexedDB for robust offline login
        saveCachedUsersBatch(cloudUsersList).catch(err => console.error('[Persistence] IndexedDB user cache failed:', err));
        
        setIsUsersLoaded(true);
      }, (err) => {
        console.error('[Persistence] Users sync failed:', err);
        
        // If quota reached, don't throw, just use cached data
        if (err.message && err.message.includes("Quota limit exceeded")) {
          console.warn('[Persistence] Users sync halted: Quota exceeded.');
        } else {
          console.warn('[Persistence] Users sync warning:', err);
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
    });

    return () => {
      unsubscribeAuth();
    };
  }, [setRegisteredUsers, setIsUsersLoaded, dispatch, syncOwnerId]);
};
