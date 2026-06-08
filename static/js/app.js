/* Growth Garden — minimal, functional interactions only.
   No decorative motion. Everything here responds to real user intent. */
(function () {
  "use strict";

  /* ---- Lightbox: click any [data-zoom] image to view it larger ---- */
  var lightbox = document.getElementById("lightbox");
  if (lightbox) {
    var lightboxImg = lightbox.querySelector("img");
    var closeBtn = lightbox.querySelector(".lightbox__close");

    function openLightbox(src, alt) {
      lightboxImg.src = src;
      lightboxImg.alt = alt || "Photo memory";
      lightbox.classList.add("open");
      document.body.style.overflow = "hidden";
    }
    function closeLightbox() {
      lightbox.classList.remove("open");
      lightboxImg.src = "";
      document.body.style.overflow = "";
    }

    document.addEventListener("click", function (e) {
      var img = e.target.closest("[data-zoom]");
      if (img) {
        openLightbox(img.getAttribute("data-zoom"), img.alt);
      }
    });
    closeBtn.addEventListener("click", closeLightbox);
    lightbox.addEventListener("click", function (e) {
      if (e.target === lightbox) closeLightbox();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeLightbox();
    });
  }

  /* ---- Delete confirmation modal ---- */
  var modal = document.getElementById("delete-modal");
  if (modal) {
    var openers = document.querySelectorAll("[data-open-delete]");
    var cancel = modal.querySelector("[data-cancel-delete]");

    function openModal() {
      modal.classList.add("open");
      document.body.style.overflow = "hidden";
    }
    function closeModal() {
      modal.classList.remove("open");
      document.body.style.overflow = "";
    }

    openers.forEach(function (b) { b.addEventListener("click", openModal); });
    if (cancel) cancel.addEventListener("click", closeModal);
    modal.addEventListener("click", function (e) {
      if (e.target === modal) closeModal();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeModal();
    });
  }

  /* ---- Live character counter for title field ---- */
  document.querySelectorAll("[data-count-for]").forEach(function (counter) {
    var input = document.getElementById(counter.getAttribute("data-count-for"));
    if (!input) return;
    var max = input.getAttribute("maxlength") || 100;
    function update() {
      counter.textContent = input.value.length + " / " + max;
    }
    input.addEventListener("input", update);
    update();
  });

  /* ---- Submit buttons: show a clear pending state ---- */
  document.querySelectorAll("form[data-pending]").forEach(function (form) {
    form.addEventListener("submit", function () {
      var btn = form.querySelector('button[type="submit"]');
      if (btn && !btn.disabled) {
        btn.dataset.label = btn.textContent;
        btn.textContent = btn.getAttribute("data-pending") || "Working…";
        btn.disabled = true;
        // Re-enable shortly after in case of client validation blocking submit.
        setTimeout(function () {
          if (btn.disabled) {
            btn.disabled = false;
            btn.textContent = btn.dataset.label;
          }
        }, 4000);
      }
    });
  });
})();
