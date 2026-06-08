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
    function hide() { loader.classList.add("done"); }
  } else if (loader) {
    loader.classList.add("done");
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
})();
