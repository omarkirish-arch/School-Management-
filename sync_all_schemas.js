const oracledb = require('oracledb');

async function syncSchemas() {
  console.log('Synchronizing all Oracle DB schemas...');
  let conn;
  try {
    conn = await oracledb.getConnection({
      user: 'system',
      password: 'Admin123',
      connectString: 'localhost:1521/XE'
    });

    // 1. Add CREATED_AT column to "Admin-SYS".STUDENTS if missing
    try {
      await conn.execute(`ALTER TABLE "Admin-SYS".STUDENTS ADD (CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    } catch(e) {}
    try {
      await conn.execute(`ALTER TABLE "SYS".STUDENTS ADD (CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    } catch(e) {}

    // 2. Collect all students from SYS, SYSTEM, Admin-SYS in XE & XEPDB1
    const allStudentsMap = new Map();

    async function collectFrom(ownerStr, connStr) {
      try {
        const c = await oracledb.getConnection({ user: 'system', password: 'Admin123', connectString: connStr });
        const res = await c.execute(`SELECT student_id AS "id", roll_number AS "roll", full_name AS "name", parent_phone AS "phone", class_form AS "form" FROM "${ownerStr}".STUDENTS`, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
        for (const row of res.rows) {
          allStudentsMap.set(row.id, row);
        }
        await c.close();
      } catch(e) {}
    }

    await collectFrom('SYS', 'localhost:1521/XE');
    await collectFrom('SYSTEM', 'localhost:1521/XE');
    await collectFrom('Admin-SYS', 'localhost:1521/XE');
    await collectFrom('Admin-SYS', 'localhost:1521/XEPDB1');

    console.log('All collected students across all schemas:', Array.from(allStudentsMap.values()));

    // 3. Upsert all students into SYS.STUDENTS and "Admin-SYS".STUDENTS in both XE & XEPDB1
    async function populateTo(ownerStr, connStr) {
      try {
        const c = await oracledb.getConnection({ user: 'system', password: 'Admin123', connectString: connStr });
        for (const s of allStudentsMap.values()) {
          try {
            await c.execute(
              `MERGE INTO "${ownerStr}".STUDENTS target
               USING (SELECT :id AS student_id FROM dual) src
               ON (target.student_id = src.student_id)
               WHEN MATCHED THEN
                 UPDATE SET roll_number = :roll, full_name = :name, parent_phone = :phone, class_form = :form
               WHEN NOT MATCHED THEN
                 INSERT (student_id, roll_number, full_name, parent_phone, class_form)
                 VALUES (:id, :roll, :name, :phone, :form)`,
              { id: s.id, roll: s.roll || '', name: s.name, phone: s.phone || '', form: s.form || 'form1' },
              { autoCommit: true }
            );
          } catch(e) {
            console.error(`Error populating ${s.name} into ${ownerStr} on ${connStr}:`, e.message);
          }
        }
        await c.close();
      } catch(e) {
        console.error(`Error connecting to ${connStr}:`, e.message);
      }
    }

    await populateTo('SYS', 'localhost:1521/XE');
    await populateTo('SYSTEM', 'localhost:1521/XE');
    await populateTo('Admin-SYS', 'localhost:1521/XE');
    await populateTo('Admin-SYS', 'localhost:1521/XEPDB1');

    console.log('Schemas synchronized successfully!');
  } catch (err) {
    console.error('Sync error:', err);
  } finally {
    if (conn) await conn.close();
  }
}

syncSchemas();
