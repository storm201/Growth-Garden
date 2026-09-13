/* =========================================================================
   Growth Garden — Living Digital Greenhouse Interactivity Layer
   - Realistic Plant Growth Centerpiece & Stage Cross-Fading
   - "Watch It Grow" Interactive Time-Lapse Stepper
   - Watering Droplet FX & Organic Micro-Interactions
   - Botanical Scrapbook & Timeline Lightbox
   - Respects prefers-reduced-motion
   ========================================================================= */

(function () {
  "use strict";

  var reduced = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* =========================================================================
     1. LIVING PLANT STAGE ENGINE & "WATCH IT GROW" REPLAY
     ========================================================================= */
  var STAGES = [
    {
      slug: "seedling",
      emoji: "🌱",
      title: "Seedling",
      attr: "data-seedling-src",
      updates: 0,
      progress: "0%"
    },
    {
      slug: "sprout",
      emoji: "🌿",
      title: "Sprout",
      attr: "data-sprout-src",
      updates: 1,
      progress: "25%"
    },
    {
      slug: "young",
      emoji: "🌳",
      title: "Young Tree",
      attr: "data-young-src",
      updates: 4,
      progress: "60%"
    },
    {
      slug: "mature",
      emoji: "🌲",
      title: "Mature Tree",
      attr: "data-mature-src",
      updates: 8,
      progress: "100%"
    }
  ];

  var mainImg = document.getElementById("living-plant-image");
  var fadeImg = document.getElementById("living-plant-fade-image");
  var stageIcon = document.getElementById("stage-badge-icon");
  var stageTitle = document.getElementById("stage-badge-title");
  var stageProgress = document.getElementById("stage-badge-progress");
  var replayBtn = document.getElementById("replay-growth-btn");
  var timelapseHud = document.getElementById("timelapse-hud");
  var timelapseStatus = document.getElementById("timelapse-status");
  var ringNodes = Array.prototype.slice.call(document.querySelectorAll(".ring-node"));

  if (mainImg && replayBtn) {
    var currentStageSlug = mainImg.dataset.currentStage || "seedling";
    var currentUpdates = parseInt(mainImg.dataset.updates, 10) || 0;
    var originalSrc = mainImg.src;
    var originalIcon = stageIcon ? stageIcon.textContent : "🌱";
    var originalTitle = stageTitle ? stageTitle.textContent : "Seedling";
    var originalProgress = stageProgress ? stageProgress.textContent : "0%";

    // Helper: Find maximum stage index reachable by this plant
    var maxStageIndex = 0;
    for (var i = 0; i < STAGES.length; i++) {
      if (currentUpdates >= STAGES[i].updates) {
        maxStageIndex = i;
      }
    }
    // Always allow seeing at least Sprout if clicked
    var targetMaxIndex = Math.max(maxStageIndex, 1);

    function setStageVisual(stage, isFade) {
      var src = mainImg.getAttribute(stage.attr);
      if (!src) return;

      if (isFade && fadeImg && !reduced) {
        fadeImg.src = src;
        fadeImg.style.opacity = "1";
        setTimeout(function () {
          mainImg.src = src;
          fadeImg.style.opacity = "0";
        }, 400);
      } else {
        mainImg.src = src;
      }

      if (stageIcon) stageIcon.textContent = stage.emoji;
      if (stageTitle) stageTitle.textContent = stage.title;
      if (stageProgress) stageProgress.textContent = stage.progress;

      // Update ring nodes highlighting
      if (ringNodes.length) {
        ringNodes.forEach(function (node, idx) {
          if (idx < stage.updates) {
            node.classList.add("ring-node--active");
            node.classList.remove("ring-node--next");
          } else if (idx === stage.updates) {
            node.classList.remove("ring-node--active");
            node.classList.add("ring-node--next");
          } else {
            node.classList.remove("ring-node--active");
            node.classList.remove("ring-node--next");
          }
        });
      }
    }

    replayBtn.addEventListener("click", function () {
      if (replayBtn.disabled) return;
      replayBtn.disabled = true;

      if (timelapseHud) timelapseHud.classList.add("active");

      var stepIndex = 0;
      var stagesToPlay = STAGES.slice(0, targetMaxIndex + 1);

      function playStep() {
        if (stepIndex < stagesToPlay.length) {
          var st = stagesToPlay[stepIndex];
          if (timelapseStatus) {
            timelapseStatus.textContent = "Stage " + (stepIndex + 1) + ": " + st.title + " " + st.emoji;
          }
          setStageVisual(st, stepIndex > 0);
          stepIndex++;
          setTimeout(playStep, reduced ? 800 : 1600);
        } else {
          // Finished replay: gracefully settle back to actual state
          setTimeout(function () {
            if (timelapseStatus) timelapseStatus.textContent = "Current Growth State Restored ✨";
            setTimeout(function () {
              mainImg.src = originalSrc;
              if (stageIcon) stageIcon.textContent = originalIcon;
              if (stageTitle) stageTitle.textContent = originalTitle;
              if (stageProgress) stageProgress.textContent = originalProgress;

              // Restore original ring nodes
              if (ringNodes.length) {
                ringNodes.forEach(function (node, idx) {
                  if (idx < currentUpdates) {
                    node.classList.add("ring-node--active");
                    node.classList.remove("ring-node--next");
                  } else if (idx === currentUpdates) {
                    node.classList.remove("ring-node--active");
                    node.classList.add("ring-node--next");
                  } else {
                    node.classList.remove("ring-node--active");
                    node.classList.remove("ring-node--next");
                  }
                });
              }

              if (timelapseHud) timelapseHud.classList.remove("active");
              replayBtn.disabled = false;
            }, 900);
          }, 1200);
        }
      }

      playStep();
    });
  }

  /* =========================================================================
     2. WATERING DROPLET FX & PARTICLES
     ========================================================================= */
  function triggerWateringShower() {
    var fxContainer = document.getElementById("watering-fx");
    if (!fxContainer || reduced) return;

    fxContainer.innerHTML = "";
    for (var i = 0; i < 18; i++) {
      var drop = document.createElement("div");
      drop.className = "water-spray-drop";
      drop.style.left = (15 + Math.random() * 70).toFixed(1) + "%";
      drop.style.animationDelay = (Math.random() * 0.45).toFixed(2) + "s";
      drop.style.height = (12 + Math.random() * 10).toFixed(0) + "px";
      fxContainer.appendChild(drop);
    }

    if (mainImg) {
      mainImg.style.transform = "scale(1.025)";
      setTimeout(function () {
        mainImg.style.transform = "";
      }, 900);
    }

    setTimeout(function () {
      fxContainer.innerHTML = "";
    }, 2000);
  }

  // Trigger watering FX if user just returned from adding an update (flash message)
  var flashMsgs = document.querySelectorAll(".flash");
  if (flashMsgs.length) {
    flashMsgs.forEach(function (msg) {
      if (msg.textContent.indexOf("Watered") !== -1 || msg.textContent.indexOf("Update added") !== -1) {
        setTimeout(triggerWateringShower, 350);
      }
    });
  }

  /* =========================================================================
     3. AMBIENT DUST & POLLEN MOTES
     ========================================================================= */
  function spawnMote(layer, initial, maxOpacity) {
    if (!layer || reduced) return;
    var m = document.createElement("span");
    m.className = "mote";
    var size = 2.5 + Math.random() * 3.5;
    m.style.width = m.style.height = size.toFixed(1) + "px";
    m.style.left = (Math.random() * 100).toFixed(1) + "%";
    var dur = 12 + Math.random() * 14;
    m.style.setProperty("--mdur", dur.toFixed(1) + "s");
    m.style.setProperty("--mdel", (initial ? -Math.random() * dur : 0).toFixed(1) + "s");
    m.style.setProperty("--mop", (maxOpacity * (0.6 + Math.random() * 0.4)).toFixed(2));
    layer.appendChild(m);
    setTimeout(function () { m.remove(); }, (dur + 2) * 1000);
  }

  var spores = document.getElementById("spores");
  if (spores && !reduced) {
    for (var j = 0; j < 14; j++) spawnMote(spores, true, 0.35);
    setInterval(function () { spawnMote(spores, false, 0.35); }, 2400);
  }

  var sceneMotes = document.getElementById("scene-dust-motes");
  if (sceneMotes && !reduced) {
    for (var k = 0; k < 8; k++) spawnMote(sceneMotes, true, 0.5);
    setInterval(function () { spawnMote(sceneMotes, false, 0.5); }, 2800);
  }

  /* =========================================================================
     4. LIGHTBOX FOR FIELD SCRAPBOOK & TIMELINE MEMORIES
     ========================================================================= */
  var lightbox = document.getElementById("lightbox");
  if (lightbox) {
    var lightboxImg = lightbox.querySelector("img");
    var closeBtn = lightbox.querySelector(".lightbox__close");

    function openLightbox(src, alt) {
      if (!lightboxImg) return;
      lightboxImg.src = src;
      lightboxImg.alt = alt || "Photo memory";
      lightbox.classList.add("open");
      document.body.style.overflow = "hidden";
    }

    function closeLightbox() {
      lightbox.classList.remove("open");
      if (lightboxImg) lightboxImg.src = "";
      document.body.style.overflow = "";
    }

    document.addEventListener("click", function (e) {
      var target = e.target.closest("[data-zoom]");
      if (target) {
        openLightbox(target.getAttribute("data-zoom"), target.alt);
      }
    });

    if (closeBtn) closeBtn.addEventListener("click", closeLightbox);
    lightbox.addEventListener("click", function (e) {
      if (e.target === lightbox) closeLightbox();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeLightbox();
    });
  }

  /* =========================================================================
     5. DELETE MODAL HANDLER
     ========================================================================= */
  var deleteModal = document.getElementById("delete-modal");
  if (deleteModal) {
    var openers = document.querySelectorAll("[data-open-delete]");
    var cancelBtn = deleteModal.querySelector("[data-cancel-delete]");

    function openModal() {
      deleteModal.classList.add("open");
      document.body.style.overflow = "hidden";
    }
    function closeModal() {
      deleteModal.classList.remove("open");
      document.body.style.overflow = "";
    }

    openers.forEach(function (btn) {
      btn.addEventListener("click", openModal);
    });
    if (cancelBtn) cancelBtn.addEventListener("click", closeModal);
    deleteModal.addEventListener("click", function (e) {
      if (e.target === deleteModal) closeModal();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeModal();
    });
  }

  /* =========================================================================
     6. PRESERVE LEGACY LIVING PLOTS (DASHBOARD & CREATE PREVIEW)
     ========================================================================= */
  if (window.GardenPlants) {
    var plots = Array.prototype.slice.call(document.querySelectorAll("[data-plot]"));
    plots.forEach(function (elp) {
      GardenPlants.draw(
        elp,
        parseInt(elp.dataset.seed, 10) || 1,
        parseInt(elp.dataset.updates, 10) || 0
      );
    });
  }

  // Stat count-up on dashboard
  function countUp(elm) {
    var target = parseFloat(elm.getAttribute("data-countup")) || 0;
    var t0 = null;
    var dur = 850;
    function step(ts) {
      if (t0 === null) t0 = ts;
      var k = Math.min(1, (ts - t0) / dur);
      k = 1 - Math.pow(1 - k, 3);
      elm.textContent = String(Math.round(target * k));
      if (k < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  var nums = document.querySelectorAll("[data-countup]");
  if (nums.length && !reduced && "IntersectionObserver" in window) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        countUp(en.target);
        cio.unobserve(en.target);
      });
    }, { threshold: 0.5 });
    nums.forEach(function (n) { cio.observe(n); });
  }

})();
