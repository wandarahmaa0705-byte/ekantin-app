function formatRupiah(number) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0
    }).format(Number(number) || 0);
}

function getSellerStatusDetails(status) {
    const statuses = {
        "Sedang dibuat": { className: "preparing", description: "Penjual sedang menyiapkan pesanan." },
        "Siap diantar": { className: "ready", description: "Pesanan siap diantar." },
        "Siap diambil": { className: "ready", description: "Pesanan siap diambil di kantin." },
        "Selesai": { className: "complete", description: "Pesanan telah selesai." }
    };
    return statuses[status] || { className: "unknown", description: "Status proses belum tersedia." };
}

const sessionToken = localStorage.getItem("ekantinToken");
const currentUser = JSON.parse(localStorage.getItem("ekantinUser") || "null");

if (!sessionToken || !currentUser) {
    window.location.href = "index.html";
} else if (currentUser.role !== "buyer") {
    window.location.href = "seller.html";
}

async function getOrderHistory() {
    const response = await fetch("/api/orders/mine", {
        headers: { Authorization: `Bearer ${sessionToken}` }
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Riwayat pesanan gagal dimuat.");
    return result.orders;
}

async function renderOrderHistory() {
    const historyContainer = document.getElementById("orderHistory");

    if (!historyContainer) {
        return;
    }

    let history;
    try {
        history = await getOrderHistory();
    } catch (error) {
        historyContainer.textContent = error.message || "Server tidak terhubung.";
        return;
    }

    if (history.length === 0) {
        historyContainer.innerHTML = `
            <div class="empty-history">
                <div class="empty-history-icon">📋</div>
                <h3>Belum ada riwayat pesanan</h3>
                <p>Pesanan yang berhasil dibayar akan muncul di sini.</p>
            </div>
        `;
        return;
    }

    historyContainer.innerHTML = history.map(order => {
        const items = Array.isArray(order.items) ? order.items : [];
        const sellerProgress = Array.isArray(order.sellerProgress) ? order.sellerProgress : [];
        const itemMarkup = items.map(item => `
            <div class="order-item">
                <div>
                    <div class="order-item-name">${escapeHTML(item.name)}</div>
                    <div class="order-item-detail">
                        ${item.quantity} x ${formatRupiah(item.price)}
                    </div>
                </div>
                <strong>${formatRupiah(Number(item.price) * Number(item.quantity))}</strong>
            </div>
        `).join("");
        const progressMarkup = sellerProgress.length
            ? `
                <section class="order-progress" aria-label="Proses penjual">
                    <h3>Proses Penjual</h3>
                    <div class="seller-progress-list">
                        ${sellerProgress.map(progress => {
                            const status = String(progress.status || "");
                            const details = getSellerStatusDetails(status);
                            return `
                                <div class="seller-progress-item">
                                    <div class="seller-progress-info">
                                        <strong>${escapeHTML(progress.canteenName || "Kantin")}</strong>
                                        <span>${escapeHTML(details.description)}</span>
                                    </div>
                                    <span class="seller-status ${details.className}">${escapeHTML(status || "Belum diproses")}</span>
                                </div>
                            `;
                        }).join("")}
                    </div>
                </section>
            `
            : "";

        return `
            <article class="order-card">
                <div class="order-card-header">
                    <div>
                        <strong>Pesanan Berhasil</strong>
                        <div class="order-date">${escapeHTML(order.date)}</div>
                    </div>
                    <div class="order-payment">${escapeHTML(order.paymentMethod || "Saldo eKantin")}</div>
                </div>
                <div class="order-items">${itemMarkup}</div>
                ${progressMarkup}
                <div class="order-summary">
                    <span>Total Pesanan</span>
                    <strong>${formatRupiah(order.total)}</strong>
                </div>
            </article>
        `;
    }).join("");
}

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function goBack() {
    window.history.back();
}

document.addEventListener("DOMContentLoaded", renderOrderHistory);
