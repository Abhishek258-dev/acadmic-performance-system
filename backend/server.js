
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const express = require("express");
const cors = require("cors");
const db = require("./config/db");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Verify JWT and admin role
function verifyAdmin(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            success: false,
            message: "Authentication token required."
        });
    }

    if (!process.env.JWT_SECRET) {
        return res.status(500).json({
            success: false,
            message: "Server authentication is not configured."
        });
    }

    try {
        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (decoded.role !== "admin") {
            return res.status(403).json({
                success: false,
                message: "Admin access required."
            });
        }

        req.admin = decoded;
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired token."
        });
    }
}

// Home route
("/", (req, res) => {
    reapp.gets.send("APARMS Backend is running!");
});

// Database health check
app.get("/api/health/db", async (req, res) => {
    try {
        const [rows] = await db.query(
            "SELECT DATABASE() AS databaseName"
        );

        res.json({
            success: true,
            message: "MySQL connected successfully!",
            database: rows[0].databaseName
        });
    } catch (error) {
        console.error("Database connection error:", error.message);

        res.status(500).json({
            success: false,
            message: "MySQL connection failed. Check your database settings."
        });
    }
});

// Fetch students
app.get("/api/students", async (req, res) => {
    try {
        const [students] = await db.query(`
            SELECT
                s.student_id,
                u.full_name,
                u.email,
                s.enrollment_no,
                s.roll_no,
                s.program_id,
                p.program_name,
                s.current_semester,
                s.section,
                s.admission_year
            FROM students s
            JOIN users u ON s.student_id = u.user_id
            JOIN programs p ON s.program_id = p.program_id
        `);

        res.json({
            success: true,
            count: students.length,
            data: students
        });
    } catch (error) {
        console.error("Error fetching students:", error.message);

        res.status(500).json({
            success: false,
            message: "Failed to fetch student records."
        });
    }
});

// NEW: Fetch faculty members (admin only)

app.get("/api/faculty", verifyAdmin, async (req, res) => {
    try {
        const [faculty] = await db.query(`
           SELECT
                f.faculty_id,
                u.full_name,
                u.email,
                u.is_active
            FROM faculty f
            JOIN users u ON f.faculty_id = u.user_id
            ORDER BY u.full_name
        `);

        res.json({
            success: true,
            count: faculty.length,
            data: faculty
        });
    } catch (error) {
        console.error("Error fetching faculty:", error.message);

        res.status(500).json({
            success: false,
            message: "Failed to fetch faculty records."
        });
    }
});

// Fetch student results
app.get("/api/results/:enrollmentNo", async (req, res) => {
    try {
        const { enrollmentNo } = req.params;

        const [results] = await db.query(
            `
            SELECT
                sub.subject_name,
                sub.subject_code,
                m.marks_obtained,
                m.max_marks,
                m.grade,
                m.grade_point,
                m.result_status,
                sem.semester_number,
                ay.year_label
            FROM marks m
            JOIN students st ON st.student_id = m.student_id
            JOIN subjects sub ON sub.subject_id = m.subject_id
            JOIN semesters sem ON sem.semester_id = m.semester_id
            JOIN academic_years ay
                ON ay.academic_year_id = m.academic_year_id
            WHERE st.enrollment_no = ?
            ORDER BY sem.semester_number, sub.subject_name
            `,
            [enrollmentNo]
        );

        res.json({
            success: true,
            count: results.length,
            data: results
        });
    } catch (error) {
        console.error("Error fetching results:", error.message);

        res.status(500).json({
            success: false,
            message: "Failed to fetch student results."
        });
    }
});

// Calculate SGPA
app.get("/api/sgpa/:enrollmentNo/:semesterNumber", async (req, res) => {
    try {
        const { enrollmentNo, semesterNumber } = req.params;

        const [rows] = await db.query(
            `
            SELECT
                ROUND(
                    SUM(s.credits * m.grade_point) /
                    NULLIF(SUM(s.credits), 0),
                    2
                ) AS sgpa,
                SUM(s.credits) AS total_credits
            FROM marks m
            JOIN students st ON st.student_id = m.student_id
            JOIN subjects s ON s.subject_id = m.subject_id
            JOIN semesters sem ON sem.semester_id = m.semester_id
            WHERE st.enrollment_no = ?
              AND sem.semester_number = ?
              AND UPPER(m.result_status) = 'PASS'
            `,
            [enrollmentNo, semesterNumber]
        );

        res.json({
            success: true,
            data: rows[0]
        });
    } catch (error) {
        console.error("SGPA calculation error:", error.message);

        res.status(500).json({
            success: false,
            message: "Failed to calculate SGPA."
        });
    }
});

// Calculate CGPA
app.get("/api/cgpa/:enrollmentNo", async (req, res) => {
    try {
        const { enrollmentNo } = req.params;

        const [rows] = await db.query(
            `
            SELECT
                ROUND(
                    SUM(s.credits * m.grade_point) /
                    NULLIF(SUM(s.credits), 0),
                    2
                ) AS cgpa,
                SUM(s.credits) AS total_credits
            FROM marks m
            JOIN students st ON st.student_id = m.student_id
            JOIN subjects s ON s.subject_id = m.subject_id
            WHERE st.enrollment_no = ?
              AND UPPER(m.result_status) = 'PASS'
            `,
            [enrollmentNo]
        );

        res.json({
            success: true,
            data: rows[0]
        });
    } catch (error) {
        console.error("CGPA calculation error:", error.message);

        res.status(500).json({
            success: false,
            message: "Failed to calculate CGPA."
        });
    }
});

// Get total subjects for a student
app.get("/api/subjects/count/:enrollmentNo", async (req, res) => {
    try {
        const { enrollmentNo } = req.params;

        const [rows] = await db.query(
            `
            SELECT COUNT(DISTINCT m.subject_id) AS subjectCount
            FROM marks m
            JOIN students st ON st.student_id = m.student_id
            WHERE st.enrollment_no = ?
            `,
            [enrollmentNo]
        );

        res.json({
            success: true,
            data: rows[0]
        });
    } catch (error) {
        console.error("Subject count error:", error.message);

        res.status(500).json({
            success: false,
            message: "Failed to fetch subject count."
        });
    }
});

// Get subject-wise performance
app.get("/api/performance/:enrollmentNo", async (req, res) => {
    try {
        const { enrollmentNo } = req.params;

        const [rows] = await db.query(
            `
            SELECT
                sub.subject_code,
                sub.subject_name,
                m.marks_obtained,
                m.max_marks,
                ROUND(
                    m.marks_obtained * 100.0 /
                    NULLIF(m.max_marks, 0),
                    2
                ) AS percentage
            FROM marks m
            JOIN students st ON st.student_id = m.student_id
            JOIN subjects sub ON sub.subject_id = m.subject_id
            WHERE st.enrollment_no = ?
            ORDER BY sub.subject_code
            `,
            [enrollmentNo]
        );

        res.json({
            success: true,
            count: rows.length,
            data: rows
        });
    } catch (error) {
        console.error("Performance API error:", error.message);

        res.status(500).json({
            success: false,
            message: "Failed to fetch performance data."
        });
    }
});

// Login API
app.post("/api/auth/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (
            typeof email !== "string" ||
            typeof password !== "string" ||
            !email.trim() ||
            !password
        ) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required."
            });
        }

        const [users] = await db.query(
            `
            SELECT user_id, full_name, email,
                   password_hash, role, is_active
            FROM users
            WHERE email = ?
            LIMIT 1
            `,
            [email.trim()]
        );

        if (
            users.length === 0 ||
            !users[0].is_active
        ) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        const user = users[0];

        const passwordMatches = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!passwordMatches) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        if (!process.env.JWT_SECRET) {
            throw new Error("JWT_SECRET is not configured.");
        }

        const token = jwt.sign(
            {
                userId: user.user_id,
                role: user.role
            },
            process.env.JWT_SECRET,
            { expiresIn: "1h" }
        );

        res.json({
            success: true,
            message: "Login successful.",
            token,
            user: {
                id: user.user_id,
                name: user.full_name,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error("Login error:", error.message);

        res.status(500).json({
            success: false,
            message: "Login failed due to a server error."
        });
    }
});

// Admin dashboard statistics
app.get("/api/admin/stats", verifyAdmin, async (req, res) => {
    try {
        const [[studentCount]] = await db.query(
            "SELECT COUNT(*) AS total FROM students"
        );

        const [[facultyCount]] = await db.query(
            "SELECT COUNT(*) AS total FROM faculty"
        );

        const [[resultCount]] = await db.query(
            "SELECT COUNT(*) AS total FROM results"
        );

        res.json({
            success: true,
            totalStudents: studentCount.total,
            totalFaculty: facultyCount.total,
            totalResults: resultCount.total
        });
    } catch (error) {
        console.error("Admin stats error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to fetch dashboard statistics."
        });
    }
});
// GET ALL RESULTS - ADMIN ONLY
app.get("/api/admin/results", verifyAdmin, async (req, res) => {
    try {
        const [results] = await db.query(`
            SELECT
                r.result_id,
                st.enrollment_no,
                u.full_name,
                sem.semester_number,
                ay.year_label,
                r.total_marks,
                r.maximum_marks,
                r.percentage,
                r.sgpa,
                r.result_status
            FROM results r
            JOIN students st
                ON r.student_id = st.student_id
            JOIN users u
                ON st.student_id = u.user_id
            JOIN semesters sem
                ON r.semester_id = sem.semester_id
            JOIN academic_years ay
                ON r.academic_year_id = ay.academic_year_id
            ORDER BY r.result_id DESC
        `);

        res.json({
            success: true,
            count: results.length,
            results: results
        });

    } catch (error) {
        console.error("Fetch results error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch results"
        });
    }
});
// ================= ADD STUDENT API =================

app.post("/api/admin/students", verifyAdmin, async (req, res) => {
    let connection;

    try {
        const {
            fullName,
            email,
            password,
            enrollmentNo,
            rollNo,
            programId,
            currentSemester,
            section,
            admissionYear
        } = req.body;

        // Validate required fields
        if (
            typeof fullName !== "string" ||
            typeof email !== "string" ||
            typeof password !== "string" ||
            typeof enrollmentNo !== "string" ||
            typeof rollNo !== "string" ||
            typeof section !== "string" ||
            !fullName.trim() ||
            !email.trim() ||
            !password ||
            !enrollmentNo.trim() ||
            !rollNo.trim() ||
            !section.trim() ||
            programId === undefined ||
            currentSemester === undefined ||
            admissionYear === undefined
        ) {
            return res.status(400).json({
                success: false,
                message: "Please fill in all required fields."
            });
        }

        // Validate numeric fields
        const parsedProgramId = Number(programId);
        const parsedSemester = Number(currentSemester);
        const parsedAdmissionYear = Number(admissionYear);

        if (
            !Number.isInteger(parsedProgramId) ||
            parsedProgramId < 1 ||
            !Number.isInteger(parsedSemester) ||
            parsedSemester < 1 ||
            !Number.isInteger(parsedAdmissionYear) ||
            parsedAdmissionYear < 2000 ||
            parsedAdmissionYear > 2100
        ) {
            return res.status(400).json({
                success: false,
                message: "Please enter valid program, semester and admission year."
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Password must contain at least 8 characters."
            });
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid email address."
            });
        }

        // Hash password before storing it
        const passwordHash = await bcrypt.hash(password, 12);

        // Start database transaction
        connection = await db.getConnection();
        await connection.beginTransaction();

        // Check for duplicate email
        const [existingUsers] = await connection.query(
            "SELECT user_id FROM users WHERE email = ? LIMIT 1",
            [email.trim()]
        );

        if (existingUsers.length > 0) {
            await connection.rollback();

            return res.status(409).json({
                success: false,
                message: "This email address is already registered."
            });
        }

        // Check duplicate enrollment or roll number
        const [existingStudents] = await connection.query(
            `SELECT student_id
             FROM students
             WHERE enrollment_no = ? OR roll_no = ?
             LIMIT 1`,
            [enrollmentNo.trim(), rollNo.trim()]
        );

        if (existingStudents.length > 0) {
            await connection.rollback();

            return res.status(409).json({
                success: false,
                message: "Enrollment number or roll number already exists."
            });
        }

        // Verify that the program exists
        const [programs] = await connection.query(
            "SELECT program_id FROM programs WHERE program_id = ? LIMIT 1",
            [parsedProgramId]
        );

        if (programs.length === 0) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "The selected Program ID does not exist."
            });
        }

        // Create user account
        const [userResult] = await connection.query(
            `INSERT INTO users
                (full_name, email, password_hash, role, is_active)
             VALUES (?, ?, ?, 'student', 1)`,
            [
                fullName.trim(),
                email.trim(),
                passwordHash
            ]
        );

        const studentId = userResult.insertId;

        // Create student profile linked to user account
        await connection.query(
            `INSERT INTO students
                (
                    student_id,
                    enrollment_no,
                    roll_no,
                    program_id,
                    current_semester,
                    section,
                    admission_year
                )
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                studentId,
                enrollmentNo.trim(),
                rollNo.trim(),
                parsedProgramId,
                parsedSemester,
                section.trim(),
                parsedAdmissionYear
            ]
        );

        // Commit both records together
        await connection.commit();

        return res.status(201).json({
            success: true,
            message: "Student added successfully.",
            student: {
                student_id: studentId,
                full_name: fullName.trim(),
                email: email.trim(),
                enrollment_no: enrollmentNo.trim(),
                roll_no: rollNo.trim(),
                program_id: parsedProgramId,
                current_semester: parsedSemester,
                section: section.trim(),
                admission_year: parsedAdmissionYear
            }
        });

    } catch (error) {
        if (connection) {
            await connection.rollback();
        }

        console.error("Add student error:", error.message);

        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                success: false,
                message: "A student with these details already exists."
            });
        }

        if (
            error.code === "ER_NO_REFERENCED_ROW_2" ||
            error.code === "ER_NO_REFERENCED_ROW"
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid program or related database record."
            });
        }

        return res.status(500).json({
            success: false,
            message: "Could not add student. Check the server terminal."
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
});
// UPDATE STUDENT
app.put("/api/admin/students/:id", verifyAdmin, async (req, res) => {
    const studentId = Number(req.params.id);

    const {
        fullName,
        email,
        enrollmentNo,
        rollNo,
        programId,
        currentSemester,
        section,
        admissionYear
    } = req.body;

    // Validate input
    if (
        !Number.isInteger(studentId) ||
        studentId <= 0 ||
        !fullName?.trim() ||
        !email?.trim() ||
        !enrollmentNo?.trim() ||
        !rollNo?.trim() ||
        !section?.trim() ||
        !Number.isInteger(Number(programId)) ||
        Number(programId) <= 0 ||
        !Number.isInteger(Number(currentSemester)) ||
        Number(currentSemester) < 1 ||
        !Number.isInteger(Number(admissionYear)) ||
        Number(admissionYear) < 2000 ||
        Number(admissionYear) > 2100
    ) {
        return res.status(400).json({
            success: false,
            message: "Please provide valid student details."
        });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        return res.status(400).json({
            success: false,
            message: "Please enter a valid email address."
        });
    }

    let connection;

    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // Check whether student exists
        const [existingStudent] = await connection.query(
            "SELECT student_id FROM students WHERE student_id = ?",
            [studentId]
        );

        if (existingStudent.length === 0) {
            await connection.rollback();

            return res.status(404).json({
                success: false,
                message: "Student not found."
            });
        }

        // Check duplicate email
        const [emailExists] = await connection.query(
            "SELECT user_id FROM users WHERE email = ? AND user_id != ?",
            [email.trim(), studentId]
        );

        if (emailExists.length > 0) {
            await connection.rollback();

            return res.status(409).json({
                success: false,
                message: "This email is already registered."
            });
        }

        // Check duplicate enrollment number
        const [enrollmentExists] = await connection.query(
            `SELECT student_id FROM students
             WHERE enrollment_no = ? AND student_id != ?`,
            [enrollmentNo.trim(), studentId]
        );

        if (enrollmentExists.length > 0) {
            await connection.rollback();

            return res.status(409).json({
                success: false,
                message: "Enrollment number already exists."
            });
        }

        // Check duplicate roll number
        const [rollExists] = await connection.query(
            `SELECT student_id FROM students
             WHERE roll_no = ? AND student_id != ?`,
            [rollNo.trim(), studentId]
        );

        if (rollExists.length > 0) {
            await connection.rollback();

            return res.status(409).json({
                success: false,
                message: "Roll number already exists."
            });
        }

        // Check whether program exists
        const [programExists] = await connection.query(
            "SELECT program_id FROM programs WHERE program_id = ?",
            [Number(programId)]
        );

        if (programExists.length === 0) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "Selected program does not exist."
            });
        }

        // Update user details
        await connection.query(
            `UPDATE users
             SET full_name = ?, email = ?
             WHERE user_id = ?`,
            [fullName.trim(), email.trim(), studentId]
        );

        // Update student details
        await connection.query(
            `UPDATE students
             SET enrollment_no = ?,
                 roll_no = ?,
                 program_id = ?,
                 current_semester = ?,
                 section = ?,
                 admission_year = ?
             WHERE student_id = ?`,
            [
                enrollmentNo.trim(),
                rollNo.trim(),
                Number(programId),
                Number(currentSemester),
                section.trim(),
                Number(admissionYear),
                studentId
            ]
        );

        await connection.commit();

        res.json({
            success: true,
            message: "Student details updated successfully."
        });
    } catch (error) {
        if (connection) {
            await connection.rollback();
        }

        console.error("Error updating student:", error.message);

        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                success: false,
                message: "Email, enrollment number, or roll number already exists."
            });
        }

        res.status(500).json({
            success: false,
            message: "Failed to update student details."
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});
// GET DEPARTMENTS FOR FACULTY FORM
app.get("/api/admin/departments", verifyAdmin, async (req, res) => {
    try {
        const [departments] = await db.query(`
            SELECT department_id, department_code, department_name
            FROM departments
            ORDER BY department_name
        `);

        res.json({
            success: true,
            data: departments
        });
    } catch (error) {
        console.error("Fetch departments error:", error.message);
        res.status(500).json({
            success: false,
            message: "Failed to fetch departments."
        });
    }
});


// ADD FACULTY
app.post("/api/admin/faculty", verifyAdmin, async (req, res) => {
    let connection;

    try {
        const {
            fullName,
            email,
            password,
            employeeCode,
            departmentId
        } = req.body;

        if (
            typeof fullName !== "string" ||
            typeof email !== "string" ||
            typeof password !== "string" ||
            typeof employeeCode !== "string" ||
            !fullName.trim() ||
            !email.trim() ||
            !password ||
            !employeeCode.trim() ||
            departmentId === undefined ||
            departmentId === null ||
            departmentId === ""
        ) {
            return res.status(400).json({
                success: false,
                message: "Please fill in all required fields."
            });
        }

        const parsedDepartmentId = Number(departmentId);
        const cleanEmail = email.trim();

        if (
            !Number.isInteger(parsedDepartmentId) ||
            parsedDepartmentId < 1
        ) {
            return res.status(400).json({
                success: false,
                message: "Please select a valid department."
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Password must contain at least 8 characters."
            });
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid email address."
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        connection = await db.getConnection();
        await connection.beginTransaction();

        const [existingUsers] = await connection.query(
            "SELECT user_id FROM users WHERE email = ? LIMIT 1",
            [cleanEmail]
        );

        if (existingUsers.length > 0) {
            await connection.rollback();

            return res.status(409).json({
                success: false,
                message: "This email address is already registered."
            });
        }

        const [existingFaculty] = await connection.query(
            "SELECT faculty_id FROM faculty WHERE employee_code = ? LIMIT 1",
            [employeeCode.trim()]
        );

        if (existingFaculty.length > 0) {
            await connection.rollback();

            return res.status(409).json({
                success: false,
                message: "This employee code is already registered."
            });
        }

        const [departments] = await connection.query(
            "SELECT department_id FROM departments WHERE department_id = ? LIMIT 1",
            [parsedDepartmentId]
        );

        if (departments.length === 0) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "Selected department does not exist."
            });
        }

        const [userResult] = await connection.query(
            `INSERT INTO users
                (full_name, email, password_hash, role, is_active)
             VALUES (?, ?, ?, 'faculty', 1)`,
            [
                fullName.trim(),
                cleanEmail,
                passwordHash
            ]
        );

        const facultyId = userResult.insertId;

        await connection.query(
            `INSERT INTO faculty
                (faculty_id, employee_code, department_id)
             VALUES (?, ?, ?)`,
            [
                facultyId,
                employeeCode.trim(),
                parsedDepartmentId
            ]
        );

        await connection.commit();

        return res.status(201).json({
            success: true,
            message: "Faculty added successfully.",
            faculty: {
                faculty_id: facultyId,
                full_name: fullName.trim(),
                email: cleanEmail,
                employee_code: employeeCode.trim(),
                department_id: parsedDepartmentId
            }
        });

    } catch (error) {
        if (connection) {
            await connection.rollback();
        }

        console.error("Add faculty error:", error.message);

        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                success: false,
                message: "Email or employee code already exists."
            });
        }

        if (
            error.code === "ER_NO_REFERENCED_ROW_2" ||
            error.code === "ER_NO_REFERENCED_ROW"
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid department or related database record."
            });
        }

        return res.status(500).json({
            success: false,
            message: "Could not add faculty. Check the server terminal."
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
});
// UPDATE FACULTY
app.put("/api/admin/faculty/:id", verifyAdmin, async (req, res) => {
    let connection;

    try {
        const facultyId = Number(req.params.id);
        const {
            fullName,
            email,
            employeeCode,
            departmentId,
            isActive
        } = req.body;

        if (!Number.isInteger(facultyId) || facultyId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid faculty ID."
            });
        }

        if (
            typeof fullName !== "string" || !fullName.trim() ||
            typeof email !== "string" || !email.trim() ||
            typeof employeeCode !== "string" || !employeeCode.trim() ||
            departmentId === undefined || departmentId === ""
        ) {
            return res.status(400).json({
                success: false,
                message: "Please fill in all required fields."
            });
        }

        if (typeof isActive !== "boolean") {
            return res.status(400).json({
                success: false,
                message: "Invalid account status."
            });
        }

        const parsedDepartmentId = Number(departmentId);
        const cleanEmail = email.trim();

        if (
            !Number.isInteger(parsedDepartmentId) ||
            parsedDepartmentId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Please select a valid department."
            });
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid email address."
            });
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        const [facultyRows] = await connection.query(
            `SELECT f.faculty_id
             FROM faculty f
             JOIN users u ON u.user_id = f.faculty_id
             WHERE f.faculty_id = ?
             LIMIT 1`,
            [facultyId]
        );

        if (facultyRows.length === 0) {
            await connection.rollback();

            return res.status(404).json({
                success: false,
                message: "Faculty record not found."
            });
        }

        const [duplicateEmails] = await connection.query(
            `SELECT user_id FROM users
             WHERE email = ? AND user_id != ?
             LIMIT 1`,
            [cleanEmail, facultyId]
        );

        if (duplicateEmails.length > 0) {
            await connection.rollback();

            return res.status(409).json({
                success: false,
                message: "Email is already used by another account."
            });
        }

        const [duplicateCodes] = await connection.query(
            `SELECT faculty_id FROM faculty
             WHERE employee_code = ? AND faculty_id != ?
             LIMIT 1`,
            [employeeCode.trim(), facultyId]
        );

        if (duplicateCodes.length > 0) {
            await connection.rollback();

            return res.status(409).json({
                success: false,
                message: "Employee code is already in use."
            });
        }

        const [departments] = await connection.query(
            `SELECT department_id FROM departments
             WHERE department_id = ?
             LIMIT 1`,
            [parsedDepartmentId]
        );

        if (departments.length === 0) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "Selected department does not exist."
            });
        }

        await connection.query(
            `UPDATE users
             SET full_name = ?, email = ?, is_active = ?
             WHERE user_id = ?`,
            [
                fullName.trim(),
                cleanEmail,
                isActive ? 1 : 0,
                facultyId
            ]
        );

        await connection.query(
            `UPDATE faculty
             SET employee_code = ?, department_id = ?
             WHERE faculty_id = ?`,
            [
                employeeCode.trim(),
                parsedDepartmentId,
                facultyId
            ]
        );

        await connection.commit();

        return res.json({
            success: true,
            message: "Faculty updated successfully."
        });

    } catch (error) {
        if (connection) {
            await connection.rollback();
        }

        console.error("Update faculty error:", error.message);

        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                success: false,
                message: "Email or employee code already exists."
            });
        }

        return res.status(500).json({
            success: false,
            message: "Could not update faculty."
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
});
// Start server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
