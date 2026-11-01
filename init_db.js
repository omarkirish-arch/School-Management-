const oracledb = require('oracledb');

const dbConfig = {
  user: '"Admin-SYS"',
  password: 'Admin123',
  connectString: 'localhost:1521/XE'
};

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

async function initializeDatabase() {
  let conn;
  try {
    console.log('Connecting to Oracle DB as "Admin-SYS"...');
    try {
      conn = await oracledb.getConnection(dbConfig);
    } catch (e) {
      console.log('Falling back to system user:', e.message);
      conn = await oracledb.getConnection({ user: 'system', password: 'Admin123', connectString: 'localhost:1521/XE' });
    }
    console.log('Connected to Oracle DB successfully!');

    async function runDDL(sql) {
      try {
        await conn.execute(sql);
      } catch (err) {
        if (err.errorNum === 955 || err.code === 'ORA-00955') {
          return;
        }
        throw err;
      }
    }

    // 1. Create TEACHERS table
    await runDDL(`
      CREATE TABLE teachers (
        teacher_id VARCHAR2(100) PRIMARY KEY,
        name VARCHAR2(255) NOT NULL,
        img VARCHAR2(2000)
      )
    `);

    // 2. Create SUBJECTS table
    await runDDL(`
      CREATE TABLE subjects (
        subject_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        class_form VARCHAR2(50) NOT NULL,
        tag VARCHAR2(100) NOT NULL,
        title VARCHAR2(255) NOT NULL,
        teacher_id VARCHAR2(100) REFERENCES teachers(teacher_id) ON DELETE SET NULL,
        tag_color VARCHAR2(50),
        border VARCHAR2(50),
        grade VARCHAR2(100)
      )
    `);

    // 3. Create STUDENTS table
    await runDDL(`
      CREATE TABLE students (
        student_id VARCHAR2(100) PRIMARY KEY,
        roll_number VARCHAR2(50),
        full_name VARCHAR2(255) NOT NULL,
        parent_phone VARCHAR2(50),
        class_form VARCHAR2(50) NOT NULL
      )
    `);

    // 4. Create ATTENDANCE table
    await runDDL(`
      CREATE TABLE attendance (
        attendance_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        att_date VARCHAR2(20) NOT NULL,
        class_form VARCHAR2(50) NOT NULL,
        student_id VARCHAR2(100) REFERENCES students(student_id) ON DELETE CASCADE,
        status VARCHAR2(20) NOT NULL,
        CONSTRAINT uq_attendance UNIQUE (att_date, class_form, student_id)
      )
    `);

    // 5. Create SCHEDULES table
    await runDDL(`
      CREATE TABLE schedules (
        schedule_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        class_form VARCHAR2(50) NOT NULL,
        day_index NUMBER NOT NULL,
        period_index NUMBER NOT NULL,
        subject_id NUMBER REFERENCES subjects(subject_id) ON DELETE CASCADE,
        CONSTRAINT uq_schedule UNIQUE (class_form, day_index, period_index)
      )
    `);

    // Seed Teachers if empty
    const teacherRes = await conn.execute('SELECT COUNT(*) AS count FROM teachers', [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const teacherCount = teacherRes.rows[0].COUNT;
    if (teacherCount === 0) {
      console.log('Seeding initial teachers data...');
      for (const t of defaultTeachers) {
        await conn.execute(
          `INSERT INTO teachers (teacher_id, name, img) VALUES (:id, :name, :img)`,
          [t.id, t.name, t.img]
        );
      }
      await conn.commit();
      console.log('Teachers seeded!');
    }

    // Seed Subjects if empty
    const subjectRes = await conn.execute('SELECT COUNT(*) AS count FROM subjects', [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const subjectCount = subjectRes.rows[0].COUNT;
    if (subjectCount === 0) {
      console.log('Seeding initial subjects data...');
      for (const s of defaultSubjects) {
        await conn.execute(
          `INSERT INTO subjects (class_form, tag, title, teacher_id, tag_color, border, grade) 
           VALUES (:form, :tag, :title, :teacherId, :tagColor, :border, :grade)`,
          [s.form, s.tag, s.title, s.teacherId, s.tagColor, s.border, s.grade]
        );
      }
      await conn.commit();
      console.log('Subjects seeded!');
    }

    console.log('Database initialization completed successfully!');
  } catch (err) {
    console.error('Error during DB initialization:', err);
  } finally {
    if (conn) {
      await conn.close();
    }
  }
}

initializeDatabase();
