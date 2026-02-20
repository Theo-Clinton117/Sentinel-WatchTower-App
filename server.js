import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import fetch from "node-fetch"; // npm install node-fetch
import bcrypt from "bcrypt";     // npm install bcrypt
import crypto from "crypto";

const app = express();
app.use(cors());
app.use(bodyParser.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));

// --------------------
// Supabase REST credentials
// --------------------
const SUPABASE_URL = "https://bjmliqvtjjntkgxpwwkp.supabase.co";
const SUPABASE_KEY = "YOUR_SUPABASE_ANON_KEY"; // replace with your anon/public key
const USERS_TABLE = "users";
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || "";
const PAYSTACK_PUBLIC_KEY = process.env.PAYSTACK_PUBLIC_KEY || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SUBSCRIPTIONS_TABLE = "subscriptions";

const PAYSTACK_PLAN_MATRIX = {
  individual: { label: "Individual", amount: 1000 },
  family: { label: "Family", amount: 3500 },
  organization: { label: "Organization", amount: 5000 }
};

// --------------------
// REGISTER
// --------------------
app.post("/register", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if(!name || !email || !password){
      return res.status(400).json({ error: "All fields are required" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Force new reviewer requests to 'user' until approved
    const finalRole = role === "reviewer" ? "user" : "user";

    const response = await fetch(`${SUPABASE_URL}/rest/v1/${USERS_TABLE}`, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation"
      },
      body: JSON.stringify({ name, email, password: hashedPassword, role: finalRole })
    });

    const data = await response.json();

    if(response.ok){
      res.status(201).json({ message: "Account created successfully" });
    } else {
      res.status(400).json({ error: data });
    }

  } catch(err){
    console.error(err);
    res.status(500).json({ error: "Server error during registration" });
  }
});

// --------------------
// LOGIN
// --------------------
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if(!email || !password){
      return res.status(400).json({ error: "Email and password required" });
    }

    // Fetch user by email
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/${USERS_TABLE}?email=eq.${encodeURIComponent(email)}`,
      {
        method: "GET",
        headers: {
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`,
        }
      }
    );

    const users = await response.json();

    if(!users.length) return res.status(400).json({ error: "User not found" });

    const user = users[0];

    // Compare password
    const match = await bcrypt.compare(password, user.password);
    if(!match) return res.status(400).json({ error: "Invalid password" });

    // Check role
    let message = "Login successful!";
    let role = user.role;

    // Pending reviewer
    if(role === "user" && user.requested_reviewer){ // optional: add requested_reviewer column
      message = "Your reviewer request is pending admin approval.";
    }

    res.json({ message, role });

  } catch(err){
    console.error(err);
    res.status(500).json({ error: "Server error during login" });
  }
});

// --------------------
// PAYSTACK: initialize transaction
// --------------------
app.post("/api/paystack/initialize", async (req, res) => {
  try {
    const { plan, email, name, phone, return_url } = req.body || {};
    if (!plan || !PAYSTACK_PLAN_MATRIX[plan]) {
      return res.status(400).json({ error: "Invalid plan." });
    }
    if (!email) {
      return res.status(400).json({ error: "Email is required." });
    }
    if (!PAYSTACK_SECRET_KEY) {
      return res.status(500).json({ error: "Paystack secret key not configured." });
    }

    const planInfo = PAYSTACK_PLAN_MATRIX[plan];
    const reference = `SW-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const payload = {
      email,
      amount: planInfo.amount * 100,
      currency: "NGN",
      reference,
      callback_url: return_url || undefined,
      metadata: {
        plan,
        plan_label: planInfo.label,
        customer_name: name || "",
        customer_phone: phone || ""
      }
    };

    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    const data = await response.json();

    if (!response.ok || !data?.status) {
      return res.status(400).json({ error: data?.message || "Paystack initialization failed." });
    }

    res.json({
      authorization_url: data.data?.authorization_url,
      access_code: data.data?.access_code,
      reference: data.data?.reference
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error during Paystack init." });
  }
});

// --------------------
// PAYSTACK: verify transaction
// --------------------
app.get("/api/paystack/verify/:reference", async (req, res) => {
  try {
    const reference = req.params.reference;
    if (!reference) return res.status(400).json({ error: "Missing reference." });
    if (!PAYSTACK_SECRET_KEY) {
      return res.status(500).json({ error: "Paystack secret key not configured." });
    }

    const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json"
      }
    });
    const data = await response.json();

    if (!response.ok || !data?.status) {
      return res.status(400).json({ error: data?.message || "Verification failed." });
    }

    const status = data?.data?.status;
    const amount = Number(data?.data?.amount || 0) / 100;
    const plan = data?.data?.metadata?.plan || null;

    res.json({
      status,
      amount,
      plan,
      message: data?.message || "Verification complete."
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error during verification." });
  }
});

// --------------------
// PAYSTACK: public config
// --------------------
app.get("/api/paystack/config", (req, res) => {
  if (!PAYSTACK_PUBLIC_KEY) {
    return res.status(404).json({ error: "Paystack public key not configured." });
  }
  res.json({ publicKey: PAYSTACK_PUBLIC_KEY });
});

// --------------------
// Subscriptions: record (Supabase)
// --------------------
app.post("/api/subscriptions/record", async (req, res) => {
  try {
    const { reference, status, plan, amount, user_id, user_email } = req.body || {};
    if (!reference || !status) {
      return res.status(400).json({ error: "Missing reference or status." });
    }
    if (!SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: "Supabase service role key not configured." });
    }

    const payload = {
      reference,
      status,
      plan: plan || null,
      amount: amount || null,
      user_id: user_id || null,
      user_email: user_email || null,
      updated_at: new Date().toISOString()
    };

    const response = await fetch(`${SUPABASE_URL}/rest/v1/${SUBSCRIPTIONS_TABLE}`, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return res.status(400).json({ error: data?.message || "Subscription write failed." });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Unable to record subscription." });
  }
});

// --------------------
// Subscriptions: get latest for user
// --------------------
app.get("/api/subscriptions/user/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    if (!userId) return res.status(400).json({ error: "Missing user id." });
    if (!SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: "Supabase service role key not configured." });
    }

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/${SUBSCRIPTIONS_TABLE}?user_id=eq.${userId}&order=updated_at.desc&limit=1`,
      {
        method: "GET",
        headers: {
          "apikey": SUPABASE_SERVICE_ROLE_KEY,
          "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    if (!response.ok) {
      const data = await response.json().catch(() => ([]));
      return res.status(400).json({ error: data?.message || "Subscription lookup failed." });
    }

    const rows = await response.json();
    const latest = Array.isArray(rows) ? rows[0] : null;
    if (!latest) return res.json({ plan: null });
    res.json({
      plan: latest.plan,
      status: latest.status,
      amount: latest.amount,
      reference: latest.reference
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Unable to fetch subscription." });
  }
});

// --------------------
// Organization leads (placeholder)
// --------------------
app.post("/api/org-leads", async (req, res) => {
  try {
    const { organization, size, name, role, email, phone, export_needs, use_case } = req.body || {};
    if (!organization || !name || !email) {
      return res.status(400).json({ error: "Organization, name, and email are required." });
    }
    console.log("Org lead received:", {
      organization,
      size,
      name,
      role,
      email,
      phone,
      export_needs,
      use_case
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Unable to capture lead." });
  }
});

// --------------------
// PAYSTACK: webhook (placeholder)
// --------------------
app.post("/api/paystack/webhook", (req, res) => {
  try {
    const signature = req.headers["x-paystack-signature"];
    const rawBody = req.rawBody || Buffer.from("");
    const hash = crypto
      .createHmac("sha512", PAYSTACK_SECRET_KEY)
      .update(rawBody)
      .digest("hex");

    if (signature !== hash) {
      return res.status(401).json({ error: "Invalid signature." });
    }

    const event = req.body;
    console.log("Paystack webhook received:", event?.event);
    return res.json({ received: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Webhook handling failed." });
  }
});

// --------------------
// Start backend server
// --------------------
const PORT = 3000;
app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
