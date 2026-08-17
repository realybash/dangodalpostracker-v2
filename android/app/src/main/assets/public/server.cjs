var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_crypto2 = __toESM(require("crypto"), 1);
var import_vite = require("vite");
var import_app = require("firebase/app");
var import_firestore2 = require("firebase/firestore");

// src/lib/paystackWebhook.ts
var import_crypto = __toESM(require("crypto"), 1);
var import_firestore = require("firebase/firestore");
async function processPaystackWebhook(payload, rawBody, signature, paystackSecret, db) {
  const computedHash = import_crypto.default.createHmac("sha512", paystackSecret).update(rawBody).digest("hex");
  if (computedHash !== signature) {
    console.error("[PAYSTACK WEBHOOK ERROR] Cryptographic signature verification failed.");
    return { status: 401, message: "Unauthorized: Signature verification failed" };
  }
  const typedPayload = payload;
  if (typedPayload.event !== "charge.success") {
    console.log(`[PAYSTACK WEBHOOK INFO] Event ignored: ${typedPayload.event}`);
    return { status: 200, message: `Event ${typedPayload.event} received and ignored` };
  }
  const { data } = typedPayload;
  if (!data || data.status !== "success") {
    console.warn(`[PAYSTACK WEBHOOK WARN] Charge success event received but data status is not success: ${data?.status}`);
    return { status: 400, message: "Transaction status is not successful" };
  }
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
  let months = 1;
  if (cycle === "Bi-annual") {
    months = 6;
  } else if (cycle === "Annual") {
    months = 12;
  }
  const startDate = /* @__PURE__ */ new Date();
  const endDate = /* @__PURE__ */ new Date();
  endDate.setMonth(endDate.getMonth() + months);
  const payId = `pay_webhook_${Math.random().toString(36).substring(2, 11)}`;
  try {
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
      paymentDate: (/* @__PURE__ */ new Date()).toISOString(),
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    await (0, import_firestore.setDoc)((0, import_firestore.doc)(db, "subscription_payments", payId), newPayment);
    await (0, import_firestore.setDoc)(
      (0, import_firestore.doc)(db, "subscriptions", ownerId),
      {
        ownerId,
        plan,
        status: "Active",
        serviceCategory: mode,
        billingCycle: cycle,
        subscriptionStartDate: startDate.toISOString(),
        subscriptionEndDate: endDate.toISOString(),
        lastPaymentReference: reference,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      },
      { merge: true }
    );
    console.log(`[PAYSTACK WEBHOOK SUCCESS] Handled reference ${reference} successfully for owner: ${ownerId}`);
    return { status: 200, message: "Webhook processed and subscription updated" };
  } catch (dbErr) {
    console.error("[PAYSTACK WEBHOOK DB ERROR] Error updating subscription documents:", dbErr);
    return { status: 500, message: `Database update failed: ${dbErr.message}` };
  }
}

// server.ts
function getRecommendedAgentFeeServer(amount, type) {
  if (type === "Withdrawal") {
    if (amount <= 1e3) return 100;
    if (amount <= 5e3) return 100;
    if (amount <= 1e4) return 200;
    if (amount <= 2e4) return 300;
    if (amount <= 4e4) return 400;
    if (amount <= 1e5) return 500;
    return Math.ceil(amount * 5e-3);
  } else {
    if (amount <= 5e3) return 100;
    if (amount <= 1e4) return 150;
    if (amount <= 5e4) return 200;
    return 300;
  }
}
function calculateTerminalFeeServer(amount, type, provider) {
  if (type === "Withdrawal") {
    const rate = provider === "OPay" ? 5e-3 : 25e-4;
    const calculated = amount * rate;
    return Math.min(calculated, 100);
  } else {
    return 10;
  }
}
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  app.use(import_express.default.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    }
  }));
  app.use(import_express.default.urlencoded({ extended: true }));
  let db = null;
  try {
    const configPath = import_path.default.join(process.cwd(), "firebase-applet-config.json");
    if (import_fs.default.existsSync(configPath)) {
      const config = JSON.parse(import_fs.default.readFileSync(configPath, "utf8"));
      const firebaseApp = (0, import_app.initializeApp)(config);
      db = (0, import_firestore2.getFirestore)(firebaseApp, config.firestoreDatabaseId);
      console.log("[FIREBASE SERVER] Successfully hooked Firestore database:", config.firestoreDatabaseId);
    } else {
      console.warn("[FIREBASE SERVER] firebase-applet-config.json not found. Webhooks will not save to database.");
    }
  } catch (err) {
    console.error("[FIREBASE SERVER] Initialization error:", err);
  }
  app.post("/api/webhook", async (req, res) => {
    console.log("[WEBHOOK RECEIVED] Incoming Payload on /api/webhook:", JSON.stringify(req.body));
    console.log("[WEBHOOK PARAMS] Query Headers:", req.query);
    const ownerId = req.query.ownerId || req.body.ownerId;
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
      let rawAmount = req.body.amount || req.body.amountInKobo || req.body.value || req.body.total || 0;
      const isMoniepointKobo = req.body.amountInKobo || rawAmount > 1e5 && !req.body.isNaira;
      const amount = isMoniepointKobo ? Math.round(rawAmount / 100) : Number(rawAmount);
      if (!amount || isNaN(amount) || amount <= 0) {
        return res.status(400).json({ status: "error", message: "Invalid or empty transaction amount." });
      }
      let provider = req.query.provider || req.body.provider || "Moniepoint";
      if (provider.toLowerCase().includes("moniepoint")) provider = "Moniepoint";
      else if (provider.toLowerCase().includes("opay")) provider = "OPay";
      else if (provider.toLowerCase().includes("palmpay")) provider = "PalmPay";
      else provider = "Others";
      const clientSecret = process.env.MONIEPOINT_CLIENT_SECRET;
      let signatureVerified = false;
      if (provider === "Moniepoint" && clientSecret) {
        const receivedSignature = req.headers["monnify-signature"];
        if (!receivedSignature) {
          console.error("[WEBHOOK SECURITY ERROR] Webhook request with provider Moniepoint is missing the mandatory 'monnify-signature' header. Request rejected.");
          return res.status(401).json({
            status: "error",
            message: "Unauthorized: Missing Monnify Webhook cryptographic verification signature header."
          });
        }
        const computedSignature = import_crypto2.default.createHmac("sha512", clientSecret).update(typeof req.body === "string" ? req.body : JSON.stringify(req.body)).digest("hex");
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
      let rawType = req.body.type || req.body.transactionType || req.body.action || "Withdrawal";
      let type = "Withdrawal";
      const lt = rawType.toString().toLowerCase();
      if (lt.includes("deposit") || lt.includes("credit") || lt.includes("payin")) {
        type = "Deposit";
      } else if (lt.includes("transfer") || lt.includes("payout")) {
        type = "Transfer";
      } else {
        type = "Withdrawal";
      }
      const txId = req.body.transactionId || req.body.id || req.body.reference || req.body.rrn || "tx_web_" + Math.random().toString(36).substring(2, 11);
      const customerFee = getRecommendedAgentFeeServer(amount, type);
      const terminalFee = calculateTerminalFeeServer(amount, type, provider);
      const profit = customerFee - terminalFee;
      const newTx = {
        id: txId,
        ownerId,
        employeeId: "pos_hook",
        employeeName: `Linked ${provider} POS`,
        type,
        provider,
        subType: "OtherBank",
        amount,
        customerFee,
        terminalFee,
        profit,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        status: "Success",
        feeMethod: "Cash",
        // default fee style
        totalCustomerCharged: amount,
        notes: `Automatic tamper-proof terminal sync directly captured from physical POS webhook request payload. (Terminal IMEI: ${req.body.imei || "Telpo P8"})`
      };
      await (0, import_firestore2.setDoc)((0, import_firestore2.doc)(db, "transactions", txId), newTx);
      console.log(`[WEBHOOK SUCCESS] Successfully reconciled and saved live transaction: ${txId} for owner: ${ownerId}`);
      return res.status(200).json({
        status: "success",
        message: "Transaction added in real time",
        transactionId: txId,
        metrics: { amount, customerFee, terminalFee, profit }
      });
    } catch (err) {
      console.error("[WEBHOOK EXCEPTION] Error writing transaction:", err);
      return res.status(500).json({ status: "error", message: err.message });
    }
  });
  app.post("/api/webhooks/moniepoint", (req, res) => {
    req.query.provider = "Moniepoint";
    app._router.handle(req, res);
  });
  app.post("/api/webhooks/opay", (req, res) => {
    req.query.provider = "OPay";
    app._router.handle(req, res);
  });
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
  app.get("/api/subscription/status/:ownerId", async (req, res) => {
    try {
      const { ownerId } = req.params;
      if (!ownerId) {
        return res.status(400).json({ status: "error", message: "Missing ownerId" });
      }
      if (!db) {
        return res.status(500).json({ status: "error", message: "Database offline" });
      }
      const subDoc = await (0, import_firestore2.getDoc)((0, import_firestore2.doc)(db, "subscriptions", ownerId));
      if (subDoc.exists()) {
        return res.json({ status: "success", data: subDoc.data() });
      } else {
        return res.status(404).json({ status: "error", message: "Subscription not found" });
      }
    } catch (err) {
      console.error("[GET SUBSCRIPTION STATUS ERROR]", err);
      return res.status(500).json({ status: "error", message: err.message });
    }
  });
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
          amount: Math.round(Number(amount) * 100),
          // in kobo
          email: email || "customer@dangodalpostracker.com",
          reference,
          channels: ["card", "bank", "ussd", "qr", "mobile_money", "bank_transfer"],
          metadata
        })
      });
      const result = await response.json();
      return res.status(response.status).json(result);
    } catch (err) {
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
    } catch (err) {
      console.error("[PAYSTACK VERIFY ERROR]", err);
      return res.status(500).json({ status: "error", message: err.message });
    }
  });
  app.post("/api/paystack/webhook", async (req, res) => {
    const signature = req.headers["x-paystack-signature"];
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
    } catch (err) {
      console.error("[PAYSTACK WEBHOOK EXCEPTION] Error handling webhook payload:", err);
      return res.status(500).json({ status: "error", message: err.message });
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.resolve(process.cwd(), "dist");
    console.log(`[SERVER] Serving production files from: ${distPath}`);
    if (!import_fs.default.existsSync(import_path.default.join(distPath, "index.html"))) {
      console.error(`[SERVER ERROR] index.html not found in: ${distPath}`);
    }
    app.use(import_express.default.static(distPath, { index: "index.html" }));
    app.get("*", (req, res) => {
      console.log(`[SERVER] Request for path: ${req.path}`);
      const indexPath = import_path.default.join(distPath, "index.html");
      if (import_fs.default.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send("index.html not found on server.");
      }
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[SERVER RUNNING] Standalone Backend server actively listening on port ${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
