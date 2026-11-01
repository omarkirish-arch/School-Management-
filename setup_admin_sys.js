const oracledb = require('oracledb');

async function createAdminSysUser() {
  let conn;
  try {
    conn = await oracledb.getConnection({
      user: 'system',
      password: 'Admin123',
      connectString: 'localhost:1521/XE'
    });

    console.log('Connected as system.');

    try {
      await conn.execute('ALTER SESSION SET "_ORACLE_SCRIPT"=true');
    } catch (e) {
      console.log('Alter session info:', e.message);
    }

    try {
      await conn.execute('CREATE USER "Admin-SYS" IDENTIFIED BY "Admin123"');
      console.log('User "Admin-SYS" created successfully.');
    } catch (e) {
      if (e.errorNum === 1920 || e.code === 'ORA-01920') {
        console.log('User "Admin-SYS" already exists.');
      } else {
        console.log('Error creating user "Admin-SYS":', e.message);
      }
    }

    try {
      await conn.execute('GRANT CONNECT, RESOURCE, DBA TO "Admin-SYS"');
      console.log('Granted DBA privileges to "Admin-SYS".');
    } catch (e) {
      console.log('Grant error:', e.message);
    }

    try {
      await conn.execute('ALTER USER "Admin-SYS" QUOTA UNLIMITED ON USERS');
    } catch (e) {}

  } catch (err) {
    console.error('Connection error:', err);
  } finally {
    if (conn) await conn.close();
  }
}

createAdminSysUser();
