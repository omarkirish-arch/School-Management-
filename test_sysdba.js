const oracledb = require('oracledb');

async function testSysdba() {
  let conn;
  try {
    conn = await oracledb.getConnection({
      user: 'sys',
      password: 'Admin123',
      connectString: 'localhost:1521/XE',
      privilege: oracledb.SYSDBA
    });
    console.log('Connected as SYSDBA!');
    const res = await conn.execute(`SELECT * FROM sys.students`, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
    console.log('SYS.STUDENTS rows:', res.rows);

    // Sync all rows into sys.students as well
    const allRows = [
      { id: 's_99', roll: '999', name: 'Jaamac Cali Xasan', phone: '615999999', form: 'form1' },
      { id: 's_1789133423453', roll: '125', name: 'liiban bashiir mohamed', phone: '615202070', form: 'form1' },
      { id: 's_commit_test', roll: '777', name: 'Khadra Axmed', phone: '618889900', form: 'form1' }
    ];

    for (const s of allRows) {
      await conn.execute(
        `MERGE INTO sys.students target
         USING (SELECT :id AS student_id FROM dual) src
         ON (target.student_id = src.student_id)
         WHEN MATCHED THEN
           UPDATE SET roll_number = :roll, full_name = :name, parent_phone = :phone, class_form = :form
         WHEN NOT MATCHED THEN
           INSERT (student_id, roll_number, full_name, parent_phone, class_form)
           VALUES (:id, :roll, :name, :phone, :form)`,
        { id: s.id, roll: s.roll, name: s.name, phone: s.phone, form: s.form },
        { autoCommit: true }
      );
    }
    console.log('SYS.STUDENTS merged successfully!');

    // Create PUBLIC SYNONYM FOR STUDENTS, TEACHERS, SUBJECTS, ATTENDANCE, SCHEDULES
    try { await conn.execute('CREATE PUBLIC SYNONYM students FOR sys.students'); } catch(e){}
    try { await conn.execute('GRANT ALL ON sys.students TO PUBLIC'); } catch(e){}

    await conn.close();
  } catch (err) {
    console.error('Error in sysdba test:', err);
  }
}

testSysdba();
