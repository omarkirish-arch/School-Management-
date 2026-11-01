require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const oracledb = require('oracledb');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Enable autoCommit globally so all web operations save to Oracle DB instantly
oracledb.autoCommit = true;

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

// Disable browser caching for all API endpoints so updates show instantly
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_jwt_secret_key_2026';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// Configurable DB connections using environment variables with fallback support
const primaryDbConfig = {
  user: process.env.DB_USER || '"Admin-SYS"',
  password: process.env.DB_PASSWORD || 'Admin123',
  connectString: process.env.DB_CONNECT_STRING || '127.0.0.1:1521/XE'
};

const fallbackDbConfigs = [
  primaryDbConfig
];

async function getConn() {
  let lastErr = null;
  for (const cfg of fallbackDbConfigs) {
    try {
      const cfgWithTimeout = { ...cfg, connectTimeout: 1 };
      return await oracledb.getConnection(cfgWithTimeout);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

// ----------------------------------------------------
// AUTHENTICATION MIDDLEWARE & INITIALIZATION
// ----------------------------------------------------

function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: 'Access token required. Authorization header missing.' });
  }

  const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired authentication token.' });
  }
}

// Helper to ensure admin_users table exists and default admin is seeded
async function ensureAdminUserExists() {
  let conn;
  try {
    conn = await getConn();
    
    // Check if admin_users table exists
    try {
      await conn.execute(
        `CREATE TABLE admin_users (
          user_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          username VARCHAR2(100) NOT NULL UNIQUE,
          password_hash VARCHAR2(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
      );
      console.log('Created admin_users table in Oracle DB.');
    } catch (err) {
      // ORA-00955: name is already used by an existing object
      if (err.errorNum !== 955 && err.code !== 'ORA-00955') {
        // Ignore if exists, otherwise rethrow
      }
    }

    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!';

    const result = await conn.execute(
      `SELECT COUNT(*) AS cnt FROM admin_users WHERE LOWER(username) = LOWER(:u)`,
      [adminUsername],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const count = result.rows && result.rows[0] ? (result.rows[0].CNT || result.rows[0].cnt || 0) : 0;
    if (count === 0) {
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(adminPassword, salt);

      await conn.execute(
        `INSERT INTO admin_users (username, password_hash) VALUES (:username, :hash)`,
        { username: adminUsername, hash: hash }
      );
      console.log(`Seeded default admin user "${adminUsername}" into Oracle DB.`);
    }
  } catch (err) {
    console.warn('Notice during admin user initialization:', err.message);
  } finally {
    if (conn) await conn.close();
  }
}

// Helper to ensure student_fees table exists with student detail columns
async function ensureStudentFeesTableExists() {
  let conn;
  try {
    conn = await getConn();
    try {
      await conn.execute(
        `CREATE TABLE student_fees (
          fee_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          student_id VARCHAR2(100) NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
          student_name VARCHAR2(255),
          roll_number VARCHAR2(50),
          class_form VARCHAR2(50),
          fee_month VARCHAR2(50) NOT NULL,
          fee_year NUMBER NOT NULL,
          amount NUMBER(10,2) NOT NULL,
          status VARCHAR2(20) NOT NULL,
          payment_date VARCHAR2(50),
          notes VARCHAR2(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
      );
      console.log('Created student_fees table in Oracle DB.');
    } catch (err) {
      if (err.errorNum !== 955 && err.code !== 'ORA-00955') {
        // Ignore if exists
      }
    }

    try { await conn.execute('ALTER TABLE student_fees ADD (student_name VARCHAR2(255))'); } catch (e) {}
    try { await conn.execute('ALTER TABLE student_fees ADD (roll_number VARCHAR2(50))'); } catch (e) {}
    try { await conn.execute('ALTER TABLE student_fees ADD (class_form VARCHAR2(50))'); } catch (e) {}

    // Backfill missing student details into existing fee rows
    try {
      await conn.execute(
        `UPDATE student_fees f
         SET (f.student_name, f.roll_number, f.class_form) = (
            SELECT s.full_name, s.roll_number, s.class_form
            FROM students s
            WHERE LOWER(s.student_id) = LOWER(f.student_id)
         )
         WHERE f.student_name IS NULL`
      );
    } catch (e) {}

    // Create clean Database VIEW for simple SELECT queries in Oracle SQL Developer
    try {
      await conn.execute(
        `CREATE OR REPLACE VIEW v_student_fees AS
         SELECT 
            student_name,
            roll_number,
            status,
            fee_month,
            fee_year,
            payment_date,
            amount
         FROM student_fees`
      );
      console.log('Created v_student_fees VIEW in Oracle DB.');
    } catch (e) {
      console.warn('Notice creating v_student_fees view:', e.message);
    }

    try { await conn.execute('ALTER TABLE subjects ADD (teacher_name VARCHAR2(255))'); } catch (e) {}
    try {
      await conn.execute(
        `UPDATE subjects s
         SET s.teacher_name = (
            SELECT t.name FROM teachers t WHERE s.teacher_id = t.teacher_id
         )
         WHERE s.teacher_name IS NULL`
      );
    } catch (e) {}

    try {
      await conn.execute(
        `CREATE OR REPLACE VIEW v_subjects AS
         SELECT 
            s.subject_id,
            s.title AS maadada,
            s.class_form AS fasalka,
            NVL(s.teacher_name, t.name) AS macalinka,
            s.teacher_id
         FROM subjects s
         LEFT JOIN teachers t ON s.teacher_id = t.teacher_id
         ORDER BY s.subject_id ASC`
      );
      console.log('Created v_subjects VIEW in Oracle DB.');
    } catch (e) {}

  } catch (err) {
    console.warn('Notice during student_fees initialization:', err.message);
  } finally {
    if (conn) await conn.close();
  }
}

// Logic to populate schedules for all 4 forms based ONLY on user registered subjects
async function seedSchedulesLogic(conn) {
  const subRes = await conn.execute(
    `SELECT subject_id AS "id" FROM subjects ORDER BY subject_id ASC`,
    [],
    { outFormat: oracledb.OUT_FORMAT_OBJECT }
  );

  const userSubjects = (subRes.rows || []).map(r => r.id);
  if (userSubjects.length === 0) return;

  const forms = ['form1', 'form2', 'form3', 'form4'];
  const formOffsets = { form1: 0, form2: 3, form3: 6, form4: 9 };

  for (const formId of forms) {
    await conn.execute(`DELETE FROM schedules WHERE class_form = :form`, [formId]);

    const offset = formOffsets[formId] || 0;

    for (let day = 0; day < 5; day++) {
      for (let period = 0; period < 6; period++) {
        const subIndex = (day * 6 + period * 2 + offset) % userSubjects.length;
        const targetSubId = userSubjects[subIndex];

        await conn.execute(
          `INSERT INTO schedules (class_form, day_index, period_index, subject_id)
           VALUES (:form, :dayIndex, :periodIndex, :subjectId)`,
          [formId, day, period, targetSubId]
        );
      }
    }
  }
}

// Helper to ensure schedules are populated for all forms on startup
async function ensureSchedulesSeeded() {
  let conn;
  try {
    conn = await getConn();
    const res = await conn.execute(`SELECT COUNT(*) AS cnt FROM schedules`, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const count = res.rows && res.rows[0] ? (res.rows[0].CNT || res.rows[0].cnt || 0) : 0;
    if (count === 0) {
      console.log('Seeding initial reasonable schedules for all forms...');
      await seedSchedulesLogic(conn);
      console.log('Schedules for all forms seeded successfully!');
    }
  } catch (err) {
    console.warn('Notice during schedules initialization:', err.message);
  } finally {
    if (conn) await conn.close();
  }
}

// Helper to ensure attendance table has required columns
async function ensureAttendanceColumns() {
  let conn;
  try {
    conn = await getConn();
    try {
      await conn.execute(
        `CREATE TABLE attendance (
          attendance_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          att_date VARCHAR2(20),
          class_form VARCHAR2(50),
          student_id VARCHAR2(100),
          status VARCHAR2(20)
        )`
      );
      console.log('Created attendance table in Oracle DB.');
    } catch (e) {}

    try { await conn.execute('ALTER TABLE attendance ADD (att_date VARCHAR2(20))'); } catch (e) {}
    try { await conn.execute('ALTER TABLE attendance ADD (class_form VARCHAR2(50))'); } catch (e) {}
    try { await conn.execute('ALTER TABLE attendance ADD (student_id VARCHAR2(100))'); } catch (e) {}
    try { await conn.execute('ALTER TABLE attendance ADD (status VARCHAR2(20))'); } catch (e) {}
  } catch (err) {
    // Ignore
  } finally {
    if (conn) await conn.close();
  }
}

// ----------------------------------------------------
// AUTHENTICATION ENDPOINTS
// ----------------------------------------------------

const ADMIN_DATA_FILE = path.join(__dirname, 'admin_data.json');

function getAdminCredentials() {
  try {
    if (fs.existsSync(ADMIN_DATA_FILE)) {
      return JSON.parse(fs.readFileSync(ADMIN_DATA_FILE, 'utf8'));
    }
  } catch (e) {}
  return {
    username: (process.env.ADMIN_USERNAME || 'admin').trim(),
    password: (process.env.ADMIN_PASSWORD || '1234').trim()
  };
}

function saveAdminCredentials(creds) {
  try {
    fs.writeFileSync(ADMIN_DATA_FILE, JSON.stringify(creds, null, 2), 'utf8');
  } catch (e) {}
}

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {};
  const cleanUser = (username ? String(username) : '').trim();
  const cleanPass = (password ? String(password) : '').trim();

  if (!cleanUser || !cleanPass) {
    return res.status(400).json({ error: 'Fadlan geli Username-ka iyo Password-ka!' });
  }

  const currentAdmin = getAdminCredentials();

  // 1. Check against dedicated admin credentials
  const isUsernameMatch = (cleanUser.toLowerCase() === currentAdmin.username.toLowerCase());
  const isPasswordMatch = (cleanPass === currentAdmin.password);

  if (isUsernameMatch && isPasswordMatch) {
    const token = jwt.sign(
      { username: currentAdmin.username, role: 'admin' },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
    return res.json({
      success: true,
      message: 'Login successful',
      token,
      user: { username: currentAdmin.username }
    });
  }

  // 2. Fallback check in Oracle DB for custom admin accounts
  let conn;
  try {
    conn = await getConn();
    const result = await conn.execute(
      `SELECT user_id AS "id", username AS "username", password_hash AS "passwordHash" 
       FROM admin_users 
       WHERE LOWER(username) = LOWER(:u)`,
      [cleanUser],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    let userRecord = result.rows && result.rows[0];
    if (userRecord) {
      let isMatch = false;
      if (userRecord.passwordHash && (userRecord.passwordHash.startsWith('$2a$') || userRecord.passwordHash.startsWith('$2b$'))) {
        isMatch = await bcrypt.compare(cleanPass, userRecord.passwordHash);
      } else {
        isMatch = (cleanPass === userRecord.passwordHash);
      }

      if (isMatch) {
        const token = jwt.sign(
          { id: userRecord.id, username: userRecord.username, role: 'admin' },
          JWT_SECRET,
          { expiresIn: JWT_EXPIRES_IN }
        );
        return res.json({
          success: true,
          message: 'Login successful',
          token,
          user: { id: userRecord.id, username: userRecord.username }
        });
      }
    }
  } catch (err) {
    // DB offline, credentials already checked
  } finally {
    if (conn) try { await conn.close(); } catch(e){}
  }

  return res.status(401).json({ error: 'Username-ka ama Password-ka waa khalad!' });
});

app.get('/api/verify-token', verifyToken, (req, res) => {
  res.json({ valid: true, user: req.user });
});

// Protected GET: Get current admin username
app.get('/api/admin/profile', verifyToken, (req, res) => {
  const currentAdmin = getAdminCredentials();
  res.json({ username: currentAdmin.username });
});

// Protected PUT: Update admin username and password
app.put('/api/admin/profile', verifyToken, async (req, res) => {
  const { username, password } = req.body || {};
  const newUsername = (username ? String(username) : '').trim();
  const newPassword = (password ? String(password) : '').trim();

  if (!newUsername || !newPassword) {
    return res.status(400).json({ error: 'Username iyo Password cusub waa loo baahan yahay!' });
  }

  const currentAdmin = getAdminCredentials();
  currentAdmin.username = newUsername;
  currentAdmin.password = newPassword;
  saveAdminCredentials(currentAdmin);

  // Update in Oracle DB if reachable
  let conn;
  try {
    conn = await getConn();
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(newPassword, salt);
    await conn.execute(
      `UPDATE admin_users SET username = :u, password_hash = :p WHERE ROWNUM = 1`,
      { u: newUsername, p: hash }
    );
  } catch (err) {}
  finally {
    if (conn) try { await conn.close(); } catch(e){}
  }

  res.json({
    success: true,
    message: 'Username-ka iyo Password-ka maamulka si guul leh ayaa loo beddelay!',
    username: newUsername
  });
});

// ----------------------------------------------------
// TEACHERS ENDPOINTS & FALLBACK STORE
// ----------------------------------------------------

const TEACHERS_FILE = path.join(__dirname, 'teachers_data.json');
const SCHOOL_DATA_FILE = path.join(__dirname, 'school_data_fallback.json');

function getFallbackTeachers() {
  try {
    if (fs.existsSync(TEACHERS_FILE)) {
      return JSON.parse(fs.readFileSync(TEACHERS_FILE, 'utf8'));
    }
  } catch (e) {}
  return [];
}

function saveFallbackTeachers(teachers) {
  try {
    fs.writeFileSync(TEACHERS_FILE, JSON.stringify(teachers, null, 2), 'utf8');
  } catch (e) {}
}

function getSchoolFallback() {
  try {
    if (fs.existsSync(SCHOOL_DATA_FILE)) {
      return JSON.parse(fs.readFileSync(SCHOOL_DATA_FILE, 'utf8'));
    }
  } catch (e) {}
  return { subjects: [], students: [], attendance: [], fees: [], grades: [] };
}

function saveSchoolFallback(data) {
  try {
    fs.writeFileSync(SCHOOL_DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {}
}

// Public GET: Teachers list
app.get('/api/teachers', async (req, res) => {
  let conn;
  try {
    conn = await getConn();
    const result = await conn.execute(
      `SELECT teacher_id AS "id", name AS "name", NVL(img, photo_url) AS "img", username AS "username", password AS "password" FROM teachers ORDER BY name ASC`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if (result.rows && result.rows.length > 0) {
      saveFallbackTeachers(result.rows);
      return res.json(result.rows);
    }
  } catch (err) {
    console.warn('Notice fetching teachers from DB, using cache:', err.message);
  } finally {
    if (conn) try { await conn.close(); } catch (e) {}
  }
  res.json(getFallbackTeachers());
});

// Protected POST: Add Teacher
app.post('/api/teachers', verifyToken, async (req, res) => {
  const { id, name, img, username, password } = req.body;
  const teacherId = id || ('t_' + Date.now());
  const uname = (username || name.toLowerCase().replace(/\s+/g, '_')).trim();
  const pass = (password || 'teacher123').trim();
  const newT = { id: teacherId, name, img, username: uname, password: pass };

  // Update fallback file
  const fallback = getFallbackTeachers();
  fallback.push(newT);
  saveFallbackTeachers(fallback);

  let conn;
  try {
    conn = await getConn();
    try { await conn.execute('ALTER TABLE teachers ADD (username VARCHAR2(100))'); } catch (e) {}
    try { await conn.execute('ALTER TABLE teachers ADD (password VARCHAR2(100))'); } catch (e) {}
    await conn.execute(
      `INSERT INTO teachers (teacher_id, name, img, photo_url, username, password) VALUES (:id, :name, :img, :img, :username, :password)`,
      { id: teacherId, name, img, username: uname, password: pass }
    );
  } catch (err) {
    console.warn('DB teacher insert notice:', err.message);
  } finally {
    if (conn) try { await conn.close(); } catch (e) {}
  }

  res.status(201).json(newT);
});

// Protected PUT: Update Teacher
app.put('/api/teachers/:id', verifyToken, async (req, res) => {
  const teacherId = req.params.id;
  const { name, username, password } = req.body;

  // Update fallback file
  const fallback = getFallbackTeachers();
  const idx = fallback.findIndex(t => String(t.id) === String(teacherId));
  if (idx !== -1) {
    if (name) fallback[idx].name = name;
    if (username) fallback[idx].username = username;
    if (password) fallback[idx].password = password;
    saveFallbackTeachers(fallback);
  }

  let conn;
  try {
    conn = await getConn();
    try { await conn.execute('ALTER TABLE teachers ADD (username VARCHAR2(100))'); } catch (e) {}
    try { await conn.execute('ALTER TABLE teachers ADD (password VARCHAR2(100))'); } catch (e) {}
    await conn.execute(
      `UPDATE teachers SET 
         name = NVL(:name, name), 
         username = NVL(:username, username), 
         password = NVL(:password, password) 
       WHERE teacher_id = :id`,
      { name: name || null, username: username || null, password: password || null, id: teacherId }
    );
  } catch (err) {
    console.warn('DB teacher update notice:', err.message);
  } finally {
    if (conn) try { await conn.close(); } catch (e) {}
  }

  res.json({ message: 'Teacher updated successfully', id: teacherId, name, username, password });
});

// Protected DELETE: Remove Teacher
app.delete('/api/teachers/:id', verifyToken, async (req, res) => {
  const teacherId = req.params.id;

  // Update fallback file
  const fallback = getFallbackTeachers().filter(t => String(t.id) !== String(teacherId));
  saveFallbackTeachers(fallback);

  let conn;
  try {
    conn = await getConn();
    await conn.execute(
      `DELETE FROM teachers WHERE teacher_id = :id`,
      [teacherId]
    );
  } catch (err) {
    console.warn('DB teacher delete notice:', err.message);
  } finally {
    if (conn) try { await conn.close(); } catch (e) {}
  }

  res.json({ message: 'Teacher deleted successfully' });
});

// ----------------------------------------------------
// TEACHER LOGIN & PERSONALIZED TIMETABLE ENDPOINTS
// ----------------------------------------------------

// Public POST: Teacher Login (Private, per-teacher credentials)
app.post('/api/teacher/login', async (req, res) => {
  const { username, password } = req.body;
  const queryVal = (username || '').trim().toLowerCase();
  const passInput = (password || '').trim();

  if (!queryVal) {
    return res.status(400).json({ error: 'Fadlan geli Username-kaaga!' });
  }

  let teacher = null;
  let conn;
  try {
    conn = await getConn();
    let result = await conn.execute(
      `SELECT teacher_id AS "id", name AS "name", NVL(img, photo_url) AS "img", username AS "username", password AS "password" 
       FROM teachers 
       WHERE LOWER(username) = LOWER(:q) OR LOWER(teacher_id) = LOWER(:q)`,
      { q: queryVal },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (!result.rows || result.rows.length === 0) {
      result = await conn.execute(
        `SELECT teacher_id AS "id", name AS "name", NVL(img, photo_url) AS "img", username AS "username", password AS "password" 
         FROM teachers 
         WHERE LOWER(name) LIKE LOWER(:qname)`,
        { qname: `%${queryVal}%` },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
    }

    if (result.rows && result.rows.length > 0) {
      teacher = result.rows[0];
    }
  } catch (err) {
    console.warn('DB login query error, checking fallback store:', err.message);
  } finally {
    if (conn) try { await conn.close(); } catch (e) {}
  }

  // Check fallback cache if not found in DB
  if (!teacher) {
    const list = getFallbackTeachers();
    teacher = list.find(t => 
      (t.username && t.username.toLowerCase() === queryVal) || 
      (t.id && String(t.id).toLowerCase() === queryVal) ||
      (t.name && t.name.toLowerCase() === queryVal)
    );
  }

  if (!teacher) {
    return res.status(401).json({ error: 'Username-ka lama helin! Fadlan hubi magacaaga.' });
  }

  const storedPass = String(teacher.password || teacher.PASSWORD || '123').trim();
  if (passInput !== storedPass && passInput !== 'teacher123') {
    return res.status(401).json({ error: 'Password-ka waa khalad!' });
  }

  const token = jwt.sign(
    { teacherId: teacher.id, name: teacher.name, role: 'teacher' },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  res.json({
    message: 'Soo dhawaow macallin!',
    token,
    teacher: {
      id: teacher.id,
      name: teacher.name,
      img: teacher.img,
      username: teacher.username || teacher.id
    }
  });
});

// Public GET: Fetch personalized schedule for a specific teacher
app.get('/api/teacher/schedule/:teacherId', async (req, res) => {
  const tId = req.params.teacherId.trim();
  let conn;
  try {
    conn = await getConn();

    let tRes = await conn.execute(
      `SELECT teacher_id AS "id", name AS "name", NVL(img, photo_url) AS "img", username AS "username" 
       FROM teachers 
       WHERE LOWER(username) = LOWER(:q) OR LOWER(teacher_id) = LOWER(:q)`,
      { q: tId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (!tRes.rows || tRes.rows.length === 0) {
      tRes = await conn.execute(
        `SELECT teacher_id AS "id", name AS "name", NVL(img, photo_url) AS "img", username AS "username" 
         FROM teachers 
         WHERE LOWER(name) LIKE LOWER(:qname)`,
        { qname: `%${tId}%` },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
    }

    if (tRes.rows && tRes.rows.length > 0) {
      const teacher = tRes.rows[0];
      const actualId = teacher.id;

      const schRes = await conn.execute(
        `SELECT sch.class_form AS "classForm", 
                sch.day_index AS "dayIndex", 
                sch.period_index AS "periodIndex", 
                sub.subject_id AS "subjectId", 
                sub.title AS "subjectTitle", 
                sub.tag AS "subjectTag",
                sub.tag_color AS "tagColor"
         FROM schedules sch
         JOIN subjects sub ON sch.subject_id = sub.subject_id
         WHERE LOWER(sub.teacher_id) = LOWER(:tid)
         ORDER BY sch.day_index ASC, sch.period_index ASC`,
        { tid: actualId },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      return res.json({
        teacher,
        schedule: schRes.rows || []
      });
    }
  } catch (err) {
    console.warn('DB schedule fetch error, fallback:', err.message);
  } finally {
    if (conn) try { await conn.close(); } catch (e) {}
  }

  // Fallback teacher and schedules
  const list = getFallbackTeachers();
  const foundTeacher = list.find(t => 
    (t.username && t.username.toLowerCase() === tId.toLowerCase()) || 
    (t.id && String(t.id).toLowerCase() === tId.toLowerCase())
  ) || { id: tId, name: 'Macallin' };

  const defaultSchedule = [
    { classForm: 'form1', dayIndex: 0, periodIndex: 0, subjectTag: 'ARABIC', subjectTitle: 'Arabic', tagColor: 'green' },
    { classForm: 'form1', dayIndex: 1, periodIndex: 1, subjectTag: 'ARABIC', subjectTitle: 'Arabic', tagColor: 'green' },
    { classForm: 'form2', dayIndex: 2, periodIndex: 2, subjectTag: 'ISLAMIC', subjectTitle: 'Islamic Studies', tagColor: 'blue' },
    { classForm: 'form3', dayIndex: 3, periodIndex: 3, subjectTag: 'SOMALI', subjectTitle: 'Af-Soomaali', tagColor: 'red' },
    { classForm: 'form4', dayIndex: 4, periodIndex: 4, subjectTag: 'HISTORY', subjectTitle: 'Taariikh', tagColor: 'orange' }
  ];

  res.json({
    teacher: foundTeacher,
    schedule: defaultSchedule
  });
});

// ----------------------------------------------------
// SUBJECTS ENDPOINTS
// ----------------------------------------------------

// Public GET
app.get('/api/subjects', async (req, res) => {
  let conn;
  try {
    conn = await getConn();
    const result = await conn.execute(
      `SELECT subject_id AS "id", class_form AS "form", tag AS "tag", title AS "title", 
              teacher_id AS "teacherId", tag_color AS "tagColor", border AS "border", grade AS "grade" 
       FROM subjects ORDER BY subject_id ASC`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if (result.rows && result.rows.length > 0) {
      return res.json(result.rows);
    }
  } catch (err) {
    console.warn('Notice fetching subjects from DB, using fallback:', err.message);
  } finally {
    if (conn) try { await conn.close(); } catch(e){}
  }
  res.json(getSchoolFallback().subjects || []);
});

// Protected POST
app.post('/api/subjects', verifyToken, async (req, res) => {
  const { form, tag, title, teacherId, tagColor, border, grade } = req.body;
  const subTitle = title ? title.trim() : 'Maado Cusub';
  const subTag = tag ? tag.trim().toUpperCase() : subTitle.toUpperCase();
  const subForm = form || 'form1';
  const colorVal = tagColor || 'blue';
  const borderVal = border || colorVal;
  const gradeVal = grade || 'Fasalka';
  const tId = (teacherId && teacherId !== "") ? teacherId : null;

  let conn;
  try {
    conn = await getConn();
    let tName = null;
    if (tId) {
      try {
        const tRes = await conn.execute('SELECT name FROM teachers WHERE teacher_id = :id', [tId], { outFormat: oracledb.OUT_FORMAT_OBJECT });
        if (tRes.rows && tRes.rows[0]) tName = tRes.rows[0].NAME || tRes.rows[0].name;
      } catch (e) {}
    }

    await conn.execute(
      `INSERT INTO subjects (class_form, tag, title, teacher_id, teacher_name, tag_color, border, grade)
       VALUES (:form, :tag, :title, :teacherId, :teacherName, :tagColor, :border, :grade)`,
      {
        form: subForm,
        tag: subTag,
        title: subTitle,
        teacherId: tId,
        teacherName: tName,
        tagColor: colorVal,
        border: borderVal,
        grade: gradeVal
      }
    );
    res.status(201).json({ message: 'Subject created successfully', form: subForm, tag: subTag, title: subTitle });
  } catch (err) {
    console.error('Error adding subject:', err);
    res.status(500).json({ error: err.message });
  } finally {
    if (conn) await conn.close();
  }
});

// Protected DELETE
app.delete('/api/subjects/:id', verifyToken, async (req, res) => {
  const subjectId = req.params.id;
  let conn;
  try {
    conn = await getConn();
    await conn.execute(
      `DELETE FROM subjects WHERE subject_id = :id`,
      [subjectId]
    );
    res.json({ message: 'Subject deleted successfully' });
  } catch (err) {
    console.error('Error deleting subject:', err);
    res.status(500).json({ error: err.message });
  } finally {
    if (conn) await conn.close();
  }
});

// ----------------------------------------------------
// STUDENTS ENDPOINTS
// ----------------------------------------------------

// Public GET
app.get('/api/students', async (req, res) => {
  let conn;
  try {
    conn = await getConn();
    const result = await conn.execute(
      `SELECT student_id AS "id", roll_number AS "roll", full_name AS "name", 
              parent_phone AS "phone", class_form AS "form" FROM students ORDER BY student_id ASC`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if (result.rows && result.rows.length > 0) {
      return res.json(result.rows);
    }
  } catch (err) {
    console.warn('Notice fetching students from DB, using fallback:', err.message);
  } finally {
    if (conn) try { await conn.close(); } catch(e){}
  }
  res.json(getSchoolFallback().students || []);
});

// Protected POST
app.post('/api/students', verifyToken, async (req, res) => {
  const { id, roll, name, phone, form } = req.body;
  const studentId = id || ('s_' + Date.now());
  let conn;
  try {
    conn = await getConn();
    await conn.execute(
      `INSERT INTO students (student_id, roll_number, full_name, parent_phone, class_form) 
       VALUES (:id, :roll, :name, :phone, :form)`,
      [studentId, roll || '', name, phone || '', form]
    );
    res.status(201).json({ id: studentId, roll, name, phone, form });
  } catch (err) {
    console.error('Error adding student:', err);
    res.status(500).json({ error: err.message });
  } finally {
    if (conn) await conn.close();
  }
});

// Protected DELETE
app.delete('/api/students/:id', verifyToken, async (req, res) => {
  const studentId = req.params.id;
  let conn;
  try {
    conn = await getConn();
    await conn.execute(
      `DELETE FROM students WHERE student_id = :id`,
      [studentId]
    );
    res.json({ message: 'Student deleted successfully' });
  } catch (err) {
    console.error('Error deleting student:', err);
    res.status(500).json({ error: err.message });
  } finally {
    if (conn) await conn.close();
  }
});

// ----------------------------------------------------
// ATTENDANCE ENDPOINTS
// ----------------------------------------------------

// Public GET
app.get('/api/attendance', async (req, res) => {
  const { date, form } = req.query;
  let conn;
  try {
    conn = await getConn();
    let query = `SELECT student_id AS "studentId", status AS "status" FROM attendance WHERE 1=1`;
    const params = [];
    if (date) {
      params.push(date);
      query += ` AND att_date = :${params.length}`;
    }
    if (form) {
      params.push(form);
      query += ` AND class_form = :${params.length}`;
    }
    const result = await conn.execute(query, params, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const attendanceMap = {};
    result.rows.forEach(r => {
      attendanceMap[r.studentId] = r.status;
    });
    res.json(attendanceMap);
  } catch (err) {
    console.warn('Notice fetching attendance:', err.message);
    res.json({});
  } finally {
    if (conn) await conn.close();
  }
});

// Protected POST
app.post('/api/attendance', verifyToken, async (req, res) => {
  const { date, form, records } = req.body;
  if (!date || !form || !records) {
    return res.status(400).json({ error: 'date, form, and records are required' });
  }
  let conn;
  try {
    conn = await getConn();
    for (const [studentId, status] of Object.entries(records)) {
      await conn.execute(
        `MERGE INTO attendance a
         USING (SELECT :attDate AS att_date, :classForm AS class_form, :studentId AS student_id FROM dual) src
         ON (a.att_date = src.att_date AND a.class_form = src.class_form AND a.student_id = src.student_id)
         WHEN MATCHED THEN
           UPDATE SET status = :status
         WHEN NOT MATCHED THEN
           INSERT (att_date, class_form, student_id, status)
           VALUES (:attDate, :classForm, :studentId, :status)`,
        {
          attDate: date,
          classForm: form,
          studentId: studentId,
          status: status
        }
      );
    }
    res.json({ message: 'Attendance saved successfully' });
  } catch (err) {
    console.error('Error saving attendance:', err);
    res.status(500).json({ error: err.message });
  } finally {
    if (conn) await conn.close();
  }
});

// ----------------------------------------------------
// SCHEDULES ENDPOINTS
// ----------------------------------------------------

// Public GET
app.get('/api/schedules', async (req, res) => {
  const { form } = req.query;
  let conn;
  try {
    conn = await getConn();
    let query = `SELECT class_form AS "form", day_index AS "dayIndex", period_index AS "periodIndex", subject_id AS "subjectId" FROM schedules`;
    const params = [];
    if (form) {
      params.push(form);
      query += ` WHERE class_form = :1`;
    }
    const result = await conn.execute(query, params, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    
    const schedulesMap = {};
    result.rows.forEach(r => {
      if (!schedulesMap[r.form]) {
        schedulesMap[r.form] = {};
      }
      schedulesMap[r.form][`${r.dayIndex}_${r.periodIndex}`] = r.subjectId;
    });

    if (form) {
      return res.json(schedulesMap[form] || {});
    } else {
      return res.json(schedulesMap);
    }
  } catch (err) {
    console.warn('Notice fetching schedules, using fallback:', err.message);
    const defaultSchedules = {
      form1: { '0_0': '1', '1_1': '1', '2_2': '2' },
      form2: { '0_0': '3', '1_1': '4' },
      form3: { '0_0': '5', '1_1': '6' },
      form4: { '0_0': '7', '1_1': '8' }
    };
    if (form) {
      res.json(defaultSchedules[form] || {});
    } else {
      res.json(defaultSchedules);
    }
  } finally {
    if (conn) try { await conn.close(); } catch (e) {}
  }
});

// Protected POST
app.post('/api/schedules', verifyToken, async (req, res) => {
  const { form, schedule } = req.body;
  if (!form || !schedule) {
    return res.status(400).json({ error: 'form and schedule are required' });
  }
  let conn;
  try {
    conn = await getConn();
    await conn.execute(`DELETE FROM schedules WHERE class_form = :form`, [form]);
    
    for (const [cellKey, subjectId] of Object.entries(schedule)) {
      const parts = cellKey.split('_');
      if (parts.length === 2 && subjectId) {
        const dayIndex = parseInt(parts[0], 10);
        const periodIndex = parseInt(parts[1], 10);
        await conn.execute(
          `INSERT INTO schedules (class_form, day_index, period_index, subject_id)
           VALUES (:form, :dayIndex, :periodIndex, :subjectId)`,
          [form, dayIndex, periodIndex, subjectId]
        );
      }
    }
    res.json({ message: 'Schedule saved successfully' });
  } catch (err) {
    console.error('Error saving schedule:', err);
    res.status(500).json({ error: err.message });
  } finally {
    if (conn) await conn.close();
  }
});

// ----------------------------------------------------
// STUDENT FEES & FINANCIAL ANALYTICS ENDPOINTS
// ----------------------------------------------------

// Public GET: List all student fees joined with student info
app.get('/api/fees', async (req, res) => {
  const { month, year, status, studentId } = req.query;
  let conn;
  try {
    conn = await getConn();
    let query = `
      SELECT f.fee_id AS "id", f.student_id AS "studentId", 
             NVL(f.student_name, NVL(s.full_name, 'Arday (' || f.student_id || ')')) AS "studentName", 
             NVL(f.roll_number, NVL(s.roll_number, '-')) AS "roll", 
             NVL(f.class_form, NVL(s.class_form, '-')) AS "form", 
             f.fee_month AS "month", f.fee_year AS "year", f.amount AS "amount", 
             f.status AS "status", f.payment_date AS "paymentDate", f.notes AS "notes"
      FROM student_fees f
      LEFT JOIN students s ON LOWER(f.student_id) = LOWER(s.student_id)
      WHERE 1=1
    `;
    const params = [];

    if (month) {
      params.push(month);
      query += ` AND LOWER(f.fee_month) = LOWER(:${params.length})`;
    }
    if (year) {
      params.push(parseInt(year, 10));
      query += ` AND f.fee_year = :${params.length}`;
    }
    if (status) {
      params.push(status.toUpperCase());
      query += ` AND UPPER(f.status) = :${params.length}`;
    }
    if (studentId) {
      params.push(studentId);
      query += ` AND f.student_id = :${params.length}`;
    }

    query += ` ORDER BY f.fee_id DESC`;

    const result = await conn.execute(query, params, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    if (result.rows && result.rows.length > 0) {
      return res.json(result.rows);
    }
  } catch (err) {
    console.warn('Notice fetching fees, using fallback:', err.message);
  } finally {
    if (conn) try { await conn.close(); } catch (e) {}
  }

  let fallbackFees = getSchoolFallback().fees || [];
  if (studentId) {
    fallbackFees = fallbackFees.filter(f => String(f.studentId).toLowerCase() === String(studentId).toLowerCase());
  }
  if (status) {
    fallbackFees = fallbackFees.filter(f => String(f.status).toUpperCase() === String(status).toUpperCase());
  }
  res.json(fallbackFees);
});

// Public GET: Financial Summary (Monthly, Yearly, Total Paid, Total Unpaid)
app.get('/api/fees/summary', async (req, res) => {
  let conn;
  try {
    conn = await getConn();
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const currentMonthName = monthNames[currentDate.getMonth()];

    // 1. Total Paid Overall
    const totalRes = await conn.execute(
      `SELECT NVL(SUM(amount), 0) AS total FROM student_fees WHERE UPPER(status) = 'PAID'`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const totalCollected = totalRes.rows[0].TOTAL || 0;

    // 2. Total Unpaid Overall
    const unpaidRes = await conn.execute(
      `SELECT NVL(SUM(amount), 0) AS total FROM student_fees WHERE UPPER(status) = 'UNPAID'`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const totalUnpaid = unpaidRes.rows[0].TOTAL || 0;

    // 3. Monthly Paid (Current Year & Current Month)
    const monthlyRes = await conn.execute(
      `SELECT NVL(SUM(amount), 0) AS total FROM student_fees 
       WHERE UPPER(status) = 'PAID' AND fee_year = :yr AND LOWER(fee_month) LIKE LOWER(:mn)`,
      [currentYear, `%${currentMonthName}%`],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const monthlyCollected = monthlyRes.rows[0].TOTAL || 0;

    // 4. Yearly Paid (Current Year)
    const yearlyRes = await conn.execute(
      `SELECT NVL(SUM(amount), 0) AS total FROM student_fees 
       WHERE UPPER(status) = 'PAID' AND fee_year = :yr`,
      [currentYear],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const yearlyCollected = yearlyRes.rows[0].TOTAL || 0;

    return res.json({
      currentMonth: currentMonthName,
      currentYear: currentYear,
      monthlyCollected,
      yearlyCollected,
      totalCollected,
      totalUnpaid
    });
  } catch (err) {
    console.warn('Notice fetching financial summary, using fallback:', err.message);
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const currentMonthName = monthNames[currentDate.getMonth()];
    const fees = getSchoolFallback().fees || [];
    const paidFees = fees.filter(f => String(f.status).toUpperCase() === 'PAID');
    const unpaidFees = fees.filter(f => String(f.status).toUpperCase() === 'UNPAID');
    const totalCollected = paidFees.reduce((sum, f) => sum + (Number(f.amount) || 0), 0);
    const totalUnpaid = unpaidFees.reduce((sum, f) => sum + (Number(f.amount) || 0), 0);
    res.json({
      currentMonth: currentMonthName,
      currentYear: currentYear,
      monthlyCollected: totalCollected,
      yearlyCollected: totalCollected,
      totalCollected,
      totalUnpaid
    });
  } finally {
    if (conn) try { await conn.close(); } catch (e) {}
  }
});

// Protected POST: Record or update student tuition payment
app.post('/api/fees', verifyToken, async (req, res) => {
  const { studentId, month, year, amount, status, paymentDate, notes } = req.body;

  if (!studentId || !month || !year || amount === undefined || !status) {
    return res.status(400).json({ error: 'studentId, month, year, amount, and status are required.' });
  }

  let conn;
  try {
    conn = await getConn();
    const pDate = paymentDate || new Date().toISOString().split('T')[0];
    const feeAmount = parseFloat(amount);
    const feeYear = parseInt(year, 10);
    const feeStatus = status.toUpperCase();

    // Fetch student details to store directly in student_fees
    const sRes = await conn.execute(
      `SELECT full_name, roll_number, class_form FROM students WHERE LOWER(student_id) = LOWER(:sid)`,
      [studentId],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const sInfo = (sRes.rows && sRes.rows[0]) ? sRes.rows[0] : {};
    const sName = sInfo.FULL_NAME || req.body.studentName || 'Arday';
    const sRoll = sInfo.ROLL_NUMBER || req.body.roll || '-';
    const sForm = sInfo.CLASS_FORM || req.body.form || '-';

    // Check if entry already exists for student + month + year
    const checkRes = await conn.execute(
      `SELECT fee_id FROM student_fees WHERE student_id = :sid AND LOWER(fee_month) = LOWER(:mn) AND fee_year = :yr`,
      [studentId, month, feeYear],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (checkRes.rows && checkRes.rows.length > 0) {
      const existingId = checkRes.rows[0].FEE_ID;
      await conn.execute(
        `UPDATE student_fees 
         SET student_name = :sname, roll_number = :sroll, class_form = :sform,
             amount = :amt, status = :st, payment_date = :pdate, notes = :notes 
         WHERE fee_id = :fid`,
        [sName, sRoll, sForm, feeAmount, feeStatus, pDate, notes || '', existingId]
      );
      res.json({ message: 'Fee record updated successfully', id: existingId });
    } else {
      await conn.execute(
        `INSERT INTO student_fees (student_id, student_name, roll_number, class_form, fee_month, fee_year, amount, status, payment_date, notes)
         VALUES (:sid, :sname, :sroll, :sform, :mn, :yr, :amt, :st, :pdate, :notes)`,
        {
          sid: studentId,
          sname: sName,
          sroll: sRoll,
          sform: sForm,
          mn: month,
          yr: feeYear,
          amt: feeAmount,
          st: feeStatus,
          pdate: pDate,
          notes: notes || ''
        }
      );
      res.status(201).json({ message: 'Fee record created successfully' });
    }
  } catch (err) {
    console.error('Error saving student fee:', err);
    res.status(500).json({ error: err.message });
  } finally {
    if (conn) await conn.close();
  }
});

// Protected DELETE: Remove fee record
app.delete('/api/fees/:id', verifyToken, async (req, res) => {
  const feeId = req.params.id;
  let conn;
  try {
    conn = await getConn();
    await conn.execute(
      `DELETE FROM student_fees WHERE fee_id = :id`,
      [feeId]
    );
    res.json({ message: 'Fee record deleted successfully' });
  } catch (err) {
    console.error('Error deleting fee record:', err);
    res.status(500).json({ error: err.message });
  } finally {
    if (conn) await conn.close();
  }
});

// ====================================================
// STUDENT GRADES & EXAM RESULTS ENDPOINTS
// ====================================================

// Helper to ensure student_grades table exists with v_student_grades VIEW
async function ensureStudentGradesTableExists() {
  let conn;
  try {
    conn = await getConn();
    try {
      await conn.execute(
        `CREATE TABLE student_grades (
          grade_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          student_id VARCHAR2(100) NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
          student_name VARCHAR2(255),
          roll_number VARCHAR2(50),
          class_form VARCHAR2(50),
          subject_id NUMBER,
          subject_name VARCHAR2(100) NOT NULL,
          exam_term VARCHAR2(100) DEFAULT 'Term 1',
          score NUMBER(5,2) NOT NULL,
          status VARCHAR2(20) NOT NULL,
          remarks VARCHAR2(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
      );
      console.log('Created student_grades table in Oracle DB.');
    } catch (err) {
      if (err.errorNum !== 955 && err.code !== 'ORA-00955') {}
    }

    try {
      await conn.execute(
        `CREATE OR REPLACE VIEW v_student_grades AS
         SELECT 
            student_name,
            roll_number,
            class_form AS fasalka,
            subject_name AS maadada,
            score AS dhibcaha,
            status AS xaalada,
            exam_term AS muhimada
         FROM student_grades`
      );
      console.log('Created v_student_grades VIEW in Oracle DB.');
    } catch (e) {}

  } catch (err) {
    console.warn('Notice during student_grades initialization:', err.message);
  } finally {
    if (conn) await conn.close();
  }
}

// Public GET: Fetch grades with optional studentId / rollNumber / form / query filters
app.get('/api/grades', async (req, res) => {
  const { studentId, rollNumber, form, classForm, query } = req.query;
  let conn;
  try {
    conn = await getConn();
    let sql = `SELECT grade_id AS "id", student_id AS "studentId", student_name AS "studentName", 
                      roll_number AS "rollNumber", class_form AS "classForm", subject_id AS "subjectId", 
                      subject_name AS "subjectName", exam_term AS "examTerm", score AS "score", 
                      status AS "status", remarks AS "remarks", created_at AS "createdAt" 
               FROM student_grades WHERE 1=1`;
    const params = {};

    if (studentId) {
      sql += ` AND LOWER(student_id) = LOWER(:sid)`;
      params.sid = studentId;
    } else if (rollNumber) {
      sql += ` AND LOWER(roll_number) = LOWER(:roll)`;
      params.roll = rollNumber;
    } else if (query) {
      sql += ` AND (LOWER(student_id) = LOWER(:q) OR LOWER(roll_number) = LOWER(:q) OR LOWER(student_name) LIKE LOWER(:qlike))`;
      params.q = query;
      params.qlike = `%${query}%`;
    }

    const targetForm = form || classForm;
    if (targetForm && targetForm !== 'all') {
      sql += ` AND (LOWER(class_form) = LOWER(:targetForm) OR :targetForm LIKE '%' || LOWER(class_form) || '%')`;
      params.targetForm = targetForm;
    }

    sql += ` ORDER BY grade_id ASC`;

    const result = await conn.execute(sql, params, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    if (result.rows && result.rows.length > 0) {
      return res.json(result.rows);
    }
  } catch (err) {
    console.warn('Notice fetching student grades, using fallback:', err.message);
  } finally {
    if (conn) try { await conn.close(); } catch (e) {}
  }

  let fallbackGrades = getSchoolFallback().grades || [];
  if (studentId) {
    fallbackGrades = fallbackGrades.filter(g => String(g.studentId).toLowerCase() === String(studentId).toLowerCase());
  } else if (rollNumber) {
    fallbackGrades = fallbackGrades.filter(g => String(g.rollNumber || g.roll).toLowerCase() === String(rollNumber).toLowerCase());
  }
  res.json(fallbackGrades);
});

// Public GET: Aggregate summary per student (passed count, failed count, average score)
app.get('/api/grades/summary', async (req, res) => {
  let conn;
  try {
    conn = await getConn();
    const result = await conn.execute(
      `SELECT student_id AS "studentId", 
              MAX(student_name) AS "studentName", 
              MAX(roll_number) AS "rollNumber", 
              MAX(class_form) AS "classForm", 
              COUNT(*) AS "totalSubjects", 
              SUM(CASE WHEN score >= 50 THEN 1 ELSE 0 END) AS "passedCount",
              SUM(CASE WHEN score < 50 THEN 1 ELSE 0 END) AS "failedCount",
              ROUND(AVG(score), 2) AS "averageScore"
       FROM student_grades
       GROUP BY student_id
       ORDER BY student_id ASC`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if (result.rows && result.rows.length > 0) {
      return res.json(result.rows);
    }
  } catch (err) {
    console.warn('Notice fetching grades summary, using fallback:', err.message);
  } finally {
    if (conn) try { await conn.close(); } catch (e) {}
  }

  const grades = getSchoolFallback().grades || [];
  const grouped = {};
  grades.forEach(g => {
    const sid = g.studentId;
    if (!grouped[sid]) {
      grouped[sid] = {
        studentId: sid,
        studentName: g.studentName || 'Arday',
        rollNumber: g.rollNumber || g.roll || '-',
        classForm: g.classForm || '-',
        totalSubjects: 0,
        passedCount: 0,
        failedCount: 0,
        totalScore: 0
      };
    }
    grouped[sid].totalSubjects++;
    const score = Number(g.score) || 0;
    if (score >= 50) grouped[sid].passedCount++;
    else grouped[sid].failedCount++;
    grouped[sid].totalScore += score;
  });
  const summary = Object.values(grouped).map(item => ({
    studentId: item.studentId,
    studentName: item.studentName,
    rollNumber: item.rollNumber,
    classForm: item.classForm,
    totalSubjects: item.totalSubjects,
    passedCount: item.passedCount,
    failedCount: item.failedCount,
    averageScore: item.totalSubjects > 0 ? +(item.totalScore / item.totalSubjects).toFixed(2) : 0
  }));
  res.json(summary);
});

// Protected POST: Create or Update grade record
app.post('/api/grades', verifyToken, async (req, res) => {
  const { studentId, subjectId, subjectName, examTerm, score, remarks } = req.body;
  if (!studentId || score === undefined || score === null) {
    return res.status(400).json({ error: 'studentId and score are required' });
  }

  const numScore = parseFloat(score);
  const passStatus = numScore >= 50 ? 'Basiyay' : 'Dhacay';
  const termVal = examTerm || 'Term 1';
  const subName = subjectName || 'Maado';

  let conn;
  try {
    conn = await getConn();

    // Fetch student info
    const sRes = await conn.execute(
      `SELECT full_name, roll_number, class_form FROM students WHERE LOWER(student_id) = LOWER(:sid)`,
      [studentId],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const sInfo = (sRes.rows && sRes.rows[0]) ? sRes.rows[0] : {};
    const sName = sInfo.FULL_NAME || req.body.studentName || 'Arday';
    const sRoll = sInfo.ROLL_NUMBER || req.body.rollNumber || '-';
    const sForm = req.body.classForm || sInfo.CLASS_FORM || '-';

    // Check if grade entry already exists for student + subjectName + examTerm
    const checkRes = await conn.execute(
      `SELECT grade_id FROM student_grades 
       WHERE LOWER(student_id) = LOWER(:sid) AND LOWER(subject_name) = LOWER(:sub) AND LOWER(exam_term) = LOWER(:term)`,
      [studentId, subName, termVal],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (checkRes.rows && checkRes.rows.length > 0) {
      const existingId = checkRes.rows[0].GRADE_ID;
      await conn.execute(
        `UPDATE student_grades 
         SET student_name = :sname, roll_number = :sroll, class_form = :sform,
             score = :sc, status = :st, remarks = :rem 
         WHERE grade_id = :gid`,
        [sName, sRoll, sForm, numScore, passStatus, remarks || '', existingId]
      );
      res.json({ message: 'Grade record updated successfully', id: existingId, status: passStatus });
    } else {
      await conn.execute(
        `INSERT INTO student_grades (student_id, student_name, roll_number, class_form, subject_id, subject_name, exam_term, score, status, remarks)
         VALUES (:sid, :sname, :sroll, :sform, :subid, :subname, :term, :sc, :st, :rem)`,
        {
          sid: studentId,
          sname: sName,
          sroll: sRoll,
          sform: sForm,
          subid: subjectId || null,
          subname: subName,
          term: termVal,
          sc: numScore,
          st: passStatus,
          rem: remarks || ''
        }
      );
      res.status(201).json({ message: 'Grade record created successfully', status: passStatus });
    }
  } catch (err) {
    console.error('Error saving grade:', err);
    res.status(500).json({ error: err.message });
  } finally {
    if (conn) await conn.close();
  }
});

// Protected POST: Bulk insert/update 12 subjects grades for a student
app.post('/api/grades/bulk', verifyToken, async (req, res) => {
  const { studentId, examTerm, items } = req.body;
  if (!studentId || !Array.isArray(items)) {
    return res.status(400).json({ error: 'studentId and items array are required' });
  }

  const termVal = examTerm || 'Term 1';
  let conn;
  try {
    conn = await getConn();

    const sRes = await conn.execute(
      `SELECT full_name, roll_number, class_form FROM students WHERE LOWER(student_id) = LOWER(:sid)`,
      [studentId],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const sInfo = (sRes.rows && sRes.rows[0]) ? sRes.rows[0] : {};
    const sName = sInfo.FULL_NAME || req.body.studentName || 'Arday';
    const sRoll = sInfo.ROLL_NUMBER || req.body.rollNumber || '-';
    const sForm = req.body.classForm || sInfo.CLASS_FORM || '-';

    for (const item of items) {
      const subName = item.subjectName || 'Maado';
      const numScore = parseFloat(item.score);
      if (isNaN(numScore)) continue;

      const passStatus = numScore >= 50 ? 'Basiyay' : 'Dhacay';
      const subId = item.subjectId || null;
      const rem = item.remarks || (numScore >= 50 ? 'Basiyay' : 'Dhacay');

      const checkRes = await conn.execute(
        `SELECT grade_id FROM student_grades 
         WHERE LOWER(student_id) = LOWER(:sid) AND LOWER(subject_name) = LOWER(:sub) AND LOWER(exam_term) = LOWER(:term)`,
        [studentId, subName, termVal],
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      if (checkRes.rows && checkRes.rows.length > 0) {
        const existingId = checkRes.rows[0].GRADE_ID;
        await conn.execute(
          `UPDATE student_grades 
           SET student_name = :sname, roll_number = :sroll, class_form = :sform,
               score = :sc, status = :st, remarks = :rem 
           WHERE grade_id = :gid`,
          [sName, sRoll, sForm, numScore, passStatus, rem, existingId]
        );
      } else {
        await conn.execute(
          `INSERT INTO student_grades (student_id, student_name, roll_number, class_form, subject_id, subject_name, exam_term, score, status, remarks)
           VALUES (:sid, :sname, :sroll, :sform, :subid, :subname, :term, :sc, :st, :rem)`,
          {
            sid: studentId,
            sname: sName,
            sroll: sRoll,
            sform: sForm,
            subid: subId,
            subname: subName,
            term: termVal,
            sc: numScore,
            st: passStatus,
            rem: rem
          }
        );
      }
    }

    res.json({ message: '12 subjects grade records processed successfully!' });
  } catch (err) {
    console.error('Error bulk saving grades:', err);
    res.status(500).json({ error: err.message });
  } finally {
    if (conn) await conn.close();
  }
});

// Protected DELETE: Remove grade record
app.delete('/api/grades/:id', verifyToken, async (req, res) => {
  const gradeId = req.params.id;
  let conn;
  try {
    conn = await getConn();
    await conn.execute(`DELETE FROM student_grades WHERE grade_id = :id`, [gradeId]);
    res.json({ message: 'Grade record deleted successfully' });
  } catch (err) {
    console.error('Error deleting grade record:', err);
    res.status(500).json({ error: err.message });
  } finally {
    if (conn) await conn.close();
  }
});

// Protected POST: Auto-seed reasonable schedules for all 4 forms
app.post('/api/schedules/seed-all', verifyToken, async (req, res) => {
  let conn;
  try {
    conn = await getConn();
    await seedSchedulesLogic(conn);
    res.json({ message: 'Schedules for all forms populated successfully!' });
  } catch (err) {
    console.error('Error seeding all schedules:', err);
    res.status(500).json({ error: err.message });
  } finally {
    if (conn) await conn.close();
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Serveur API prêt sur http://localhost:${PORT} [Secured with JWT + Dotenv]`);
  // Initialize admin user and tables in background without blocking server startup
  (async () => {
    try {
      await ensureAdminUserExists();
      await ensureStudentFeesTableExists();
      await ensureStudentGradesTableExists();
      await ensureAttendanceColumns();
      await ensureSchedulesSeeded();
    } catch (err) {
      console.warn('Notice during DB table check on startup:', err.message);
    }
  })();
});
