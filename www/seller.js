const token = localStorage.getItem("ekantinToken");
const user = JSON.parse(localStorage.getItem("ekantinUser") || "null");
const menuForm = document.getElementById("menuForm");
const sellerMenu = document.getElementById("sellerMenu");
const sellerOrders = document.getElementById("sellerOrders");
const sellerCompleted = document.getElementById("sellerCompleted");
const sellerOrderCount = document.getElementById("sellerOrderCount");
const sellerBalanceDisplay = document.getElementById("sellerBalance");
const formMessage = document.getElementById("formMessage");
const pageMessage = document.getElementById("pageMessage");
const saveMenuButton = document.getElementById("saveMenuButton");
const cancelEditButton = document.getElementById("cancelEditButton");
const menuImageInput = document.getElementById("menuImage");
const menuImagePreview = document.getElementById("menuImagePreview");
const imageUploadStatus = document.getElementById("imageUploadStatus");
const buyerTopupForm = document.getElementById("buyerTopupForm");
const topupRequestsList = document.getElementById("topupRequestsList");
let editingMenuId = null;
let currentImageUrl = "";
let selectedImageFile = null;

if (!token || !user) {
    window.location.href = "index.html";
} else if (user.role !== "seller") {
    window.location.href = "dashboard.html";
}

if (user) {
    document.getElementById("sellerIdentity").textContent = user.name;
    const canteenTitle = document.getElementById("canteenTitle");
    if (canteenTitle) canteenTitle.textContent = user.canteenName || "Kantin";
    const sellerProfileName = document.getElementById("sellerProfileName");
    const sellerProfileCanteen = document.getElementById("sellerProfileCanteen");
    const sellerProfileEmail = document.getElementById("sellerProfileEmail");
    const sellerProfileId = document.getElementById("sellerProfileId");
    const sellerQrisImage = document.getElementById("sellerQrisImage");
    const sellerQrisPreview = document.getElementById("sellerQrisPreview");
    if (sellerProfileName) sellerProfileName.textContent = user.name || "-";
    if (sellerProfileCanteen) sellerProfileCanteen.textContent = user.canteenName || "Kantin";
    if (sellerProfileEmail) sellerProfileEmail.textContent = user.email || "-";
    if (sellerProfileId) sellerProfileId.textContent = String(user.id || "-");
    if (sellerQrisImage && sellerQrisPreview) {
        sellerQrisImage.src = user.qrisImage || "";
        sellerQrisPreview.hidden = !user.qrisImage;
    }
}

const copySellerIdButton = document.getElementById("copySellerIdButton");
if (copySellerIdButton) copySellerIdButton.addEventListener("click", async () => {
    const sellerId = String(user?.id || "");
    const message = document.getElementById("sellerProfileMessage");
    if (!sellerId) return;

    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(sellerId);
        } else {
            throw new Error("Clipboard API tidak tersedia.");
        }
        message.textContent = "ID penjual berhasil disalin.";
    } catch {
        const copyInput = document.createElement("textarea");
        copyInput.value = sellerId;
        copyInput.setAttribute("readonly", "");
        copyInput.style.position = "fixed";
        copyInput.style.opacity = "0";
        document.body.append(copyInput);
        copyInput.select();
        const copied = document.execCommand("copy");
        copyInput.remove();
        message.textContent = copied ? "ID penjual berhasil disalin." : `Salin ID penjual ini secara manual: ${sellerId}`;
    }
});

async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            ...(options.headers || {})
        }
    });
    const result = await response.json();
    if (response.status === 401) {
        localStorage.clear();
        window.location.href = "index.html";
    }
    if (!response.ok) throw new Error(result.error || "Permintaan gagal.");
    return result;
}

const sellerProfileDialog = document.getElementById("sellerProfileDialog");
const sellerProfileForm = document.getElementById("sellerProfileForm");
const sellerProfileFormMessage = document.getElementById("sellerProfileFormMessage");

if (sellerProfileDialog && sellerProfileForm) {
    document.getElementById("editSellerProfileButton").addEventListener("click", () => {
        document.getElementById("sellerEditName").value = user.name || "";
        document.getElementById("sellerEditEmail").value = user.email || "";
        document.getElementById("sellerEditCanteenName").value = user.canteenName || "";
        sellerProfileFormMessage.textContent = "";
        sellerProfileDialog.showModal();
    });

    document.getElementById("closeSellerProfileDialog").addEventListener("click", () => sellerProfileDialog.close());
    document.getElementById("cancelSellerProfileDialog").addEventListener("click", () => sellerProfileDialog.close());

    sellerProfileForm.addEventListener("submit", async event => {
        event.preventDefault();
        sellerProfileFormMessage.textContent = "";
        try {
            const result = await apiRequest("/api/account/profile", {
                method: "PUT",
                body: JSON.stringify({
                    name: document.getElementById("sellerEditName").value.trim(),
                    email: document.getElementById("sellerEditEmail").value.trim(),
                    canteenName: document.getElementById("sellerEditCanteenName").value.trim()
                })
            });
            Object.assign(user, result.user);
            localStorage.setItem("ekantinUser", JSON.stringify(user));
            document.getElementById("sellerIdentity").textContent = user.name;
            document.getElementById("sellerProfileName").textContent = user.name;
            document.getElementById("sellerProfileEmail").textContent = user.email;
            document.getElementById("sellerProfileCanteen").textContent = user.canteenName;
            sellerProfileDialog.close();
            document.getElementById("sellerProfileMessage").textContent = "Profil berhasil diperbarui.";
        } catch (error) {
            sellerProfileFormMessage.textContent = error.message || "Profil gagal diperbarui.";
        }
    });
}

const sellerQrisInput = document.getElementById("sellerQrisInput");
const sellerQrisPreview = document.getElementById("sellerQrisPreview");
const sellerQrisImage = document.getElementById("sellerQrisImage");
const sellerQrisMessage = document.getElementById("sellerQrisMessage");
const removeSellerQrisButton = document.getElementById("removeSellerQrisButton");

if (sellerQrisInput) sellerQrisInput.addEventListener("change", async () => {
    const file = sellerQrisInput.files[0];
    if (!file) return;
    sellerQrisMessage.textContent = "";

    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
        sellerQrisMessage.textContent = "Pilih gambar PNG, JPG, atau WebP.";
        sellerQrisInput.value = "";
        return;
    }
    if (file.size > 4 * 1024 * 1024) {
        sellerQrisMessage.textContent = "Ukuran gambar QRIS maksimal 4 MB.";
        sellerQrisInput.value = "";
        return;
    }

    try {
        const imageData = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.addEventListener("load", () => resolve(reader.result));
            reader.addEventListener("error", () => reject(new Error("Gambar QRIS gagal dibaca.")));
            reader.readAsDataURL(file);
        });
        const result = await apiRequest("/api/seller/qris", {
            method: "POST",
            body: JSON.stringify({ imageData })
        });
        user.qrisImage = result.qrisImage;
        localStorage.setItem("ekantinUser", JSON.stringify(user));
        sellerQrisImage.src = result.qrisImage;
        sellerQrisPreview.hidden = false;
        sellerQrisMessage.textContent = "QRIS kantin berhasil disimpan.";
    } catch (error) {
        sellerQrisMessage.textContent = error.message || "QRIS gagal diunggah.";
    } finally {
        sellerQrisInput.value = "";
    }
});

if (removeSellerQrisButton) removeSellerQrisButton.addEventListener("click", async () => {
    if (!confirm("Hapus QRIS kantin? Pembeli tidak dapat membayar dengan QRIS sampai gambar diunggah kembali.")) return;
    sellerQrisMessage.textContent = "";
    try {
        await apiRequest("/api/seller/qris", { method: "DELETE" });
        user.qrisImage = null;
        localStorage.setItem("ekantinUser", JSON.stringify(user));
        sellerQrisImage.removeAttribute("src");
        sellerQrisPreview.hidden = true;
        sellerQrisMessage.textContent = "QRIS kantin dihapus.";
    } catch (error) {
        sellerQrisMessage.textContent = error.message || "QRIS gagal dihapus.";
    }
});

function formatRupiah(amount) {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(amount);
}

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

async function loadMenu() {
    const result = await apiRequest("/api/seller/menu");
    document.getElementById("menuCount").textContent = `${result.items.length} menu`;
    if (result.items.length === 0) {
        sellerMenu.innerHTML = '<p class="empty-message">Belum ada menu. Tambahkan menu pertamamu.</p>';
        return;
    }

    sellerMenu.innerHTML = `<div class="menu-list">${result.items.map(item => `
        <article class="menu-row">
            <div>
                <h3>${escapeHTML(item.name)}</h3>
                <p>${escapeHTML(item.category)} · ${formatRupiah(item.price)}</p>
                <p class="menu-stock"><span class="stock-badge ${item.available ? "ready" : "sold-out"}">${item.available ? "Ready" : "Sold out"}</span></p>
                <p>${escapeHTML(item.description || "Tanpa deskripsi")}</p>
                <p class="menu-nutrition">${item.calories != null || item.protein != null || item.carbs != null || item.fat != null
        ? `Gizi per porsi: ${[
                    item.calories != null ? `🔥 ${item.calories} kkal` : null,
                    item.protein != null ? `💪 ${item.protein} g protein` : null,
                    item.carbs != null ? `🍚 ${item.carbs} g karbohidrat` : null,
                    item.fat != null ? `🥑 ${item.fat} g lemak` : null
        ].filter(Boolean).map(escapeHTML).join(" · ")}`
        : "Gizi belum diisi"}</p>
            </div>
            <div class="menu-row-actions">
                <button class="stock-toggle" type="button" data-availability="${item.id}" data-next-availability="${item.available ? "0" : "1"}">${item.available ? "Tandai Sold out" : "Tandai Ready"}</button>
                <button type="button" data-edit="${item.id}">Ubah</button>
                <button class="delete-menu" type="button" data-delete="${item.id}">Hapus</button>
            </div>
        </article>`).join("")}</div>`;

    sellerMenu.querySelectorAll("[data-edit]").forEach(button => button.addEventListener("click", () => {
        const item = result.items.find(entry => entry.id === Number(button.dataset.edit));
        if (!menuForm) {
            window.location.href = `seller.html?edit=${item.id}`;
            return;
        }
        document.getElementById("menuName").value = item.name;
        document.getElementById("menuDescription").value = item.description;
        document.getElementById("menuCategory").value = item.category;
        document.getElementById("menuPrice").value = item.price;
        document.getElementById("menuCalories").value = item.calories ?? "";
        document.getElementById("menuProtein").value = item.protein ?? "";
        document.getElementById("menuCarbs").value = item.carbs ?? "";
        document.getElementById("menuFat").value = item.fat ?? "";
        menuImageInput.value = "";
        selectedImageFile = null;
        currentImageUrl = item.image || "";
        menuImagePreview.hidden = !currentImageUrl;
        if (currentImageUrl) menuImagePreview.src = currentImageUrl;
        imageUploadStatus.textContent = currentImageUrl ? "Foto saat ini dipertahankan jika tidak memilih foto baru." : "";
        editingMenuId = item.id;
        document.getElementById("formTitle").textContent = "Ubah menu";
        saveMenuButton.textContent = "Simpan perubahan";
        cancelEditButton.hidden = false;
        formMessage.textContent = "";
        document.getElementById("menuName").focus();
    }));

    sellerMenu.querySelectorAll("[data-availability]").forEach(button => button.addEventListener("click", async () => {
        button.disabled = true;
        try {
            await apiRequest(`/api/seller/menu/${button.dataset.availability}`, {
                method: "PATCH",
                body: JSON.stringify({ available: button.dataset.nextAvailability === "1" })
            });
            await loadMenu();
        } catch (error) {
            alert(error.message);
            button.disabled = false;
        }
    }));

    sellerMenu.querySelectorAll("[data-delete]").forEach(button => button.addEventListener("click", async () => {
        if (!confirm("Hapus menu ini dari daftar kantin?")) return;
        try {
            await apiRequest(`/api/seller/menu/${button.dataset.delete}`, { method: "DELETE" });
            await loadMenu();
        } catch (error) {
            alert(error.message);
        }
    }));
}

async function loadSellerBalance() {
    if (!sellerBalanceDisplay) return;
    const result = await apiRequest("/api/seller/balance");
    sellerBalanceDisplay.textContent = formatRupiah(result.balance);
}

async function loadOrders() {
    const result = await apiRequest("/api/seller/orders");
    const groupedOrders = groupSellerOrders(result.items);

    if (sellerOrderCount) {
        const count = groupedOrders.size;
        sellerOrderCount.textContent = count;
        sellerOrderCount.hidden = count === 0;
        sellerOrderCount.setAttribute("aria-label", `${count} pesanan masuk`);
    }

    if (sellerOrders) {
        renderSellerOrders(sellerOrders, groupedOrders, false);
    }

    if (sellerCompleted) {
        const completedResult = await apiRequest("/api/seller/orders/completed");
        renderSellerOrders(sellerCompleted, groupSellerOrders(completedResult.items), true);
    }
}

function groupSellerOrders(items) {
    const groupedOrders = new Map();
    for (const item of items) {
        if (!groupedOrders.has(item.orderId)) {
            groupedOrders.set(item.orderId, { ...item, items: [] });
        }
        groupedOrders.get(item.orderId).items.push(item);
    }
    return groupedOrders;
}

function renderSellerOrders(container, groupedOrders, completed) {
    if (groupedOrders.size === 0) {
        container.innerHTML = completed
            ? '<p class="empty-message">Belum ada pesanan yang selesai.</p>'
            : '<p class="empty-message">Belum ada pesanan untuk kantinmu.</p>';
        return;
    }

    container.innerHTML = [...groupedOrders.values()].map(order => {
        const isDelivery = order.deliveryMethod === "delivery";
        const action = order.sellerStatus === "Sedang dibuat" ? "ready" : "complete";
        const actionLabel = order.sellerStatus === "Sedang dibuat"
            ? "Tandai siap diserahkan"
            : isDelivery ? "Tandai sudah diantar" : "Tandai sudah diambil";
        return `
        <article class="order-row">
            <h3>Pesanan #${order.orderId}</h3>
            <p>${escapeHTML(order.buyerName)} · ${new Date(order.date).toLocaleString("id-ID")}</p>
            <p class="order-status"><span>${escapeHTML(order.sellerStatus)}</span></p>
            <ul class="order-item-list">${order.items.map(item => `
                <li>
                    <span>${escapeHTML(item.name)} · ${item.quantity} x ${formatRupiah(item.price)}</span>
                    <strong>${formatRupiah(item.price * item.quantity)}</strong>
                </li>
            `).join("")}</ul>
            <p class="order-method">
                <span>${isDelivery ? "🚚 Diantarkan" : "🏫 Ambil di kantin sendiri"}</span>
                <span>Ongkir ${formatRupiah(order.deliveryFee)}</span>
            </p>
            ${isDelivery ? `<p class="order-delivery-location">📍 Lokasi sekolah: ${escapeHTML(order.deliveryLocation || "Belum diisi")}</p>` : ""}
            ${completed
        ? `<p class="order-credit">💰 ${formatRupiah(order.creditedAmount)} masuk ke saldo kantin</p>`
        : `<div class="order-actions"><button class="button button-primary" type="button" data-order-action="${action}" data-order-id="${order.orderId}">${actionLabel}</button></div>`}
        </article>`;
    }).join("");

    if (!completed) {
        container.querySelectorAll("[data-order-action]").forEach(button => button.addEventListener("click", async () => {
            const action = button.dataset.orderAction;
            const orderId = Number(button.dataset.orderId);
            if (action === "complete" && !confirm(`Konfirmasi pesanan #${orderId} sudah diserahkan? Pendapatan kantin akan masuk ke saldo.`)) return;
            button.disabled = true;
            try {
                const result = await apiRequest(`/api/seller/orders/${orderId}/status`, {
                    method: "PATCH",
                    body: JSON.stringify({ action })
                });
                if (result.status === "Selesai" && pageMessage) {
                    pageMessage.textContent = `Pesanan #${orderId} selesai. ${formatRupiah(result.creditedAmount)} masuk ke saldo kantin.`;
                }
                if (result.balance !== undefined && sellerBalanceDisplay) {
                    sellerBalanceDisplay.textContent = formatRupiah(result.balance);
                }
                await loadOrders();
            } catch (error) {
                if (pageMessage) pageMessage.textContent = error.message;
                button.disabled = false;
            }
        }));
    }
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

    const img = modal.querySelector(".proof-modal-image");
    img.src = imageUrl;
    modal.classList.add("open");
}

function resetForm() {
    menuForm.reset();
    editingMenuId = null;
    selectedImageFile = null;
    currentImageUrl = "";
    menuImagePreview.removeAttribute("src");
    menuImagePreview.hidden = true;
    imageUploadStatus.textContent = "";
    document.getElementById("formTitle").textContent = "Tambah menu";
    saveMenuButton.textContent = "Simpan menu";
    cancelEditButton.hidden = true;
}

if (menuImageInput) menuImageInput.addEventListener("change", () => {
    const file = menuImageInput.files[0];
    selectedImageFile = null;
    imageUploadStatus.textContent = "";

    if (!file) {
        menuImagePreview.hidden = !currentImageUrl;
        if (currentImageUrl) menuImagePreview.src = currentImageUrl;
        return;
    }

    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
        imageUploadStatus.textContent = "Pilih gambar PNG, JPG, atau WebP.";
        menuImageInput.value = "";
        return;
    }
    if (file.size > 4 * 1024 * 1024) {
        imageUploadStatus.textContent = "Ukuran gambar maksimal 4 MB.";
        menuImageInput.value = "";
        return;
    }

    selectedImageFile = file;
    menuImagePreview.src = URL.createObjectURL(file);
    menuImagePreview.hidden = false;
    imageUploadStatus.textContent = file.name;
});

function readImageAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.addEventListener("load", () => resolve(reader.result));
        reader.addEventListener("error", () => reject(new Error("Gambar gagal dibaca.")));
        reader.readAsDataURL(file);
    });
}

async function uploadMenuImage(file) {
    imageUploadStatus.textContent = "Mengunggah foto...";
    const response = await fetch("/api/seller/menu-image", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ imageData: await readImageAsDataUrl(file) })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Foto gagal diunggah.");
    return result.image;
}

if (menuForm) menuForm.addEventListener("submit", async event => {
    event.preventDefault();
    formMessage.textContent = "";
    saveMenuButton.disabled = true;
    const item = {
        name: document.getElementById("menuName").value.trim(),
        description: document.getElementById("menuDescription").value.trim(),
        category: document.getElementById("menuCategory").value,
        price: Number(document.getElementById("menuPrice").value),
        image: currentImageUrl,
        calories: document.getElementById("menuCalories").value,
        protein: document.getElementById("menuProtein").value,
        carbs: document.getElementById("menuCarbs").value,
        fat: document.getElementById("menuFat").value
    };

    try {
        if (selectedImageFile) {
            item.image = await uploadMenuImage(selectedImageFile);
        }
        const url = editingMenuId ? `/api/seller/menu/${editingMenuId}` : "/api/seller/menu";
        await apiRequest(url, {
            method: editingMenuId ? "PUT" : "POST",
            body: JSON.stringify(item)
        });
        const successMessage = editingMenuId ? "Menu berhasil diperbarui." : "Menu berhasil ditambahkan.";
        resetForm();
        if (sellerMenu) await loadMenu();
        formMessage.textContent = successMessage;
    } catch (error) {
        formMessage.textContent = error.message;
    } finally {
        saveMenuButton.disabled = false;
    }
});

if (cancelEditButton) cancelEditButton.addEventListener("click", resetForm);

if (buyerTopupForm) buyerTopupForm.addEventListener("submit", async event => {
    event.preventDefault();
    const identityCode = document.getElementById("buyerIdentityCode").value.trim();
    const amount = Number(document.getElementById("buyerTopupAmount").value);
    const message = document.getElementById("buyerTopupMessage");
    const submitButton = document.getElementById("buyerTopupButton");
    if (!confirm(`Tambahkan ${formatRupiah(amount)} ke saldo pembeli dengan nomor telepon ${identityCode}?`)) return;

    message.textContent = "";
    message.classList.remove("success");
    submitButton.disabled = true;
    try {
        const result = await apiRequest("/api/seller/balance/topup", {
            method: "POST",
            body: JSON.stringify({ identityCode, amount })
        });
        buyerTopupForm.reset();
        message.textContent = `Top up berhasil untuk ${result.user.name}. Saldo baru: ${formatRupiah(result.balance)}.`;
        message.classList.add("success");
    } catch (error) {
        message.textContent = error.message;
    } finally {
        submitButton.disabled = false;
    }
});

async function loadTopupRequests() {
    if (!topupRequestsList) return;
    try {
        const result = await apiRequest("/api/seller/topup-requests");
        if (!result.requests || result.requests.length === 0) {
            topupRequestsList.innerHTML = "<p class=\"empty-message\">Belum ada permintaan top up.</p>";
            return;
        }
        topupRequestsList.innerHTML = result.requests.map(request => `
            <article class="menu-row">
                <div>
                    <h3>${escapeHTML(request.buyerName || "Pembeli")}</h3>
                    <p>${formatRupiah(request.amount)} · ${escapeHTML(request.paymentMethod)}</p>
                    <p class="menu-stock"><span class="stock-badge ${request.status === "pending" ? "ready" : request.status === "approved" ? "sold-out" : "stock-badge"}">${escapeHTML(request.status)}</span></p>
                    <p>${escapeHTML(request.buyerIdentityCode || "-")}</p>
                    <p>${escapeHTML(request.proofText || "Tidak ada catatan pembayaran.")}</p>
                    ${request.proofImage ? `<button type="button" class="proof-open-button" data-proof-url="${request.proofImage}">Lihat bukti</button>` : ""}
                </div>
                <div class="menu-row-actions" style="flex-direction:column; align-items:flex-end; gap:8px;">
                    ${request.status === "pending" ? `
                        <button type="button" data-topup-approve="${request.id}">Setujui</button>
                        <button type="button" data-topup-reject="${request.id}">Tolak</button>
                    ` : `
                        <button type="button" disabled>${request.status === "approved" ? "Disetujui" : "Ditolak"}</button>
                    `}
                </div>
            </article>
        `).join("");

        topupRequestsList.querySelectorAll("[data-proof-url]").forEach(button => {
            button.addEventListener("click", () => openProofModal(button.dataset.proofUrl));
        });

        topupRequestsList.querySelectorAll("[data-topup-approve]").forEach(button => button.addEventListener("click", async () => {
            try {
                const result = await apiRequest(`/api/seller/topup-requests/${button.dataset.topupApprove}/approve`, { method: "POST" });
                alert(result.message || "Top up disetujui.");
                await loadTopupRequests();
                await loadSellerBalance();
            } catch (error) {
                alert(error.message);
            }
        }));

        topupRequestsList.querySelectorAll("[data-topup-reject]").forEach(button => button.addEventListener("click", async () => {
            try {
                const result = await apiRequest(`/api/seller/topup-requests/${button.dataset.topupReject}/reject`, { method: "POST" });
                alert(result.message || "Top up ditolak.");
                await loadTopupRequests();
            } catch (error) {
                alert(error.message);
            }
        }));
    } catch (error) {
        topupRequestsList.innerHTML = `<p class="empty-message">${escapeHTML(error.message)}</p>`;
    }
}

if (topupRequestsList) {
    loadTopupRequests();
}

document.getElementById("logoutButton").addEventListener("click", async () => {
    try {
        await apiRequest("/api/auth/logout", { method: "POST" });
    } finally {
        localStorage.clear();
        window.location.href = "index.html";
    }
});

const pageLoads = [];
if (sellerMenu) pageLoads.push(loadMenu());
pageLoads.push(loadSellerBalance());
pageLoads.push(loadOrders());

Promise.all(pageLoads).then(() => {
    const editId = Number(new URLSearchParams(window.location.search).get("edit"));
    if (menuForm && editId) sellerMenu.querySelector(`[data-edit="${editId}"]`)?.click();
}).catch(error => {
    const message = formMessage || pageMessage;
    if (message) message.textContent = error.message;
});
