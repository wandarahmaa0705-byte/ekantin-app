// ==========================================
// AMBIL ELEMENT
// ==========================================

const loginForm = document.getElementById("loginForm");

const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");

const usernameError = document.getElementById("usernameError");
const passwordError = document.getElementById("passwordError");

const showPasswordButton =
    document.getElementById("showPassword");

const loginButton =
    document.getElementById("loginButton");

const loginText =
    document.getElementById("loginText");

const googleButton =
    document.getElementById("googleButton");

const forgotPassword =
    document.getElementById("forgotPassword");

const registerLink =
    document.getElementById("registerLink");


// ==========================================
// TAMPIL / SEMBUNYIKAN PASSWORD
// ==========================================

showPasswordButton.addEventListener("click", function () {

    if (passwordInput.type === "password") {

        passwordInput.type = "text";

        showPasswordButton.textContent = "🙈";

    } else {

        passwordInput.type = "password";

        showPasswordButton.textContent = "👁";
    }

});


// ==========================================
// VALIDASI LOGIN
// ==========================================

loginForm.addEventListener("submit", async function (event) {

    event.preventDefault();

    let valid = true;


    // Reset error

    usernameError.textContent = "";
    passwordError.textContent = "";


    // Validasi username

    if (usernameInput.value.trim() === "") {

        usernameError.textContent =
            "Email atau nomor telepon harus diisi.";

        valid = false;
    }


    // Validasi password

    if (passwordInput.value.trim() === "") {

        passwordError.textContent =
            "Password harus diisi.";

        valid = false;

    } else if (passwordInput.value.length < 6) {

        passwordError.textContent =
            "Password minimal 6 karakter.";

        valid = false;
    }


    if (!valid) return;

    loginText.textContent = "Memproses...";
    loginButton.disabled = true;

    try {
        const response = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username: usernameInput.value.trim(),
                password: passwordInput.value
            })
        });
        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
            throw new Error("Server API tidak terjangkau. Sambungkan ponsel ke Wi-Fi yang sama dengan laptop dan pastikan server berjalan.");
        }
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Login gagal.");

        localStorage.setItem("ekantinToken", result.token);
        localStorage.setItem("ekantinUser", JSON.stringify(result.user));
        localStorage.setItem("isLoggedIn", "true");
        localStorage.setItem("userName", result.user.name);
        localStorage.setItem("userNIS", result.user.identityCode || "");
        localStorage.setItem("userEmail", result.user.email);
        localStorage.setItem("ekantinRole", result.user.role);
        localStorage.setItem("ekantinSaldo", String(result.balance));

        window.location.href = result.user.role === "seller" ? "seller.html" : "dashboard.html";
    } catch (error) {
        passwordError.textContent = error.message || "Server tidak terhubung. Jalankan npm start terlebih dahulu.";
    } finally {
        loginText.textContent = "Masuk";
        loginButton.disabled = false;
    }

});


// ==========================================
// LUPA PASSWORD
// ==========================================

forgotPassword.addEventListener("click", function (event) {

    event.preventDefault();

    alert(
        "Fitur lupa password akan tersedia pada tahap berikutnya."
    );

});


// ==========================================
// DAFTAR AKUN
// ==========================================

// ==========================================
// DAFTAR AKUN
// ==========================================

registerLink.addEventListener("click", function (event) {

    event.preventDefault();

    // Pindah ke halaman pendaftaran
    window.location.href = "register.html";

});


// ==========================================
// GOOGLE LOGIN
// ==========================================

// ==========================================
// LOGIN DENGAN GOOGLE
// ==========================================

googleButton.addEventListener("click", function () {

    // Ubah tampilan tombol
    googleButton.disabled = true;

    googleButton.innerHTML = `
        <span class="google-icon">G</span>
        Menghubungkan ke Google...
    `;


    // Simulasi proses login
    setTimeout(function () {

        // Simpan status login sementara
        localStorage.setItem("loginMethod", "google");
        localStorage.setItem("isLoggedIn", "true");

        // Simpan nama sementara
        localStorage.setItem(
            "userName",
            "Pengguna eKantin"
        );

        // Tampilkan pesan
        alert(
            "Login Google berhasil!\n\n" +
            "Selamat datang di eKantin."
        );


        // Arahkan ke halaman utama
        window.location.href = "dashboard.html";

    }, 1500);

});