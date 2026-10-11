/* =====================================================
   DATA KERANJANG
===================================================== */

let cart = JSON.parse(
    localStorage.getItem("ekantinCart")
) || [];

const sessionToken = localStorage.getItem("ekantinToken");
const currentUser = JSON.parse(localStorage.getItem("ekantinUser") || "null");

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
   TAMPILKAN KERANJANG
===================================================== */

function displayCart() {

    const cartItems = document.getElementById("cartItems");
    const emptyCart = document.getElementById("emptyCart");
    const cartSummary = document.getElementById("cartSummary");

    cartItems.innerHTML = "";


    /* Jika kosong */

    if (cart.length === 0) {

        emptyCart.style.display = "block";
        cartSummary.style.display = "none";

        updateSummary();

        return;
    }


    emptyCart.style.display = "none";
    cartSummary.style.display = "block";


    /* Tampilkan setiap item */

    cart.forEach((item, index) => {

        const itemElement = document.createElement("div");

        itemElement.className = "cart-item";

        itemElement.innerHTML = `

            <div class="cart-image">

                ${
                    item.image
                    ? `<img src="${item.image}" alt="${item.name}">`
                    : `<span style="
                        width:100%;
                        height:100%;
                        display:flex;
                        align-items:center;
                        justify-content:center;
                        font-size:32px;
                    ">🍽️</span>`
                }

            </div>


            <div class="cart-info">

                <h3>
                    ${item.name}
                </h3>

                <div class="cart-price">
                    ${formatRupiah(item.price)}
                </div>


                <div class="quantity-control">

                    <button
                        onclick="decreaseQuantity(${index})">
                        −
                    </button>

                    <span class="quantity">
                        ${item.quantity}
                    </span>

                    <button
                        onclick="increaseQuantity(${index})">
                        +
                    </button>

                </div>

            </div>


            <button
                class="delete-button"
                onclick="removeItem(${index})">

                🗑️

            </button>

        `;


        cartItems.appendChild(itemElement);

    });


    updateSummary();

}


/* =====================================================
   TAMBAH JUMLAH
===================================================== */

function increaseQuantity(index) {

    cart[index].quantity++;

    saveCart();

    displayCart();

}


/* =====================================================
   KURANGI JUMLAH
===================================================== */

function decreaseQuantity(index) {

    if (cart[index].quantity > 1) {

        cart[index].quantity--;

    } else {

        cart.splice(index, 1);

    }

    saveCart();

    displayCart();

}


/* =====================================================
   HAPUS ITEM
===================================================== */

function removeItem(index) {

    cart.splice(index, 1);

    saveCart();

    displayCart();

}


/* =====================================================
   SIMPAN
===================================================== */

function saveCart() {

    localStorage.setItem(
        "ekantinCart",
        JSON.stringify(cart)
    );

}


/* =====================================================
   UPDATE RINGKASAN
===================================================== */

function updateSummary() {

    let totalItems = 0;
    let subtotal = 0;


    cart.forEach(item => {

        totalItems += item.quantity;

        subtotal +=
            item.price * item.quantity;

    });


    document.getElementById(
        "totalItems"
    ).textContent = totalItems;


    document.getElementById(
        "subtotal"
    ).textContent = formatRupiah(subtotal);


    document.getElementById(
        "totalPrice"
    ).textContent = formatRupiah(subtotal);

}


/* =====================================================
   KEMBALI
===================================================== */

function goBack() {

    window.history.back();

}


/* =====================================================
   KE MENU
===================================================== */

function goToMenu() {

    window.location.href = "menu.html";

}


/* =====================================================
   CHECKOUT
===================================================== */

function checkout() {

    if (cart.length === 0) {

        alert(
            "Keranjang masih kosong."
        );

        return;
    }


    /*
       Untuk sementara kita tampilkan
       pesan terlebih dahulu.

       Nanti akan kita sambungkan
       ke halaman checkout.
    */

    window.location.href =
        "checkout.html";

}


/* =====================================================
   JALANKAN
===================================================== */

displayCart();