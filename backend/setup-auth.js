
const readline = require("readline/promises");
const bcrypt = require("bcryptjs");
const db = require("./config/db");

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function ask(question) {
    return (await rl.question(question)).trim();
}

async function main() {
    try {
        console.log("\n=== APARMS Account Setup ===\n");

        // Set passwords for existing Student and Faculty accounts
        for (const role of ["student", "faculty"]) {
            const email = await ask(`${role} account email: `);

            const [users] = await db.query(
                "SELECT user_id FROM users WHERE email = ? AND role = ?",
                [email, role]
            );

            if (users.length === 0) {
                console.log(`No existing ${role} account found. Skipping.`);
                continue;
            }

            const password = await ask(
                `New password for ${role} account: `
            );

            if (password.length < 8) {
                throw new Error("Password must be at least 8 characters.");
            }

            const hash = await bcrypt.hash(password, 12);

            await db.query(
                "UPDATE users SET password_hash = ? WHERE user_id = ?",
                [hash, users[0].user_id]
            );

            console.log(`${role} password updated successfully.`);
        }

        // Create or update the Admin account
        const adminName = await ask("Admin full name: ");
        const adminEmail = await ask("Admin email: ");
        const adminPassword = await ask("Admin password: ");

        if (!adminName || !adminEmail || adminPassword.length < 8) {
            throw new Error(
                "Admin name/email are required and password must be at least 8 characters."
            );
        }

        const [existing] = await db.query(
            "SELECT user_id, role FROM users WHERE email = ?",
            [adminEmail]
        );

        if (existing.length > 0 && existing[0].role !== "admin") {
            throw new Error(
                "That email belongs to a non-admin account. Choose another email."
            );
        }

        const adminHash = await bcrypt.hash(adminPassword, 12);

        if (existing.length > 0) {
            await db.query(
                `UPDATE users
                 SET full_name = ?, password_hash = ?, is_active = 1
                 WHERE user_id = ?`,
                [adminName, adminHash, existing[0].user_id]
            );
        } else {
            await db.query(
                `INSERT INTO users
                 (full_name, email, password_hash, role, is_active)
                 VALUES (?, ?, ?, 'admin', 1)`,
                [adminName, adminEmail, adminHash]
            );
        }

        console.log("\nAdmin account ready!");
        console.log("Account setup completed successfully.");

    } catch (error) {
        console.error("\nSetup error:", error.message);
    } finally {
        rl.close();
        await db.end();
    }
}

main();
