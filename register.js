// ==========================================
// ELEMENT
// ==========================================

const registerForm = document.getElementById("registerForm");

const nameInput = document.getElementById("name");
const nisInput = document.getElementById("nis");
const emailInput = document.getElementById("email");

const registerPassword =
    document.getElementById("registerPassword");

const confirmPassword =
    document.getElementById("confirmPassword");

const accountRole = document.getElementById("accountRole");
const buyerType = document.getElementById("buyerType");
const buyerTypeGroup = document.getElementById("buyerTypeGroup");
const canteenGroup = document.getElementById("canteenGroup");
const canteenNameInput = document.getElementById("canteenName");
const identityGroup = document.getElementById("identityGroup");
const identityLabel = document.getElementById("identityLabel");

function updateRegistrationFields() {
    const isBuyer = accountRole.value === "buyer";
    buyerTypeGroup.hidden = !isBuyer;
    identityGroup.hidden = !isBuyer;
    canteenGroup.hidden = isBuyer;
    nisInput.required = isBuyer;
    buyerType.required = isBuyer;
    canteenNameInput.required = !isBuyer;
    identityLabel.textContent = "Nomor Telepon";
    nisInput.placeholder = "Masukkan nomor telepon";
}

accountRole.addEventListener("change", updateRegistrationFields);
buyerType.addEventListener("change", updateRegistrationFields);
updateRegistrationFields();


// ==========================================
// SHOW PASSWORD
// ==========================================

document
    .getElementById("showRegisterPassword")
    .addEventListener("click", function () {

        if (registerPassword.type === "password") {

            registerPassword.type = "text";
            this.textContent = "🙈";

        } else {

            registerPassword.type = "password";
            this.textContent = "👁";

        }
    });


document
    .getElementById("showConfirmPassword")
    .addEventListener("click", function () {

        if (confirmPassword.type === "password") {

            confirmPassword.type = "text";
            this.textContent = "🙈";

        } else {

            confirmPassword.type = "password";
            this.textContent = "👁";

        }
    });


// ==========================================
// FORM DAFTAR
// ==========================================

registerForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const errors = ["nameError", "nisError", "emailError", "registerPasswordError", "confirmPasswordError", "canteenError"];
    errors.forEach(id => document.getElementById(id).textContent = "");
    document.getElementById("roleError").textContent = "";

    let valid = true;
    if (!nameInput.value.trim()) {
        document.getElementById("nameError").textContent = "Nama lengkap harus diisi.";
        valid = false;
    }
    if (accountRole.value === "buyer" && !nisInput.value.trim()) {
        document.getElementById("nisError").textContent = "Nomor telepon harus diisi.";
        valid = false;
    }
    if (!emailInput.value.trim()) {
        document.getElementById("emailError").textContent = "Email harus diisi.";
        valid = false;
    }
    if (accountRole.value === "seller" && !canteenNameInput.value.trim()) {
        document.getElementById("canteenError").textContent = "Nama kantin harus diisi.";
        valid = false;
    }
    if (registerPassword.value.length < 6) {
        document.getElementById("registerPasswordError").textContent = "Password minimal 6 karakter.";
        valid = false;
    }
    if (confirmPassword.value !== registerPassword.value) {
        document.getElementById("confirmPasswordError").textContent = "Password tidak sama.";
        valid = false;
    }
    if (!valid) return;

    const submitButton = document.getElementById("registerButton");
    submitButton.disabled = true;
    submitButton.textContent = "Memproses...";

    try {
        const response = await fetch("/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: nameInput.value.trim(),
                email: emailInput.value.trim(),
                password: registerPassword.value,
                role: accountRole.value,
                buyerType: accountRole.value === "buyer" ? buyerType.value : null,
                identityCode: accountRole.value === "buyer" ? nisInput.value.trim() : null,
                canteenName: accountRole.value === "seller" ? canteenNameInput.value.trim() : null
            })
        });
            const responseText = await response.text();
            let result;
            try {
                result = JSON.parse(responseText);
            } catch {
                throw new Error("Server mengirim halaman web, bukan respons API. Periksa URL backend pada capacitor.config.json dan pastikan server eKantin aktif.");
            }
        if (!response.ok) throw new Error(result.error || "Pendaftaran gagal.");

        alert("Akun berhasil dibuat. Silakan masuk.");
        window.location.href = "index.html";
    } catch (error) {
        alert(error.message || "Server tidak terhubung. Jalankan npm start terlebih dahulu.");
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Daftar";
    }
});