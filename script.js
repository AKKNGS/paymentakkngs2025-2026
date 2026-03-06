const API_URL = "https://script.google.com/macros/s/AKfycbzOcDcW0X_6npNUnpL-vpojQeO9m5H9acduZBFOq269o4ftwlCKHRvbwWCE6vOHAjvB4Q/exec";

const DEMO_USERS = [
  { username: "admin", password: "admin123", role: "admin", name: "Administrator" },
  { username: "user", password: "user123", role: "user", name: "Viewer User" }
];

let currentRole = "user";
let currentUser = "Guest";
let students = [];
let selectedStudent = null;
let activeTab = "all";

function $(id) {
  return document.getElementById(id);
}

function formatKHR(value) {
  const num = Number(value || 0);
  return `${num.toLocaleString()} KHR`;
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return 0;
  return Number(String(value).replace(/,/g, "").replace(/[^\d.-]/g, "")) || 0;
}

function formatDateDisplay(value) {
  if (!value) return "-";

  const text = String(value).trim();
  if (!text) return "-";

  if (text.includes("T")) {
    const d = new Date(text);
    if (!isNaN(d.getTime())) {
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const yyyy = d.getFullYear();
      return `${mm}/${dd}/${yyyy}`;
    }
  }

  return text;
}

function monthKey(dateText) {
  const text = String(dateText || "").trim();
  if (!text) return "No Date";
  const parts = text.split("/");
  if (parts.length !== 3) return text;
  const month = parts[0].padStart(2, "0");
  const year = parts[2];
  return `${month}/${year}`;
}

function normalizeStatus(rawStatus, balance) {
  const clean = String(rawStatus || "")
    .replace(/[✅⚠️☑️✔️]/g, "")
    .trim()
    .toLowerCase();

  if (clean === "paid") return "Paid";
  if (clean === "partial") return "Partial";
  return balance <= 0 ? "Paid" : "Partial";
}

function normalizeStudent(item) {
  const schoolFee = toNumber(item["School Fee"]);
  const firstPayment = toNumber(item["First Payment"]);
  const secondPayment = toNumber(item["Second Payment"]);
  const totalPaid = toNumber(item["Total Paid"]) || (firstPayment + secondPayment);
  const balance = item["Balance"] !== undefined && item["Balance"] !== ""
    ? toNumber(item["Balance"])
    : Math.max(0, schoolFee - totalPaid);

  return {
    studentId: item["student ID"] || item["Student ID"] || "",
    studentName: item["student name"] || item["Student Name"] || "",
    gender: item["Gender"] || "",
    className: item["Class"] || "",
    schoolFee,
    firstDate: item["First Date"] || "",
    firstPayment,
    remark1: item["Remark1"] || "",
    secondDate: item["Second Date"] || "",
    secondPayment,
    remark2: item["Remark2"] || "",
    others: item["Others"] || "",
    totalPaid,
    balance,
    status: normalizeStatus(item["Status"], balance)
  };
}

function showLoginError(message) {
  $("loginMessage").textContent = message || "";
}

function setUserUI() {
  $("currentUserName").textContent = currentUser;
  $("currentRoleBadge").textContent = currentRole === "admin" ? "Admin" : "User";
  $("currentRoleBadge").style.background = currentRole === "admin" ? "#fee2e2" : "#dbeafe";
  $("currentRoleBadge").style.color = currentRole === "admin" ? "#b91c1c" : "#1d4ed8";
}

function openApp() {
  $("loginPage").classList.add("hidden");
  $("appShell").classList.remove("hidden");
  setUserUI();
  loadStudents();
}

function login() {
  const username = $("username").value.trim();
  const password = $("password").value.trim();

  if (!username || !password) {
    showLoginError("សូមបញ្ចូល username និង password");
    return;
  }

  const found = DEMO_USERS.find(user => user.username === username && user.password === password);
  if (!found) {
    showLoginError("Username ឬ Password មិនត្រឹមត្រូវ");
    return;
  }

  currentRole = found.role;
  currentUser = found.name;
  localStorage.setItem("studentAppRole", currentRole);
  localStorage.setItem("studentAppUser", currentUser);
  showLoginError("");
  openApp();
}

function logout() {
  localStorage.removeItem("studentAppRole");
  localStorage.removeItem("studentAppUser");
  location.reload();
}

async function fetchStudents() {
  if (!API_URL || API_URL === "YOUR_GOOGLE_APPS_SCRIPT_URL") return [];
  const response = await fetch(API_URL, { method: "GET" });
  if (!response.ok) throw new Error("Failed to load data");
  const result = await response.json();
  if (!Array.isArray(result)) return [];
  return result.map(normalizeStudent);
}

async function loadStudents() {
  $("studentTableBody").innerHTML =
    `<tr><td colspan="9" class="empty-row">Loading data...</td></tr>`;

  try {
    students = await fetchStudents();

    if (!students.length) {
      $("studentTableBody").innerHTML =
        `<tr><td colspan="9" class="empty-row">មិនទាន់មានទិន្នន័យ ឬមិនទាន់ដាក់ Apps Script URL</td></tr>`;
      renderDashboard([]);
      renderClassReport([]);
      renderMonthlyReport([]);
      return;
    }

    renderDashboard(students);
    renderClassReport(students);
    renderMonthlyReport(students);
    renderTable();
  } catch (error) {
    console.error(error);
    $("studentTableBody").innerHTML =
      `<tr><td colspan="9" class="empty-row">មិនអាចទាញទិន្នន័យបានទេ។ សូមពិនិត្យ Apps Script URL</td></tr>`;
    renderDashboard([]);
    renderClassReport([]);
    renderMonthlyReport([]);
  }
}

function renderDashboard(data) {
  $("totalStudents").textContent = data.length.toLocaleString();
  $("paidCount").textContent = data.filter(x => x.status === "Paid").length.toLocaleString();
  $("partialCount").textContent = data.filter(x => x.status === "Partial").length.toLocaleString();
  $("totalCollected").textContent = formatKHR(data.reduce((sum, x) => sum + toNumber(x.totalPaid), 0));
}

function renderClassReport(data) {
  const body = $("classReportBody");
  if (!data.length) {
    body.innerHTML = `<tr><td colspan="5" class="empty-row">មិនទាន់មានទិន្នន័យ</td></tr>`;
    return;
  }

  const grouped = {};
  data.forEach(item => {
    const key = item.className || "No Class";
    if (!grouped[key]) grouped[key] = { className: key, total: 0, paid: 0, partial: 0, collected: 0 };
    grouped[key].total += 1;
    if (item.status === "Paid") grouped[key].paid += 1;
    if (item.status === "Partial") grouped[key].partial += 1;
    grouped[key].collected += toNumber(item.totalPaid);
  });

  body.innerHTML = Object.values(grouped)
    .sort((a, b) => a.className.localeCompare(b.className))
    .map(row => `
      <tr>
        <td>${row.className}</td>
        <td>${row.total}</td>
        <td>${row.paid}</td>
        <td>${row.partial}</td>
        <td>${formatKHR(row.collected)}</td>
      </tr>
    `).join("");
}

function renderMonthlyReport(data) {
  const body = $("monthlyReportBody");
  if (!data.length) {
    body.innerHTML = `<tr><td colspan="4" class="empty-row">មិនទាន់មានទិន្នន័យ</td></tr>`;
    return;
  }

  const grouped = {};
  data.forEach(item => {
    const firstKey = monthKey(item.firstDate);
    const secondKey = monthKey(item.secondDate);

    if (firstKey !== "No Date") {
      if (!grouped[firstKey]) grouped[firstKey] = { month: firstKey, first: 0, second: 0, total: 0 };
      grouped[firstKey].first += toNumber(item.firstPayment);
      grouped[firstKey].total += toNumber(item.firstPayment);
    }

    if (secondKey !== "No Date") {
      if (!grouped[secondKey]) grouped[secondKey] = { month: secondKey, first: 0, second: 0, total: 0 };
      grouped[secondKey].second += toNumber(item.secondPayment);
      grouped[secondKey].total += toNumber(item.secondPayment);
    }
  });

  body.innerHTML = Object.values(grouped)
    .sort((a, b) => a.month.localeCompare(b.month))
    .map(row => `
      <tr>
        <td>${row.month}</td>
        <td>${formatKHR(row.first)}</td>
        <td>${formatKHR(row.second)}</td>
        <td>${formatKHR(row.total)}</td>
      </tr>
    `).join("");
}

function getFilteredStudents() {
  const search = $("searchInput").value.trim().toLowerCase();
  const status = $("statusFilter").value;
  const classKey = $("classFilter").value.trim().toLowerCase();

  return students.filter(item => {
    const matchSearch =
      item.studentId.toLowerCase().includes(search) ||
      item.studentName.toLowerCase().includes(search) ||
      item.className.toLowerCase().includes(search);

    const matchStatus = status === "all" ? true : item.status === status;
    const matchClass = classKey ? item.className.toLowerCase().includes(classKey) : true;
    const matchTab = activeTab === "all" ? true : item.status === activeTab;

    return matchSearch && matchStatus && matchClass && matchTab;
  });
}

function renderTable() {
  const filtered = getFilteredStudents();

  if (!filtered.length) {
    $("studentTableBody").innerHTML =
      `<tr><td colspan="9" class="empty-row">មិនមានទិន្នន័យត្រូវនឹងលក្ខខណ្ឌស្វែងរក</td></tr>`;
    return;
  }

  $("studentTableBody").innerHTML = filtered.map(item => `
    <tr>
      <td>${item.studentId}</td>
      <td>${item.studentName}</td>
      <td>${item.gender}</td>
      <td>${item.className}</td>
      <td>${formatKHR(item.schoolFee)}</td>
      <td>${formatKHR(item.totalPaid)}</td>
      <td>${formatKHR(item.balance)}</td>
      <td>
        <span class="status-badge ${item.status === "Paid" ? "status-paid" : "status-partial"}">
          ${item.status}
        </span>
      </td>
      <td>
        <div class="action-group">
          ${
            currentRole === "admin"
              ? `<button class="action-btn btn-edit" data-id="${item.studentId}" data-action="edit">Edit</button>`
              : `<button class="action-btn btn-view" data-id="${item.studentId}" data-action="view">View</button>`
          }
          <button class="action-btn btn-print" data-id="${item.studentId}" data-action="print">Receipt</button>
          <button class="action-btn btn-profile" data-id="${item.studentId}" data-action="profile">Profile</button>
        </div>
      </td>
    </tr>
  `).join("");
}

function getStudentById(studentId) {
  return students.find(item => item.studentId === studentId);
}

function fillModalData(item) {
  $("modalStudentId").textContent = item.studentId;
  $("modalStudentName").textContent = item.studentName;
  $("modalStudentClass").textContent = item.className;
  $("modalSchoolFee").textContent = formatKHR(item.schoolFee);
  $("modalCurrentPaid").textContent = formatKHR(item.totalPaid);
  $("modalCurrentBalance").textContent = formatKHR(item.balance);
  $("firstPaymentInput").value = item.firstPayment || 0;
  $("secondPaymentInput").value = item.secondPayment || 0;
  $("othersInput").value = item.others || "";
  $("remark1Input").value = item.remark1 || "";
  $("remark2Input").value = item.remark2 || "";
  $("saveMessage").textContent = "";
}

function setModalDisabled(disabled) {
  $("firstPaymentInput").disabled = disabled;
  $("secondPaymentInput").disabled = disabled;
  $("othersInput").disabled = disabled;
  $("remark1Input").disabled = disabled;
  $("remark2Input").disabled = disabled;
}

function openPaymentModal(studentId, mode) {
  const item = getStudentById(studentId);
  if (!item) return;

  selectedStudent = item;
  fillModalData(item);

  const isView = mode === "view";
  setModalDisabled(isView);
  $("saveBtn").classList.toggle("hidden", isView || currentRole !== "admin");
  $("paymentModal").classList.remove("hidden");
}

function closeModal() {
  $("paymentModal").classList.add("hidden");
  $("saveMessage").textContent = "";
  selectedStudent = null;
}

function openProfile(student) {
  $("profileBody").innerHTML = `
    <div class="profile-grid">
      <div class="profile-item"><strong>ID</strong>${student.studentId}</div>
      <div class="profile-item"><strong>ឈ្មោះសិស្ស</strong>${student.studentName}</div>
      <div class="profile-item"><strong>ភេទ</strong>${student.gender}</div>
      <div class="profile-item"><strong>ថ្នាក់</strong>${student.className}</div>
      <div class="profile-item"><strong>ថ្លៃសាលា</strong>${formatKHR(student.schoolFee)}</div>
      <div class="profile-item"><strong>First Date</strong>${student.firstDate || "-"}</div>
      <div class="profile-item"><strong>First Payment</strong>${formatKHR(student.firstPayment)}</div>
      <div class="profile-item"><strong>Second Date</strong>${student.secondDate || "-"}</div>
      <div class="profile-item"><strong>Second Payment</strong>${formatKHR(student.secondPayment)}</div>
      <div class="profile-item"><strong>Total Paid</strong>${formatKHR(student.totalPaid)}</div>
      <div class="profile-item"><strong>Balance</strong>${formatKHR(student.balance)}</div>
      <div class="profile-item"><strong>Status</strong>${student.status}</div>
      <div class="profile-item"><strong>Remark 1</strong>${student.remark1 || "-"}</div>
      <div class="profile-item"><strong>Remark 2</strong>${student.remark2 || "-"}</div>
      <div class="profile-item"><strong>Others</strong>${student.others || "-"}</div>
    </div>
  `;
  $("profileModal").classList.remove("hidden");
}

function closeProfile() {
  $("profileModal").classList.add("hidden");
}

async function savePaymentUpdate() {
  if (!selectedStudent) return;

  const firstPayment = toNumber($("firstPaymentInput").value);
  const secondPayment = toNumber($("secondPaymentInput").value);
  const others = $("othersInput").value.trim();
  const remark1 = $("remark1Input").value.trim();
  const remark2 = $("remark2Input").value.trim();

  const totalPaid = firstPayment + secondPayment;
  const balance = Math.max(0, selectedStudent.schoolFee - totalPaid);
  const status = balance <= 0 ? "Paid" : "Partial";

  if (!API_URL || API_URL === "YOUR_GOOGLE_APPS_SCRIPT_URL") {
    $("saveMessage").textContent = "សូមដាក់ Google Apps Script URL ជាមុនសិន";
    return;
  }

  $("saveMessage").textContent = "កំពុងរក្សាទុក...";

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        studentId: selectedStudent.studentId,
        firstPayment,
        secondPayment,
        totalPaid,
        balance,
        status,
        others,
        remark1,
        remark2
      })
    });

    const result = await response.json();
    if (result.status !== "success") {
      throw new Error(result.message || "Update failed");
    }

    $("saveMessage").textContent = "រក្សាទុកបានជោគជ័យ";
    await loadStudents();
    setTimeout(closeModal, 700);
  } catch (error) {
    console.error(error);
    $("saveMessage").textContent = "មិនអាចរក្សាទុកបានទេ។ សូមពិនិត្យ Apps Script";
  }
}

function printReceiptByStudent(item) {
  const receiptWindow = window.open("", "_blank", "width=900,height=700");
  const html = `
    <html>
    <head>
      <title>Receipt - ${item.studentId}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:30px;color:#111;background:#f8fbff}
        .sheet{max-width:760px;margin:auto;background:#fff;border:2px solid #1e3a8a;border-radius:18px;padding:28px}
        .head{text-align:center;border-bottom:2px solid #dbeafe;padding-bottom:16px;margin-bottom:20px}
        .head h1{margin:0;color:#1e3a8a}
        .head p{margin:6px 0 0;color:#475569}
        .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:18px}
        .box{background:#f8fbff;border:1px solid #dbeafe;border-radius:12px;padding:12px}
        .box strong{display:block;margin-bottom:4px;color:#1e3a8a}
        table{width:100%;border-collapse:collapse;margin-top:12px}
        th,td{border:1px solid #cbd5e1;padding:10px;text-align:left}
        th{background:#eff6ff}
        .foot{margin-top:22px;display:flex;justify-content:space-between}
      </style>
    </head>
    <body>
      <div class="sheet">
        <div class="head">
          <h1>បង្កាន់ដៃបង់ប្រាក់</h1>
          <p>Student Payment Receipt</p>
        </div>

        <div class="grid">
          <div class="box"><strong>ID</strong>${item.studentId}</div>
          <div class="box"><strong>ឈ្មោះសិស្ស</strong>${item.studentName}</div>
          <div class="box"><strong>ភេទ</strong>${item.gender}</div>
          <div class="box"><strong>ថ្នាក់</strong>${item.className}</div>
        </div>

        <table>
          <tr><th>ថ្លៃសាលា</th><td>${formatKHR(item.schoolFee)}</td></tr>
          <tr><th>First Payment</th><td>${formatKHR(item.firstPayment)}</td></tr>
          <tr><th>Second Payment</th><td>${formatKHR(item.secondPayment)}</td></tr>
          <tr><th>Total Paid</th><td>${formatKHR(item.totalPaid)}</td></tr>
          <tr><th>Balance</th><td>${formatKHR(item.balance)}</td></tr>
          <tr><th>Status</th><td>${item.status}</td></tr>
          <tr><th>Remark 1</th><td>${item.remark1 || "-"}</td></tr>
          <tr><th>Remark 2</th><td>${item.remark2 || "-"}</td></tr>
          <tr><th>Others</th><td>${item.others || "-"}</td></tr>
        </table>

        <div class="foot">
          <div>កាលបរិច្ឆេទបោះពុម្ព: ${new Date().toLocaleString()}</div>
          <div>ហត្ថលេខា: __________________</div>
        </div>
      </div>
      <script>
        window.onload = function(){ window.print(); }
      <\/script>
    </body>
    </html>
  `;
  receiptWindow.document.open();
  receiptWindow.document.write(html);
  receiptWindow.document.close();
}

function exportCsv() {
  const rows = getFilteredStudents();
  if (!rows.length) return;

  const headers = ["student ID","student name","Gender","Class","School Fee","First Date","First Payment","Remark1","Second Date","Second Payment","Remark2","Others","Total Paid","Balance","Status"];
  const csv = [
    headers.join(","),
    ...rows.map(item => [
      item.studentId,
      `"${String(item.studentName).replace(/"/g, '""')}"`,
      item.gender,
      item.className,
      item.schoolFee,
      item.firstDate,
      item.firstPayment,
      `"${String(item.remark1 || "").replace(/"/g, '""')}"`,
      item.secondDate,
      item.secondPayment,
      `"${String(item.remark2 || "").replace(/"/g, '""')}"`,
      `"${String(item.others || "").replace(/"/g, '""')}"`,
      item.totalPaid,
      item.balance,
      item.status
    ].join(","))
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "student_payments_report.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function restoreSession() {
  const savedRole = localStorage.getItem("studentAppRole");
  const savedUser = localStorage.getItem("studentAppUser");
  if (!savedRole || !savedUser) return;
  currentRole = savedRole;
  currentUser = savedUser;
  openApp();
}

function bindTabEvents() {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", function() {
      document.querySelectorAll(".tab-btn").forEach(x => x.classList.remove("active"));
      this.classList.add("active");
      activeTab = this.getAttribute("data-tab");
      renderTable();
    });
  });
}

function bindEvents() {
  $("loginBtn").addEventListener("click", login);
  $("logoutBtn").addEventListener("click", logout);
  $("refreshBtn").addEventListener("click", loadStudents);
  $("exportCsvBtn").addEventListener("click", exportCsv);

  $("searchInput").addEventListener("input", renderTable);
  $("statusFilter").addEventListener("change", renderTable);
  $("classFilter").addEventListener("input", renderTable);

  $("closeModalBtn").addEventListener("click", closeModal);
  $("cancelBtn").addEventListener("click", closeModal);
  $("saveBtn").addEventListener("click", savePaymentUpdate);

  $("printReceiptBtn").addEventListener("click", function() {
    if (selectedStudent) printReceiptByStudent(selectedStudent);
  });

  $("openProfileBtn").addEventListener("click", function() {
    if (selectedStudent) openProfile(selectedStudent);
  });

  $("closeProfileBtn").addEventListener("click", closeProfile);

  $("password").addEventListener("keydown", e => { if (e.key === "Enter") login(); });
  $("username").addEventListener("keydown", e => { if (e.key === "Enter") login(); });

  $("studentTableBody").addEventListener("click", function(e) {
    const btn = e.target.closest("button[data-id]");
    if (!btn) return;

    const studentId = btn.getAttribute("data-id");
    const action = btn.getAttribute("data-action");
    const item = getStudentById(studentId);
    if (!item) return;

    if (action === "edit") openPaymentModal(studentId, "edit");
    else if (action === "view") openPaymentModal(studentId, "view");
    else if (action === "print") printReceiptByStudent(item);
    else if (action === "profile") openProfile(item);
  });

  window.addEventListener("click", function(e) {
    if (e.target === $("paymentModal")) closeModal();
    if (e.target === $("profileModal")) closeProfile();
  });

  bindTabEvents();
}

document.addEventListener("DOMContentLoaded", function() {
  bindEvents();
  restoreSession();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(function(err) {
      console.log("Service worker failed:", err);
    });
  }

});
