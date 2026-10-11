/* =====================================================
   TOP UP SALDO eKANTIN
===================================================== */


/* =====================================================
   DATA
===================================================== */

let selectedAmount = 0;
const sessionToken = localStorage.getItem("ekantinToken");
const currentUser = JSON.parse(localStorage.getItem("ekantinUser") || "null");
let currentBalance = Number(localStorage.getItem("ekantinSaldo")) || 0;

if (!sessionToken || !currentUser) {
    window.location.href = "index.html";
} else if (currentUser.role !== "buyer") {
    window.location.href = "seller.html";
}


/* =====================================================
   FORMAT RUPIAH
===================================================== */

function formatRupiah(number) {

    return new Intl.NumberFormat("id-ID", {

        style: "currency",

        currency: "IDR",

        minimumFractionDigits: 0

    }).format(number);

}


/* =====================================================
   AMBIL SALDO
===================================================== */

function getBalance() {
    return currentBalance;
}


/* =====================================================
   TAMPILKAN SALDO
===================================================== */

function displayBalance() {

    const balance =
        getBalance();


    const balanceElement =
        document.getElementById(
            "currentBalance"
        );


    if (balanceElement) {

        balanceElement.textContent =
            formatRupiah(balance);

    }

}


/* =====================================================
   PILIH NOMINAL
===================================================== */

function selectAmount(amount) {

    selectedAmount = amount;


    /* Hapus pilihan aktif sebelumnya */

    document
        .querySelectorAll(".nominal-button")
        .forEach(button => {

            button.classList.remove("active");

        });


    /* Tandai tombol yang dipilih */

    document
        .querySelectorAll(".nominal-button")
        .forEach(button => {

            const buttonValue =
                parseInt(
                    button.innerText.replace(
                        /\D/g,
                        ""
                    )
                );


            if (buttonValue === amount) {

                button.classList.add("active");

            }

        });


    /* Kosongkan input custom */

    const customInput =
        document.getElementById(
            "customAmount"
        );


    if (customInput) {

        customInput.value = "";

    }


    updateSelectedAmount();

}


/* =====================================================
   INPUT NOMINAL CUSTOM
===================================================== */

function customAmountChanged() {

    const customInput =
        document.getElementById(
            "customAmount"
        );


    if (!customInput) {

        return;

    }


    const value =
        Number(customInput.value);


    if (value > 0) {

        selectedAmount = value;


        /* Hilangkan pilihan tombol */

        document
            .querySelectorAll(".nominal-button")
            .forEach(button => {

                button.classList.remove(
                    "active"
                );

            });

    } else {

        selectedAmount = 0;

    }


    updateSelectedAmount();

}


/* =====================================================
   TAMPILKAN NOMINAL YANG DIPILIH
===================================================== */

function updateSelectedAmount() {

    const selectedElement =
        document.getElementById(
            "selectedAmount"
        );


    if (selectedElement) {

        selectedElement.textContent =
            formatRupiah(
                selectedAmount
            );

    }

}


/* =====================================================
   PROSES TOP UP
===================================================== */

async function processTopUp() {
    if (selectedAmount <= 0) {
        alert("Silakan pilih nominal top up terlebih dahulu.");
        return;
    }

    if (selectedAmount < 1000) {
        alert("Minimal top up adalah Rp1.000.");
        return;
    }

    const sellerIdInput = document.getElementById("sellerId");
    const paymentMethodSelect = document.getElementById("paymentMethod");
    const paymentProofInput = document.getElementById("paymentProof");
    const paymentProofImageInput = document.getElementById("paymentProofImage");
    const sellerId = Number(sellerIdInput ? sellerIdInput.value : "0");
    const paymentMethod = paymentMethodSelect ? paymentMethodSelect.value : "QRIS";
    const proofText = paymentProofInput ? paymentProofInput.value.trim() : "";

    if (!Number.isSafeInteger(sellerId) || sellerId <= 0) {
        alert("Masukkan ID penjual tujuan yang valid.");
        return;
    }

    const topUpAmount = selectedAmount;

    let proofImage = "";
    if (paymentProofImageInput && paymentProofImageInput.files && paymentProofImageInput.files[0]) {
        const file = paymentProofImageInput.files[0];
        if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
            alert("Format bukti transfer harus PNG, JPG, atau WebP.");
            return;
        }
        if (file.size > 4 * 1024 * 1024) {
            alert("Ukuran bukti transfer maksimal 4 MB.");
            return;
        }

        proofImage = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(new Error("Bukti transfer gagal dibaca."));
            reader.readAsDataURL(file);
        });
    }

    try {
        const response = await fetch("/api/topup/request", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${sessionToken}`
            },
            body: JSON.stringify({ sellerId, amount: topUpAmount, paymentMethod, proofText, proofImage })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Request top up gagal.");
        alert(`Request top up berhasil dikirim ke penjual.\n\nMetode: ${paymentMethod}\nNominal: ${formatRupiah(topUpAmount)}\n\nStatus: menunggu persetujuan penjual.`);
        selectedAmount = 0;
        updateSelectedAmount();
        const customInput = document.getElementById("customAmount");
        if (customInput) customInput.value = "";
        document.querySelectorAll(".nominal-button").forEach(button => button.classList.remove("active"));
        if (sellerIdInput) sellerIdInput.value = "";
        if (paymentProofInput) paymentProofInput.value = "";
        if (paymentProofImageInput) paymentProofImageInput.value = "";
        const preview = document.getElementById("paymentProofPreview");
        if (preview) {
            preview.hidden = true;
            preview.removeAttribute("src");
        }
        await displayHistory();
    } catch (error) {
        alert(error.message || "Server tidak terhubung. Jalankan npm start terlebih dahulu.");
    }
}


/* =====================================================
   TAMPILKAN RIWAYAT TOP UP
===================================================== */

async function displayHistory() {
    const historyContainer = document.getElementById("topupHistory");
    const statusContainer = document.getElementById("topupRequestStatus");
    if (!historyContainer || !statusContainer) return;

    let history = [];
    let requests = [];
    try {
        const [transactionsResponse, requestResponse] = await Promise.all([
            fetch("/api/transactions/topups", { headers: { Authorization: `Bearer ${sessionToken}` } }),
            fetch("/api/topup/requests", { headers: { Authorization: `Bearer ${sessionToken}` } })
        ]);

        const transactionsResult = await transactionsResponse.json();
        const requestResult = await requestResponse.json();
        if (!transactionsResponse.ok) throw new Error(transactionsResult.error || "Riwayat top up gagal dimuat.");
        if (!requestResponse.ok) throw new Error(requestResult.error || "Status request top up gagal dimuat.");

        history = transactionsResult.transactions || [];
        requests = requestResult.requests || [];
    } catch (error) {
        historyContainer.textContent = error.message || "Server tidak terhubung.";
        statusContainer.textContent = error.message || "Server tidak terhubung.";
        return;
    }

    historyContainer.innerHTML = "";

    const latestRequests = requests.slice(0, 5);
    const statusSummary = {
        pending: requests.filter(request => request.status === "pending").length,
        approved: requests.filter(request => request.status === "approved").length,
        rejected: requests.filter(request => request.status === "rejected").length
    };

    const summaryMarkup = `
        <div class="topup-status-summary">
            <div class="status-summary-item pending">
                <span>Menunggu</span>
                <strong>${statusSummary.pending}</strong>
            </div>
            <div class="status-summary-item approved">
                <span>Disetujui</span>
                <strong>${statusSummary.approved}</strong>
            </div>
            <div class="status-summary-item rejected">
                <span>Ditolak</span>
                <strong>${statusSummary.rejected}</strong>
            </div>
        </div>
    `;

    if (latestRequests.length === 0) {
        statusContainer.innerHTML = `${summaryMarkup}<div class="empty-history">Belum ada request top up yang dikirim.</div>`;
    } else {
        statusContainer.innerHTML = summaryMarkup + latestRequests.map(request => {
            const color = request.status === "pending" ? "#f59e0b" : request.status === "rejected" ? "#dc2626" : "#16a34a";
            return `
                <div class="history-item">
                    <div class="history-info">
                        <strong>${request.paymentMethod}</strong>
                        <small>${request.createdAt}</small>
                        <small style="display:block; color:${color}; font-weight:600;">Status: ${request.status}</small>
                        <small style="display:block;">Tujuan: ${escapeHTML(request.sellerName || "Penjual")}</small>
                        ${request.proofText ? `<small style="display:block;">Catatan: ${escapeHTML(request.proofText)}</small>` : ""}
                        ${request.proofImage ? `<button type="button" class="proof-open-button" data-proof-url="${request.proofImage}">Lihat bukti</button>` : ""}
                    </div>
                    <div class="history-amount">${request.status === "approved" ? "+" : ""}${formatRupiah(request.amount)}</div>
                </div>
            `;
        }).join("");

        statusContainer.querySelectorAll("[data-proof-url]").forEach(button => {
            button.addEventListener("click", () => openProofModal(button.dataset.proofUrl));
        });
    }

    const combined = [
        ...requests.map(request => ({
            type: "request",
            amount: request.amount,
            date: request.createdAt,
            label: `Top Up ${request.paymentMethod}`,
            status: request.status,
            proofImage: request.proofImage,
            sellerName: request.sellerName,
            note: request.proofText || "Bukti transfer tersedia"
        })),
        ...history.map(item => ({
            type: "transaction",
            amount: item.amount,
            date: item.date,
            label: "Top Up Saldo",
            status: "approved",
            note: "Saldo sudah masuk"
        }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    if (combined.length === 0) {
        historyContainer.innerHTML = '<div class="empty-history">Belum ada riwayat top up.</div>';
        return;
    }

    combined.forEach(item => {
        const element = document.createElement("div");
        element.className = "history-item";
        const statusText = item.type === "request" ? item.status : "approved";
        const statusColor = statusText === "pending" ? "#f59e0b" : statusText === "rejected" ? "#dc2626" : "#16a34a";
        const proofMarkup = item.proofImage
            ? `<button type="button" class="proof-open-button" data-proof-url="${item.proofImage}">Lihat bukti</button>`
            : "";
        element.innerHTML = `
            <div class="history-info">
                <strong>${item.label}</strong>
                <small>${item.date}</small>
                <small style="display:block; color:${statusColor}; font-weight:600;">Status: ${statusText}</small>
                ${item.type === "request" && item.sellerName ? `<small style="display:block;">Tujuan: ${escapeHTML(item.sellerName)}</small>` : ""}
                ${item.note ? `<small style="display:block;">${escapeHTML(item.note)}</small>` : ""}
                ${proofMarkup}
            </div>
            <div class="history-amount">${item.type === "request" && statusText !== "approved" ? "Menunggu" : "+"}${formatRupiah(item.amount)}</div>
        `;
        historyContainer.appendChild(element);
    });

    historyContainer.querySelectorAll("[data-proof-url]").forEach(button => {
        button.addEventListener("click", () => openProofModal(button.dataset.proofUrl));
    });
}

function openProofModal(imageUrl) {
    let modal = document.getElementById("proofModal");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "proofModal";
        modal.className = "proof-modal";
        modal.innerHTML = `
            <div class="proof-modal-content">
                <button type="button" class="proof-modal-close" aria-label="Tutup preview">×</button>
                <img class="proof-modal-image" src="" alt="Bukti transfer" />
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector(".proof-modal-close").addEventListener("click", () => modal.classList.remove("open"));
        modal.addEventListener("click", event => {
            if (event.target === modal) modal.classList.remove("open");
        });
    }

    const image = modal.querySelector(".proof-modal-image");
    image.src = imageUrl;
    modal.classList.add("open");
}


/* =====================================================
   KEMBALI
===================================================== */

function goBack() {

    window.history.back();

}


/* =====================================================
   JALANKAN SAAT HALAMAN DIBUKA
===================================================== */

const proofImageInput = document.getElementById("paymentProofImage");
if (proofImageInput) {
    proofImageInput.addEventListener("change", () => {
        const file = proofImageInput.files[0];
        const preview = document.getElementById("paymentProofPreview");
        if (!preview) return;
        if (!file) {
            preview.hidden = true;
            preview.removeAttribute("src");
            return;
        }
        preview.src = URL.createObjectURL(file);
        preview.hidden = false;
    });
}

document.addEventListener(
    "DOMContentLoaded",
    async function() {
        try {
            const response = await fetch("/api/balance", {
                headers: { Authorization: `Bearer ${sessionToken}` }
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "Saldo gagal dimuat.");
            currentBalance = result.balance;
            localStorage.setItem("ekantinSaldo", String(currentBalance));
            displayBalance();
        } catch (error) {
            alert(error.message || "Server tidak terhubung. Jalankan npm start terlebih dahulu.");
            window.location.href = "index.html";
            return;
        }
        updateSelectedAmount();
        await displayHistory();
    }
);