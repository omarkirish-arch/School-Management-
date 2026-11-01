const oracledb = require('oracledb');

async function checkCols() {
  const conn = await oracledb.getConnection({
    user: 'sys',
    password: 'Admin123',
    connectString: 'localhost:1521/XE',
    privilege: oracledb.SYSDBA
  });

  const res = await conn.execute(`SELECT column_name FROM all_tab_columns WHERE owner = 'SYS' AND table_name = 'TEACHERS'`);
  console.log('SYS.TEACHERS columns:', res.rows);

  // Alter SYS.TEACHERS to ensure IMG and PHOTO_URL exist
  try { await conn.execute('ALTER TABLE sys.teachers ADD (img VARCHAR2(2000))'); } catch(e){}
  try { await conn.execute('ALTER TABLE sys.teachers ADD (photo_url VARCHAR2(2000))'); } catch(e){}

  await conn.close();
}

checkCols();
