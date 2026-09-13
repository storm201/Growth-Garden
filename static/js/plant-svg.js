/* Growth Garden — procedural living plants (botanical renderer).
   Plants are drawn like field-journal illustrations rather than cartoons:
   - tapered trunks with root flare and bark shading (filled shapes)
   - veined leaves with gradient shading
   - canopies built from layered leaf crowns instead of blobs
   Growth is continuous with update count, deterministic per plant id,
   stems draw on, trunks rise, leaves unfurl, crowns fill in — and layered
   wind sway keeps everything alive.

   Public API:
     GardenPlants.draw(container, seed, updates)            -> static plant
     GardenPlants.play(container, seed, updates, delayMs)   -> animated growth
     GardenPlants.replay(container, seed, updates)          -> replay growth
*/
(function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var REDUCED = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- utils ---------- */
  function mulberry32(seed) {
    var a = (seed >>> 0) || 1;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clampW(x) { return Math.max(16, Math.min(204, x)); }

  function el(name, attrs, parent) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function grp(attrs, parent) { return el("g", attrs || {}, parent); }

  /* ---------- palette: botanical inks, slight per-plant variation ---------- */
  function palette(rng) {
    var h = 92 + rng() * 36;
    var woodH = 26 + rng() * 12;
    var bloomH = (h + 120 + rng() * 80) % 360;
    return {
      leafLo: "hsl(" + h + ",38%,29%)",
      leafMd: "hsl(" + (h + 4) + ",42%,39%)",
      leafHi: "hsl(" + (h + 12) + ",46%,51%)",
      edge: "hsl(" + (h + 2) + ",40%,23%)",
      trunkD: "hsl(" + woodH + ",30%,21%)",
      trunkM: "hsl(" + woodH + ",32%,32%)",
      trunkL: "hsl(" + woodH + ",30%,41%)",
      bloom: "hsl(" + bloomH + ",62%,74%)",
      grass: "hsl(" + (h + 6) + ",32%,47%)",
      stone: "hsl(" + (woodH + 6) + ",10%,58%)",
      soil: "#7a5f43",
      soilLo: "#5f4a33"
    };
  }

  /* canvas geometry */
  var W = 220, H = 250, GROUND = 216, CX = 110;

  /* ---------- shapes ---------- */
  /* pointed-oval leaf lying along +x, base at origin */
  function leafD(L, wd) {
    return "M0 0" +
      " C" + (L * .28).toFixed(1) + " " + (-wd).toFixed(1) +
      " " + (L * .72).toFixed(1) + " " + (-wd * 1.05).toFixed(1) +
      " " + L.toFixed(1) + " 0" +
      " C" + (L * .72).toFixed(1) + " " + (wd * .45).toFixed(1) +
      " " + (L * .28).toFixed(1) + " " + (wd * .4).toFixed(1) +
      " 0 0 Z";
  }

  /* Build one finished leaf (shape + vein [+ veinlets]) inside `parent`.
     Returns the group so callers can wrap/animate it. */
  function makeLeaf(parent, opts) {
    var g = grp(null, parent);
    el("path", {
      d: leafD(opts.len, opts.wid),
      fill: opts.fill || opts.pal.leafMd,
      stroke: opts.edge === false ? "none" : opts.pal.edge,
      "stroke-width": .55,
      "stroke-opacity": .6
    }, g);
    el("path", {
      d: "M" + (opts.len * .06).toFixed(1) + " 0" +
         " Q" + (opts.len * .5).toFixed(1) + " " + (-opts.wid * .2).toFixed(1) +
         " " + (opts.len * .86).toFixed(1) + " " + (-opts.wid * .06).toFixed(1),
      stroke: opts.pal.edge, "stroke-width": .6, fill: "none", "stroke-opacity": .5
    }, g);
    if (opts.veinlets) {
      for (var v = 1; v <= 2; v++) {
        var vx = opts.len * (.3 + v * .18);
        el("path", {
          d: "M" + vx.toFixed(1) + " " + (-opts.wid * (.12 + v * .04)).toFixed(1) +
             " l" + (opts.len * .1).toFixed(1) + " " + (-opts.wid * .3).toFixed(1),
          stroke: opts.pal.edge, "stroke-width": .45, fill: "none", "stroke-opacity": .4
        }, g);
      }
    }
    return g;
  }

  /* mark a path to be drawn-on via stroke-dash transition at play time */
  function arm(path, delaySec, durSec) {
    path.classList.add("draw");
    path.dataset.delay = delaySec;
    path.dataset.dur = durSec;
  }

  /* =====================================================================
     build — returns a complete <svg> plant
     ===================================================================== */
  function build(seed, updates, animate) {
    var rng = mulberry32((seed >>> 0) * 7919 + 13);
    var pal = palette(rng);
    var uid = "g" + ((seed >>> 0) % 9973) + "x";

    var u = Math.max(0, updates | 0);
    var t = Math.min(1, u / 8);           /* continuous maturity 0..1 */
    var tree = u >= 4;

    var svg = el("svg", {
      viewBox: "0 0 " + W + " " + H,
      "class": "plot-svg" + (animate ? " anim" : ""),
      "aria-hidden": "true",
      focusable: "false"
    }, null);

    /* ---- gradients (unique per plant so multiple svgs never collide) ---- */
    var defs = el("defs", null, svg);
    var lg = el("linearGradient", { id: "lg" + uid, x1: 0, y1: 0, x2: 1, y2: 0 }, defs);
    el("stop", { offset: "0%", "stop-color": pal.leafMd }, lg);
    el("stop", { offset: "100%", "stop-color": pal.leafHi }, lg);
    var tg = el("linearGradient", { id: "tg" + uid, x1: 0, y1: 1, x2: 0, y2: 0 }, defs);
    el("stop", { offset: "0%", "stop-color": pal.trunkD }, tg);
    el("stop", { offset: "70%", "stop-color": pal.trunkM }, tg);
    el("stop", { offset: "100%", "stop-color": pal.trunkL }, tg);
    var gradLeaf = "url(#lg" + uid + ")";
    var gradTrunk = "url(#tg" + uid + ")";

    /* ---- geometry ---- */
    var height = lerp(30, 146, Math.pow(t, 0.72));
    var lean = (rng() - 0.5) * 16;
    var bend = (rng() - 0.5) * 0.5;
    var base = { x: CX, y: GROUND };
    var ctrl = { x: CX + lean * 0.25 + bend * height * 0.10, y: GROUND - height * 0.55 };
    var tip = { x: CX + lean + bend * height * 0.35, y: GROUND - height };

    function bez(s) {
      var a = (1 - s) * (1 - s), b = 2 * (1 - s) * s, c = s * s;
      return {
        x: a * base.x + b * ctrl.x + c * tip.x,
        y: a * base.y + b * ctrl.y + c * tip.y
      };
    }
    function tan(s) {
      return {
        x: 2 * (1 - s) * (ctrl.x - base.x) + 2 * s * (tip.x - ctrl.x),
        y: 2 * (1 - s) * (ctrl.y - base.y) + 2 * s * (tip.y - ctrl.y)
      };
    }

    /* ---- ground: mound, stones, moss, tufts ---- */
    var soilG = grp(animate ? { "class": "g-soil" } : {}, svg);
    el("ellipse", { cx: CX, cy: GROUND + 7, rx: 38, ry: 8, fill: pal.soilLo, opacity: .9 }, soilG);
    el("ellipse", { cx: CX, cy: GROUND + 4, rx: 29, ry: 6, fill: pal.soil }, soilG);
    for (var st = 0; st < 3; st++) {
      el("ellipse", {
        cx: (CX - 26 + rng() * 52).toFixed(1), cy: (GROUND + 4 + rng() * 3).toFixed(1),
        rx: (2.2 + rng() * 2).toFixed(1), ry: (1.4 + rng()).toFixed(1),
        fill: pal.stone, opacity: .85
      }, soilG);
    }
    for (st = 0; st < 4; st++) {
      el("circle", {
        cx: (CX - 18 + rng() * 36).toFixed(1), cy: (GROUND + 2 + rng() * 4).toFixed(1),
        r: (1 + rng() * 1.4).toFixed(1), fill: pal.grass, opacity: .5
      }, soilG);
    }
    for (var tf = 0; tf < 3; tf++) {
      var gx = CX + (rng() < .5 ? -1 : 1) * (28 + rng() * 32);
      for (var b = 0; b < 3; b++) {
        var gh = (7 + rng() * 9) * (b === 1 ? 1 : .72);
        var dir = (b - 1) || (rng() < .5 ? -1 : 1);
        var blade = el("path", {
          d: "M" + (gx + b * 2.4 - 2.4).toFixed(1) + " " + (GROUND + 5) +
             " q" + (dir * 3).toFixed(1) + " " + (-gh * .6).toFixed(1) +
             " " + (dir * 6).toFixed(1) + " " + (-gh).toFixed(1),
          stroke: pal.grass, "stroke-width": 1.5, fill: "none",
          "stroke-linecap": "round", opacity: .72
        }, svg);
        if (animate) arm(blade, 0.05 + rng() * 0.25, 0.5);
      }
    }

    /* ---- whole-organism sway ---- */
    var swayR = grp({ "class": "sway-r" }, svg);
    swayR.style.setProperty("--sdur", (4.8 + rng() * 1.8).toFixed(2) + "s");
    swayR.style.animationDelay = "-" + (rng() * 4).toFixed(2) + "s";

    el("ellipse", {
      cx: CX, cy: GROUND + 2, rx: Math.max(11, height * .15).toFixed(1), ry: 3.2,
      fill: "rgba(43,42,33,.13)"
    }, swayR);

    /* pop-wrapper helper: sets staggered entrance timing */
    var popIdx = 0;
    function popped(host, delay) {
      var p = grp({ "class": "g-pop" }, host);
      p.style.setProperty("--d", (delay + (popIdx++) * 0.038).toFixed(2) + "s");
      return p;
    }

    /* leaf-crown builder: three tonal layers of outward-pointing leaves */
    function crown(host, ccx, ccy, r, dBase) {
      var k = 0;
      function layer(count, fill, sc, dy, spread, flutter) {
        for (var i = 0; i < count; i++) {
          var th = (-185 + (i / Math.max(1, count - 1)) * 190 + (rng() - .5) * 22) * Math.PI / 180;
          var dist = r * (0.4 + rng() * 0.55) * spread;
          var lx = clampW(ccx + Math.cos(th) * dist);
          var ly = ccy + Math.sin(th) * dist * 0.8 + dy;
          var rot = th * 180 / Math.PI;
          var L = r * (0.5 + rng() * 0.28) * sc;
          var wrap = popped(host, dBase);
          if (flutter && k % 3 === 0) {
            var fw = grp({ "class": "fl" }, wrap);
            fw.style.setProperty("--fdur", (3.4 + rng() * 2).toFixed(2) + "s");
            fw.style.animationDelay = "-" + (rng() * 3).toFixed(2) + "s";
            var placeF = grp({ transform: "translate(" + lx.toFixed(1) + " " + ly.toFixed(1) + ") rotate(" + rot.toFixed(1) + ")" }, fw);
            makeLeaf(placeF, { len: L, wid: L * .36, fill: fill, pal: pal });
          } else {
            var place = grp({ transform: "translate(" + lx.toFixed(1) + " " + ly.toFixed(1) + ") rotate(" + rot.toFixed(1) + ")" }, wrap);
            makeLeaf(place, { len: L, wid: L * .36, fill: fill, pal: pal });
          }
          k++;
        }
      }
      layer(Math.max(7, Math.round(r * .3)), pal.leafLo, .66, r * .12, 1.02, false);  /* shaded underside */
      layer(Math.max(8, Math.round(r * .36)), gradLeaf, .74, 0, .84, false);          /* main body */
      layer(Math.max(5, Math.round(r * .2)), pal.leafHi, .6, -r * .1, .55, true);     /* sunlit tips */
      if (u >= 6) {                                                                    /* berries */
        var nb = 2 + Math.floor(rng() * 3);
        for (var j = 0; j < nb; j++) {
          var ang = rng() * Math.PI * 2;
          var bp = popped(host, dBase + .3);
          el("circle", {
            cx: clampW(ccx + Math.cos(ang) * r * .5).toFixed(1),
            cy: (ccy + Math.sin(ang) * r * .42).toFixed(1),
            r: 1.7, fill: pal.bloom, stroke: pal.edge, "stroke-width": .4
          }, bp);
        }
      }
    }

    /* ================= trunk / stem ================= */
    var bw = tree ? lerp(3.4, 10, t) : lerp(2.4, 3.6, t);
    var tw = tree ? bw * .32 : bw * .8;

    if (tree) {
      /* tapered trunk as filled polygon with root flare */
      var S = 14, left = [], right = [];
      for (var i2 = 0; i2 <= S; i2++) {
        var s2 = i2 / S;
        var p2 = bez(s2);
        var tn = tan(s2);
        var tl = Math.sqrt(tn.x * tn.x + tn.y * tn.y) || 1;
        var nx = -tn.y / tl, ny = tn.x / tl;
        var hw = lerp(bw * .5, tw * .5, Math.pow(s2, .72)) *
                 (1 + .85 * Math.exp(-s2 * 5));                    /* root flare */
        left.push((p2.x + nx * hw).toFixed(1) + " " + p2.y.toFixed(1));
        right.unshift((p2.x - nx * hw).toFixed(1) + " " + p2.y.toFixed(1));
      }
      var trunkWrap = grp({ "class": "g-trunk" }, swayR);
      trunkWrap.style.setProperty("--d", "0.08s");
      el("path", {
        d: "M" + left.join(" L ") + " L " + right.join(" L ") + " Z",
        fill: gradTrunk,
        stroke: pal.trunkD, "stroke-width": .6, "stroke-opacity": .5
      }, trunkWrap);
      /* bark shading */
      el("path", {
        d: "M" + (CX - bw * .18).toFixed(1) + " " + (GROUND - 8) +
           " q " + (lean * .3 + 2).toFixed(1) + " " + (-height * .22).toFixed(1) +
           " " + (lean * .5 - 2).toFixed(1) + " " + (-height * .46).toFixed(1),
        stroke: pal.trunkD, "stroke-width": 1, fill: "none", "stroke-opacity": .4
      }, trunkWrap);
      if (u >= 6) {
        el("ellipse", {
          cx: (CX + lean * .4).toFixed(1), cy: (GROUND - height * .3).toFixed(1),
          rx: 1.6, ry: 2.6, fill: pal.trunkD, opacity: .55
        }, trunkWrap);                                               /* knot */
      }
    } else {
      /* herbaceous stem: drawn on like a pen stroke */
      var stem = el("path", {
        d: "M" + base.x.toFixed(1) + " " + base.y.toFixed(1) +
           " Q" + ctrl.x.toFixed(1) + " " + ctrl.y.toFixed(1) +
           " " + tip.x.toFixed(1) + " " + tip.y.toFixed(1),
        stroke: pal.leafMd, "stroke-width": bw.toFixed(2),
        fill: "none", "stroke-linecap": "round"
      }, swayR);
      if (animate) arm(stem, 0.1, 0.85 + height / 260);
    }

    /* ================= sapling foliage ================= */
    if (!tree) {
      var leafCount = u === 0 ? 2 : Math.min(2 + Math.round(t * 5), 7);
      for (var li = 0; li < leafCount; li++) {
        var ls = u === 0 ? 0.7 + li * 0.12
                         : lerp(0.32, 0.88, leafCount === 1 ? .5 : li / (leafCount - 1));
        var lp = bez(ls);
        var side = li % 2 === 0 ? 1 : -1;
        var ll = lerp(10, 19, 1 - ls * .5) * (0.85 + rng() * 0.3);

        var place2 = grp({ transform: "translate(" + lp.x.toFixed(1) + " " + lp.y.toFixed(1) + ")" }, swayR);
        var fl2 = grp({ "class": "fl" }, place2);
        fl2.style.setProperty("--fdur", (3.2 + rng() * 2.4).toFixed(2) + "s");
        fl2.style.animationDelay = "-" + (rng() * 3).toFixed(2) + "s";
        var grow = grp({ "class": "g-leaf" }, fl2);
        grow.style.setProperty("--d", (0.32 + li * 0.11).toFixed(2) + "s");
        grow.setAttribute("transform", (side < 0 ? "scale(-1 1) " : "") + "rotate(" + (-8 - rng() * 16).toFixed(1) + ")");
        makeLeaf(grow, {
          len: ll, wid: ll * .42,
          fill: li % 2 ? gradLeaf : pal.leafMd,
          pal: pal, veinlets: true
        });
      }
    }

    /* ================= canopy ================= */
    if (tree) {
      var bCount = u >= 7 ? 3 : 2;
      var ends = [];
      for (var bi = 0; bi < bCount; bi++) {
        var bs = lerp(0.55, 0.86, bCount === 1 ? .5 : bi / (bCount - 1));
        var bp0 = bez(bs);
        var bside = bi % 2 === 0 ? 1 : -1;
        var blen = lerp(20, 44, t) * (0.8 + rng() * 0.4);
        var bendPt = { x: bp0.x + bside * blen * 0.85, y: bp0.y - blen * 0.55 };
        var bctrlPt = { x: bp0.x + bside * blen * 0.15, y: bp0.y - blen * 0.45 };

        var bSway = grp({ "class": "sway-b" }, swayR);
        bSway.style.setProperty("--sdur", (3.8 + rng() * 1.6).toFixed(2) + "s");
        bSway.style.animationDelay = "-" + (rng() * 3).toFixed(2) + "s";

        var branchPath = el("path", {
          d: "M" + bp0.x.toFixed(1) + " " + bp0.y.toFixed(1) +
             " Q" + bctrlPt.x.toFixed(1) + " " + bctrlPt.y.toFixed(1) +
             " " + bendPt.x.toFixed(1) + " " + bendPt.y.toFixed(1),
          stroke: pal.trunkM, "stroke-width": (bw * .34).toFixed(2),
          fill: "none", "stroke-linecap": "round"
        }, bSway);
        if (animate) arm(branchPath, 0.7 + bi * 0.14, 0.6);

        ends.push(bendPt);
        crown(bSway, bendPt.x, bendPt.y - 3, lerp(9, 17, t), 1.05 + bi * 0.12);
      }
      /* main crown covers the leader tip */
      crown(swayR, tip.x, tip.y - rOffset(u), lerp(15, 30, t), 0.95);
    } else if (u >= 2) {
      crown(swayR, tip.x, tip.y - 2, lerp(7, 12, t), 0.9);
    }

    function rOffset(uu) { return uu >= 7 ? 6 : 4; }

    /* ================= blossoms once mature ================= */
    if (u >= 8) {
      var bn = 3 + Math.min(3, u - 8);
      for (var bo = 0; bo < bn; bo++) {
        var ang2 = rng() * Math.PI * 2, rad2 = lerp(15, 30, t) * (0.3 + rng() * 0.55);
        var bx = clampW(tip.x + Math.cos(ang2) * rad2);
        var by = (tip.y - rOffset(u)) + Math.sin(ang2) * rad2 * 0.7;
        var blossom = popped(swayR, 1.6);
        el("circle", { cx: bx.toFixed(1), cy: by.toFixed(1), r: (2.2 + rng() * 1.2).toFixed(1), fill: pal.bloom, stroke: pal.edge, "stroke-width": .4 }, blossom);
        el("circle", { cx: (bx - .7).toFixed(1), cy: (by - .7).toFixed(1), r: .7, fill: "#fffdf4", opacity: .9 }, blossom);
      }
    }

    return svg;
  }

  /* ---------- public API ---------- */
  function clearSvg(container) {
    Array.prototype.slice.call(container.querySelectorAll("svg"))
      .forEach(function (s) { s.remove(); });
  }

  function draw(container, seed, updates) {
    clearSvg(container);
    container.appendChild(build(seed, updates, false));
  }

  function play(container, seed, updates, extraDelayMs) {
    if (REDUCED) { draw(container, seed, updates); return; }
    clearSvg(container);
    var svg = build(seed, updates, true);
    svg.style.setProperty("--pd", ((extraDelayMs || 0)).toFixed(0) + "ms");
    container.appendChild(svg);

    var draws = svg.querySelectorAll("path.draw");
    draws.forEach(function (p) {
      var len = p.getTotalLength();
      p.style.strokeDasharray = len + " " + len;
      p.style.strokeDashoffset = len;
    });
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        var extra = (extraDelayMs || 0) / 1000;
        draws.forEach(function (p) {
          p.style.transition = "stroke-dashoffset " + p.dataset.dur +
            "s cubic-bezier(.3,.75,.35,1) " +
            ((parseFloat(p.dataset.delay) || 0) + extra).toFixed(2) + "s";
          p.style.strokeDashoffset = "0";
        });
      });
    });
  }

  function replay(container, seed, updates) { play(container, seed, updates, 0); }

  window.GardenPlants = { draw: draw, play: play, replay: replay };
})();
