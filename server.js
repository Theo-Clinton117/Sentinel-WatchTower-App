import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import fetch from "node-fetch"; // npm install node-fetch
import bcrypt from "bcrypt";     // npm install bcrypt

const app = express();
app.use(cors());
app.use(bodyParser.json());

// --------------------
// Supabase REST credentials
// --------------------
const SUPABASE_URL = "https://bjmliqvtjjntkgxpwwkp.supabase.co";
const SUPABASE_KEY = "YOUR_SUPABASE_ANON_KEY"; // replace with your anon/public key
const USERS_TABLE = "users";

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
// Start backend server
// --------------------
const PORT = 3000;
app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
