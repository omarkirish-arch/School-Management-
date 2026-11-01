const API_BASE_URL = 'http://localhost:3000/api';

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

const days = [
    { id: 'sabti', name: 'Sabti', date: 'SEPT 16' },
    { id: 'axad', name: 'Axad', date: 'SEPT 17' },
    { id: 'isniin', name: 'Isniin', date: 'SEPT 18' },
    { id: 'talaado', name: 'Talaado', date: 'SEPT 19' },
    { id: 'arbaco', name: 'Arbaco', date: 'SEPT 20' }
];

// 6 xiso malin walba
const timeSlots = [
    "07:30 - 08:30",
    "08:30 - 09:30",
    "09:30 - 10:30",
    "10:50 - 11:40",
    "11:40 - 12:30",
    "12:30 - 13:30"
];

let subjectsData = [];
let teachersData = [];
let currentForm = 'all';

async function fetchInitialData() {
    try {
        const [teachersRes, subjectsRes] = await Promise.all([
            fetch(`${API_BASE_URL}/teachers`),
            fetch(`${API_BASE_URL}/subjects`)
        ]);
        if (teachersRes.ok) teachersData = await teachersRes.json();
        if (subjectsRes.ok) subjectsData = await subjectsRes.json();
    } catch (err) {
        console.error("Error connecting to Oracle API backend:", err);
    }
}

function getFilteredSubjects() {
    if (currentForm === 'all') return subjectsData;
    
    const filtered = subjectsData.filter(s => s.form === currentForm || (currentForm === 'class1' && s.form === 'form1') || (currentForm === 'form1' && s.form === 'class1'));
    if (filtered.length === 0) {
        return [{ tag: 'FIRAQOO', title: 'Shaqo Majirto', tagColor: 'dark-light', border: 'blue', grade: 'Fasalkaan wuu banana yahay', teacherId: 'null' }];
    }

    const seenTitles = new Set();
    const uniqueList = [];
    filtered.forEach(item => {
        if (!seenTitles.has(item.title.toLowerCase())) {
            seenTitles.add(item.title.toLowerCase());
            uniqueList.push(item);
        }
    });

    return uniqueList;
}

function getTeacherDetails(id) {
    const t = teachersData.find(x => String(x.id) === String(id));
    if (t) return t;
    return { name: "Macalin Ma Laha", img: "https://ui-avatars.com/api/?name=?&background=ddd" };
}

async function renderSchedule() {
    const grid = document.getElementById('schedule-grid');
    if (!grid) return;
    
    await fetchInitialData();

    if (currentForm === 'all') {
        grid.innerHTML = `
            <div style="text-align:center; width:100%; padding:3rem; background:var(--white); border-radius:var(--radius-lg); margin:1rem 0; border:1px solid #E5E7EB; box-shadow:var(--shadow-sm);">
                <i class="fa-solid fa-graduation-cap" style="font-size:2.5rem; color:var(--accent-blue); margin-bottom:1rem; display:block;"></i>
                <h3 style="color:var(--text-primary); margin-bottom:0.5rem; font-weight:600;">Dooro Fasalkaaga</h3>
                <p style="color:var(--text-secondary); margin:0;">Fadlan ka dooro liiska sare fasalka aad dhurato si aad u aragto jadwalka rasmiga ah ee Adminku soo xareeyay.</p>
            </div>
        `;
        return;
    }

    let dbScheduleMap = {};
    try {
        const schRes = await fetch(`${API_BASE_URL}/schedules?form=${currentForm}&_t=${Date.now()}`);
        if (schRes.ok) dbScheduleMap = await schRes.json();
    } catch (e) {
        console.warn("Could not fetch DB schedule:", e);
    }

    if (Object.keys(dbScheduleMap).length === 0) {
        const className = formatClassName(currentForm);
        grid.innerHTML = `
            <div style="text-align:center; width:100%; padding:3rem; background:var(--white); border-radius:var(--radius-lg); margin:1rem 0; border:1px solid #E5E7EB; box-shadow:var(--shadow-sm);">
                <i class="fa-solid fa-calendar-xmark" style="font-size:2.5rem; color:#9CA3AF; margin-bottom:1rem; display:block;"></i>
                <h3 style="color:var(--text-primary); margin-bottom:0.5rem; font-weight:600;">Jadwal Ma Jiro</h3>
                <p style="color:var(--text-secondary); margin:0;">Admin-ku wali ma soo gelin jadwalka <strong>${className}</strong>.</p>
            </div>
        `;
        return;
    }

    let html = '';

    days.forEach((day, dayIndex) => {
        let classesHtml = '';
        
        // Loop through the 6 timeslots for each day
        timeSlots.forEach((time, index) => {
            let subject = null;
            const cellKey = `${dayIndex}_${index}`;
            const targetSubId = dbScheduleMap[cellKey];

            if (targetSubId) {
                subject = subjectsData.find(s => String(s.id) === String(targetSubId) || String(s.tag).toUpperCase() === String(targetSubId).toUpperCase());
            }

            const teacher = subject ? getTeacherDetails(subject.teacherId) : { name: "Firaaqo", img: "https://ui-avatars.com/api/?name=Firaaqo&background=F3F4F6&color=9CA3AF" };

            const isDark = subject && subject.tagColor === 'dark-light';
            const cardClass = isDark ? 'course-card card-dark' : `course-card border-${(subject && subject.border) || 'blue'}`;
            const textClass = isDark ? 'text-white' : '';
            const gradeClass = isDark ? 'course-grade text-light' : 'course-grade';

            const subTag = subject ? subject.tag : 'FIRAQOO';
            const subTitle = subject ? subject.title : 'Firaaqo';
            const subGrade = subject ? subject.grade : formatClassName(currentForm);

            classesHtml += `
                <div class="${cardClass}">
                    <div class="card-header">
                        <span class="tag tag-${(subject && subject.tagColor) || 'blue'}">${subTag}</span>
                        <span class="time ${textClass}">${time}</span>
                    </div>
                    <h4 class="course-title ${textClass}">${subTitle}</h4>
                    <p class="${gradeClass}">${subGrade}</p>
                    <div class="teacher-info ${textClass}">
                        <img src="${teacher.img}" alt="Teacher" style="object-fit:cover;">
                        <span class="${textClass}">${teacher.name}</span>
                    </div>
                </div>
            `;
        });

        html += `
            <div class="day-group">
                <div class="day-header">
                    <h3>${day.name}</h3>
                    <p>${day.date}</p>
                </div>
                <div class="cards-list">
                    ${classesHtml}
                </div>
            </div>
        `;
    });

    grid.innerHTML = html;
}

// Dark Mode Logic
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
    
    await renderSchedule();
    
    const selector = document.getElementById('form-selector');
    if (selector) {
        selector.addEventListener('change', async (e) => {
            currentForm = e.target.value;
            await renderSchedule();
        });
    }

    document.getElementById('student-roll-input')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchStudentResult();
    });
});

let currentStudentGradesMap = {};
let activeStudentClass = 'all';

// Student Result Lookup Function (Supports Past Classes & Grade History)
async function searchStudentResult() {
    const input = document.getElementById('student-roll-input');
    const formSelect = document.getElementById('student-result-form');
    const card = document.getElementById('student-result-card');
    if (!input || !card) return;

    const query = input.value.trim();
    const targetForm = formSelect ? formSelect.value : 'all';

    if (!query) {
        alert("Fadlan geli Roll Number-kaaga ama magacaaga!");
        return;
    }

    card.style.display = 'block';
    card.innerHTML = '<p style="color: var(--text-secondary); text-align: center;"><i class="fa-solid fa-spinner fa-spin"></i> Waa la raadinayaa natiijada & fasalladii hore...</p>';

    try {
        let fetchUrl = `${API_BASE_URL}/grades?rollNumber=${encodeURIComponent(query)}`;
        if (targetForm && targetForm !== 'all') {
            fetchUrl += `&form=${encodeURIComponent(targetForm)}`;
        }

        let res = await fetch(fetchUrl);
        let list = res.ok ? await res.json() : [];

        if (list.length === 0) {
            let fetchUrl2 = `${API_BASE_URL}/grades?studentId=${encodeURIComponent(query)}`;
            if (targetForm && targetForm !== 'all') fetchUrl2 += `&form=${encodeURIComponent(targetForm)}`;
            const res2 = await fetch(fetchUrl2);
            if (res2.ok) list = await res2.json();
        }

        if (list.length === 0) {
            let fetchUrl3 = `${API_BASE_URL}/grades?query=${encodeURIComponent(query)}`;
            if (targetForm && targetForm !== 'all') fetchUrl3 += `&form=${encodeURIComponent(targetForm)}`;
            const res3 = await fetch(fetchUrl3);
            if (res3.ok) list = await res3.json();
        }

        if (list.length === 0) {
            const formText = targetForm !== 'all' ? ` fasalka ${formatClassName(targetForm)}` : '';
            card.innerHTML = `
                <div style="text-align: center; padding: 1rem; color: #EF4444;">
                    <i class="fa-solid fa-triangle-exclamation" style="font-size: 1.5rem; margin-bottom: 0.5rem;"></i>
                    <p style="font-weight: 500;">Laguma soo helin wax natiijo ah${formText} oo ku saabsan: <strong>${query}</strong></p>
                </div>
            `;
            return;
        }

        // Group grades by classForm
        currentStudentGradesMap = {};
        list.forEach(g => {
            const fKey = (g.classForm || 'General').toLowerCase().trim();
            if (!currentStudentGradesMap[fKey]) {
                currentStudentGradesMap[fKey] = [];
            }
            currentStudentGradesMap[fKey].push(g);
        });

        const availableForms = Object.keys(currentStudentGradesMap);
        
        // Pick initial active class form
        if (targetForm !== 'all' && currentStudentGradesMap[targetForm.toLowerCase()]) {
            activeStudentClass = targetForm.toLowerCase();
        } else {
            activeStudentClass = availableForms[availableForms.length - 1]; // Latest class by default
        }

        renderStudentGradesView(query, availableForms);
    } catch (err) {
        console.error("Error searching student result:", err);
        card.innerHTML = '<p style="color: #EF4444; text-align: center;">Qalad ayaa ka dhacay raadinta natiijada.</p>';
    }
}

// Render Selected Class Grades View
function renderStudentGradesView(query, availableForms) {
    const card = document.getElementById('student-result-card');
    if (!card) return;

    const classGrades = currentStudentGradesMap[activeStudentClass] || currentStudentGradesMap[availableForms[0]] || [];
    if (classGrades.length === 0) return;

    const studentName = classGrades[0].studentName || 'Arday';
    const rollNum = classGrades[0].rollNumber || query;
    const currentClassName = formatClassName(activeStudentClass);

    const totalSubjects = classGrades.length;
    const passedSubjects = classGrades.filter(g => parseFloat(g.score) >= 50 || String(g.status).toLowerCase().includes('basi') || String(g.status).toLowerCase().includes('pass')).length;
    const failedSubjects = totalSubjects - passedSubjects;
    const totalScore = classGrades.reduce((sum, g) => sum + (parseFloat(g.score) || 0), 0);
    const avgScore = totalSubjects > 0 ? (totalScore / totalSubjects).toFixed(1) : 0;
    const overallPass = passedSubjects >= failedSubjects && avgScore >= 50;

    // Render Past Classes Switcher Tabs
    let tabsHtml = '';
    if (availableForms.length > 1 || Object.keys(currentStudentGradesMap).length > 0) {
        tabsHtml += `<div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 1rem; padding: 6px; background: #F3F4F6; border-radius: var(--radius-md);">`;
        availableForms.forEach(fKey => {
            const isSelected = fKey === activeStudentClass;
            const btnStyle = isSelected
                ? 'background: var(--accent-blue); color: white; font-weight: 600; border: none;'
                : 'background: white; color: var(--text-primary); border: 1px solid #E5E7EB;';
            tabsHtml += `
                <button type="button" onclick="switchStudentResultClass('${fKey}', '${encodeURIComponent(query)}')" style="padding: 0.4rem 0.8rem; border-radius: var(--radius-sm); font-size: 0.8rem; cursor: pointer; transition: all 0.2s; ${btnStyle}">
                    <i class="fa-solid fa-graduation-cap"></i> ${formatClassName(fKey)}
                </button>
            `;
        });
        tabsHtml += `</div>`;
    }

    let rowsHtml = '';
    classGrades.forEach(g => {
        const isPass = parseFloat(g.score) >= 50 || String(g.status).toLowerCase().includes('basi') || String(g.status).toLowerCase().includes('pass');
        const color = isPass ? '#10B981' : '#EF4444';
        const icon = isPass ? 'fa-circle-check' : 'fa-circle-xmark';
        const text = isPass ? 'Basiyay' : 'Dhacay';

        rowsHtml += `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.65rem 0; border-bottom: 1px solid #F3F4F6;">
                <div>
                    <span style="font-weight: 600; font-size: 0.9rem; color: var(--text-primary);">${g.subjectName}</span>
                    <br><small style="color: var(--text-secondary);">${g.examTerm || 'Term 1'}</small>
                </div>
                <div style="text-align: right;">
                    <span style="font-weight: 700; font-size: 0.95rem; color: var(--text-primary);">${g.score}%</span>
                    <br><small style="color: ${color}; font-weight: 600;"><i class="fa-solid ${icon}"></i> ${text}</small>
                </div>
            </div>
        `;
    });

    card.innerHTML = `
        <div style="margin-bottom: 0.75rem;">
            <span style="font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); display: block; margin-bottom: 4px;">
                📜 FASALLADA LA HELAY (Fasalladii Hore & Midka Hada):
            </span>
            ${tabsHtml}
        </div>

        <div style="background: var(--bg-color); padding: 1rem; border-radius: var(--radius-md); margin-bottom: 1rem; border: 1px solid #E5E7EB;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                <div>
                    <h4 style="margin: 0; font-size: 1.1rem; color: var(--text-primary);">${studentName}</h4>
                    <p style="margin: 3px 0 0 0; font-size: 0.85rem; color: var(--text-secondary);">
                        Roll: <strong>${rollNum}</strong> | Fasalka la eegayo: <strong style="color: var(--accent-blue);">${currentClassName}</strong>
                    </p>
                </div>
                <div style="text-align: right;">
                    <span style="padding: 0.35rem 0.75rem; border-radius: 20px; font-weight: 700; font-size: 0.85rem; background: ${overallPass ? '#DCFCE7' : '#FEE2E2'}; color: ${overallPass ? '#15803D' : '#B91C1C'}; display: inline-block;">
                        ${overallPass ? 'GUULAYSAY ✅' : 'DHACAY ❌'}
                    </span>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-top: 1rem; text-align: center;">
                <div style="background: var(--white); padding: 0.5rem; border-radius: var(--radius-sm); border: 1px solid #E5E7EB;">
                    <span style="display: block; font-size: 0.7rem; color: var(--text-secondary);">Wadarta</span>
                    <strong style="font-size: 0.95rem;">${totalSubjects} Maado</strong>
                </div>
                <div style="background: #DCFCE7; padding: 0.5rem; border-radius: var(--radius-sm); color: #15803D;">
                    <span style="display: block; font-size: 0.7rem;">Baasay</span>
                    <strong style="font-size: 0.95rem;">${passedSubjects} ✅</strong>
                </div>
                <div style="background: #FEE2E2; padding: 0.5rem; border-radius: var(--radius-sm); color: #B91C1C;">
                    <span style="display: block; font-size: 0.7rem;">Dhacay</span>
                    <strong style="font-size: 0.95rem;">${failedSubjects} ❌</strong>
                </div>
                <div style="background: #EEF2FF; padding: 0.5rem; border-radius: var(--radius-sm); color: #3730A3;">
                    <span style="display: block; font-size: 0.7rem;">Celcelis</span>
                    <strong style="font-size: 0.95rem;">${avgScore}%</strong>
                </div>
            </div>
        </div>

        <h5 style="font-size: 0.9rem; margin-bottom: 0.5rem; color: var(--text-primary); display: flex; justify-content: space-between; align-items: center;">
            <span>Faahfaahinta Maadooyinka (${currentClassName}):</span>
            <span style="font-size: 0.75rem; color: var(--text-secondary); font-weight: normal;">Manhajka Dowladda</span>
        </h5>
        ${rowsHtml}
    `;
}

// Switch Active Class View for Student Result
function switchStudentResultClass(formKey, rawQuery) {
    activeStudentClass = formKey.toLowerCase();
    const availableForms = Object.keys(currentStudentGradesMap);
    renderStudentGradesView(decodeURIComponent(rawQuery), availableForms);
}
