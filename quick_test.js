const oracledb = require('oracledb');

async function test() {
  console.log('Testing Admin-SYS with DESKTOP-NMQCO7E:1521/XE...');
  try {
    const conn = await oracledb.getConnection({
      user: '"Admin-SYS"',
      password: 'Admin123',
      connectString: 'DESKTOP-NMQCO7E:1521/XE'
    });
    console.log('SUCCESS! Connected to DESKTOP-NMQCO7E:1521/XE');
    const res = await conn.execute("SELECT COUNT(*) AS total FROM teachers", [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
    console.log('Teachers count:', res.rows[0]);
    const teachers = await conn.execute("SELECT * FROM teachers", [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
    console.log('Teachers:', teachers.rows);
    await conn.close();
  } catch (err) {
    console.error('Error:', err.message);
  }
}

test();
