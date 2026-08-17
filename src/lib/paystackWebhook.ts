import crypto from "crypto";
import { doc, setDoc } from "firebase/firestore";

interface PaystackWebhookPayload {
  event: string;
  data: {
    reference: string;
    amount: number; // in kobo
    status: string;
    customer: {
      email: string;
    };
    metadata?: {
      ownerId?: string;
      userId?: string;
      managerPhone?: string;
      managerName?: string;
      businessName?: string;
      plan?: string;
      mode?: string;
      cycle?: string;
      amount?: number;
      paystackMode?: string;
    };
  };
}

/**
 * Validates the Paystack webhook cryptographic signature and processes a successful charge event.
 * Reconciles the subscription status and payments collection in Firestore.
 */
export async function processPaystackWebhook(
  payload: any,
  rawBody: string,
  signature: string,
  paystackSecret: string,
  db: any
): Promise<{ status: number; message: string }> {
  // 1. Cryptographic Signature Verification
  const computedHash = crypto
    .createHmac("sha512", paystackSecret)
    .update(rawBody)
    .digest("hex");

  if (computedHash !== signature) {
    console.error("[PAYSTACK WEBHOOK ERROR] Cryptographic signature verification failed.");
    return { status: 401, message: "Unauthorized: Signature verification failed" };
  }

  const typedPayload = payload as PaystackWebhookPayload;

  // 2. Filter event type (only process charge.success for subscription verification)
  if (typedPayload.event !== "charge.success") {
    console.log(`[PAYSTACK WEBHOOK INFO] Event ignored: ${typedPayload.event}`);
    return { status: 200, message: `Event ${typedPayload.event} received and ignored` };
  }

  const { data } = typedPayload;
  if (!data || data.status !== "success") {
    console.warn(`[PAYSTACK WEBHOOK WARN] Charge success event received but data status is not success: ${data?.status}`);
    return { status: 400, message: "Transaction status is not successful" };
  }

  // 3. Extract metadata
  const reference = data.reference;
  const amountNaira = Math.round(data.amount / 100);
  const metadata = data.metadata || {};

  const ownerId = metadata.ownerId;
  if (!ownerId) {
    console.error("[PAYSTACK WEBHOOK ERROR] Missing ownerId inside metadata payload:", JSON.stringify(metadata));
    return { status: 400, message: "Missing ownerId in metadata" };
  }

  const plan = metadata.plan || "Professional";
  const mode = metadata.mode || "Postracker";
  const cycle = metadata.cycle || "Monthly";
  const paystackMode = metadata.paystackMode || "one-time";

  const userId = metadata.userId || ownerId;
  const managerPhone = metadata.managerPhone || "N/A";
  const managerName = metadata.managerName || "Valued Partner";
  const businessName = metadata.businessName || "OPay Merchant";

  // Calculate subscription date bounds
  let months = 1;
  if (cycle === "Bi-annual") {
    months = 6;
  } else if (cycle === "Annual") {
    months = 12;
  }

  const startDate = new Date();
  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + months);

  const payId = `pay_webhook_${Math.random().toString(36).substring(2, 11)}`;

  try {
    // Save to subscription_payments
    const newPayment = {
      id: payId,
      ownerId,
      userId,
      managerPhone,
      managerName,
      customerName: managerName,
      businessName,
      phoneNumber: managerPhone,
      plan,
      mode,
      cycle,
      amount: amountNaira,
      reference,
      paymentMethod: "Paystack",
      paymentType: paystackMode,
      receiptUrl: "",
      receiptFileName: "Paystack Secure Webhook Verification",
      receiptFileType: "online",
      status: "Approved",
      paymentDate: new Date().toISOString(),
      timestamp: new Date().toISOString(),
    };

    await setDoc(doc(db, "subscription_payments", payId), newPayment);

    // Save/Update to subscriptions
    await setDoc(
      doc(db, "subscriptions", ownerId),
      {
        ownerId,
        plan,
        status: "Active",
        serviceCategory: mode,
        billingCycle: cycle,
        subscriptionStartDate: startDate.toISOString(),
        subscriptionEndDate: endDate.toISOString(),
        lastPaymentReference: reference,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    console.log(`[PAYSTACK WEBHOOK SUCCESS] Handled reference ${reference} successfully for owner: ${ownerId}`);
    return { status: 200, message: "Webhook processed and subscription updated" };
  } catch (dbErr: any) {
    console.error("[PAYSTACK WEBHOOK DB ERROR] Error updating subscription documents:", dbErr);
    return { status: 500, message: `Database update failed: ${dbErr.message}` };
  }
}
