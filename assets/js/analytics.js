/*
 * analytics.js · TheKeyAudit
 * Google Analytics 4 (solo en thekeyaudit.com) y eventos de contacto:
 *   generate_lead       formulario enviado
 *   form_error          error del formulario (con su código)
 *   contact_whatsapp    clic en WhatsApp
 *   contact_phone       clic en teléfono
 *   contact_email       clic en correo
 *   social_linkedin     clic en LinkedIn
 */
(function () {
  'use strict';
  var GA_ID = 'G-XX9YKJB2T2';
  if (!/(^|\.)thekeyaudit\.com$/.test(location.hostname)) return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', GA_ID);

  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
  document.head.appendChild(s);

  var lang = document.documentElement.lang || '';
  function track(name, params) {
    params = params || {};
    params.page_language = lang;
    window.gtag('event', name, params);
  }

  // Clics en enlaces de contacto
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href') || '';
    var where = a.closest('header') ? 'encabezado' : a.closest('footer') ? 'pie' : a.closest('#contacto') ? 'contacto' : 'pagina';
    if (/wa\.me|whatsapp\.com/i.test(href)) track('contact_whatsapp', { link_location: where });
    else if (/^tel:/i.test(href)) track('contact_phone', { link_location: where });
    else if (/^mailto:/i.test(href)) track('contact_email', { link_location: where });
    else if (/linkedin\.com/i.test(href)) track('social_linkedin', { link_location: where });
  }, true);

  // Resultado del formulario: la página muestra .ok (enviado) o .form-err (error)
  function watchForm() {
    var root = document.getElementById('dc-root');
    if (!root || !window.MutationObserver) return;
    var lastErr = '';
    new MutationObserver(function () {
      var form = document.getElementById('form-consulta');
      if (!form) return;
      if (form.querySelector('.ok')) {
        if (!form.__tkaLead) { form.__tkaLead = true; lastErr = ''; track('generate_lead', { form_name: 'consulta' }); }
        return;
      }
      form.__tkaLead = false;
      var err = form.querySelector('.form-err');
      var code = err ? ((err.textContent.match(/(?:CÓDIGO|CODE):\s*([A-Z0-9_ ·]+)/) || [])[1] || 'DESCONOCIDO').trim() : '';
      if (code && code !== lastErr) track('form_error', { form_name: 'consulta', error_code: code });
      lastErr = code;
    }).observe(root, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchForm); else watchForm();
})();
