const loginForm = document.getElementById("loginForm");
const message = document.getElementById("message");
const loginButton = document.getElementById("loginButton");

loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    message.textContent = "Logging in...";
    message.style.color = "#2563eb";
    loginButton.disabled = true;

    try {
        const response = await fetch("http://localhost:5000/api/auth/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email: email,
                password: password
            })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Login failed.");
        }

        // Save login information for this browser tab
        sessionStorage.setItem("token", data.token);
        sessionStorage.setItem("user", JSON.stringify(data.user));

        message.style.color = "green";
        message.textContent = "Login successful!";

        if (data.user.role === "student") {
    window.location.href = "student-dashboard.html";
} else if (data.user.role === "faculty") {
    window.location.href = "faculty-dashboard.html";
} else if (data.user.role === "admin") {
    window.location.href = "admin-dashboard.html";
} else {
    message.textContent = "Unknown user role.";
}

    } catch (error) {
        message.style.color = "red";

        if (error instanceof TypeError) {
            message.textContent =
                "Cannot connect to the server. Check whether the backend is running.";
        } else {
            message.textContent = error.message;
        }
    } finally {
        loginButton.disabled = false;
    }
});