/*
 * dc-runtime.js · TheKeyAudit
 * Motor mínimo que reproduce el comportamiento de las páginas del lienzo de diseño:
 * plantillas con {{huecos}}, <sc-if>, <sc-for>, eventos onClick/onKeyDown/onPointer*
 * y componentes con state / setState / renderVals / ciclo de vida.
 * Funciona en el navegador (con morphdom) y en Node (para generar el HTML inicial).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DCRuntime = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VOID = { area: 1, base: 1, br: 1, col: 1, embed: 1, hr: 1, img: 1, input: 1, link: 1, meta: 1, source: 1, track: 1, wbr: 1 };
  var HOLE = /\{\{\s*([\w.$]+)\s*\}\}/g;
  var SINGLE = /^\{\{\s*([\w.$]+)\s*\}\}$/;
  var REVEAL = '.rv, .rv-mask, .rv-img, .rv-draw, .rv-casc';

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function escA(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;'); }

  function lookup(scope, path) {
    if (path === 'true') return true;
    if (path === 'false') return false;
    var parts = path.split('.');
    var v = scope;
    for (var i = 0; i < parts.length; i++) {
      if (v == null) return undefined;
      v = v[parts[i]];
    }
    return v;
  }
  function single(str) { var m = SINGLE.exec(str || ''); return m ? m[1] : null; }
  function interp(str, scope) {
    return str.replace(HOLE, function (_, p) {
      var v = lookup(scope, p);
      return v == null || v === false ? '' : String(v);
    });
  }

  function renderNodes(nodes, scope, ctx) {
    var out = '';
    for (var i = 0; i < nodes.length; i++) out += renderNode(nodes[i], scope, ctx);
    return out;
  }

  function renderNode(n, scope, ctx) {
    var kind = n[0];
    if (kind === 't') return esc(interp(n[1], scope));
    if (kind === 'if') {
      var p = single(n[1]);
      return (p ? lookup(scope, p) : n[1]) ? renderNodes(n[2], scope, ctx) : '';
    }
    if (kind === 'for') {
      var list = lookup(scope, single(n[1]) || '') || [];
      var out = '';
      for (var i = 0; i < list.length; i++) {
        var s = Object.create(scope);
        s[n[2]] = list[i];
        s.__k = (scope.__k || '') + '.' + i;
        out += renderNodes(n[3], s, ctx);
      }
      return out;
    }
    // elemento: ['e', tag, [[nombre, valor|null]...], hijos]
    var tag = n[1], attrs = n[2];
    var html = '<' + tag;
    var evs = [];
    for (var a = 0; a < attrs.length; a++) {
      var k = attrs[a][0], v = attrs[a][1];
      if (k.indexOf('hint-') === 0) continue;
      if (/^on[a-z]+$/.test(k)) {
        var hp = single(v);
        var fn = hp ? lookup(scope, hp) : null;
        if (typeof fn === 'function') { ctx.h.push(fn); evs.push(k.slice(2) + ':' + (ctx.h.length - 1)); }
        continue;
      }
      if (v === null) { html += ' ' + k; continue; }
      var sp = single(v);
      if (sp) {
        var val = lookup(scope, sp);
        if (val == null || val === false) continue;
        if (val === true) { html += ' ' + k; continue; }
        html += ' ' + k + '="' + escA(val) + '"';
      } else {
        html += ' ' + k + '="' + escA(interp(v, scope)) + '"';
      }
    }
    if (n[4]) html += ' data-k="' + n[4] + (scope.__k || '') + '"';
    if (evs.length) html += ' data-dc-ev="' + evs.join(' ') + '"';
    html += '>';
    if (VOID[tag]) return html;
    return html + renderNodes(n[3], scope, ctx) + '</' + tag + '>';
  }

  class DCLogic {
    constructor(props) { this.props = props || {}; this.state = {}; }
    setState(patch, cb) {
      if (typeof patch === 'function') patch = patch(this.state, this.props);
      this.state = Object.assign({}, this.state, patch);
      if (this.__render) this.__render();
      if (cb) cb();
    }
  }

  function defaults(propsSpec) {
    var p = {};
    Object.keys(propsSpec || {}).forEach(function (k) {
      if (k.charAt(0) !== '$' && propsSpec[k] && 'default' in propsSpec[k]) p[k] = propsSpec[k].default;
    });
    return p;
  }

  /* HTML inicial (Node o navegador) sin montar el componente */
  function prerender(page) {
    var props = defaults(page.props);
    var comp = new page.Component(props);
    comp.props = props;
    return renderNodes(page.ast, comp.renderVals(), { h: [] });
  }

  /* Montaje en el navegador: reemplaza el HTML inicial y conecta eventos */
  function mount(page, rootEl) {
    var props = defaults(page.props);
    var comp = new page.Component(props);
    comp.props = props;
    var handlers = [];
    var bound = [];
    var mounted = false;

    function bind() {
      for (var b = 0; b < bound.length; b++) bound[b]._dc = {};
      bound = [];
      var els = rootEl.querySelectorAll('[data-dc-ev]');
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        el._dc = {};
        el._dcb = el._dcb || {};
        el.getAttribute('data-dc-ev').split(' ').forEach(function (spec) {
          var parts = spec.split(':');
          var type = parts[0];
          el._dc[type] = handlers[+parts[1]];
          if (!el._dcb[type]) {
            el._dcb[type] = true;
            el.addEventListener(type, function (e) {
              var f = this._dc && this._dc[e.type];
              if (f) f(e);
            });
          }
        });
        bound.push(el);
      }
    }

    function render() {
      var ctx = { h: [] };
      var html = renderNodes(page.ast, comp.renderVals(), ctx);
      handlers = ctx.h;
      window.morphdom(rootEl, '<div id="' + rootEl.id + '">' + html + '</div>', {
        getNodeKey: function (node) {
          return node.nodeType === 1 ? (node.getAttribute('data-k') || node.id || undefined) : undefined;
        },
        onBeforeElUpdated: function (from, to) {
          var t = from.tagName;
          if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT') return false;
          if (from.hasAttribute('data-in') && !to.hasAttribute('data-in')) to.setAttribute('data-in', '');
          return true;
        },
        onNodeAdded: function (node) {
          if (mounted && node.nodeType === 1 && comp.state.motion) {
            if (node.matches && node.matches(REVEAL)) node.setAttribute('data-in', '');
            var inner = node.querySelectorAll ? node.querySelectorAll(REVEAL) : [];
            for (var i = 0; i < inner.length; i++) inner[i].setAttribute('data-in', '');
          }
          return node;
        }
      });
      bind();
    }

    comp.__render = render;
    render();
    mounted = true;
    if (comp.componentDidMount) comp.componentDidMount();
    return comp;
  }

  return { DCLogic: DCLogic, prerender: prerender, mount: mount, renderNodes: renderNodes };
});
