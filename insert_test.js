const oracledb = require('oracledb');

async function insertDirectData() {
  let conn;
  try {
    conn = await oracledb.getConnection({
      user: '"Admin-SYS"',
      password: 'Admin123',
      connectString: 'localhost:1521/XE'
    });

    console.log('Connected to Oracle DB.');

    // Insert student directly into Oracle DB
    await conn.execute(
      `INSERT INTO students (student_id, roll_number, full_name, parent_phone, class_form)
       VALUES (:id, :roll, :name, :phone, :form)`,
      ['s_direct1', '105', 'Cumar Nuur Xasan', '615554433', 'form1'],
      { autoCommit: true }
    );
    console.log('Inserted student "Cumar Nuur Xasan" directly into Oracle DB!');

    // Insert teacher directly into Oracle DB
    await conn.execute(
      `INSERT INTO teachers (teacher_id, name, img)
       VALUES (:id, :name, :img)`,
      ['t_direct1', 'Prof. Axmed Nuur', 'https://i.pravatar.cc/150?img=15'],
      { autoCommit: true }
    );
    console.log('Inserted teacher "Prof. Axmed Nuur" directly into Oracle DB!');

  } catch (err) {
    if (err.errorNum === 1 || err.code === 'ORA-00001') {
      console.log('Record already inserted.');
    } else {
      console.error('Error inserting:', err.message);
    }
  } finally {
    if (conn) await conn.close();
  }
}

insertDirectData();
