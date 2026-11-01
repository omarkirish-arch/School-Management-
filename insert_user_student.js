const oracledb = require('oracledb');

oracledb.autoCommit = true;

async function insertStudent() {
  const configs = [
    { user: '"Admin-SYS"', password: 'Admin123', connectString: 'localhost:1521/XEPDB1' },
    { user: '"Admin-SYS"', password: 'Admin123', connectString: 'localhost:1521/XE' }
  ];

  for (const cfg of configs) {
    let conn;
    try {
      conn = await oracledb.getConnection(cfg);
      await conn.execute(
        `INSERT INTO students (student_id, roll_number, full_name, parent_phone, class_form)
         VALUES (:1, :2, :3, :4, :5)`,
        ['s_99', '999', 'Jaamac Cali Xasan', '615999999', 'form1'],
        { autoCommit: true }
      );
      console.log(`Successfully inserted 'Jaamac Cali Xasan' into ${cfg.connectString}!`);
    } catch (err) {
      if (err.errorNum === 1 || err.code === 'ORA-00001') {
        console.log(`Student s_99 already exists in ${cfg.connectString}.`);
      } else {
        console.error(`Error on ${cfg.connectString}:`, err.message);
      }
    } finally {
      if (conn) await conn.close();
    }
  }
}

insertStudent();
