import { db } from './firebase';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';

export async function resetAllData() {
  const collectionsToDelete = [
    'subscriptions',
    'transactions',
    'employees',
    'customers',
    'notifications',
    'sessions',
    'profiles',
    'referrals',
    'config'
  ];

  for (const colName of collectionsToDelete) {
    const colRef = collection(db, colName);
    const snapshot = await getDocs(colRef);
    const batch = writeBatch(db);
    snapshot.docs.forEach((document) => {
      batch.delete(document.ref);
    });
    await batch.commit();
    console.log(`Deleted collection: ${colName}`);
  }
}
