/*
 * The legal pages' language switch: each page carries the full text in
 * Uzbek, Russian and English as three <article lang>; one shows.
 *
 * Chosen by, in order: ?lang= in the address (so a link can point at one
 * language), the visitor's last choice, then Uzbek. The <html lang> follows,
 * so screen readers and hyphenation use the right language, and the bar and
 * footer labels follow too.
 */
(function () {
  var LANGS = ['uz', 'ru', 'en'];
  var KEY = 'duyo-lang';
  var LABELS = {
    skip: { uz: 'Asosiy matnga o‘tish', ru: 'Перейти к тексту', en: 'Skip to the text' },
    home: { uz: 'Bosh sahifa', ru: 'Главная', en: 'Home' },
    privacy: { uz: 'Maxfiylik siyosati', ru: 'Политика конфиденциальности', en: 'Privacy policy' },
    terms: { uz: 'Foydalanish shartlari', ru: 'Условия использования', en: 'Terms of use' },
    deletion: { uz: 'Hisobni o‘chirish', ru: 'Удаление аккаунта', en: 'Account deletion' },
    team: { uz: 'DUYO jamoasi', ru: 'Команда DUYO', en: 'The DUYO team' },
  };

  function pick() {
    var fromUrl = null;
    var saved = null;
    try {
      fromUrl = new URL(window.location.href).searchParams.get('lang');
    } catch (e) {
      /* an old browser: fall through to the saved choice */
    }
    try {
      saved = window.localStorage.getItem(KEY);
    } catch (e) {
      /* private mode: Uzbek */
    }
    if (LANGS.indexOf(fromUrl) >= 0) return fromUrl;
    if (LANGS.indexOf(saved) >= 0) return saved;
    return 'uz';
  }

  function show(code) {
    var blocks = document.querySelectorAll('[data-legal-lang]');
    for (var i = 0; i < blocks.length; i++) {
      blocks[i].hidden = blocks[i].getAttribute('data-legal-lang') !== code;
    }
    document.documentElement.lang = code;
    var buttons = document.querySelectorAll('[data-lang]');
    for (var j = 0; j < buttons.length; j++) {
      buttons[j].setAttribute('aria-pressed', String(buttons[j].getAttribute('data-lang') === code));
    }
    var labelled = document.querySelectorAll('[data-t]');
    for (var k = 0; k < labelled.length; k++) {
      var entry = LABELS[labelled[k].getAttribute('data-t')];
      if (entry && entry[code]) labelled[k].textContent = entry[code];
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    show(pick());
    var buttons = document.querySelectorAll('[data-lang]');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener('click', function () {
        var code = this.getAttribute('data-lang');
        show(code);
        try {
          window.localStorage.setItem(KEY, code);
        } catch (e) {
          /* private mode: the choice lasts this page */
        }
      });
    }
  });
})();
