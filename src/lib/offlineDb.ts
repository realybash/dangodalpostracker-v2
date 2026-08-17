import { openDB } from 'idb';
import { isPhoneMatch, matchUserInList } from '../utils';

const DB_NAME = 'POSTrackOfflineDB';
const DB_VERSION = 6; // Incremented for new stores (expenses, terminals, pending deletions)

export const hashPin = async (pin: string) => {
  console.log(`[OFFLINE AUTH TRACE] [SHA-256] Hashing PIN. Input value length: ${pin.length}`);
  const msgUint8 = new TextEncoder().encode(pin);
  console.log('[OFFLINE AUTH TRACE] [SHA-256] TextEncoder Uint8Array output:', Array.from(msgUint8));
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashed = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  console.log(`[OFFLINE AUTH TRACE] [SHA-256] PIN hashing complete. Input: "${pin}" -> Hashed Hex Result: "${hashed}"`);
  return hashed;
};

export const initDB = async () => {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      console.log(`[DB] Upgrading from ${oldVersion} to ${DB_VERSION}`);
      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains('pendingTransactions')) {
          db.createObjectStore('pendingTransactions', { keyPath: 'id' });
        }
      }
      if (oldVersion < 4) {
        // Recreate users store with 'id' keyPath
        if (db.objectStoreNames.contains('users')) {
          db.deleteObjectStore('users');
        }
        db.createObjectStore('users', { keyPath: 'id' });
        
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('transactions')) {
          db.createObjectStore('transactions', { keyPath: 'id' });
        }
      }
      if (oldVersion < 5) {
        if (!db.objectStoreNames.contains('expenses')) {
          db.createObjectStore('expenses', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('pos_terminals')) {
          db.createObjectStore('pos_terminals', { keyPath: 'id' });
        }
      }
      if (oldVersion < 6) {
        if (!db.objectStoreNames.contains('pendingExpenses')) {
          db.createObjectStore('pendingExpenses', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('pendingPosTerminals')) {
          db.createObjectStore('pendingPosTerminals', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('pendingDeletions')) {
          db.createObjectStore('pendingDeletions', { keyPath: 'id' });
        }
      }
    },
  });
};

export const savePendingTransaction = async (tx: any) => {
  console.log(`[TRANSACTION SYNC TRACE] [IndexedDB] Attempting to write pending transaction to local IndexedDB "pendingTransactions" store. ID: "${tx.id}", Amount: $${tx.amount || tx.total || 0}, Status: "${tx.status || 'pending'}", Timestamp: "${tx.date || tx.createdAt || new Date().toISOString()}"`);
  const db = await initDB();
  await db.put('pendingTransactions', tx);
  console.log(`[TRANSACTION SYNC TRACE] [IndexedDB] [SUCCESS] Pending transaction successfully stored in local IndexedDB. ID: "${tx.id}"`);
};

export const getPendingTransactions = async () => {
  const db = await initDB();
  return await db.getAll('pendingTransactions');
};

export const deletePendingTransaction = async (id: string) => {
  console.log(`[TRANSACTION SYNC TRACE] [IndexedDB] Attempting to remove pending transaction from local IndexedDB "pendingTransactions" store. ID: "${id}"`);
  const db = await initDB();
  await db.delete('pendingTransactions', id);
  console.log(`[TRANSACTION SYNC TRACE] [IndexedDB] [SUCCESS] Pending transaction successfully removed from local IndexedDB. ID: "${id}"`);
};

// Pending Expenses operations
export const savePendingExpense = async (expense: any) => {
  const db = await initDB();
  await db.put('pendingExpenses', expense);
};

export const getPendingExpenses = async () => {
  const db = await initDB();
  return await db.getAll('pendingExpenses');
};

export const deletePendingExpense = async (id: string) => {
  const db = await initDB();
  await db.delete('pendingExpenses', id);
};

// Pending POS Terminals operations
export const savePendingPosTerminal = async (terminal: any) => {
  const db = await initDB();
  await db.put('pendingPosTerminals', terminal);
};

export const getPendingPosTerminals = async () => {
  const db = await initDB();
  return await db.getAll('pendingPosTerminals');
};

export const deletePendingPosTerminal = async (id: string) => {
  const db = await initDB();
  await db.delete('pendingPosTerminals', id);
};

// Pending Deletions operations
export interface PendingDeletion {
  id: string; // collection_docId (e.g. "transactions_tx_123")
  collection: 'transactions' | 'expenses' | 'pos_terminals';
  docId: string;
}

export const savePendingDeletion = async (deletion: PendingDeletion) => {
  console.log(`[TRANSACTION SYNC TRACE] [IndexedDB] Attempting to write pending deletion to local IndexedDB "pendingDeletions" store. ID: "${deletion.id}", Target Collection: "${deletion.collection}", DocId: "${deletion.docId}"`);
  const db = await initDB();
  await db.put('pendingDeletions', deletion);
  console.log(`[TRANSACTION SYNC TRACE] [IndexedDB] [SUCCESS] Pending deletion successfully stored in local IndexedDB. ID: "${deletion.id}"`);
};

export const getPendingDeletions = async () => {
  const db = await initDB();
  return await db.getAll('pendingDeletions');
};

export const deletePendingDeletion = async (id: string) => {
  console.log(`[TRANSACTION SYNC TRACE] [IndexedDB] Attempting to remove pending deletion from local IndexedDB "pendingDeletions" store. ID: "${id}"`);
  const db = await initDB();
  await db.delete('pendingDeletions', id);
  console.log(`[TRANSACTION SYNC TRACE] [IndexedDB] [SUCCESS] Pending deletion successfully removed from local IndexedDB. ID: "${id}"`);
};

export const saveCachedUser = async (user: any) => {
  try {
    const db = await initDB();
    const id = user.id || user.uid;
    if (!id) {
      console.warn('[OFFLINE AUTH TRACE] [IndexedDB users] saveCachedUser aborted: no user id/uid provided.');
      return;
    }
    console.log(`[OFFLINE AUTH TRACE] [IndexedDB users] Accessing "users" store to SAVE/UPDATE user: "${user.name || id}" (ID: ${id})`);

    const existing = await db.get('users', id);
    let hashedPin = '';
    
    // If a 4-digit raw pin is supplied, hash it. If it's already hashed, use it. Otherwise, fallback to existing.
    if (user.pin) {
      if (user.pin.length === 4 && /^\d+$/.test(user.pin)) {
        hashedPin = await hashPin(user.pin);
        console.log(`[OFFLINE AUTH TRACE] [IndexedDB users] saveCachedUser: hashing raw pin for user ${user.name || id} to ${hashedPin}`);
      } else {
        hashedPin = user.pin; // It is already a hashed pin
        console.log(`[OFFLINE AUTH TRACE] [IndexedDB users] saveCachedUser: preserving already-hashed pin for user ${user.name || id}: ${hashedPin}`);
      }
    } else if (existing && existing.pin) {
      hashedPin = existing.pin;
      console.log(`[OFFLINE AUTH TRACE] [IndexedDB users] saveCachedUser: fallback to existing pin for user ${user.name || id}: ${hashedPin}`);
    } else {
      console.log(`[OFFLINE AUTH TRACE] [IndexedDB users] saveCachedUser: NO PIN FOUND or cached for user ${user.name || id}`);
    }

    await db.put('users', { ...user, id, pin: hashedPin });
    console.log('[OFFLINE AUTH TRACE] [IndexedDB users] "users" store updated successfully for ID:', id);
  } catch (err) {
    console.error('[OFFLINE AUTH TRACE] [IndexedDB users] Failed to cache user in "users" store:', err);
    throw err;
  }
};

export const saveCachedUsersBatch = async (users: any[], replaceAll = false) => {
  try {
    const db = await initDB();
    console.log(`[OFFLINE AUTH TRACE] [IndexedDB users] Accessing "users" store for BATCH update of ${users.length} users (replaceAll: ${replaceAll}).`);
    const tx = db.transaction('users', 'readwrite');
    const existingUsers = await tx.store.getAll();
    const existingUserMap = new Map(existingUsers.map(u => [u.id, u]));

    console.log(`[OFFLINE AUTH TRACE] [IndexedDB users] Current count in "users" store before batch update: ${existingUsers.length}`);

    const incomingIds = new Set(users.map(u => u.id || u.uid).filter(Boolean));

    if (replaceAll) {
      for (const existingUser of existingUsers) {
        if (existingUser.id && !incomingIds.has(existingUser.id)) {
          console.log(`[OFFLINE AUTH TRACE] [IndexedDB users] Purging account not on Firebase: ${existingUser.name || existingUser.id}`);
          await tx.store.delete(existingUser.id);
        }
      }
    }

    for (const user of users) {
      const id = user.id || user.uid;
      if (!id) continue;
      
      const existing = existingUserMap.get(id);
      let hashedPin = '';
      
      // If a 4-digit raw pin is supplied, hash it. If it's already hashed, use it. Otherwise, fallback to existing.
      if (user.pin) {
        if (user.pin.length === 4 && /^\d+$/.test(user.pin)) {
          hashedPin = await hashPin(user.pin);
          console.log(`[OFFLINE AUTH TRACE] [IndexedDB users] Batch user ${user.name || id}: hashing raw 4-digit pin to ${hashedPin}`);
        } else {
          hashedPin = user.pin; // It is already a hashed pin
          console.log(`[OFFLINE AUTH TRACE] [IndexedDB users] Batch user ${user.name || id}: keeping already-hashed pin ${hashedPin}`);
        }
      } else if (existing && existing.pin) {
        hashedPin = existing.pin;
        console.log(`[OFFLINE AUTH TRACE] [IndexedDB users] Batch user ${user.name || id}: fallback to existing pin ${hashedPin}`);
      } else {
        console.log(`[OFFLINE AUTH TRACE] [IndexedDB users] Batch user ${user.name || id}: NO PIN FOUND or cached (empty pin).`);
      }
      
      await tx.store.put({ ...user, id, pin: hashedPin });
    }
    await tx.done;
    console.log(`[OFFLINE AUTH TRACE] [IndexedDB users] Batch update of "users" store completed successfully. Cached ${users.length} users.`);
  } catch (err) {
    console.error('[OFFLINE AUTH TRACE] [IndexedDB users] Failed to cache users batch in "users" store:', err);
    throw err;
  }
};

export const getAllCachedUsers = async () => {
  try {
    const db = await initDB();
    console.log('[OFFLINE AUTH TRACE] [IndexedDB users] Accessing "users" store to RETRIEVE ALL cached users.');
    const users = await db.getAll('users');
    console.log(`[OFFLINE AUTH TRACE] [IndexedDB users] Retrieved ${users.length} cached users:`, users.map(u => ({ id: u.id, name: u.name, role: u.role, hasPin: !!u.pin, pinLength: u.pin ? u.pin.length : 0 })));
    return users;
  } catch (err) {
    console.error('[OFFLINE AUTH TRACE] [IndexedDB users] Failed to get all cached users from "users" store:', err);
    return [];
  }
};

export const getCachedUser = async (id: string) => {
  console.log(`[OFFLINE AUTH TRACE] [IndexedDB users] Accessing "users" store to GET cached user by ID: ${id}`);
  const db = await initDB();
  const user = await db.get('users', id);
  if (user) {
    console.log(`[OFFLINE AUTH TRACE] [IndexedDB users] Found cached user for ID: ${id} (Name: ${user.name || 'unknown'}, Role: ${user.role})`);
  } else {
    console.log(`[OFFLINE AUTH TRACE] [IndexedDB users] No cached user found for ID: ${id}`);
  }
  return user;
};

export const deleteCachedUser = async (id: string) => {
  console.log(`[OFFLINE AUTH TRACE] [IndexedDB users] Accessing "users" store to DELETE cached user by ID: ${id}`);
  const db = await initDB();
  await db.delete('users', id);
  console.log(`[OFFLINE AUTH TRACE] [IndexedDB users] Deleted cached user by ID: ${id} from "users" store`);
};

export const saveCachedSettings = async (settings: any) => {
  const db = await initDB();
  await db.put('settings', settings);
};

export const getCachedSettings = async (id: string) => {
  const db = await initDB();
  return await db.get('settings', id);
};

export const saveCachedTransactions = async (txs: any[]) => {
  const db = await initDB();
  const tx = db.transaction('transactions', 'readwrite');
  await Promise.all(txs.map(t => tx.store.put(t)));
  await tx.done;
};

export const getCachedTransactions = async () => {
  const db = await initDB();
  return await db.getAll('transactions');
};

export const saveCachedExpenses = async (expenses: any[]) => {
  const db = await initDB();
  const tx = db.transaction('expenses', 'readwrite');
  await tx.store.clear();
  await Promise.all(expenses.map(e => tx.store.put(e)));
  await tx.done;
};

export const getCachedExpenses = async () => {
  const db = await initDB();
  return await db.getAll('expenses');
};

export const saveCachedPosTerminals = async (terminals: any[]) => {
  const db = await initDB();
  const tx = db.transaction('pos_terminals', 'readwrite');
  await tx.store.clear();
  await Promise.all(terminals.map(t => tx.store.put(t)));
  await tx.done;
};

export const deleteCachedPosTerminal = async (id: string) => {
  const db = await initDB();
  await db.delete('pos_terminals', id);
};

export const getCachedPosTerminals = async () => {
  const db = await initDB();
  return await db.getAll('pos_terminals');
};

export const verifyOfflineUserCredentials = async (
  inputRaw: string,
  pin: string,
  role: 'Employee' | 'Manager'
): Promise<any | null> => {
  console.log(`[OFFLINE AUTH TRACE] [verifyOfflineUserCredentials] Starting verification flow. Input Identifier: "${inputRaw}", Expected Role: "${role}"`);
  
  // 1. IndexedDB user store retrieval
  console.log('[OFFLINE AUTH TRACE] [verifyOfflineUserCredentials] Accessing IndexedDB to retrieve users from "users" store...');
  const users = await getAllCachedUsers();
  console.log(`[OFFLINE AUTH TRACE] [verifyOfflineUserCredentials] Successfully retrieved ${users.length} cached users from IndexedDB "users" store.`);
  
  // 2. PIN hash computation
  const enteredPinHash = await hashPin(pin);
  console.log(`[OFFLINE AUTH TRACE] [verifyOfflineUserCredentials] Entered raw PIN hashed successfully. Hash result: "${enteredPinHash}"`);

  const inputClean = inputRaw.toLowerCase().trim();

  // First, check if ANY account matches the identifier and PIN regardless of role
  for (const u of users) {
    const dbName = (u.name || u.fullName || '').toLowerCase();
    const phoneMatch = isPhoneMatch(inputRaw, u.phone || u.phoneNumber || '');
    const nameMatch = matchUserInList([u], inputRaw) !== undefined || dbName.includes(inputClean) || inputClean.includes(dbName);
    const pinMatch = u.pin === enteredPinHash;

    if ((phoneMatch || nameMatch) && pinMatch) {
      const uRole = (u.role || '').toLowerCase();
      const isManager = uRole === 'manager';

      if (role === 'Employee' && isManager) {
        console.warn(`[OFFLINE AUTH TRACE] [FAIL] Account "${u.name}" is a Manager attempting login via Cashier tab.`);
        return { user: null, error: 'This account is registered as a Manager account. Please switch to the Manager Portal tab to log in.' };
      }
      if (role === 'Manager' && !isManager) {
        console.warn(`[OFFLINE AUTH TRACE] [FAIL] Account "${u.name}" is a Cashier attempting login via Manager tab.`);
        return { user: null, error: 'This account is registered as a Cashier account. Please switch to the Cashier / Staff tab to log in.' };
      }
      console.log(`[OFFLINE AUTH TRACE] [verifyOfflineUserCredentials] SUCCESS MATCH! Authenticated user profile: "${u.name}" (ID: ${u.id}, Role: ${u.role})`);
      return { user: u };
    }
  }

  // Also check if any account matches identifier but not PIN, or role mismatch
  const matchedByIdentifierOnly = users.find(u => {
    const dbName = (u.name || u.fullName || '').toLowerCase();
    const phoneMatch = isPhoneMatch(inputRaw, u.phone || u.phoneNumber || '');
    const nameMatch = matchUserInList([u], inputRaw) !== undefined || dbName.includes(inputClean) || inputClean.includes(dbName);
    return phoneMatch || nameMatch;
  });

  if (matchedByIdentifierOnly) {
    const uRole = (matchedByIdentifierOnly.role || '').toLowerCase();
    const isManager = uRole === 'manager';
    if (role === 'Employee' && isManager) {
      return { user: null, error: 'This account is registered as a Manager account. Please switch to the Manager Portal tab to log in.' };
    }
    if (role === 'Manager' && !isManager) {
      return { user: null, error: 'This account is registered as a Cashier account. Please switch to the Cashier / Staff tab to log in.' };
    }
  }

  console.warn(`[OFFLINE AUTH TRACE] [verifyOfflineUserCredentials] [FAIL] Offline credentials verification failed.`);
  return { user: null };
};
