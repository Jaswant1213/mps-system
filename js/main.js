// ==========================================
// ☁️ FIREBASE CLOUD SYNC SYSTEM
// ==========================================

// 1. DATA SAVE KARNE KA FUNCTION (LocalStorage + Firebase)
function saveData(key, data) {
  // A. Pehle Computer mein save karo (Backup)
  localStorage.setItem(key, JSON.stringify(data));

  // B. Phir Internet (Firebase) par bhejo
  if (window.dbRef) {
    window
      .dbSet(window.dbRef(window.db, key), data)
      .then(() => console.log(`☁️ Synced ${key} to Cloud`))
      .catch((e) => console.error("Sync Error:", e));
  }
}

// 2. DATA LOAD KARNE KA FUNCTION (App Start hone par)
async function loadFromCloud() {
  if (!window.dbRef) return;

  console.log("🔄 Checking for new data...");
  const keys = [
    "mphs_students",
    "mphs_fees",
    "mphs_users",
    "mphs_classes",
    "mphs_certificates",
    "mphs_marks",
  ];

  for (const key of keys) {
    try {
      const snapshot = await window.dbGet(
        window.dbChild(window.dbRef(window.db), key),
      );
      if (snapshot.exists()) {
        // Agar Cloud par data hai, to usay LocalStorage mein daal do
        localStorage.setItem(key, JSON.stringify(snapshot.val()));
        console.log(`✅ Loaded ${key} from Cloud`);
      }
    } catch (error) {
      console.error("Load Error:", error);
    }
  }
  // UI Update karo
  if (typeof updateDashboardStats === "function") updateDashboardStats();
  if (typeof renderStudentTable === "function") renderStudentTable();
}

// 3. App Start hone ke 2 second baad data download karo
setTimeout(loadFromCloud, 2000);
// PART 1: INITIALIZATION, AUTHENTICATION & HELPERS

const CURRENT_USER = {
  get username() {
    return localStorage.getItem("mphs_user_name") || "admin";
  },
  get role() {
    return localStorage.getItem("mphs_role") || "admin";
  },
};

// Global Variables
let currentFeeStudent = null;
let feeBasket = [];

function toTitleCase(str) {
  if (!str) return "";
  return str.replace(/\w\S*/g, function (txt) {
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
}

// Mobile Sidebar Logic
const menuToggle = document.getElementById("menu-toggle");
const sidebar = document.getElementById("sidebar");
const closeBtn = document.getElementById("close-sidebar-btn");

if (menuToggle) {
  menuToggle.addEventListener("click", () => {
    sidebar.classList.add("active");
  });
}
if (closeBtn) {
  closeBtn.addEventListener("click", () => {
    sidebar.classList.remove("active");
  });
}

document.addEventListener("click", (e) => {
  if (
    sidebar &&
    !sidebar.contains(e.target) &&
    menuToggle &&
    !menuToggle.contains(e.target) &&
    window.innerWidth <= 768
  ) {
    sidebar.classList.remove("active");
  }
});

// DATABASE INITIALIZATION
const DB = {
  init() {
    // 1. Classes Setup
    if (!localStorage.getItem("mphs_classes")) {
      const schoolClasses = [
        { id: 1, name: "ECE 1", fee: 1000 },
        { id: 2, name: "ECE 2", fee: 1000 },
        { id: 3, name: "KG 1", fee: 1200 },
        { id: 4, name: "KG 2", fee: 1200 },
        { id: 5, name: "Class 1", fee: 1500 },
        { id: 6, name: "Class 2", fee: 1500 },
        { id: 7, name: "Class 3", fee: 1500 },
        { id: 8, name: "Class 4", fee: 1500 },
        { id: 9, name: "Class 5", fee: 1500 },
        { id: 10, name: "Class 6", fee: 1800 },
        { id: 11, name: "Class 7", fee: 1800 },
        { id: 12, name: "Class 8", fee: 2000 },
        { id: 13, name: "Class 9", fee: 2500 },
        { id: 14, name: "Class 10", fee: 2500 },
      ];
      // CHANGE: Cloud par bhejne ke liye saveData use kiya
      saveData("mphs_classes", schoolClasses);
    }

    // 2. Students & Fees Setup
    if (!localStorage.getItem("mphs_students")) saveData("mphs_students", []);

    if (!localStorage.getItem("mphs_tx")) saveData("mphs_tx", []);

    // 3. History Arrays Setup
    if (!localStorage.getItem("mphs_certificates"))
      saveData("mphs_certificates", []);

    if (!localStorage.getItem("mphs_subjects")) saveData("mphs_subjects", {});

    if (!localStorage.getItem("mphs_marks")) saveData("mphs_marks", []);

    // 4. Admin User Setup
    if (!localStorage.getItem("mphs_users")) {
      saveData("mphs_users", [
        { username: "admin", password: "123", role: "admin" },
      ]);
    }

    // UI Update
    if (typeof updateDashboardStats === "function") updateDashboardStats();
  },

  get: (key) => JSON.parse(localStorage.getItem(key)),

  // MAIN CHANGE: Ab 'set' function seedha Firebase par data bhejega
  set: (key, val) => saveData(key, val),
};

DB.init();

// Login Logic
const loginForm = document.getElementById("login-form");
if (loginForm) {
  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const u = document.getElementById("username").value.trim();
    const p = document.getElementById("password").value.trim();
    const users = DB.get("mphs_users");
    const foundUser = users.find(
      (user) =>
        user.username.toLowerCase() === u.toLowerCase() && user.password === p,
    );
    if (foundUser) {
      localStorage.setItem("mphs_role", foundUser.role);
      localStorage.setItem("mphs_user_name", foundUser.username);

      // Force Dashboard on fresh login
      localStorage.setItem("mphs_active_tab", "dashboard");
      location.reload();
    } else {
      document.getElementById("login-error").classList.remove("hidden");
    }
  });
}

function logout() {
  localStorage.removeItem("mphs_role");
  localStorage.removeItem("mphs_user_name");
  location.reload();
}

window.onload = () => {
  const role = localStorage.getItem("mphs_role");
  if (role) {
    document.getElementById("login-screen").classList.add("hidden");
    if (role === "teacher")
      document.getElementById("admin-links").classList.add("hidden");

    // Resume last tab on refresh
    const activeTab = localStorage.getItem("mphs_active_tab") || "dashboard";
    switchTab(activeTab);

    updateDashboardStats();
  }
};

// PART 2: NAVIGATION

function switchTab(tabId) {
  const role = localStorage.getItem("mphs_role");
  const adminTabs = ["student-mgmt", "reports", "user-mgmt"];
  if (role === "teacher" && adminTabs.includes(tabId))
    return alert("Access Denied!");

  // Save State
  localStorage.setItem("mphs_active_tab", tabId);

  document
    .querySelectorAll(".tab-content")
    .forEach((t) => t.classList.add("hidden"));
  document.getElementById("tab-" + tabId).classList.remove("hidden");
  document
    .querySelectorAll(".nav-link")
    .forEach((l) => l.classList.remove("active"));

  const navMap = {
    dashboard: "nav-dash",
    "student-mgmt": "nav-std",
    "fee-collection": "nav-fee",
    reports: "nav-rep",
    "user-mgmt": "nav-users",
    results: "nav-res",
    certificates: "nav-cert",
  };

  if (document.getElementById(navMap[tabId]))
    document.getElementById(navMap[tabId]).classList.add("active");

  // Load specific data for tabs
  if (tabId === "student-mgmt") {
    document.getElementById("class-cards-container").classList.remove("hidden");
    document.getElementById("class-detail-view").classList.add("hidden");
    renderClassCards();
  }
  if (tabId === "dashboard") updateDashboardStats();
  if (tabId === "fee-collection") loadFeeClasses();
  if (tabId === "reports") renderReports();
  if (tabId === "user-mgmt") renderUserList();
  if (tabId === "certificates") {
    loadCertClasses();
    renderCertHistory(); // Initial load (no spinner)
  }
  if (tabId === "dashboard") {
    updateAlertStats();
  }
}

// PART 3: DASHBOARD ANALYTICS

function updateDashboardStats() {
  console.log("🚀 Starting Dashboard Update...");

  // 1. Data Load Karna
  const students = JSON.parse(localStorage.getItem("mphs_students") || "[]");
  const transactions = JSON.parse(localStorage.getItem("mphs_tx") || "[]");
  const staff = JSON.parse(localStorage.getItem("mphs_users") || "[]");

  // --- Helper: Screen par likhne wala function ---
  function updateText(id, value) {
    // Pehle ID dhoondo, na mile to Class dhoondo
    const el = document.getElementById(id) || document.querySelector("." + id);
    if (el) {
      el.innerText = value;
    } else {
      console.warn("⚠️ Box nahi mila: " + id);
    }
  }

  // 2. Dates Set Karna (Current Month & Year)
  const now = new Date();
  const currentMonth = now.getMonth(); // 0 = Jan, 1 = Feb
  const currentYear = now.getFullYear(); // 2026

  let monthlyIncome = 0;
  let paidStudentsCount = 0;

  console.log(
    `📅 Checking for: Month ${currentMonth + 1}, Year ${currentYear}`,
  );

  // 3. Paid Students Ginti (Logic Fixed) ✅
  students.forEach((student) => {
    // Check karein is student ki koi transaction hai is mahine?
    const hasPaid = transactions.some((tx) => {
      const txDate = new Date(tx.date);

      // Match Logic: ID ya Name same ho + Mahina same ho + Saal same ho
      const isSameUser =
        tx.studentId == student.id || tx.studentName === student.name;
      const isSameMonth = txDate.getMonth() === currentMonth;
      const isSameYear = txDate.getFullYear() === currentYear;

      return isSameUser && isSameMonth && isSameYear;
    });

    if (hasPaid) {
      paidStudentsCount++;
    }
  });

  // 4. Income Calculation (Cleaning Logic Added) ✅
  transactions.forEach((tx) => {
    const txDate = new Date(tx.date);

    if (
      txDate.getMonth() === currentMonth &&
      txDate.getFullYear() === currentYear
    ) {
      // Amount ko saaf karna (agar "+2500" ya "2,500" likha ho to sirf 2500 uthana)
      let rawAmount = tx.amount ? tx.amount.toString() : "0";
      let cleanAmount = rawAmount.replace(/[^0-9]/g, ""); // Sirf digits bachenge
      let finalAmount = parseInt(cleanAmount) || 0;

      monthlyIncome += finalAmount;
    }
  });

  console.log(`💰 Calculated Income: ${monthlyIncome}`);
  console.log(`👨‍🎓 Paid Students: ${paidStudentsCount}`);

  // 5. Screen Update (Final IDs) ✅
  updateText("dash-total-students", students.length);
  updateText("dash-total-staff", staff.length);
  updateText("dash-income", monthlyIncome.toLocaleString() + " PKR");

  updateText("stat-paid-count", paidStudentsCount);
  updateText("stat-unpaid-count", students.length - paidStudentsCount);

  console.log("✅ Dashboard Update Complete!");
}
// PART 4: STUDENT MANAGEMENT
function renderClassCards() {
  const clss = DB.get("mphs_classes");
  const stds = DB.get("mphs_students");
  const container = document.getElementById("class-cards-container");
  if (!container) return;

  container.innerHTML = clss
    .map((c) => {
      const count = stds.filter((s) => s.className === c.name).length;
      return `
        <div class="class-card" onclick="viewClassDetails('${c.name}')">
            <h3>${c.name}</h3>
            <div class="card-count">${count}</div>
            <small>Students</small>
        </div>`;
    })
    .join("");
}

function viewClassDetails(className) {
  document.getElementById("class-cards-container").classList.add("hidden");
  document.getElementById("class-detail-view").classList.remove("hidden");
  document.getElementById("class-title").innerText =
    "Class Details: " + className;

  const monthSelect = document.getElementById("filter-month");
  if (monthSelect && monthSelect.options.length === 0) {
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    monthSelect.innerHTML = months
      .map((m) => `<option value="${m}">${m}</option>`)
      .join("");
    monthSelect.selectedIndex = new Date().getMonth();
  }
  applyClassFilters();
}

function backToClasses() {
  document.getElementById("class-detail-view").classList.add("hidden");
  document.getElementById("class-cards-container").classList.remove("hidden");
  renderClassCards();
}

function openStudentModal() {
  const clss = DB.get("mphs_classes");
  const select = document.getElementById("new-class-select");
  if (select) {
    select.innerHTML = clss
      .map((c) => `<option value="${c.name}">${c.name}</option>`)
      .join("");
  }

  // Clear Form
  document.getElementById("edit-student-id").value = "";
  document.getElementById("new-name").value = "";
  document.getElementById("new-father").value = "";
  document.getElementById("new-caste").value = "";
  document.getElementById("new-contact").value = "";
  document.getElementById("new-address").value = "";

  // Clear Errors
  ["name", "father", "caste", "contact"].forEach((f) => {
    const input = document.getElementById("new-" + f);
    const err = document.getElementById("err-" + f);
    if (input) input.style.borderColor = "#ddd";
    if (err) err.style.display = "none";
  });

  const header = document.querySelector("#student-modal h3");
  if (header) header.innerHTML = "New Admission";

  document.getElementById("student-modal").classList.remove("hidden");
}

function closeStudentModal() {
  document.getElementById("student-modal").classList.add("hidden");
}

function applyClassFilters() {
  const selMonth = document.getElementById("filter-month").value;
  const selYear = document.getElementById("filter-year").value;
  const searchKey = selMonth + "-" + selYear;

  const status = document.getElementById("filter-status").value;
  const titleEl = document.getElementById("class-title");
  if (!titleEl) return;

  const currentClass = titleEl.innerText.replace("Class Details: ", "");
  let list = DB.get("mphs_students").filter(
    (s) => s.className === currentClass,
  );
  list.sort((a, b) => a.roll - b.roll);

  const tbody = document.getElementById("student-list-body");
  if (!tbody) return;

  tbody.innerHTML = list
    .map((s) => {
      let isPaid = s.paidMonths ? s.paidMonths.includes(searchKey) : false;
      if (status === "Paid" && !isPaid) return "";
      if (status === "Unpaid" && isPaid) return "";

      return `
            <tr>
                <td><b>${s.roll}</b></td>
                <td>
                    <div style="font-weight:600;">${s.name}</div>
                    <small style="color:#666;">${s.caste}</small>
                </td>
                <td>${s.fatherName}</td>
                <td>${s.contact || "-"}</td>
                <td>
                    ${
                      isPaid
                        ? '<span class="badge-paid">PAID</span>'
                        : '<span class="badge-unpaid">UNPAID</span>'
                    }
                </td>
                <td>
                    <button class="btn-sm" onclick="editStudent('${s.id}')" title="Edit"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn-sm" onclick="deleteStudent('${s.id}')" title="Delete" style="color:#dc2626;"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>`;
    })
    .join("");
}

function searchStudentTable() {
  const filter = document.getElementById("search-student").value.toUpperCase();
  const tbody = document.getElementById("student-list-body");
  const tr = tbody.getElementsByTagName("tr");
  for (let i = 0; i < tr.length; i++) {
    const txt = tr[i].textContent || tr[i].innerText;
    tr[i].style.display = txt.toUpperCase().indexOf(filter) > -1 ? "" : "none";
  }
}

function clearError(field) {
  document.getElementById("new-" + field).style.borderColor = "#ddd";
  const errMsg = document.getElementById("err-" + field);
  if (errMsg) errMsg.style.display = "none";
}

function handleNewStudent() {
  const nameField = document.getElementById("new-name");
  const fatherField = document.getElementById("new-father");
  const casteField = document.getElementById("new-caste");
  const contactField = document.getElementById("new-contact");

  const name = nameField.value.trim();
  const father = fatherField.value.trim();
  const caste = casteField.value.trim();
  const cls = document.getElementById("new-class-select").value;
  const contact = contactField.value.trim();
  const address = document.getElementById("new-address").value.trim();
  const editId = document.getElementById("edit-student-id").value;

  let isValid = true;

  // Validation
  if (!name) {
    nameField.style.borderColor = "red";
    document.getElementById("err-name").style.display = "block";
    isValid = false;
  }
  if (!father) {
    fatherField.style.borderColor = "red";
    document.getElementById("err-father").style.display = "block";
    isValid = false;
  }
  if (!caste) {
    casteField.style.borderColor = "red";
    document.getElementById("err-caste").style.display = "block";
    isValid = false;
  }

  if (!contact || contact.length !== 11) {
    contactField.style.borderColor = "red";
    document.getElementById("err-contact").innerText =
      "Valid 11-digit number required";
    document.getElementById("err-contact").style.display = "block";
    isValid = false;
  }

  if (!isValid) return;

  const list = DB.get("mphs_students");

  if (editId) {
    const idx = list.findIndex((s) => s.id === editId);
    if (idx !== -1) {
      list[idx].name = toTitleCase(name);
      list[idx].fatherName = toTitleCase(father);
      list[idx].caste = toTitleCase(caste);
      list[idx].className = cls;
      list[idx].contact = contact;
      list[idx].address = address || "-";
      DB.set("mphs_students", list);
      showToast("Student Updated!", "success");
    }
  } else {
    const isDuplicate = list.some(
      (s) =>
        s.name.toLowerCase() === name.toLowerCase() &&
        s.fatherName.toLowerCase() === father.toLowerCase() &&
        s.className === cls,
    );
    if (isDuplicate) return showToast("Student already exists!", "error");

    const classStudents = list.filter((s) => s.className === cls);
    const maxRoll =
      classStudents.length > 0
        ? Math.max(...classStudents.map((s) => s.roll))
        : 0;
    const roll = maxRoll + 1;

    list.push({
      id: Date.now().toString(),
      roll: roll,
      name: toTitleCase(name),
      fatherName: toTitleCase(father),
      caste: toTitleCase(caste),
      className: cls,
      contact: contact,
      address: address || "-",
      paidMonths: [],
    });

    DB.set("mphs_students", list);
    showToast(`Admitted! Roll No: ${roll}`, "success");
  }

  closeStudentModal();
  applyClassFilters();
  renderClassCards();
  updateDashboardStats();
}

function editStudent(id) {
  const s = DB.get("mphs_students").find((student) => student.id === id);
  if (s) {
    document.getElementById("edit-student-id").value = s.id;
    document.getElementById("new-name").value = s.name;
    document.getElementById("new-father").value = s.fatherName;
    document.getElementById("new-caste").value = s.caste;
    document.getElementById("new-contact").value = s.contact;
    document.getElementById("new-address").value = s.address;

    const select = document.getElementById("new-class-select");
    const clss = DB.get("mphs_classes");
    if (select.options.length === 0) {
      select.innerHTML = clss
        .map((c) => `<option value="${c.name}">${c.name}</option>`)
        .join("");
    }
    select.value = s.className;

    document.querySelector("#student-modal h3").innerText = "Edit Student";
    document.getElementById("student-modal").classList.remove("hidden");
  }
}

function deleteStudent(id) {
  if (confirm("Are you sure you want to delete this student permanently?")) {
    DB.set(
      "mphs_students",
      DB.get("mphs_students").filter((s) => s.id !== id),
    );
    applyClassFilters();
    renderClassCards();
    showToast("Student Deleted!", "success");
    updateDashboardStats();
  }
}

// PART 5: FEE COLLECTION

function loadFeeClasses() {
  let classSelect = document.getElementById("fee-class-select");
  if (!classSelect) return;
  const classes = DB.get("mphs_classes");
  classSelect.innerHTML = '<option value="">All Classes</option>';
  classes.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c.name;
    opt.innerText = c.name;
    classSelect.appendChild(opt);
  });
}

function filterFeeStudents() {
  const cls = document.getElementById("fee-class-select").value;
  const stds = DB.get("mphs_students")
    .filter((s) => s.className === cls)
    .sort((a, b) => a.roll - b.roll);
  document.getElementById("fee-std-select").innerHTML =
    `<option value="">-- Select --</option>` +
    stds
      .map(
        (s) => `<option value="${s.roll}">Roll ${s.roll} - ${s.name}</option>`,
      )
      .join("");
}

function updateDefaultFee() {
  const clsName = document.getElementById("fee-class-select").value;
  const clsObj = DB.get("mphs_classes").find((c) => c.name === clsName);
  if (clsObj) document.getElementById("manual-fee-input").value = clsObj.fee;
  const roll = document.getElementById("fee-std-select").value;
  if (roll && clsName) {
    const std = DB.get("mphs_students").find(
      (s) => s.roll == roll && s.className === clsName,
    );
    if (std) currentFeeStudent = std;
  }
}

function quickPay() {
  const roll = document.getElementById("fee-std-select").value;
  const amount = document.getElementById("manual-fee-input").value;
  const cls = document.getElementById("fee-class-select").value;
  const month =
    document.getElementById("fee-month").value +
    "-" +
    document.getElementById("fee-year").value;

  if (!roll || !amount || !cls) return showToast("Details missing!", "error");
  const std = DB.get("mphs_students").find(
    (s) => s.roll == roll && s.className === cls,
  );
  if (!std) return showToast("Student not found", "error");

  if (std.paidMonths && std.paidMonths.includes(month))
    return showToast(`Fee already PAID for ${month}`, "error");
  if (feeBasket.find((b) => b.id === std.id && b.month === month))
    return showToast("Fee already in basket!", "warning");

  currentFeeStudent = std;
  feeBasket = [
    {
      id: std.id,
      name: std.name,
      father: std.fatherName,
      fee: parseInt(amount),
      className: std.className,
      month: month,
    },
  ];
  updateBasketUI();
  processPayment();
}

function addToBasket() {
  const roll = document.getElementById("fee-std-select").value;
  const amount = document.getElementById("manual-fee-input").value;
  const cls = document.getElementById("fee-class-select").value;
  const month =
    document.getElementById("fee-month").value +
    "-" +
    document.getElementById("fee-year").value;

  const std = DB.get("mphs_students").find(
    (s) => s.roll == roll && s.className === cls,
  );
  if (!std) return showToast("Student not found", "error");

  if (std.paidMonths && std.paidMonths.includes(month))
    return showToast(`Student already PAID for ${month}`, "error");
  if (feeBasket.some((item) => item.id === std.id && item.month === month))
    return showToast("Already added!", "error");

  feeBasket.push({
    id: std.id,
    name: std.name,
    father: std.fatherName,
    fee: parseInt(amount),
    className: std.className,
    month: month,
  });
  updateBasketUI();
}

function updateBasketUI() {
  document.getElementById("basket-items-list").innerHTML = feeBasket
    .map(
      (b) =>
        `<div class="basket-item"><span>${b.name}<br><small>${b.month}</small></span><strong>${b.fee}</strong></div>`,
    )
    .join("");
  document.getElementById("basket-total").innerText = feeBasket.reduce(
    (s, i) => s + i.fee,
    0,
  );
}

function processPayment() {
  if (feeBasket.length === 0) return showToast("Basket is empty!", "error");

  if (!currentFeeStudent && feeBasket.length > 0) {
    currentFeeStudent = DB.get("mphs_students").find(
      (s) => s.id === feeBasket[0].id,
    );
  }

  const totalAmount = feeBasket.reduce((sum, item) => sum + item.fee, 0);
  const paidMonthsList = feeBasket.map((item) => item.month).join(", ");

  const newTx = {
    id: "TX-" + Date.now(),
    date: new Date().toISOString(),
    studentId: currentFeeStudent.id,
    studentName: currentFeeStudent.name,
    className: currentFeeStudent.className,
    fatherName: currentFeeStudent.fatherName,
    collectedBy: CURRENT_USER.username,
    items: [...feeBasket],
    total: totalAmount,
  };

  const txs = DB.get("mphs_tx") || [];
  txs.push(newTx);
  localStorage.setItem("mphs_tx", JSON.stringify(txs));

  const students = DB.get("mphs_students");
  feeBasket.forEach((item) => {
    const stdIndex = students.findIndex((s) => s.id === item.id);
    if (stdIndex !== -1) {
      if (!students[stdIndex].paidMonths) students[stdIndex].paidMonths = [];
      if (!students[stdIndex].paidMonths.includes(item.month))
        students[stdIndex].paidMonths.push(item.month);
    }
  });
  DB.set("mphs_students", students);

  showReceipt(newTx);

  // WhatsApp Notification
  if (confirm("Send WhatsApp Receipt to Parent?")) {
    sendWhatsAppReceipt(currentFeeStudent.id, totalAmount, paidMonthsList);
  }

  feeBasket = [];
  updateBasketUI();
  showToast("Fee Payment Successful!", "success");
  updateDashboardStats();
}

function showReceipt(t) {
  const datePart = t.date.split("T")[0];
  const mainName = t.items[0].name + (t.items.length > 1 ? " & Others" : "");
  const mainFather = t.items[0].father || "-";
  const mainClass = t.items[0].className;
  const collector = toTitleCase(t.collectedBy || "Admin");

  const rows = t.items
    .map(
      (i) => `
    <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 8px 5px;"><div style="font-weight:600; color:#000;">${i.name} <small>(${i.className})</small></div><div style="color: #666; font-size: 0.85rem;">Monthly Fee - ${i.month}</div></td>
        <td style="text-align:right; font-weight:bold; vertical-align: middle; padding-right: 5px;">${i.fee}</td>
    </tr>`,
    )
    .join("");

  const receiptHTML = `
    <div style="padding: 20px;">
        <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="margin: 0; font-size: 1.6rem; font-weight: 800; text-transform: uppercase; color: #1e293b;">THE MEHRAN PUBLIC SCHOOL</h2>
            <p style="margin: 2px 0; color: #6b7280; font-size: 0.9rem; letter-spacing: 2px;">NAUKOT</p>
            <div style="margin-top: 10px; border-bottom: 2px solid #1e293b; width: 100%;"></div>
            <div style="margin-top: 8px;"><span style="background: #1e293b; color: white; padding: 4px 15px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase;">Official Fee Receipt</span></div>
        </div>
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 1px dashed #ccc; padding-bottom: 10px; font-size: 0.9rem;">
            <div><span style="color: #666;">Receipt No:</span><span style="font-family: monospace; font-weight: 700; color: #000; margin-left: 5px;">${t.id}</span></div>
            <div><span style="color: #666;">Date:</span><span style="font-weight: 700; color: #000; margin-left: 5px;">${datePart}</span></div>
        </div>

        <div style="display: grid; grid-template-columns: auto 1fr; gap: 8px 20px; font-size: 0.9rem; margin-bottom: 20px;">
            <div style="color: #666;">Student:</div><div style="font-weight: 700; text-transform: uppercase;">${mainName}</div>
            <div style="color: #666;">Father Name:</div><div style="text-transform: uppercase;">${mainFather}</div>
            <div style="color: #666;">Class:</div><div>${mainClass}</div>
            <div style="color: #666;">Received By:</div><div style="font-weight: 700; color: var(--primary); text-transform: capitalize;">${collector}</div>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <thead><tr style="background-color: #f8fafc; border-bottom: 2px solid #1e293b;"><th style="text-align: left; padding: 8px 5px; font-size: 0.9rem; color: #444;">Description</th><th style="text-align: right; padding: 8px 5px; font-size: 0.9rem; color: #444;">Amount</th></tr></thead>
            <tbody>${rows}</tbody>
            <tfoot><tr style="border-top: 2px solid #1e293b;"><td style="text-align: left; padding: 12px 5px; font-weight: 700;">GRAND TOTAL</td><td style="text-align: right; padding: 12px 5px; font-weight: 800; font-size: 1.2rem;">${t.total} PKR</td></tr></tfoot>
        </table>

        <div style="margin-top: 40px; display: flex; justify-content: space-between; align-items: flex-end;">
            <div style="text-align: center;"><div style="font-size: 1rem; font-family: 'Dancing Script', cursive; margin-bottom: -5px; color: #444;">${collector}</div><div style="border-top: 1px solid #9ca3af; font-size: 0.7rem; width: 100px; padding-top: 2px;">ACCOUNTANT</div></div>
            <div style="text-align: center;"><div style="font-size: 1rem; font-family: 'Dancing Script', cursive; margin-bottom: -5px; color: #444;">Munwar Das</div><div style="border-top: 1px solid #9ca3af; font-size: 0.7rem; width: 100px; padding-top: 2px;">PRINCIPAL</div></div>
        </div>

        <div class="modal-actions no-print" style="margin-top: 30px; display: flex; justify-content: center; gap: 15px;">
            <button onclick="document.getElementById('receipt-modal').classList.add('hidden')" class="btn-secondary">Close</button>
            <button onclick="window.print()" class="btn-primary">Print Receipt</button>
        </div>
    </div>`;
  document.getElementById("printable-receipt").innerHTML = receiptHTML;
  document.getElementById("receipt-modal").classList.remove("hidden");
}

function renderReports() {
  const txs = DB.get("mphs_tx") || [];
  const classSelect = document.getElementById("report-filter-class");
  if (classSelect && classSelect.children.length <= 1) {
    const classes = DB.get("mphs_classes") || [];
    classSelect.innerHTML = '<option value="">All Classes</option>';
    classes.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.name;
      opt.innerText = c.name;
      classSelect.appendChild(opt);
    });
  }
  const searchVal = document
    .getElementById("report-search")
    .value.toLowerCase();
  const classVal = document.getElementById("report-filter-class").value;
  const monthVal = document.getElementById("report-filter-month").value;

  const filteredTxs = txs.filter((t) => {
    const firstItem = t.items[0] || {};
    const studentName = (t.studentName || firstItem.name || "").toLowerCase();
    const receiptId = t.id.toLowerCase();
    const studentClass =
      t.className || t.studentClass || firstItem.className || "";
    const txDateObj = new Date(t.date);
    const txMonth = txDateObj.getMonth() + 1;
    return (
      (receiptId.includes(searchVal) || studentName.includes(searchVal)) &&
      (classVal === "" || studentClass === classVal) &&
      (monthVal === "" || txMonth.toString() === monthVal)
    );
  });

  filteredTxs.sort((a, b) => new Date(b.date) - new Date(a.date));
  const tbody = document.getElementById("reports-list-body");

  if (filteredTxs.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="7" style="text-align:center; padding:20px; color:#999;">No records found.</td></tr>';
    return;
  }

  tbody.innerHTML = filteredTxs
    .map((t) => {
      let displayName = t.items[0]
        ? t.items[0].name
        : t.studentName || "Unknown";
      if (t.items.length > 1)
        displayName += ` <span style="font-size:0.85em; color:#666; font-weight:normal;">(+ ${t.items.length - 1} others)</span>`;
      const uniqueClasses = [...new Set(t.items.map((i) => i.className))];
      const displayClass =
        uniqueClasses.length > 0 ? uniqueClasses[0] : t.className || "-";
      const uniqueMonths = [
        ...new Set(t.items.map((i) => i.month.split("-")[0])),
      ];
      const paidMonths = uniqueMonths.join(", ");
      return `<tr><td><span style="font-family:monospace; color:var(--text-muted);">${t.id}</span></td><td>${t.date.split("T")[0]}</td>
            <td style="font-weight:600; color:var(--primary);">${displayName}</td><td><span class="badge-paid" style="background:#f3f4f6; color:#4b5563; border:1px solid #e5e7eb; white-space: nowrap;">${displayClass}</span></td>
            <td style="font-size:0.9rem; max-width:150px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${paidMonths}"><span style="font-weight:600; color:#000;">${paidMonths}</span></td>
            <td style="font-weight:700; color:var(--success);">${t.total} PKR</td><td><button class="btn-sm" onclick="printReceipt('${t.id}')"><i class="fa-solid fa-eye"></i> View</button></td></tr>`;
    })
    .join("");
}

function resetReportFilters() {
  document.getElementById("report-search").value = "";
  document.getElementById("report-filter-class").value = "";
  document.getElementById("report-filter-month").value = "";
  renderReports();
}

function printReceipt(id) {
  const t = DB.get("mphs_tx").find((tx) => tx.id === id);
  if (t) showReceipt(t);
}

function renderUserList() {
  const users = DB.get("mphs_users");
  const currentUser = localStorage.getItem("mphs_user_name");
  document.getElementById("user-list-body").innerHTML = users
    .map((u) => {
      const isProtected = u.username.toLowerCase() === "jaswant";
      const isYou = u.username === currentUser;
      return `<tr><td style="font-weight:600;">${u.username} ${isYou ? "(You)" : ""}</td><td><span class="${u.role === "admin" ? "badge-paid" : "badge-unpaid"}" style="text-transform:uppercase;">${u.role}</span></td>
            <td>${isProtected ? '<small style="color:#9c27b0; font-weight:bold;">System Protected</small>' : isYou ? '<small style="color:#999; font-style:italic;">Current Session</small>' : `<button class="btn-sm" onclick="deleteUser('${u.username}')" style="color:var(--danger); border-color:var(--danger);"><i class="fa-solid fa-trash"></i></button>`}</td></tr>`;
    })
    .join("");
}

function handleAddUser() {
  const u = document.getElementById("new-u-name").value.trim();
  const p = document.getElementById("new-u-pass").value.trim();
  const r = document.getElementById("new-u-role").value;
  if (!u || !p) return showToast("Required!", "error");
  const users = DB.get("mphs_users");
  if (users.find((user) => user.username === u))
    return showToast("Exists!", "error");
  users.push({ username: u, password: p, role: r });
  DB.set("mphs_users", users);
  renderUserList();
  closeUserModal();
  showToast("Created!", "success");
}

function deleteUser(username) {
  if (confirm(`Delete user: ${username}?`)) {
    let users = DB.get("mphs_users").filter((u) => u.username !== username);
    DB.set("mphs_users", users);
    renderUserList();
    showToast("Deleted", "success");
  }
}

function backupData() {
  const data = JSON.stringify({
    students: DB.get("mphs_students"),
    tx: DB.get("mphs_tx"),
    users: DB.get("mphs_users"),
    subjects: DB.get("mphs_subjects"),
    marks: DB.get("mphs_marks"),
    certs: DB.get("mphs_certificates"),
  });
  const today = new Date();
  const dateString = `${String(today.getDate()).padStart(2, "0")}-${String(today.getMonth() + 1).padStart(2, "0")}-${today.getFullYear()}`;
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `MPHS_Backup_${dateString}.json`;
  a.click();
}

function restoreData(input) {
  if (input.files.length === 0) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (data.students) DB.set("mphs_students", data.students);
      if (data.tx) DB.set("mphs_tx", data.tx);
      if (data.users) DB.set("mphs_users", data.users);
      if (data.subjects) DB.set("mphs_subjects", data.subjects);
      if (data.marks) DB.set("mphs_marks", data.marks);
      if (data.certs) DB.set("mphs_certificates", data.certs);
      alert(
        "✅ Data Restored Successfully!\n\nClick OK to refresh the system.",
      );
      location.reload();
    } catch (err) {
      console.error(err);
      showToast("Error: Invalid Backup File!", "error");
    }
  };
  reader.readAsText(input.files[0]);
  input.value = "";
}

function showToast(msg, type) {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${msg}</span>`;
  document.getElementById("toast-box").appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function openUserModal() {
  document.getElementById("new-u-name").value = "";
  document.getElementById("new-u-pass").value = "";
  document.getElementById("new-u-role").value = "teacher";
  document.getElementById("user-modal").classList.remove("hidden");
}
function closeUserModal() {
  document.getElementById("user-modal").classList.add("hidden");
}

// PART 8: CERTIFICATES (FIXED)
function loadCertClasses() {
  const classSelect = document.getElementById("cert-class-select");
  if (!classSelect) return;
  const classes = DB.get("mphs_classes");
  classSelect.innerHTML = '<option value="">-- Select Class --</option>';
  classes.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c.name;
    opt.innerText = c.name;
    classSelect.appendChild(opt);
  });
}

function renderCertStudentList() {
  const cls = document.getElementById("cert-class-select").value;
  const studentSelect = document.getElementById("cert-student-select");
  studentSelect.innerHTML = '<option value="">-- Select Student --</option>';
  studentSelect.disabled = true;
  if (!cls) return;
  const students = DB.get("mphs_students").filter((s) => s.className === cls);
  if (students.length === 0) {
    studentSelect.innerHTML = '<option value="">No Students Found</option>';
    return;
  }
  studentSelect.disabled = false;
  students.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.innerText = `${s.name} (Roll: ${s.roll})`;
    studentSelect.appendChild(opt);
  });
}

function openCertForm() {
  const stdId = document.getElementById("cert-student-select").value;
  if (!stdId) return showToast("Please select a student first!", "error");
  const std = DB.get("mphs_students").find((s) => s.id === stdId);
  if (!std) return showToast("Student data not found.", "error");

  const workspace = document.getElementById("tab-certificates");
  workspace.innerHTML = `
  
        <div class="module-header">
            <button class="btn-secondary" onclick="location.reload()">
                <i class="fa-solid fa-arrow-left"></i> Back
            </button>
            <h2>Generate Certificate</h2>
        </div>
        <div class="form-card" style="max-width: 600px; margin: 0 auto;">
            <h3 style="margin-bottom: 20px; color: var(--primary);">Leaving Certificate Details</h3>
            <div class="form-grid" style="grid-template-columns: 1fr;">
                <div style="background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0;">
                    <p><strong>Name:</strong> ${std.name}</p>
                    <p><strong>Father Name:</strong> ${std.fatherName}</p>
                    <p><strong>Class:</strong> ${std.className}</p>
                </div>
                <div><label>Date of Birth (DOB): <span style="color:red">*</span></label><input type="date" id="slc-dob" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px;"></div>
                <div><label>Admission Date: <span style="color:red">*</span></label><input type="date" id="slc-adm-date" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px;"></div>
                <div><label>Reason for Leaving:</label><select id="slc-reason" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px;"><option value="Passed Out">Passed Out</option><option value="Domestic Problems">Domestic Problems</option><option value="Transfer">Transfer</option><option value="Other">Other</option></select></div>
                <div><label>Conduct:</label><select id="slc-conduct" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px;"><option value="Excellent">Excellent</option><option value="Good">Good</option><option value="Satisfactory">Satisfactory</option></select></div>
                <div style="margin-top: 20px;"><button class="btn-primary" onclick="printSLC('${std.id}')" style="width: 100%;"><i class="fa-solid fa-print"></i> Generate & Print SLC</button></div>
            </div>
        </div>
        <div class="section-divider"></div>
        <div class="module-header" style="margin-top:30px;">
            <h3>Issued Certificates History</h3>
            <button onclick="renderCertHistory(true)" class="btn-sm" style="background:none; border:none; color:var(--primary); cursor:pointer;"><i class="fa-solid fa-rotate"></i> Refresh</button>
        </div>
        <div class="table-container">
            <table class="data-table">
                <thead><tr><th>Date</th><th>Student Name</th><th>Father Name</th><th>Class</th><th>Type</th><th>Action</th></tr></thead>
                <tbody id="cert-history-body"></tbody>
            </table>
        </div>`;
  renderCertHistory();
}

function printSLC(stdId) {
  // picking elements
  const dobInput = document.getElementById("slc-dob");
  const admInput = document.getElementById("slc-adm-date");
  const reason = document.getElementById("slc-reason").value;
  const conduct = document.getElementById("slc-conduct").value;

  // picking values
  const dob = dobInput.value;
  const admDate = admInput.value;

  // Checking validation for date
  if (!dob) {
    return showToast(
      "Invalid DOB! (Check if date exists in calendar)",
      "error",
    );
  }
  if (!admDate) {
    return showToast("Invalid Admission Date! (Check if date exists)", "error");
  }

  // Check 2: Browser Validity Check
  if (!dobInput.checkValidity() || !admInput.checkValidity()) {
    return showToast(
      "Date is invalid! Please pick from Calendar icon.",
      "error",
    );
  }

  const std = DB.get("mphs_students").find((s) => s.id === stdId);

  // Duplicate Check
  const allCerts = JSON.parse(localStorage.getItem("mphs_certificates")) || [];
  const exists = allCerts.find((c) => c.stdId === stdId);
  if (exists) {
    return showToast(
      "SLC already issued for this student! Check History.",
      "error",
    );
  }

  const today = new Date().toLocaleDateString("en-GB");

  const certData = {
    id: "SLC-" + Date.now(),
    issueDate: today,
    stdId: std.id,
    name: std.name,
    father: std.fatherName,
    className: std.className,
    roll: std.roll,
    dob: dob,
    admDate: admDate,
    reason: reason,
    conduct: conduct,
  };

  allCerts.push(certData);
  localStorage.setItem("mphs_certificates", JSON.stringify(allCerts));

  showToast("Certificate Generated!", "success");
  renderCertHistory(); // Update Table

  // Clear inputs
  dobInput.value = "";
  admInput.value = "";

  // Show Print View
  showCertModal(certData);
}

function renderCertHistory(isRefreshClick = false) {
  const tbody = document.getElementById("cert-history-body");
  if (!tbody) return;

  if (isRefreshClick) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 40px; color: var(--primary);"><i class="fa-solid fa-circle-notch fa-spin fa-2x"></i><p style="margin-top: 10px; font-weight: 500; font-size: 0.9rem;">Updating list...</p></td></tr>`;
  }

  const delayTime = isRefreshClick ? 500 : 0;

  setTimeout(() => {
    const certs = JSON.parse(localStorage.getItem("mphs_certificates")) || [];
    if (certs.length === 0) {
      tbody.innerHTML =
        "<tr><td colspan='6' style='text-align:center; color:#999; padding:20px;'>No certificates issued yet.</td></tr>";
      return;
    }
    const sortedCerts = [...certs].reverse();
    tbody.innerHTML = sortedCerts
      .map(
        (c) => `
            <tr>
                <td>${c.issueDate}</td><td style="font-weight:600;">${c.name}</td><td>${c.father}</td><td>${c.className}</td><td><span class="badge-paid" style="background:#dcfce7; color:#166534;">SLC</span></td>
                <td>
                    <div style="display: flex; gap: 8px; justify-content: flex-end;">
                        <button class="btn-sm" onclick="reprintSLC('${c.id}')" title="View/Print" style="background:#eff6ff; color:#1d4ed8; border-color:#bfdbfe;"><i class="fa-solid fa-print"></i></button>
                        <button class="btn-sm" onclick="deleteCert('${c.id}')" style="color: #dc2626; border-color: #fecaca; background: #fef2f2;" title="Delete Record"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </td>
            </tr>`,
      )
      .join("");
    if (isRefreshClick) showToast("History Updated Successfully!", "success");
  }, delayTime);
}

function reprintSLC(certId) {
  const certs = JSON.parse(localStorage.getItem("mphs_certificates")) || [];
  const certData = certs.find((c) => c.id === certId);
  if (certData) showCertModal(certData);
  else showToast("Certificate data not found!", "error");
}

function deleteCert(certId) {
  if (confirm("Are you sure you want to delete this certificate record?")) {
    let certs = JSON.parse(localStorage.getItem("mphs_certificates")) || [];
    const newCerts = certs.filter((c) => c.id !== certId);
    localStorage.setItem("mphs_certificates", JSON.stringify(newCerts));
    renderCertHistory();
    showToast("Record Deleted", "success");
  }
}

function showCertModal(data) {
  let modal = document.getElementById("slc-modal");

  // Create Modal if missing
  if (!modal) {
    const modalTemplate = `
        <div id="slc-modal" class="modal-overlay hidden" style="align-items: flex-start; overflow-y: auto; padding: 20px 0; z-index: 9999;">
            <div class="receipt-card" style="width: 210mm; max-width: none; padding: 0; margin: 0 auto 50px auto; background: white;">
                <div id="printable-slc"></div>
                <div class="modal-actions no-print" style="margin-top: 30px; text-align: center; padding-bottom: 20px;">
                    <button onclick="document.getElementById('slc-modal').classList.add('hidden')" class="btn-secondary" style="margin-right:10px;">Close</button>
                    <button onclick="window.print()" class="btn-primary"><i class="fa-solid fa-print"></i> Print Certificate</button>
                </div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML("beforeend", modalTemplate);
    modal = document.getElementById("slc-modal");
  }

  const certContent = `
        <div id="certificate-border-box" style="border: 10px double #1e293b; padding: 40px; height: auto; min-height: 900px; position: relative; font-family: 'Times New Roman', serif; color: #000; background: white;">
            
            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); opacity: 0.05; font-size: 8rem; color: #000; z-index: 0; pointer-events: none;">
                <i class="fa-solid fa-graduation-cap"></i>
            </div>
            
            <div style="text-align: center; position: relative; z-index: 1;">
                <div style="font-size: 3.5rem; color: #1e293b; margin-bottom: 10px;"><i class="fa-solid fa-graduation-cap"></i></div>
                <h1 style="margin: 0; font-size: 2.5rem; text-transform: uppercase; color: #1e293b; font-weight: bold;">The Mehran Public School</h1>
                <p style="margin: 5px 0; font-size: 1.2rem; font-weight: bold; letter-spacing: 3px;">NAUKOT</p>
                <div style="margin-top: 30px; display: inline-block; border-bottom: 2px solid #1e293b; padding-bottom: 5px;">
                    <h2 style="margin: 0; text-transform: uppercase; font-size: 1.8rem; letter-spacing: 2px;">School Leaving Certificate</h2>
                </div>
            </div>

            <div style="margin-top: 50px; font-size: 1.25rem; line-height: 2; position: relative; z-index: 1;">
                <p style="text-align: justify;">This is to certify that Mr./Ms <span style="font-weight: bold; text-decoration: underline; text-transform: uppercase;">${data.name}</span>, Son/Daughter of <span style="font-weight: bold; text-decoration: underline; text-transform: uppercase;">${data.father}</span>, Roll No. <span style="font-weight: bold; text-decoration: underline;">${data.roll}</span>, has been a bona fide student of this institution.</p>
                
                <div style="margin: 30px 0; display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                    <div><strong>Class:</strong> <span style="border-bottom: 1px dotted #000; padding: 0 10px; font-weight:bold;">${data.className}</span></div>
                    <div><strong>DOB:</strong> <span style="border-bottom: 1px dotted #000; padding: 0 10px; font-weight:bold;">${data.dob}</span></div>
                    <div><strong>Admission:</strong> <span style="border-bottom: 1px dotted #000; padding: 0 10px; font-weight:bold;">${data.admDate}</span></div>
                    <div><strong>Issue Date:</strong> <span style="border-bottom: 1px dotted #000; padding: 0 10px; font-weight:bold;">${data.issueDate}</span></div>
                </div>
                
                <p>He/She leaves due to <span style="font-weight: bold; text-decoration: underline;">${data.reason}</span>. Character: <span style="font-weight: bold; text-decoration: underline;">${data.conduct}</span>.</p>
            </div>

            <div style="display: flex; justify-content: space-between; margin-top: 60px; align-items: flex-end; position: relative; z-index: 1;">
                <div style="text-align: center;">
                    <div style="border-top: 2px solid #1e293b; padding-top: 10px; width: 200px; font-weight: bold;">Class Teacher</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-family: 'Dancing Script', cursive; font-size: 1.5rem; color: #1e293b; margin-bottom: -10px;">Munwar Das</div>
                    <div style="border-top: 2px solid #1e293b; padding-top: 10px; width: 200px; font-weight: bold;">Principal</div>
                </div>
            </div>

            <div style="position: absolute; bottom: 5px; left: 0; width: 100%; text-align: center; font-size: 0.8rem; color: #999;">Generated by MPS Management System | ISO Certified</div>
        </div>`;

  document.getElementById("printable-slc").innerHTML = certContent;
  modal.classList.remove("hidden");
}

// PART 9, 10, 11: EXAM MANAGEMENT

function openSubjectModal() {
  const workspace = document.getElementById("result-workspace");
  const classes = DB.get("mphs_classes");
  workspace.innerHTML = `<div style="max-width: 600px; margin: 0 auto;"><div class="form-card"><h3 style="color: var(--primary); margin-bottom: 20px; border-bottom: 1px solid #eee; padding-bottom: 10px;"><i class="fa-solid fa-book"></i> Define Subjects</h3><div class="form-grid" style="grid-template-columns: 1fr;"><div><label style="font-weight: 600; color: #444;">Select Class:</label><select id="sub-class-select" onchange="renderSubjectList()" style="padding: 12px; border: 1px solid #ddd; border-radius: 6px; width: 100%; background: #fff;">${classes.map((c) => `<option value="${c.name}">${c.name}</option>`).join("")}</select></div><div style="background: #f8fafc; padding: 20px; border-radius: 10px; border: 1px solid #e2e8f0; margin-top: 10px;"><label style="font-weight:600; color: #334155; display: block; margin-bottom: 10px;">Add New Subject:</label><div style="display: flex; gap: 10px;"><input type="text" id="new-sub-name" placeholder="Subject (e.g. English)" style="flex: 2; padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px;"><input type="number" id="new-sub-total" placeholder="Marks" value="100" style="flex: 1; padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px;"><button class="btn-primary" onclick="addSubject()" style="padding: 0 20px;"><i class="fa-solid fa-plus"></i> Add</button></div></div><div style="margin-top: 10px;"><label style="font-weight: 600; color: #444; margin-bottom: 10px; display: block;">Current Subjects:</label><ul id="subject-list" style="list-style: none; padding: 0;"></ul></div></div></div></div>`;
  setTimeout(renderSubjectList, 100);
}

function renderSubjectList() {
  const cls = document.getElementById("sub-class-select").value;
  const allSubjects = JSON.parse(localStorage.getItem("mphs_subjects")) || {};
  const list = allSubjects[cls] || [];
  const listContainer = document.getElementById("subject-list");
  if (list.length === 0) {
    listContainer.innerHTML = `<li style="color: #94a3b8; text-align: center; padding: 20px; border: 2px dashed #e2e8f0; border-radius: 8px; background: #f8fafc;">No subjects added yet for ${cls}</li>`;
    return;
  }
  listContainer.innerHTML = list
    .map(
      (s, i) =>
        `<li style="display: flex; justify-content: space-between; align-items: center; background: white; padding: 12px 15px; margin-bottom: 10px; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.02);"><div style="display: flex; align-items: center; gap: 10px;"><span style="background: #e0f2fe; color: #0284c7; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-size: 0.8rem;"><i class="fa-solid fa-book-open"></i></span><div><strong style="color: #334155; font-size: 1rem;">${s.name}</strong><span style="background: #f1f5f9; color: #64748b; font-size: 0.75rem; padding: 2px 8px; border-radius: 12px; margin-left: 8px;">${s.total} Marks</span></div></div><button onclick="deleteSubject('${cls}', ${i})" style="background: #fee2e2; color: #dc2626; border: none; width: 32px; height: 32px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center;"><i class="fa-solid fa-trash-can" style="font-size: 0.9rem;"></i></button></li>`,
    )
    .join("");
}

function addSubject() {
  const cls = document.getElementById("sub-class-select").value;
  const name = toTitleCase(
    document.getElementById("new-sub-name").value.trim(),
  );
  const total = document.getElementById("new-sub-total").value;
  if (!name || !total) return;
  const all = JSON.parse(localStorage.getItem("mphs_subjects")) || {};
  if (!all[cls]) all[cls] = [];
  all[cls].push({ name, total: parseInt(total) });
  localStorage.setItem("mphs_subjects", JSON.stringify(all));
  document.getElementById("new-sub-name").value = "";
  renderSubjectList();
}

function deleteSubject(c, i) {
  if (confirm("Delete this subject?")) {
    const all = JSON.parse(localStorage.getItem("mphs_subjects"));
    all[c].splice(i, 1);
    localStorage.setItem("mphs_subjects", JSON.stringify(all));
    renderSubjectList();
  }
}

function openMarksEntry() {
  const workspace = document.getElementById("result-workspace");
  const classes = DB.get("mphs_classes");
  workspace.innerHTML = `<div style="max-width: 800px; margin: 0 auto;"><div class="form-card"><h3 style="color: var(--primary); margin-bottom: 20px; border-bottom: 1px solid #eee; padding-bottom: 10px;"><i class="fa-solid fa-pen-to-square"></i> Enter Student Marks</h3><div style="display: flex; gap: 20px; flex-wrap: wrap; align-items: flex-end;"><div style="flex: 1; min-width: 200px;"><label style="font-weight: 600; color: #444; margin-bottom: 8px; display: block;">Select Class:</label><select id="marks-class-select" style="padding: 12px; border: 1px solid #ddd; border-radius: 6px; width: 100%; background: #fff;">${classes.map((c) => `<option value="${c.name}">${c.name}</option>`).join("")}</select></div><div style="flex: 1; min-width: 200px;"><label style="font-weight: 600; color: #444; margin-bottom: 8px; display: block;">Exam Name:</label><input type="text" id="exam-name" placeholder="e.g. Annual Exam 2026" style="padding: 12px; border: 1px solid #ddd; border-radius: 6px; width: 100%;"></div><div style="flex: 0 0 auto;"><button class="btn-primary" onclick="loadMarksSheet()" style="padding: 12px 25px; height: 45px;"><i class="fa-solid fa-table"></i> Load Sheet</button></div></div><div id="marks-sheet-container" style="margin-top: 30px;"><p style="text-align: center; color: #94a3b8; padding: 40px; border: 2px dashed #e2e8f0; border-radius: 10px;">Select Class and Exam Name to load student list.</p></div></div></div>`;
}

function loadMarksSheet() {
  const cls = document.getElementById("marks-class-select").value;
  const exam = document.getElementById("exam-name").value.trim();
  if (!exam) return showToast("Please enter Exam Name!", "error");
  const students = DB.get("mphs_students").filter((s) => s.className === cls);
  const allSubjects = JSON.parse(localStorage.getItem("mphs_subjects")) || {};
  const subjects = allSubjects[cls] || [];
  const container = document.getElementById("marks-sheet-container");
  if (students.length === 0) {
    container.innerHTML = `<div style="text-align: center; padding: 40px; color: #ef4444; background: #fef2f2; border: 1px dashed #fca5a5; border-radius: 8px;">No students found in <strong>${cls}</strong>.</div>`;
    return;
  }
  if (subjects.length === 0) {
    container.innerHTML = `<div style="text-align: center; padding: 40px; color: #f59e0b; background: #fffbeb; border: 1px dashed #fcd34d; border-radius: 8px;">No subjects defined for <strong>${cls}</strong>.</div>`;
    return;
  }
  const savedMarksDB = JSON.parse(localStorage.getItem("mphs_marks")) || [];
  let html = `<div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); overflow: hidden; margin-top: 20px;"><div style="overflow-x: auto;"><table style="width: 100%; border-collapse: collapse; min-width: 600px;"><thead><tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;"><th style="padding: 15px 20px; text-align: left; color: #475569; font-weight: 600; font-size: 0.9rem; width: 50px;">Roll</th><th style="padding: 15px 20px; text-align: left; color: #475569; font-weight: 600; font-size: 0.9rem; min-width: 150px;">Student Name</th>${subjects.map((sub) => `<th style="padding: 15px 10px; text-align: center; color: #475569; font-weight: 600; font-size: 0.9rem;">${sub.name} <br> <span style="font-size: 0.75rem; color: #94a3b8; font-weight: normal;">(Max: ${sub.total})</span></th>`).join("")}</tr></thead><tbody>`;
  html += students
    .map((std, index) => {
      const existingRecord = savedMarksDB.find(
        (r) => r.studentId === std.id && r.exam === exam,
      );
      const marksObj = existingRecord ? existingRecord.marks : {};
      const inputs = subjects
        .map((sub) => {
          const val = marksObj[sub.name] || "";
          return `<td style="padding: 10px; text-align: center;"><input type="number" class="mark-input" data-std="${std.id}" data-sub="${sub.name}" data-max="${sub.total}" value="${val}" placeholder="-" style="width: 70px; padding: 8px; text-align: center; border: 1px solid #cbd5e1; border-radius: 6px; font-weight: 600; color: #334155;"></td>`;
        })
        .join("");
      return `<tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 15px 20px; color: #64748b; font-weight: 500;">${std.roll}</td><td style="padding: 15px 20px; color: #1e293b; font-weight: 600;">${std.name}</td>${inputs}</tr>`;
    })
    .join("");
  html += `</tbody></table></div><div style="padding: 20px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: right;"><button class="btn-success" onclick="saveAllMarks()" style="padding: 12px 30px; font-size: 1rem; border-radius: 8px;"><i class="fa-solid fa-floppy-disk"></i> Save Results</button></div></div>`;
  container.innerHTML = html;
}

function saveAllMarks() {
  const exam = document.getElementById("exam-name").value;
  const cls = document.getElementById("marks-class-select").value;
  let db = JSON.parse(localStorage.getItem("mphs_marks")) || [];
  document.querySelectorAll(".mark-input").forEach((i) => {
    const sid = i.dataset.std;
    const sub = i.dataset.sub;
    const val = i.value;
    if (val !== "") {
      let r = db.find((x) => x.studentId === sid && x.exam === exam);
      if (!r) {
        r = { studentId: sid, exam: exam, class: cls, marks: {} };
        db.push(r);
      }
      r.marks[sub] = parseInt(val);
    }
  });
  localStorage.setItem("mphs_marks", JSON.stringify(db));
  showToast("Saved", "success");
}

function openResultView() {
  const workspace = document.getElementById("result-workspace");
  const classes = DB.get("mphs_classes");

  // UI Render
  workspace.innerHTML = `
        <div style="max-width: 800px; margin: 0 auto;">
            <div class="form-card">
                <h3 style="color: var(--primary); margin-bottom: 20px; border-bottom: 1px solid #eee; padding-bottom: 10px;">
                    <i class="fa-solid fa-print"></i> Generate Result Cards
                </h3>
                <div style="display: flex; gap: 20px; flex-wrap: wrap; align-items: flex-end;">
                    <div style="flex: 1; min-width: 200px;">
                        <label style="font-weight: 600; color: #444; margin-bottom: 8px; display: block;">Select Class:</label>
                        <select id="res-class-select" style="padding: 12px; border: 1px solid #ddd; border-radius: 6px; width: 100%; background: #fff;">
                            ${classes.map((c) => `<option value="${c.name}">${c.name}</option>`).join("")}
                        </select>
                    </div>
                    <div style="flex: 1; min-width: 200px;">
                        <label style="font-weight: 600; color: #444; margin-bottom: 8px; display: block;">Exam Name:</label>
                        <input type="text" id="res-exam-name" placeholder="e.g. Final Term 2026" style="padding: 12px; border: 1px solid #ddd; border-radius: 6px; width: 100%;">
                    </div>
                    <div style="flex: 0 0 auto;">
                        <button class="btn-primary" onclick="findResults()" style="padding: 12px 25px; height: 45px;">
                            <i class="fa-solid fa-list-check"></i> Show List
                        </button>
                    </div>
                </div>
                <div id="result-list-container" style="margin-top: 30px;">
                    <p style="text-align: center; color: #94a3b8; padding: 40px; border: 2px dashed #e2e8f0; border-radius: 10px;">
                        Select Class & Exam to view available result cards.
                    </p>
                </div>
            </div>
        </div>
    `;

  // changing width from fix to 100%
  if (!document.getElementById("marksheet-modal")) {
    const modalHTML = `
        <div id="marksheet-modal" class="modal-overlay hidden" style="align-items: flex-start; overflow-y: auto; padding: 20px 0; z-index: 9999;">
            <div class="receipt-card" style="width: 100%; max-width: 800px; min-height: auto; padding: 20px; margin: 0 auto 50px auto; background: white;">
                <div id="printable-marksheet"></div>
                <div class="modal-actions no-print" style="margin-top: 30px; text-align: center; padding-bottom: 20px;">
                    <button onclick="document.getElementById('marksheet-modal').classList.add('hidden')" class="btn-secondary">Close</button>
                    <button onclick="window.print()" class="btn-primary">Print Result</button>
                </div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML("beforeend", modalHTML);
  }
}

function findResults() {
  const cls = document.getElementById("res-class-select").value;
  const exam = document.getElementById("res-exam-name").value.trim();
  if (!exam) return showToast("Enter Exam Name", "error");
  const students = DB.get("mphs_students").filter((s) => s.className === cls);
  const marksDB = JSON.parse(localStorage.getItem("mphs_marks")) || [];
  const subjects =
    (JSON.parse(localStorage.getItem("mphs_subjects")) || {})[cls] || [];
  const container = document.getElementById("result-list-container");
  if (students.length === 0) {
    container.innerHTML = `<div style="text-align: center; padding: 30px; background: #fef2f2; color: #dc2626; border-radius: 8px;">No students found in ${cls}.</div>`;
    return;
  }
  if (subjects.length === 0) {
    container.innerHTML = `<div style="text-align: center; padding: 30px; background: #fffbeb; color: #d97706; border-radius: 8px;">No subjects defined for ${cls}.</div>`;
    return;
  }
  let html = `<div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); overflow: hidden;"><table style="width: 100%; border-collapse: collapse;"><thead><tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;"><th style="padding: 15px 20px; text-align: left; color: #475569; font-weight: 600;">Roll</th><th style="padding: 15px 20px; text-align: left; color: #475569; font-weight: 600;">Student Name</th><th style="padding: 15px 20px; text-align: center; color: #475569; font-weight: 600;">Percentage</th><th style="padding: 15px 20px; text-align: center; color: #475569; font-weight: 600;">Grade</th><th style="padding: 15px 20px; text-align: right; color: #475569; font-weight: 600;">Action</th></tr></thead><tbody>`;
  html += students
    .map((std) => {
      const record = marksDB.find(
        (r) => r.studentId === std.id && r.exam === exam,
      );
      let obtained = 0;
      let totalMax = 0;
      subjects.forEach((sub) => {
        totalMax += sub.total;
        if (record && record.marks[sub.name])
          obtained += record.marks[sub.name];
      });
      const per =
        totalMax > 0 ? ((obtained / totalMax) * 100).toFixed(2) : "0.00";
      const grade = calculateGrade(per);
      return `<tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 15px 20px;">${std.roll}</td><td style="padding: 15px 20px; font-weight: 600; color: #334155;">${std.name}</td><td style="padding: 15px 20px; text-align: center; font-weight: 700; color: #334155;">${per}%</td><td style="padding: 15px 20px; text-align: center;"><span style="background: ${per >= 33 ? "#dcfce7" : "#fee2e2"}; color: ${per >= 33 ? "#166534" : "#991b1b"}; padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 600; min-width: 40px; display: inline-block;">${grade}</span></td><td style="padding: 15px 20px; text-align: right;"><button class="btn-sm" onclick="viewMarksheet('${std.id}', '${exam}')" style="background: #e0f2fe; color: #0369a1; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer;" onmouseover="this.style.background='#bae6fd'" onmouseout="this.style.background='#e0f2fe'"><i class="fa-solid fa-print"></i> Print</button></td></tr>`;
    })
    .join("");
  html += `</tbody></table></div>`;
  document.getElementById("result-list-container").innerHTML = html;
}

function calculateGrade(per) {
  if (per >= 80) return "A+";
  if (per >= 70) return "A";
  if (per >= 60) return "B";
  if (per >= 50) return "C";
  if (per >= 40) return "D";
  return "Fail";
}

function viewMarksheet(stdId, exam) {
  const std = DB.get("mphs_students").find((s) => s.id === stdId);
  const marksDB = JSON.parse(localStorage.getItem("mphs_marks")) || [];
  const record = marksDB.find((r) => r.studentId === stdId && r.exam === exam);
  const subjects =
    (JSON.parse(localStorage.getItem("mphs_subjects")) || {})[std.className] ||
    [];

  let rows = "";
  let grandTotal = 0;
  let grandObtained = 0;

  subjects.forEach((sub) => {
    const obt = record && record.marks[sub.name] ? record.marks[sub.name] : 0;
    grandTotal += sub.total;
    grandObtained += obt;
    const passMarks = Math.ceil(sub.total * 0.33);
    const status = obt >= passMarks ? "Pass" : "Fail";
    rows += `<tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 10px; text-align: left;">${sub.name}</td>
            <td style="text-align: center;">${sub.total}</td>
            <td style="text-align: center; color: #666;">${passMarks}</td> 
            <td style="text-align: center; font-weight: bold;">${obt}</td>
            <td style="text-align: center; font-size: 0.9rem; color:${status === "Pass" ? "green" : "red"}; font-weight:600;">${status}</td>
        </tr>`;
  });

  const per =
    grandTotal > 0 ? ((grandObtained / grandTotal) * 100).toFixed(2) : 0;
  const grade = calculateGrade(per);
  const finalStatus = per >= 33 ? "PASS" : "FAIL";

  // fixing border or adjusting width
  const sheetHTML = `
        <div style="border: 4px double #1e293b; padding: 25px; width: 100%; position: relative; background: white;">
            
            <div style="text-align: center; margin-bottom: 25px;">
                <div style="font-size: 2.5rem; color: #1e293b; margin-bottom: 5px;"><i class="fa-solid fa-graduation-cap"></i></div>
                <h1 style="margin: 0; font-size: 2rem; text-transform: uppercase; color: #1e293b; font-weight: 800;">The Mehran Public School</h1>
                <p style="margin: 2px 0; letter-spacing: 3px; font-weight: 600;">NAUKOT</p>
                <div style="margin-top: 15px; border-top: 2px solid #1e293b; border-bottom: 2px solid #1e293b; padding: 5px 0; background: #f8fafc;">
                    <h2 style="margin: 0; text-transform: uppercase; font-size: 1.3rem;">${exam}</h2>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px 30px; margin-bottom: 25px; font-size: 1rem;">
                <div style="display:flex; border-bottom: 1px dotted #000; padding-bottom: 2px;"><strong style="width: 120px;">Student Name:</strong> <span style="font-weight: 600; color: #1e293b; text-transform: uppercase;">${std.name}</span></div>
                <div style="display:flex; border-bottom: 1px dotted #000; padding-bottom: 2px;"><strong style="width: 120px;">Father Name:</strong> <span style="font-weight: 600; color: #1e293b; text-transform: uppercase;">${std.fatherName}</span></div>
                <div style="display:flex; border-bottom: 1px dotted #000; padding-bottom: 2px;"><strong style="width: 120px;">Class:</strong> <span style="font-weight: 600;">${std.className}</span></div>
                <div style="display:flex; border-bottom: 1px dotted #000; padding-bottom: 2px;"><strong style="width: 120px;">Roll No:</strong> <span style="font-weight: 600;">${std.roll}</span></div>
            </div>

            <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; border: 1px solid #1e293b;">
                <thead><tr style="background: #1e293b; color: white;"><th style="padding: 10px; text-align: left; width: 35%;">SUBJECTS</th><th style="padding: 10px;">MAX MARKS</th><th style="padding: 10px;">PASS MARKS</th> <th style="padding: 10px;">OBTAINED</th><th style="padding: 10px;">RESULT</th></tr></thead>
                <tbody>${rows}</tbody>
                <tfoot><tr style="background: #e2e8f0; font-weight: bold; border-top: 2px solid #1e293b;"><td style="padding: 10px;">GRAND TOTAL</td><td style="padding: 10px; text-align: center;">${grandTotal}</td><td style="padding: 10px; text-align: center;">-</td><td style="padding: 10px; text-align: center; font-size: 1.1rem;">${grandObtained}</td><td></td></tr></tfoot>
            </table>

            <div style="display: flex; justify-content: space-between; gap: 15px; margin-bottom: 40px;">
                <div style="flex:1; text-align: center; border: 1px solid #ccc; padding: 10px; border-radius: 8px;"><div style="font-size: 0.8rem; color: #666; margin-bottom: 2px;">PERCENTAGE</div><div style="font-size: 1.5rem; font-weight: 800; color: var(--primary);">${per}%</div></div>
                <div style="flex:1; text-align: center; border: 1px solid #ccc; padding: 10px; border-radius: 8px;"><div style="font-size: 0.8rem; color: #666; margin-bottom: 2px;">GRADE</div><div style="font-size: 1.5rem; font-weight: 800; color: var(--accent);">${grade}</div></div>
                <div style="flex:1; text-align: center; border: 1px solid #ccc; padding: 10px; border-radius: 8px;"><div style="font-size: 0.8rem; color: #666; margin-bottom: 2px;">STATUS</div><div style="font-size: 1.5rem; font-weight: 800; color: ${per >= 33 ? "green" : "red"};">${finalStatus}</div></div>
            </div>

            <div style="display: flex; justify-content: space-between; padding: 0 30px; margin-top: 30px;">
                <div style="text-align: center;"><div style="margin-bottom: 5px; height: 30px;"></div> <div style="border-top: 2px solid #000; padding-top: 5px; width: 150px; font-weight: 600; font-size: 0.9rem;">CLASS TEACHER</div></div>
                <div style="text-align: center;"><div style="font-family: 'Dancing Script', cursive; font-size: 1.4rem; color: #1e293b; margin-bottom: -8px;">Munwar Das</div><div style="border-top: 2px solid #000; padding-top: 5px; width: 150px; font-weight: 600; font-size: 0.9rem;">PRINCIPAL</div></div>
            </div>

            <div style="text-align: center; margin-top: 20px; font-size: 0.7rem; color: #999;">Marksheet is generated by MPS Management System</div>
        </div>`;

  document.getElementById("printable-marksheet").innerHTML = sheetHTML;
  document.getElementById("marksheet-modal").classList.remove("hidden");
}

// sending receipt to whatsapp
function sendWhatsAppReceipt(studentId, amount, month) {
  const students = JSON.parse(localStorage.getItem("mphs_students")) || [];
  const student = students.find((s) => s.id === studentId);
  if (!student) return alert("❌ Error: Student data not found for WhatsApp!");
  let phone = student.contact;
  if (!phone || phone.length < 10 || phone === "-" || !/^\d+$/.test(phone))
    return alert(
      `⚠️ WhatsApp Error: Invalid number for ${student.name}!\nPlease check Student details.`,
    );
  if (phone.startsWith("0")) phone = "92" + phone.substring(1);
  let msg =
    `*🧾 FEE RECEIPT - DIGITAL COPY*\n` +
    `------------------------------------\n` +
    `🏫 *The Mehran Public School*\n` +
    `📍 Naukot\n` +
    `------------------------------------\n\n` +
    `👤 *Student Details:*\n` +
    `Name: *${student.name}*\n` +
    `Father: ${student.fatherName}\n` +
    `Class: ${student.className}\n\n` +
    `💰 *Payment Details:*\n` +
    `Month(s): ${month}\n` +
    `Amount Paid: *Rs. ${amount}*\n` +
    `Date: ${new Date().toLocaleDateString()}\n` +
    `------------------------------------\n` +
    `✅ *Status: RECEIVED*\n` +
    `------------------------------------\n` +
    `_This is an automated system generated message._\n` +
    `Regards: Munwar Das Principal of MPS`;
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  window.open(url, "_blank");
}

function updateAlertStats() {
  const students = JSON.parse(localStorage.getItem("mphs_students")) || [];
  const transactions = JSON.parse(localStorage.getItem("mphs_tx")) || [];

  console.log("Total Students Found:", students.length);
  console.log("Total Transactions Found:", transactions.length);

  const date = new Date();
  const currentMonthName = date.toLocaleString("default", { month: "long" });
  const currentYear = date.getFullYear();
  const targetMonthString = `${currentMonthName}-${currentYear}`;
  console.log("Checking Status For:", targetMonthString);

  let paidCount = 0;

  // 3. Counting Logic
  students.forEach((student) => {
    const hasPaid = transactions.some(
      (tx) =>
        tx.items &&
        tx.items.some(
          (item) => item.id == student.id && item.month === targetMonthString,
        ),
    );

    if (hasPaid) {
      paidCount++;
    }
  });

  // 4. Unpaid Calculation
  const unpaidCount = students.length - paidCount;

  console.log("Final Count -> Paid:", paidCount, "Unpaid:", unpaidCount);

  // 5. HTML Elements Update
  const paidEl = document.getElementById("stat-paid-count");
  const unpaidEl = document.getElementById("stat-unpaid-count");

  if (paidEl) paidEl.innerText = paidCount;
  if (unpaidEl) unpaidEl.innerText = unpaidCount;
}

// on page loading will refresh
document.addEventListener("DOMContentLoaded", () => {
  updateAlertStats();
});
