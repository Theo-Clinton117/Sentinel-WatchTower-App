const API_BASE = window.SENTINEL_API_BASE || "";

const form = document.getElementById("orgContactForm");
const submitBtn = document.getElementById("orgContactSubmit");
const statusEl = document.getElementById("orgContactStatus");

function setStatus(msg, tone = "neutral") {
  const cls = tone === "error"
    ? "text-xs text-red-400"
    : tone === "success"
      ? "text-xs text-green-400"
      : "text-xs text-gray-500";
  statusEl.className = cls;
  statusEl.textContent = msg;
}

async function submitLead(payload) {
  const response = await fetch(`${API_BASE}/api/org-leads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || "Unable to submit request.");
  }
  return data;
}

form?.addEventListener("submit", async event => {
  event.preventDefault();
  const data = new FormData(form);
  const payload = {
    organization: data.get("organization") || "",
    size: data.get("size") || "",
    name: data.get("name") || "",
    role: data.get("role") || "",
    email: data.get("email") || "",
    phone: data.get("phone") || "",
    export_needs: data.get("export_needs") || "",
    use_case: data.get("use_case") || ""
  };

  if (!payload.organization || !payload.name || !payload.email) {
    setStatus("Organization, name, and email are required.", "error");
    return;
  }

  submitBtn.disabled = true;
  setStatus("Sending request...");
  try {
    await submitLead(payload);
    setStatus("Thanks! Your request is in. Our team will reach out soon.", "success");
    form.reset();
  } catch (err) {
    setStatus(err?.message || "Submission failed. Check the backend.", "error");
  } finally {
    submitBtn.disabled = false;
  }
});
