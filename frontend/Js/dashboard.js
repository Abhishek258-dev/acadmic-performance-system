
const API_URL = "http://localhost:5000/api/students";
const ENROLLMENT_NO = "ENR2026001";

// Helper: safely update text on the page
function setText(id, value) {
    const element = document.getElementById(id);

    if (element) {
        element.textContent =
            value !== null &&
            value !== undefined &&
            value !== ""
                ? value
                : "Not available";
    }
}

// Load student details
async function loadStudents() {
    try {
        const response = await fetch(API_URL);
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error("Unable to load student records.");
        }

        console.log("Students loaded:", result.data);

        if (!result.data || result.data.length === 0) {
            setText("studentName", "No student found");
            setText("welcomeMessage", "Welcome 👋");
            setText("studentAvatar", "?");
            setText("enrollmentNumber", "Not available");
            setText("rollNumber", "Not available");
            setText("programName", "Not available");
            setText("currentSemester", "Not available");
            setText("studentSection", "Not available");
            setText("admissionYear", "Not available");
            return;
        }

        // Demo: display the first student returned by the API
        const student = result.data[0];
        const fullName = student.full_name || "Student";

        setText("studentName", fullName);
        setText("welcomeMessage", `Welcome, ${fullName} 👋`);
        setText("studentAvatar", fullName.charAt(0).toUpperCase());

        setText("enrollmentNumber", student.enrollment_no);
        setText("rollNumber", student.roll_no);
        setText("programName", student.program_name);
        setText("currentSemester", student.current_semester);
        setText("studentSection", student.section);
        setText("admissionYear", student.admission_year);

    } catch (error) {
        console.error("Student loading error:", error);
        setText("studentName", "Unable to load");
        setText("welcomeMessage", "Welcome 👋");
        setText("enrollmentNumber", "Unable to load");
        setText("rollNumber", "Unable to load");
        setText("programName", "Unable to load");
        setText("currentSemester", "Unable to load");
        setText("studentSection", "Unable to load");
        setText("admissionYear", "Unable to load");
    }
}

// Load subject-wise results
async function loadResults() {
    const tableBody = document.getElementById("resultsTableBody");

    if (!tableBody) return;

    try {
        const response = await fetch(
            `http://localhost:5000/api/results/${ENROLLMENT_NO}`
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error("Failed to load results.");
        }

        tableBody.replaceChildren();

        if (!result.data || result.data.length === 0) {
            const row = document.createElement("tr");
            const cell = document.createElement("td");

            cell.colSpan = 6;
            cell.textContent = "No results available";

            row.appendChild(cell);
            tableBody.appendChild(row);
            return;
        }

        result.data.forEach(subject => {
            const row = document.createElement("tr");

            const values = [
                subject.subject_code,
                subject.subject_name,
                `${subject.marks_obtained}/${subject.max_marks}`,
                subject.grade,
                subject.grade_point,
                subject.result_status
            ];

            values.forEach(value => {
                const cell = document.createElement("td");
                cell.textContent = value ?? "N/A";
                row.appendChild(cell);
            });

            tableBody.appendChild(row);
        });

        console.log("Results loaded successfully.");

    } catch (error) {
        console.error("Results loading error:", error);
    }
}

// Load SGPA
async function loadSGPA() {
    try {
        const response = await fetch(
            `http://localhost:5000/api/sgpa/${ENROLLMENT_NO}/1`
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error("Unable to load SGPA.");
        }

        const sgpa = result.data.sgpa;
        const element = document.getElementById("currentSGPA");

        if (element) {
            element.textContent =
                sgpa !== null && sgpa !== undefined
                    ? Number(sgpa).toFixed(2)
                    : "--";
        }

        console.log("SGPA:", sgpa);

    } catch (error) {
        console.error("SGPA loading error:", error);
    }
}

// Load CGPA
async function loadCGPA() {
    try {
        const response = await fetch(
            `http://localhost:5000/api/cgpa/${ENROLLMENT_NO}`
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error("Unable to load CGPA.");
        }

        const cgpa = result.data.cgpa;
        const element = document.getElementById("currentCGPA");

        if (element) {
            element.textContent =
                cgpa !== null && cgpa !== undefined
                    ? Number(cgpa).toFixed(2)
                    : "--";
        }

        console.log("CGPA:", cgpa);

    } catch (error) {
        console.error("CGPA loading error:", error);
    }
}

// Load total subjects with recorded marks
async function loadSubjectCount() {
    try {
        const response = await fetch(
            `http://localhost:5000/api/subjects/count/${ENROLLMENT_NO}`
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error("Unable to load subject count.");
        }

        setText("subjectCount", result.data.subjectCount);

        console.log("Subject count:", result.data.subjectCount);

    } catch (error) {
        console.error("Subject count error:", error);
    }
}

// Load actual subject performance chart
async function loadPerformanceChart() {
    const canvas = document.getElementById("performanceChart");

    if (!canvas) {
        console.error("Performance chart canvas not found.");
        return;
    }

    if (typeof Chart === "undefined") {
        console.error("Chart.js library is not loaded.");
        return;
    }

    try {
        const response = await fetch(
            `http://localhost:5000/api/performance/${ENROLLMENT_NO}`
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error("Unable to load performance data.");
        }

        const subjects = result.data || [];

        if (subjects.length === 0) {
            console.warn("No performance data available.");
            return;
        }

        // Avoid creating duplicate charts
        const existingChart = Chart.getChart(canvas);

        if (existingChart) {
            existingChart.destroy();
        }

        performanceChart = new Chart(canvas, {
            type: "bar",

            data: {
                labels: subjects.map(subject => subject.subject_code),

                datasets: [{
                    label: "Marks Percentage",
                    data: subjects.map(subject =>
                        Number(subject.percentage)
                    ),
                    borderWidth: 1
                }]
            },

            options: {
                responsive: true,
                maintainAspectRatio: false,

                scales: {
                    y: {
                        beginAtZero: true,
                        min: 0,
                        max: 100,
                        title: {
                            display: true,
                            text: "Percentage (%)"
                        }
                    },

                    x: {
                        title: {
                            display: true,
                            text: "Subjects"
                        }
                    }
                },

                plugins: {
                    legend: {
                        display: true
                    },

                    tooltip: {
                        callbacks: {
                            label: context =>
                                `${context.parsed.y}%`
                        }
                    }
                }
            }
        });

        console.log("Performance chart loaded successfully.");

    } catch (error) {
        console.error("Performance chart error:", error);
    }
}

// Initialize dashboard
loadStudents();
loadResults();
loadSGPA();
loadCGPA();
loadSubjectCount();
loadPerformanceChart();

