const API_BASE_URL = 'http://localhost:3000/api';

const days = [
    { id: 0, name: 'Sabti', date: 'SEPT 16' },
    { id: 1, name: 'Axad', date: 'SEPT 17' },
    { id: 2, name: 'Isniin', date: 'SEPT 18' },
    { id: 3, name: 'Talaado', date: 'SEPT 19' },
    { id: 4, name: 'Arbaco', date: 'SEPT 20' }
];

const timeSlots = [
    "07:30 - 08:30",
    "08:30 - 09:30",
    "09:30 - 10:30",
    "10:50 - 11:40",
    "11:40 - 12:30",
    "12:30 - 13:30"
];

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

function togglePasswordVisibility() {
    const input = document.getElementById('teacher-password-input');
    const icon = document.getElementById('toggle-pw-icon');
    if (!input) return;
    if (input.type === 'password') {
        input.type = 'text';
        if (icon) {
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        }
    } else {
        input.type = 'password';
        if (icon) {
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    }
}

async function handleTeacherLogin(e) {
    if (e) e.preventDefault();
    const errorEl = document.getElementById('login-error-msg');
    const btn = document.getElementById('teacher-login-btn');
    if (errorEl) errorEl.style.display = 'none';

    const usernameInput = document.getElementById('teacher-username-input')?.value.trim();
    const passwordInput = document.getElementById('teacher-password-input')?.value.trim();

    if (!usernameInput || !passwordInput) {
        if (errorEl) {
            errorEl.innerText = "Fadlan geli Username-kaaga iyo Password-kaaga!";
            errorEl.style.display = 'block';
        }
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Hubinta...';
    }

    try {
        const res = await fetch(`${API_BASE_URL}/teacher/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: usernameInput, password: passwordInput })
        });

        const data = await res.json();
        if (res.ok && data.teacher) {
            localStorage.setItem('teacher_token', data.token);
            localStorage.setItem('logged_teacher', JSON.stringify(data.teacher));
            showTeacherDashboard(data.teacher);
        } else {
            if (errorEl) {
                errorEl.innerText = data.error || "Username-ka ama Password-ka waa khalad!";
                errorEl.style.display = 'block';
            } else {
                alert(data.error || "Username-ka ama Password-ka waa khalad!");
            }
        }
    } catch (err) {
        console.error("Login error:", err);
        if (errorEl) {
            errorEl.innerText = "Qalad ayaa ka dhacay xiriirka server-ka. Fadlan hubi in server-ku kiciyo.";
            errorEl.style.display = 'block';
        }
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Soo Gal Jadwalkaaga';
        }
    }
}

async function showTeacherDashboard(teacher) {
    document.getElementById('teacher-login-section').style.display = 'none';
    document.getElementById('teacher-dashboard-section').style.display = 'block';

    document.getElementById('teacher-name-header').innerText = teacher.name;
    document.getElementById('teacher-username-tag').innerText = `@${teacher.username || teacher.id}`;
    if (teacher.img) {
        document.getElementById('teacher-img-header').src = teacher.img;
    }

    await loadTeacherSchedule(teacher.id || teacher.username);
}

async function loadTeacherSchedule(teacherId) {
    const grid = document.getElementById('teacher-timetable-grid');
    if (!grid) return;

    grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem;"><i class="fa-solid fa-spinner fa-spin"></i> Waa la soo rarayaa jadwalkaaga...</div>';

    try {
        const res = await fetch(`${API_BASE_URL}/teacher/schedule/${encodeURIComponent(teacherId)}?_t=${Date.now()}`);
        if (!res.ok) throw new Error("Could not fetch schedule");
        
        const data = await res.json();
        const scheduleList = data.schedule || [];
        const teacherObj = data.teacher || {};

        document.getElementById('stat-teacher-total-slots').innerText = `${scheduleList.length} Xiso`;

        // Build 5-day grid maps (dayIndex -> periodIndex -> array of slot objects)
        const dayMaps = {};
        for (let d = 0; d < 5; d++) dayMaps[d] = {};

        scheduleList.forEach(slot => {
            const d = parseInt(slot.dayIndex, 10);
            const p = parseInt(slot.periodIndex, 10);
            if (!isNaN(d) && !isNaN(p)) {
                if (!dayMaps[d][p]) dayMaps[d][p] = [];
                dayMaps[d][p].push(slot);
            }
        });

        let gridHtml = '';

        days.forEach(day => {
            let slotsHtml = '';

            timeSlots.forEach((timeStr, pIndex) => {
                const activeSlots = dayMaps[day.id][pIndex];

                if (activeSlots && activeSlots.length > 0) {
                    activeSlots.forEach(activeSlot => {
                        const classLabel = formatClassName(activeSlot.classForm);
                        const tagColor = activeSlot.tagColor || 'blue';

                        slotsHtml += `
                            <div class="slot-card slot-active">
                                <span class="slot-time"><i class="fa-regular fa-clock"></i> C${pIndex + 1} (${timeStr})</span>
                                <div class="slot-class"><i class="fa-solid fa-graduation-cap" style="color:var(--accent-blue);"></i> ${classLabel}</div>
                                <div class="slot-subject"><span class="tag tag-${tagColor}" style="margin-right:4px;">${activeSlot.subjectTag || 'MAADO'}</span> ${activeSlot.subjectTitle}</div>
                            </div>
                        `;
                    });
                } else {
                    slotsHtml += `
                        <div class="slot-card slot-free">
                            <span class="slot-time"><i class="fa-regular fa-clock"></i> C${pIndex + 1} (${timeStr})</span>
                            <div style="font-size: 0.85rem; font-weight: 500;"><i class="fa-solid fa-coffee"></i> Firaaqo</div>
                        </div>
                    `;
                }
            });

            gridHtml += `
                <div class="day-column">
                    <div class="day-title-head">${day.name}</div>
                    <div>
                        ${slotsHtml}
                    </div>
                </div>
            `;
        });

        grid.innerHTML = gridHtml;
    } catch (err) {
        console.error("Error rendering teacher schedule:", err);
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #EF4444; padding: 2rem;">Qalad ayaa ka dhacay soo rarista jadwalka.</div>';
    }
}

function logoutTeacher() {
    localStorage.removeItem('teacher_token');
    localStorage.removeItem('logged_teacher');
    const uInput = document.getElementById('teacher-username-input');
    const pInput = document.getElementById('teacher-password-input');
    const errEl = document.getElementById('login-error-msg');
    if (uInput) uInput.value = '';
    if (pInput) pInput.value = '';
    if (errEl) errEl.style.display = 'none';
    document.getElementById('teacher-login-section').style.display = 'block';
    document.getElementById('teacher-dashboard-section').style.display = 'none';
}

// Dark Mode helper
function initDarkMode() {
    const isDark = localStorage.getItem('app-theme') === 'dark';
    if (isDark) {
        document.body.classList.add('dark-mode');
    }
    updateThemeIcon(isDark);
}

function toggleDarkMode() {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('app-theme', isDark ? 'dark' : 'light');
    updateThemeIcon(isDark);
}

function updateThemeIcon(isDark) {
    const btn = document.getElementById('theme-toggle-btn');
    if (!btn) return;
    if (isDark) {
        btn.innerHTML = '<i class="fa-solid fa-sun" style="color: #F59E0B;"></i>';
    } else {
        btn.innerHTML = '<i class="fa-solid fa-moon"></i>';
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    initDarkMode();
    document.getElementById('theme-toggle-btn')?.addEventListener('click', toggleDarkMode);

    const storedTeacher = localStorage.getItem('logged_teacher');
    if (storedTeacher) {
        try {
            const teacher = JSON.parse(storedTeacher);
            showTeacherDashboard(teacher);
        } catch (e) {
            logoutTeacher();
        }
    }
});
