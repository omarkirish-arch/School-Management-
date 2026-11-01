const API_BASE_URL = 'http://localhost:3000/api';

let dbTeachers = [];
let dbSubjects = [];
let dbStudents = [];
let dbAttendance = {};
let dbSchedules = {};
let dbFees = [];
let dbGrades = [];
let currentTab = 'subjects';
let autoRefreshInterval = null;

function formatClassName(formStr) {
    if (!formStr) return '-';
    const s = String(formStr).toLowerCase().trim();
    if (s === 'class1' || s === '1') return 'Fasalka 1-aad';
    if (s === 'class2' || s === '2') return 'Fasalka 2-aad';
    if (s === 'class3' || s === '3') return 'Fasalka 3-aad';
    if (s === 'class4' || s === '4') return 'Fasalka 4-aad';
    if (s === 'class5' || s === '5') return 'Fasalka 5-aad';
    if (s === 'class6' || s === '6') return 'Fasalka 6-aad';
    if (s === 'class7' || s === '7') return 'Fasalka 7-aad';
    if (s === 'class8' || s === '8') return 'Fasalka 8-aad';
    if (s === 'form1' || s === 'class9' || s === '9') return 'Fasalka 9-aad';
    if (s === 'form2' || s === 'class10' || s === '10') return 'Fasalka 10-aad';
    if (s === 'form3' || s === 'class11' || s === '11') return 'Fasalka 11-aad';
    if (s === 'form4' || s === 'class12' || s === '12') return 'Fasalka 12-aad';
    const num = s.replace(/[^0-9]/g, '');
    return num ? `Fasalka ${num}-aad` : formStr;
}

// Auth helper: get authorization headers for API requests
function getAuthHeaders() {
    const token = localStorage.getItem('admin_token');
    return {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
    };
}

// Handle API error status codes (e.g. 401/403)
function handleAuthError(res) {
    if (res.status === 401 || res.status === 403) {
        showToast("⚠️ Token-kaagu wuu dhacay ama waa mid aan habboonayn. Fadlan dib u soo gal.");
        logoutAdmin();
        return true;
    }
    return false;
}

// Load data from API with cache-busting timestamp
async function loadAllData() {
    try {
        const timestamp = Date.now();
        const [teachersRes, subjectsRes, studentsRes] = await Promise.all([
            fetch(`${API_BASE_URL}/teachers?_t=${timestamp}`),
            fetch(`${API_BASE_URL}/subjects?_t=${timestamp}`),
            fetch(`${API_BASE_URL}/students?_t=${timestamp}`)
        ]);
        if (teachersRes.ok) dbTeachers = await teachersRes.json();
        if (subjectsRes.ok) dbSubjects = await subjectsRes.json();
        if (studentsRes.ok) dbStudents = await studentsRes.json();
    } catch (err) {
        console.error("Error loading data from API:", err);
    }
}

// Toast notification helper
function showToast(msg) {
    let toast = document.getElementById('admin-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'admin-toast';
        toast.style.cssText = 'position: fixed; bottom: 20px; right: 20px; background: #10B981; color: white; padding: 12px 20px; border-radius: 8px; font-weight: 500; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 9999; transition: opacity 0.3s;';
        document.body.appendChild(toast);
    }
    toast.innerText = msg;
    toast.style.opacity = '1';
    setTimeout(() => { toast.style.opacity = '0'; }, 3500);
}

// Manual refresh button click
async function manualRefreshData() {
    const btn = document.querySelector('button[onclick="manualRefreshData()"]');
    let icon = null;
    if (btn) {
        icon = btn.querySelector('i');
        if (icon) icon.classList.add('fa-spin');
    }

    await loadAllData();
    refreshActiveView();
    updateDashboardStats();

    if (icon) {
        setTimeout(() => icon.classList.remove('fa-spin'), 600);
    }
    showToast("✅ Xogta DB waa la soo cusboonaysiiyay!");
}

function refreshActiveView(isAutoRefresh = false) {
    if (currentTab === 'teachers') renderTeachersTable();
    else if (currentTab === 'students') renderStudentsTable();
    else if (currentTab === 'attendance') loadAttendance();
    else if (currentTab === 'schedule') {
        if (!isAutoRefresh) loadScheduleBuilder();
    }
    else if (currentTab === 'fees') {
        loadFeesData();
        populateStudentFeeSelect();
    }
    else if (currentTab === 'grades') {
        loadGradesData();
        populateGradeSelects();
    }
    else renderAdminTable();
}

// Switch between tabs
async function switchTab(tabId) {
    currentTab = tabId;

    const views = ['subjects', 'teachers', 'students', 'attendance', 'schedule', 'fees', 'grades', 'settings'];
    views.forEach(v => {
        const viewEl = document.getElementById('view-' + v);
        if (viewEl) viewEl.style.display = 'none';
        const navEl = document.getElementById('nav-' + v);
        if (navEl) navEl.classList.remove('active');
    });

    const activeView = document.getElementById('view-' + tabId);
    if (activeView) {
        activeView.style.display = (tabId === 'attendance' || tabId === 'schedule' || tabId === 'fees' || tabId === 'grades' || tabId === 'settings') ? 'block' : 'grid';
    }

    const activeNav = document.getElementById('nav-' + tabId);
    if (activeNav) {
        activeNav.classList.add('active');
    }

    if (tabId === 'settings') {
        loadAdminSettings();
        return;
    }

    await loadAllData();
    if (tabId === 'fees') {
        await loadFeesData();
        populateStudentFeeSelect();
    } else if (tabId === 'grades') {
        await loadGradesData();
        populateGradeSelects();
    } else {
        refreshActiveView();
    }
}

// Toggle password visibility in admin settings form
function toggleSettingsPassVisibility() {
    const passInput = document.getElementById('settings-admin-pass');
    const eyeIcon = document.getElementById('settings-pass-eye');
    if (!passInput) return;
    if (passInput.type === 'password') {
        passInput.type = 'text';
        if (eyeIcon) {
            eyeIcon.classList.remove('fa-eye');
            eyeIcon.classList.add('fa-eye-slash');
            eyeIcon.style.color = 'var(--primary)';
        }
    } else {
        passInput.type = 'password';
        if (eyeIcon) {
            eyeIcon.classList.remove('fa-eye-slash');
            eyeIcon.classList.add('fa-eye');
            eyeIcon.style.color = '#9CA3AF';
        }
    }
}

// Load current admin username into settings form
async function loadAdminSettings() {
    try {
        const res = await fetch(`${API_BASE_URL}/admin/profile`, {
            headers: getAuthHeaders()
        });
        if (handleAuthError(res)) return;
        if (res.ok) {
            const data = await res.json();
            const userEl = document.getElementById('settings-admin-user');
            if (userEl) userEl.value = data.username || 'admin';
        }
    } catch (e) {
        console.warn('Could not load admin profile:', e);
    }
}

// Save updated admin username & password
async function saveAdminSettings() {
    const userVal = document.getElementById('settings-admin-user')?.value.trim();
    const passVal = document.getElementById('settings-admin-pass')?.value.trim();

    if (!userVal || !passVal) {
        alert("Fadlan qor Username iyo Password cusub labadaba!");
        return;
    }

    try {
        const res = await fetch(`${API_BASE_URL}/admin/profile`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ username: userVal, password: passVal })
        });
        if (handleAuthError(res)) return;
        const data = await res.json();
        if (res.ok) {
            showToast("✅ " + (data.message || "Xogta maamulka waa la cusbooneysiiyay!"));
            const passEl = document.getElementById('settings-admin-pass');
            if (passEl) passEl.value = '';
        } else {
            alert(data.error || "Khalad ayaa dhacay!");
        }
    } catch (err) {
        console.error("Error updating admin settings:", err);
        alert("Xiriirka server-ka ayaa ciladoobay.");
    }
}

// Toggle password visibility in admin login
function toggleAdminPassVisibility() {
    const passInput = document.getElementById('admin-pass');
    const eyeIcon = document.getElementById('admin-pass-eye');
    if (!passInput) return;
    if (passInput.type === 'password') {
        passInput.type = 'text';
        if (eyeIcon) {
            eyeIcon.classList.remove('fa-eye');
            eyeIcon.classList.add('fa-eye-slash');
            eyeIcon.style.color = 'var(--primary)';
        }
    } else {
        passInput.type = 'password';
        if (eyeIcon) {
            eyeIcon.classList.remove('fa-eye-slash');
            eyeIcon.classList.add('fa-eye');
            eyeIcon.style.color = '#9CA3AF';
        }
    }
}

// Secure Login logic using JWT API endpoint
async function loginAdmin() {
    const userInput = (document.getElementById('admin-user')?.value || 'admin').trim();
    const passInput = (document.getElementById('admin-pass')?.value || '').trim();
    const errorEl = document.getElementById('error-msg');

    if (!passInput) {
        if (errorEl) {
            errorEl.innerText = "Fadlan geli Password-ka!";
            errorEl.style.display = 'block';
        }
        return;
    }

    try {
        const res = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: userInput, password: passInput })
        });

        const data = await res.json();

        if (res.ok && data.token) {
            localStorage.setItem('admin_token', data.token);
            if (errorEl) errorEl.style.display = 'none';

            document.getElementById('login-section').style.display = 'none';
            document.getElementById('admin-panel').style.display = 'flex';
            
            try {
                await loadAllData();
                renderAdminTable();
                renderTeachersTable();
                populateTeacherSelect();
                updateDashboardStats();

                // Auto-refresh every 5 seconds
                if (!autoRefreshInterval) {
                    autoRefreshInterval = setInterval(async () => {
                        await loadAllData();
                        refreshActiveView(true);
                        updateDashboardStats();
                    }, 5000);
                }
            } catch (renderErr) {
                console.error("Error updating dashboard data after login:", renderErr);
            }
            showToast("🔑 Waad soo gashay (JWT Authenticated)!");
        } else {
            if (errorEl) {
                errorEl.innerText = data.error || 'Password-ka ama Magaca waa khalad!';
                errorEl.style.display = 'block';
            }
        }
    } catch (err) {
        console.error("Login request failed:", err);
        if (errorEl) {
            errorEl.innerText = 'Server error connection failed!';
            errorEl.style.display = 'block';
        }
    }
}

// Logout logic
function logoutAdmin() {
    localStorage.removeItem('admin_token');
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
    }
    document.getElementById('admin-panel').style.display = 'none';
    document.getElementById('login-section').style.display = 'flex';
    const passEl = document.getElementById('admin-pass');
    if (passEl) passEl.value = '';
}

// Check session on startup
document.addEventListener('DOMContentLoaded', async () => {
    initAdminDarkMode();
    const token = localStorage.getItem('admin_token');
    if (token) {
        try {
            const res = await fetch(`${API_BASE_URL}/verify-token`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                document.getElementById('login-section').style.display = 'none';
                document.getElementById('admin-panel').style.display = 'flex';
                await loadAllData();
                renderAdminTable();
                renderTeachersTable();
                populateTeacherSelect();
                updateDashboardStats();

                if (!autoRefreshInterval) {
                    autoRefreshInterval = setInterval(async () => {
                        await loadAllData();
                        refreshActiveView(true);
                        updateDashboardStats();
                    }, 5000);
                }
            } else {
                logoutAdmin();
            }
        } catch (e) {
            console.warn("Could not verify token on load:", e);
        }
    }
});

// File Upload variables
let selectedTeacherBase64 = '';
const fileInput = document.getElementById('teacher-img');
const uploadText = document.getElementById('upload-text');

if (fileInput) {
    fileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if(!file) return;

        const reader = new FileReader();
        reader.onload = function(event) {
            selectedTeacherBase64 = event.target.result;
            if (uploadText) {
                uploadText.innerText = "Sawirka waa la doortay! ✅";
                uploadText.style.color = "var(--secondary)";
            }
        };
        reader.readAsDataURL(file);
    });
}

// Auto-suggest username as admin types teacher's name
const teacherNameInput = document.getElementById('teacher-name');
const teacherUnameInput = document.getElementById('teacher-username');
if (teacherNameInput && teacherUnameInput) {
    teacherNameInput.addEventListener('input', function() {
        if (!teacherUnameInput.dataset.touched) {
            const words = this.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
            if (words.length > 0) {
                const suggestion = words[words.length - 1].replace(/[^a-z0-9]/g, '');
                teacherUnameInput.value = suggestion;
            } else {
                teacherUnameInput.value = '';
            }
        }
    });
    teacherUnameInput.addEventListener('input', function() {
        if (this.value.trim() !== '') {
            this.dataset.touched = 'true';
        } else {
            delete this.dataset.touched;
        }
    });
}

// Add teacher form
document.getElementById('add-teacher-form')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    const name = document.getElementById('teacher-name').value.trim();
    const username = document.getElementById('teacher-username')?.value.trim() || name.toLowerCase().replace(/\s+/g, '_');
    const password = document.getElementById('teacher-password')?.value.trim() || 'teacher123';
    const imgData = selectedTeacherBase64 || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;

    const newTeacher = {
        id: 't_' + Date.now(),
        name: name,
        username: username,
        password: password,
        img: imgData
    };

    try {
        const res = await fetch(`${API_BASE_URL}/teachers`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(newTeacher)
        });
        if (handleAuthError(res)) return;
        if (res.ok) {
            await loadAllData();
            renderTeachersTable();
            populateTeacherSelect();
            updateDashboardStats();
            this.reset();
            selectedTeacherBase64 = '';
            if (uploadText) {
                uploadText.innerText = "Guji halkan si aad u doorato sawirka (.jpg, .png)";
                uploadText.style.color = "var(--text-muted)";
            }
            showToast("✅ Macalinka cusub waa la keydiyay!");
        }
    } catch (err) {
        console.error("Error adding teacher:", err);
    }
});

// Delete teacher
async function deleteTeacher(id) {
    if (dbSubjects.some(s => String(s.teacherId) === String(id))) {
        alert("Ma tirtiri kartid macalinkaan. Wuxuu dhigaa ugu yaraan hal maado. Fadlan marka hore maadada ka bedel.");
        return;
    }
    
    if (confirm("Ma hubtaa inaad tirtirto macalinkan?")) {
        try {
            const res = await fetch(`${API_BASE_URL}/teachers/${id}`, { 
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            if (handleAuthError(res)) return;
            if (res.ok) {
                await loadAllData();
                renderTeachersTable();
                populateTeacherSelect();
                updateDashboardStats();
                showToast("🗑️ Macalinka waa la tirtiray!");
            }
        } catch (err) {
            console.error("Error deleting teacher:", err);
        }
    }
}

// Edit teacher
async function editTeacher(id) {
    const teacher = dbTeachers.find(t => String(t.id) === String(id));
    if (!teacher) return;
    
    const newName = prompt("Geli magaca cusub ee macalinka:", teacher.name);
    if (!newName || newName.trim() === '') return;

    const newUsername = prompt("Geli Username-ka cusub ee macalinka:", teacher.username || teacher.id);
    const newPassword = prompt("Geli Password-ka cusub ee macalinka:", teacher.password || 'teacher123');

    try {
        const res = await fetch(`${API_BASE_URL}/teachers/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                name: newName.trim(),
                username: newUsername ? newUsername.trim() : teacher.username,
                password: newPassword ? newPassword.trim() : teacher.password
            })
        });
        if (handleAuthError(res)) return;
        if (res.ok) {
            await loadAllData();
            renderTeachersTable();
            renderAdminTable();
            populateTeacherSelect();
            showToast("✅ Xogta macalinka waa la cusbooneysiiyay!");
        }
    } catch (err) {
        console.error("Error updating teacher:", err);
    }
}

// Add subject form handler
document.getElementById('add-subject-form')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const formVal = document.getElementById('sub-form').value;
    let gradeLabel = formatClassName(formVal);

    const subNameVal = document.getElementById('sub-name').value.trim();
    if (!subNameVal) return;
    const colorVal = document.getElementById('sub-color').value;
    const teacherIdVal = document.getElementById('sub-teacher').value;

    const newSubject = {
        form: formVal,
        tag: subNameVal.toUpperCase(),
        title: subNameVal,
        teacherId: teacherIdVal || null,
        tagColor: colorVal,
        border: colorVal,
        grade: gradeLabel
    };

    try {
        const res = await fetch(`${API_BASE_URL}/subjects`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(newSubject)
        });
        if (handleAuthError(res)) return;
        if (res.ok) {
            await loadAllData();
            renderAdminTable();
            updateDashboardStats();
            this.reset();
            showToast("✅ Maadada cusub waa la keydiyay!");
        } else {
            const errData = await res.json();
            alert("Qalad ayaa ka dhacay keydinta maadada: " + (errData.error || res.statusText));
        }
    } catch (err) {
        console.error("Error adding subject:", err);
        alert("Qalad ayaa ka dhacay server-ka.");
    }
});

// Delete subject
async function deleteSubject(subjectId) {
    if(confirm("Ma hubtaa inaad tirtirto maadadan?")) {
        try {
            const res = await fetch(`${API_BASE_URL}/subjects/${subjectId}`, { 
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            if (handleAuthError(res)) return;
            if (res.ok) {
                await loadAllData();
                renderAdminTable();
                updateDashboardStats();
                showToast("🗑️ Maadada waa la tirtiray!");
            }
        } catch (err) {
            console.error("Error deleting subject:", err);
        }
    }
}

function updateDashboardStats() {
    const elSubjects = document.getElementById('stat-subjects');
    const elTeachers = document.getElementById('stat-teachers');
    const elStudents = document.getElementById('stat-students');
    const elClasses = document.getElementById('stat-classes');

    if(elSubjects) elSubjects.innerText = dbSubjects.length;
    if(elTeachers) elTeachers.innerText = dbTeachers.length;
    if(elStudents) elStudents.innerText = dbStudents.length;
    
    const formsSet = new Set();
    dbSubjects.forEach(s => formsSet.add(s.form));
    if(elClasses) elClasses.innerText = formsSet.size > 0 ? formsSet.size : 4;
}

// Populate Teacher Select in Subject Form
function populateTeacherSelect() {
    const select = document.getElementById('sub-teacher');
    if (!select) return;
    
    let html = '<option value="">-- Door Macallin (Ikhtiyaari) --</option>';
    dbTeachers.forEach(t => {
        html += `<option value="${t.id}">${t.name}</option>`;
    });
    select.innerHTML = html;
}

// Render Subjects Table
function renderAdminTable() {
    const tbody = document.getElementById('subjects-tbody');
    if (!tbody) return;
    let html = '';
    
    dbSubjects.forEach((sub) => {
        let displayForm = formatClassName(sub.form);
        const teacher = dbTeachers.find(t => String(t.id) === String(sub.teacherId));
        const tName = teacher ? teacher.name : "N/A";
        const imgTag = teacher && teacher.img ? `<img src="${teacher.img}" class="teacher-avatar" alt="avatar" /> ` : '';

        html += `
            <tr>
                <td>${displayForm}</td>
                <td><span class="badge-tag" style="background:var(--bg-main); color:var(--text-main); border:1px solid #ddd;">${sub.tag}</span><br><small style="margin-top:4px; display:inline-block">${sub.title}</small></td>
                <td><div class="teacher-cell">${imgTag}${tName}</div></td>
                <td>
                    <button class="btn-action" onclick="deleteSubject(${sub.id})">
                        <i class="fa-solid fa-trash"></i> Tirtir
                    </button>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

// Render teachers table
function renderTeachersTable() {
    const tbody = document.getElementById('teachers-tbody');
    if (!tbody) return;
    let html = '';
    
    dbTeachers.forEach(t => {
        const uname = t.username || t.id;
        const pass = t.password || 'teacher123';
        html += `
            <tr>
                <td><img src="${t.img}" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover; border:2px solid #ddd;" alt="avatar" /></td>
                <td style="font-weight: 500; font-size:1.05rem;">${t.name}</td>
                <td><code style="color:var(--accent-blue); font-weight:700;">@${uname}</code></td>
                <td><span style="font-family:monospace; background:#F3F4F6; padding:2px 8px; border-radius:4px; font-weight:600; color:#374151;">${pass}</span></td>
                <td>
                    <button class="btn-action" style="background:#DBEAFE; color:#1E3A8A; margin-right:8px;" onclick="editTeacher('${t.id}')">
                        <i class="fa-solid fa-pen"></i> Wax Ka Bedel
                    </button>
                    <button class="btn-action" onclick="deleteTeacher('${t.id}')">
                        <i class="fa-solid fa-trash"></i> Tirtir
                    </button>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

// === STUDENTS LOGIC ===
document.getElementById('add-student-form')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    const name = document.getElementById('student-name').value;
    const form = document.getElementById('student-form').value;
    const roll = document.getElementById('student-roll').value;
    const phone = document.getElementById('student-phone').value;

    const newStudent = {
        id: 's_' + Date.now(),
        roll: roll,
        name: name,
        phone: phone,
        form: form
    };

    try {
        const res = await fetch(`${API_BASE_URL}/students`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(newStudent)
        });
        if (handleAuthError(res)) return;
        if (res.ok) {
            await loadAllData();
            renderStudentsTable();
            updateDashboardStats();
            this.reset();
            showToast("✅ Ardayga cusub waa la keydiyay!");
        }
    } catch (err) {
        console.error("Error adding student:", err);
    }
});

async function deleteStudent(id) {
    if(confirm("Ma hubtaa inaad ardaygan tirtirto?")) {
        try {
            const res = await fetch(`${API_BASE_URL}/students/${id}`, { 
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            if (handleAuthError(res)) return;
            if (res.ok) {
                await loadAllData();
                renderStudentsTable();
                updateDashboardStats();
                showToast("🗑️ Ardayga waa la tirtiray!");
            }
        } catch (err) {
            console.error("Error deleting student:", err);
        }
    }
}

function renderStudentsTable() {
    const tbody = document.getElementById('students-tbody');
    if (!tbody) return;
    
    const searchEl = document.getElementById('search-student');
    const query = searchEl ? searchEl.value.toLowerCase() : '';
    
    let html = '';
    
    const filteredStudents = dbStudents.filter(s => {
        if (!query) return true;
        const sName = (s.name || '').toLowerCase();
        const sRoll = (s.roll || '').toLowerCase();
        const sPhone = (s.phone || '').toLowerCase();
        return sName.includes(query) || sRoll.includes(query) || sPhone.includes(query);
    });
    
    if (filteredStudents.length === 0) {
        html = `<tr><td colspan="5" style="text-align:center; padding: 1rem; color: var(--text-muted);">Wax arday ah lama helin...</td></tr>`;
    } else {
        filteredStudents.forEach((student) => {
            const displayForm = formatClassName(student.form);
            const displayRoll = student.roll ? student.roll : '-';
            const displayPhone = student.phone ? `<a href="tel:${student.phone}" style="color: var(--primary); text-decoration: none;"><i class="fa-solid fa-phone"></i> ${student.phone}</a>` : '<span style="color: var(--text-muted);">-</span>';
            html += `
                <tr>
                    <td><span style="font-family: monospace; background: #F3F4F6; padding: 4px 8px; border-radius: 6px; font-size: 0.9em; border: 1px solid #E5E7EB;">${displayRoll}</span></td>
                    <td style="font-weight: 500;">${student.name}</td>
                    <td><span class="badge-tag" style="background:#F3F4F6; color:#374151;">${displayForm}</span></td>
                    <td>${displayPhone}</td>
                    <td>
                        <button class="btn-action" onclick="deleteStudent('${student.id}')">
                            <i class="fa-solid fa-trash"></i> Tirtir
                        </button>
                    </td>
                </tr>
            `;
        });
    }
    
    tbody.innerHTML = html;
}

// === ATTENDANCE LOGIC ===
async function loadAttendance() {
    const date = document.getElementById('att-date').value;
    const form = document.getElementById('att-form').value;
    const tbody = document.getElementById('attendance-tbody');
    if (!tbody || !date) return;

    await loadAllData();
    const formStudents = dbStudents.filter(s => s.form === form);
    
    if (formStudents.length === 0) {
        tbody.innerHTML = `<tr><td colspan="2" style="text-align:center; color:var(--text-muted);">Majiraan arday ku diiwaangashan fasalkan. Fadlan marka hore arday diiwaangeli.</td></tr>`;
        return;
    }

    let pastRecord = {};
    try {
        const res = await fetch(`${API_BASE_URL}/attendance?date=${date}&form=${form}&_t=${Date.now()}`);
        if (res.ok) pastRecord = await res.json();
    } catch (err) {
        console.error("Error fetching attendance record:", err);
    }

    let html = '';
    formStudents.forEach(student => {
        const status = pastRecord[student.id] || 'present';
        
        html += `
            <tr data-student-id="${student.id}">
                <td style="font-weight: 500;">${student.name}</td>
                <td>
                    <div style="display: flex; gap: 1rem;">
                        <label style="cursor:pointer; display:flex; align-items:center; gap:0.3rem;">
                            <input type="radio" name="status-${student.id}" value="present" ${status === 'present' ? 'checked' : ''}> Soo Xaadiray
                        </label>
                        <label style="cursor:pointer; display:flex; align-items:center; gap:0.3rem;">
                            <input type="radio" name="status-${student.id}" value="absent" ${status === 'absent' ? 'checked' : ''}> Maqan
                        </label>
                        <label style="cursor:pointer; display:flex; align-items:center; gap:0.3rem;">
                            <input type="radio" name="status-${student.id}" value="leave" ${status === 'leave' ? 'checked' : ''}> Fasax
                        </label>
                    </div>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

async function saveAttendance() {
    const date = document.getElementById('att-date').value;
    const form = document.getElementById('att-form').value;
    if (!date) return;

    const records = {};
    const rows = document.querySelectorAll('#attendance-tbody tr[data-student-id]');
    if (rows.length === 0) return;

    rows.forEach(row => {
        const sId = row.getAttribute('data-student-id');
        const selectedRadio = row.querySelector(`input[name="status-${sId}"]:checked`);
        if(selectedRadio) {
            records[sId] = selectedRadio.value;
        }
    });

    try {
        const res = await fetch(`${API_BASE_URL}/attendance`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ date, form, records })
        });
        if (handleAuthError(res)) return;
        if (res.ok) {
            showToast("✅ Xaadirinta waa la keydiyay!");
        }
    } catch (err) {
        console.error("Error saving attendance:", err);
    }
}

function downloadAttendanceCsv() {
    const date = document.getElementById('att-date').value;
    const form = document.getElementById('att-form').value;
    const formStudents = dbStudents.filter(s => s.form === form);
    
    if (formStudents.length === 0) {
        alert("Majiraan arday fasalkan oo la xaadirin karo.");
        return;
    }

    let csvContent = "\uFEFFMagaca Ardayga,Fasalka,Taariikhda,Xaalada\n";
    formStudents.forEach(student => {
        let displayForm = (student.form || '').replace('form', 'Form ');
        csvContent += `"${student.name}","${displayForm}","${date}","Soo Xaadiray"\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Xaadirinta_${form}_${date}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

document.getElementById('att-date')?.addEventListener('change', loadAttendance);

// === SCHEDULE BUILDER LOGIC ===
const WEEKS_DAYS = ['Sabti', 'Axad', 'Isniin', 'Talaado', 'Arbaco'];
const PERIODS = 6;

function normalizeFormKey(formStr) {
    if (!formStr) return '1';
    const s = String(formStr).toLowerCase().trim();
    if (s === 'form1' || s === 'class1' || s === '1') return '1';
    if (s === 'form2' || s === 'class2' || s === '2') return '2';
    if (s === 'form3' || s === 'class3' || s === '3') return '3';
    if (s === 'form4' || s === 'class4' || s === '4') return '4';
    if (s === 'form5' || s === 'class5' || s === '5') return '5';
    if (s === 'form6' || s === 'class6' || s === '6') return '6';
    if (s === 'form7' || s === 'class7' || s === '7') return '7';
    if (s === 'form8' || s === 'class8' || s === '8') return '8';
    if (s === 'form9' || s === 'class9' || s === '9') return '9';
    if (s === 'form10' || s === 'class10' || s === '10') return '10';
    if (s === 'form11' || s === 'class11' || s === '11') return '11';
    if (s === 'form12' || s === 'class12' || s === '12') return '12';
    const num = s.replace(/[^0-9]/g, '');
    return num || '1';
}

function isSameForm(a, b) {
    return normalizeFormKey(a) === normalizeFormKey(b);
}

// Helper to get unique subjects for a form without duplicates
function getUniqueFormSubjects(form) {
    let matchingSubjects = dbSubjects.filter(s => isSameForm(s.form, form));
    if (matchingSubjects.length === 0) {
        matchingSubjects = dbSubjects;
    }

    const uniqueFormSubjects = [];
    const seenTags = new Set();
    matchingSubjects.forEach(sub => {
        const key = (sub.tag || sub.title || '').toUpperCase().trim();
        if (key && !seenTags.has(key)) {
            seenTags.add(key);
            uniqueFormSubjects.push(sub);
        }
    });

    return uniqueFormSubjects;
}

async function loadScheduleBuilder() {
    const form = document.getElementById('schedule-form-select').value;
    const tbody = document.getElementById('schedule-tbody');
    if (!tbody) return;

    // Capture any un-saved select choices currently set by the user in the DOM
    const userSelections = {};
    document.querySelectorAll('.schedule-select').forEach(sel => {
        const d = sel.getAttribute('data-day');
        const p = sel.getAttribute('data-period');
        if (d !== null && p !== null && sel.value && sel.value !== "") {
            userSelections[`${d}_${p}`] = sel.value;
        }
    });

    await loadAllData();
    let schData = {};
    try {
        const res = await fetch(`${API_BASE_URL}/schedules?form=${form}&_t=${Date.now()}`);
        if (res.ok) schData = await res.json();
    } catch (err) {
        console.error("Error fetching schedule:", err);
    }

    const uniqueFormSubjects = getUniqueFormSubjects(form);

    let html = '';
    WEEKS_DAYS.forEach((day, dayIndex) => {
        html += `<tr>`;
        html += `<td style="font-weight: 600; background: #F9FAFB;">${day}</td>`;
        
        for(let p = 0; p < PERIODS; p++) {
            if(p === 3) {
                html += `<td style="background: #FEE2E2; color: #DC2626; text-align: center; font-size: 0.8rem; font-weight: bold;">Nasasho</td>`;
            }
            
            const cellKey = `${dayIndex}_${p}`;
            const savedSubjectId = schData[cellKey] !== undefined ? String(schData[cellKey]) : "";
            const activeSubjectId = userSelections[cellKey] !== undefined ? String(userSelections[cellKey]) : savedSubjectId;
            
            html += `<td><select class="form-control schedule-select" data-day="${dayIndex}" data-period="${p}" style="padding: 0.3rem; font-size: 0.85rem;">`;
            let cellOptionsHtml = `<option value="">-- Firaaqo --</option>`;
            uniqueFormSubjects.forEach(sub => {
                const subIdStr = String(sub.id);
                const subTagStr = String(sub.tag).toUpperCase().trim();
                const isSelected = (activeSubjectId !== "" && (activeSubjectId === subIdStr || activeSubjectId.toUpperCase().trim() === subTagStr)) ? "selected" : "";
                cellOptionsHtml += `<option value="${sub.id}" data-tag="${sub.tag}" ${isSelected}>${sub.tag}</option>`;
            });
            html += cellOptionsHtml;
            html += `</select></td>`;
        }
        
        html += `</tr>`;
    });

    tbody.innerHTML = html;
    updateScheduleSelectOptions();
}

function updateScheduleSelectOptions() {
    const isHideEnabled = document.getElementById('toggle-hide-selected-sub')?.checked ?? true;

    WEEKS_DAYS.forEach((day, dayIndex) => {
        const daySelects = Array.from(document.querySelectorAll(`.schedule-select[data-day="${dayIndex}"]`));
        
        const selectedValuesOnDay = new Set();
        daySelects.forEach(sel => {
            if (sel.value && sel.value !== "") {
                selectedValuesOnDay.add(String(sel.value));
            }
        });

        daySelects.forEach(sel => {
            const myVal = String(sel.value || "");
            const options = sel.querySelectorAll('option');

            options.forEach(opt => {
                const optVal = String(opt.value || "");
                if (optVal === "") return; // Always keep -- Firaaqo -- enabled

                if (isHideEnabled && selectedValuesOnDay.has(optVal) && optVal !== myVal) {
                    opt.disabled = true;
                    opt.hidden = true;
                    opt.style.display = 'none';
                } else {
                    opt.disabled = false;
                    opt.hidden = false;
                    opt.style.display = '';
                }
            });
        });
    });
}

// Event listener: On any schedule dropdown change, update choices in real-time
document.getElementById('schedule-tbody')?.addEventListener('change', updateScheduleSelectOptions);

async function saveScheduleBuilder() {
    const form = document.getElementById('schedule-form-select').value;
    const selects = document.querySelectorAll('.schedule-select');
    
    const schedule = {};
    selects.forEach(sel => {
        const d = sel.getAttribute('data-day');
        const p = sel.getAttribute('data-period');
        const val = sel.value;
        if(val !== "") {
            schedule[`${d}_${p}`] = val;
        }
    });

    try {
        const res = await fetch(`${API_BASE_URL}/schedules`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ form, schedule })
        });
        if (handleAuthError(res)) return;
        if (res.ok) {
            showToast("✅ Jadwalka waa la keydiyay!");
        }
    } catch (err) {
        console.error("Error saving schedule:", err);
    }
}

async function seedAllSchedules() {
    if (confirm("Ma hubtaa inaad otomaatig ku buuxiso jadwalka dhammaan 4-ta fasal (Form 1 - Form 4)?")) {
        try {
            const res = await fetch(`${API_BASE_URL}/schedules/seed-all`, {
                method: 'POST',
                headers: getAuthHeaders()
            });
            if (handleAuthError(res)) return;
            if (res.ok) {
                await loadScheduleBuilder();
                showToast("✨ Jadwalka dhammaan fasalada waa la buuxiyay si macquul ah!");
            }
        } catch (err) {
            console.error("Error seeding all schedules:", err);
        }
    }
}

// === STUDENT TUITION FEES & FINANCIAL MANAGEMENT LOGIC ===

async function loadFeesData() {
    try {
        const timestamp = Date.now();
        const [feesRes, summaryRes] = await Promise.all([
            fetch(`${API_BASE_URL}/fees?_t=${timestamp}`),
            fetch(`${API_BASE_URL}/fees/summary?_t=${timestamp}`)
        ]);
        if (feesRes.ok) dbFees = await feesRes.json();
        if (summaryRes.ok) {
            const summary = await summaryRes.json();
            renderFinancialSummary(summary);
        }
        renderFeesTable();
    } catch (err) {
        console.error("Error loading fees data:", err);
    }
}

function renderFinancialSummary(summary) {
    const elMonthly = document.getElementById('stat-fee-monthly');
    const elYearly = document.getElementById('stat-fee-yearly');
    const elTotal = document.getElementById('stat-fee-total');
    const elUnpaid = document.getElementById('stat-fee-unpaid');

    if (elMonthly) elMonthly.innerText = `$${(summary.monthlyCollected || 0).toLocaleString()}`;
    if (elYearly) elYearly.innerText = `$${(summary.yearlyCollected || 0).toLocaleString()}`;
    if (elTotal) elTotal.innerText = `$${(summary.totalCollected || 0).toLocaleString()}`;
    if (elUnpaid) elUnpaid.innerText = `$${(summary.totalUnpaid || 0).toLocaleString()}`;
}

function populateStudentFeeSelect() {
    const select = document.getElementById('fee-student-select');
    if (!select) return;

    const currentVal = select.value;

    if (dbStudents.length === 0) {
        select.innerHTML = '<option value="">-- Majiraan arday. Marka hore arday kudar --</option>';
        return;
    }

    let html = '<option value="">-- Dooro Ardayga --</option>';
    dbStudents.forEach(s => {
        const formLabel = formatClassName(s.form);
        html += `<option value="${s.id}">${s.name} (${s.roll || 'ID: ' + s.id}) - ${formLabel}</option>`;
    });

    select.innerHTML = html;

    if (currentVal && select.querySelector(`option[value="${currentVal}"]`)) {
        select.value = currentVal;
    }
}

function renderFeesTable() {
    const tbody = document.getElementById('fees-tbody');
    if (!tbody) return;

    const searchEl = document.getElementById('search-fee-student');
    const filterEl = document.getElementById('filter-fee-status');
    const query = searchEl ? searchEl.value.toLowerCase() : '';
    const statusFilter = filterEl ? filterEl.value : 'ALL';

    const filtered = dbFees.filter(f => {
        const matchStatus = (statusFilter === 'ALL') || (f.status === statusFilter);
        const name = (f.studentName || '').toLowerCase();
        const roll = (f.roll || '').toLowerCase();
        const month = (f.month || '').toLowerCase();
        const matchQuery = !query || name.includes(query) || roll.includes(query) || month.includes(query);
        return matchStatus && matchQuery;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:1.5rem; color:var(--text-muted);">Wax lacag-bixin ah lama helin...</td></tr>`;
        return;
    }

    let html = '';
    filtered.forEach(f => {
        const isPaid = f.status === 'PAID';
        const badgeStyle = isPaid 
            ? 'background: #D1FAE5; color: #065F46; border: 1px solid #A7F3D0;' 
            : 'background: #FEE2E2; color: #991B1B; border: 1px solid #FCA5A5;';
        const statusText = isPaid ? 'Bixiyay ✅' : 'Maanu Bixin ❌';
        const displayForm = formatClassName(f.form);

        html += `
            <tr>
                <td style="font-weight: 600;">${f.studentName}<br><small style="color:var(--text-muted); font-weight:normal;">Roll: ${f.roll || '-'}</small></td>
                <td><span class="badge-tag" style="background:#F3F4F6; color:#374151;">${displayForm}</span></td>
                <td>${f.month} ${f.year}</td>
                <td style="font-weight:700; color:var(--text-main);">$${parseFloat(f.amount).toFixed(2)}</td>
                <td><span class="badge-tag" style="${badgeStyle}">${statusText}</span></td>
                <td>
                    <button class="btn-action" style="background:${isPaid ? '#FEE2E2' : '#D1FAE5'}; color:${isPaid ? '#991B1B' : '#065F46'}; margin-right:6px;" onclick="toggleFeeStatus('${f.id}', '${isPaid ? 'UNPAID' : 'PAID'}')">
                        <i class="fa-solid ${isPaid ? 'fa-xmark' : 'fa-check'}"></i> ${isPaid ? 'U bedel Unpaid' : 'U bedel Paid'}
                    </button>
                    <button class="btn-action" onclick="deleteFeeRecord('${f.id}')">
                        <i class="fa-solid fa-trash"></i> Tirtir
                    </button>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

document.getElementById('add-fee-form')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    const btn = this.querySelector('button[type="submit"]');
    const origHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Keydinayaa...';
        btn.disabled = true;
    }

    const studentId = document.getElementById('fee-student-select').value;
    const month = document.getElementById('fee-month').value;
    const year = document.getElementById('fee-year').value;
    const amount = document.getElementById('fee-amount').value;
    const status = document.getElementById('fee-status').value;
    const paymentDate = document.getElementById('fee-date').value;
    const notes = document.getElementById('fee-notes').value;

    if (!studentId) {
        alert("Fadlan dooro ardayga!");
        if (btn) { btn.innerHTML = origHtml; btn.disabled = false; }
        return;
    }

    const student = dbStudents.find(s => String(s.id) === String(studentId));
    const studentName = student ? student.name : 'Arday';
    const roll = student ? (student.roll || '-') : '-';
    const form = student ? (student.form || '-') : '-';

    const payload = {
        studentId,
        month,
        year: parseInt(year, 10),
        amount: parseFloat(amount),
        status,
        paymentDate: paymentDate || new Date().toISOString().split('T')[0],
        notes
    };

    // Optimistic UI update
    const tempFee = {
        id: 'temp_' + Date.now(),
        studentId,
        studentName,
        roll,
        form,
        month,
        year: parseInt(year, 10),
        amount: parseFloat(amount),
        status,
        paymentDate: payload.paymentDate,
        notes
    };
    dbFees.unshift(tempFee);
    renderFeesTable();

    try {
        const res = await fetch(`${API_BASE_URL}/fees`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });

        if (handleAuthError(res)) return;

        if (res.ok) {
            await loadFeesData();
            showToast("✅ Lacag-bixinta ardayga waa la keydiyay!");
            this.reset();
            populateStudentFeeSelect();
            document.getElementById('fee-year').value = new Date().getFullYear();
            document.getElementById('fee-amount').value = '25.00';
        } else {
            const errData = await res.json();
            alert("Error: " + (errData.error || 'Failed to save fee record'));
            await loadFeesData();
        }
    } catch (err) {
        console.error("Error saving fee record:", err);
        await loadFeesData();
    } finally {
        if (btn) {
            btn.innerHTML = origHtml;
            btn.disabled = false;
        }
    }
});

async function toggleFeeStatus(feeId, newStatus) {
    const record = dbFees.find(f => String(f.id) === String(feeId));
    if (!record) return;

    try {
        const res = await fetch(`${API_BASE_URL}/fees`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                studentId: record.studentId,
                month: record.month,
                year: record.year,
                amount: record.amount,
                status: newStatus,
                paymentDate: record.paymentDate,
                notes: record.notes
            })
        });
        if (handleAuthError(res)) return;
        if (res.ok) {
            await loadFeesData();
            showToast(`✅ Xaalada lacagta waxaa loo bedelay ${newStatus}!`);
        }
    } catch (err) {
        console.error("Error toggling fee status:", err);
    }
}

async function deleteFeeRecord(feeId) {
    if (confirm("Ma hubtaa inaad tirtirto diiwaankan lacag-bixinta?")) {
        try {
            const res = await fetch(`${API_BASE_URL}/fees/${feeId}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            if (handleAuthError(res)) return;
            if (res.ok) {
                await loadFeesData();
                showToast("🗑️ Diiwaanka lacagta waa la tirtiray!");
            }
        } catch (err) {
            console.error("Error deleting fee record:", err);
        }
    }
}

// Dark Mode Functions for Admin Panel
function initAdminDarkMode() {
    const isDark = localStorage.getItem('app-theme') === 'dark';
    if (isDark) {
        document.body.classList.add('dark-mode');
    }
    updateAdminThemeIcon(isDark);
}

function toggleAdminDarkMode() {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('app-theme', isDark ? 'dark' : 'light');
    updateAdminThemeIcon(isDark);
}

function updateAdminThemeIcon(isDark) {
    const btn = document.getElementById('admin-theme-toggle');
    if (!btn) return;
    if (isDark) {
        btn.innerHTML = '<i class="fa-solid fa-sun" style="color: #F59E0B;"></i> Light Mode';
    } else {
        btn.innerHTML = '<i class="fa-solid fa-moon"></i> Dark Mode';
    }
}

// ====================================================
// STUDENT GRADES & EXAM RESULTS MODULE
// ====================================================

// Load Grades Data
// Load Grades Data
async function loadGradesData() {
    try {
        const res = await fetch(`${API_BASE_URL}/grades?_t=${Date.now()}`);
        if (res.ok) {
            dbGrades = await res.json();
            filterGradesTable();
            updateGradesStats();
        }
    } catch (err) {
        console.error("Error loading grades data:", err);
    }
}

// Populate Grade Selects
function populateGradeSelects() {
    const studentSelect = document.getElementById('grade-student');
    const bulkStudentSelect = document.getElementById('bulk-grade-student');
    const filterStudentSelect = document.getElementById('grade-filter-student');
    const overviewStudentSelect = document.getElementById('grade-overview-student-select');
    const subjectSelect = document.getElementById('grade-subject');
    
    const currSelectedStudent = studentSelect ? studentSelect.value : '';
    const currBulkStudent = bulkStudentSelect ? bulkStudentSelect.value : '';
    const currFilterStudent = filterStudentSelect ? filterStudentSelect.value : '';
    const currOverviewStudent = overviewStudentSelect ? overviewStudentSelect.value : '';

    let sHtml = '<option value="">-- Dooro Arday --</option>';
    let fHtml = '<option value="all">-- Dhammaan Ardayda --</option>';
    let oHtml = '<option value="">-- Dooro Arday (Si aad u aragto natiijadiisa) --</option>';

    dbStudents.forEach(st => {
        const formLabel = formatClassName(st.form);
        const option = `<option value="${st.id}">${st.name} (Roll: ${st.roll}, ${formLabel})</option>`;
        sHtml += option;
        fHtml += option;
        oHtml += option;
    });

    if (studentSelect) {
        studentSelect.innerHTML = sHtml;
        if (currSelectedStudent) studentSelect.value = currSelectedStudent;
    }
    if (bulkStudentSelect) {
        bulkStudentSelect.innerHTML = sHtml;
        if (currBulkStudent) bulkStudentSelect.value = currBulkStudent;
    }
    if (filterStudentSelect) {
        filterStudentSelect.innerHTML = fHtml;
        if (currFilterStudent) filterStudentSelect.value = currFilterStudent;
    }
    if (overviewStudentSelect) {
        overviewStudentSelect.innerHTML = oHtml;
        if (currOverviewStudent) overviewStudentSelect.value = currOverviewStudent;
    }
    
    if (subjectSelect) {
        const currSub = subjectSelect.value;
        let subHtml = '<option value="">-- Dooro Maado --</option>';
        dbSubjects.forEach(sb => {
            const formLabel = formatClassName(sb.form);
            subHtml += `<option value="${sb.id}" data-name="${sb.title}">${sb.title} (${formLabel})</option>`;
        });
        subjectSelect.innerHTML = subHtml;
        if (currSub) subjectSelect.value = currSub;
    }
}

// Global state for selected student and active class tab
let activeGradeClass = null;
let currentSelectedStudentId = null;

// Global helper to select student across all grade dropdowns and update stats
function setSelectedGradeStudent(studentId, triggerSource = '', keepClass = false) {
    const overviewSelect = document.getElementById('grade-overview-student-select');
    const filterSelect = document.getElementById('grade-filter-student');
    const singleSelect = document.getElementById('grade-student');
    const bulkSelect = document.getElementById('bulk-grade-student');

    const val = (studentId && studentId !== 'all') ? String(studentId) : '';
    currentSelectedStudentId = val;

    if (overviewSelect && triggerSource !== 'overview') {
        overviewSelect.value = val;
    }
    if (filterSelect && triggerSource !== 'filter') {
        filterSelect.value = val ? val : 'all';
    }
    if (singleSelect && triggerSource !== 'single' && val) {
        singleSelect.value = val;
    }
    if (bulkSelect && triggerSource !== 'bulk' && val) {
        bulkSelect.value = val;
        if (typeof populateBulkSubjectsGrid === 'function') {
            populateBulkSubjectsGrid();
        }
    }

    if (!val) {
        activeGradeClass = null;
        const tabsContainer = document.getElementById('student-class-tabs-container');
        if (tabsContainer) tabsContainer.style.display = 'none';
    } else {
        // Find student's current enrolled class
        const studentObj = dbStudents.find(s => String(s.id) === String(val) || String(s.roll) === String(val));
        const currentClass = (studentObj?.form || '').toLowerCase().trim();
        
        if (!keepClass || !activeGradeClass) {
            // By default, show the class the student is CURRENTLY enrolled in (fasalka uu hadda dhigto)!
            activeGradeClass = currentClass || 'all';
        }
        renderStudentClassTabs(val);
    }

    updateGradesStats(val);
    filterGradesTable(false);
}

// Switch active class for the selected student (Current Class vs Past Classes vs All)
function selectStudentGradeClass(classKey) {
    activeGradeClass = (classKey || '').toLowerCase().trim();
    renderStudentClassTabs();
    updateGradesStats();
    filterGradesTable(false);
}

// Render dynamic class switcher tabs for the selected student
function renderStudentClassTabs(studentId = null) {
    const container = document.getElementById('student-class-tabs-container');
    const tabsEl = document.getElementById('student-class-tabs');
    const badgeEl = document.getElementById('student-class-active-badge');
    if (!container || !tabsEl) return;

    const activeId = studentId || currentSelectedStudentId;
    if (!activeId) {
        container.style.display = 'none';
        return;
    }

    const studentObj = dbStudents.find(s => String(s.id) === String(activeId) || String(s.roll) === String(activeId));
    const currentClass = (studentObj?.form || '').toLowerCase().trim();

    // Get all grades recorded for this student
    const studentGrades = dbGrades.filter(g =>
        String(g.studentId) === String(activeId) || 
        (studentObj && String(g.rollNumber) === String(studentObj.roll)) ||
        (g.studentName && studentObj && g.studentName.toLowerCase().trim() === studentObj.name.toLowerCase().trim())
    );

    // Collect all classes (current class + past classes recorded in student_grades)
    const formSet = new Set();
    if (currentClass) formSet.add(currentClass);
    studentGrades.forEach(g => {
        if (g.classForm) formSet.add(String(g.classForm).toLowerCase().trim());
    });

    const formsList = Array.from(formSet).filter(Boolean);

    if (formsList.length === 0) {
        container.style.display = 'none';
        return;
    }

    if (!activeGradeClass || (activeGradeClass !== 'all' && !formSet.has(activeGradeClass))) {
        activeGradeClass = currentClass || formsList[0] || 'all';
    }

    container.style.display = 'flex';

    let tabsHtml = '';

    // 1. Current Class Button (Fasalka uu hadda dhigto)
    if (currentClass) {
        const isCurActive = activeGradeClass === currentClass;
        const curStyle = isCurActive 
            ? 'background: #4F46E5; color: white; border: 1.5px solid #4338CA; font-weight: 700; box-shadow: 0 2px 5px rgba(79,70,229,0.35);' 
            : 'background: white; color: #1F2937; border: 1px solid #D1D5DB; font-weight: 600;';
        
        tabsHtml += `
            <button type="button" onclick="selectStudentGradeClass('${currentClass}')" style="padding: 0.4rem 0.85rem; border-radius: 8px; font-size: 0.85rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s; ${curStyle}">
                <i class="fa-solid fa-star" style="color: ${isCurActive ? '#FDE047' : '#F59E0B'};"></i>
                <span>${formatClassName(currentClass)}</span>
                <span style="font-size: 0.72rem; padding: 2px 6px; border-radius: 10px; background: ${isCurActive ? 'rgba(255,255,255,0.25)' : '#DCFCE7'}; color: ${isCurActive ? '#fff' : '#15803D'}; font-weight: 700;">Hadda 🌟</span>
            </button>
        `;
    }

    // 2. Past Classes Buttons (Fasaladii Hore)
    formsList.forEach(fKey => {
        if (fKey === currentClass) return; // already rendered as Current Class above
        const isPastActive = activeGradeClass === fKey;
        const pastStyle = isPastActive 
            ? 'background: #4F46E5; color: white; border: 1.5px solid #4338CA; font-weight: 700; box-shadow: 0 2px 5px rgba(79,70,229,0.35);' 
            : 'background: white; color: #374151; border: 1px solid #D1D5DB; font-weight: 500;';
        
        tabsHtml += `
            <button type="button" onclick="selectStudentGradeClass('${fKey}')" style="padding: 0.4rem 0.85rem; border-radius: 8px; font-size: 0.85rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s; ${pastStyle}">
                <i class="fa-solid fa-clock-rotate-left" style="color: ${isPastActive ? '#fff' : '#6B7280'};"></i>
                <span>${formatClassName(fKey)}</span>
                <span style="font-size: 0.72rem; padding: 2px 6px; border-radius: 10px; background: ${isPastActive ? 'rgba(255,255,255,0.25)' : '#F3F4F6'}; color: ${isPastActive ? '#fff' : '#4B5563'}; font-weight: 600;">Hore 📜</span>
            </button>
        `;
    });

    // 3. All Classes Button (Dhammaan Fasallada)
    const isAllActive = activeGradeClass === 'all';
    const allStyle = isAllActive 
        ? 'background: #0284C7; color: white; border: 1.5px solid #0369A1; font-weight: 700; box-shadow: 0 2px 5px rgba(2,132,199,0.35);' 
        : 'background: white; color: #4B5563; border: 1px solid #D1D5DB; font-weight: 500;';
    
    tabsHtml += `
        <button type="button" onclick="selectStudentGradeClass('all')" style="padding: 0.4rem 0.85rem; border-radius: 8px; font-size: 0.85rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s; ${allStyle}">
            <i class="fa-solid fa-layer-group"></i>
            <span>Dhammaan Fasallada</span>
        </button>
    `;

    tabsEl.innerHTML = tabsHtml;

    // Active badge status text
    if (badgeEl) {
        if (activeGradeClass === currentClass && currentClass) {
            badgeEl.innerHTML = `<span style="background:#DCFCE7; color:#15803D; padding:4px 10px; border-radius:8px; font-weight:600; display:inline-flex; align-items:center; gap:6px;"><i class="fa-solid fa-star"></i> Waxaad hadda eegaysaa: <strong>${formatClassName(currentClass)} (Fasalka uu hadda dhigto)</strong></span>`;
        } else if (activeGradeClass === 'all') {
            badgeEl.innerHTML = `<span style="background:#E0F2FE; color:#0369A1; padding:4px 10px; border-radius:8px; font-weight:600; display:inline-flex; align-items:center; gap:6px;"><i class="fa-solid fa-layer-group"></i> Waxaad hadda eegaysaa: <strong>Dhammaan Fasallada (Wadarta Guud)</strong></span>`;
        } else {
            badgeEl.innerHTML = `<span style="background:#FEF3C7; color:#B45309; padding:4px 10px; border-radius:8px; font-weight:600; display:inline-flex; align-items:center; gap:6px;"><i class="fa-solid fa-clock-rotate-left"></i> Waxaad hadda eegaysaa: <strong>${formatClassName(activeGradeClass)} (Fasalkii Hore)</strong></span>`;
        }
    }
}

// Event listener: When student selection changes in single grade form
document.getElementById('grade-student')?.addEventListener('change', function() {
    setSelectedGradeStudent(this.value, 'single');
});

// Update Grades Overview Stats specifically for the selected student & active class
function updateGradesStats(selectedId = null) {
    const totalEl = document.getElementById('stat-total-grades');
    const passedEl = document.getElementById('stat-passed-grades');
    const failedEl = document.getElementById('stat-failed-grades');
    const rateEl = document.getElementById('stat-pass-rate');
    const rateLabelEl = document.getElementById('stat-pass-rate-label');
    const totalLabelEl = document.getElementById('stat-total-grades-label');
    const passedLabelEl = document.getElementById('stat-passed-grades-label');
    const failedLabelEl = document.getElementById('stat-failed-grades-label');
    const nameDisplayEl = document.getElementById('selected-student-display-name');
    const metaDisplayEl = document.getElementById('selected-student-display-meta');

    let activeId = selectedId;
    if (activeId === null || activeId === undefined) {
        const overviewVal = document.getElementById('grade-overview-student-select')?.value;
        const filterVal = document.getElementById('grade-filter-student')?.value;
        const formVal = document.getElementById('grade-student')?.value;
        const bulkVal = document.getElementById('bulk-grade-student')?.value;

        if (overviewVal && overviewVal !== 'all' && overviewVal !== '') activeId = overviewVal;
        else if (filterVal && filterVal !== 'all' && filterVal !== '') activeId = filterVal;
        else if (formVal && formVal !== '') activeId = formVal;
        else if (bulkVal && bulkVal !== '') activeId = bulkVal;
        else activeId = '';
    }

    if (activeId === 'all') activeId = '';

    // If no student is selected yet, show zero/prompt (NOT combined totals of all students)
    if (!activeId) {
        if (totalEl) totalEl.innerText = '0';
        if (passedEl) passedEl.innerText = '0';
        if (failedEl) failedEl.innerText = '0';
        if (rateEl) rateEl.innerText = '0%';
        if (rateLabelEl) rateLabelEl.innerText = 'Boqolleyda Guud';
        if (totalLabelEl) totalLabelEl.innerText = 'Wadarta Maadooyinka';
        if (passedLabelEl) passedLabelEl.innerText = 'Maadooyinka la Baasay (Pass ✅)';
        if (failedLabelEl) failedLabelEl.innerText = 'Maadooyinka la Dhacay (Fail ❌)';
        if (nameDisplayEl) {
            nameDisplayEl.innerHTML = '<span style="color:var(--text-muted); font-weight:500;"><i class="fa-solid fa-arrow-pointer"></i> Fadlan dooro arday si aad u aragto natiijadiisa</span>';
        }
        if (metaDisplayEl) {
            metaDisplayEl.innerText = 'Qeebtaan waxay muujinaysaa uun inta maado ee ardayga la doortay uu baasay, inta uu dhacay iyo boqolleydiisa.';
        }
        return;
    }

    // Find student in dbStudents
    const studentObj = dbStudents.find(s => String(s.id) === String(activeId) || String(s.roll) === String(activeId));
    const studentName = studentObj ? studentObj.name : `Arday #${activeId}`;
    const studentRoll = studentObj ? studentObj.roll : '-';
    const currentClass = (studentObj?.form || '').toLowerCase().trim();

    // Filter grades strictly for this student
    const studentGrades = dbGrades.filter(g =>
        String(g.studentId) === String(activeId) || 
        (studentObj && String(g.rollNumber) === String(studentObj.roll)) ||
        (g.studentName && studentObj && g.studentName.toLowerCase().trim() === studentObj.name.toLowerCase().trim())
    );

    // Filter by active class (e.g. current class vs past class vs all)
    let classGrades = studentGrades;
    let classLabel = 'Dhammaan Fasallada';
    if (activeGradeClass && activeGradeClass !== 'all') {
        classGrades = studentGrades.filter(g => (g.classForm || '').toLowerCase().trim() === activeGradeClass.toLowerCase().trim());
        if (activeGradeClass === currentClass) {
            classLabel = `${formatClassName(activeGradeClass)} (Hadda)`;
        } else {
            classLabel = `${formatClassName(activeGradeClass)} (Hore)`;
        }
    }

    const total = classGrades.length;
    const passed = classGrades.filter(g => parseFloat(g.score) >= 50 || String(g.status).toLowerCase().includes('basi') || String(g.status).toLowerCase().includes('pass')).length;
    const failed = total - passed;
    const totalScore = classGrades.reduce((sum, g) => sum + (parseFloat(g.score) || 0), 0);
    const avgScore = total > 0 ? (totalScore / total).toFixed(1) : 0;
    const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;

    if (totalEl) totalEl.innerText = total;
    if (passedEl) passedEl.innerText = passed;
    if (failedEl) failedEl.innerText = failed;
    if (rateEl) rateEl.innerText = `${avgScore}%`;
    if (rateLabelEl) rateLabelEl.innerHTML = `Boqolleyda ${classLabel} <small style="display:block; font-size:0.75rem; color:var(--text-muted);">(Baasay: ${passRate}%)</small>`;
    if (totalLabelEl) totalLabelEl.innerText = `Maadooyinka ${classLabel}`;

    const isOverallPass = total > 0 && passed >= failed && parseFloat(avgScore) >= 50;
    const statusBadge = total === 0 
        ? '<span style="background:#E5E7EB; color:#374151; padding:3px 9px; border-radius:12px; font-size:0.78rem; font-weight:600;">Weli ma gelin fasalkan</span>'
        : (isOverallPass 
            ? '<span style="background:#DCFCE7; color:#15803D; padding:3px 9px; border-radius:12px; font-size:0.78rem; font-weight:600;"><i class="fa-solid fa-circle-check"></i> GUULAYSAY (Pass)</span>'
            : '<span style="background:#FEE2E2; color:#B91C1C; padding:3px 9px; border-radius:12px; font-size:0.78rem; font-weight:600;"><i class="fa-solid fa-circle-xmark"></i> DHACAY (Fail)</span>');

    if (nameDisplayEl) {
        nameDisplayEl.innerHTML = `Ardayga: <strong style="color:var(--primary); font-size:1.05rem;">${studentName}</strong> ${statusBadge}`;
    }
    if (metaDisplayEl) {
        const curClassFormatted = formatClassName(currentClass);
        metaDisplayEl.innerHTML = `Roll No: <strong>${studentRoll}</strong> | Fasalka uu hadda dhigto: <strong style="color:var(--primary);">${curClassFormatted}</strong> | Fasalka la eegayo: <strong>${classLabel}</strong> | Celcelis: <strong>${avgScore}%</strong>`;
    }
}

// Render Grades Table
function renderGradesTable(data = null) {
    const tbody = document.getElementById('grades-tbody');
    if (!tbody) return;
    const list = data !== null ? data : dbGrades;
    let html = '';

    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 1.5rem; color: var(--text-muted);">Wax natiijooyin ah lama helin...</td></tr>';
        return;
    }

    list.forEach(g => {
        const isPass = parseFloat(g.score) >= 50 || String(g.status).toLowerCase().includes('basi') || String(g.status).toLowerCase().includes('pass');
        const badgeClass = isPass ? 'background:#DCFCE7; color:#15803D;' : 'background:#FEE2E2; color:#B91C1C;';
        const statusText = isPass ? 'Basiyay ✅' : 'Dhacay ❌';

        html += `
            <tr>
                <td>
                    <a href="javascript:void(0)" onclick="setSelectedGradeStudent('${g.studentId}', '', true)" style="text-decoration:none; color:inherit;" title="Guji si aad u eegto natiijada ardaygan">
                        <strong style="color:var(--primary); cursor:pointer;">${g.studentName || 'Arday'}</strong>
                    </a>
                    <br><small style="color:var(--text-muted);">Roll: ${g.rollNumber || '-'}</small>
                </td>
                <td>${formatClassName(g.classForm)}</td>
                <td>${g.subjectName || '-'}</td>
                <td>${g.examTerm || 'Term 1'}</td>
                <td><strong>${g.score}%</strong></td>
                <td><span class="badge-tag" style="${badgeClass} font-weight:600;">${statusText}</span></td>
                <td>
                    <button class="btn-action" onclick="deleteGradeRecord(${g.id})">
                        <i class="fa-solid fa-trash"></i> Tirtir
                    </button>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

// Filter Grades Table
function filterGradesTable(updateStats = true) {
    const query = (document.getElementById('grade-search')?.value || '').toLowerCase().trim();
    const statusFilter = (document.getElementById('grade-filter-status')?.value || 'all').trim();
    const studentFilter = (document.getElementById('grade-filter-student')?.value || 'all').trim();

    const filtered = dbGrades.filter(g => {
        const matchQuery = !query || 
            (g.studentName || '').toLowerCase().includes(query) || 
            (g.rollNumber || '').toLowerCase().includes(query) || 
            (g.subjectName || '').toLowerCase().includes(query) ||
            formatClassName(g.classForm).toLowerCase().includes(query);

        let matchStatus = true;
        if (statusFilter !== 'all' && statusFilter !== '') {
            const isPass = parseFloat(g.score) >= 50 || String(g.status).toLowerCase().includes('basi') || String(g.status).toLowerCase().includes('pass');
            const sLower = statusFilter.toLowerCase();
            if (sLower.includes('basi') || sLower.includes('pass')) {
                matchStatus = isPass;
            } else if (sLower.includes('dhac') || sLower.includes('fail')) {
                matchStatus = !isPass;
            }
        }

        let matchStudent = true;
        if (studentFilter !== 'all' && studentFilter !== '') {
            matchStudent = String(g.studentId).toLowerCase() === String(studentFilter).toLowerCase() ||
                           String(g.rollNumber).toLowerCase() === String(studentFilter).toLowerCase();

            // When a student is selected and a specific class is active, filter table to that class
            if (matchStudent && activeGradeClass && activeGradeClass !== 'all') {
                const gForm = (g.classForm || '').toLowerCase().trim();
                if (gForm !== activeGradeClass) {
                    matchStudent = false;
                }
            }
        }

        return matchQuery && matchStatus && matchStudent;
    });

    renderGradesTable(filtered);
    if (updateStats) {
        updateGradesStats();
    }
}

// Add Grade Form Handler (Step-by-Step for Selected Student)
document.getElementById('add-grade-form')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    const studentSelect = document.getElementById('grade-student');
    const studentId = studentSelect.value;
    const subjectSelect = document.getElementById('grade-subject');
    const subjectId = subjectSelect.value;
    const selectedOpt = subjectSelect.options[subjectSelect.selectedIndex];
    const subjectName = selectedOpt?.dataset?.name || selectedOpt?.text || 'Maado';
    const examTerm = document.getElementById('grade-term').value;
    const score = parseFloat(document.getElementById('grade-score').value);
    const remarks = document.getElementById('grade-notes').value;

    if (!studentId || isNaN(score)) {
        alert("Fadlan dooro ardayga oo geli dhibcaha!");
        return;
    }

    try {
        const res = await fetch(`${API_BASE_URL}/grades`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                studentId,
                subjectId,
                subjectName,
                examTerm,
                score,
                remarks
            })
        });
        if (handleAuthError(res)) return;
        if (res.ok) {
            await loadGradesData();

            // PRESERVE SELECTED STUDENT & ADVANCE SUBJECT
            studentSelect.value = studentId;
            document.getElementById('grade-score').value = '';
            document.getElementById('grade-notes').value = '';

            // Auto advance to next subject in list if available
            if (subjectSelect.selectedIndex > 0 && subjectSelect.selectedIndex < subjectSelect.options.length - 1) {
                subjectSelect.selectedIndex = subjectSelect.selectedIndex + 1;
            } else {
                subjectSelect.selectedIndex = 0;
            }

            // Sync table filter and stats to show ONLY this student's step-by-step grades
            setSelectedGradeStudent(studentId);

            showToast(`✅ Natiijada ${subjectName} ee ardayga waa la keydiyay!`);
        } else {
            const err = await res.json();
            alert("Qalad ayaa ka dhacay keydinta: " + (err.error || res.statusText));
        }
    } catch (err) {
        console.error("Error adding grade:", err);
        alert("Qalad ayaa ka dhacay server-ka.");
    }
});

// Delete Grade Record
async function deleteGradeRecord(gradeId) {
    if (confirm("Ma hubtaa inaad tirtirto natiijadan?")) {
        try {
            const res = await fetch(`${API_BASE_URL}/grades/${gradeId}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            if (handleAuthError(res)) return;
            if (res.ok) {
                await loadGradesData();
                showToast("🗑️ Natiijada waa la tirtiray!");
            }
        } catch (err) {
            console.error("Error deleting grade record:", err);
        }
    }
}

// Toggle between Single Subject and 12-Subjects Bulk Entry Mode
function toggleGradeMode(mode) {
    const singleForm = document.getElementById('add-grade-form');
    const bulkForm = document.getElementById('bulk-grade-form');
    const btnSingle = document.getElementById('btn-mode-single');
    const btnBulk = document.getElementById('btn-mode-bulk');

    if (mode === 'bulk') {
        if (singleForm) singleForm.style.display = 'none';
        if (bulkForm) bulkForm.style.display = 'block';
        if (btnSingle) { btnSingle.style.background = '#E5E7EB'; btnSingle.style.color = '#374151'; }
        if (btnBulk) { btnBulk.style.background = 'var(--primary)'; btnBulk.style.color = 'white'; }
        populateGradeSelects();
        populateBulkSubjectsGrid();
    } else {
        if (singleForm) singleForm.style.display = 'block';
        if (bulkForm) bulkForm.style.display = 'none';
        if (btnSingle) { btnSingle.style.background = 'var(--primary)'; btnSingle.style.color = 'white'; }
        if (btnBulk) { btnBulk.style.background = '#E5E7EB'; btnBulk.style.color = '#374151'; }
    }
}

// Populate Dynamic Subjects Grid in Bulk Mode based on MoECHE curriculum
function populateBulkSubjectsGrid() {
    const grid = document.getElementById('bulk-12-subjects-grid');
    const bulkStudentSelect = document.getElementById('bulk-grade-student');
    const labelEl = document.getElementById('bulk-subjects-label');
    if (!grid) return;

    const selectedStudentId = bulkStudentSelect ? bulkStudentSelect.value : '';

    if (bulkStudentSelect && bulkStudentSelect.options.length <= 1) {
        let sHtml = '<option value="">-- Dooro Arday --</option>';
        dbStudents.forEach(st => {
            const formLabel = formatClassName(st.form);
            sHtml += `<option value="${st.id}">${st.name} (${st.roll || 'ID: ' + st.id}) - ${formLabel}</option>`;
        });
        bulkStudentSelect.innerHTML = sHtml;
        if (selectedStudentId) bulkStudentSelect.value = selectedStudentId;
    }

    let studentForm = '';
    if (selectedStudentId) {
        const studentObj = dbStudents.find(s => String(s.id) === String(selectedStudentId));
        if (studentObj) studentForm = studentObj.form;
    }

    // Get unique subjects list for the selected student form
    let subjectList = [];
    if (dbSubjects.length > 0) {
        let matchingSubs = dbSubjects;
        if (studentForm) {
            matchingSubs = dbSubjects.filter(s => s.form === studentForm);
        }
        const seenTitles = new Set();
        matchingSubs.forEach(sub => {
            if (!seenTitles.has(sub.title)) {
                seenTitles.add(sub.title);
                subjectList.push(sub);
            }
        });
    }

    if (subjectList.length === 0) {
        subjectList = [
            { id: 1, title: 'English' }, { id: 2, title: 'Arabic' }, { id: 3, title: 'Islamic' },
            { id: 4, title: 'Physics' }, { id: 5, title: 'Biology' }, { id: 6, title: 'Somali' },
            { id: 7, title: 'Math' }, { id: 8, title: 'Chemistry' }, { id: 9, title: 'History' },
            { id: 10, title: 'Geography' }, { id: 11, title: 'Technology' }
        ];
    }

    if (labelEl) {
        labelEl.innerText = studentForm 
            ? `${subjectList.length}-da Maado ee ${formatClassName(studentForm)} (0-100):`
            : `Maadooyinka Ardayga (${subjectList.length} Maado) (0-100):`;
    }

    // Pre-fill existing grades for selected student if available
    const existingStudentGrades = {};
    if (selectedStudentId) {
        dbGrades.forEach(g => {
            if (String(g.studentId).toLowerCase() === String(selectedStudentId).toLowerCase()) {
                existingStudentGrades[g.subjectName?.toLowerCase()] = g.score;
            }
        });
    }

    let html = '';
    subjectList.forEach((sub, idx) => {
        const subTitle = sub.title;
        const prefilledScore = existingStudentGrades[subTitle.toLowerCase()] !== undefined ? existingStudentGrades[subTitle.toLowerCase()] : '';
        html += `
            <div style="background: var(--bg-main); padding: 6px 10px; border-radius: 6px; border: 1px solid #E5E7EB;">
                <label style="font-size: 0.75rem; font-weight: 600; display: block; color: var(--text-main); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;" title="${subTitle}">
                    ${idx + 1}. ${subTitle}
                </label>
                <input type="number" class="bulk-score-input form-control" data-subid="${sub.id}" data-subname="${subTitle}" min="0" max="100" placeholder="0-100" value="${prefilledScore}" style="padding: 0.25rem 0.5rem; font-size: 0.8rem; margin-top: 2px;">
            </div>
        `;
    });

    grid.innerHTML = html;
}

// Event listener: When bulk student selection changes, refresh 12-subjects grid and sync student
document.getElementById('bulk-grade-student')?.addEventListener('change', function() {
    populateBulkSubjectsGrid();
    setSelectedGradeStudent(this.value, 'bulk');
});

// Quick Preset All Subjects Score (e.g. 75%)
function presetAllScores(val) {
    const inputs = document.querySelectorAll('.bulk-score-input');
    inputs.forEach(inp => { inp.value = val; });
}

// Bulk Subjects Submit Handler
document.getElementById('bulk-grade-form')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    const studentId = document.getElementById('bulk-grade-student').value;
    const examTerm = document.getElementById('bulk-grade-term').value;

    if (!studentId) {
        alert("Fadlan dooro ardayga!");
        return;
    }

    const inputs = document.querySelectorAll('.bulk-score-input');
    const items = [];

    inputs.forEach(inp => {
        const scoreVal = parseFloat(inp.value);
        if (!isNaN(scoreVal)) {
            items.push({
                subjectId: inp.dataset.subid,
                subjectName: inp.dataset.subname,
                score: scoreVal,
                remarks: scoreVal >= 50 ? 'Basiyay ✅' : 'Dhacay ❌'
            });
        }
    });

    if (items.length === 0) {
        alert("Fadlan geli dhibco maadooyinka ardayga!");
        return;
    }

    try {
        const res = await fetch(`${API_BASE_URL}/grades/bulk`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                studentId,
                examTerm,
                items
            })
        });
        if (handleAuthError(res)) return;
        if (res.ok) {
            await loadGradesData();
            setSelectedGradeStudent(studentId);
            showToast(`✅ Natiijooyinka maadooyinka ardayga waa la keydiyay!`);
        } else {
            const err = await res.json();
            alert("Qalad ayaa ka dhacay keydinta: " + (err.error || res.statusText));
        }
    } catch (err) {
        console.error("Error bulk saving grades:", err);
        alert("Qalad ayaa ka dhacay server-ka.");
    }
});

// Seed Official MoECHE Subjects Grades for All Registered Students
async function seedAllStudents12Grades() {
    if (!confirm("Ma hubtaa inaad dhamaan ardayda diwaangashan u shubto natiijooyinka maadooyinka manhajka dowladda?")) return;

    if (dbStudents.length === 0) {
        alert("Laga ma helin wax arday diwaangashan!");
        return;
    }

    try {
        for (const st of dbStudents) {
            let studentSubs = dbSubjects.filter(sb => sb.form === st.form);
            if (studentSubs.length === 0) {
                const seen = new Set();
                studentSubs = dbSubjects.filter(sb => {
                    if (seen.has(sb.title)) return false;
                    seen.add(sb.title);
                    return true;
                });
            }
            const items = studentSubs.map((sb, i) => {
                const baseScore = i % 5 === 0 ? 42 : (65 + (i * 3) % 30);
                return {
                    subjectId: sb.id,
                    subjectName: sb.title,
                    score: baseScore,
                    remarks: baseScore >= 50 ? 'Basiyay ✅' : 'Dhacay ❌'
                };
            });

            await fetch(`${API_BASE_URL}/grades/bulk`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    studentId: st.id,
                    examTerm: 'Term 1',
                    items
                })
            });
        }
        await loadGradesData();
        showToast("⚡ Dhamaan ardayda maadooyinkooda rasmiga ah waa loo shubay natiijooyinka!");
    } catch (err) {
        console.error("Error seeding grades for all students:", err);
        alert("Qalad ayaa ka dhacay shubista natiijooyinka.");
    }
}
