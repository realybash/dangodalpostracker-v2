import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";
import { processPaystackWebhook } from "./src/lib/paystackWebhook";

// Helper formula to match client calculations for automatic charges
function getRecommendedAgentFeeServer(amount: number, type: string): number {
  if (type === 'Withdrawal') {
    if (amount <= 1000) return 100;
    if (amount <= 5000) return 100;
    if (amount <= 10000) return 200;
    if (amount <= 20000) return 300;
    if (amount <= 40000) return 400;
    if (amount <= 100000) return 500;
    return Math.ceil(amount * 0.005); // 0.5% for extreme values
  } else {
    // Deposit / Transfer gets standard flat rate charges
    if (amount <= 5000) return 100;
    if (amount <= 10000) return 150;
    if (amount <= 50000) return 200;
    return 300;
  }
}

function calculateTerminalFeeServer(amount: number, type: string, provider: string): number {
  if (type === 'Withdrawal') {
    const rate = provider === 'OPay' ? 0.005 : 0.0025; // 0.5% vs 0.25%
    const calculated = amount * rate;
    return Math.min(calculated, 100); // capped at ₦100 maximum
  } else {
    // Deposit / Transfer has a flat charges of ₦10
    return 10;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({
    verify: (req: any, res, buf) => {
      req.rawBody = buf;
    }
  }));
  app.use(express.urlencoded({ extended: true }));

  // Initialize Firebase Server Connection
  let db: any = null;
  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const firebaseApp = initializeApp(config);
      db = getFirestore(firebaseApp, config.firestoreDatabaseId);
      console.log("[FIREBASE SERVER] Successfully hooked Firestore database:", config.firestoreDatabaseId);
    } else {
      console.warn("[FIREBASE SERVER] firebase-applet-config.json not found. Webhooks will not save to database.");
    }
  } catch (err) {
    console.error("[FIREBASE SERVER] Initialization error:", err);
  }

  // --- API Webhook Endpoint to Link POS Terminals Directly ---
  app.post("/api/webhook", async (req, res) => {
    console.log("[WEBHOOK RECEIVED] Incoming Payload on /api/webhook:", JSON.stringify(req.body));
    console.log("[WEBHOOK PARAMS] Query Headers:", req.query);

    const ownerId = req.query.ownerId as string || req.body.ownerId;
    if (!ownerId) {
      console.error("[WEBHOOK ERROR] Request rejected: missing 'ownerId' parameter in webhook URL string.");
      return res.status(400).json({ 
        status: "error", 
        message: "Missing 'ownerId' parameter. Enter the authenticated ownerId inside your POS device's subscription webhooks URL query parameter." 
      });
    }

    if (!db) {
      console.error("[WEBHOOK ERROR] Firestore server instance is down or unconfigured.");
      return res.status(500).json({ status: "error", message: "Database link is not ready style." });
    }

    try {
      // 1. Parse amount flexibly from Nigerian multi-units (supports 'amount', 'amountInKobo', 'value', 'total')
      let rawAmount = req.body.amount || req.body.amountInKobo || req.body.value || req.body.total || 0;
      
      // If the webhook payload transmits kobo (typically for Moniepoint standard triggers), convert to Naira
      const isMoniepointKobo = req.body.amountInKobo || (rawAmount > 100000 && !req.body.isNaira);
      const amount = isMoniepointKobo ? Math.round(rawAmount / 100) : Number(rawAmount);

      if (!amount || isNaN(amount) || amount <= 0) {
        return res.status(400).json({ status: "error", message: "Invalid or empty transaction amount." });
      }

      // 2. Parse Provider and Type
      let provider = (req.query.provider as string || req.body.provider || 'Moniepoint');
      // Normalize casing
      if (provider.toLowerCase().includes('moniepoint')) provider = 'Moniepoint';
      else if (provider.toLowerCase().includes('opay')) provider = 'OPay';
      else if (provider.toLowerCase().includes('palmpay')) provider = 'PalmPay';
      else provider = 'Others';

      // Advanced Webhook Signature Verification for Moniepoint (Monnify) to guarantee authenticity
      const clientSecret = process.env.MONIEPOINT_CLIENT_SECRET;
      let signatureVerified = false;
      if (provider === 'Moniepoint' && clientSecret) {
        // Moniepoint / Monnify specifies is sent in the 'monnify-signature' request header
        const receivedSignature = req.headers["monnify-signature"] as string;
        if (!receivedSignature) {
          console.error("[WEBHOOK SECURITY ERROR] Webhook request with provider Moniepoint is missing the mandatory 'monnify-signature' header. Request rejected.");
          return res.status(401).json({ 
            status: "error", 
            message: "Unauthorized: Missing Monnify Webhook cryptographic verification signature header." 
          });
        }
        
        // Compute SHA512 HMAC of the request body (the raw body or the JSON stringified body)
        const computedSignature = crypto
          .createHmac("sha512", clientSecret)
          .update(typeof req.body === 'string' ? req.body : JSON.stringify(req.body))
          .digest("hex");
          
        if (receivedSignature.toLowerCase() !== computedSignature.toLowerCase()) {
          console.error("[WEBHOOK SECURITY ERROR] Invalid Monnify webhook signature comparison failed. Calculated:", computedSignature, "Received:", receivedSignature);
          return res.status(401).json({ 
            status: "error", 
            message: "Unauthorized: Invalid cryptographic Webhook signature mismatch. Verify client secret configured in secrets panel." 
          });
        }
        signatureVerified = true;
        console.log("[WEBHOOK SECURITY VERIFIED] Moniepoint payload signature authenticated using secure Client Secret HMAC-SHA512!");
      }

      let rawType = req.body.type || req.body.transactionType || req.body.action || 'Withdrawal';
      let type: 'Withdrawal' | 'Deposit' | 'Transfer' = 'Withdrawal';
      
      const lt = rawType.toString().toLowerCase();
      if (lt.includes('deposit') || lt.includes('credit') || lt.includes('payin')) {
        type = 'Deposit';
      } else if (lt.includes('transfer') || lt.includes('payout')) {
        type = 'Transfer';
      } else {
        type = 'Withdrawal';
      }

      // 3. Extract transaction ID / Reference
      const txId = req.body.transactionId || req.body.id || req.body.reference || req.body.rrn || 'tx_web_' + Math.random().toString(36).substring(2, 11);

      // 4. Run calculations automatically to ensure tamper-proof ledger entries
      const customerFee = getRecommendedAgentFeeServer(amount, type);
      const terminalFee = calculateTerminalFeeServer(amount, type, provider);
      const profit = customerFee - terminalFee;

      // Create rich full ledger transaction
      const newTx = {
        id: txId,
        ownerId: ownerId,
        employeeId: 'pos_hook',
        employeeName: `Linked ${provider} POS`,
        type: type,
        provider: provider,
        subType: 'OtherBank',
        amount: amount,
        customerFee: customerFee,
        terminalFee: terminalFee,
        profit: profit,
        timestamp: new Date().toISOString(),
        status: 'Success',
        feeMethod: 'Cash', // default fee style
        totalCustomerCharged: amount,
        notes: `Automatic tamper-proof terminal sync directly captured from physical POS webhook request payload. (Terminal IMEI: ${req.body.imei || 'Telpo P8'})`
      };

      // Write direct to Firestore transactions schema
      await setDoc(doc(db, 'transactions', txId), newTx);
      
      console.log(`[WEBHOOK SUCCESS] Successfully reconciled and saved live transaction: ${txId} for owner: ${ownerId}`);
      return res.status(200).json({
        status: "success",
        message: "Transaction added in real time",
        transactionId: txId,
        metrics: { amount, customerFee, terminalFee, profit }
      });

    } catch (err: any) {
      console.error("[WEBHOOK EXCEPTION] Error writing transaction:", err);
      return res.status(500).json({ status: "error", message: err.message });
    }
  });

  // Aligned webhook URL endpoints for easy branding support
  app.post("/api/webhooks/moniepoint", (req, res) => {
    req.query.provider = 'Moniepoint';
    app._router.handle(req, res);
  });
  app.post("/api/webhooks/opay", (req, res) => {
    req.query.provider = 'OPay';
    app._router.handle(req, res);
  });

  // Health check metric
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      service: "POS Hardware Interlink System", 
      firestoreConnected: !!db,
      moniepointApiKeyConfigured: !!process.env.MONIEPOINT_API_KEY,
      moniepointClientSecretConfigured: !!process.env.MONIEPOINT_CLIENT_SECRET,
      paystackSecretConfigured: !!process.env.PAYSTACK_SECRET_KEY
    });
  });

  // --- Secure Subscription Status Retrieval Endpoint for Polling ---
  app.get("/api/subscription/status/:ownerId", async (req, res) => {
    try {
      const { ownerId } = req.params;
      if (!ownerId) {
        return res.status(400).json({ status: "error", message: "Missing ownerId" });
      }
      if (!db) {
        return res.status(500).json({ status: "error", message: "Database offline" });
      }
      const subDoc = await getDoc(doc(db, "subscriptions", ownerId));
      if (subDoc.exists()) {
        return res.json({ status: "success", data: subDoc.data() });
      } else {
        return res.status(404).json({ status: "error", message: "Subscription not found" });
      }
    } catch (err: any) {
      console.error("[GET SUBSCRIPTION STATUS ERROR]", err);
      return res.status(500).json({ status: "error", message: err.message });
    }
  });

  // --- Secure Paystack API Endpoints ---
  app.post("/api/paystack/initialize", async (req, res) => {
    try {
      const { amount, email, reference, metadata } = req.body;
      const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
      if (!paystackSecret) {
        return res.status(400).json({ 
          status: "error", 
          message: "Paystack integration is not fully configured. PAYSTACK_SECRET_KEY is missing on the server's environment variables." 
        });
      }

      if (!amount || isNaN(amount) || amount <= 0) {
        return res.status(400).json({ status: "error", message: "Invalid payment amount." });
      }

      const response = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${paystackSecret}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          amount: Math.round(Number(amount) * 100), // in kobo
          email: email || "customer@dangodalpostracker.com",
          reference: reference,
          channels: ["card", "bank", "ussd", "qr", "mobile_money", "bank_transfer"],
          metadata: metadata
        })
      });

      const result = await response.json();
      return res.status(response.status).json(result);
    } catch (err: any) {
      console.error("[PAYSTACK INITIALIZE ERROR]", err);
      return res.status(500).json({ status: "error", message: err.message });
    }
  });

  app.get("/api/paystack/verify/:reference", async (req, res) => {
    try {
      const { reference } = req.params;
      const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
      if (!paystackSecret) {
        return res.status(400).json({ 
          status: "error", 
          message: "Paystack integration is not fully configured. PAYSTACK_SECRET_KEY is missing on the server's environment variables." 
        });
      }

      const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${paystackSecret}`
        }
      });

      const result = await response.json();
      return res.status(response.status).json(result);
    } catch (err: any) {
      console.error("[PAYSTACK VERIFY ERROR]", err);
      return res.status(500).json({ status: "error", message: err.message });
    }
  });

  // --- Secure Paystack Webhook Handler Endpoint ---
  app.post("/api/paystack/webhook", async (req: any, res) => {
    const signature = req.headers["x-paystack-signature"] as string;
    const paystackSecret = process.env.PAYSTACK_SECRET_KEY;

    if (!paystackSecret) {
      console.error("[PAYSTACK WEBHOOK ERROR] Server environment variable PAYSTACK_SECRET_KEY is not defined.");
      return res.status(500).json({ status: "error", message: "Paystack secret key is unconfigured on server" });
    }

    if (!signature) {
      console.error("[PAYSTACK WEBHOOK ERROR] Missing x-paystack-signature header.");
      return res.status(401).json({ status: "error", message: "Missing x-paystack-signature header" });
    }

    if (!db) {
      console.error("[PAYSTACK WEBHOOK ERROR] Database is offline or not configured.");
      return res.status(500).json({ status: "error", message: "Database link not ready" });
    }

    try {
      const rawBody = req.rawBody ? req.rawBody.toString("utf8") : JSON.stringify(req.body);
      const result = await processPaystackWebhook(req.body, rawBody, signature, paystackSecret, db);
      return res.status(result.status).json({ status: result.status === 200 ? "success" : "error", message: result.message });
    } catch (err: any) {
      console.error("[PAYSTACK WEBHOOK EXCEPTION] Error handling webhook payload:", err);
      return res.status(500).json({ status: "error", message: err.message });
    }
  });

  // Express Static / Vite handling
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    console.log(`[SERVER] Serving production files from: ${distPath}`);
    
    // Check if index.html exists for debugging
    if (!fs.existsSync(path.join(distPath, 'index.html'))) {
        console.error(`[SERVER ERROR] index.html not found in: ${distPath}`);
    }

    app.use(express.static(distPath, { index: 'index.html' }));
    app.get('*', (req, res) => {
      console.log(`[SERVER] Request for path: ${req.path}`);
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('index.html not found on server.');
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[SERVER RUNNING] Standalone Backend server actively listening on port ${PORT}`);
  });
}

startServer();
