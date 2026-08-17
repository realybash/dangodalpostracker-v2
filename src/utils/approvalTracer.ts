import { collection, addDoc, serverTimestamp, Firestore } from 'firebase/firestore';

export const logApprovalLifecycle = async (
  db: Firestore,
  txId: string,
  action: string,
  data: any
) => {
  try {
    await addDoc(collection(db, 'approval_logs'), {
      transactionId: txId,
      action,
      data,
      timestamp: serverTimestamp(),
    });
    console.log(`[APPROVAL TRACE] ${action} for ${txId}`);
  } catch (e) {
    console.error('[APPROVAL TRACE ERROR]', e);
  }
};
