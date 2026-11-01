const oracledb = require('oracledb');

oracledb.autoCommit = true;

const defaultTeachers = [
  { id: 't1', name: 'Dr. Cali Waare', img: 'https://i.pravatar.cc/150?img=11' },
  { id: 't2', name: 'Prof. Faadumo', img: 'https://i.pravatar.cc/150?img=12' },
  { id: 't3', name: 'Jaamac Geyddid', img: 'https://i.pravatar.cc/150?img=13' },
  { id: 't4', name: 'Cabdi Maxamuud', img: 'https://i.pravatar.cc/150?img=14' },
  { id: 't5', name: 'Maryan Jaamac', img: 'https://i.pravatar.cc/150?img=5' },
  { id: 't6', name: 'Dr. Xaliil Cali', img: 'https://i.pravatar.cc/150?img=6' },
  { id: 't7', name: 'Xaliimo Warsame', img: 'https://i.pravatar.cc/150?img=7' },
  { id: 't8', name: 'Saciidyo Axmed', img: 'https://i.pravatar.cc/150?img=9' }
];

const defaultSubjects = [
  { form: 'form1', tag: 'ARABIC', title: 'Arabic', tagColor: 'green', border: 'green', grade: 'Fasalka 9-A', teacherId: 't1' },
  { form: 'form1', tag: 'ISLAMIC', title: 'Islamic', tagColor: 'blue', border: 'blue', grade: 'Fasalka 9-B', teacherId: 't2' },
  { form: 'form2', tag: 'ENGLISH', title: 'English', tagColor: 'red', border: 'red', grade: 'Fasalka 10-A', teacherId: 't3' },
  { form: 'form2', tag: 'BIOLOGY', title: 'Biology', tagColor: 'purple', border: 'purple', grade: 'Fasalka 10-C', teacherId: 't4' },
  { form: 'form3', tag: 'CHEMISTRY', title: 'Chemistry', tagColor: 'teal', border: 'teal', grade: 'Fasalka 11-A', teacherId: 't5' },
  { form: 'form3', tag: 'HISTORY', title: 'History', tagColor: 'orange', border: 'orange', grade: 'Fasalka 11-B', teacherId: 't6' },
  { form: 'form4', tag: 'PHYSICS', title: 'Physics', tagColor: 'green', border: 'green', grade: 'Fasalka 12-A', teacherId: 't7' },
  { form: 'form4', tag: 'MATH', title: 'Math', tagColor: 'blue', border: 'blue', grade: 'Fasalka 12-C', teacherId: 't8' },
  { form: 'form1', tag: 'SOMALI', title: 'Somali', tagColor: 'red', border: 'red', grade: 'Fasalka 9-C', teacherId: 't1' },
  { form: 'form2', tag: 'TECHNOLOGY', title: 'Technology', tagColor: 'blue', border: 'blue', grade: 'Fasalka 10-B', teacherId: 't2' }
];

async function setupSys() {
  let conn;
  try {
    conn = await oracledb.getConnection({
      user: 'sys',
      password: 'Admin123',
      connectString: 'localhost:1521/XE',
      privilege: oracledb.SYSDBA
    });

    console.log('Connected to SYSDBA.');

    async function runDDL(sql) {
      try {
        await conn.execute(sql);
      } catch (err) {
        if (err.errorNum === 955 || err.code === 'ORA-00955') return;
        throw err;
      }
    }

    // 1. TEACHERS
    await runDDL(`
      CREATE TABLE sys.teachers (
        teacher_id VARCHAR2(100) PRIMARY KEY,
        name VARCHAR2(255) NOT NULL,
        img VARCHAR2(2000)
      )
    `);

    // 2. SUBJECTS
    await runDDL(`
      CREATE TABLE sys.subjects (
        subject_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        class_form VARCHAR2(50) NOT NULL,
        tag VARCHAR2(100) NOT NULL,
        title VARCHAR2(255) NOT NULL,
        teacher_id VARCHAR2(100),
        tag_color VARCHAR2(50),
        border VARCHAR2(50),
        grade VARCHAR2(100)
      )
    `);

    try { await conn.execute(`ALTER TABLE sys.subjects ADD (tag_color VARCHAR2(50), border VARCHAR2(50), grade VARCHAR2(100))`); } catch(e){}

    // 3. STUDENTS
    await runDDL(`
      CREATE TABLE sys.students (
        student_id VARCHAR2(100) PRIMARY KEY,
        roll_number VARCHAR2(50),
        full_name VARCHAR2(255) NOT NULL,
        parent_phone VARCHAR2(50),
        class_form VARCHAR2(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    try { await conn.execute(`ALTER TABLE sys.students ADD (created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`); } catch(e){}

    // 4. ATTENDANCE
    await runDDL(`
      CREATE TABLE sys.attendance (
        attendance_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        att_date VARCHAR2(20) NOT NULL,
        class_form VARCHAR2(50) NOT NULL,
        student_id VARCHAR2(100),
        status VARCHAR2(20) NOT NULL,
        CONSTRAINT uq_sys_att UNIQUE (att_date, class_form, student_id)
      )
    `);

    // 5. SCHEDULES
    await runDDL(`
      CREATE TABLE sys.schedules (
        schedule_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        class_form VARCHAR2(50) NOT NULL,
        day_index NUMBER NOT NULL,
        period_index NUMBER NOT NULL,
        subject_id NUMBER,
        CONSTRAINT uq_sys_sch UNIQUE (class_form, day_index, period_index)
      )
    `);

    // Seed Teachers first
    for (const t of defaultTeachers) {
      try {
        await conn.execute(
          `INSERT INTO sys.teachers (teacher_id, name, img) VALUES (:id, :name, :img)`,
          [t.id, t.name, t.img],
          { autoCommit: true }
        );
      } catch(e) {}
    }

    // Seed Subjects second
    const sCountRes = await conn.execute('SELECT COUNT(*) AS c FROM sys.subjects', [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
    if (sCountRes.rows[0].C === 0) {
      for (const s of defaultSubjects) {
        await conn.execute(
          `INSERT INTO sys.subjects (class_form, tag, title, teacher_id, tag_color, border, grade) 
           VALUES (:form, :tag, :title, :teacherId, :tagColor, :border, :grade)`,
          [s.form, s.tag, s.title, s.teacherId, s.tagColor, s.border, s.grade],
          { autoCommit: true }
        );
      }
    }

    console.log('SYS schema setup completed successfully!');
  } catch (err) {
    console.error('Error setting up SYS schema:', err);
  } finally {
    if (conn) await conn.close();
  }
}

setupSys();
