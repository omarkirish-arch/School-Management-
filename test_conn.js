const oracledb = require('oracledb');

async function testConfig(name, cfg) {
  const t0 = Date.now();
  try {
    const conn = await oracledb.getConnection(cfg);
    console.log(`[SUCCESS] ${name} connected in ${Date.now() - t0} ms`);
    const res = await conn.execute("SELECT USER FROM DUAL");
    console.log(`  Current user: ${res.rows[0]}`);
    await conn.close();
    return true;
  } catch (err) {
    console.log(`[FAILED] ${name} in ${Date.now() - t0} ms: ${err.message}`);
    return false;
  }
}

async function main() {
  await testConfig('Admin-SYS XE (127.0.0.1)', { user: '"Admin-SYS"', password: 'Admin123', connectString: '127.0.0.1:1521/XE' });
  await testConfig('Admin-SYS XE (localhost)', { user: '"Admin-SYS"', password: 'Admin123', connectString: 'localhost:1521/XE' });
  await testConfig('SCHOOL_APP_USER XEPDB1 (localhost)', { user: 'SCHOOL_APP_USER', password: 'SecureSchoolPassword123!', connectString: 'localhost:1521/XEPDB1' });
}

main();
