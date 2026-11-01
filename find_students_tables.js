const oracledb = require('oracledb');

async function findTables(connStr, user, pass) {
  console.log(`--- Checking ${connStr} as ${user} ---`);
  let conn;
  try {
    conn = await oracledb.getConnection({ user, password: pass, connectString: connStr });
    
    // Find all owners of STUDENTS table
    const tabRes = await conn.execute(
      `SELECT owner, table_name FROM all_tables WHERE table_name = 'STUDENTS'`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    console.log('Owners of STUDENTS table:', tabRes.rows);

    for (const t of tabRes.rows) {
      const owner = t.OWNER;
      const cols = await conn.execute(
        `SELECT column_name FROM all_tab_columns WHERE owner = :1 AND table_name = 'STUDENTS'`,
        [owner],
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      const colNames = cols.rows.map(c => c.COLUMN_NAME);
      
      // Count rows in OWNER.STUDENTS
      let count = 0;
      let rows = [];
      try {
        const countRes = await conn.execute(`SELECT COUNT(*) AS c FROM "${owner}".STUDENTS`, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
        count = countRes.rows[0].C;
        const dataRes = await conn.execute(`SELECT * FROM "${owner}".STUDENTS`, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
        rows = dataRes.rows;
      } catch(e) {
        count = 'err: ' + e.message;
      }

      console.log(`Table "${owner}".STUDENTS: Columns=[${colNames.join(', ')}], Count=${count}`);
      console.log(`Rows:`, rows);
    }

    await conn.close();
  } catch (err) {
    console.error(`Error connecting to ${connStr} as ${user}:`, err.message);
  }
}

async function main() {
  await findTables('localhost:1521/XE', 'system', 'Admin123');
  await findTables('localhost:1521/XEPDB1', 'system', 'Admin123');
  await findTables('localhost:1521/XE', '"Admin-SYS"', 'Admin123');
  await findTables('localhost:1521/XEPDB1', '"Admin-SYS"', 'Admin123');
}

main();
