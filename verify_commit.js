const oracledb = require('oracledb');

async function check(connStr) {
  try {
    const conn = await oracledb.getConnection({
      user: '"Admin-SYS"',
      password: 'Admin123',
      connectString: connStr
    });
    const res = await conn.execute(
      `SELECT full_name FROM students WHERE student_id = 's_commit_test'`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    console.log(`Query on ${connStr}:`, res.rows);
    await conn.close();
  } catch (err) {
    console.error(`Error on ${connStr}:`, err.message);
  }
}

async function run() {
  await check('localhost:1521/XEPDB1');
  await check('localhost:1521/XE');
}

run();
