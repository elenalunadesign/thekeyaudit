#!/usr/bin/env python3
"""
Genera el sitio estático de TheKeyAudit a partir de las páginas del lienzo de diseño.

  src/Main.dc.html     -> index.html        (español)
  src/Main-EN.dc.html  -> en/index.html     (inglés)

Uso:  python3 tools/build.py      (requiere Python 3 y Node.js)
"""
import json
import re
import subprocess
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'src'
SITE_URL = 'https://thekeyaudit.com'

# Archivos del lienzo (/_blob/<id>) -> archivos del sitio
ASSETS = {
    '64647caadfcc62eb5b18102328572d53': 'fonts/Astonpoliz.otf',
    'a1b4a6036e690be42f9d912388f4437f': 'fonts/CreatoDisplay-Regular.otf',
    '6b489d7bd32ccd632c75ed863fc1d7a1': 'fonts/CreatoDisplay-Medium.otf',
    'ed84618095560205153108d531e6619b': 'fonts/CreatoDisplay-Bold.otf',
    '1d1acbaadee243b7ebbd007dc625b9b7': 'fonts/CreatoDisplay-ExtraBold.otf',
    'd635fa96aab9783cfb1ed3b544bf44a2': 'img/whatsapp.svg',
    '354e71e04b8d60745da4619ad9f217ba': 'img/thekeyaudit-logo-corto-claro.svg',
    '484499dfcd87a40b686b5c88f9091859': 'img/thekeyaudit-logo-corto-oscuro.svg',
    'a0285055b6a16a1696afafbe7ea805d8': 'img/thekeyaudit-logo.svg',
    '52f66aebaf0b15be6c4b5a2c00c5c32a': 'img/aaron-gutierrez-auditoria-interna-guadalajara.jpg',
    '2abc077acf87ba90e1e4e9a0d1ce3080': 'img/clientes/grupomodelo-claro.svg',
    'dd42aee0322ec52945f8c628a8ffb258': 'img/clientes/grupomodelo-oscuro.svg',
    'd47d4690a41cb489bdaf3d2c80d2f3b6': 'img/clientes/ferrero-claro.svg',
    '12f5ea08cda39e880b9e3b59efafa1b3': 'img/clientes/ferrero-oscuro.svg',
    '44adfc6f5e717c862a0b03d41bb217c1': 'img/clientes/mabe-claro.svg',
    'e34c186ebec70c90dd446dc4fb25ab3b': 'img/clientes/mabe-oscuro.svg',
    '9e3ce86694856870223779bf901465ef': 'img/clientes/josecuervo-claro.svg',
    'e77b2ab6289921bb6ae8bfd8223c28a9': 'img/clientes/josecuervo-oscuro.svg',
    'd0e1168fb578c57ac9a20677f942ec08': 'img/clientes/lincoln-claro.svg',
    '8f22f70de4adb1948c6690d0a216b439': 'img/clientes/lincoln-oscuro.svg',
    '19083dabf154da841f3eadff1a5de24c': 'img/clientes/novartis-claro.svg',
    'a922c163e1d7bcda6253371c421d01e1': 'img/clientes/novartis-oscuro.svg',
    '55566da18c855e5626a2e9a713d8ae67': 'img/clientes/pwc-claro.svg',
    '5c0aab9f64d98e9f0a54fffe804e65e5': 'img/clientes/pwc-oscuro.svg',
    '8b976418f28c3537359dcbf441272a8a': 'img/clientes/kpmg-claro.svg',
    'ea308d9e858f9db63c6bcf6663f7831e': 'img/clientes/kpmg-oscuro.svg',
}

PAGES = [
    dict(src='Main.dc.html', out='index.html', base='', js='page-es.js', lang='es-MX', path='/',
         desc='Despacho de auditoría interna y control interno en Guadalajara. Auditoría de procesos, ambiente de control y remediación de hallazgos con más de 20 años de experiencia multinacional.'),
    dict(src='Main-EN.dc.html', out='en/index.html', base='../', js='page-en.js', lang='en', path='/en/',
         desc='Internal audit and internal control consulting firm in Guadalajara, Mexico. Business process audits, control environment and audit findings remediation, backed by 20+ years of multinational experience.'),
]

VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'}


class AstBuilder(HTMLParser):
    """Convierte la plantilla del lienzo en un árbol JSON que entiende dc-runtime.js"""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = []
        self.stack = [('root', self.root)]

    def handle_starttag(self, tag, attrs):
        if tag == 'sc-if':
            d = dict(attrs)
            node = ['if', d.get('value', ''), []]
            self.stack[-1][1].append(node)
            self.stack.append((tag, node[2]))
            return
        if tag == 'sc-for':
            d = dict(attrs)
            node = ['for', d.get('list', ''), d.get('as', 'item'), []]
            self.stack[-1][1].append(node)
            self.stack.append((tag, node[3]))
            return
        node = ['e', tag, [[k, v] for k, v in attrs], []]
        self.stack[-1][1].append(node)
        if tag not in VOID:
            self.stack.append((tag, node[3]))

    def handle_startendtag(self, tag, attrs):
        self.stack[-1][1].append(['e', tag, [[k, v] for k, v in attrs], []])
        if tag not in VOID:
            pass  # elemento SVG autocerrado: sin hijos

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i][0] == tag:
                del self.stack[i:]
                return
        raise ValueError('Etiqueta de cierre sin abrir: ' + tag)

    def handle_data(self, data):
        if data:
            self.stack[-1][1].append(['t', data])


def add_keys(nodes, counter=None):
    """Marca con data-k los elementos vecinos de <sc-if>/<sc-for> para que el
    navegador no confunda nodos al mostrar u ocultar bloques."""
    counter = counter if counter is not None else [0]
    has_block = any(n[0] in ('if', 'for') for n in nodes)
    for n in nodes:
        if n[0] == 'e':
            if has_block and len(n) == 4:
                counter[0] += 1
                n.append('k' + str(counter[0]))
            add_keys(n[3], counter)
        elif n[0] == 'if':
            for c in n[2]:
                if c[0] == 'e' and len(c) == 4:
                    counter[0] += 1
                    c.append('k' + str(counter[0]))
            add_keys(n[2], counter)
        elif n[0] == 'for':
            for c in n[3]:
                if c[0] == 'e' and len(c) == 4:
                    counter[0] += 1
                    c.append('k' + str(counter[0]))
            add_keys(n[3], counter)


def asset_url(m, base):
    return base + 'assets/' + ASSETS[m.group(1)]


def main():
    css_written = False
    for p in PAGES:
        s = (SRC / p['src']).read_text(encoding='utf-8')
        title = re.search(r'<title>(.*?)</title>', s, re.S).group(1).strip()
        helmet = s[s.index('<helmet>') + 8:s.index('</helmet>')]
        body = s[s.index('<x-dc>') + 6:s.index('</x-dc>')]
        body = body.replace(s[s.index('<helmet>'):s.index('</helmet>') + 9], '')
        script = re.search(r"<script type=\"text/x-dc\"[^>]*data-props='([^']*)'>(.*?)</script>", s, re.S)
        props, logic = json.loads(script.group(1)), script.group(2)

        # Estilos compartidos (iguales en ambos idiomas)
        css = '\n'.join(re.findall(r'<style[^>]*>(.*?)</style>', helmet, re.S))
        css = re.sub(r'/_blob/([0-9a-f]{32})', lambda m: '../' + ASSETS[m.group(1)], css)
        if not css_written:
            (ROOT / 'assets/css').mkdir(parents=True, exist_ok=True)
            (ROOT / 'assets/css/site.css').write_text(css.strip() + '\n', encoding='utf-8')
            css_written = True

        # Rutas de imágenes y enlaces entre idiomas
        body = re.sub(r'/_blob/([0-9a-f]{32})', lambda m: asset_url(m, p['base']), body)
        if p['base'] == '':
            body = body.replace('href="Main-EN.dc.html"', 'href="en/"')
        else:
            body = body.replace('href="Main.dc.html"', 'href="../"')

        b = AstBuilder()
        b.feed(body)
        b.close()
        ast = b.root
        add_keys(ast)

        page_js = (
            '/* Generado por tools/build.py desde src/' + p['src'] + ' · no editar a mano */\n'
            'var DC_PAGE = (function (DCLogic) {\n' + logic.strip() + '\n'
            'return { props: ' + json.dumps(props, ensure_ascii=False) + ', ast: ' + json.dumps(ast, ensure_ascii=False, separators=(',', ':')) + ', Component: Component };\n'
            '})(DCRuntime.DCLogic);\n'
            "if (typeof document !== 'undefined') {\n"
            "  var dcStart = function () { DCRuntime.mount(DC_PAGE, document.getElementById('dc-root')); };\n"
            "  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', dcStart); else dcStart();\n"
            '}\n'
        )
        js_path = ROOT / 'assets/js' / p['js']
        js_path.write_text(page_js, encoding='utf-8')

        # HTML inicial generado con Node (visible sin JavaScript y para buscadores)
        pre = subprocess.run(['node', str(ROOT / 'tools/prerender.js'), str(js_path)],
                             capture_output=True, text=True, check=True).stdout

        b0 = p['base']
        es_url, en_url = SITE_URL + '/', SITE_URL + '/en/'
        html = f'''<!doctype html>
<html lang="{p['lang']}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{p['desc']}">
<link rel="canonical" href="{SITE_URL}{p['path']}">
<link rel="alternate" hreflang="es-MX" href="{es_url}">
<link rel="alternate" hreflang="en" href="{en_url}">
<link rel="alternate" hreflang="x-default" href="{es_url}">
<meta property="og:type" content="website">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{p['desc']}">
<meta property="og:url" content="{SITE_URL}{p['path']}">
<meta property="og:image" content="{SITE_URL}/assets/img/favicon/favicon-512.png">
<meta name="theme-color" content="#0F2A3D">
<link rel="icon" type="image/png" sizes="32x32" href="{b0}assets/img/favicon/favicon-32.png">
<link rel="icon" type="image/png" sizes="192x192" href="{b0}assets/img/favicon/favicon-192.png">
<link rel="apple-touch-icon" sizes="180x180" href="{b0}assets/img/favicon/favicon-180.png">
<link rel="preload" href="{b0}assets/fonts/Astonpoliz.otf" as="font" type="font/otf" crossorigin>
<link rel="preload" href="{b0}assets/fonts/CreatoDisplay-Regular.otf" as="font" type="font/otf" crossorigin>
<link rel="stylesheet" href="{b0}assets/css/site.css">
<style>html,body{{margin:0;background:#0F2A3D}}</style>
</head>
<body>
<div id="dc-root">{pre}</div>
<script src="{b0}assets/js/morphdom.min.js" defer></script>
<script src="{b0}assets/js/dc-runtime.js" defer></script>
<script src="{b0}assets/js/{p['js']}" defer></script>
</body>
</html>
'''
        out = ROOT / p['out']
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(html, encoding='utf-8')
        print('OK', p['out'], len(html), 'bytes')


if __name__ == '__main__':
    main()
