function getReviews() {
    try {
        return JSON.parse(localStorage.getItem("ekantinReviews")) || [];
    } catch (error) {
        return [];
    }
}

function saveReview(event) {
    event.preventDefault();

    const food = document.getElementById("foodSelect").value;
    const comment = document.getElementById("reviewText").value.trim();
    const ratingElement = document.querySelector('input[name="rating"]:checked');

    if (!food || !ratingElement || !comment) {
        alert("Lengkapi menu, rating, dan komentar terlebih dahulu.");
        return;
    }

    const reviews = getReviews();
    reviews.unshift({
        id: Date.now(),
        food,
        rating: Number(ratingElement.value),
        comment,
        date: new Date().toLocaleString("id-ID"),
        user: localStorage.getItem("userName") || "Pengguna"
    });

    localStorage.setItem("ekantinReviews", JSON.stringify(reviews));
    document.getElementById("reviewForm").reset();
    renderReviews();
    alert("Review berhasil dikirim.");
}

function renderReviews() {
    const reviewList = document.getElementById("reviewList");
    const reviews = getReviews();

    if (reviews.length === 0) {
        reviewList.innerHTML = `
            <div class="empty-reviews">
                Belum ada review. Jadilah yang pertama memberi penilaian.
            </div>
        `;
        return;
    }

    reviewList.innerHTML = reviews.map(review => `
        <article class="review-item">
            <div class="review-item-header">
                <strong>${escapeHTML(review.food)}</strong>
                <span class="review-stars" aria-label="${review.rating} dari 5 bintang">${"★".repeat(review.rating)}${"☆".repeat(5 - review.rating)}</span>
            </div>
            <div class="review-meta">
                <span>${escapeHTML(review.user)}</span>
                <span>${escapeHTML(review.date)}</span>
            </div>
            <p class="review-comment">${escapeHTML(review.comment)}</p>
        </article>
    `).join("");
}

function clearReviews() {
    if (getReviews().length === 0) {
        return;
    }

    if (confirm("Hapus semua review kamu?")) {
        localStorage.removeItem("ekantinReviews");
        renderReviews();
    }
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

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("reviewForm").addEventListener("submit", saveReview);
    renderReviews();
});
