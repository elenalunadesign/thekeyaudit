# TheKeyAudit · Landing page

Sitio estático de [thekeyaudit.com](https://thekeyaudit.com), en español e inglés.

| Ruta | Página |
|---|---|
| `/` | Español (`index.html`) |
| `/en/` | Inglés (`en/index.html`) |

## Estructura

```
index.html            Página en español
en/index.html         Página en inglés
assets/css/site.css   Estilos compartidos
assets/js/            Motor de la página (dc-runtime.js), lógica por idioma y morphdom
assets/fonts/         Astonpoliz y Creato Display
assets/img/           Logos, foto e iconos (clientes/: versiones -claro y -oscuro)
src/                  Archivos fuente del lienzo de diseño (.dc.html)
tools/build.py        Genera index.html y en/index.html desde src/
api/contacto.php      Verifica reCAPTCHA v3 y reenvía el formulario (Hostinger, PHP)
.htaccess             Redirecciones (https, sin www), caché, compresión y seguridad (Hostinger)
404.html              Página de error propia
robots.txt, sitemap.xml   Generados por tools/build.py
assets/img/og/        Imágenes para compartir en redes (1200×630); fuente en tools/og/
```

## Actualizar el sitio

1. Reemplaza `src/Main.dc.html` y/o `src/Main-EN.dc.html` con la versión nueva del lienzo.
2. Si agregaste imágenes nuevas, regístralas en `ASSETS` dentro de `tools/build.py` y copia el archivo a `assets/`.
3. Ejecuta (requiere Python 3 y Node.js):

   ```bash
   python3 tools/build.py
   ```

4. Revisa localmente con `python3 -m http.server` y abre http://localhost:8000.

## Publicar con GitHub Pages

1. En GitHub: **Settings → Pages → Source: Deploy from a branch → `main` / `(root)`**.
2. El sitio queda en `https://<usuario>.github.io/thekeyaudit/`.
3. Dominio propio (thekeyaudit.com):
   - En **Settings → Pages → Custom domain** escribe `thekeyaudit.com` (GitHub crea el archivo `CNAME`).
   - En el DNS del dominio:
     - Registros **A** para `@`: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
     - Registro **CNAME** para `www`: `<usuario>.github.io`
   - Activa **Enforce HTTPS** cuando GitHub lo permita.
   - No toques los registros **MX** (correo en Google).

## SEO

- `tools/build.py` genera en cada página: título, descripción, canonical, hreflang ES/EN, Open Graph y Twitter (imagen 1200×630), datos estructurados JSON-LD (`ProfessionalService`, `WebSite`, `WebPage` y `FAQPage` con las preguntas frecuentes), carga diferida de imágenes y versión (`?v=`) en CSS/JS para el caché.
- También genera `sitemap.xml` (con la fecha del día) y `robots.txt`.
- Para regenerar las imágenes de redes después de cambiar `tools/og/og-*.html`:

  ```bash
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars --allow-file-access-from-files --window-size=1200,630 --screenshot="$PWD/assets/img/og/og-es.png" "file://$PWD/tools/og/og-es.html"
  ```

## Formulario de contacto

- Envía a `contacto@thekeyaudit.com` mediante [FormSubmit](https://formsubmit.co) (AJAX).
- Al publicarse en un dominio nuevo, FormSubmit puede pedir activarlo otra vez: llega un correo «Activate Form» a contacto@.
- Si el envío falla, la página muestra el motivo y un código (`FORM_NOT_ACTIVATED`, `TIMEOUT_120S`, `NETWORK_ERROR`, etc.).

### reCAPTCHA v3 (Hostinger)

En `thekeyaudit.com` el formulario pasa por `api/contacto.php`, que verifica reCAPTCHA v3 con Google, filtra bots (campo trampa y límite de 5 envíos cada 10 minutos por IP) y reenvía el mensaje a FormSubmit. En el lienzo de diseño y en GitHub Pages el formulario sigue enviando directo a FormSubmit.

1. En https://www.google.com/recaptcha/admin/create crea un sitio **reCAPTCHA v3** con los dominios `thekeyaudit.com` y `localhost`.
2. **Site Key** (pública): ponla como valor por defecto de la prop `recaptchaKey` en `src/Main.dc.html` y `src/Main-EN.dc.html` (o en el panel Tweaks del lienzo) y ejecuta `python3 tools/build.py`. Mientras esté vacía, reCAPTCHA queda apagado.
3. **Secret Key** (privada, nunca en el repositorio): en el File Manager de Hostinger crea `tka-config.php` **junto a** `public_html` (no dentro):

   ```php
   <?php return [
     'recaptcha_secret' => 'TU_SECRET_KEY',
     'formsubmit'       => 'https://formsubmit.co/ajax/contacto@thekeyaudit.com',
     'min_score'        => 0.5,
   ];
   ```

   En `formsubmit` puedes usar el alias aleatorio que FormSubmit da tras la activación, para no exponer el correo.
4. Códigos de error nuevos: `CAPTCHA_FAILED`, `CAPTCHA_LOW_SCORE`, `CAPTCHA_UNAVAILABLE`, `RATE_LIMIT`, `SERVER_NOT_CONFIGURED`.

## Pendientes

- Página de **aviso de privacidad** (`#aviso-de-privacidad` aún no tiene destino).
- Testimonios reales de clientes (hoy son textos de ejemplo, ocultos).

---

`assets/js/morphdom.min.js` · [morphdom](https://github.com/patrick-steele-idem/morphdom) 2.7.4, licencia MIT.
