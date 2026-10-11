/* =====================================================
   EKANTIN - CHECKOUT
===================================================== */


/* =====================================================
   DATA KERANJANG
===================================================== */

let cart =
    JSON.parse(
        localStorage.getItem("ekantinCart")
    ) || [];

const sessionToken = localStorage.getItem("ekantinToken");
let currentUser = JSON.parse(localStorage.getItem("ekantinUser") || "null");
let deliveryLocation = currentUser?.deliveryLocation || "";
let deliveryLocationDraft = "";

document.getElementById("deliveryLocationInput")?.addEventListener("input", event => {
    deliveryLocationDraft = event.currentTarget.value;
});

if (!sessionToken || !currentUser) {
    window.location.href = "index.html";
} else if (currentUser.role !== "buyer") {
    window.location.href = "seller.html";
}



/* =====================================================
   SALDO
===================================================== */

let saldo =
    Number(
        localStorage.getItem("ekantinSaldo") || 0
    );



/* =====================================================
   FORMAT RUPIAH
===================================================== */

function formatRupiah(number) {

    return "Rp" +
        Number(number).toLocaleString(
            "id-ID"
        );

}



/* =====================================================
   HITUNG TOTAL
===================================================== */

const deliveryFeeAmount = 2000;
let selectedDeliveryMethod = "pickup";

function calculateSubtotal() {

    let total = 0;

    cart.forEach(
        item => {

            total +=
                Number(item.price) *
                Number(item.quantity);

        }
    );

    return total;

}

function calculateDeliveryFee() {
    return selectedDeliveryMethod === "delivery" ? deliveryFeeAmount : 0;
}

function calculateTotal() {
    return calculateSubtotal() + calculateDeliveryFee();
}



/* =====================================================
   TAMPILKAN SALDO
===================================================== */

function displaySaldo() {

    const saldoElement =
        document.getElementById(
            "saldoDisplay"
        );

    if (saldoElement) {

        saldoElement.textContent =
            formatRupiah(saldo);

    }

}



/* =====================================================
   TAMPILKAN PESANAN
===================================================== */

function displayOrders() {

    const orderList =
        document.getElementById(
            "orderList"
        );


    const itemCount =
        document.getElementById(
            "itemCount"
        );


    if (!orderList) {
        return;
    }


    /*
       KERANJANG KOSONG
    */

    if (cart.length === 0) {

        orderList.innerHTML = `

            <div class="empty-cart">

                <div class="icon">
                    🛒
                </div>

                <h3>
                    Keranjang masih kosong
                </h3>

                <p>
                    Silakan pilih makanan
                    terlebih dahulu.
                </p>

                <button
                    onclick="goToMenu()">

                    Pilih Makanan

                </button>

            </div>

        `;


        itemCount.textContent =
            "0 item";


        document.getElementById(
            "payButton"
        ).disabled = true;


        return;

    }



    /*
       JUMLAH ITEM
    */

    let totalQuantity = 0;


    cart.forEach(
        item => {

            totalQuantity +=
                Number(item.quantity);

        }
    );


    itemCount.textContent =
        totalQuantity + " item";



    /*
       TAMPILKAN ITEM
    */

    orderList.innerHTML = "";


    cart.forEach(
        item => {

            const itemTotal =
                Number(item.price) *
                Number(item.quantity);


            /*
               GAMBAR

               Jika ada gambar,
               tampilkan gambar.

               Jika tidak ada,
               tampilkan emoji.
            */

            let imageHTML = "";


            if (item.image) {

                imageHTML = `

                    <img
                        src="${item.image}"
                        alt="${item.name}"
                        onerror="
                            this.style.display='none';
                            this.parentElement.textContent='🍽️';
                        "
                    >

                `;

            } else {

                imageHTML = "🍽️";

            }



            orderList.innerHTML += `

                <div class="order-item">

                    <div class="order-left">

                        <div class="food-image">

                            ${imageHTML}

                        </div>


                        <div class="food-info">

                            <h3>
                                ${item.name}
                            </h3>

                            <p>
                                ${formatRupiah(item.price)}
                            </p>

                            <div class="food-quantity">
                                                <button type="button" class="quantity-button" data-quantity-change="-1" data-menu-id="${Number(item.menuId)}" aria-label="Kurangi ${item.name}">−</button>
                                                <span>${item.quantity}</span>
                                                <button type="button" class="quantity-button" data-quantity-change="1" data-menu-id="${Number(item.menuId)}" aria-label="Tambah ${item.name}">+</button>
                                            </div>

                        </div>

                    </div>


                    <div class="order-price">

                        ${formatRupiah(itemTotal)}

                    </div>

                </div>

            `;

        }
    );

    document.getElementById("payButton").disabled = false;
    orderList.querySelectorAll("[data-quantity-change]").forEach(button => {
        button.addEventListener("click", () => {
            changeOrderQuantity(Number(button.dataset.menuId), Number(button.dataset.quantityChange));
        });
    });

}

function changeOrderQuantity(menuId, change) {
    const item = cart.find(cartItem => Number(cartItem.menuId) === menuId);
    if (!item) return;

    item.quantity = Number(item.quantity) + change;
    if (item.quantity <= 0) cart = cart.filter(cartItem => Number(cartItem.menuId) !== menuId);
    localStorage.setItem("ekantinCart", JSON.stringify(cart));
    displayOrders();
    displayTotal();
    loadQrisPaymentOptions();
}

async function loadRelatedMenus() {
    const menuList = document.getElementById("relatedMenuList");
    if (!menuList) return;

    try {
        const response = await fetch("/api/menu/popular");
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Menu gagal dimuat.");
        const items = result.items.filter(item => item.available !== 0 && item.available !== false).slice(0, 8);
        menuList.replaceChildren();

        if (items.length === 0) {
            menuList.innerHTML = '<p class="related-menu-empty">Belum ada menu tersedia.</p>';
            return;
        }

        items.forEach(item => {
            const card = document.createElement("article");
            card.className = "related-menu-card";
            const image = document.createElement("div");
            image.className = "related-menu-image";
            if (item.image) {
                const imageElement = document.createElement("img");
                imageElement.src = item.image;
                imageElement.alt = item.name;
                imageElement.onerror = () => { image.textContent = "🍽️"; };
                image.append(imageElement);
            } else {
                image.textContent = "🍽️";
            }

            const details = document.createElement("div");
            details.className = "related-menu-details";
            const name = document.createElement("strong");
            name.textContent = item.name;
            const price = document.createElement("span");
            price.textContent = formatRupiah(item.price);
            details.append(name, price);

            const addButton = document.createElement("button");
            addButton.type = "button";
            addButton.className = "related-menu-add";
            addButton.textContent = "+";
            addButton.setAttribute("aria-label", `Tambah ${item.name} ke pesanan`);
            addButton.addEventListener("click", () => addRelatedMenu(item));
            card.append(image, details, addButton);
            menuList.append(card);
        });
    } catch {
        menuList.innerHTML = '<p class="related-menu-empty">Menu terkait belum tersedia.</p>';
    }
}

function addRelatedMenu(menu) {
    const existingItem = cart.find(item => Number(item.menuId) === Number(menu.id));
    if (existingItem) {
        existingItem.quantity = Number(existingItem.quantity) + 1;
    } else {
        cart.push({ menuId: menu.id, name: menu.name, price: menu.price, quantity: 1, image: menu.image || "" });
    }
    localStorage.setItem("ekantinCart", JSON.stringify(cart));
    displayOrders();
    displayTotal();
    loadQrisPaymentOptions();
}



/* =====================================================
   TAMPILKAN TOTAL
===================================================== */

function displayTotal() {

    const subtotal = calculateSubtotal();
    const deliveryFee = calculateDeliveryFee();
    const total = subtotal + deliveryFee;


    document.getElementById(
        "subtotal"
    ).textContent =
        formatRupiah(subtotal);

    document.getElementById(
        "deliveryFee"
    ).textContent = formatRupiah(deliveryFee);


    document.getElementById(
        "grandTotal"
    ).textContent =
        formatRupiah(total);

    document.getElementById("stickyGrandTotal").textContent = formatRupiah(total);

}



/* =====================================================
   PILIH METODE PEMBAYARAN
===================================================== */

let selectedPayment =
    "saldo";


let qrisSellerOptions = [];
let qrisOptionsReady = false;
let qrisOptionsError = "";

function renderQrisPaymentCard() {
    const card = document.getElementById("qrisPaymentCard");
    const sellerList = document.getElementById("qrisSellerList");
    const totalText = document.getElementById("qrisTotal");
    if (!card || !sellerList || !totalText) return;

    totalText.textContent = formatRupiah(calculateTotal());
    card.hidden = selectedPayment !== "qris";
    sellerList.replaceChildren();

    if (!qrisOptionsReady) {
        sellerList.textContent = "Memuat QRIS kantin...";
        return;
    }
    if (qrisOptionsError) {
        sellerList.textContent = "QRIS kantin gagal dimuat. Periksa koneksi lalu coba lagi.";
        return;
    }
    if (qrisSellerOptions.length === 0) {
        sellerList.textContent = "Tidak ada kantin pada pesanan ini.";
        return;
    }

    qrisSellerOptions.forEach(seller => {
        const sellerCard = document.createElement("article");
        sellerCard.className = "qris-seller-option";
        const heading = document.createElement("div");
        heading.className = "qris-seller-heading";
        const name = document.createElement("strong");
        name.textContent = seller.canteenName;
        const amount = document.createElement("strong");
        amount.textContent = formatRupiah(seller.amount);
        heading.append(name, amount);
        sellerCard.append(heading);

        if (seller.qrisImage) {
            const image = document.createElement("img");
            image.className = "qris-seller-image";
            image.src = seller.qrisImage;
            image.alt = `QRIS ${seller.canteenName}`;
            sellerCard.append(image);
        } else {
            const missing = document.createElement("p");
            missing.className = "qris-missing-message";
            missing.textContent = "Kantin ini belum mengunggah QRIS. Pilih pembayaran lain atau hubungi penjual.";
            sellerCard.append(missing);
        }

        sellerList.append(sellerCard);
    });
}

async function loadQrisPaymentOptions() {
    qrisOptionsReady = false;
    qrisOptionsError = "";
    qrisSellerOptions = [];
    renderQrisPaymentCard();

    try {
        const response = await fetch("/api/menu");
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "QRIS gagal dimuat.");
        const menuById = new Map(result.items.map(item => [Number(item.id), item]));
        const sellers = new Map();

        for (const cartItem of cart) {
            const menu = menuById.get(Number(cartItem.menuId));
            if (!menu || !Number.isSafeInteger(Number(menu.sellerId))) continue;
            const sellerId = Number(menu.sellerId);
            if (!sellers.has(sellerId)) {
                sellers.set(sellerId, {
                    sellerId,
                    canteenName: menu.canteenName || "Kantin",
                    qrisImage: menu.qrisImage || null,
                    subtotal: 0
                });
            }
            sellers.get(sellerId).subtotal += Number(menu.price) * Number(cartItem.quantity);
        }

        const orderedSellers = [...sellers.values()].sort((left, right) => left.sellerId - right.sellerId);
        const subtotal = orderedSellers.reduce((sum, seller) => sum + seller.subtotal, 0);
        let allocatedDeliveryFee = 0;
        orderedSellers.forEach((seller, index) => {
            const deliveryShare = selectedDeliveryMethod !== "delivery" || subtotal === 0
                ? 0
                : index === orderedSellers.length - 1
                    ? deliveryFeeAmount - allocatedDeliveryFee
                    : Math.floor(deliveryFeeAmount * seller.subtotal / subtotal);
            allocatedDeliveryFee += deliveryShare;
            seller.amount = seller.subtotal + deliveryShare;
        });
        qrisSellerOptions = orderedSellers;
    } catch (error) {
        qrisOptionsError = error.message || "QRIS gagal dimuat.";
    } finally {
        qrisOptionsReady = true;
        renderQrisPaymentCard();
    }
}


function selectPayment(method) {

    selectedPayment =
        method;


    const options =
        document.querySelectorAll(
            ".payment-option"
        );


    options.forEach(
        option => {

            option.classList.remove(
                "selected"
            );

        }
    );


    const selectedRadio =
        document.querySelector(
            `input[value="${method}"]`
        );


    if (selectedRadio) {

        selectedRadio.checked =
            true;


        selectedRadio
            .closest(".payment-option")
            .classList.add(
                "selected"
            );

    }

    renderQrisPaymentCard();

}

function selectDelivery(method) {
    selectedDeliveryMethod = method;
    document.getElementById("deliveryMethodSelect").value = method;
    renderDeliveryLocation();
    displayTotal();
    loadQrisPaymentOptions();
}

function renderDeliveryLocation() {
    const card = document.getElementById("deliveryLocationCard");
    if (!card) return;
    card.hidden = selectedDeliveryMethod !== "delivery";
    const hasProfileLocation = Boolean(deliveryLocation.trim());
    const display = document.getElementById("deliveryLocationDisplay");
    const field = document.getElementById("deliveryLocationField");
    const input = document.getElementById("deliveryLocationInput");
    const link = document.getElementById("deliveryLocationLink");
    display.textContent = hasProfileLocation ? deliveryLocation : "Tambahkan alamat tujuan agar pesanan dapat diantarkan.";
    field.hidden = hasProfileLocation;
    input.value = deliveryLocationDraft;
    link.hidden = !hasProfileLocation;
    link.textContent = "Ubah profil";
}

async function loadBuyerDeliveryLocation() {
    renderDeliveryLocation();
    try {
        const response = await fetch("/api/auth/me", {
            headers: { Authorization: `Bearer ${sessionToken}` }
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Profil gagal dimuat.");
        currentUser = result.user;
        deliveryLocation = currentUser.deliveryLocation || "";
        localStorage.setItem("ekantinUser", JSON.stringify(currentUser));
    } catch {
        deliveryLocation = currentUser?.deliveryLocation || "";
    }
    renderDeliveryLocation();
}



/* =====================================================
   PROSES PEMBAYARAN
===================================================== */

async function processPayment() {
    if (cart.length === 0) {
        alert("Keranjang masih kosong.");
        return;
    }

    if (cart.some(item => !Number.isSafeInteger(Number(item.menuId)))) {
        alert("Menu keranjang sudah tidak berlaku. Pilih ulang menu dari halaman menu.");
        return;
    }

    if (!["saldo", "qris"].includes(selectedPayment)) {
        alert("Metode pembayaran ini belum tersedia. Silakan pilih Saldo eKantin atau QRIS Kantin.");
        return;
    }

    const checkoutDeliveryLocation = selectedDeliveryMethod === "delivery"
        ? deliveryLocationDraft.trim() || deliveryLocation.trim()
        : "";
    if (selectedDeliveryMethod === "delivery" && !checkoutDeliveryLocation) {
        alert("Isi lokasi antar di sekolah terlebih dahulu.");
        document.getElementById("deliveryLocationInput").focus();
        return;
    }


    if (selectedPayment === "qris") {
        if (!qrisOptionsReady) await loadQrisPaymentOptions();
        const missingQris = qrisSellerOptions.filter(seller => !seller.qrisImage);
        if (qrisOptionsError || qrisSellerOptions.length === 0 || missingQris.length > 0) {
            const missingNames = missingQris.map(seller => seller.canteenName).join(", ");
            alert(missingNames
                ? `QRIS belum tersedia untuk: ${missingNames}. Pilih saldo atau hubungi penjual.`
                : "QRIS kantin belum tersedia. Periksa koneksi atau pilih metode pembayaran lain.");
            return;
        }
        const qrisConfirm = confirm(
            "Konfirmasi Pembayaran QRIS\n\n" +
            "Transfer ke setiap QRIS kantin sesuai nominal yang tertera.\n" +
            "Total: " + formatRupiah(total) + "\n\n" +
            "Sudah menyelesaikan transfer? Penjual akan memeriksa pembayaran secara manual."
        );
        if (!qrisConfirm) return;
    }

    if (!confirm(
        "Konfirmasi Pembayaran\n\n" +
        "Metode pesanan: " + (selectedDeliveryMethod === "delivery" ? "Diantarkan" : "Ambil di kantin sendiri") +
        "\nOngkos antar: " + formatRupiah(deliveryFee) +
        "\nTotal: " + formatRupiah(total) +
        "\nSaldo saat ini: " + formatRupiah(saldo) +
        "\n\nLanjutkan pembayaran?"
    )) return;

    const payButton = document.getElementById("payButton");
    payButton.disabled = true;

    try {
        const response = await fetch("/api/orders", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${sessionToken}`
            },
            body: JSON.stringify({
                items: cart.map(item => ({ menuId: Number(item.menuId), quantity: Number(item.quantity) })),
                deliveryMethod: selectedDeliveryMethod,
                paymentMethod: selectedPayment,
                deliveryLocation: checkoutDeliveryLocation
            })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Pembayaran gagal.");

        saldo = result.balance;
        if (result.order.deliveryLocation) {
            deliveryLocation = result.order.deliveryLocation;
            deliveryLocationDraft = "";
            currentUser.deliveryLocation = deliveryLocation;
            localStorage.setItem("ekantinUser", JSON.stringify(currentUser));
        }
        localStorage.setItem("ekantinSaldo", String(saldo));
        localStorage.removeItem("ekantinCart");
        showPaymentSuccess(result.order.total, saldo, result.order.deliveryMethod, result.order.deliveryFee, result.order.paymentMethod);
    } catch (error) {
        alert(error.message || "Server tidak terhubung. Jalankan npm start terlebih dahulu.");
        payButton.disabled = false;
    }
}



/* =====================================================
   SIMPAN TRANSAKSI SALDO
===================================================== */

function saveTransaction(
    total
) {

    let transactions =
        JSON.parse(
            localStorage.getItem(
                "ekantinTransactions"
            )
        ) || [];


    const transaction = {

        id:
            Date.now(),

        type:
            "payment",

        title:
            "Pembayaran Pesanan",

        amount:
            total,

        date:
            new Date().toLocaleString(
                "id-ID"
            ),

        balance:
            saldo

    };


    transactions.unshift(
        transaction
    );


    localStorage.setItem(

        "ekantinTransactions",

        JSON.stringify(
            transactions
        )

    );

}



/* =====================================================
   SIMPAN RIWAYAT PESANAN
===================================================== */

function saveOrderHistory(
    items,
    total
) {

    let history =
        JSON.parse(
            localStorage.getItem(
                "ekantinOrderHistory"
            )
        ) || [];


    const order = {

        id:
            Date.now(),

        items:
            items,

        total:
            total,

        date:
            new Date().toLocaleString(
                "id-ID"
            ),

        status:
            "Berhasil",

        paymentMethod:
            "Saldo eKantin"

    };


    history.unshift(
        order
    );


    localStorage.setItem(

        "ekantinOrderHistory",

        JSON.stringify(
            history
        )

    );

}



/* =====================================================
   PEMBAYARAN BERHASIL
===================================================== */

function showPaymentSuccess(
    total,
    newBalance,
    deliveryMethod,
    deliveryFee,
    paymentMethod = "Saldo eKantin"
) {

    document.querySelector(".checkout-sticky")?.remove();
    document.body.classList.add("payment-complete");

    const container =
        document.querySelector(
            ".checkout-container"
        );


    container.innerHTML = `

        <div class="success-card">

            <div class="success-icon">
                ✓
            </div>


            <h1>
                Pembayaran Berhasil!
            </h1>


            <p>
                Pesanan kamu berhasil
                dibayar menggunakan
                ${paymentMethod}.
            </p>


            <div class="success-detail">

                <div>

                    <span>
                        Total Pembayaran
                    </span>

                    <strong>
                        ${formatRupiah(total)}
                    </strong>

                </div>


                <div>
                    <span>Metode pembayaran</span>
                    <strong>${paymentMethod}</strong>
                </div>

                <div>
                    <span>Metode pesanan</span>
                    <strong>${deliveryMethod === "delivery" ? "Diantarkan" : "Ambil di kantin sendiri"}</strong>
                </div>


                <div>
                    <span>Ongkos antar</span>
                    <strong>${formatRupiah(deliveryFee)}</strong>
                </div>


                <div>

                    <span>
                        ${paymentMethod === "QRIS" ? "Saldo tersisa" : "Sisa Saldo"}
                    </span>

                    <strong>
                        ${formatRupiah(newBalance)}
                    </strong>

                </div>

            </div>


            <button
                class="pay-button"
                onclick="goToMenu()">

                Kembali ke Menu

            </button>


            <button
                class="secondary-button"
                onclick="goToTopUp()">

                💳 Top Up Saldo

            </button>

        </div>

    `;


    /*
       TAMBAHKAN CSS SUCCESS
    */

    addSuccessStyle();

}



/* =====================================================
   STYLE SUCCESS
===================================================== */

function addSuccessStyle() {

    const style =
        document.createElement(
            "style"
        );


    style.innerHTML = `

        .success-card {

            background: white;

            border-radius: 22px;

            padding: 40px 25px;

            text-align: center;

            box-shadow:
                0 5px 20px rgba(0,0,0,.05);

        }


        .success-icon {

            width: 75px;

            height: 75px;

            border-radius: 50%;

            background: #e8f5e9;

            color: #2e7d32;

            font-size: 45px;

            font-weight: 700;

            display: flex;

            align-items: center;

            justify-content: center;

            margin: 0 auto 20px;

        }


        .success-card h1 {

            color: #2e7d32;

            font-size: 25px;

            margin-bottom: 10px;

        }


        .success-card > p {

            color: #777;

            font-size: 13px;

            line-height: 1.7;

            margin-bottom: 25px;

        }


        .success-detail {

            background: #f5f8f5;

            border-radius: 16px;

            padding: 18px;

            margin-bottom: 20px;

        }


        .success-detail div {

            display: flex;

            justify-content: space-between;

            align-items: center;

            padding: 8px 0;

        }


        .success-detail span {

            color: #777;

            font-size: 13px;

        }


        .success-detail strong {

            color: #2e7d32;

            font-size: 16px;

        }


        .secondary-button {

            width: 100%;

            margin-top: 10px;

            padding: 15px;

            border-radius: 15px;

            border: 2px solid #2e7d32;

            background: white;

            color: #2e7d32;

            font-family: inherit;

            font-weight: 700;

            font-size: 15px;

            cursor: pointer;

        }

    `;


    document.head.appendChild(
        style
    );

}



/* =====================================================
   NAVIGASI
===================================================== */

function goBack() {

    window.location.href =
        "cart.html";

}


function goToMenu() {

    window.location.href =
        "menu.html";

}

let paymentStep = false;

function continueCheckout() {
    const payButton = document.getElementById("payButton");
    if (!paymentStep) {
        paymentStep = true;
        payButton.textContent = "Bayar Sekarang";
        document.getElementById("paymentSection").scrollIntoView({ behavior: "smooth", block: "start" });
        return;
    }
    processPayment();
}


function goToTopUp() {

    window.location.href =
        "topup.html";

}



/* =====================================================
   JALANKAN SAAT HALAMAN DIBUKA
===================================================== */

async function loadBalance() {
    try {
        const response = await fetch("/api/balance", {
            headers: { Authorization: `Bearer ${sessionToken}` }
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Saldo gagal dimuat.");
        saldo = result.balance;
        localStorage.setItem("ekantinSaldo", String(saldo));
        displaySaldo();
    } catch (error) {
        alert(error.message || "Server tidak terhubung. Jalankan npm start terlebih dahulu.");
        window.location.href = "index.html";
    }
}

loadBalance();

displayOrders();
loadRelatedMenus();
loadQrisPaymentOptions();

displayTotal();

loadBuyerDeliveryLocation();