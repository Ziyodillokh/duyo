/* ==========================================================================
   DUYO — Sotuv sayti (landing)
   app.js — navigatsiya, akkordeon, til tanlash, scroll animatsiya,
            platformani avtomatik aniqlash
   ========================================================================== */
(function () {
  "use strict";

  var on = function (el, ev, fn) {
    if (el) el.addEventListener(ev, fn);
  };
  var qs = function (sel, root) {
    return (root || document).querySelector(sel);
  };
  var qsa = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };

  /* ---------------------------------------------------------------------
     1. Sticky navbar — scroll qilinganda soya paydo bo'ladi
     --------------------------------------------------------------------- */
  var nav = qs("[data-nav]");

  function onScroll() {
    if (!nav) return;
    nav.classList.toggle("is-stuck", window.scrollY > 8);
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------------------------------------------------------------------
     2. Mobil menyu
     --------------------------------------------------------------------- */
  var navToggle = qs("[data-nav-toggle]");
  var mobileMenu = qs("[data-mobile-menu]");

  function setMenu(open) {
    if (!navToggle || !mobileMenu) return;
    navToggle.setAttribute("aria-expanded", String(open));
    mobileMenu.classList.toggle("is-open", open);
    document.body.classList.toggle("is-locked", open);
  }

  on(navToggle, "click", function () {
    setMenu(navToggle.getAttribute("aria-expanded") !== "true");
  });

  qsa("[data-mobile-menu] a").forEach(function (link) {
    on(link, "click", function () {
      setMenu(false);
    });
  });

  /* ---------------------------------------------------------------------
     3. Til tanlash dropdown
     --------------------------------------------------------------------- */
  var langToggle = qs("[data-lang-toggle]");
  var langMenu = qs("[data-lang-menu]");

  function setLang(open) {
    if (!langToggle || !langMenu) return;
    langToggle.setAttribute("aria-expanded", String(open));
    langMenu.classList.toggle("is-open", open);
  }

  on(langToggle, "click", function (e) {
    e.stopPropagation();
    setLang(langToggle.getAttribute("aria-expanded") !== "true");
  });

  on(document, "click", function () {
    setLang(false);
  });

  on(document, "keydown", function (e) {
    if (e.key === "Escape") {
      setLang(false);
      setMenu(false);
    }
  });

  /* ---------------------------------------------------------------------
     3b. Tarjima (uz / ru / en) — bitta sahifa, uchta til

     Sahifa alohida /ru va /en fayllarga bo'linmagan. Buning o'rniga barcha
     matn tugunlari bir marta yig'iladi va til almashganda joyida
     almashtiriladi. Lug'at kaliti — o'zbekcha matnning O'ZI (assets/i18n.js),
     shuning uchun index.html ga hech qanday kalit yozish shart emas va
     lug'atda topilmagan satr shunchaki o'zbekcha qolaveradi.

     Tarjima har doim o'zbekchadan boshlanadi (uz -> ru -> en emas,
     uz -> ru, uz -> en), shuning uchun asl matn `key` da saqlanadi.
     --------------------------------------------------------------------- */
  var LANGS = ["uz", "ru", "en"];
  var LANG_KEY = "duyo-lang";
  var DICT = window.DUYO_I18N || {};

  // Bu tugunlarga tegilmaydi: skript/uslub matni, til nomlari (ular har doim
  // o'z tilida yoziladi) va JS to'ldiradigan yil.
  var SKIP_TAGS = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEMPLATE: 1 };
  var SKIP_INSIDE = "[data-lang-current],[data-lang-menu],[data-year],[data-i18n]";
  var I18N_ATTRS = ["aria-label", "alt", "placeholder", "title"];

  var textNodes = [];
  var attrNodes = [];
  var htmlBlocks = [];

  // Matnning o'rab turgan bo'sh joyi saqlanadi: "... sinab ko'ring —\n  " dan
  // keyin darhol <a> keladi, trim qilinsa so'z havolaga yopishib qoladi.
  var EDGES = /^(\s*)([\s\S]*?)(\s*)$/;

  function keyOf(value) {
    return value.replace(/\s+/g, " ");
  }

  function collect() {
    var walker = document.createTreeWalker(
      document.documentElement,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function (node) {
          var parent = node.parentNode;
          if (!parent || parent.nodeType !== 1) return NodeFilter.FILTER_REJECT;
          if (SKIP_TAGS[parent.nodeName]) return NodeFilter.FILTER_REJECT;
          if (parent.closest(SKIP_INSIDE)) return NodeFilter.FILTER_REJECT;
          return EDGES.exec(node.nodeValue)[2]
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
        },
      }
    );

    var node;
    while ((node = walker.nextNode())) {
      var parts = EDGES.exec(node.nodeValue);
      textNodes.push({
        node: node,
        lead: parts[1],
        tail: parts[3],
        key: keyOf(parts[2]),
      });
    }

    I18N_ATTRS.forEach(function (name) {
      qsa("[" + name + "]").forEach(function (el) {
        var value = el.getAttribute(name);
        if (value && value.trim()) {
          attrNodes.push({ el: el, name: name, key: keyOf(value.trim()) });
        }
      });
    });

    // Qidiruv natijasi va ijtimoiy tarmoq kartochkasi ham tarjima qilinadi.
    qsa('meta[name="description"],meta[property^="og:"],meta[name^="twitter:"]').forEach(
      function (el) {
        var value = el.getAttribute("content");
        if (value && value.trim()) {
          attrNodes.push({ el: el, name: "content", key: keyOf(value.trim()) });
        }
      }
    );

    qsa("[data-i18n]").forEach(function (el) {
      htmlBlocks.push({ el: el, key: el.getAttribute("data-i18n") });
    });
  }

  function applyLang(code) {
    var pack = DICT[code] || {};
    var text = pack.text || {};
    var html = pack.html || {};

    textNodes.forEach(function (rec) {
      var next = text[rec.key];
      rec.node.nodeValue = rec.lead + (next == null ? rec.key : next) + rec.tail;
    });

    attrNodes.forEach(function (rec) {
      var next = text[rec.key];
      rec.el.setAttribute(rec.name, next == null ? rec.key : next);
    });

    htmlBlocks.forEach(function (rec) {
      var next = html[rec.key];
      if (next != null) rec.el.innerHTML = next;
    });

    document.documentElement.setAttribute("lang", code);
  }

  function syncLangUi(code) {
    var label = qs("[data-lang-current]");
    if (label) label.textContent = code.toUpperCase();

    qsa("[data-lang-menu] [data-lang]").forEach(function (item) {
      var active = item.getAttribute("data-lang") === code;
      item.setAttribute("aria-current", String(active));
      if (!active || !langToggle) return;
      // Tugmadagi bayroqcha ham tanlangan tilnikiga almashadi.
      var from = qs(".flag", item);
      var to = qs(".flag", langToggle);
      if (from && to) to.replaceWith(from.cloneNode(true));
    });
  }

  function selectLang(code, remember) {
    if (LANGS.indexOf(code) < 0) code = "uz";
    applyLang(code);
    syncLangUi(code);
    if (remember) {
      try {
        localStorage.setItem(LANG_KEY, code);
      } catch (e) {
        /* private rejim — til shu sessiya uchungina qoladi */
      }
    }
  }

  collect();

  qsa("[data-lang-menu] [data-lang]").forEach(function (item) {
    on(item, "click", function () {
      selectLang(item.getAttribute("data-lang"), true);
      setLang(false);
    });
  });

  // Boshlang'ich til: ?lang=ru havolasi > oxirgi tanlangan til > o'zbekcha.
  // URL parametri reklama havolalari uchun — "duyo.uz/?lang=ru" ni yuborsangiz,
  // sahifa darhol rus tilida ochiladi.
  var urlLang = null;
  try {
    urlLang = new URL(window.location.href).searchParams.get("lang");
  } catch (e) {
    /* eski brauzer — parametr o'qilmaydi, saqlangan tilga tushamiz */
  }

  var savedLang = null;
  try {
    savedLang = localStorage.getItem(LANG_KEY);
  } catch (e) {
    /* o'qib bo'lmasa — o'zbekcha */
  }

  if (urlLang && LANGS.indexOf(urlLang) >= 0) {
    selectLang(urlLang, true);
  } else if (savedLang && savedLang !== "uz") {
    selectLang(savedLang, false);
  }

  /* ---------------------------------------------------------------------
     4. FAQ akkordeon
     --------------------------------------------------------------------- */
  qsa("[data-accordion]").forEach(function (root) {
    var items = qsa("[data-accordion-item]", root);

    items.forEach(function (item) {
      var trigger = qs("[data-accordion-trigger]", item);
      if (!trigger) return;

      on(trigger, "click", function () {
        var willOpen = !item.classList.contains("is-open");

        items.forEach(function (other) {
          other.classList.remove("is-open");
          var t = qs("[data-accordion-trigger]", other);
          if (t) t.setAttribute("aria-expanded", "false");
        });

        if (willOpen) {
          item.classList.add("is-open");
          trigger.setAttribute("aria-expanded", "true");
        }
      });
    });
  });

  /* ---------------------------------------------------------------------
     5. Scroll reveal
     --------------------------------------------------------------------- */
  var revealables = qsa(".reveal");

  if (!("IntersectionObserver" in window)) {
    revealables.forEach(function (el) {
      el.classList.add("is-visible");
    });
  } else {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.08 }
    );

    revealables.forEach(function (el) {
      io.observe(el);
    });
  }

  /* ---------------------------------------------------------------------
     6. Foydalanuvchi platformasini aniqlash
     --------------------------------------------------------------------- */
  var ua = navigator.userAgent || "";
  var platform = null;

  if (/iPhone|iPad|iPod/i.test(ua)) {
    platform = "ios";
  } else if (/Android/i.test(ua)) {
    platform = "android";
  } else if (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1) {
    platform = "ios"; // iPadOS desktop rejimi
  }

  if (platform) {
    document.documentElement.setAttribute("data-user-platform", platform);

    var card = qs('[data-platform="' + platform + '"]');
    if (card) {
      card.classList.add("is-recommended");
      var hint = qs("[data-platform-hint]", card);
      if (hint) hint.hidden = false;
    }
  }

  /* ---------------------------------------------------------------------
     7. Faol navigatsiya havolasi (scroll spy)
     --------------------------------------------------------------------- */
  var navLinks = qsa("[data-nav-link]");
  var sections = navLinks
    .map(function (link) {
      var id = link.getAttribute("href");
      return id && id.charAt(0) === "#" ? qs(id) : null;
    })
    .filter(Boolean);

  if (sections.length && "IntersectionObserver" in window) {
    var spy = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          navLinks.forEach(function (link) {
            link.classList.toggle(
              "is-active",
              link.getAttribute("href") === "#" + entry.target.id
            );
          });
        });
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );

    sections.forEach(function (section) {
      spy.observe(section);
    });
  }

  /* ---------------------------------------------------------------------
     8. Footer yili
     --------------------------------------------------------------------- */
  qsa("[data-year]").forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });
})();
