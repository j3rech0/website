import * as adapter from '@astrojs/netlify/netlify-functions.js';
import { escape } from 'html-escaper';
/* empty css                           *//* empty css                           *//* empty css                        *//* empty css                           *//* empty css                           *//* empty css                       *//* empty css                      */import 'mime';
import 'kleur/colors';
import 'string-width';
import 'path-browserify';
import { compile } from 'path-to-regexp';

const ASTRO_VERSION = "1.2.8";
function createDeprecatedFetchContentFn() {
  return () => {
    throw new Error("Deprecated: Astro.fetchContent() has been replaced with Astro.glob().");
  };
}
function createAstroGlobFn() {
  const globHandler = (importMetaGlobResult, globValue) => {
    let allEntries = [...Object.values(importMetaGlobResult)];
    if (allEntries.length === 0) {
      throw new Error(`Astro.glob(${JSON.stringify(globValue())}) - no matches found.`);
    }
    return Promise.all(allEntries.map((fn) => fn()));
  };
  return globHandler;
}
function createAstro(filePathname, _site, projectRootStr) {
  const site = _site ? new URL(_site) : void 0;
  const referenceURL = new URL(filePathname, `http://localhost`);
  const projectRoot = new URL(projectRootStr);
  return {
    site,
    generator: `Astro v${ASTRO_VERSION}`,
    fetchContent: createDeprecatedFetchContentFn(),
    glob: createAstroGlobFn(),
    resolve(...segments) {
      let resolved = segments.reduce((u, segment) => new URL(segment, u), referenceURL).pathname;
      if (resolved.startsWith(projectRoot.pathname)) {
        resolved = "/" + resolved.slice(projectRoot.pathname.length);
      }
      return resolved;
    }
  };
}

const escapeHTML = escape;
class HTMLString extends String {
}
const markHTMLString = (value) => {
  if (value instanceof HTMLString) {
    return value;
  }
  if (typeof value === "string") {
    return new HTMLString(value);
  }
  return value;
};
function unescapeHTML(str) {
  if (!!str && typeof str === "object" && typeof str.then === "function") {
    return Promise.resolve(str).then((value) => {
      return markHTMLString(value);
    });
  }
  return markHTMLString(str);
}

class Metadata {
  constructor(filePathname, opts) {
    this.modules = opts.modules;
    this.hoisted = opts.hoisted;
    this.hydratedComponents = opts.hydratedComponents;
    this.clientOnlyComponents = opts.clientOnlyComponents;
    this.hydrationDirectives = opts.hydrationDirectives;
    this.mockURL = new URL(filePathname, "http://example.com");
    this.metadataCache = /* @__PURE__ */ new Map();
  }
  resolvePath(specifier) {
    if (specifier.startsWith(".")) {
      const resolved = new URL(specifier, this.mockURL).pathname;
      if (resolved.startsWith("/@fs") && resolved.endsWith(".jsx")) {
        return resolved.slice(0, resolved.length - 4);
      }
      return resolved;
    }
    return specifier;
  }
  getPath(Component) {
    const metadata = this.getComponentMetadata(Component);
    return (metadata == null ? void 0 : metadata.componentUrl) || null;
  }
  getExport(Component) {
    const metadata = this.getComponentMetadata(Component);
    return (metadata == null ? void 0 : metadata.componentExport) || null;
  }
  getComponentMetadata(Component) {
    if (this.metadataCache.has(Component)) {
      return this.metadataCache.get(Component);
    }
    const metadata = this.findComponentMetadata(Component);
    this.metadataCache.set(Component, metadata);
    return metadata;
  }
  findComponentMetadata(Component) {
    const isCustomElement = typeof Component === "string";
    for (const { module, specifier } of this.modules) {
      const id = this.resolvePath(specifier);
      for (const [key, value] of Object.entries(module)) {
        if (isCustomElement) {
          if (key === "tagName" && Component === value) {
            return {
              componentExport: key,
              componentUrl: id
            };
          }
        } else if (Component === value) {
          return {
            componentExport: key,
            componentUrl: id
          };
        }
      }
    }
    return null;
  }
}
function createMetadata(filePathname, options) {
  return new Metadata(filePathname, options);
}

const PROP_TYPE = {
  Value: 0,
  JSON: 1,
  RegExp: 2,
  Date: 3,
  Map: 4,
  Set: 5,
  BigInt: 6,
  URL: 7
};
function serializeArray(value, metadata = {}, parents = /* @__PURE__ */ new WeakSet()) {
  if (parents.has(value)) {
    throw new Error(`Cyclic reference detected while serializing props for <${metadata.displayName} client:${metadata.hydrate}>!

Cyclic references cannot be safely serialized for client-side usage. Please remove the cyclic reference.`);
  }
  parents.add(value);
  const serialized = value.map((v) => {
    return convertToSerializedForm(v, metadata, parents);
  });
  parents.delete(value);
  return serialized;
}
function serializeObject(value, metadata = {}, parents = /* @__PURE__ */ new WeakSet()) {
  if (parents.has(value)) {
    throw new Error(`Cyclic reference detected while serializing props for <${metadata.displayName} client:${metadata.hydrate}>!

Cyclic references cannot be safely serialized for client-side usage. Please remove the cyclic reference.`);
  }
  parents.add(value);
  const serialized = Object.fromEntries(
    Object.entries(value).map(([k, v]) => {
      return [k, convertToSerializedForm(v, metadata, parents)];
    })
  );
  parents.delete(value);
  return serialized;
}
function convertToSerializedForm(value, metadata = {}, parents = /* @__PURE__ */ new WeakSet()) {
  const tag = Object.prototype.toString.call(value);
  switch (tag) {
    case "[object Date]": {
      return [PROP_TYPE.Date, value.toISOString()];
    }
    case "[object RegExp]": {
      return [PROP_TYPE.RegExp, value.source];
    }
    case "[object Map]": {
      return [
        PROP_TYPE.Map,
        JSON.stringify(serializeArray(Array.from(value), metadata, parents))
      ];
    }
    case "[object Set]": {
      return [
        PROP_TYPE.Set,
        JSON.stringify(serializeArray(Array.from(value), metadata, parents))
      ];
    }
    case "[object BigInt]": {
      return [PROP_TYPE.BigInt, value.toString()];
    }
    case "[object URL]": {
      return [PROP_TYPE.URL, value.toString()];
    }
    case "[object Array]": {
      return [PROP_TYPE.JSON, JSON.stringify(serializeArray(value, metadata, parents))];
    }
    default: {
      if (value !== null && typeof value === "object") {
        return [PROP_TYPE.Value, serializeObject(value, metadata, parents)];
      } else {
        return [PROP_TYPE.Value, value];
      }
    }
  }
}
function serializeProps(props, metadata) {
  const serialized = JSON.stringify(serializeObject(props, metadata));
  return serialized;
}

function serializeListValue(value) {
  const hash = {};
  push(value);
  return Object.keys(hash).join(" ");
  function push(item) {
    if (item && typeof item.forEach === "function")
      item.forEach(push);
    else if (item === Object(item))
      Object.keys(item).forEach((name) => {
        if (item[name])
          push(name);
      });
    else {
      item = item === false || item == null ? "" : String(item).trim();
      if (item) {
        item.split(/\s+/).forEach((name) => {
          hash[name] = true;
        });
      }
    }
  }
}

const HydrationDirectivesRaw = ["load", "idle", "media", "visible", "only"];
const HydrationDirectives = new Set(HydrationDirectivesRaw);
const HydrationDirectiveProps = new Set(HydrationDirectivesRaw.map((n) => `client:${n}`));
function extractDirectives(inputProps) {
  let extracted = {
    isPage: false,
    hydration: null,
    props: {}
  };
  for (const [key, value] of Object.entries(inputProps)) {
    if (key.startsWith("server:")) {
      if (key === "server:root") {
        extracted.isPage = true;
      }
    }
    if (key.startsWith("client:")) {
      if (!extracted.hydration) {
        extracted.hydration = {
          directive: "",
          value: "",
          componentUrl: "",
          componentExport: { value: "" }
        };
      }
      switch (key) {
        case "client:component-path": {
          extracted.hydration.componentUrl = value;
          break;
        }
        case "client:component-export": {
          extracted.hydration.componentExport.value = value;
          break;
        }
        case "client:component-hydration": {
          break;
        }
        case "client:display-name": {
          break;
        }
        default: {
          extracted.hydration.directive = key.split(":")[1];
          extracted.hydration.value = value;
          if (!HydrationDirectives.has(extracted.hydration.directive)) {
            throw new Error(
              `Error: invalid hydration directive "${key}". Supported hydration methods: ${Array.from(
                HydrationDirectiveProps
              ).join(", ")}`
            );
          }
          if (extracted.hydration.directive === "media" && typeof extracted.hydration.value !== "string") {
            throw new Error(
              'Error: Media query must be provided for "client:media", similar to client:media="(max-width: 600px)"'
            );
          }
          break;
        }
      }
    } else if (key === "class:list") {
      extracted.props[key.slice(0, -5)] = serializeListValue(value);
    } else {
      extracted.props[key] = value;
    }
  }
  return extracted;
}
async function generateHydrateScript(scriptOptions, metadata) {
  const { renderer, result, astroId, props, attrs } = scriptOptions;
  const { hydrate, componentUrl, componentExport } = metadata;
  if (!componentExport.value) {
    throw new Error(
      `Unable to resolve a valid export for "${metadata.displayName}"! Please open an issue at https://astro.build/issues!`
    );
  }
  const island = {
    children: "",
    props: {
      uid: astroId
    }
  };
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      island.props[key] = value;
    }
  }
  island.props["component-url"] = await result.resolve(decodeURI(componentUrl));
  if (renderer.clientEntrypoint) {
    island.props["component-export"] = componentExport.value;
    island.props["renderer-url"] = await result.resolve(decodeURI(renderer.clientEntrypoint));
    island.props["props"] = escapeHTML(serializeProps(props, metadata));
  }
  island.props["ssr"] = "";
  island.props["client"] = hydrate;
  let beforeHydrationUrl = await result.resolve("astro:scripts/before-hydration.js");
  if (beforeHydrationUrl.length) {
    island.props["before-hydration-url"] = beforeHydrationUrl;
  }
  island.props["opts"] = escapeHTML(
    JSON.stringify({
      name: metadata.displayName,
      value: metadata.hydrateArgs || ""
    })
  );
  return island;
}

var idle_prebuilt_default = `(self.Astro=self.Astro||{}).idle=t=>{const e=async()=>{await(await t())()};"requestIdleCallback"in window?window.requestIdleCallback(e):setTimeout(e,200)},window.dispatchEvent(new Event("astro:idle"));`;

var load_prebuilt_default = `(self.Astro=self.Astro||{}).load=a=>{(async()=>await(await a())())()},window.dispatchEvent(new Event("astro:load"));`;

var media_prebuilt_default = `(self.Astro=self.Astro||{}).media=(s,a)=>{const t=async()=>{await(await s())()};if(a.value){const e=matchMedia(a.value);e.matches?t():e.addEventListener("change",t,{once:!0})}},window.dispatchEvent(new Event("astro:media"));`;

var only_prebuilt_default = `(self.Astro=self.Astro||{}).only=t=>{(async()=>await(await t())())()},window.dispatchEvent(new Event("astro:only"));`;

var visible_prebuilt_default = `(self.Astro=self.Astro||{}).visible=(s,c,n)=>{const r=async()=>{await(await s())()};let i=new IntersectionObserver(e=>{for(const t of e)if(!!t.isIntersecting){i.disconnect(),r();break}});for(let e=0;e<n.children.length;e++){const t=n.children[e];i.observe(t)}},window.dispatchEvent(new Event("astro:visible"));`;

var astro_island_prebuilt_default = `var l;{const c={0:t=>t,1:t=>JSON.parse(t,o),2:t=>new RegExp(t),3:t=>new Date(t),4:t=>new Map(JSON.parse(t,o)),5:t=>new Set(JSON.parse(t,o)),6:t=>BigInt(t),7:t=>new URL(t)},o=(t,s)=>{if(t===""||!Array.isArray(s))return s;const[e,n]=s;return e in c?c[e](n):void 0};customElements.get("astro-island")||customElements.define("astro-island",(l=class extends HTMLElement{constructor(){super(...arguments);this.hydrate=()=>{if(!this.hydrator||this.parentElement&&this.parentElement.closest("astro-island[ssr]"))return;const s=this.querySelectorAll("astro-slot"),e={},n=this.querySelectorAll("template[data-astro-template]");for(const r of n){const i=r.closest(this.tagName);!i||!i.isSameNode(this)||(e[r.getAttribute("data-astro-template")||"default"]=r.innerHTML,r.remove())}for(const r of s){const i=r.closest(this.tagName);!i||!i.isSameNode(this)||(e[r.getAttribute("name")||"default"]=r.innerHTML)}const a=this.hasAttribute("props")?JSON.parse(this.getAttribute("props"),o):{};this.hydrator(this)(this.Component,a,e,{client:this.getAttribute("client")}),this.removeAttribute("ssr"),window.removeEventListener("astro:hydrate",this.hydrate),window.dispatchEvent(new CustomEvent("astro:hydrate"))}}connectedCallback(){!this.hasAttribute("await-children")||this.firstChild?this.childrenConnectedCallback():new MutationObserver((s,e)=>{e.disconnect(),this.childrenConnectedCallback()}).observe(this,{childList:!0})}async childrenConnectedCallback(){window.addEventListener("astro:hydrate",this.hydrate);let s=this.getAttribute("before-hydration-url");s&&await import(s),this.start()}start(){const s=JSON.parse(this.getAttribute("opts")),e=this.getAttribute("client");if(Astro[e]===void 0){window.addEventListener(\`astro:\${e}\`,()=>this.start(),{once:!0});return}Astro[e](async()=>{const n=this.getAttribute("renderer-url"),[a,{default:r}]=await Promise.all([import(this.getAttribute("component-url")),n?import(n):()=>()=>{}]),i=this.getAttribute("component-export")||"default";if(!i.includes("."))this.Component=a[i];else{this.Component=a;for(const d of i.split("."))this.Component=this.Component[d]}return this.hydrator=r,this.hydrate},s,this)}attributeChangedCallback(){this.hydrator&&this.hydrate()}},l.observedAttributes=["props"],l))}`;

function determineIfNeedsHydrationScript(result) {
  if (result._metadata.hasHydrationScript) {
    return false;
  }
  return result._metadata.hasHydrationScript = true;
}
const hydrationScripts = {
  idle: idle_prebuilt_default,
  load: load_prebuilt_default,
  only: only_prebuilt_default,
  media: media_prebuilt_default,
  visible: visible_prebuilt_default
};
function determinesIfNeedsDirectiveScript(result, directive) {
  if (result._metadata.hasDirectives.has(directive)) {
    return false;
  }
  result._metadata.hasDirectives.add(directive);
  return true;
}
function getDirectiveScriptText(directive) {
  if (!(directive in hydrationScripts)) {
    throw new Error(`Unknown directive: ${directive}`);
  }
  const directiveScriptText = hydrationScripts[directive];
  return directiveScriptText;
}
function getPrescripts(type, directive) {
  switch (type) {
    case "both":
      return `<style>astro-island,astro-slot{display:contents}</style><script>${getDirectiveScriptText(directive) + astro_island_prebuilt_default}<\/script>`;
    case "directive":
      return `<script>${getDirectiveScriptText(directive)}<\/script>`;
  }
  return "";
}

const Fragment = Symbol.for("astro:fragment");
const Renderer = Symbol.for("astro:renderer");
function stringifyChunk(result, chunk) {
  switch (chunk.type) {
    case "directive": {
      const { hydration } = chunk;
      let needsHydrationScript = hydration && determineIfNeedsHydrationScript(result);
      let needsDirectiveScript = hydration && determinesIfNeedsDirectiveScript(result, hydration.directive);
      let prescriptType = needsHydrationScript ? "both" : needsDirectiveScript ? "directive" : null;
      if (prescriptType) {
        let prescripts = getPrescripts(prescriptType, hydration.directive);
        return markHTMLString(prescripts);
      } else {
        return "";
      }
    }
    default: {
      return chunk.toString();
    }
  }
}

function validateComponentProps(props, displayName) {
  var _a;
  if (((_a = {"BASE_URL":"/","MODE":"production","DEV":false,"PROD":true}) == null ? void 0 : _a.DEV) && props != null) {
    for (const prop of Object.keys(props)) {
      if (HydrationDirectiveProps.has(prop)) {
        console.warn(
          `You are attempting to render <${displayName} ${prop} />, but ${displayName} is an Astro component. Astro components do not render in the client and should not have a hydration directive. Please use a framework component for client rendering.`
        );
      }
    }
  }
}
class AstroComponent {
  constructor(htmlParts, expressions) {
    this.htmlParts = htmlParts;
    this.expressions = expressions;
  }
  get [Symbol.toStringTag]() {
    return "AstroComponent";
  }
  async *[Symbol.asyncIterator]() {
    const { htmlParts, expressions } = this;
    for (let i = 0; i < htmlParts.length; i++) {
      const html = htmlParts[i];
      const expression = expressions[i];
      yield markHTMLString(html);
      yield* renderChild(expression);
    }
  }
}
function isAstroComponent(obj) {
  return typeof obj === "object" && Object.prototype.toString.call(obj) === "[object AstroComponent]";
}
function isAstroComponentFactory(obj) {
  return obj == null ? false : !!obj.isAstroComponentFactory;
}
async function* renderAstroComponent(component) {
  for await (const value of component) {
    if (value || value === 0) {
      for await (const chunk of renderChild(value)) {
        switch (chunk.type) {
          case "directive": {
            yield chunk;
            break;
          }
          default: {
            yield markHTMLString(chunk);
            break;
          }
        }
      }
    }
  }
}
async function renderToString(result, componentFactory, props, children) {
  const Component = await componentFactory(result, props, children);
  if (!isAstroComponent(Component)) {
    const response = Component;
    throw response;
  }
  let html = "";
  for await (const chunk of renderAstroComponent(Component)) {
    html += stringifyChunk(result, chunk);
  }
  return html;
}
async function renderToIterable(result, componentFactory, displayName, props, children) {
  validateComponentProps(props, displayName);
  const Component = await componentFactory(result, props, children);
  if (!isAstroComponent(Component)) {
    console.warn(
      `Returning a Response is only supported inside of page components. Consider refactoring this logic into something like a function that can be used in the page.`
    );
    const response = Component;
    throw response;
  }
  return renderAstroComponent(Component);
}
async function renderTemplate(htmlParts, ...expressions) {
  return new AstroComponent(htmlParts, expressions);
}

async function* renderChild(child) {
  child = await child;
  if (child instanceof HTMLString) {
    yield child;
  } else if (Array.isArray(child)) {
    for (const value of child) {
      yield markHTMLString(await renderChild(value));
    }
  } else if (typeof child === "function") {
    yield* renderChild(child());
  } else if (typeof child === "string") {
    yield markHTMLString(escapeHTML(child));
  } else if (!child && child !== 0) ; else if (child instanceof AstroComponent || Object.prototype.toString.call(child) === "[object AstroComponent]") {
    yield* renderAstroComponent(child);
  } else if (typeof child === "object" && Symbol.asyncIterator in child) {
    yield* child;
  } else {
    yield child;
  }
}
async function renderSlot(result, slotted, fallback) {
  if (slotted) {
    let iterator = renderChild(slotted);
    let content = "";
    for await (const chunk of iterator) {
      if (chunk.type === "directive") {
        content += stringifyChunk(result, chunk);
      } else {
        content += chunk;
      }
    }
    return markHTMLString(content);
  }
  return fallback;
}

/**
 * shortdash - https://github.com/bibig/node-shorthash
 *
 * @license
 *
 * (The MIT License)
 *
 * Copyright (c) 2013 Bibig <bibig@me.com>
 *
 * Permission is hereby granted, free of charge, to any person
 * obtaining a copy of this software and associated documentation
 * files (the "Software"), to deal in the Software without
 * restriction, including without limitation the rights to use,
 * copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following
 * conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 * OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
 * OTHER DEALINGS IN THE SOFTWARE.
 */
const dictionary = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXY";
const binary = dictionary.length;
function bitwise(str) {
  let hash = 0;
  if (str.length === 0)
    return hash;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    hash = (hash << 5) - hash + ch;
    hash = hash & hash;
  }
  return hash;
}
function shorthash(text) {
  let num;
  let result = "";
  let integer = bitwise(text);
  const sign = integer < 0 ? "Z" : "";
  integer = Math.abs(integer);
  while (integer >= binary) {
    num = integer % binary;
    integer = Math.floor(integer / binary);
    result = dictionary[num] + result;
  }
  if (integer > 0) {
    result = dictionary[integer] + result;
  }
  return sign + result;
}

const voidElementNames = /^(area|base|br|col|command|embed|hr|img|input|keygen|link|meta|param|source|track|wbr)$/i;
const htmlBooleanAttributes = /^(allowfullscreen|async|autofocus|autoplay|controls|default|defer|disabled|disablepictureinpicture|disableremoteplayback|formnovalidate|hidden|loop|nomodule|novalidate|open|playsinline|readonly|required|reversed|scoped|seamless|itemscope)$/i;
const htmlEnumAttributes = /^(contenteditable|draggable|spellcheck|value)$/i;
const svgEnumAttributes = /^(autoReverse|externalResourcesRequired|focusable|preserveAlpha)$/i;
const STATIC_DIRECTIVES = /* @__PURE__ */ new Set(["set:html", "set:text"]);
const toIdent = (k) => k.trim().replace(/(?:(?<!^)\b\w|\s+|[^\w]+)/g, (match, index) => {
  if (/[^\w]|\s/.test(match))
    return "";
  return index === 0 ? match : match.toUpperCase();
});
const toAttributeString = (value, shouldEscape = true) => shouldEscape ? String(value).replace(/&/g, "&#38;").replace(/"/g, "&#34;") : value;
const kebab = (k) => k.toLowerCase() === k ? k : k.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
const toStyleString = (obj) => Object.entries(obj).map(([k, v]) => `${kebab(k)}:${v}`).join(";");
function defineScriptVars(vars) {
  let output = "";
  for (const [key, value] of Object.entries(vars)) {
    output += `let ${toIdent(key)} = ${JSON.stringify(value)};
`;
  }
  return markHTMLString(output);
}
function formatList(values) {
  if (values.length === 1) {
    return values[0];
  }
  return `${values.slice(0, -1).join(", ")} or ${values[values.length - 1]}`;
}
function addAttribute(value, key, shouldEscape = true) {
  if (value == null) {
    return "";
  }
  if (value === false) {
    if (htmlEnumAttributes.test(key) || svgEnumAttributes.test(key)) {
      return markHTMLString(` ${key}="false"`);
    }
    return "";
  }
  if (STATIC_DIRECTIVES.has(key)) {
    console.warn(`[astro] The "${key}" directive cannot be applied dynamically at runtime. It will not be rendered as an attribute.

Make sure to use the static attribute syntax (\`${key}={value}\`) instead of the dynamic spread syntax (\`{...{ "${key}": value }}\`).`);
    return "";
  }
  if (key === "class:list") {
    const listValue = toAttributeString(serializeListValue(value));
    if (listValue === "") {
      return "";
    }
    return markHTMLString(` ${key.slice(0, -5)}="${listValue}"`);
  }
  if (key === "style" && !(value instanceof HTMLString) && typeof value === "object") {
    return markHTMLString(` ${key}="${toStyleString(value)}"`);
  }
  if (key === "className") {
    return markHTMLString(` class="${toAttributeString(value, shouldEscape)}"`);
  }
  if (value === true && (key.startsWith("data-") || htmlBooleanAttributes.test(key))) {
    return markHTMLString(` ${key}`);
  } else {
    return markHTMLString(` ${key}="${toAttributeString(value, shouldEscape)}"`);
  }
}
function internalSpreadAttributes(values, shouldEscape = true) {
  let output = "";
  for (const [key, value] of Object.entries(values)) {
    output += addAttribute(value, key, shouldEscape);
  }
  return markHTMLString(output);
}
function renderElement$1(name, { props: _props, children = "" }, shouldEscape = true) {
  const { lang: _, "data-astro-id": astroId, "define:vars": defineVars, ...props } = _props;
  if (defineVars) {
    if (name === "style") {
      delete props["is:global"];
      delete props["is:scoped"];
    }
    if (name === "script") {
      delete props.hoist;
      children = defineScriptVars(defineVars) + "\n" + children;
    }
  }
  if ((children == null || children == "") && voidElementNames.test(name)) {
    return `<${name}${internalSpreadAttributes(props, shouldEscape)} />`;
  }
  return `<${name}${internalSpreadAttributes(props, shouldEscape)}>${children}</${name}>`;
}

function componentIsHTMLElement(Component) {
  return typeof HTMLElement !== "undefined" && HTMLElement.isPrototypeOf(Component);
}
async function renderHTMLElement(result, constructor, props, slots) {
  const name = getHTMLElementName(constructor);
  let attrHTML = "";
  for (const attr in props) {
    attrHTML += ` ${attr}="${toAttributeString(await props[attr])}"`;
  }
  return markHTMLString(
    `<${name}${attrHTML}>${await renderSlot(result, slots == null ? void 0 : slots.default)}</${name}>`
  );
}
function getHTMLElementName(constructor) {
  const definedName = customElements.getName(constructor);
  if (definedName)
    return definedName;
  const assignedName = constructor.name.replace(/^HTML|Element$/g, "").replace(/[A-Z]/g, "-$&").toLowerCase().replace(/^-/, "html-");
  return assignedName;
}

const rendererAliases = /* @__PURE__ */ new Map([["solid", "solid-js"]]);
function guessRenderers(componentUrl) {
  const extname = componentUrl == null ? void 0 : componentUrl.split(".").pop();
  switch (extname) {
    case "svelte":
      return ["@astrojs/svelte"];
    case "vue":
      return ["@astrojs/vue"];
    case "jsx":
    case "tsx":
      return ["@astrojs/react", "@astrojs/preact"];
    default:
      return ["@astrojs/react", "@astrojs/preact", "@astrojs/vue", "@astrojs/svelte"];
  }
}
function getComponentType(Component) {
  if (Component === Fragment) {
    return "fragment";
  }
  if (Component && typeof Component === "object" && Component["astro:html"]) {
    return "html";
  }
  if (isAstroComponentFactory(Component)) {
    return "astro-factory";
  }
  return "unknown";
}
async function renderComponent(result, displayName, Component, _props, slots = {}) {
  var _a;
  Component = await Component;
  switch (getComponentType(Component)) {
    case "fragment": {
      const children2 = await renderSlot(result, slots == null ? void 0 : slots.default);
      if (children2 == null) {
        return children2;
      }
      return markHTMLString(children2);
    }
    case "html": {
      const children2 = {};
      if (slots) {
        await Promise.all(
          Object.entries(slots).map(
            ([key, value]) => renderSlot(result, value).then((output) => {
              children2[key] = output;
            })
          )
        );
      }
      const html2 = Component.render({ slots: children2 });
      return markHTMLString(html2);
    }
    case "astro-factory": {
      async function* renderAstroComponentInline() {
        let iterable = await renderToIterable(result, Component, displayName, _props, slots);
        yield* iterable;
      }
      return renderAstroComponentInline();
    }
  }
  if (!Component && !_props["client:only"]) {
    throw new Error(
      `Unable to render ${displayName} because it is ${Component}!
Did you forget to import the component or is it possible there is a typo?`
    );
  }
  const { renderers } = result._metadata;
  const metadata = { displayName };
  const { hydration, isPage, props } = extractDirectives(_props);
  let html = "";
  let attrs = void 0;
  if (hydration) {
    metadata.hydrate = hydration.directive;
    metadata.hydrateArgs = hydration.value;
    metadata.componentExport = hydration.componentExport;
    metadata.componentUrl = hydration.componentUrl;
  }
  const probableRendererNames = guessRenderers(metadata.componentUrl);
  if (Array.isArray(renderers) && renderers.length === 0 && typeof Component !== "string" && !componentIsHTMLElement(Component)) {
    const message = `Unable to render ${metadata.displayName}!

There are no \`integrations\` set in your \`astro.config.mjs\` file.
Did you mean to add ${formatList(probableRendererNames.map((r) => "`" + r + "`"))}?`;
    throw new Error(message);
  }
  const children = {};
  if (slots) {
    await Promise.all(
      Object.entries(slots).map(
        ([key, value]) => renderSlot(result, value).then((output) => {
          children[key] = output;
        })
      )
    );
  }
  let renderer;
  if (metadata.hydrate !== "only") {
    if (Component && Component[Renderer]) {
      const rendererName = Component[Renderer];
      renderer = renderers.find(({ name }) => name === rendererName);
    }
    if (!renderer) {
      let error;
      for (const r of renderers) {
        try {
          if (await r.ssr.check.call({ result }, Component, props, children)) {
            renderer = r;
            break;
          }
        } catch (e) {
          error ?? (error = e);
        }
      }
      if (!renderer && error) {
        throw error;
      }
    }
    if (!renderer && typeof HTMLElement === "function" && componentIsHTMLElement(Component)) {
      const output = renderHTMLElement(result, Component, _props, slots);
      return output;
    }
  } else {
    if (metadata.hydrateArgs) {
      const passedName = metadata.hydrateArgs;
      const rendererName = rendererAliases.has(passedName) ? rendererAliases.get(passedName) : passedName;
      renderer = renderers.find(
        ({ name }) => name === `@astrojs/${rendererName}` || name === rendererName
      );
    }
    if (!renderer && renderers.length === 1) {
      renderer = renderers[0];
    }
    if (!renderer) {
      const extname = (_a = metadata.componentUrl) == null ? void 0 : _a.split(".").pop();
      renderer = renderers.filter(
        ({ name }) => name === `@astrojs/${extname}` || name === extname
      )[0];
    }
  }
  if (!renderer) {
    if (metadata.hydrate === "only") {
      throw new Error(`Unable to render ${metadata.displayName}!

Using the \`client:only\` hydration strategy, Astro needs a hint to use the correct renderer.
Did you mean to pass <${metadata.displayName} client:only="${probableRendererNames.map((r) => r.replace("@astrojs/", "")).join("|")}" />
`);
    } else if (typeof Component !== "string") {
      const matchingRenderers = renderers.filter((r) => probableRendererNames.includes(r.name));
      const plural = renderers.length > 1;
      if (matchingRenderers.length === 0) {
        throw new Error(`Unable to render ${metadata.displayName}!

There ${plural ? "are" : "is"} ${renderers.length} renderer${plural ? "s" : ""} configured in your \`astro.config.mjs\` file,
but ${plural ? "none were" : "it was not"} able to server-side render ${metadata.displayName}.

Did you mean to enable ${formatList(probableRendererNames.map((r) => "`" + r + "`"))}?`);
      } else if (matchingRenderers.length === 1) {
        renderer = matchingRenderers[0];
        ({ html, attrs } = await renderer.ssr.renderToStaticMarkup.call(
          { result },
          Component,
          props,
          children,
          metadata
        ));
      } else {
        throw new Error(`Unable to render ${metadata.displayName}!

This component likely uses ${formatList(probableRendererNames)},
but Astro encountered an error during server-side rendering.

Please ensure that ${metadata.displayName}:
1. Does not unconditionally access browser-specific globals like \`window\` or \`document\`.
   If this is unavoidable, use the \`client:only\` hydration directive.
2. Does not conditionally return \`null\` or \`undefined\` when rendered on the server.

If you're still stuck, please open an issue on GitHub or join us at https://astro.build/chat.`);
      }
    }
  } else {
    if (metadata.hydrate === "only") {
      html = await renderSlot(result, slots == null ? void 0 : slots.fallback);
    } else {
      ({ html, attrs } = await renderer.ssr.renderToStaticMarkup.call(
        { result },
        Component,
        props,
        children,
        metadata
      ));
    }
  }
  if (renderer && !renderer.clientEntrypoint && renderer.name !== "@astrojs/lit" && metadata.hydrate) {
    throw new Error(
      `${metadata.displayName} component has a \`client:${metadata.hydrate}\` directive, but no client entrypoint was provided by ${renderer.name}!`
    );
  }
  if (!html && typeof Component === "string") {
    const childSlots = Object.values(children).join("");
    const iterable = renderAstroComponent(
      await renderTemplate`<${Component}${internalSpreadAttributes(props)}${markHTMLString(
        childSlots === "" && voidElementNames.test(Component) ? `/>` : `>${childSlots}</${Component}>`
      )}`
    );
    html = "";
    for await (const chunk of iterable) {
      html += chunk;
    }
  }
  if (!hydration) {
    if (isPage || (renderer == null ? void 0 : renderer.name) === "astro:jsx") {
      return html;
    }
    return markHTMLString(html.replace(/\<\/?astro-slot\>/g, ""));
  }
  const astroId = shorthash(
    `<!--${metadata.componentExport.value}:${metadata.componentUrl}-->
${html}
${serializeProps(
      props,
      metadata
    )}`
  );
  const island = await generateHydrateScript(
    { renderer, result, astroId, props, attrs },
    metadata
  );
  let unrenderedSlots = [];
  if (html) {
    if (Object.keys(children).length > 0) {
      for (const key of Object.keys(children)) {
        if (!html.includes(key === "default" ? `<astro-slot>` : `<astro-slot name="${key}">`)) {
          unrenderedSlots.push(key);
        }
      }
    }
  } else {
    unrenderedSlots = Object.keys(children);
  }
  const template = unrenderedSlots.length > 0 ? unrenderedSlots.map(
    (key) => `<template data-astro-template${key !== "default" ? `="${key}"` : ""}>${children[key]}</template>`
  ).join("") : "";
  island.children = `${html ?? ""}${template}`;
  if (island.children) {
    island.props["await-children"] = "";
  }
  async function* renderAll() {
    yield { type: "directive", hydration, result };
    yield markHTMLString(renderElement$1("astro-island", island, false));
  }
  return renderAll();
}

const uniqueElements = (item, index, all) => {
  const props = JSON.stringify(item.props);
  const children = item.children;
  return index === all.findIndex((i) => JSON.stringify(i.props) === props && i.children == children);
};
const alreadyHeadRenderedResults = /* @__PURE__ */ new WeakSet();
function renderHead(result) {
  alreadyHeadRenderedResults.add(result);
  const styles = Array.from(result.styles).filter(uniqueElements).map((style) => renderElement$1("style", style));
  result.styles.clear();
  const scripts = Array.from(result.scripts).filter(uniqueElements).map((script, i) => {
    return renderElement$1("script", script, false);
  });
  const links = Array.from(result.links).filter(uniqueElements).map((link) => renderElement$1("link", link, false));
  return markHTMLString(links.join("\n") + styles.join("\n") + scripts.join("\n"));
}
async function* maybeRenderHead(result) {
  if (alreadyHeadRenderedResults.has(result)) {
    return;
  }
  yield renderHead(result);
}

typeof process === "object" && Object.prototype.toString.call(process) === "[object process]";

new TextEncoder();

function createComponent(cb) {
  cb.isAstroComponentFactory = true;
  return cb;
}
function spreadAttributes(values, _name, { class: scopedClassName } = {}) {
  let output = "";
  if (scopedClassName) {
    if (typeof values.class !== "undefined") {
      values.class += ` ${scopedClassName}`;
    } else if (typeof values["class:list"] !== "undefined") {
      values["class:list"] = [values["class:list"], scopedClassName];
    } else {
      values.class = scopedClassName;
    }
  }
  for (const [key, value] of Object.entries(values)) {
    output += addAttribute(value, key, true);
  }
  return markHTMLString(output);
}

const AstroJSX = "astro:jsx";
const Empty = Symbol("empty");
const toSlotName = (str) => str.trim().replace(/[-_]([a-z])/g, (_, w) => w.toUpperCase());
function isVNode(vnode) {
  return vnode && typeof vnode === "object" && vnode[AstroJSX];
}
function transformSlots(vnode) {
  if (typeof vnode.type === "string")
    return vnode;
  const slots = {};
  if (isVNode(vnode.props.children)) {
    const child = vnode.props.children;
    if (!isVNode(child))
      return;
    if (!("slot" in child.props))
      return;
    const name = toSlotName(child.props.slot);
    slots[name] = [child];
    slots[name]["$$slot"] = true;
    delete child.props.slot;
    delete vnode.props.children;
  }
  if (Array.isArray(vnode.props.children)) {
    vnode.props.children = vnode.props.children.map((child) => {
      if (!isVNode(child))
        return child;
      if (!("slot" in child.props))
        return child;
      const name = toSlotName(child.props.slot);
      if (Array.isArray(slots[name])) {
        slots[name].push(child);
      } else {
        slots[name] = [child];
        slots[name]["$$slot"] = true;
      }
      delete child.props.slot;
      return Empty;
    }).filter((v) => v !== Empty);
  }
  Object.assign(vnode.props, slots);
}
function markRawChildren(child) {
  if (typeof child === "string")
    return markHTMLString(child);
  if (Array.isArray(child))
    return child.map((c) => markRawChildren(c));
  return child;
}
function transformSetDirectives(vnode) {
  if (!("set:html" in vnode.props || "set:text" in vnode.props))
    return;
  if ("set:html" in vnode.props) {
    const children = markRawChildren(vnode.props["set:html"]);
    delete vnode.props["set:html"];
    Object.assign(vnode.props, { children });
    return;
  }
  if ("set:text" in vnode.props) {
    const children = vnode.props["set:text"];
    delete vnode.props["set:text"];
    Object.assign(vnode.props, { children });
    return;
  }
}
function createVNode(type, props) {
  const vnode = {
    [AstroJSX]: true,
    type,
    props: props ?? {}
  };
  transformSetDirectives(vnode);
  transformSlots(vnode);
  return vnode;
}

const ClientOnlyPlaceholder = "astro-client-only";
const skipAstroJSXCheck = /* @__PURE__ */ new WeakSet();
let originalConsoleError;
let consoleFilterRefs = 0;
async function renderJSX(result, vnode) {
  switch (true) {
    case vnode instanceof HTMLString:
      if (vnode.toString().trim() === "") {
        return "";
      }
      return vnode;
    case typeof vnode === "string":
      return markHTMLString(escapeHTML(vnode));
    case (!vnode && vnode !== 0):
      return "";
    case Array.isArray(vnode):
      return markHTMLString(
        (await Promise.all(vnode.map((v) => renderJSX(result, v)))).join("")
      );
  }
  if (isVNode(vnode)) {
    switch (true) {
      case vnode.type === Symbol.for("astro:fragment"):
        return renderJSX(result, vnode.props.children);
      case vnode.type.isAstroComponentFactory: {
        let props = {};
        let slots = {};
        for (const [key, value] of Object.entries(vnode.props ?? {})) {
          if (key === "children" || value && typeof value === "object" && value["$$slot"]) {
            slots[key === "children" ? "default" : key] = () => renderJSX(result, value);
          } else {
            props[key] = value;
          }
        }
        return markHTMLString(await renderToString(result, vnode.type, props, slots));
      }
      case (!vnode.type && vnode.type !== 0):
        return "";
      case (typeof vnode.type === "string" && vnode.type !== ClientOnlyPlaceholder):
        return markHTMLString(await renderElement(result, vnode.type, vnode.props ?? {}));
    }
    if (vnode.type) {
      let extractSlots2 = function(child) {
        if (Array.isArray(child)) {
          return child.map((c) => extractSlots2(c));
        }
        if (!isVNode(child)) {
          _slots.default.push(child);
          return;
        }
        if ("slot" in child.props) {
          _slots[child.props.slot] = [..._slots[child.props.slot] ?? [], child];
          delete child.props.slot;
          return;
        }
        _slots.default.push(child);
      };
      if (typeof vnode.type === "function" && vnode.type["astro:renderer"]) {
        skipAstroJSXCheck.add(vnode.type);
      }
      if (typeof vnode.type === "function" && vnode.props["server:root"]) {
        const output2 = await vnode.type(vnode.props ?? {});
        return await renderJSX(result, output2);
      }
      if (typeof vnode.type === "function" && !skipAstroJSXCheck.has(vnode.type)) {
        useConsoleFilter();
        try {
          const output2 = await vnode.type(vnode.props ?? {});
          if (output2 && output2[AstroJSX]) {
            return await renderJSX(result, output2);
          } else if (!output2) {
            return await renderJSX(result, output2);
          }
        } catch (e) {
          skipAstroJSXCheck.add(vnode.type);
        } finally {
          finishUsingConsoleFilter();
        }
      }
      const { children = null, ...props } = vnode.props ?? {};
      const _slots = {
        default: []
      };
      extractSlots2(children);
      for (const [key, value] of Object.entries(props)) {
        if (value["$$slot"]) {
          _slots[key] = value;
          delete props[key];
        }
      }
      const slotPromises = [];
      const slots = {};
      for (const [key, value] of Object.entries(_slots)) {
        slotPromises.push(
          renderJSX(result, value).then((output2) => {
            if (output2.toString().trim().length === 0)
              return;
            slots[key] = () => output2;
          })
        );
      }
      await Promise.all(slotPromises);
      let output;
      if (vnode.type === ClientOnlyPlaceholder && vnode.props["client:only"]) {
        output = await renderComponent(
          result,
          vnode.props["client:display-name"] ?? "",
          null,
          props,
          slots
        );
      } else {
        output = await renderComponent(
          result,
          typeof vnode.type === "function" ? vnode.type.name : vnode.type,
          vnode.type,
          props,
          slots
        );
      }
      if (typeof output !== "string" && Symbol.asyncIterator in output) {
        let body = "";
        for await (const chunk of output) {
          let html = stringifyChunk(result, chunk);
          body += html;
        }
        return markHTMLString(body);
      } else {
        return markHTMLString(output);
      }
    }
  }
  return markHTMLString(`${vnode}`);
}
async function renderElement(result, tag, { children, ...props }) {
  return markHTMLString(
    `<${tag}${spreadAttributes(props)}${markHTMLString(
      (children == null || children == "") && voidElementNames.test(tag) ? `/>` : `>${children == null ? "" : await renderJSX(result, children)}</${tag}>`
    )}`
  );
}
function useConsoleFilter() {
  consoleFilterRefs++;
  if (!originalConsoleError) {
    originalConsoleError = console.error;
    try {
      console.error = filteredConsoleError;
    } catch (error) {
    }
  }
}
function finishUsingConsoleFilter() {
  consoleFilterRefs--;
}
function filteredConsoleError(msg, ...rest) {
  if (consoleFilterRefs > 0 && typeof msg === "string") {
    const isKnownReactHookError = msg.includes("Warning: Invalid hook call.") && msg.includes("https://reactjs.org/link/invalid-hook-call");
    if (isKnownReactHookError)
      return;
  }
  originalConsoleError(msg, ...rest);
}

const slotName = (str) => str.trim().replace(/[-_]([a-z])/g, (_, w) => w.toUpperCase());
async function check(Component, props, { default: children = null, ...slotted } = {}) {
  if (typeof Component !== "function")
    return false;
  const slots = {};
  for (const [key, value] of Object.entries(slotted)) {
    const name = slotName(key);
    slots[name] = value;
  }
  try {
    const result = await Component({ ...props, ...slots, children });
    return result[AstroJSX];
  } catch (e) {
  }
  return false;
}
async function renderToStaticMarkup(Component, props = {}, { default: children = null, ...slotted } = {}) {
  const slots = {};
  for (const [key, value] of Object.entries(slotted)) {
    const name = slotName(key);
    slots[name] = value;
  }
  const { result } = this;
  const html = await renderJSX(result, createVNode(Component, { ...props, ...slots, children }));
  return { html };
}
var server_default = {
  check,
  renderToStaticMarkup
};

var __freeze = Object.freeze;
var __defProp = Object.defineProperty;
var __template = (cooked, raw) => __freeze(__defProp(cooked, "raw", { value: __freeze(raw || cooked.slice()) }));
var _a;
const $$metadata$i = createMetadata("/@fs/C:/Project/astro/jerecho/src/components/MetaHead.astro", { modules: [], hydratedComponents: [], clientOnlyComponents: [], hydrationDirectives: /* @__PURE__ */ new Set([]), hoisted: [] });
const $$Astro$j = createAstro("/@fs/C:/Project/astro/jerecho/src/components/MetaHead.astro", "https://jerecho.com/", "file:///C:/Project/astro/jerecho/");
const $$MetaHead = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$j, $$props, $$slots);
  Astro2.self = $$MetaHead;
  const {
    title = "Jech | Web Developer and designer",
    description = "My name is Jech and I'm a Freelance Web Developer and designer from the Philippines",
    canonicalURL = new URL(Astro2.url.pathname, Astro2.site)
  } = Astro2.props;
  const STYLES = [];
  for (const STYLE of STYLES)
    $$result.styles.add(STYLE);
  return renderTemplate(_a || (_a = __template(['<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width">\n<title>', '</title>\n\n<meta name="description"', '>\n\n<!-- SEO -->\n<link rel="canonical"', '>\n\n<!-- Open Graph Tags (Facebook) -->\n<meta property="og:type" content="website">\n<meta property="og:title"', '>\n<meta property="og:url" content="https://jerecho.com">\n<meta property="og:description"', '>\n<meta property="og:image" content="/assets/og-cover.png">\n\n<link rel="icon" type="image/svg+xml" href="/assets/fav.svg">\n<link rel="mask-icon" href="/assets/fav.svg" color="#16161d">\n<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n\n<link href="https://fonts.googleapis.com/css2?family=Abel&family=Roboto:wght@100&family=Rubik+Glitch&family=Roboto+Mono:wght@100;400&display=swap" rel="stylesheet">\n\n<!-- Google Tag Manager -->\n<script>\n  (function (w, d, s, l, i) {\n    w[l] = w[l] || [];\n    w[l].push({ "gtm.start": new Date().getTime(), event: "gtm.js" });\n    var f = d.getElementsByTagName(s)[0],\n      j = d.createElement(s),\n      dl = l != "dataLayer" ? "&l=" + l : "";\n    j.async = true;\n    j.src = "https://www.googletagmanager.com/gtm.js?id=" + i + dl;\n    f.parentNode.insertBefore(j, f);\n  })(window, document, "script", "dataLayer", "GTM-TV8NVWT");\n<\/script>\n<!-- End Google Tag Manager -->\n'])), title, addAttribute(description, "content"), addAttribute(canonicalURL, "href"), addAttribute(title, "content"), addAttribute(description, "content"));
});

const $$file$i = "C:/Project/astro/jerecho/src/components/MetaHead.astro";
const $$url$i = undefined;

const $$module2$3 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  $$metadata: $$metadata$i,
  default: $$MetaHead,
  file: $$file$i,
  url: $$url$i
}, Symbol.toStringTag, { value: 'Module' }));

const $$metadata$h = createMetadata("/@fs/C:/Project/astro/jerecho/src/components/Nav.astro", { modules: [], hydratedComponents: [], clientOnlyComponents: [], hydrationDirectives: /* @__PURE__ */ new Set([]), hoisted: [] });
const $$Astro$i = createAstro("/@fs/C:/Project/astro/jerecho/src/components/Nav.astro", "https://jerecho.com/", "file:///C:/Project/astro/jerecho/");
const $$Nav = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$i, $$props, $$slots);
  Astro2.self = $$Nav;
  const STYLES = [];
  for (const STYLE of STYLES)
    $$result.styles.add(STYLE);
  return renderTemplate`${maybeRenderHead($$result)}<nav class="navigation astro-LTGA53L3">
  <a class="link animTrigger astro-LTGA53L3" href="/" title="Hi">
    <div class="logo astro-LTGA53L3">
      <svg width="32" height="50" viewBox="0 0 32 50" fill="none" xmlns="http://www.w3.org/2000/svg" class="astro-LTGA53L3">
        <path fill-rule="evenodd" clip-rule="evenodd" d="M24.5797 5.7971C24.5797 5.87476 24.5782 5.95205 24.5751 6.02897H24.5797V43.3623V43.5942H24.5751C24.4534 46.6884 21.9066 49.1594 18.7826 49.1594C15.6586 49.1594 13.1117 46.6884 12.99 43.5942H12.9855V43.3623V6.02897H12.99C12.987 5.95205 12.9855 5.87476 12.9855 5.7971C12.9855 2.59545 15.5809 0 18.7826 0C21.9842 0 24.5797 2.59545 24.5797 5.7971ZM30.302 7.26316C29.2149 6.17599 27.7404 5.56523 26.2029 5.56523V11.3623L26.2029 17.1594C27.7404 17.1594 29.2149 16.5487 30.302 15.4615C31.3892 14.3743 32 12.8998 32 11.3623C32 9.82484 31.3892 8.35033 30.302 7.26316ZM11.5897 30.1449C11.5927 30.068 11.5942 29.9907 11.5942 29.9131C11.5942 26.7114 8.99875 24.116 5.7971 24.116C2.59545 24.116 0 26.7114 0 29.9131C0 29.9907 0.00152685 30.068 0.00455217 30.1449H0V37.1015H0.0413096C0.0140335 37.3295 0 37.5617 0 37.7971C0 40.9988 2.59545 43.5942 5.7971 43.5942C8.99875 43.5942 11.5942 40.9988 11.5942 37.7971C11.5942 37.5617 11.5802 37.3295 11.5529 37.1015H11.5942V30.1449H11.5897Z" fill="url(#paint0_linear_952_12)" class="astro-LTGA53L3"></path>
        <defs class="astro-LTGA53L3">
          <linearGradient id="paint0_linear_952_12" x1="27.2" y1="-1.06667" x2="1.6" y2="49.0667" gradientUnits="userSpaceOnUse" class="astro-LTGA53L3">
            <stop stop-color="white" class="astro-LTGA53L3"></stop>
            <stop offset="1" stop-color="white" class="astro-LTGA53L3"></stop>
          </linearGradient>
        </defs>
      </svg>
    </div>
  </a>
  <a href="mailto:subs373n@gmail.com?subject=Hi" class="astro-LTGA53L3">Contact</a>
</nav>

`;
});

const $$file$h = "C:/Project/astro/jerecho/src/components/Nav.astro";
const $$url$h = undefined;

const $$module1$8 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  $$metadata: $$metadata$h,
  default: $$Nav,
  file: $$file$h,
  url: $$url$h
}, Symbol.toStringTag, { value: 'Module' }));

const $$metadata$g = createMetadata("/@fs/C:/Project/astro/jerecho/src/components/Header.astro", { modules: [{ module: $$module1$8, specifier: "./Nav.astro", assert: {} }], hydratedComponents: [], clientOnlyComponents: [], hydrationDirectives: /* @__PURE__ */ new Set([]), hoisted: [] });
const $$Astro$h = createAstro("/@fs/C:/Project/astro/jerecho/src/components/Header.astro", "https://jerecho.com/", "file:///C:/Project/astro/jerecho/");
const $$Header = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$h, $$props, $$slots);
  Astro2.self = $$Header;
  const STYLES = [];
  for (const STYLE of STYLES)
    $$result.styles.add(STYLE);
  return renderTemplate`${maybeRenderHead($$result)}<header class="astro-E463ZOFQ">
  ${renderComponent($$result, "Nav", $$Nav, { "class": "astro-E463ZOFQ" })}
</header>

`;
});

const $$file$g = "C:/Project/astro/jerecho/src/components/Header.astro";
const $$url$g = undefined;

const $$module1$7 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  $$metadata: $$metadata$g,
  default: $$Header,
  file: $$file$g,
  url: $$url$g
}, Symbol.toStringTag, { value: 'Module' }));

const $$metadata$f = createMetadata("/@fs/C:/Project/astro/jerecho/src/components/Footer.astro", { modules: [], hydratedComponents: [], clientOnlyComponents: [], hydrationDirectives: /* @__PURE__ */ new Set([]), hoisted: [] });
const $$Astro$g = createAstro("/@fs/C:/Project/astro/jerecho/src/components/Footer.astro", "https://jerecho.com/", "file:///C:/Project/astro/jerecho/");
const $$Footer = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$g, $$props, $$slots);
  Astro2.self = $$Footer;
  const STYLES = [];
  for (const STYLE of STYLES)
    $$result.styles.add(STYLE);
  return renderTemplate`${maybeRenderHead($$result)}<footer class="astro-QEDG3PI7">
  <small class="astro-QEDG3PI7">Design and develop by Jech</small>
</footer>

`;
});

const $$file$f = "C:/Project/astro/jerecho/src/components/Footer.astro";
const $$url$f = undefined;

const $$module3$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  $$metadata: $$metadata$f,
  default: $$Footer,
  file: $$file$f,
  url: $$url$f
}, Symbol.toStringTag, { value: 'Module' }));

const $$metadata$e = createMetadata("/@fs/C:/Project/astro/jerecho/src/layouts/Splash.astro", { modules: [{ module: $$module2$3, specifier: "../components/MetaHead.astro", assert: {} }, { module: $$module1$7, specifier: "../components/Header.astro", assert: {} }, { module: $$module3$1, specifier: "../components/Footer.astro", assert: {} }], hydratedComponents: [], clientOnlyComponents: [], hydrationDirectives: /* @__PURE__ */ new Set([]), hoisted: [] });
const $$Astro$f = createAstro("/@fs/C:/Project/astro/jerecho/src/layouts/Splash.astro", "https://jerecho.com/", "file:///C:/Project/astro/jerecho/");
const $$Splash = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$f, $$props, $$slots);
  Astro2.self = $$Splash;
  return renderTemplate`<html lang="en">
  <head>
    ${renderComponent($$result, "MetaHead", $$MetaHead, { "title": "Jech | Web Developer and designer", "description": "My name is Jech and I'm a Freelance Web Developer and designer from the Philippines" })}
    <style>
      .container-grid {
        grid-template-areas:
          "header"
          "content"
          "footer";
        grid-template-columns: 1fr;
        grid-template-rows: 10vh 60vh calc(30vh - 4rem);
      }
      @media (min-width: 1000px) {
        .container-grid {
          display: grid;
        }
      }
    </style>
  ${renderHead($$result)}</head>
  <body>
    <div class="container-grid">
      ${renderComponent($$result, "Header", $$Header, {})}
      ${renderSlot($$result, $$slots["default"])}
      ${renderComponent($$result, "Footer", $$Footer, {})}
    </div>
  </body></html>`;
});

const $$file$e = "C:/Project/astro/jerecho/src/layouts/Splash.astro";
const $$url$e = undefined;

const $$module1$6 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  $$metadata: $$metadata$e,
  default: $$Splash,
  file: $$file$e,
  url: $$url$e
}, Symbol.toStringTag, { value: 'Module' }));

const html$8 = "";

				const frontmatter$8 = {"title":"Hi, my name is","name":"Jech","slogan":"Web Developer","description":"I’m a seasoned web developer with agile methodology background and over 10 years industry experience."};
				const file$8 = "C:/Project/astro/jerecho/src/pages/home/intro.md";
				const url$8 = "/home/intro";
				function rawContent$8() {
					return "";
				}
				function compiledContent$8() {
					return html$8;
				}
				function getHeadings$8() {
					return [];
				}
				function getHeaders$8() {
					console.warn('getHeaders() have been deprecated. Use getHeadings() function instead.');
					return getHeadings$8();
				}				async function Content$8() {
					const { layout, ...content } = frontmatter$8;
					content.file = file$8;
					content.url = url$8;
					content.astro = {};
					Object.defineProperty(content.astro, 'headings', {
						get() {
							throw new Error('The "astro" property is no longer supported! To access "headings" from your layout, try using "Astro.props.headings."')
						}
					});
					Object.defineProperty(content.astro, 'html', {
						get() {
							throw new Error('The "astro" property is no longer supported! To access "html" from your layout, try using "Astro.props.compiledContent()."')
						}
					});
					Object.defineProperty(content.astro, 'source', {
						get() {
							throw new Error('The "astro" property is no longer supported! To access "source" from your layout, try using "Astro.props.rawContent()."')
						}
					});
					const contentFragment = createVNode(Fragment, { 'set:html': html$8 });
					return contentFragment;
				}
				Content$8[Symbol.for('astro.needsHeadRendering')] = true;

const _page1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  frontmatter: frontmatter$8,
  file: file$8,
  url: url$8,
  rawContent: rawContent$8,
  compiledContent: compiledContent$8,
  getHeadings: getHeadings$8,
  getHeaders: getHeaders$8,
  Content: Content$8,
  default: Content$8
}, Symbol.toStringTag, { value: 'Module' }));

const $$metadata$d = createMetadata("/@fs/C:/Project/astro/jerecho/src/components/Link.astro", { modules: [], hydratedComponents: [], clientOnlyComponents: [], hydrationDirectives: /* @__PURE__ */ new Set([]), hoisted: [] });
const $$Astro$e = createAstro("/@fs/C:/Project/astro/jerecho/src/components/Link.astro", "https://jerecho.com/", "file:///C:/Project/astro/jerecho/");
const $$Link = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$e, $$props, $$slots);
  Astro2.self = $$Link;
  const { text, className, url, title, hasIcon } = Astro2.props;
  const STYLES = [];
  for (const STYLE of STYLES)
    $$result.styles.add(STYLE);
  return renderTemplate`${maybeRenderHead($$result)}<a${addAttribute(url || "/", "href")}${addAttribute((className ? className + " flex" : "") + " astro-EFI5C4MJ", "class")}${addAttribute(title, "title")}>${text}
  ${renderTemplate`${renderComponent($$result, "Fragment", Fragment, {}, { "default": () => renderTemplate`${unescapeHTML(hasIcon ? hasIcon : "")}` })}`}
</a>

`;
});

const $$file$d = "C:/Project/astro/jerecho/src/components/Link.astro";
const $$url$d = undefined;

const $$module1$5 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  $$metadata: $$metadata$d,
  default: $$Link,
  file: $$file$d,
  url: $$url$d
}, Symbol.toStringTag, { value: 'Module' }));

const $$metadata$c = createMetadata("/@fs/C:/Project/astro/jerecho/src/components/SocialList.astro", { modules: [], hydratedComponents: [], clientOnlyComponents: [], hydrationDirectives: /* @__PURE__ */ new Set([]), hoisted: [] });
const $$Astro$d = createAstro("/@fs/C:/Project/astro/jerecho/src/components/SocialList.astro", "https://jerecho.com/", "file:///C:/Project/astro/jerecho/");
const $$SocialList = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$d, $$props, $$slots);
  Astro2.self = $$SocialList;
  const { title, url, classes, svg, target } = Astro2.props;
  const svgHover = `<path d="M19.6962 9.7904C17.8868 9.7904 10.1157 14.858 7.94052 20.3562C7.32025 23.1401 6.6786 24.8467 6.6786 27.7423C6.6786 28.9962 7.3682 31.0058 7.94052 32.1475C8.64 33.5428 9.17694 35.089 10.1157 36.3374C11.6672 38.4007 13.9604 40.3166 16.2426 41.4546C22.1509 44.4011 28.0788 44.7771 34.7229 42.6471C38.0373 41.5845 40.8297 40.2029 43.1412 37.5132C45.0312 35.314 48.3881 30.6767 48.3881 27.7423C48.3881 24.7074 48.8198 23.5621 48.8198 20.3562C48.8198 18.7295 49.4365 15.1587 48.3881 13.9637C48.193 13.7413 47.7314 12.6233 47.6409 12.3076C47.4516 11.6467 46.7287 11.2692 46.3624 10.6847C45.7221 9.66293 44.5815 8.79901 43.9714 7.70374C43.4543 6.77539 41.8747 5.27744 40.9163 5.00433C38.4497 4.30143 36.3159 1.8936 33.5773 1.74185C31.7417 1.64014 30.0382 1.14566 28.1975 1.14566C27.0419 1.14566 24.8757 0.734031 23.8639 1.29471C22.7188 1.92922 20.9362 1.40506 19.6962 1.75841C18.4133 2.12402 16.6258 2.13505 15.3459 2.70238C10.449 4.87311 5.66679 6.99763 1 9.7904" stroke="#8D8D8D" stroke-width="2" stroke-linecap="round"/>`;
  const STYLES = [];
  for (const STYLE of STYLES)
    $$result.styles.add(STYLE);
  return renderTemplate`${maybeRenderHead($$result)}<a${addAttribute(url || "/", "href")}${addAttribute(title, "title")}${addAttribute(target, "target")}${addAttribute(classes + " astro-ESVPYYQ6", "class")}>
  <svg width="50" height="45" viewBox="0 0 50 45" fill="none" xmlns="http://www.w3.org/2000/svg" class="svgHover astro-ESVPYYQ6">${renderComponent($$result, "Fragment", Fragment, {}, { "default": () => renderTemplate`${unescapeHTML(svgHover)}` })}
  </svg>
  ${renderComponent($$result, "Fragment", Fragment, {}, { "default": () => renderTemplate`${unescapeHTML(svg)}` })}
</a>

`;
});

const $$file$c = "C:/Project/astro/jerecho/src/components/SocialList.astro";
const $$url$c = undefined;

const $$module1$4 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  $$metadata: $$metadata$c,
  default: $$SocialList,
  file: $$file$c,
  url: $$url$c
}, Symbol.toStringTag, { value: 'Module' }));

const $$metadata$b = createMetadata("/@fs/C:/Project/astro/jerecho/src/components/SocialMedia.astro", { modules: [{ module: $$module1$4, specifier: "./SocialList.astro", assert: {} }], hydratedComponents: [], clientOnlyComponents: [], hydrationDirectives: /* @__PURE__ */ new Set([]), hoisted: [] });
const $$Astro$c = createAstro("/@fs/C:/Project/astro/jerecho/src/components/SocialMedia.astro", "https://jerecho.com/", "file:///C:/Project/astro/jerecho/");
const $$SocialMedia = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$c, $$props, $$slots);
  Astro2.self = $$SocialMedia;
  const socialMedia = [
    {
      classes: "link-codepen",
      title: "devUI codepen",
      url: "https://codepen.io/co0kie",
      src: "../assets/codepen.svg",
      svg: `<svg class="svgIcon" width="22" height="24" viewBox="0 0 22 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M13 1V6.5" stroke="white" stroke-opacity="0.5" stroke-linecap="round"/>
<path d="M12.25 7.25C11.5245 7.34069 10.1026 8.5085 9.55553 9.05556C8.92624 9.68484 7.93055 9.93053 7.30553 10.5556C6.71587 11.1452 5.39444 11.1344 4.69442 11.6944C4.48276 11.8638 3.51255 12.2191 3.24998 12.25C2.78246 12.305 2.39055 12.8706 1.88887 13.0139C0.379641 13.4451 2.55953 14.4516 2.88887 14.875C3.46452 15.6151 4.23483 16.9879 4.87498 17.5C5.9317 18.3454 6.64588 19.3074 7.49998 20.375C8.12243 21.1531 9.49982 21.0338 10.1944 21.8056C10.5743 22.2276 10.8534 22.8428 11.3055 23.1944C11.4205 23.2838 12.224 22.2211 12.25 22C12.3975 20.7462 14.1313 20.7073 14.6944 19.75C15.1617 18.9557 16.4538 18.6573 17.0555 18.0556C17.3869 17.7242 17.7238 17.5709 18.0555 17.3056C18.3981 17.0315 18.992 16.4768 19.3889 16.25C22.8565 14.2685 17.528 13.2856 16.9861 11.3889C16.86 10.9476 16.1123 10.8181 16.0139 10.375C15.9114 9.91399 15.5885 9.58601 15.4861 9.125C15.3404 8.46944 14.1302 7.31511 13.5 7" stroke="white" stroke-opacity="0.5" stroke-linecap="round"/>
<path d="M12.5 1.25C13.1972 1.25 13.8378 2.07024 14.375 2.5C14.707 2.76558 15.3424 3.69905 15.75 3.75C15.9435 3.77419 17.048 4.87253 17.25 5.125C17.6846 5.66827 18.6678 5.83159 19.1944 6.30556C19.797 6.84788 20.75 6.95128 20.75 7.875C20.75 8.6236 20.5369 9.37288 20.5 10C20.4234 11.303 20.1908 13.3815 20.75 14.5" stroke="white" stroke-opacity="0.5" stroke-linecap="round"/>
<path d="M12.25 1.5C11.3321 1.5 11.1619 2.2573 10.3611 2.48611C9.73043 2.66631 9.45069 3.56766 8.86111 3.73611C8.56825 3.81979 7.20348 4.62064 7 4.875C6.70549 5.24314 5.54111 5.61325 5.11111 5.73611C4.47376 5.91821 3.63454 6.21267 3 6.25C1.92139 6.31345 1.75 6.7183 1.75 7.75C1.75 9.62407 1 11.2271 1 13" stroke="white" stroke-opacity="0.5" stroke-linecap="round"/>
<path d="M1.5 7C2.71036 7 3.37338 8.22078 4.25 9C5.04074 9.70288 5.79657 10.4355 6.55556 11.1944C7.35654 11.9954 8.26363 13.2834 9.25 13.8056C10.0132 14.2096 11.114 14.9781 11.5 15.75" stroke="white" stroke-opacity="0.5" stroke-linecap="round"/>
<path d="M20.25 7.5C20.118 8.68771 18.8041 9.30698 18.0556 10.0556C17.2253 10.8858 16.0952 11.4518 15.25 12.25C14.1808 13.2598 12.4901 14.8799 11.25 15.5" stroke="white" stroke-opacity="0.5" stroke-linecap="round"/>
<path d="M10.75 16C10.75 17.375 10.75 18.75 10.75 20.125C10.75 21.1902 11.25 21.9855 11.25 23" stroke="white" stroke-opacity="0.5" stroke-linecap="round"/>
</svg>
`,
      target: "_blank"
    },
    {
      classes: "link-youtube",
      title: "devUI youtube channel",
      url: "https://www.youtube.com/channel/UCZnuUnd4XeKxfuTPFFs9OBA",
      src: "../assets/youtube.svg",
      svg: `<svg class="svgIcon" width="24" height="20" viewBox="0 0 24 20" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M1.75 2.5C3.222 2.5 4.15787 1 5.625 1C7.22893 1 8.87614 0.750002 10.3611 0.750002C12.0324 0.750002 13.7037 0.750002 15.375 0.750002C16.5958 0.750002 19.3722 0.2777 20.25 1.375C20.5174 1.70923 21.4224 2.13854 21.8611 2.26389C22.0311 2.31247 22.9899 3.3288 23 3.5C23.0925 5.0717 23.25 6.42386 23.25 8C23.25 11.1646 23.2226 14.0823 22.25 17" stroke="white" stroke-opacity="0.5" stroke-linecap="round"/>
<path d="M1.5 2.5C1.14746 5.32029 0.75 7.96136 0.75 11C0.75 12.4713 1 14.0324 1 15.375C1 15.9421 1.66507 16.7223 1.94444 17.25C2.05507 17.459 3.24558 18.25 3.375 18.25C4.0068 18.25 4.65852 18.75 5.375 18.75C6.28812 18.75 7.47207 18.8464 8.36111 19.0556C10.4828 19.5548 12.9273 19.25 15.125 19.25C16.75 19.25 18.375 19.25 20 19.25C21.8314 19.25 22.75 19.0381 22.75 17" stroke="white" stroke-opacity="0.5" stroke-linecap="round"/>
<path d="M9.25 6C9.25 8.52373 9.75 10.8007 9.75 13.25" stroke="white" stroke-opacity="0.5" stroke-linecap="round"/>
<path d="M9 6.25C10.2368 6.25 10.9894 7.60051 11.6944 8.30556C12.1233 8.73442 13.4276 9.93266 14 10C15.9423 10.2285 12.4428 11.7458 12.0556 12.0556C11.3628 12.6098 9.95395 12.5921 9.5 13.5" stroke="white" stroke-opacity="0.5" stroke-linecap="round"/>
</svg>
`,
      target: "_blank"
    },
    {
      classes: "link-dribbble",
      title: "devui2022",
      url: "https://dribbble.com/devui2022",
      src: "../assets/dribbble.svg",
      svg: `<svg class="svgIcon" width="21" height="20" viewBox="0 0 21 20" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M8.00001 1.75001C6.51938 1.75001 2.63696 4.94624 2.2639 6.62501C2.01557 7.74251 1.25001 8.7614 1.25001 10C1.25001 11.0112 0.875949 12.9767 1.37501 13.875C2.41737 15.7513 4.18204 18.3712 6.50001 18.5C7.82698 18.5737 9.12473 19 10.5 19C11.9319 19 13.375 19.055 14.8056 19C15.9704 18.9552 17.2961 17.8151 18.0556 17.0556C19.1673 15.9438 19.5 14.9475 19.5 13.3611C19.5 12.0349 19.6562 10.7013 19.0556 9.50001C18.4487 8.28625 17.646 7.26933 17 6.1389C16.4706 5.21244 15.7535 4.51998 15.25 3.6389C14.5978 2.49759 13.8221 2.42096 12.75 1.94446C11.7581 1.50363 5.00001 0.344797 5.00001 2.00001" stroke="white" stroke-opacity="0.5" stroke-linecap="round"/>
<path d="M7.5 2C8.7355 2.15444 10.2471 4.52484 11.1111 5.38889C11.643 5.92078 11.6063 7.08503 12.125 7.5C12.5115 7.8092 13 9.17569 13 9.625C13 10.0947 13.4857 11.2804 13.6944 11.75C13.9808 12.3943 14 13.7883 14 14.5C14 15.4113 14.0535 16.3405 14 17.25C13.9602 17.9271 13.5 18.7996 13.5 19.5" stroke="white" stroke-opacity="0.5" stroke-linecap="round"/>
<path d="M1.5 9.75C2.79562 9.75 4.14158 10 5.5 10C6.86651 10 8.04664 9 9.375 9C10.2115 9 11.87 8.29443 12.625 7.875C13.1291 7.59493 13.6957 7.30189 14.25 7.05556C14.8371 6.79462 14.995 6.25249 15.5 6" stroke="white" stroke-opacity="0.5" stroke-linecap="round"/>
<path d="M6.5 18.25C6.5 15.2373 9.86983 14.6542 11.5556 13.3056C11.925 13.01 12.7774 13.0263 13.25 13C13.9217 12.9627 14.559 12.5 15.25 12.5C16.5812 12.5 17.6271 12.4386 18.75 13" stroke="white" stroke-opacity="0.5" stroke-linecap="round"/>
</svg>
`,
      target: "_blank"
    }
  ];
  const STYLES = [];
  for (const STYLE of STYLES)
    $$result.styles.add(STYLE);
  return renderTemplate`${maybeRenderHead($$result)}<div class="astro-WT4OJHEN">
  ${socialMedia.map((item) => renderTemplate`${renderComponent($$result, "SocialList", $$SocialList, { "title": item.title, "url": item.url, "src": item?.src, "classes": item.classes, "target": item.target, "svg": item.svg, "class": "astro-WT4OJHEN" })}`)}
</div>
`;
});

const $$file$b = "C:/Project/astro/jerecho/src/components/SocialMedia.astro";
const $$url$b = undefined;

const $$module3 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  $$metadata: $$metadata$b,
  default: $$SocialMedia,
  file: $$file$b,
  url: $$url$b
}, Symbol.toStringTag, { value: 'Module' }));

const $$metadata$a = createMetadata("/@fs/C:/Project/astro/jerecho/src/components/Intro.astro", { modules: [{ module: _page1, specifier: "../pages/home/intro.md", assert: {} }, { module: $$module1$5, specifier: "./Link.astro", assert: {} }, { module: $$module3, specifier: "./SocialMedia.astro", assert: {} }], hydratedComponents: [], clientOnlyComponents: [], hydrationDirectives: /* @__PURE__ */ new Set([]), hoisted: [] });
const $$Astro$b = createAstro("/@fs/C:/Project/astro/jerecho/src/components/Intro.astro", "https://jerecho.com/", "file:///C:/Project/astro/jerecho/");
const $$Intro = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$b, $$props, $$slots);
  Astro2.self = $$Intro;
  const STYLES = [];
  for (const STYLE of STYLES)
    $$result.styles.add(STYLE);
  return renderTemplate`${maybeRenderHead($$result)}<div class="splash-container swup-delay-anim astro-JMN7LE4A" style="animation-delay: var(--delay100);">
  <div class="card-splash astro-JMN7LE4A">
    <h5 style="--shade: var(--c-gray); animation-delay: var(--delay200);" class="astro-JMN7LE4A">
      ${frontmatter$8.slogan}
    </h5>
    <h1 class="swup-delay-anim astro-JMN7LE4A" style="animation-delay: var(--delay300);">
      ${frontmatter$8.title}
      <span class="astro-JMN7LE4A">${frontmatter$8.name}</span>
    </h1>
    <p class="swup-delay-anim astro-JMN7LE4A" style="animation-delay: var(--delay400);">
      ${frontmatter$8.description}
    </p>
    <div class="splash-links swup-delay-anim astro-JMN7LE4A" style="animation-delay: var(--delay500);">
      ${renderComponent($$result, "Link", $$Link, { "url": "/work", "text": "View Portfolio", "className": "cta animTrigger astro-JMN7LE4A", "title": "View Portfolio" })}
      ${renderComponent($$result, "SocialMedia", $$SocialMedia, { "class": "astro-JMN7LE4A" })}
    </div>
  </div>
</div>

`;
});

const $$file$a = "C:/Project/astro/jerecho/src/components/Intro.astro";
const $$url$a = undefined;

const $$module1$3 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  $$metadata: $$metadata$a,
  default: $$Intro,
  file: $$file$a,
  url: $$url$a
}, Symbol.toStringTag, { value: 'Module' }));

const $$metadata$9 = createMetadata("/@fs/C:/Project/astro/jerecho/src/components/Me.astro", { modules: [], hydratedComponents: [], clientOnlyComponents: [], hydrationDirectives: /* @__PURE__ */ new Set([]), hoisted: [] });
const $$Astro$a = createAstro("/@fs/C:/Project/astro/jerecho/src/components/Me.astro", "https://jerecho.com/", "file:///C:/Project/astro/jerecho/");
const $$Me = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$a, $$props, $$slots);
  Astro2.self = $$Me;
  const me = "./assets/me.svg";
  const mepng = "./assets/me.png";
  const STYLES = [];
  for (const STYLE of STYLES)
    $$result.styles.add(STYLE);
  return renderTemplate`${maybeRenderHead($$result)}<div class="me-image swup-delay-anim astro-BRJRTZQW" style="animation-delay: var(--delay400)">
  <img${addAttribute(me, "src")} alt="Me" class="me astro-BRJRTZQW" width="317">
  <img${addAttribute(mepng, "src")} alt="Jech" class="me-png astro-BRJRTZQW" width="317">
</div>

`;
});

const $$file$9 = "C:/Project/astro/jerecho/src/components/Me.astro";
const $$url$9 = undefined;

const $$module2$2 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  $$metadata: $$metadata$9,
  default: $$Me,
  file: $$file$9,
  url: $$url$9
}, Symbol.toStringTag, { value: 'Module' }));

const $$metadata$8 = createMetadata("/@fs/C:/Project/astro/jerecho/src/components/TopFold.astro", { modules: [{ module: $$module1$3, specifier: "../components/Intro.astro", assert: {} }, { module: $$module2$2, specifier: "./Me.astro", assert: {} }], hydratedComponents: [], clientOnlyComponents: [], hydrationDirectives: /* @__PURE__ */ new Set([]), hoisted: [] });
const $$Astro$9 = createAstro("/@fs/C:/Project/astro/jerecho/src/components/TopFold.astro", "https://jerecho.com/", "file:///C:/Project/astro/jerecho/");
const $$TopFold = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$9, $$props, $$slots);
  Astro2.self = $$TopFold;
  const STYLES = [];
  for (const STYLE of STYLES)
    $$result.styles.add(STYLE);
  return renderTemplate`${maybeRenderHead($$result)}<section class="top-fold astro-2SJA6AAV">
  ${renderComponent($$result, "Intro", $$Intro, { "class": "astro-2SJA6AAV" })}
  ${renderComponent($$result, "Me", $$Me, { "class": "astro-2SJA6AAV" })}
</section>

`;
});

const $$file$8 = "C:/Project/astro/jerecho/src/components/TopFold.astro";
const $$url$8 = undefined;

const $$module1$2 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  $$metadata: $$metadata$8,
  default: $$TopFold,
  file: $$file$8,
  url: $$url$8
}, Symbol.toStringTag, { value: 'Module' }));

const $$metadata$7 = createMetadata("/@fs/C:/Project/astro/jerecho/src/components/MainContainer.astro", { modules: [{ module: $$module1$2, specifier: "./TopFold.astro", assert: {} }], hydratedComponents: [], clientOnlyComponents: [], hydrationDirectives: /* @__PURE__ */ new Set([]), hoisted: [] });
const $$Astro$8 = createAstro("/@fs/C:/Project/astro/jerecho/src/components/MainContainer.astro", "https://jerecho.com/", "file:///C:/Project/astro/jerecho/");
const $$MainContainer = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$8, $$props, $$slots);
  Astro2.self = $$MainContainer;
  const STYLES = [];
  for (const STYLE of STYLES)
    $$result.styles.add(STYLE);
  return renderTemplate`${maybeRenderHead($$result)}<main class="main-container transition-fade astro-KGJIGXIL" id="swup">
  ${renderComponent($$result, "TopFold", $$TopFold, { "class": "astro-KGJIGXIL" })}
</main>

`;
});

const $$file$7 = "C:/Project/astro/jerecho/src/components/MainContainer.astro";
const $$url$7 = undefined;

const $$module2$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  $$metadata: $$metadata$7,
  default: $$MainContainer,
  file: $$file$7,
  url: $$url$7
}, Symbol.toStringTag, { value: 'Module' }));

const $$metadata$6 = createMetadata("/@fs/C:/Project/astro/jerecho/src/pages/index.astro", { modules: [{ module: $$module1$6, specifier: "../layouts/Splash.astro", assert: {} }, { module: $$module2$1, specifier: "../components/MainContainer.astro", assert: {} }], hydratedComponents: [], clientOnlyComponents: [], hydrationDirectives: /* @__PURE__ */ new Set([]), hoisted: [] });
const $$Astro$7 = createAstro("/@fs/C:/Project/astro/jerecho/src/pages/index.astro", "https://jerecho.com/", "file:///C:/Project/astro/jerecho/");
const $$Index = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$7, $$props, $$slots);
  Astro2.self = $$Index;
  return renderTemplate`${renderComponent($$result, "Splash", $$Splash, {}, { "default": () => renderTemplate`${renderComponent($$result, "Main", $$MainContainer, {})}` })}`;
});

const $$file$6 = "C:/Project/astro/jerecho/src/pages/index.astro";
const $$url$6 = "";

const _page0 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  $$metadata: $$metadata$6,
  default: $$Index,
  file: $$file$6,
  url: $$url$6
}, Symbol.toStringTag, { value: 'Module' }));

const html$7 = "";

				const frontmatter$7 = {"title":"Featured project.","description":"Some of the recent projects I've worked with.","description2":"Most of my contributions were mainly focused on UI / UX development, responsive web design and CMS driven websites."};
				const file$7 = "C:/Project/astro/jerecho/src/pages/home/work.md";
				const url$7 = "/home/work";
				function rawContent$7() {
					return "";
				}
				function compiledContent$7() {
					return html$7;
				}
				function getHeadings$7() {
					return [];
				}
				function getHeaders$7() {
					console.warn('getHeaders() have been deprecated. Use getHeadings() function instead.');
					return getHeadings$7();
				}				async function Content$7() {
					const { layout, ...content } = frontmatter$7;
					content.file = file$7;
					content.url = url$7;
					content.astro = {};
					Object.defineProperty(content.astro, 'headings', {
						get() {
							throw new Error('The "astro" property is no longer supported! To access "headings" from your layout, try using "Astro.props.headings."')
						}
					});
					Object.defineProperty(content.astro, 'html', {
						get() {
							throw new Error('The "astro" property is no longer supported! To access "html" from your layout, try using "Astro.props.compiledContent()."')
						}
					});
					Object.defineProperty(content.astro, 'source', {
						get() {
							throw new Error('The "astro" property is no longer supported! To access "source" from your layout, try using "Astro.props.rawContent()."')
						}
					});
					const contentFragment = createVNode(Fragment, { 'set:html': html$7 });
					return contentFragment;
				}
				Content$7[Symbol.for('astro.needsHeadRendering')] = true;

const _page2 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  frontmatter: frontmatter$7,
  file: file$7,
  url: url$7,
  rawContent: rawContent$7,
  compiledContent: compiledContent$7,
  getHeadings: getHeadings$7,
  getHeaders: getHeaders$7,
  Content: Content$7,
  default: Content$7
}, Symbol.toStringTag, { value: 'Module' }));

const $$metadata$5 = createMetadata("/@fs/C:/Project/astro/jerecho/src/components/PortfolioDetails.astro", { modules: [{ module: $$module1$5, specifier: "./Link.astro", assert: {} }], hydratedComponents: [], clientOnlyComponents: [], hydrationDirectives: /* @__PURE__ */ new Set([]), hoisted: [] });
const $$Astro$6 = createAstro("/@fs/C:/Project/astro/jerecho/src/components/PortfolioDetails.astro", "https://jerecho.com/", "file:///C:/Project/astro/jerecho/");
const $$PortfolioDetails = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$6, $$props, $$slots);
  Astro2.self = $$PortfolioDetails;
  const icon = `<svg
              width="44"
              height="44"
              viewBox="0 0 44 44"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              class="svg-icon"
            >
              <g opacity="0.5">
                <path
                  fill-rule="evenodd"
                  clip-rule="evenodd"
                  d="M33 22C33 22.3647 32.8551 22.7144 32.5973 22.9723C32.3394 23.2302 31.9897 23.375 31.625 23.375H15.6943L21.5985 29.2765C21.7263 29.4044 21.8278 29.5561 21.8969 29.7232C21.9661 29.8902 22.0017 30.0692 22.0017 30.25C22.0017 30.4308 21.9661 30.6098 21.8969 30.7769C21.8278 30.9439 21.7263 31.0957 21.5985 31.2235C21.4707 31.3514 21.3189 31.4528 21.1519 31.522C20.9848 31.5912 20.8058 31.6268 20.625 31.6268C20.4442 31.6268 20.2652 31.5912 20.0981 31.522C19.9311 31.4528 19.7793 31.3514 19.6515 31.2235L11.4015 22.9735C11.2735 22.8458 11.1719 22.6941 11.1025 22.527C11.0332 22.36 10.9975 22.1809 10.9975 22C10.9975 21.8192 11.0332 21.6401 11.1025 21.473C11.1719 21.306 11.2735 21.1543 11.4015 21.0265L19.6515 12.7765C19.9097 12.5183 20.2599 12.3733 20.625 12.3733C20.9901 12.3733 21.3403 12.5183 21.5985 12.7765C21.8567 13.0347 22.0017 13.3849 22.0017 13.75C22.0017 14.1152 21.8567 14.4653 21.5985 14.7235L15.6943 20.625H31.625C31.9897 20.625 32.3394 20.7699 32.5973 21.0278C32.8551 21.2856 33 21.6354 33 22Z"
                  fill="white"></path>
              </g>
            </svg>`;
  const { responsibilities, title, imgSrcfull, link, description, builtwith } = Astro2.props;
  const STYLES = [];
  for (const STYLE of STYLES)
    $$result.styles.add(STYLE);
  return renderTemplate`${maybeRenderHead($$result)}<div class="project-container astro-VBWPFBS6">
  <header class="astro-VBWPFBS6">
    ${renderComponent($$result, "Link", $$Link, { "className": "flex-row-reverse astro-VBWPFBS6", "url": "/work", "text": "back to portfolio", "title": "back to portfolio", "hasIcon": icon })}
  </header>
  <div class="project-main astro-VBWPFBS6">
    <div class="project-screenshot swup-delay-anim astro-VBWPFBS6" style="animation-delay: var(--delay100)">
      <a${addAttribute(link, "href")} target="_blank" rel="noopener noreferrer" class="astro-VBWPFBS6">
        <img${addAttribute(imgSrcfull, "src")} alt="" width="493" class="astro-VBWPFBS6">
      </a>
    </div>
    <div class="project-details swup-delay-anim astro-VBWPFBS6" style="animation-delay: var(--delay200)">
      <header class="swup-delay-anim astro-VBWPFBS6" style="animation-delay: var(--delay300)">
        <h3 class="astro-VBWPFBS6">${title}</h3>
        <a${addAttribute(link, "href")} target="_blank" rel="noopener noreferrer" class="astro-VBWPFBS6"><img src="/assets/bx_link-alt.svg" alt="" width="17" class="astro-VBWPFBS6">${link}
        </a>
      </header>
      <div class="swup-delay-anim astro-VBWPFBS6" style="animation-delay: var(--delay400)">
        <p class="astro-VBWPFBS6">${description}</p>
      </div>
      <div class="swup-delay-anim astro-VBWPFBS6" style="animation-delay: var(--delay500)">
        <h5 class="astro-VBWPFBS6">Built With:</h5>
        <span class="astro-VBWPFBS6">${builtwith}</span>
      </div>
      <div class="swup-delay-anim astro-VBWPFBS6" style="animation-delay: var(--delay600)">
        <h5 class="astro-VBWPFBS6">Responsibilities:</h5>
        <ul class="astro-VBWPFBS6">
          ${responsibilities.map((r, i) => renderTemplate`<li class="swup-delay-anim astro-VBWPFBS6"${addAttribute("animation-delay:" + (i += 5) + "00ms", "style")}>
                ${r}
              </li>`)}
        </ul>
      </div>
    </div>
  </div>
</div>

`;
});

const $$file$5 = "C:/Project/astro/jerecho/src/components/PortfolioDetails.astro";
const $$url$5 = undefined;

const $$module4 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  $$metadata: $$metadata$5,
  default: $$PortfolioDetails,
  file: $$file$5,
  url: $$url$5
}, Symbol.toStringTag, { value: 'Module' }));

createMetadata("/@fs/C:/Project/astro/jerecho/src/layouts/Work.astro", { modules: [{ module: $$module2$3, specifier: "../components/MetaHead.astro", assert: {} }, { module: $$module1$7, specifier: "../components/Header.astro", assert: {} }, { module: $$module3$1, specifier: "../components/Footer.astro", assert: {} }, { module: $$module4, specifier: "../components/PortfolioDetails.astro", assert: {} }], hydratedComponents: [], clientOnlyComponents: [], hydrationDirectives: /* @__PURE__ */ new Set([]), hoisted: [] });
const $$Astro$5 = createAstro("/@fs/C:/Project/astro/jerecho/src/layouts/Work.astro", "https://jerecho.com/", "file:///C:/Project/astro/jerecho/");
const $$Work$1 = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$5, $$props, $$slots);
  Astro2.self = $$Work$1;
  const MainEl = "main";
  const MainClass = "main-container transition-fade";
  const { title, imgSrcfull, link, description, responsibilities, builtwith } = Astro2.props.frontmatter || Astro2.props;
  return renderTemplate`<html lang="en">
  <head>
    ${renderComponent($$result, "MetaHead", $$MetaHead, { "title": "Jech | Portfolio", "description": "My name is Jech and I'm a Freelance Web Developer and designer from the Philippines" })}
    <style>
      .container-grid {
        display: grid;
        height: calc(100vh - var(--m-medium) * 2);
        grid-template-areas:
          "header"
          "content"
          "footer";
      }
      @media (min-width: 1000px) {
        .container-grid {
          grid-template-rows: 9vh 1fr 6vh;
        }
      }

      @media (min-width: 1200px) {
        .main-container {
          margin-right: -2rem;
          margin-left: -2rem;
        }
      }
    </style>
  ${renderHead($$result)}</head>
  <body>
    <div class="container-grid">
      ${renderComponent($$result, "Header", $$Header, {})}
      ${renderComponent($$result, "MainEl", MainEl, { "class": MainClass, "id": "swup" }, { "default": () => renderTemplate`${renderComponent($$result, "PortfolioDetails", $$PortfolioDetails, { "title": title, "imgSrcfull": imgSrcfull, "link": link, "description": description, "responsibilities": responsibilities, "builtwith": builtwith })}` })}
      ${renderComponent($$result, "Footer", $$Footer, {})}
    </div>
  </body></html>`;
});

const html$6 = "";

				const frontmatter$6 = {"layout":"../../layouts/Work.astro","publishDate":"2022-10-15T00:00:06.000Z","title":"FloristMart","imgSrc":"../assets/floristmart.png","imgSrcfull":"../assets/floristmart-full.png","link":"https://find.florismart.com/en","description":"Florismart helps you find local florists across the United Kingdom to fulfil your floral needs: from gift bouquets to funeral flowers and from wedding flowers to flower workshops.","builtwith":"Angular","responsibilities":["UI/UX","HTML / SCSS, Responsive web design","Contributed a few feature functionalities using Angular"]};
				const file$6 = "C:/Project/astro/jerecho/src/pages/work/floristmart.md";
				const url$6 = "/work/floristmart";
				function rawContent$6() {
					return "";
				}
				function compiledContent$6() {
					return html$6;
				}
				function getHeadings$6() {
					return [];
				}
				function getHeaders$6() {
					console.warn('getHeaders() have been deprecated. Use getHeadings() function instead.');
					return getHeadings$6();
				}				async function Content$6() {
					const { layout, ...content } = frontmatter$6;
					content.file = file$6;
					content.url = url$6;
					content.astro = {};
					Object.defineProperty(content.astro, 'headings', {
						get() {
							throw new Error('The "astro" property is no longer supported! To access "headings" from your layout, try using "Astro.props.headings."')
						}
					});
					Object.defineProperty(content.astro, 'html', {
						get() {
							throw new Error('The "astro" property is no longer supported! To access "html" from your layout, try using "Astro.props.compiledContent()."')
						}
					});
					Object.defineProperty(content.astro, 'source', {
						get() {
							throw new Error('The "astro" property is no longer supported! To access "source" from your layout, try using "Astro.props.rawContent()."')
						}
					});
					const contentFragment = createVNode(Fragment, { 'set:html': html$6 });
					return createVNode($$Work$1, {
									file: file$6,
									url: url$6,
									content,
									frontmatter: content,
									headings: getHeadings$6(),
									rawContent: rawContent$6,
									compiledContent: compiledContent$6,
									'server:root': true,
									children: contentFragment
								});
				}
				Content$6[Symbol.for('astro.needsHeadRendering')] = false;

const _page3 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  frontmatter: frontmatter$6,
  file: file$6,
  url: url$6,
  rawContent: rawContent$6,
  compiledContent: compiledContent$6,
  getHeadings: getHeadings$6,
  getHeaders: getHeaders$6,
  Content: Content$6,
  default: Content$6
}, Symbol.toStringTag, { value: 'Module' }));

const html$5 = "";

				const frontmatter$5 = {"layout":"../../layouts/Work.astro","publishDate":"2022-10-15T00:00:04.000Z","title":"Rate My Agent (Property banter site)","imgSrc":"../assets/propertybanter.png","imgSrcfull":"../assets/propertybanter-full.png","link":"https://www.propertybanter.com.au","description":"RateMyAgent provides recommendations, ranking and reviews for real estate agents in Australia. Find the best real estate agent the first time so you can get the best results the first time. It's free to use, no sign-up required.","builtwith":"Hubspot CMS","responsibilities":["UI/UX","HTML / SCSS, Responsive web design","Hubspot CMS"]};
				const file$5 = "C:/Project/astro/jerecho/src/pages/work/ratemyagent.md";
				const url$5 = "/work/ratemyagent";
				function rawContent$5() {
					return "";
				}
				function compiledContent$5() {
					return html$5;
				}
				function getHeadings$5() {
					return [];
				}
				function getHeaders$5() {
					console.warn('getHeaders() have been deprecated. Use getHeadings() function instead.');
					return getHeadings$5();
				}				async function Content$5() {
					const { layout, ...content } = frontmatter$5;
					content.file = file$5;
					content.url = url$5;
					content.astro = {};
					Object.defineProperty(content.astro, 'headings', {
						get() {
							throw new Error('The "astro" property is no longer supported! To access "headings" from your layout, try using "Astro.props.headings."')
						}
					});
					Object.defineProperty(content.astro, 'html', {
						get() {
							throw new Error('The "astro" property is no longer supported! To access "html" from your layout, try using "Astro.props.compiledContent()."')
						}
					});
					Object.defineProperty(content.astro, 'source', {
						get() {
							throw new Error('The "astro" property is no longer supported! To access "source" from your layout, try using "Astro.props.rawContent()."')
						}
					});
					const contentFragment = createVNode(Fragment, { 'set:html': html$5 });
					return createVNode($$Work$1, {
									file: file$5,
									url: url$5,
									content,
									frontmatter: content,
									headings: getHeadings$5(),
									rawContent: rawContent$5,
									compiledContent: compiledContent$5,
									'server:root': true,
									children: contentFragment
								});
				}
				Content$5[Symbol.for('astro.needsHeadRendering')] = false;

const _page4 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  frontmatter: frontmatter$5,
  file: file$5,
  url: url$5,
  rawContent: rawContent$5,
  compiledContent: compiledContent$5,
  getHeadings: getHeadings$5,
  getHeaders: getHeaders$5,
  Content: Content$5,
  default: Content$5
}, Symbol.toStringTag, { value: 'Module' }));

const html$4 = "";

				const frontmatter$4 = {"layout":"../../layouts/Work.astro","publishDate":"2022-10-15T00:00:03.000Z","title":"RegisterNow","imgSrc":"../assets/registernow.png","imgSrcfull":"../assets/registernow-full.png","link":"https://registernow.io","description":"Australia and New Zealand’s leading registration platform for mass participation sports events.","builtwith":"OctoberCMS, VueJS","responsibilities":["UI/UX","HTML / SCSS, Responsive web design","Implemeted VueJS functionality on the frontend","Fetch API data from azure web services"]};
				const file$4 = "C:/Project/astro/jerecho/src/pages/work/registernow.md";
				const url$4 = "/work/registernow";
				function rawContent$4() {
					return "";
				}
				function compiledContent$4() {
					return html$4;
				}
				function getHeadings$4() {
					return [];
				}
				function getHeaders$4() {
					console.warn('getHeaders() have been deprecated. Use getHeadings() function instead.');
					return getHeadings$4();
				}				async function Content$4() {
					const { layout, ...content } = frontmatter$4;
					content.file = file$4;
					content.url = url$4;
					content.astro = {};
					Object.defineProperty(content.astro, 'headings', {
						get() {
							throw new Error('The "astro" property is no longer supported! To access "headings" from your layout, try using "Astro.props.headings."')
						}
					});
					Object.defineProperty(content.astro, 'html', {
						get() {
							throw new Error('The "astro" property is no longer supported! To access "html" from your layout, try using "Astro.props.compiledContent()."')
						}
					});
					Object.defineProperty(content.astro, 'source', {
						get() {
							throw new Error('The "astro" property is no longer supported! To access "source" from your layout, try using "Astro.props.rawContent()."')
						}
					});
					const contentFragment = createVNode(Fragment, { 'set:html': html$4 });
					return createVNode($$Work$1, {
									file: file$4,
									url: url$4,
									content,
									frontmatter: content,
									headings: getHeadings$4(),
									rawContent: rawContent$4,
									compiledContent: compiledContent$4,
									'server:root': true,
									children: contentFragment
								});
				}
				Content$4[Symbol.for('astro.needsHeadRendering')] = false;

const _page5 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  frontmatter: frontmatter$4,
  file: file$4,
  url: url$4,
  rawContent: rawContent$4,
  compiledContent: compiledContent$4,
  getHeadings: getHeadings$4,
  getHeaders: getHeaders$4,
  Content: Content$4,
  default: Content$4
}, Symbol.toStringTag, { value: 'Module' }));

const html$3 = "";

				const frontmatter$3 = {"layout":"../../layouts/Work.astro","publishDate":"2022-10-15T00:00:02.000Z","title":"BloomLocal","imgSrc":"../assets/bloomlocal.png","imgSrcfull":"../assets/bloomlocal-full.png","link":"https://www.bloomlocal.co.uk","description":"Send same day flowers and make someone smile in an instant!  Affordable next day flowers also available anywhere in the UK.  Easy ordering online.","builtwith":"Angular","responsibilities":["UI/UX","HTML / SCSS, Responsive web design","Initiated Angular based component for the shop site","Helped other devs with UI related issues on admin dashboard"]};
				const file$3 = "C:/Project/astro/jerecho/src/pages/work/bloomlocal.md";
				const url$3 = "/work/bloomlocal";
				function rawContent$3() {
					return "";
				}
				function compiledContent$3() {
					return html$3;
				}
				function getHeadings$3() {
					return [];
				}
				function getHeaders$3() {
					console.warn('getHeaders() have been deprecated. Use getHeadings() function instead.');
					return getHeadings$3();
				}				async function Content$3() {
					const { layout, ...content } = frontmatter$3;
					content.file = file$3;
					content.url = url$3;
					content.astro = {};
					Object.defineProperty(content.astro, 'headings', {
						get() {
							throw new Error('The "astro" property is no longer supported! To access "headings" from your layout, try using "Astro.props.headings."')
						}
					});
					Object.defineProperty(content.astro, 'html', {
						get() {
							throw new Error('The "astro" property is no longer supported! To access "html" from your layout, try using "Astro.props.compiledContent()."')
						}
					});
					Object.defineProperty(content.astro, 'source', {
						get() {
							throw new Error('The "astro" property is no longer supported! To access "source" from your layout, try using "Astro.props.rawContent()."')
						}
					});
					const contentFragment = createVNode(Fragment, { 'set:html': html$3 });
					return createVNode($$Work$1, {
									file: file$3,
									url: url$3,
									content,
									frontmatter: content,
									headings: getHeadings$3(),
									rawContent: rawContent$3,
									compiledContent: compiledContent$3,
									'server:root': true,
									children: contentFragment
								});
				}
				Content$3[Symbol.for('astro.needsHeadRendering')] = false;

const _page6 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  frontmatter: frontmatter$3,
  file: file$3,
  url: url$3,
  rawContent: rawContent$3,
  compiledContent: compiledContent$3,
  getHeadings: getHeadings$3,
  getHeaders: getHeaders$3,
  Content: Content$3,
  default: Content$3
}, Symbol.toStringTag, { value: 'Module' }));

const html$2 = "";

				const frontmatter$2 = {"publishDate":"2022-10-15T00:00:00.000Z","layout":"../../layouts/Work.astro","title":"Arcanys Inc.","imgSrc":"../assets/arcanys.png","imgSrcfull":"../assets/arcanys-full.png","link":"https://arcanys.com","description":"Philippines' Top Software Development & Team Augmentation company. Hire the tech talents you need from a pool of 200+ dedicated software engineers.","builtwith":"NextJS","responsibilities":["UI/UX","HTML / SCSS, Responsive web design","Google apps integration, GTM, Analytics","Contributed a few feature functionalities using NextJS"]};
				const file$2 = "C:/Project/astro/jerecho/src/pages/work/arcanys.md";
				const url$2 = "/work/arcanys";
				function rawContent$2() {
					return "";
				}
				function compiledContent$2() {
					return html$2;
				}
				function getHeadings$2() {
					return [];
				}
				function getHeaders$2() {
					console.warn('getHeaders() have been deprecated. Use getHeadings() function instead.');
					return getHeadings$2();
				}				async function Content$2() {
					const { layout, ...content } = frontmatter$2;
					content.file = file$2;
					content.url = url$2;
					content.astro = {};
					Object.defineProperty(content.astro, 'headings', {
						get() {
							throw new Error('The "astro" property is no longer supported! To access "headings" from your layout, try using "Astro.props.headings."')
						}
					});
					Object.defineProperty(content.astro, 'html', {
						get() {
							throw new Error('The "astro" property is no longer supported! To access "html" from your layout, try using "Astro.props.compiledContent()."')
						}
					});
					Object.defineProperty(content.astro, 'source', {
						get() {
							throw new Error('The "astro" property is no longer supported! To access "source" from your layout, try using "Astro.props.rawContent()."')
						}
					});
					const contentFragment = createVNode(Fragment, { 'set:html': html$2 });
					return createVNode($$Work$1, {
									file: file$2,
									url: url$2,
									content,
									frontmatter: content,
									headings: getHeadings$2(),
									rawContent: rawContent$2,
									compiledContent: compiledContent$2,
									'server:root': true,
									children: contentFragment
								});
				}
				Content$2[Symbol.for('astro.needsHeadRendering')] = false;

const _page7 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  frontmatter: frontmatter$2,
  file: file$2,
  url: url$2,
  rawContent: rawContent$2,
  compiledContent: compiledContent$2,
  getHeadings: getHeadings$2,
  getHeaders: getHeaders$2,
  Content: Content$2,
  default: Content$2
}, Symbol.toStringTag, { value: 'Module' }));

const html$1 = "";

				const frontmatter$1 = {"publishDate":"2022-10-15T00:00:07.000Z","layout":"../../layouts/Work.astro","title":"ChildUp","imgSrc":"../assets/childup.png","imgSrcfull":"../assets/childup-full.png","link":"https://childup.com","description":"Early learning is key. Help your Child succeed.","builtwith":"GravCMS","responsibilities":["UI/UX","HTML / SCSS, Responsive web design","Develop frontend UI + data via GravCMS"]};
				const file$1 = "C:/Project/astro/jerecho/src/pages/work/childup.md";
				const url$1 = "/work/childup";
				function rawContent$1() {
					return "";
				}
				function compiledContent$1() {
					return html$1;
				}
				function getHeadings$1() {
					return [];
				}
				function getHeaders$1() {
					console.warn('getHeaders() have been deprecated. Use getHeadings() function instead.');
					return getHeadings$1();
				}				async function Content$1() {
					const { layout, ...content } = frontmatter$1;
					content.file = file$1;
					content.url = url$1;
					content.astro = {};
					Object.defineProperty(content.astro, 'headings', {
						get() {
							throw new Error('The "astro" property is no longer supported! To access "headings" from your layout, try using "Astro.props.headings."')
						}
					});
					Object.defineProperty(content.astro, 'html', {
						get() {
							throw new Error('The "astro" property is no longer supported! To access "html" from your layout, try using "Astro.props.compiledContent()."')
						}
					});
					Object.defineProperty(content.astro, 'source', {
						get() {
							throw new Error('The "astro" property is no longer supported! To access "source" from your layout, try using "Astro.props.rawContent()."')
						}
					});
					const contentFragment = createVNode(Fragment, { 'set:html': html$1 });
					return createVNode($$Work$1, {
									file: file$1,
									url: url$1,
									content,
									frontmatter: content,
									headings: getHeadings$1(),
									rawContent: rawContent$1,
									compiledContent: compiledContent$1,
									'server:root': true,
									children: contentFragment
								});
				}
				Content$1[Symbol.for('astro.needsHeadRendering')] = false;

const _page8 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  frontmatter: frontmatter$1,
  file: file$1,
  url: url$1,
  rawContent: rawContent$1,
  compiledContent: compiledContent$1,
  getHeadings: getHeadings$1,
  getHeaders: getHeaders$1,
  Content: Content$1,
  default: Content$1
}, Symbol.toStringTag, { value: 'Module' }));

const html = "";

				const frontmatter = {"layout":"../../layouts/Work.astro","publishDate":"2022-10-15T00:00:05.000Z","title":"Arcanys Early Learning Foundation","imgSrc":"../assets/elearning.png","imgSrcfull":"../assets/elearning-full.png","link":"https://www.arcanysfoundation.org","description":"The Arcanys Early Learning Foundation offers effective math coaching programs to parents and preschool children from low-income areas of the Philippines.","builtwith":"GravCMS","responsibilities":["UI/UX","HTML / SCSS, Responsive web design","Develop frontend UI + data via GravCMS from scratch"]};
				const file = "C:/Project/astro/jerecho/src/pages/work/aelf.md";
				const url = "/work/aelf";
				function rawContent() {
					return "";
				}
				function compiledContent() {
					return html;
				}
				function getHeadings() {
					return [];
				}
				function getHeaders() {
					console.warn('getHeaders() have been deprecated. Use getHeadings() function instead.');
					return getHeadings();
				}				async function Content() {
					const { layout, ...content } = frontmatter;
					content.file = file;
					content.url = url;
					content.astro = {};
					Object.defineProperty(content.astro, 'headings', {
						get() {
							throw new Error('The "astro" property is no longer supported! To access "headings" from your layout, try using "Astro.props.headings."')
						}
					});
					Object.defineProperty(content.astro, 'html', {
						get() {
							throw new Error('The "astro" property is no longer supported! To access "html" from your layout, try using "Astro.props.compiledContent()."')
						}
					});
					Object.defineProperty(content.astro, 'source', {
						get() {
							throw new Error('The "astro" property is no longer supported! To access "source" from your layout, try using "Astro.props.rawContent()."')
						}
					});
					const contentFragment = createVNode(Fragment, { 'set:html': html });
					return createVNode($$Work$1, {
									file,
									url,
									content,
									frontmatter: content,
									headings: getHeadings(),
									rawContent,
									compiledContent,
									'server:root': true,
									children: contentFragment
								});
				}
				Content[Symbol.for('astro.needsHeadRendering')] = false;

const _page9 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  frontmatter,
  file,
  url,
  rawContent,
  compiledContent,
  getHeadings,
  getHeaders,
  Content,
  default: Content
}, Symbol.toStringTag, { value: 'Module' }));

const $$metadata$4 = createMetadata("/@fs/C:/Project/astro/jerecho/src/components/WorkList.astro", { modules: [{ module: _page2, specifier: "../pages/home/work.md", assert: {} }], hydratedComponents: [], clientOnlyComponents: [], hydrationDirectives: /* @__PURE__ */ new Set([]), hoisted: [] });
const $$Astro$4 = createAstro("/@fs/C:/Project/astro/jerecho/src/components/WorkList.astro", "https://jerecho.com/", "file:///C:/Project/astro/jerecho/");
const $$WorkList = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$4, $$props, $$slots);
  Astro2.self = $$WorkList;
  const posts = (await Astro2.glob(/* #__PURE__ */ Object.assign({"../pages/work/aelf.md": () => Promise.resolve().then(() => _page9),"../pages/work/arcanys.md": () => Promise.resolve().then(() => _page7),"../pages/work/bloomlocal.md": () => Promise.resolve().then(() => _page6),"../pages/work/childup.md": () => Promise.resolve().then(() => _page8),"../pages/work/floristmart.md": () => Promise.resolve().then(() => _page3),"../pages/work/ratemyagent.md": () => Promise.resolve().then(() => _page4),"../pages/work/registernow.md": () => Promise.resolve().then(() => _page5)}), () => "../pages/work/*.md")).filter(({ frontmatter }) => !!frontmatter.publishDate).sort(
    (a, b) => new Date(a.frontmatter.publishDate).valueOf() - new Date(b.frontmatter.publishDate).valueOf()
  );
  const STYLES = [];
  for (const STYLE of STYLES)
    $$result.styles.add(STYLE);
  return renderTemplate`${maybeRenderHead($$result)}<div class="work-list astro-BTULB7EM">
  <div class="heading-panel swup-delay-anim astro-BTULB7EM" style="animation-delay: var(--delay100)">
    <h5 style="--shade: var(--c-gray);" class="astro-BTULB7EM">${frontmatter$7.title}</h5>
    <p class="astro-BTULB7EM">${frontmatter$7.description}</p>
    <p class="astro-BTULB7EM">${frontmatter$7.description2}</p>
  </div>
  <ul class="astro-BTULB7EM">
    ${posts.map((post, i) => renderTemplate`<li class="swup-delay-anim astro-BTULB7EM"${addAttribute("animation-delay:" + (i += 3) + "00ms", "style")}>
          <a${addAttribute(post.url, "href")}${addAttribute(post.frontmatter.title, "title")}${addAttribute(post.frontmatter.title, "data-title")} class="astro-BTULB7EM">
            <img${addAttribute(post.frontmatter.imgSrc, "src")}${addAttribute(post.frontmatter.title, "alt")} class="astro-BTULB7EM">
          </a>
        </li>`)}
  </ul>
</div>

`;
});

const $$file$4 = "C:/Project/astro/jerecho/src/components/WorkList.astro";
const $$url$4 = undefined;

const $$module1$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  $$metadata: $$metadata$4,
  default: $$WorkList,
  file: $$file$4,
  url: $$url$4
}, Symbol.toStringTag, { value: 'Module' }));

const $$metadata$3 = createMetadata("/@fs/C:/Project/astro/jerecho/src/components/PortfolioContainer.astro", { modules: [{ module: $$module1$1, specifier: "./WorkList.astro", assert: {} }], hydratedComponents: [], clientOnlyComponents: [], hydrationDirectives: /* @__PURE__ */ new Set([]), hoisted: [] });
const $$Astro$3 = createAstro("/@fs/C:/Project/astro/jerecho/src/components/PortfolioContainer.astro", "https://jerecho.com/", "file:///C:/Project/astro/jerecho/");
const $$PortfolioContainer = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$3, $$props, $$slots);
  Astro2.self = $$PortfolioContainer;
  const STYLES = [];
  for (const STYLE of STYLES)
    $$result.styles.add(STYLE);
  return renderTemplate`${maybeRenderHead($$result)}<main class="main-container transition-fade astro-SENL7HH2" id="swup">
  ${renderComponent($$result, "WorkList", $$WorkList, { "class": "astro-SENL7HH2" })}
</main>

`;
});

const $$file$3 = "C:/Project/astro/jerecho/src/components/PortfolioContainer.astro";
const $$url$3 = undefined;

const $$module1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  $$metadata: $$metadata$3,
  default: $$PortfolioContainer,
  file: $$file$3,
  url: $$url$3
}, Symbol.toStringTag, { value: 'Module' }));

const $$metadata$2 = createMetadata("/@fs/C:/Project/astro/jerecho/src/layouts/Experience.astro", { modules: [{ module: $$module2$3, specifier: "../components/MetaHead.astro", assert: {} }, { module: $$module1$7, specifier: "../components/Header.astro", assert: {} }, { module: $$module3$1, specifier: "../components/Footer.astro", assert: {} }], hydratedComponents: [], clientOnlyComponents: [], hydrationDirectives: /* @__PURE__ */ new Set([]), hoisted: [] });
const $$Astro$2 = createAstro("/@fs/C:/Project/astro/jerecho/src/layouts/Experience.astro", "https://jerecho.com/", "file:///C:/Project/astro/jerecho/");
const $$Experience = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$2, $$props, $$slots);
  Astro2.self = $$Experience;
  return renderTemplate`<html lang="en">
  <head>
    ${renderComponent($$result, "MetaHead", $$MetaHead, { "title": "Jech | Portfolio", "description": "My name is Jech and I'm a Freelance Web Developer and designer from the Philippines" })}
    <style>
      .container-grid {
        grid-template-areas:
          "header"
          "content"
          "footer";
      }
      @media (min-width: 1000px) {
        .container-grid {
          grid-template-rows: 1fr;
          display: grid;
        }
      }
    </style>
  ${renderHead($$result)}</head>
  <body>
    <div class="container-grid">
      ${renderComponent($$result, "Header", $$Header, {})}
      ${renderSlot($$result, $$slots["default"])}
      ${renderComponent($$result, "Footer", $$Footer, {})}
    </div>
  </body></html>`;
});

const $$file$2 = "C:/Project/astro/jerecho/src/layouts/Experience.astro";
const $$url$2 = undefined;

const $$module2 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  $$metadata: $$metadata$2,
  default: $$Experience,
  file: $$file$2,
  url: $$url$2
}, Symbol.toStringTag, { value: 'Module' }));

const $$metadata$1 = createMetadata("/@fs/C:/Project/astro/jerecho/src/pages/work.astro", { modules: [{ module: $$module1, specifier: "../components/PortfolioContainer.astro", assert: {} }, { module: $$module2, specifier: "../layouts/Experience.astro", assert: {} }], hydratedComponents: [], clientOnlyComponents: [], hydrationDirectives: /* @__PURE__ */ new Set([]), hoisted: [] });
const $$Astro$1 = createAstro("/@fs/C:/Project/astro/jerecho/src/pages/work.astro", "https://jerecho.com/", "file:///C:/Project/astro/jerecho/");
const $$Work = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$1, $$props, $$slots);
  Astro2.self = $$Work;
  return renderTemplate`${renderComponent($$result, "Experience", $$Experience, {}, { "default": () => renderTemplate`${renderComponent($$result, "PortfolioContainer", $$PortfolioContainer, {})}` })}`;
});

const $$file$1 = "C:/Project/astro/jerecho/src/pages/work.astro";
const $$url$1 = "/work";

const _page10 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  $$metadata: $$metadata$1,
  default: $$Work,
  file: $$file$1,
  url: $$url$1
}, Symbol.toStringTag, { value: 'Module' }));

const $$metadata = createMetadata("/@fs/C:/Project/astro/jerecho/src/pages/404.astro", { modules: [{ module: $$module1$7, specifier: "../components/Header.astro", assert: {} }, { module: $$module2$3, specifier: "../components/MetaHead.astro", assert: {} }], hydratedComponents: [], clientOnlyComponents: [], hydrationDirectives: /* @__PURE__ */ new Set([]), hoisted: [] });
const $$Astro = createAstro("/@fs/C:/Project/astro/jerecho/src/pages/404.astro", "https://jerecho.com/", "file:///C:/Project/astro/jerecho/");
const $$404 = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$404;
  const STYLES = [];
  for (const STYLE of STYLES)
    $$result.styles.add(STYLE);
  return renderTemplate`<html lang="en" class="astro-6XY24A3L">
  <head>
    ${renderComponent($$result, "MetaHead", $$MetaHead, { "title": "Jech | Not Found", "description": "My name is Jech and I'm a Freelance Web Developer and designer from the Philippines", "class": "astro-6XY24A3L" })}
    
  ${renderHead($$result)}</head>
  <body class="astro-6XY24A3L">
    <div class="container-grid astro-6XY24A3L">
      ${renderComponent($$result, "Header", $$Header, { "class": "astro-6XY24A3L" })}
      <main class="main-container transition-fade astro-6XY24A3L" id="swup">
        <h1 class="astro-6XY24A3L">404 404 404 404 404 404 404 404 404 404 404 404 404 404 404 404 404 404 404 404 404 404 404 404 404 404 404 404 404 404 404 404 404 404 </h1>
      </main>
    </div>
  </body></html>`;
});

const $$file = "C:/Project/astro/jerecho/src/pages/404.astro";
const $$url = "/404";

const _page11 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  $$metadata,
  default: $$404,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const pageMap = new Map([['src/pages/index.astro', _page0],['src/pages/home/intro.md', _page1],['src/pages/home/work.md', _page2],['src/pages/work/floristmart.md', _page3],['src/pages/work/ratemyagent.md', _page4],['src/pages/work/registernow.md', _page5],['src/pages/work/bloomlocal.md', _page6],['src/pages/work/arcanys.md', _page7],['src/pages/work/childup.md', _page8],['src/pages/work/aelf.md', _page9],['src/pages/work.astro', _page10],['src/pages/404.astro', _page11],]);
const renderers = [Object.assign({"name":"astro:jsx","serverEntrypoint":"astro/jsx/server.js","jsxImportSource":"astro"}, { ssr: server_default }),];

if (typeof process !== "undefined") {
  if (process.argv.includes("--verbose")) ; else if (process.argv.includes("--silent")) ; else ;
}

const SCRIPT_EXTENSIONS = /* @__PURE__ */ new Set([".js", ".ts"]);
new RegExp(
  `\\.(${Array.from(SCRIPT_EXTENSIONS).map((s) => s.slice(1)).join("|")})($|\\?)`
);

const STYLE_EXTENSIONS = /* @__PURE__ */ new Set([
  ".css",
  ".pcss",
  ".postcss",
  ".scss",
  ".sass",
  ".styl",
  ".stylus",
  ".less"
]);
new RegExp(
  `\\.(${Array.from(STYLE_EXTENSIONS).map((s) => s.slice(1)).join("|")})($|\\?)`
);

function getRouteGenerator(segments, addTrailingSlash) {
  const template = segments.map((segment) => {
    return segment[0].spread ? `/:${segment[0].content.slice(3)}(.*)?` : "/" + segment.map((part) => {
      if (part)
        return part.dynamic ? `:${part.content}` : part.content.normalize().replace(/\?/g, "%3F").replace(/#/g, "%23").replace(/%5B/g, "[").replace(/%5D/g, "]").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }).join("");
  }).join("");
  let trailing = "";
  if (addTrailingSlash === "always" && segments.length) {
    trailing = "/";
  }
  const toPath = compile(template + trailing);
  return toPath;
}

function deserializeRouteData(rawRouteData) {
  return {
    route: rawRouteData.route,
    type: rawRouteData.type,
    pattern: new RegExp(rawRouteData.pattern),
    params: rawRouteData.params,
    component: rawRouteData.component,
    generate: getRouteGenerator(rawRouteData.segments, rawRouteData._meta.trailingSlash),
    pathname: rawRouteData.pathname || void 0,
    segments: rawRouteData.segments
  };
}

function deserializeManifest(serializedManifest) {
  const routes = [];
  for (const serializedRoute of serializedManifest.routes) {
    routes.push({
      ...serializedRoute,
      routeData: deserializeRouteData(serializedRoute.routeData)
    });
    const route = serializedRoute;
    route.routeData = deserializeRouteData(serializedRoute.routeData);
  }
  const assets = new Set(serializedManifest.assets);
  return {
    ...serializedManifest,
    assets,
    routes
  };
}

const _manifest = Object.assign(deserializeManifest({"adapterName":"@astrojs/netlify/functions","routes":[{"file":"","links":["assets/3511a966.bc83fe5b.css","assets/62b4ebfc.b4885080.css","assets/f9b40345.406290d0.css","assets/index.46ff800a.css"],"scripts":[],"routeData":{"route":"/","type":"page","pattern":"^\\/$","segments":[],"params":[],"component":"src/pages/index.astro","pathname":"/","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"routeData":{"route":"/home/intro","type":"page","pattern":"^\\/home\\/intro\\/?$","segments":[[{"content":"home","dynamic":false,"spread":false}],[{"content":"intro","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/home/intro.md","pathname":"/home/intro","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"routeData":{"route":"/home/work","type":"page","pattern":"^\\/home\\/work\\/?$","segments":[[{"content":"home","dynamic":false,"spread":false}],[{"content":"work","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/home/work.md","pathname":"/home/work","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":["assets/3511a966.bc83fe5b.css","assets/62b4ebfc.b4885080.css","assets/f9b40345.406290d0.css","assets/65144cb1.bf910ba4.css"],"scripts":[],"routeData":{"route":"/work/floristmart","type":"page","pattern":"^\\/work\\/floristmart\\/?$","segments":[[{"content":"work","dynamic":false,"spread":false}],[{"content":"floristmart","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/work/floristmart.md","pathname":"/work/floristmart","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":["assets/3511a966.bc83fe5b.css","assets/62b4ebfc.b4885080.css","assets/f9b40345.406290d0.css","assets/65144cb1.bf910ba4.css"],"scripts":[],"routeData":{"route":"/work/ratemyagent","type":"page","pattern":"^\\/work\\/ratemyagent\\/?$","segments":[[{"content":"work","dynamic":false,"spread":false}],[{"content":"ratemyagent","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/work/ratemyagent.md","pathname":"/work/ratemyagent","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":["assets/3511a966.bc83fe5b.css","assets/62b4ebfc.b4885080.css","assets/f9b40345.406290d0.css","assets/65144cb1.bf910ba4.css"],"scripts":[],"routeData":{"route":"/work/registernow","type":"page","pattern":"^\\/work\\/registernow\\/?$","segments":[[{"content":"work","dynamic":false,"spread":false}],[{"content":"registernow","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/work/registernow.md","pathname":"/work/registernow","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":["assets/3511a966.bc83fe5b.css","assets/62b4ebfc.b4885080.css","assets/f9b40345.406290d0.css","assets/65144cb1.bf910ba4.css"],"scripts":[],"routeData":{"route":"/work/bloomlocal","type":"page","pattern":"^\\/work\\/bloomlocal\\/?$","segments":[[{"content":"work","dynamic":false,"spread":false}],[{"content":"bloomlocal","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/work/bloomlocal.md","pathname":"/work/bloomlocal","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":["assets/3511a966.bc83fe5b.css","assets/62b4ebfc.b4885080.css","assets/f9b40345.406290d0.css","assets/65144cb1.bf910ba4.css"],"scripts":[],"routeData":{"route":"/work/arcanys","type":"page","pattern":"^\\/work\\/arcanys\\/?$","segments":[[{"content":"work","dynamic":false,"spread":false}],[{"content":"arcanys","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/work/arcanys.md","pathname":"/work/arcanys","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":["assets/3511a966.bc83fe5b.css","assets/62b4ebfc.b4885080.css","assets/f9b40345.406290d0.css","assets/65144cb1.bf910ba4.css"],"scripts":[],"routeData":{"route":"/work/childup","type":"page","pattern":"^\\/work\\/childup\\/?$","segments":[[{"content":"work","dynamic":false,"spread":false}],[{"content":"childup","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/work/childup.md","pathname":"/work/childup","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":["assets/3511a966.bc83fe5b.css","assets/62b4ebfc.b4885080.css","assets/f9b40345.406290d0.css","assets/65144cb1.bf910ba4.css"],"scripts":[],"routeData":{"route":"/work/aelf","type":"page","pattern":"^\\/work\\/aelf\\/?$","segments":[[{"content":"work","dynamic":false,"spread":false}],[{"content":"aelf","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/work/aelf.md","pathname":"/work/aelf","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":["assets/f9b40345.406290d0.css","assets/65144cb1.bf910ba4.css","assets/work.7a2c83ad.css","assets/3511a966.bc83fe5b.css","assets/62b4ebfc.b4885080.css"],"scripts":[],"routeData":{"route":"/work","type":"page","pattern":"^\\/work\\/?$","segments":[[{"content":"work","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/work.astro","pathname":"/work","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":["assets/404.7256e44d.css","assets/3511a966.bc83fe5b.css"],"scripts":[],"routeData":{"route":"/404","type":"page","pattern":"^\\/404\\/?$","segments":[[{"content":"404","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/404.astro","pathname":"/404","_meta":{"trailingSlash":"ignore"}}}],"site":"https://jerecho.com/","base":"/","markdown":{"drafts":false,"syntaxHighlight":"shiki","shikiConfig":{"langs":[],"theme":"github-dark","wrap":false},"remarkPlugins":[],"rehypePlugins":[],"remarkRehype":{},"extendDefaultPlugins":false,"isAstroFlavoredMd":false},"pageMap":null,"renderers":[],"entryModules":{"\u0000@astrojs-ssr-virtual-entry":"entry.mjs","astro:scripts/before-hydration.js":""},"assets":["/assets/404.7256e44d.css","/assets/3511a966.bc83fe5b.css","/assets/62b4ebfc.b4885080.css","/assets/65144cb1.bf910ba4.css","/assets/f9b40345.406290d0.css","/assets/index.46ff800a.css","/assets/work.7a2c83ad.css","/favicon.ico","/robots.txt","/assets/arcanys-full.png","/assets/arcanys.png","/assets/bi_arrow-left-short.svg","/assets/bloomlocal-full.png","/assets/bloomlocal.png","/assets/bx_link-alt.svg","/assets/childup-full.png","/assets/childup.png","/assets/circle-stroke.svg","/assets/coconut.svg","/assets/codepen.svg","/assets/cta-arrow.svg","/assets/dots.svg","/assets/dribbble.svg","/assets/elearning-full.png","/assets/elearning.png","/assets/fake_cursor.svg","/assets/fav.svg","/assets/floristmart-full.png","/assets/floristmart.png","/assets/footer-dots.svg","/assets/logo-stroke.svg","/assets/me.png","/assets/me.svg","/assets/mountains.svg","/assets/ocean.svg","/assets/og-cover.png","/assets/propertybanter-full.png","/assets/propertybanter.png","/assets/registernow-full.png","/assets/registernow.png","/assets/stroke-bg.svg","/assets/youtube.svg"]}), {
	pageMap: pageMap,
	renderers: renderers
});
const _args = {};

const _exports = adapter.createExports(_manifest, _args);
const handler = _exports['handler'];

const _start = 'start';
if(_start in adapter) {
	adapter[_start](_manifest, _args);
}

export { handler };
