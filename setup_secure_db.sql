-- =====================================================================
-- Oracle DB Least Privilege Setup & Security Script
-- Safe to run on existing database - DOES NOT DROP OR TRUNCATE TABLES
-- =====================================================================

-- 1. Enable Oracle script execution mode (required for container DBs like XE/XEPDB1)
ALTER SESSION SET "_ORACLE_SCRIPT"=true;

-- 2. Create dedicated restricted application user (SCHOOL_APP_USER)
BEGIN
   EXECUTE IMMEDIATE 'CREATE USER SCHOOL_APP_USER IDENTIFIED BY "SecureSchoolPassword123!"';
   DBMS_OUTPUT.PUT_LINE('User SCHOOL_APP_USER created successfully.');
EXCEPTION
   WHEN OTHERS THEN
      IF SQLCODE = -1920 THEN
         DBMS_OUTPUT.PUT_LINE('User SCHOOL_APP_USER already exists.');
      ELSE
         RAISE;
      END IF;
END;
/

-- 3. Grant basic login session & quota
GRANT CREATE SESSION TO SCHOOL_APP_USER;
ALTER USER SCHOOL_APP_USER QUOTA UNLIMITED ON USERS;

-- 4. Create admin_users table for storing hashed passwords securely
DECLARE
   table_exists NUMBER;
BEGIN
   SELECT COUNT(*) INTO table_exists FROM user_tables WHERE table_name = 'ADMIN_USERS';
   IF table_exists = 0 THEN
      EXECUTE IMMEDIATE '
         CREATE TABLE admin_users (
            user_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            username VARCHAR2(100) NOT NULL UNIQUE,
            password_hash VARCHAR2(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
         )';
      DBMS_OUTPUT.PUT_LINE('Table ADMIN_USERS created successfully.');
   ELSE
      DBMS_OUTPUT.PUT_LINE('Table ADMIN_USERS already exists.');
   END IF;
END;
/

-- 5. Create student_fees table for tracking tuition fee payments
DECLARE
   table_exists NUMBER;
BEGIN
   SELECT COUNT(*) INTO table_exists FROM user_tables WHERE table_name = 'STUDENT_FEES';
   IF table_exists = 0 THEN
      EXECUTE IMMEDIATE '
         CREATE TABLE student_fees (
            fee_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            student_id VARCHAR2(100) NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
            student_name VARCHAR2(255),
            roll_number VARCHAR2(50),
            class_form VARCHAR2(50),
            fee_month VARCHAR2(50) NOT NULL,
            fee_year NUMBER NOT NULL,
            amount NUMBER(10,2) NOT NULL,
            status VARCHAR2(20) NOT NULL,
            payment_date VARCHAR2(50),
            notes VARCHAR2(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
         )';
      DBMS_OUTPUT.PUT_LINE('Table STUDENT_FEES created successfully.');
   ELSE
      DBMS_OUTPUT.PUT_LINE('Table STUDENT_FEES already exists.');
   END IF;
END;
/

-- Ensure student_name, roll_number, class_form columns exist on existing table
BEGIN
   EXECUTE IMMEDIATE 'ALTER TABLE student_fees ADD (student_name VARCHAR2(255), roll_number VARCHAR2(50), class_form VARCHAR2(50))';
EXCEPTION
   WHEN OTHERS THEN
      IF SQLCODE = -1430 OR SQLCODE = -1438 THEN
         NULL; -- Ignore if columns already exist
      END IF;
END;
/

-- Backfill student_name, roll_number, class_form from students table
BEGIN
   EXECUTE IMMEDIATE '
      UPDATE student_fees f
      SET (f.student_name, f.roll_number, f.class_form) = (
         SELECT s.full_name, s.roll_number, s.class_form
         FROM students s
         WHERE LOWER(s.student_id) = LOWER(f.student_id)
      )
      WHERE f.student_name IS NULL';
EXCEPTION
   WHEN OTHERS THEN
      NULL;
END;
/

-- 6. Create clean database VIEW for simple SELECT * query showing ONLY required columns
CREATE OR REPLACE VIEW v_student_fees AS
SELECT 
   student_name,
   roll_number,
   status,
   fee_month,
   fee_year,
   payment_date,
   amount
FROM student_fees;
/

-- 7. Create student_grades table for student exam results & pass/fail tracking
DECLARE
   table_exists NUMBER;
BEGIN
   SELECT COUNT(*) INTO table_exists FROM user_tables WHERE table_name = 'STUDENT_GRADES';
   IF table_exists = 0 THEN
      EXECUTE IMMEDIATE '
         CREATE TABLE student_grades (
            grade_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            student_id VARCHAR2(100) NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
            student_name VARCHAR2(255),
            roll_number VARCHAR2(50),
            class_form VARCHAR2(50),
            subject_id NUMBER,
            subject_name VARCHAR2(100) NOT NULL,
            exam_term VARCHAR2(100) DEFAULT ''Term 1'',
            score NUMBER(5,2) NOT NULL,
            status VARCHAR2(20) NOT NULL,
            remarks VARCHAR2(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
         )';
      DBMS_OUTPUT.PUT_LINE('Table STUDENT_GRADES created successfully.');
   ELSE
      DBMS_OUTPUT.PUT_LINE('Table STUDENT_GRADES already exists.');
   END IF;
END;
/

CREATE OR REPLACE VIEW v_student_grades AS
SELECT 
   student_name,
   roll_number,
   class_form AS fasalka,
   subject_name AS maadada,
   score AS dhibcaha,
   status AS xaalada,
   exam_term AS muhimada
FROM student_grades;
/

-- 8. Grant ONLY necessary DML privileges (SELECT, INSERT, UPDATE, DELETE) to SCHOOL_APP_USER
GRANT SELECT, INSERT, UPDATE, DELETE ON teachers TO SCHOOL_APP_USER;
GRANT SELECT, INSERT, UPDATE, DELETE ON subjects TO SCHOOL_APP_USER;
GRANT SELECT, INSERT, UPDATE, DELETE ON students TO SCHOOL_APP_USER;
GRANT SELECT, INSERT, UPDATE, DELETE ON attendance TO SCHOOL_APP_USER;
GRANT SELECT, INSERT, UPDATE, DELETE ON schedules TO SCHOOL_APP_USER;
GRANT SELECT, INSERT, UPDATE, DELETE ON admin_users TO SCHOOL_APP_USER;
GRANT SELECT, INSERT, UPDATE, DELETE ON student_fees TO SCHOOL_APP_USER;
GRANT SELECT, INSERT, UPDATE, DELETE ON student_grades TO SCHOOL_APP_USER;
GRANT SELECT ON v_student_fees TO SCHOOL_APP_USER;
GRANT SELECT ON v_student_grades TO SCHOOL_APP_USER;

COMMIT;
