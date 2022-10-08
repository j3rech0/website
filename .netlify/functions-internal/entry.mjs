import * as adapter from '@astrojs/netlify/netlify-functions.js';
import { escape } from 'html-escaper';
/* empty css                        *//* empty css                            *//* empty css                      */import 'mime';
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

const $$metadata$e = createMetadata("/@fs/C:/Project/astro/jerecho/src/components/SocialList.astro", { modules: [], hydratedComponents: [], clientOnlyComponents: [], hydrationDirectives: /* @__PURE__ */ new Set([]), hoisted: [] });
const $$Astro$e = createAstro("/@fs/C:/Project/astro/jerecho/src/components/SocialList.astro", "https://j3rech0.netlify.app/", "file:///C:/Project/astro/jerecho/");
const $$SocialList = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$e, $$props, $$slots);
  Astro2.self = $$SocialList;
  const { title, url, src } = Astro2.props;
  const STYLES = [];
  for (const STYLE of STYLES)
    $$result.styles.add(STYLE);
  return renderTemplate`${maybeRenderHead($$result)}<a${addAttribute(url || "/", "href")}${addAttribute(title, "title")} class="astro-ZA6GHB2F">
  <img${addAttribute(src, "src")}${addAttribute(title, "alt")} class="astro-ZA6GHB2F">
</a>

`;
});

const $$file$e = "C:/Project/astro/jerecho/src/components/SocialList.astro";
const $$url$e = undefined;

const $$module1$6 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  $$metadata: $$metadata$e,
  default: $$SocialList,
  file: $$file$e,
  url: $$url$e
}, Symbol.toStringTag, { value: 'Module' }));

const $$metadata$d = createMetadata("/@fs/C:/Project/astro/jerecho/src/components/SocialMedia.astro", { modules: [{ module: $$module1$6, specifier: "./SocialList.astro", assert: {} }], hydratedComponents: [], clientOnlyComponents: [], hydrationDirectives: /* @__PURE__ */ new Set([]), hoisted: [] });
const $$Astro$d = createAstro("/@fs/C:/Project/astro/jerecho/src/components/SocialMedia.astro", "https://j3rech0.netlify.app/", "file:///C:/Project/astro/jerecho/");
const $$SocialMedia = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$d, $$props, $$slots);
  Astro2.self = $$SocialMedia;
  const socialMedia = [
    {
      title: "devui2022",
      url: "https://dribbble.com/devui2022",
      src: "../assets/dribbble.svg"
    },
    {
      title: "devUI youtube channel",
      url: "https://www.youtube.com/channel/UCZnuUnd4XeKxfuTPFFs9OBA",
      src: "../assets/youtube.svg"
    },
    {
      title: "devUI codepen",
      url: "https://codepen.io/co0kie",
      src: "../assets/codepen.svg"
    }
  ];
  const STYLES = [];
  for (const STYLE of STYLES)
    $$result.styles.add(STYLE);
  return renderTemplate`${maybeRenderHead($$result)}<div class="astro-UJ2ARPL7">
  ${socialMedia.map((item) => renderTemplate`${renderComponent($$result, "SocialList", $$SocialList, { "title": item.title, "url": item.url, "src": item.src, "class": "astro-UJ2ARPL7" })}`)}
</div>
`;
});

const $$file$d = "C:/Project/astro/jerecho/src/components/SocialMedia.astro";
const $$url$d = undefined;

const $$module1$5 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  $$metadata: $$metadata$d,
  default: $$SocialMedia,
  file: $$file$d,
  url: $$url$d
}, Symbol.toStringTag, { value: 'Module' }));

const $$metadata$c = createMetadata("/@fs/C:/Project/astro/jerecho/src/components/Footer.astro", { modules: [{ module: $$module1$5, specifier: "./SocialMedia.astro", assert: {} }], hydratedComponents: [], clientOnlyComponents: [], hydrationDirectives: /* @__PURE__ */ new Set([]), hoisted: [] });
const $$Astro$c = createAstro("/@fs/C:/Project/astro/jerecho/src/components/Footer.astro", "https://j3rech0.netlify.app/", "file:///C:/Project/astro/jerecho/");
const $$Footer = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$c, $$props, $$slots);
  Astro2.self = $$Footer;
  const STYLES = [];
  for (const STYLE of STYLES)
    $$result.styles.add(STYLE);
  return renderTemplate`${maybeRenderHead($$result)}<footer class="footer astro-XOV5JXNG">
  ${renderComponent($$result, "SocialMedia", $$SocialMedia, { "class": "astro-XOV5JXNG" })}
</footer>
<!-- To do's -->
<!-- Add work experiences -->
<!-- Add animation -->
<!-- Add UI framework? -->
<!-- https://www.youtube.com/watch?v=T33NN_pPeNI -->
`;
});

const $$file$c = "C:/Project/astro/jerecho/src/components/Footer.astro";
const $$url$c = undefined;

const $$module1$4 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  $$metadata: $$metadata$c,
  default: $$Footer,
  file: $$file$c,
  url: $$url$c
}, Symbol.toStringTag, { value: 'Module' }));

var __freeze$1 = Object.freeze;
var __defProp$1 = Object.defineProperty;
var __template$1 = (cooked, raw) => __freeze$1(__defProp$1(cooked, "raw", { value: __freeze$1(raw || cooked.slice()) }));
var _a$1;
const $$metadata$b = createMetadata("/@fs/C:/Project/astro/jerecho/src/components/MetaHead.astro", { modules: [], hydratedComponents: [], clientOnlyComponents: [], hydrationDirectives: /* @__PURE__ */ new Set([]), hoisted: [] });
const $$Astro$b = createAstro("/@fs/C:/Project/astro/jerecho/src/components/MetaHead.astro", "https://j3rech0.netlify.app/", "file:///C:/Project/astro/jerecho/");
const $$MetaHead = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$b, $$props, $$slots);
  Astro2.self = $$MetaHead;
  const {
    title = "Jech | Web Developer and designer",
    description = "My name is Jech and I'm a Freelance Web Developer and designer from the Philippines"
  } = Astro2.props;
  return renderTemplate(_a$1 || (_a$1 = __template$1(['<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width">\n<meta name="generator"', ">\n<title>", '</title>\n\n<meta name="description"', '>\n\n<!-- Open Graph Tags (Facebook) -->\n<meta property="og:type" content="website">\n<meta property="og:title"', '>\n<meta property="og:url" content="https://jerecho.com">\n<meta property="og:description"', '>\n<meta property="og:image" content="assets/og-cover.png">\n\n<link rel="icon" type="image/svg+xml" href="assets/fav.svg">\n<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n\n<link href="https://fonts.googleapis.com/css2?family=Abel&family=Roboto:wght@100&family=Rubik+Glitch&display=swap" rel="stylesheet">\n\n<!-- Google Tag Manager -->\n<script>\n  (function (w, d, s, l, i) {\n    w[l] = w[l] || [];\n    w[l].push({ "gtm.start": new Date().getTime(), event: "gtm.js" });\n    var f = d.getElementsByTagName(s)[0],\n      j = d.createElement(s),\n      dl = l != "dataLayer" ? "&l=" + l : "";\n    j.async = true;\n    j.src = "https://www.googletagmanager.com/gtm.js?id=" + i + dl;\n    f.parentNode.insertBefore(j, f);\n  })(window, document, "script", "dataLayer", "GTM-TV8NVWT");\n<\/script>\n<!-- End Google Tag Manager -->\n'])), addAttribute(Astro2.generator, "content"), title, addAttribute(description, "content"), addAttribute(title, "content"), addAttribute(description, "content"));
});

const $$file$b = "C:/Project/astro/jerecho/src/components/MetaHead.astro";
const $$url$b = undefined;

const $$module1$3 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  $$metadata: $$metadata$b,
  default: $$MetaHead,
  file: $$file$b,
  url: $$url$b
}, Symbol.toStringTag, { value: 'Module' }));

const $$metadata$a = createMetadata("/@fs/C:/Project/astro/jerecho/src/components/Nav.astro", { modules: [], hydratedComponents: [], clientOnlyComponents: [], hydrationDirectives: /* @__PURE__ */ new Set([]), hoisted: [] });
const $$Astro$a = createAstro("/@fs/C:/Project/astro/jerecho/src/components/Nav.astro", "https://j3rech0.netlify.app/", "file:///C:/Project/astro/jerecho/");
const $$Nav = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$a, $$props, $$slots);
  Astro2.self = $$Nav;
  const STYLES = [];
  for (const STYLE of STYLES)
    $$result.styles.add(STYLE);
  return renderTemplate`${maybeRenderHead($$result)}<nav class="navigation astro-35E2SQSZ">
  <a class="link astro-35E2SQSZ" href="/" title="Hi">
    <div class="logo astro-35E2SQSZ">
      <svg width="29" height="44" viewBox="0 0 29 44" fill="none" xmlns="http://www.w3.org/2000/svg" class="astro-35E2SQSZ">
        <path fill-rule="evenodd" clip-rule="evenodd" d="M22 5.18868C22 5.25818 21.9986 5.32737 21.9959 5.39621H22V38.8113V39.0188H21.9959C21.887 41.7883 19.6074 44 16.8113 44C14.0152 44 11.7356 41.7883 11.6267 39.0188H11.6226V38.8113V5.39621H11.6267C11.624 5.32737 11.6226 5.25818 11.6226 5.18868C11.6226 2.32305 13.9457 0 16.8113 0C19.6769 0 22 2.32305 22 5.18868ZM27.1218 6.50086C26.1487 5.5278 24.8289 4.98114 23.4528 4.98114V10.1698L23.4528 15.3585C24.8289 15.3585 26.1487 14.8118 27.1218 13.8388C28.0948 12.8657 28.6415 11.5459 28.6415 10.1698C28.6415 8.79369 28.0948 7.47393 27.1218 6.50086ZM10.3733 26.9811C10.376 26.9123 10.3774 26.8431 10.3774 26.7736C10.3774 23.908 8.05431 21.5849 5.18868 21.5849C2.32305 21.5849 0 23.908 0 26.7736C0 26.8431 0.00136664 26.9123 0.00407452 26.9811H0V33.2076H0.0369727C0.0125602 33.4117 0 33.6195 0 33.8302C0 36.6958 2.32305 39.0189 5.18868 39.0189C8.05431 39.0189 10.3774 36.6958 10.3774 33.8302C10.3774 33.6195 10.3648 33.4117 10.3404 33.2076H10.3774V26.9811H10.3733Z" fill="url(#paint0_linear_814_7)" class="astro-35E2SQSZ"></path>
        <defs class="astro-35E2SQSZ">
          <linearGradient id="paint0_linear_814_7" x1="24.3453" y1="-0.954717" x2="1.43207" y2="43.917" gradientUnits="userSpaceOnUse" class="astro-35E2SQSZ">
            <stop stop-color="white" class="astro-35E2SQSZ"></stop>
            <stop offset="1" stop-color="white" class="astro-35E2SQSZ"></stop>
          </linearGradient>
        </defs>
      </svg>
    </div>
  </a>
  <a href="mailto:subs373n@gmail.com?subject=Hi" class="astro-35E2SQSZ">Contact</a>
</nav>

`;
});

const $$file$a = "C:/Project/astro/jerecho/src/components/Nav.astro";
const $$url$a = undefined;

const $$module2$2 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  $$metadata: $$metadata$a,
  default: $$Nav,
  file: $$file$a,
  url: $$url$a
}, Symbol.toStringTag, { value: 'Module' }));

const $$metadata$9 = createMetadata("/@fs/C:/Project/astro/jerecho/src/components/Header.astro", { modules: [{ module: $$module2$2, specifier: "./Nav.astro", assert: {} }], hydratedComponents: [], clientOnlyComponents: [], hydrationDirectives: /* @__PURE__ */ new Set([]), hoisted: [] });
const $$Astro$9 = createAstro("/@fs/C:/Project/astro/jerecho/src/components/Header.astro", "https://j3rech0.netlify.app/", "file:///C:/Project/astro/jerecho/");
const $$Header = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$9, $$props, $$slots);
  Astro2.self = $$Header;
  return renderTemplate`${maybeRenderHead($$result)}<header>
  ${renderComponent($$result, "Nav", $$Nav, {})}
</header>`;
});

const $$file$9 = "C:/Project/astro/jerecho/src/components/Header.astro";
const $$url$9 = undefined;

const $$module3$2 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  $$metadata: $$metadata$9,
  default: $$Header,
  file: $$file$9,
  url: $$url$9
}, Symbol.toStringTag, { value: 'Module' }));

const $$metadata$8 = createMetadata("/@fs/C:/Project/astro/jerecho/src/layouts/Splash.astro", { modules: [{ module: $$module1$4, specifier: "../components/Footer.astro", assert: {} }, { module: $$module1$3, specifier: "../components/MetaHead.astro", assert: {} }, { module: $$module3$2, specifier: "../components/Header.astro", assert: {} }], hydratedComponents: [], clientOnlyComponents: [], hydrationDirectives: /* @__PURE__ */ new Set([]), hoisted: [] });
const $$Astro$8 = createAstro("/@fs/C:/Project/astro/jerecho/src/layouts/Splash.astro", "https://j3rech0.netlify.app/", "file:///C:/Project/astro/jerecho/");
const $$Splash = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$8, $$props, $$slots);
  Astro2.self = $$Splash;
  const STYLES = [];
  for (const STYLE of STYLES)
    $$result.styles.add(STYLE);
  return renderTemplate`<html lang="en" class="astro-JUJFZSQX">
  <head>
    ${renderComponent($$result, "MetaHead", $$MetaHead, { "title": "Jech | Web Developer and designer", "description": "My name is Jech and I'm a Freelance Web Developer and designer from the Philippines", "class": "astro-JUJFZSQX" })}
    
  ${renderHead($$result)}</head>
  <body class="astro-JUJFZSQX">
    <div class="container-grid astro-JUJFZSQX">
      ${renderComponent($$result, "Header", $$Header, { "class": "astro-JUJFZSQX" })}
      ${renderSlot($$result, $$slots["default"])}
      ${renderComponent($$result, "Footer", $$Footer, { "class": "astro-JUJFZSQX" })}
    </div>
  </body></html>`;
});

const $$file$8 = "C:/Project/astro/jerecho/src/layouts/Splash.astro";
const $$url$8 = undefined;

const $$module1$2 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  $$metadata: $$metadata$8,
  default: $$Splash,
  file: $$file$8,
  url: $$url$8
}, Symbol.toStringTag, { value: 'Module' }));

const html$1 = "";

				const frontmatter$1 = {"title":"Hi, my name is","name":"Jech","slogan":"Web Developer / Designer"};
				const file$1 = "C:/Project/astro/jerecho/src/pages/home/intro.md";
				const url$1 = "/home/intro";
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
					return contentFragment;
				}
				Content$1[Symbol.for('astro.needsHeadRendering')] = true;

const _page1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
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

const $$metadata$7 = createMetadata("/@fs/C:/Project/astro/jerecho/src/components/Intro.astro", { modules: [{ module: _page1, specifier: "../pages/home/intro.md", assert: {} }], hydratedComponents: [], clientOnlyComponents: [], hydrationDirectives: /* @__PURE__ */ new Set([]), hoisted: [] });
const $$Astro$7 = createAstro("/@fs/C:/Project/astro/jerecho/src/components/Intro.astro", "https://j3rech0.netlify.app/", "file:///C:/Project/astro/jerecho/");
const $$Intro = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$7, $$props, $$slots);
  Astro2.self = $$Intro;
  const STYLES = [];
  for (const STYLE of STYLES)
    $$result.styles.add(STYLE);
  return renderTemplate`${maybeRenderHead($$result)}<div class="splash-container astro-4PQBGXUR">
  <div class="card-splash astro-4PQBGXUR">
    <h1${addAttribute(frontmatter$1.title + " " + frontmatter$1.name, "data-copy")} class="astro-4PQBGXUR">
      ${frontmatter$1.title}
      <span class="astro-4PQBGXUR">${frontmatter$1.name}</span>
    </h1>
    <h5${addAttribute(frontmatter$1.slogan, "data-copy-sub")} class="astro-4PQBGXUR">
      ${frontmatter$1.slogan}
    </h5>
  </div>
  <svg class="water astro-4PQBGXUR">
    <filter id="turbulence" x="0" y="0" width="100%" height="100%" class="astro-4PQBGXUR">
      <feTurbulence id="sea-filter" numOctaves="3" seed="1" baseFrequency="0.02 0.05" class="astro-4PQBGXUR"></feTurbulence>
      <feDisplacementMap scale="15" in="SourceGraphic" class="astro-4PQBGXUR"></feDisplacementMap>
      <animate xlink:href="#sea-filter" attributeName="baseFrequency" dur="60s" keyTimes="0;0.5;1" values="0.02 0.06;0.04 0.08;0.02 0.06" repeatCount="indefinite" class="astro-4PQBGXUR"></animate>
    </filter>
  </svg>
  <div class="water astro-4PQBGXUR"></div>
</div>

`;
});

const $$file$7 = "C:/Project/astro/jerecho/src/components/Intro.astro";
const $$url$7 = undefined;

const $$module1$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  $$metadata: $$metadata$7,
  default: $$Intro,
  file: $$file$7,
  url: $$url$7
}, Symbol.toStringTag, { value: 'Module' }));

const $$metadata$6 = createMetadata("/@fs/C:/Project/astro/jerecho/src/components/Coconut.astro", { modules: [], hydratedComponents: [], clientOnlyComponents: [], hydrationDirectives: /* @__PURE__ */ new Set([]), hoisted: [] });
const $$Astro$6 = createAstro("/@fs/C:/Project/astro/jerecho/src/components/Coconut.astro", "https://j3rech0.netlify.app/", "file:///C:/Project/astro/jerecho/");
const $$Coconut = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$6, $$props, $$slots);
  Astro2.self = $$Coconut;
  const STYLES = [];
  for (const STYLE of STYLES)
    $$result.styles.add(STYLE);
  return renderTemplate`${maybeRenderHead($$result)}<div class="coconutSVG astro-P2FD2XHR">
  <img src="../assets/coconut.svg" alt="" width="328" height="399" class="astro-P2FD2XHR">
</div>

`;
});

const $$file$6 = "C:/Project/astro/jerecho/src/components/Coconut.astro";
const $$url$6 = undefined;

const $$module2$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  $$metadata: $$metadata$6,
  default: $$Coconut,
  file: $$file$6,
  url: $$url$6
}, Symbol.toStringTag, { value: 'Module' }));

const html = "<ul>\n<li><strong>Freelance</strong> <em>2022 - PRESENT</em></li>\n<li><strong>Arcanys Inc.</strong> <em>Web developer</em> <em>2012 - 2022</em></li>\n<li><strong>Techforge I.T. Solutions, Inc.</strong> <em>Web developer</em> <em>2010 - 2012</em></li>\n</ul>";

				const frontmatter = {"heading":"Work Experience"};
				const file = "C:/Project/astro/jerecho/src/pages/home/work.md";
				const url = "/home/work";
				function rawContent() {
					return "\r\n- **Freelance** _2022 - PRESENT_\r\n- **Arcanys Inc.** _Web developer_ _2012 - 2022_\r\n- **Techforge I.T. Solutions, Inc.** _Web developer_ _2010 - 2012_\r\n";
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
					return contentFragment;
				}
				Content[Symbol.for('astro.needsHeadRendering')] = true;

const _page2 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
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

const $$metadata$5 = createMetadata("/@fs/C:/Project/astro/jerecho/src/components/Link.astro", { modules: [], hydratedComponents: [], clientOnlyComponents: [], hydrationDirectives: /* @__PURE__ */ new Set([]), hoisted: [] });
const $$Astro$5 = createAstro("/@fs/C:/Project/astro/jerecho/src/components/Link.astro", "https://j3rech0.netlify.app/", "file:///C:/Project/astro/jerecho/");
const $$Link = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$5, $$props, $$slots);
  Astro2.self = $$Link;
  const { text, className, url, title, hasIcon } = Astro2.props;
  const STYLES = [];
  for (const STYLE of STYLES)
    $$result.styles.add(STYLE);
  return renderTemplate`${maybeRenderHead($$result)}<a${addAttribute(url || "/", "href")}${addAttribute((className && className + " flex") + " astro-OOD27VIW", "class")}${addAttribute(title, "title")}>${text}
  ${hasIcon ? renderTemplate`${renderComponent($$result, "Fragment", Fragment, {}, { "default": () => renderTemplate`${unescapeHTML(hasIcon)}` })}` : ""}
</a>

`;
});

const $$file$5 = "C:/Project/astro/jerecho/src/components/Link.astro";
const $$url$5 = undefined;

const $$module3$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  $$metadata: $$metadata$5,
  default: $$Link,
  file: $$file$5,
  url: $$url$5
}, Symbol.toStringTag, { value: 'Module' }));

const $$metadata$4 = createMetadata("/@fs/C:/Project/astro/jerecho/src/components/WorkExperience.astro", { modules: [{ module: _page2, specifier: "../pages/home/work.md", assert: {} }, { module: _page2, specifier: "../pages/home/work.md", assert: {} }, { module: $$module3$1, specifier: "./Link.astro", assert: {} }], hydratedComponents: [], clientOnlyComponents: [], hydrationDirectives: /* @__PURE__ */ new Set([]), hoisted: [] });
const $$Astro$4 = createAstro("/@fs/C:/Project/astro/jerecho/src/components/WorkExperience.astro", "https://j3rech0.netlify.app/", "file:///C:/Project/astro/jerecho/");
const $$WorkExperience = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$4, $$props, $$slots);
  Astro2.self = $$WorkExperience;
  const ctaArrow = `<svg
        width="18"
        height="16"
        viewBox="0 0 18 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M1 8H17M10 1L17 8L10 15"
          stroke="black"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>`;
  const STYLES = [];
  for (const STYLE of STYLES)
    $$result.styles.add(STYLE);
  return renderTemplate`${maybeRenderHead($$result)}<div class="card-list astro-EQKH2JVI">
  <p class="astro-EQKH2JVI">${frontmatter.heading}</p>
  ${renderComponent($$result, "Work", Content, { "class": "astro-EQKH2JVI" })}
  ${renderComponent($$result, "Link", $$Link, { "url": "/404", "text": "View Portfolio", "className": "cta astro-EQKH2JVI", "title": "View Portfolio", "hasIcon": ctaArrow })}
</div>



`;
});

const $$file$4 = "C:/Project/astro/jerecho/src/components/WorkExperience.astro";
const $$url$4 = undefined;

const $$module3 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  $$metadata: $$metadata$4,
  default: $$WorkExperience,
  file: $$file$4,
  url: $$url$4
}, Symbol.toStringTag, { value: 'Module' }));

var __freeze = Object.freeze;
var __defProp = Object.defineProperty;
var __template = (cooked, raw) => __freeze(__defProp(cooked, "raw", { value: __freeze(raw || cooked.slice()) }));
var _a;
const $$metadata$3 = createMetadata("/@fs/C:/Project/astro/jerecho/src/components/TopFold.astro", { modules: [{ module: $$module1$1, specifier: "../components/Intro.astro", assert: {} }, { module: $$module2$1, specifier: "../components/Coconut.astro", assert: {} }, { module: $$module3, specifier: "./WorkExperience.astro", assert: {} }], hydratedComponents: [], clientOnlyComponents: [], hydrationDirectives: /* @__PURE__ */ new Set([]), hoisted: [] });
const $$Astro$3 = createAstro("/@fs/C:/Project/astro/jerecho/src/components/TopFold.astro", "https://j3rech0.netlify.app/", "file:///C:/Project/astro/jerecho/");
const $$TopFold = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$3, $$props, $$slots);
  Astro2.self = $$TopFold;
  const STYLES = [];
  for (const STYLE of STYLES)
    $$result.styles.add(STYLE);
  return renderTemplate(_a || (_a = __template(["", '<div class="top-fold astro-ZQYNGYTV">\n  ', "\n  ", "\n  ", '\n  <div class="fakeCursor astro-ZQYNGYTV" style="--opacity; --top; --left">\n    <img src="../assets/fake_cursor.svg" alt="" width="16" height="21" class="astro-ZQYNGYTV">\n  </div>\n</div>\n\n<script defer>\n  const target = document.querySelector(".main-container");\n  const fakeCursor = document.querySelector(".fakeCursor");\n  const placeCursor = (x, y) => {\n    fakeCursor.style.setProperty("--top", y + "px");\n    fakeCursor.style.setProperty("--left", x + "px");\n  };\n\n  target?.addEventListener("mousemove", (event) => {\n    let opaque = event.clientY / 200 - 1.5;\n    let top = event.clientY / 1.76;\n    fakeCursor.style.setProperty("--opacity", opaque);\n    placeCursor(top, event.clientX);\n  });\n\n  target?.addEventListener("mouseleave", () => {\n    fakeCursor.style.setProperty("--opacity", 0);\n  });\n<\/script>\n\n'])), maybeRenderHead($$result), renderComponent($$result, "Coconut", $$Coconut, { "class": "astro-ZQYNGYTV" }), renderComponent($$result, "Intro", $$Intro, { "class": "astro-ZQYNGYTV" }), renderComponent($$result, "WorkExperience", $$WorkExperience, { "class": "astro-ZQYNGYTV" }));
});

const $$file$3 = "C:/Project/astro/jerecho/src/components/TopFold.astro";
const $$url$3 = undefined;

const $$module1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  $$metadata: $$metadata$3,
  default: $$TopFold,
  file: $$file$3,
  url: $$url$3
}, Symbol.toStringTag, { value: 'Module' }));

const $$metadata$2 = createMetadata("/@fs/C:/Project/astro/jerecho/src/components/MainContainer.astro", { modules: [{ module: $$module1, specifier: "./TopFold.astro", assert: {} }], hydratedComponents: [], clientOnlyComponents: [], hydrationDirectives: /* @__PURE__ */ new Set([]), hoisted: [] });
const $$Astro$2 = createAstro("/@fs/C:/Project/astro/jerecho/src/components/MainContainer.astro", "https://j3rech0.netlify.app/", "file:///C:/Project/astro/jerecho/");
const $$MainContainer = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$2, $$props, $$slots);
  Astro2.self = $$MainContainer;
  const STYLES = [];
  for (const STYLE of STYLES)
    $$result.styles.add(STYLE);
  return renderTemplate`${maybeRenderHead($$result)}<main class="main-container astro-LNECDEXJ">
  ${renderComponent($$result, "TopFold", $$TopFold, { "class": "astro-LNECDEXJ" })}
</main>

`;
});

const $$file$2 = "C:/Project/astro/jerecho/src/components/MainContainer.astro";
const $$url$2 = undefined;

const $$module2 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  $$metadata: $$metadata$2,
  default: $$MainContainer,
  file: $$file$2,
  url: $$url$2
}, Symbol.toStringTag, { value: 'Module' }));

const $$metadata$1 = createMetadata("/@fs/C:/Project/astro/jerecho/src/pages/index.astro", { modules: [{ module: $$module1$2, specifier: "../layouts/Splash.astro", assert: {} }, { module: $$module2, specifier: "../components/MainContainer.astro", assert: {} }], hydratedComponents: [], clientOnlyComponents: [], hydrationDirectives: /* @__PURE__ */ new Set([]), hoisted: [] });
const $$Astro$1 = createAstro("/@fs/C:/Project/astro/jerecho/src/pages/index.astro", "https://j3rech0.netlify.app/", "file:///C:/Project/astro/jerecho/");
const $$Index = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$1, $$props, $$slots);
  Astro2.self = $$Index;
  return renderTemplate`${renderComponent($$result, "Splash", $$Splash, {}, { "default": () => renderTemplate`${renderComponent($$result, "Main", $$MainContainer, {})}` })}

<!-- Google Tag Manager (noscript) -->
${maybeRenderHead($$result)}<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-TV8NVWT" height="0" width="0" style="display:none;visibility:hidden"></iframe>
</noscript>
<!-- End Google Tag Manager (noscript) -->`;
});

const $$file$1 = "C:/Project/astro/jerecho/src/pages/index.astro";
const $$url$1 = "";

const _page0 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  $$metadata: $$metadata$1,
  default: $$Index,
  file: $$file$1,
  url: $$url$1
}, Symbol.toStringTag, { value: 'Module' }));

const $$metadata = createMetadata("/@fs/C:/Project/astro/jerecho/src/pages/404.astro", { modules: [{ module: $$module1$3, specifier: "../components/MetaHead.astro", assert: {} }, { module: $$module2$2, specifier: "../components/Nav.astro", assert: {} }], hydratedComponents: [], clientOnlyComponents: [], hydrationDirectives: /* @__PURE__ */ new Set([]), hoisted: [] });
const $$Astro = createAstro("/@fs/C:/Project/astro/jerecho/src/pages/404.astro", "https://j3rech0.netlify.app/", "file:///C:/Project/astro/jerecho/");
const $$404 = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$404;
  const STYLES = [];
  for (const STYLE of STYLES)
    $$result.styles.add(STYLE);
  return renderTemplate`<html lang="en" class="astro-KLJ6CSCR">
  <head>
    ${renderComponent($$result, "MetaHead", $$MetaHead, { "title": "Jech | Not Found", "class": "astro-KLJ6CSCR" })}
    
  ${renderHead($$result)}</head>
  <body class="astro-KLJ6CSCR">
    ${renderComponent($$result, "Nav", $$Nav, { "class": "astro-KLJ6CSCR" })}
    <div class="astro-KLJ6CSCR">
      <h1 class="astro-KLJ6CSCR">Page Not Found</h1>

      <a href="/" class="astro-KLJ6CSCR">back</a>
    </div>
  </body></html>`;
});

const $$file = "C:/Project/astro/jerecho/src/pages/404.astro";
const $$url = "/404";

const _page3 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  $$metadata,
  default: $$404,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const pageMap = new Map([['src/pages/index.astro', _page0],['src/pages/home/intro.md', _page1],['src/pages/home/work.md', _page2],['src/pages/404.astro', _page3],]);
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

const _manifest = Object.assign(deserializeManifest({"adapterName":"@astrojs/netlify/functions","routes":[{"file":"","links":["assets/404-index.4a63bfed.css","assets/index.38fdbfea.css"],"scripts":[],"routeData":{"route":"/","type":"page","pattern":"^\\/$","segments":[],"params":[],"component":"src/pages/index.astro","pathname":"/","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"routeData":{"route":"/home/intro","type":"page","pattern":"^\\/home\\/intro\\/?$","segments":[[{"content":"home","dynamic":false,"spread":false}],[{"content":"intro","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/home/intro.md","pathname":"/home/intro","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"routeData":{"route":"/home/work","type":"page","pattern":"^\\/home\\/work\\/?$","segments":[[{"content":"home","dynamic":false,"spread":false}],[{"content":"work","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/home/work.md","pathname":"/home/work","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":["assets/404.d05432fa.css","assets/404-index.4a63bfed.css"],"scripts":[],"routeData":{"route":"/404","type":"page","pattern":"^\\/404\\/?$","segments":[[{"content":"404","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/404.astro","pathname":"/404","_meta":{"trailingSlash":"ignore"}}}],"site":"https://j3rech0.netlify.app/","base":"/","markdown":{"drafts":false,"syntaxHighlight":"shiki","shikiConfig":{"langs":[],"theme":"github-dark","wrap":false},"remarkPlugins":[],"rehypePlugins":[],"remarkRehype":{},"extendDefaultPlugins":false,"isAstroFlavoredMd":false},"pageMap":null,"renderers":[],"entryModules":{"\u0000@astrojs-ssr-virtual-entry":"entry.mjs","astro:scripts/before-hydration.js":""},"assets":["/assets/404.d05432fa.css","/assets/404-index.4a63bfed.css","/assets/index.38fdbfea.css","/assets/coconut.svg","/assets/codepen.svg","/assets/cta-arrow.svg","/assets/dribbble.svg","/assets/fake_cursor.svg","/assets/fav.svg","/assets/mountains.svg","/assets/og-cover.png","/assets/youtube.svg"]}), {
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
