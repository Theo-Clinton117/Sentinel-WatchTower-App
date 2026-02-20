const API_BASE = window.SENTINEL_API_BASE || "";

const successTitle = document.getElementById("successTitle");
const successSub = document.getElementById("successSub");
const successPlan = document.getElementById("successPlan");
const successAmount = document.getElementById("successAmount");
const successRef = document.getElementById("successRef");
const successMessage = document.getElementById("successMessage");
const successRetry = document.getElementById("successRetry");

const PLAN_LABELS = {
  individual: "Individual",
  family: "Family",
  organization: "Organization"
};

function formatAmount(amount) {
  return amount ? `₦${Number(amount).toLocaleString()}` : "-";
}

async function verifyPayment(reference) {
  const response = await fetch(`${API_BASE}/api/paystack/verify/${reference}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error || "Verification failed.");
  return data;
}

async function recordSubscription(reference, status, plan, amount) {
  const rawUser = sessionStorage.getItem("authUserContext") || localStorage.getItem("authUserContext");
  const user = rawUser ? JSON.parse(rawUser) : null;
  const payload = {
    reference,
    status,
    plan,
    amount,
    user_id: user?.id || null,
    user_email: user?.email || null
  };
  const response = await fetch(`${API_BASE}/api/subscriptions/record`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error || "Unable to record subscription.");
  return data;
}

function renderSuccess({ status, plan, amount, reference, message }) {
  successRef.textContent = reference || "-";
  successPlan.textContent = PLAN_LABELS[plan] || plan || "-";
  successAmount.textContent = formatAmount(amount);

  if (status === "success") {
    successTitle.textContent = "Payment confirmed";
    successSub.textContent = "Your subscription is now active.";
    successRetry.textContent = "Go to Dashboard";
    successRetry.onclick = () => {
      window.location.href = "./dashboard.html";
    };
    setTimeout(() => {
      window.location.href = "./dashboard.html";
    }, 3000);
  } else if (status === "pending") {
    successTitle.textContent = "Payment pending";
    successSub.textContent = "We're still waiting for confirmation.";
    successRetry.textContent = "Retry Verification";
    successRetry.onclick = runVerification;
  } else {
    successTitle.textContent = "Payment not verified";
    successSub.textContent = "We could not confirm the transaction.";
    successRetry.textContent = "Retry Verification";
    successRetry.onclick = runVerification;
  }

  successMessage.textContent = message || "";
}

async function runVerification() {
  const params = new URLSearchParams(window.location.search);
  const reference = params.get("reference") || sessionStorage.getItem("sentinel_paystack_ref");
  const plan = sessionStorage.getItem("sentinel_paystack_plan") || null;

  if (!reference) {
    renderSuccess({ status: "failed", plan, amount: null, reference: "-", message: "Missing payment reference." });
    return;
  }

  try {
    const result = await verifyPayment(reference);
    if (result.status === "success") {
      try {
        await recordSubscription(reference, result.status, result.plan || plan, result.amount);
      } catch (err) {
        console.warn("Subscription record failed:", err);
      }
    }
    renderSuccess({
      status: result.status,
      plan: result.plan || plan,
      amount: result.amount,
      reference,
      message: result.message
    });
  } catch (err) {
    renderSuccess({
      status: "failed",
      plan,
      amount: null,
      reference,
      message: err?.message || "Verification error."
    });
  }
}

successRetry?.addEventListener("click", runVerification);
runVerification();
