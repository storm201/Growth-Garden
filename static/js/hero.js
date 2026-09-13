/* Growth Garden — hero wind effects.
   - A short loader count-up (0 -> 100)
   - Words drift in on a breeze (staggered)
   - Leaves blow across the screen, wind streaks drift past
   Honors prefers-reduced-motion. */
(function () {
  "use strict";

  var reduced = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- Stagger the wind-word entrance ---- */
  var words = document.querySelectorAll(".wind-word");
  words.forEach(function (w, i) {
    w.style.animationDelay = (300 + i * 90) + "ms";
  });

  /* ---- Loader count-up, then reveal ---- */
  var loader = document.getElementById("hero-loader");
  if (loader && !reduced) {
    var numEl = loader.querySelector("[data-count]");
    var n = 0;
    var timer = setInterval(function () {
      n += Math.floor(Math.random() * 9) + 4;
      if (n >= 100) { n = 100; clearInterval(timer); setTimeout(hide, 350); }
      if (numEl) numEl.firstChild.nodeValue = n;
    }, 80);
    function hide() {
      loader.classList.add("done");
      countStats();
    }
  } else if (loader) {
    loader.classList.add("done");
  }

  /* ---- Stat numbers settle in after the reveal ---- */
  var statsDone = false;
  function countStats() {
    if (statsDone) return;
    statsDone = true;
    document.querySelectorAll(".hero__stat .n").forEach(function (elm) {
      var target = parseInt(elm.textContent, 10) || 0;
      if (reduced || target === 0) { elm.textContent = String(target); return; }
      if (window.GardenUI) { elm.textContent = "0"; window.GardenUI.countUp(elm); }
    });
  }

  if (reduced) return; // skip ambient motion

  /* ---- Wind layer: leaves + streaks ---- */
  var layer = document.querySelector(".wind-layer");
  if (!layer) return;

  var LEAVES = ["🍃", "🍂", "🌿"];

  function spawnLeaf() {
    var el = document.createElement("span");
    el.className = "leaf";
    el.textContent = LEAVES[Math.floor(Math.random() * LEAVES.length)];
    var top = Math.random() * 70;            // start height %
    var dur = 7 + Math.random() * 8;         // 7-15s
    var size = 0.9 + Math.random() * 1.4;    // rem
    el.style.top = top + "%";
    el.style.left = (-10 - Math.random() * 10) + "%";
    el.style.fontSize = size + "rem";
    el.style.animationDuration = dur + "s";
    el.style.animationDelay = (Math.random() * 2) + "s";
    layer.appendChild(el);
    setTimeout(function () { el.remove(); }, (dur + 2.5) * 1000);
  }

  function spawnStreak() {
    var el = document.createElement("span");
    el.className = "wind-streak";
    var top = Math.random() * 90;
    var width = 80 + Math.random() * 200;
    var dur = 3 + Math.random() * 3;
    el.style.top = top + "%";
    el.style.width = width + "px";
    el.style.animationDuration = dur + "s";
    layer.appendChild(el);
    setTimeout(function () { el.remove(); }, dur * 1000 + 200);
  }

  // Gentle, steady breeze — not overwhelming.
  for (var i = 0; i < 5; i++) setTimeout(spawnLeaf, i * 600);
  setInterval(spawnLeaf, 1700);
  setInterval(spawnStreak, 2600);

  /* ---- Pollen motes rising from the garden scene ---- */
  var pollen = document.querySelector(".pollen");
  if (pollen) {
    function spawnPollen(initial) {
      var m = document.createElement("span");
      m.className = "mote";
      var size = 2 + Math.random() * 3;
      m.style.width = m.style.height = size.toFixed(1) + "px";
      m.style.left = (Math.random() * 100).toFixed(1) + "%";
      m.style.bottom = (Math.random() * 30).toFixed(0) + "%";
      var dur = 9 + Math.random() * 10;
      m.style.setProperty("--mdur", dur.toFixed(1) + "s");
      m.style.setProperty("--mdel", (initial ? -Math.random() * dur : 0).toFixed(1) + "s");
      m.style.setProperty("--mop", (0.35 + Math.random() * 0.3).toFixed(2));
      pollen.appendChild(m);
      setTimeout(function () { m.remove(); }, (dur + 2) * 1000);
    }
    for (i = 0; i < 8; i++) spawnPollen(true);
    setInterval(spawnPollen, 1500, false);
  }

  /* ---- Mouse parallax across scene layers ---- */
  var layers = document.querySelectorAll("[data-depth]");
  if (layers.length && window.matchMedia &&
      window.matchMedia("(pointer: fine)").matches) {
    var pendingEvent = null;
    window.addEventListener("pointermove", function (e) {
      pendingEvent = e;
      if (pendingEvent._queued) return;
      pendingEvent._queued = true;
      requestAnimationFrame(function () {
        var ev = pendingEvent;
        ev._queued = false;
        var nx = ev.clientX / window.innerWidth - 0.5;
        var ny = ev.clientY / window.innerHeight - 0.5;
        layers.forEach(function (layer) {
          var d = parseFloat(layer.dataset.depth) || 0;
          layer.style.transform =
            "translate3d(" + (nx * d).toFixed(1) + "px," + (ny * d * 0.45).toFixed(1) + "px,0)";
        });
      });
    });
  }
})();
