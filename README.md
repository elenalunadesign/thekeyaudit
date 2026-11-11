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

## Formulario de contacto

- Envía a `contacto@thekeyaudit.com` mediante [FormSubmit](https://formsubmit.co) (AJAX).
- Al publicarse en un dominio nuevo, FormSubmit puede pedir activarlo otra vez: llega un correo «Activate Form» a contacto@.
- Si el envío falla, la página muestra el motivo y un código (`FORM_NOT_ACTIVATED`, `TIMEOUT_120S`, `NETWORK_ERROR`, etc.).

## Pendientes

- Página de **aviso de privacidad** (`#aviso-de-privacidad` aún no tiene destino).
- Testimonios reales de clientes (hoy son textos de ejemplo, ocultos).

---

`assets/js/morphdom.min.js` · [morphdom](https://github.com/patrick-steele-idem/morphdom) 2.7.4, licencia MIT.
