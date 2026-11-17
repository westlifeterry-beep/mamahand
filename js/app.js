/* Momhandmade. 前台選色訂購與賣家後台。密碼只以雜湊比對，不寫在畫面文字裡。 */
(function () {
  const IDLE_MS = 20 * 60 * 1000;
  const ABS_MS = 8 * 60 * 60 * 1000;
  const SESSION_KEY = "mom_session_v3";
  const GUARD_KEY = "mom_guard_v3";
  const SETTINGS_KEY = "mom_settings_v3";
  const ORDERS_KEY = "mom_orders_v3";
  const MESSAGES_KEY = "mom_messages_v3";
  const AUTH_KEY = "mom_auth_v3";
  const CART_KEY = "mom_cart_v3";
  const BUYER_KEY = "mom_buyer_v3";
  const SECURE_KEY = "mom_secure_v3";

  const SHAPES = {
    flower: "花朵",
    zongzi: "粽子／束口袋",
    bear: "圓形小物",
    bandana: "帽子／頭巾",
    tote: "提袋",
    charm: "鑰匙圈"
  };

  const palette24 = [
    { code: "#40", name: "米白", hex: "#EFECE6" },
    { code: "#08", name: "米色", hex: "#DFCBB5" },
    { code: "#02", name: "奶油", hex: "#F2E1B3" },
    { code: "#23", name: "杏桃", hex: "#E5B045" },
    { code: "#17", name: "灰棕", hex: "#BCA89F" },
    { code: "#19", name: "咖啡", hex: "#9A6B45" },
    { code: "#03", name: "薄荷", hex: "#B8DDD1" },
    { code: "#06", name: "豆綠", hex: "#A4AE77" },
    { code: "#32", name: "松綠", hex: "#1E7A50" },
    { code: "#33", name: "墨綠", hex: "#4B5338" },
    { code: "#35", name: "石墨", hex: "#716D74" },
    { code: "#21", name: "深棕", hex: "#583E3A" },
    { code: "#09", name: "裸粉", hex: "#ECC3BA" },
    { code: "#10", name: "粉紅", hex: "#E5A0A6" },
    { code: "#12", name: "藕荷", hex: "#C68597" },
    { code: "#13", name: "薰衣草", hex: "#B8A3CE" },
    { code: "#36", name: "鮭魚", hex: "#E06243" },
    { code: "#38", name: "紅色", hex: "#B81D24" },
    { code: "#04", name: "天藍", hex: "#9EC1C7" },
    { code: "#26", name: "淺灰藍", hex: "#889EC4" },
    { code: "#30", name: "孔雀藍", hex: "#5D9BB8" },
    { code: "#34", name: "鋼青", hex: "#5B6E86" },
    { code: "#28", name: "寶藍", hex: "#1C3F85" },
    { code: "#39", name: "黑色", hex: "#232730" }
  ];
  const palette20 = [
    { code: "#302", name: "淡米色", hex: "#EAD7C3" },
    { code: "#321", name: "淡黃色", hex: "#DFD2AC" },
    { code: "#303", name: "灰米色", hex: "#C8B9AE" },
    { code: "#311", name: "芥末黃", hex: "#D8A456" },
    { code: "#337", name: "鵝黃", hex: "#F6E27F" },
    { code: "#307", name: "薄荷綠", hex: "#C2CBC4" },
    { code: "#317", name: "檸檬綠", hex: "#DDE19E" },
    { code: "#325", name: "青色", hex: "#7FA8A0" },
    { code: "#328", name: "亮綠", hex: "#5FB057" },
    { code: "#338", name: "墨綠", hex: "#344E46" },
    { code: "#326", name: "軍綠", hex: "#585838" },
    { code: "#341", name: "嬰兒藍", hex: "#9EB8CC" },
    { code: "#340", name: "藍寶石", hex: "#418E9E" },
    { code: "#319", name: "墨藍", hex: "#354856" },
    { code: "#346", name: "櫻花橘", hex: "#D46D6A" },
    { code: "#322", name: "桃紅", hex: "#C43666" },
    { code: "#343", name: "薰衣草", hex: "#8F7B9C" },
    { code: "#330", name: "亮橘", hex: "#DF6432" },
    { code: "#313", name: "黑色", hex: "#1E1D1B" },
    { code: "#320", name: "白色", hex: "#EFEFEF" }
  ];

  const catalog = window.MOM_CATALOG || { products: [], settings: {} };
  let auth = Object.assign({}, window.MOM_AUTH || {});
  let products = (catalog.products || []).map(sanitizeProduct).filter(Boolean);
  let settings = cleanSettings(catalog.settings || {});
  let orders = [];
  let messages = [];
  let cart = [];
  let currentId = products[0] ? products[0].id : null;
  let selections = [];
  let activePart = 0;
  let paletteName = "24";
  let stage = "gallery";
  let galleryIndex = 0;
  let qty = 1;
  let shipping = "cvs";
  let orderFilter = "全部";
  let messageFilter = "all";
  let authVersion = 0;
  let passwordConfigured = false;
  let dirty = false;
  let busy = false;
  let confirmResolve = null;
  let toastTimer = null;
  let lastMessageAt = 0;

  const $ = (id) => document.getElementById(id);

  function clip(value, max) {
    return String(value ?? "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
  }
  function clipText(value, max) {
    return String(value ?? "").replace(/[<>]/g, "").trim().slice(0, max);
  }
  function safeHex(value) {
    return /^#[0-9A-Fa-f]{6}$/.test(String(value || "")) ? String(value) : "#EFECE6";
  }
  function isSafeImage(src) {
    if (typeof src !== "string" || src.length > 2_000_000) return false;
    if (/^images\/[A-Za-z0-9._-]+$/.test(src)) return true;
    return /^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(src);
  }
  function sanitizeProduct(raw) {
    if (!raw || typeof raw !== "object") return null;
    const id = Number(raw.id);
    if (!Number.isFinite(id)) return null;
    const parts = (Array.isArray(raw.parts) ? raw.parts : ["主體顏色"]).map((x) => clip(x, 20)).filter(Boolean).slice(0, 3);
    return {
      id,
      name: clip(raw.name, 80) || "未命名商品",
      price: Math.max(0, Math.min(999999, parseInt(raw.price, 10) || 0)),
      icon: clip(raw.icon, 8) || "🧶",
      shape: SHAPES[raw.shape] ? raw.shape : "flower",
      customizable: raw.customizable !== false && raw.customizable !== "false",
      parts: parts.length ? parts : ["主體顏色"],
      defaultCodes: (Array.isArray(raw.defaultCodes) ? raw.defaultCodes : []).map((x) => clip(x, 8)).slice(0, 3),
      images: (Array.isArray(raw.images) ? raw.images : []).filter(isSafeImage).slice(0, 8)
    };
  }
  function cleanSettings(raw) {
    const src = raw || {};
    const fee = parseInt(src.shipFee, 10);
    const gas = String(src.gasWebhookUrl || "");
    return {
      bankName: clip(src.bankName, 40),
      bankAccount: clip(src.bankAccount, 40),
      bankOwner: clip(src.bankOwner, 40),
      sellerNotifyEmail: clip(src.sellerNotifyEmail, 80),
      gasWebhookUrl: gas.startsWith("https://script.google.com/") ? gas : "",
      shipFee: Number.isFinite(fee) && fee >= 0 && fee <= 999 ? fee : 60
    };
  }
  function loadJson(key) {
    try { return JSON.parse(localStorage.getItem(key) || "null"); } catch (e) { return null; }
  }
  function saveJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* 滿了就只留在記憶體 */ }
  }
  function money(n) { return "NT$ " + Number(n || 0).toLocaleString("zh-TW"); }
  function current() { return products.find((p) => p.id === currentId) || products[0] || null; }
  function findColor(code) {
    return palette24.find((c) => c.code === code) || palette20.find((c) => c.code === code) || palette24[0];
  }
  function iconFor(product) {
    const icon = (product.icon || "").trim();
    if (icon && icon !== "🌷") return icon;
    const name = product.name || "";
    const rules = [["公雞", "🐓"], ["羊駝", "🦙"], ["烏龜", "🐢"], ["南瓜", "🎃"], ["番茄", "🍅"], ["兔子", "🐰"], ["小熊", "🧸"], ["鑰匙", "🔑"], ["髮帶", "🎀"], ["帽", "🧢"], ["頭巾", "🧣"], ["提籃", "🧺"], ["提袋", "👜"], ["花束", "💐"], ["粽", "🍙"], ["雛菊", "🌼"], ["怪獸", "👀"], ["花", "🌸"]];
    for (const pair of rules) if (name.includes(pair[0])) return pair[1];
    return icon || "🧶";
  }
  function selectionList(product) {
    const item = product || current();
    if (!item) return [];
    if (!item.customizable) return [{ partName: "款式配色", code: "固定", name: "依實品照片", hex: "#A4AE77" }];
    return item.parts.map((partName, index) => {
      const color = (item === current() ? selections[index] : null) || findColor(item.defaultCodes[index]);
      return { partName, code: color.code, name: color.name, hex: color.hex };
    });
  }
  function shipFee() { return shipping === "cvs" ? Number(settings.shipFee || 0) : 0; }

  function showToast(text) {
    const el = $("toast");
    el.textContent = text;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 4200);
  }
  function openModal(id) {
    const el = $(id);
    if (!el) return;
    el.hidden = false;
    document.body.classList.add("modal-open");
  }
  function closeModal(id) {
    const el = $(id);
    if (el) el.hidden = true;
    if (!document.querySelector(".modal:not([hidden])")) document.body.classList.remove("modal-open");
  }
  function ask(title, body) {
    return new Promise((resolve) => {
      confirmResolve = resolve;
      $("confirm-title").textContent = title;
      $("confirm-body").textContent = body;
      openModal("confirm-modal");
    });
  }
  function settleConfirm(value) {
    closeModal("confirm-modal");
    if (confirmResolve) confirmResolve(value);
    confirmResolve = null;
  }

  function b64ToBytes(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function bytesToB64(bytes) {
    let bin = "";
    bytes.forEach((b) => { bin += String.fromCharCode(b); });
    return btoa(bin);
  }
  async function deriveHash(password, saltB64, iterations) {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({
      name: "PBKDF2",
      salt: b64ToBytes(saltB64),
      iterations: iterations,
      hash: "SHA-256"
    }, key, 256);
    return bytesToB64(new Uint8Array(bits));
  }
  function sameText(a, b) {
    if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  }
  function guard() {
    const data = loadJson(GUARD_KEY) || { fails: 0, until: 0 };
    return { fails: Number(data.fails) || 0, until: Number(data.until) || 0 };
  }
  function lockLeft() {
    const left = guard().until - Date.now();
    return left > 0 ? left : 0;
  }
  function lockMessage() {
    const min = Math.ceil(lockLeft() / 60000);
    return "密碼錯誤太多次，請約 " + min + " 分鐘後再試。";
  }
  function recordFail() {
    const state = guard();
    state.fails += 1;
    if (state.fails >= 12) state.until = Date.now() + 60 * 60 * 1000;
    else if (state.fails >= 8) state.until = Date.now() + 15 * 60 * 1000;
    else if (state.fails >= 5) state.until = Date.now() + 2 * 60 * 1000;
    saveJson(GUARD_KEY, state);
  }
  function resetGuard() { localStorage.removeItem(GUARD_KEY); }
  function readSession() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null"); } catch (e) { return null; }
  }
  function sessionAlive() {
    const s = readSession();
    if (!s) return false;
    if (Date.now() - s.idle > IDLE_MS || Date.now() > s.abs) {
      sessionStorage.removeItem(SESSION_KEY);
      return false;
    }
    return true;
  }
  function touchSession() {
    const s = readSession();
    if (!s || !sessionAlive()) return;
    s.idle = Date.now();
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
  }
  function startSession(token) {
    const now = Date.now();
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token: token || "", start: now, idle: now, abs: now + ABS_MS }));
    paintAdminChrome();
  }
  function endSession() {
    sessionStorage.removeItem(SESSION_KEY);
    paintAdminChrome();
    closeModal("admin-modal");
  }
  function mustUseServer() {
    if (passwordConfigured) return true;
    return localStorage.getItem(SECURE_KEY) === "1" && authVersion !== 0;
  }
  async function verifyLocal(password) {
    if (!auth.salt || !auth.hash || !auth.iterations) return false;
    const got = await deriveHash(password, auth.salt, auth.iterations);
    return sameText(got, auth.hash);
  }
  function passwordOk(password) {
    return password.length >= 10 && /[A-Za-z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);
  }
  async function setLocalPassword(password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const saltB64 = bytesToB64(salt);
    const hash = await deriveHash(password, saltB64, 100000);
    auth = { iterations: 100000, salt: saltB64, hash };
    window.MOM_AUTH = auth;
    saveJson(AUTH_KEY, auth);
  }

  async function postGas(payload, withSync) {
    const url = settings.gasWebhookUrl;
    if (!url) return null;
    const body = Object.assign({}, payload);
    const session = readSession();
    if (session && session.token) body.token = session.token;
    if (withSync) {
      body.syncState = {
        products,
        storeSettings: cleanSettings(settings),
        buyerMessages: messages,
        orders
      };
    }
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(body)
      });
      return await res.json();
    } catch (e) {
      return null;
    }
  }
  async function refreshAuthMode() {
    if (!settings.gasWebhookUrl) return;
    try {
      const sep = settings.gasWebhookUrl.includes("?") ? "&" : "?";
      const res = await fetch(settings.gasWebhookUrl + sep + "action=ping&t=" + Date.now(), { signal: AbortSignal.timeout(8000) });
      const data = await res.json();
      authVersion = data && data.authVersion === 2 ? 2 : 0;
      passwordConfigured = !!(data && data.passwordConfigured);
      if (passwordConfigured) localStorage.setItem(SECURE_KEY, "1");
      if (data && data.authVersion === 2 && data.passwordConfigured === false) localStorage.removeItem(SECURE_KEY);
    } catch (e) {
      authVersion = localStorage.getItem(SECURE_KEY) === "1" ? 2 : 0;
    }
  }

  function persist() {
    saveJson(SETTINGS_KEY, cleanSettings(settings));
    saveJson(ORDERS_KEY, orders);
    saveJson(MESSAGES_KEY, messages);
    try { sessionStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch (e) {}
  }
  function applyRemote(data) {
    if (!data || data.status !== "success") return false;
    if (Array.isArray(data.products) && data.products.length && !dirty) {
      const next = data.products.map(sanitizeProduct).filter(Boolean);
      if (next.length) products = next;
    }
    if (Array.isArray(data.orders)) {
      const map = new Map();
      data.orders.concat(orders).forEach((order) => { if (order && order.orderNo) map.set(String(order.orderNo), order); });
      orders = Array.from(map.values());
    }
    if (Array.isArray(data.buyerMessages)) {
      const map = new Map();
      data.buyerMessages.concat(messages).forEach((msg) => {
        if (!msg || msg.id == null) return;
        const prev = map.get(String(msg.id));
        if (!prev || (msg.reply && !prev.reply)) map.set(String(msg.id), msg);
      });
      messages = Array.from(map.values()).sort((a, b) => Number(b.id) - Number(a.id));
    }
    if (data.storeSettings) settings = cleanSettings(Object.assign({}, settings, data.storeSettings));
    persist();
    return true;
  }

  function svgNode(name, attrs) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", name);
    Object.keys(attrs).forEach((key) => node.setAttribute(key, attrs[key]));
    return node;
  }
  function drawPreview(colors) {
    const holder = $("stage-svg");
    holder.replaceChildren();
    const c0 = safeHex(colors[0]);
    const c1 = safeHex(colors[1] || colors[0]);
    const c2 = safeHex(colors[2] || colors[1] || colors[0]);
    const shape = (current() || {}).shape;
    const svg = svgNode("svg", { viewBox: "0 0 240 220" });
    if (shape === "flower") {
      svg.append(svgNode("circle", { cx: "120", cy: "118", r: "78", fill: c0, stroke: "rgba(0,0,0,.12)", "stroke-width": "3" }));
      for (let i = 0; i < 12; i++) {
        const g = svgNode("g", { transform: "translate(120 118) rotate(" + (i * 30) + ")" });
        g.append(svgNode("ellipse", { cx: "0", cy: "-46", rx: "14", ry: "28", fill: c1, stroke: "rgba(0,0,0,.1)", "stroke-width": "1" }));
        svg.append(g);
      }
      svg.append(svgNode("circle", { cx: "120", cy: "118", r: "22", fill: c2 }));
    } else if (shape === "zongzi") {
      svg.append(svgNode("polygon", { points: "40,170 130,36 176,186", fill: c1, stroke: "rgba(0,0,0,.15)", "stroke-width": "2" }));
      svg.append(svgNode("polygon", { points: "86,96 130,36 176,186", fill: c0 }));
      svg.append(svgNode("line", { x1: "86", y1: "96", x2: "176", y2: "186", stroke: c2, "stroke-width": "8", "stroke-linecap": "round" }));
    } else if (shape === "bandana") {
      svg.append(svgNode("polygon", { points: "120,28 28,120 212,120", fill: c0, stroke: "rgba(0,0,0,.12)", "stroke-width": "2" }));
      svg.append(svgNode("polyline", { points: "28,120 120,28 212,120", fill: "none", stroke: c1, "stroke-width": "8" }));
    } else if (shape === "tote") {
      svg.append(svgNode("path", { d: "M70 70 H170 V180 H70 Z", fill: c0, stroke: "rgba(0,0,0,.15)", "stroke-width": "3" }));
      svg.append(svgNode("path", { d: "M84 70 C84 40 156 40 156 70", fill: "none", stroke: c1, "stroke-width": "8" }));
      svg.append(svgNode("rect", { x: "70", y: "150", width: "100", height: "30", fill: c2 }));
    } else if (shape === "charm") {
      svg.append(svgNode("circle", { cx: "120", cy: "40", r: "10", fill: "none", stroke: c1, "stroke-width": "4" }));
      svg.append(svgNode("circle", { cx: "120", cy: "124", r: "62", fill: c0, stroke: "rgba(0,0,0,.12)", "stroke-width": "3" }));
      svg.append(svgNode("circle", { cx: "120", cy: "124", r: "24", fill: c2 }));
    } else {
      svg.append(svgNode("circle", { cx: "70", cy: "62", r: "24", fill: c1 }));
      svg.append(svgNode("circle", { cx: "170", cy: "62", r: "24", fill: c1 }));
      svg.append(svgNode("circle", { cx: "120", cy: "124", r: "68", fill: c0, stroke: "rgba(0,0,0,.12)", "stroke-width": "3" }));
    }
    holder.append(svg);
  }

  function renderProducts() {
    const list = $("product-list");
    const q = ($("product-search").value || "").trim();
    const left = list.scrollLeft;
    const shown = products.filter((p) => !q || p.name.includes(q) || String(p.price).includes(q));
    $("product-empty").hidden = shown.length > 0;
    list.replaceChildren();
    shown.forEach((product) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "product-card" + (product.id === currentId ? " is-on" : "");
      btn.dataset.act = "select-product";
      btn.dataset.id = String(product.id);
      const src = (product.images || [])[0];
      if (src) {
        const img = document.createElement("img");
        img.src = src;
        img.alt = "";
        btn.append(img);
      } else {
        const ph = document.createElement("div");
        ph.className = "ph";
        ph.textContent = iconFor(product);
        btn.append(ph);
      }
      const meta = document.createElement("div");
      meta.className = "meta";
      const title = document.createElement("strong");
      title.textContent = iconFor(product) + " " + product.name;
      const sub = document.createElement("div");
      sub.className = "sub";
      const price = document.createElement("span");
      price.className = "num";
      price.textContent = money(product.price);
      const pill = document.createElement("span");
      pill.className = "pill" + (product.customizable ? "" : " lock");
      pill.textContent = product.customizable ? product.parts.length + " 部位選色" : "固定配色";
      sub.append(price, pill);
      meta.append(title, sub);
      btn.append(meta);
      list.append(btn);
    });
    list.scrollLeft = left;
  }

  function renderStage() {
    const product = current();
    if (!product) return;
    $("current-title").textContent = product.name;
    $("mobile-title").textContent = product.name;
    $("current-price").textContent = money(product.price) + " / 件";
    $("mobile-price").textContent = money(product.price);
    $("qty-display").textContent = String(qty);
    $("status-pill").textContent = product.customizable ? "可選色" : "固定配色";
    const imgs = product.images || [];
    $("gallery-count").textContent = String(imgs.length);
    $("tab-svg").classList.toggle("is-on", stage === "svg");
    $("tab-gallery").classList.toggle("is-on", stage === "gallery");
    $("stage-svg").hidden = stage !== "svg";
    $("stage-gallery").hidden = stage !== "gallery";
    const colors = (product.customizable ? selections : product.parts.map((_, i) => findColor(product.defaultCodes[i]))).map((c) => c && c.hex);
    drawPreview(colors);
    if (imgs.length) {
      if (galleryIndex >= imgs.length) galleryIndex = 0;
      $("gallery-main").src = imgs[galleryIndex];
      $("gallery-main").alt = product.name + "實品照片";
      const thumbs = $("gallery-thumbs");
      thumbs.replaceChildren();
      imgs.forEach((src, index) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = index === galleryIndex ? "is-on" : "";
        b.dataset.act = "gallery-go";
        b.dataset.index = String(index);
        const img = document.createElement("img");
        img.src = src;
        img.alt = "第 " + (index + 1) + " 張";
        b.append(img);
        thumbs.append(b);
      });
    }
    $("custom-panel").hidden = !product.customizable;
    $("fixed-panel").hidden = product.customizable;
    if (!product.customizable) return;
    const grid = $("part-grid");
    grid.replaceChildren();
    product.parts.forEach((part, index) => {
      const color = selections[index] || palette24[0];
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "part" + (index === activePart ? " is-on" : "");
      btn.dataset.act = "pick-part";
      btn.dataset.index = String(index);
      const text = document.createElement("span");
      const small = document.createElement("small");
      small.textContent = "部位 " + (index + 1);
      const name = document.createElement("strong");
      name.textContent = part + "・" + color.code + " " + color.name;
      text.append(small, name);
      const sw = document.createElement("span");
      sw.className = "swatch";
      sw.style.backgroundColor = safeHex(color.hex);
      btn.append(text, sw);
      grid.append(btn);
    });
    const active = selections[activePart] || palette24[0];
    $("step3-label").textContent = "第三步・選「" + product.parts[activePart] + "」";
    $("pal-24").classList.toggle("is-on", paletteName === "24");
    $("pal-20").classList.toggle("is-on", paletteName === "20");
    $("palette-24").hidden = paletteName !== "24";
    $("palette-20").hidden = paletteName !== "20";
    const box24 = $("palette-24");
    box24.replaceChildren();
    palette24.forEach((item) => box24.append(colorButton(item, active.code, "ball")));
    const box20 = $("palette-20");
    box20.replaceChildren();
    palette20.forEach((item) => box20.append(colorButton(item, active.code, "thick")));
  }
  function colorButton(item, activeCode, kind) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.act = "pick-color";
    btn.dataset.code = item.code;
    btn.className = (kind === "ball" ? "ball" : "") + (item.code === activeCode ? " is-on" : "");
    btn.setAttribute("aria-label", item.code + " " + item.name);
    if (kind === "ball") {
      const yarn = document.createElement("span");
      yarn.className = "yarn";
      yarn.style.backgroundColor = item.hex;
      if (item.code === activeCode) yarn.textContent = "✓";
      const label = document.createElement("small");
      label.textContent = item.code + " " + item.name;
      btn.append(yarn, label);
    } else {
      const sq = document.createElement("span");
      sq.className = "sq";
      sq.style.backgroundColor = item.hex;
      const label = document.createElement("span");
      label.textContent = item.code + " " + item.name;
      btn.append(sq, label);
    }
    return btn;
  }

  function renderBank() {
    const lines = $("bank-lines");
    lines.replaceChildren();
    ["銀行代碼：" + (settings.bankName || "尚未設定"), "帳號：" + (settings.bankAccount || "尚未設定"), settings.bankOwner || ""].forEach((text) => {
      const div = document.createElement("div");
      div.textContent = text;
      lines.append(div);
    });
    const contact = $("contact-bank");
    contact.replaceChildren();
    const title = document.createElement("strong");
    title.textContent = "匯款帳戶";
    contact.append(title);
    lines.childNodes.forEach((node) => contact.append(node.cloneNode(true)));
  }
  function renderMessages() {
    const board = $("message-board");
    board.replaceChildren();
    if (!messages.length) {
      const empty = document.createElement("p");
      empty.textContent = "還沒有留言。色號或尺寸可以先在這裡問。";
      board.append(empty);
      return;
    }
    messages.forEach((msg, index) => {
      const card = document.createElement("article");
      card.className = "msg";
      const head = document.createElement("strong");
      head.textContent = (messages.length - index) + ". " + clip(msg.sender, 30);
      const time = document.createElement("div");
      time.className = "kicker";
      time.textContent = clip(msg.time, 40);
      const body = document.createElement("p");
      body.textContent = clipText(msg.content, 500);
      card.append(head, time, body);
      if (msg.reply) {
        const reply = document.createElement("div");
        reply.className = "ok";
        reply.textContent = "賣家回覆：" + clipText(msg.reply, 500);
        card.append(reply);
      } else {
        const wait = document.createElement("div");
        wait.className = "kicker";
        wait.textContent = "已收到，等待賣家回覆。";
        card.append(wait);
      }
      board.append(card);
    });
  }
  function renderCart() {
    $("cart-badge").textContent = String(cart.length);
    const box = $("cart-items");
    box.replaceChildren();
    const checkout = $("checkout");
    if (!cart.length) {
      checkout.hidden = true;
      const empty = document.createElement("p");
      empty.textContent = "訂購車還是空的。先選款式和顏色，再放進來。";
      box.append(empty);
      return;
    }
    checkout.hidden = false;
    let subtotal = 0;
    cart.forEach((item, index) => {
      const sub = item.price * item.qty;
      subtotal += sub;
      const card = document.createElement("article");
      card.className = "order";
      const title = document.createElement("strong");
      title.textContent = item.productName + " × " + item.qty;
      card.append(title);
      item.selections.forEach((sel) => {
        const line = document.createElement("div");
        const sw = document.createElement("span");
        sw.className = "swatch";
        sw.style.backgroundColor = safeHex(sel.hex);
        line.append(sw, document.createTextNode(" " + sel.partName + "：" + sel.code + " " + sel.name));
        card.append(line);
      });
      if (item.note) {
        const note = document.createElement("div");
        note.textContent = "備註：" + item.note;
        card.append(note);
      }
      const controls = document.createElement("div");
      controls.className = "chips";
      [["－", -1], ["＋", 1]].forEach((pair) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "btn";
        b.textContent = pair[0];
        b.dataset.act = "cart-qty";
        b.dataset.index = String(index);
        b.dataset.dir = String(pair[1]);
        controls.append(b);
      });
      const del = document.createElement("button");
      del.type = "button";
      del.className = "btn";
      del.textContent = "移除";
      del.dataset.act = "remove-cart";
      del.dataset.index = String(index);
      controls.append(del);
      const sum = document.createElement("div");
      sum.textContent = "小計 " + money(sub);
      card.append(controls, sum);
      box.append(card);
    });
    const fee = shipFee();
    $("sum-sub").textContent = money(subtotal);
    $("sum-ship-label").textContent = shipping === "cvs" ? "運費（超商）" : "運費（自取）";
    $("sum-ship").textContent = money(fee);
    $("sum-total").textContent = money(subtotal + fee);
    $("ship-cvs").classList.toggle("btn-dark", shipping === "cvs");
    $("ship-pickup").classList.toggle("btn-dark", shipping === "pickup");
    $("ship-cvs").textContent = "超商取貨 +" + money(settings.shipFee || 0).replace("NT$ ", "");
    $("cvs-box").hidden = shipping !== "cvs";
    $("pickup-box").hidden = shipping === "cvs";
  }
  function renderCharts() {
    fillChart($("chart-24"), palette24, false);
    fillChart($("chart-20"), palette20, true);
  }
  function fillChart(node, palette, thick) {
    node.replaceChildren();
    palette.forEach((item) => {
      const cell = document.createElement("div");
      const sw = document.createElement("div");
      sw.className = thick ? "sq" : "yarn";
      sw.style.backgroundColor = item.hex;
      const label = document.createElement("div");
      label.textContent = item.code + " " + item.name;
      cell.append(sw, label);
      node.append(cell);
    });
  }
  function paintAdminChrome() {
    const on = sessionAlive();
    document.querySelectorAll(".admin-only").forEach((el) => { el.hidden = !on; });
  }
  function renderAdmin() {
    $("count-orders").textContent = String(orders.length);
    $("count-messages").textContent = String(messages.length);
    const pending = orders.some((o) => o.status === "待確認匯款後五碼") || messages.some((m) => !m.reply);
    $("admin-dot").hidden = !pending;
    const banner = $("security-banner");
    if (passwordConfigured) {
      banner.className = "ok";
      banner.textContent = "登入已改由 Apps Script 核對。這份網頁不再用檔案裡的密碼判斷。閒置 20 分鐘會自動登出。";
    } else {
      banner.className = "warn";
      banner.textContent = "後台還沒鎖上。試算表網址目前仍可能被任何人讀到，請打開「更新網站」依步驟改成不公開，並部署新的 Apps Script。完成前，請不要在這裡留下客人的電話。";
    }
    renderAdminOrders();
    renderAdminMessages();
    renderAdminProducts();
    $("set-gas").value = settings.gasWebhookUrl;
    $("set-email").value = settings.sellerNotifyEmail;
    $("set-bank-name").value = settings.bankName;
    $("set-bank-account").value = settings.bankAccount;
    $("set-bank-owner").value = settings.bankOwner;
    $("set-ship").value = String(settings.shipFee);
  }
  function renderAdminOrders() {
    const filters = $("order-filters");
    filters.replaceChildren();
    ["全部", "待確認匯款後五碼", "已確認匯款・編織作業中", "已寄出 / 待面交", "訂單已完成"].forEach((name) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn" + (orderFilter === name ? " btn-dark" : "");
      btn.textContent = name;
      btn.dataset.act = "order-filter";
      btn.dataset.name = name;
      filters.append(btn);
    });
    const q = ($("order-search").value || "").trim();
    const list = $("order-list");
    list.replaceChildren();
    const shown = orders.filter((o) => (orderFilter === "全部" || o.status === orderFilter) && (!q || [o.orderNo, o.customerName, o.customerPhone].join(" ").includes(q)));
    if (!shown.length) {
      const empty = document.createElement("p");
      empty.textContent = passwordConfigured && !sessionAlive() ? "請重新登入後再讀取訂單。" : "目前沒有符合的訂單。";
      list.append(empty);
      return;
    }
    shown.forEach((order) => {
      const card = document.createElement("article");
      card.className = "order";
      const head = document.createElement("strong");
      head.textContent = "#" + order.orderNo + "　" + clip(order.customerName, 30) + "　" + money(order.total);
      const meta = document.createElement("div");
      meta.textContent = [order.createdAt, order.customerPhone, order.customerEmail, "後五碼 " + order.remitLast5].join("　");
      const ship = document.createElement("div");
      ship.textContent = order.shippingDetail || "";
      const items = document.createElement("pre");
      items.textContent = order.itemsSummary || "";
      const select = document.createElement("select");
      select.className = "field";
      ["待確認匯款後五碼", "已確認匯款・編織作業中", "已寄出 / 待面交", "訂單已完成"].forEach((status) => {
        const opt = document.createElement("option");
        opt.value = status;
        opt.textContent = status;
        opt.selected = order.status === status;
        select.append(opt);
      });
      select.dataset.act = "order-status";
      select.dataset.no = String(order.orderNo);
      const tools = document.createElement("div");
      tools.className = "chips";
      const copy = document.createElement("button");
      copy.type = "button";
      copy.className = "btn";
      copy.textContent = "複製訂單";
      copy.dataset.act = "copy-order";
      copy.dataset.no = String(order.orderNo);
      const del = document.createElement("button");
      del.type = "button";
      del.className = "btn";
      del.textContent = "刪除";
      del.dataset.act = "delete-order";
      del.dataset.no = String(order.orderNo);
      tools.append(copy, del);
      card.append(head, meta, ship, items, select, tools);
      list.append(card);
    });
  }
  function renderAdminMessages() {
    const list = $("message-admin");
    list.replaceChildren();
    const shown = messages.filter((m) => messageFilter === "all" || !m.reply);
    if (!shown.length) {
      const empty = document.createElement("p");
      empty.textContent = "沒有留言。";
      list.append(empty);
      return;
    }
    shown.forEach((msg) => {
      const card = document.createElement("article");
      card.className = "msg";
      const head = document.createElement("strong");
      head.textContent = clip(msg.sender, 30) + "　" + clip(msg.phone, 20);
      const mail = document.createElement("div");
      mail.textContent = clip(msg.email, 80) + "　" + clip(msg.time, 40);
      const body = document.createElement("p");
      body.textContent = clipText(msg.content, 500);
      const input = document.createElement("textarea");
      input.className = "field";
      input.maxLength = 500;
      input.value = msg.reply || "";
      input.id = "reply-" + msg.id;
      const tools = document.createElement("div");
      tools.className = "actions";
      const send = document.createElement("button");
      send.type = "button";
      send.className = "btn btn-dark";
      send.textContent = msg.reply ? "更新回覆並寄信" : "回覆並寄信";
      send.dataset.act = "reply-message";
      send.dataset.id = String(msg.id);
      const del = document.createElement("button");
      del.type = "button";
      del.className = "btn";
      del.textContent = "刪除";
      del.dataset.act = "delete-message";
      del.dataset.id = String(msg.id);
      tools.append(send, del);
      card.append(head, mail, body, input, tools);
      list.append(card);
    });
  }
  function renderAdminProducts() {
    const q = ($("admin-product-search").value || "").trim();
    const list = $("product-admin");
    list.replaceChildren();
    products.filter((p) => !q || p.name.includes(q)).forEach((product) => {
      const card = document.createElement("article");
      card.className = "prod-edit stack";
      const row = document.createElement("div");
      row.className = "grid-3";
      row.append(field("圖示", "admin-icon-" + product.id, product.icon), field("名稱", "admin-name-" + product.id, product.name), field("售價", "admin-price-" + product.id, String(product.price), "number"));
      const parts = document.createElement("input");
      parts.className = "field";
      parts.id = "admin-parts-" + product.id;
      parts.value = product.parts.join("、");
      parts.maxLength = 80;
      const shape = document.createElement("select");
      shape.className = "field";
      shape.id = "admin-shape-" + product.id;
      Object.keys(SHAPES).forEach((key) => {
        const opt = document.createElement("option");
        opt.value = key;
        opt.textContent = SHAPES[key];
        opt.selected = product.shape === key;
        shape.append(opt);
      });
      const custom = document.createElement("label");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.id = "admin-custom-" + product.id;
      checkbox.checked = product.customizable;
      custom.append(checkbox, document.createTextNode(" 開放選色"));
      const info = document.createElement("div");
      info.className = "kicker";
      info.textContent = "照片 " + (product.images || []).length + " 張";
      const tools = document.createElement("div");
      tools.className = "chips";
      [["儲存這項", "save-product"], ["複製一項", "duplicate-product"], ["刪除", "delete-product"]].forEach((pair) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "btn" + (pair[1] === "save-product" ? " btn-dark" : "");
        b.textContent = pair[0];
        b.dataset.act = pair[1];
        b.dataset.id = String(product.id);
        tools.append(b);
      });
      card.append(row, parts, shape, custom, info, tools);
      list.append(card);
    });
  }
  function field(label, id, value, type) {
    const wrap = document.createElement("label");
    wrap.textContent = label;
    const input = document.createElement("input");
    input.className = "field";
    input.id = id;
    input.value = value;
    if (type) input.type = type;
    input.maxLength = 80;
    wrap.append(input);
    return wrap;
  }

  function selectProduct(id) {
    const product = products.find((p) => p.id === Number(id));
    if (!product) return;
    currentId = product.id;
    activePart = 0;
    galleryIndex = 0;
    qty = 1;
    selections = product.parts.map((_, index) => findColor(product.defaultCodes[index]));
    stage = (product.images || []).length ? "gallery" : "svg";
    renderProducts();
    renderStage();
  }
  function addToCart(open) {
    const product = current();
    if (!product) return;
    cart.push({
      productId: product.id,
      productName: product.name,
      price: product.price,
      qty,
      note: clip($("item-note").value, 120),
      selections: selectionList(product)
    });
    $("item-note").value = "";
    qty = 1;
    persist();
    renderStage();
    renderCart();
    showToast(open ? "已放入訂購車，請填取貨與匯款資料。" : "已放入訂購車，目前 " + cart.length + " 項。");
    if (open) openModal("cart-drawer");
  }
  function orderText(item, count) {
    const parts = item.selections.map((s) => "  • " + s.partName + "：" + s.code + " " + s.name).join("\n");
    return "【Momhandmade. 客製化訂貨】\n款式：" + item.productName + "\n" + parts + "\n數量：" + (count || item.qty) + "（單價 " + money(item.price) + "）\n備註：" + (item.note || "無");
  }
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      const area = document.createElement("textarea");
      area.value = text;
      document.body.append(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
  }
  function validEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
  function validPhone(value) { return (value.match(/\d/g) || []).length >= 8; }

  async function submitOrder() {
    if (busy || !cart.length) return;
    const name = clip($("customer-name").value, 30);
    const phone = clip($("customer-phone").value, 20);
    const email = clip($("customer-email").value, 80);
    const last5 = clip($("remit-last5").value, 10);
    if (!name || !validPhone(phone) || !validEmail(email) || !last5) {
      showToast("請填姓名、電話、信箱，以及匯款後五碼或「待補」。");
      return;
    }
    let shippingDetail = "";
    if (shipping === "cvs") {
      const storeName = clip($("cvs-name").value, 40);
      const storeAddr = clip($("cvs-address").value, 80);
      if (!storeName || !storeAddr) { showToast("請填超商店名和地址。可以先搜尋門市再點選。"); return; }
      shippingDetail = "超商取貨｜" + storeName + "｜" + storeAddr;
    } else {
      const place = clip($("pickup-place").value, 80);
      if (!place) { showToast("請填方便面交的地點和時段。"); return; }
      shippingDetail = "自取面交｜" + place;
    }
    const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
    const fee = shipFee();
    const itemsSummary = cart.map((item, index) => (index + 1) + ". " + item.productName + " x" + item.qty + " " + item.selections.map((s) => s.partName + "[" + s.code + s.name + "]").join(" / ") + (item.note ? " 備註:" + item.note : "")).join("\n");
    const order = {
      orderNo: "MH" + Date.now().toString().slice(-6),
      createdAt: new Date().toLocaleString("zh-TW"),
      customerName: name,
      customerPhone: phone,
      customerEmail: email,
      remitLast5: last5,
      shippingDetail,
      items: JSON.parse(JSON.stringify(cart)),
      itemsSummary,
      subtotal,
      shipFee: fee,
      total: subtotal + fee,
      status: "待確認匯款後五碼"
    };
    busy = true;
    $("submit-order").disabled = true;
    $("submit-order").textContent = "送出中…";
    orders.unshift(order);
    const result = await postGas(Object.assign({ action: "newOrder", orderObj: order, sellerEmail: settings.sellerNotifyEmail }, order), true);
    busy = false;
    $("submit-order").disabled = false;
    $("submit-order").textContent = "送出訂單";
    const accepted = result && (result.status === "success" || result.status === "ok");
    if (!accepted && settings.gasWebhookUrl) {
      orders.shift();
      showToast("試算表這次沒接到訂單，訂購車先留著。請檢查網路後再送一次。");
      return;
    }
    cart = [];
    if ($("remember-buyer").checked) saveJson(BUYER_KEY, { name, phone, email });
    else localStorage.removeItem(BUYER_KEY);
    persist();
    renderCart();
    renderAdmin();
    closeModal("cart-drawer");
    showToast("訂單 #" + order.orderNo + " 已送出。匯款確認後才會開始編織。");
  }

  async function submitMessage() {
    if (Date.now() - lastMessageAt < 20000) { showToast("請稍等幾秒再送下一則。"); return; }
    const sender = clip($("msg-name").value, 30);
    const phone = clip($("msg-phone").value, 20);
    const email = clip($("msg-email").value, 80);
    const content = clipText($("msg-content").value, 500);
    if (!sender || !validPhone(phone) || !validEmail(email) || content.length < 2) {
      showToast("請填稱呼、電話、信箱和想問的內容。");
      return;
    }
    const msg = { id: Date.now(), time: new Date().toLocaleString("zh-TW"), sender, phone, email, content, reply: "", replyTime: "" };
    messages.unshift(msg);
    const result = await postGas({ action: "newMessage", sellerEmail: settings.sellerNotifyEmail, id: msg.id, time: msg.time, sender, phone, email, content }, true);
    if (!result && settings.gasWebhookUrl) {
      messages.shift();
      showToast("留言沒有送到試算表，請稍後再試。");
      return;
    }
    lastMessageAt = Date.now();
    $("msg-content").value = "";
    persist();
    renderMessages();
    renderAdmin();
    showToast("已送出。賣家回覆時會寄到你的信箱。");
  }

  async function login() {
    const input = $("login-password");
    const error = $("login-error");
    const password = input.value;
    error.hidden = true;
    if (lockLeft()) { error.hidden = false; error.textContent = lockMessage(); return; }
    $("login-btn").disabled = true;
    $("login-btn").textContent = "驗證中…";
    await refreshAuthMode();
    let ok = false;
    let token = "";
    if (mustUseServer()) {
      const res = await postGas({ action: "login", password });
      if (!res) {
        error.hidden = false;
        error.textContent = "登入服務暫時連不上，請稍後再試。";
      } else if (res.status === "locked") {
        error.hidden = false;
        error.textContent = "嘗試太多次，請稍後再試。";
      } else if (res.status === "success" && res.token) {
        ok = true;
        token = res.token;
      } else if (res.status === "unconfigured") {
        ok = await verifyLocal(password);
        if (!ok) {
          recordFail();
          error.hidden = false;
          error.textContent = lockLeft() ? lockMessage() : "密碼不正確。";
        }
      } else {
        recordFail();
        error.hidden = false;
        error.textContent = lockLeft() ? lockMessage() : "密碼不正確。";
      }
    } else {
      ok = await verifyLocal(password);
      if (!ok) {
        recordFail();
        error.hidden = false;
        error.textContent = lockLeft() ? lockMessage() : "密碼不正確。";
      }
    }
    $("login-btn").disabled = false;
    $("login-btn").textContent = "進入後台";
    if (!ok) return;
    resetGuard();
    input.value = "";
    startSession(token);
    closeModal("login-modal");
    openModal("admin-modal");
    if (passwordConfigured && token) {
      const data = await postGas({ action: "getAdminData" });
      if (data && data.status === "success") {
        if (Array.isArray(data.orders)) orders = data.orders;
        if (Array.isArray(data.buyerMessages)) messages = data.buyerMessages;
        persist();
      }
    }
    renderAdmin();
    showToast("已進入後台。閒置 20 分鐘會自動登出。");
  }

  async function saveSettings() {
    const gas = $("set-gas").value.trim();
    const email = clip($("set-email").value, 80);
    if (gas && !gas.startsWith("https://script.google.com/macros/")) { showToast("Apps Script 網址須以 script.google.com/macros/ 開頭。"); return; }
    if (email && !validEmail(email)) { showToast("通知信箱格式不正確。"); return; }
    const nextPass = $("set-pass").value;
    const again = $("set-pass2").value;
    if (nextPass || again) {
      if (nextPass !== again) { showToast("兩次密碼不一致。"); return; }
      if (!passwordOk(nextPass)) { showToast("新密碼至少 10 碼，且要有英文、數字和符號。"); return; }
      if (passwordConfigured && sessionAlive() && readSession().token) {
        const res = await postGas({ action: "changePassword", newPassword: nextPass });
        if (!res || res.status !== "success") { showToast("Apps Script 沒有收下新密碼。請先確認已部署並重新登入。"); return; }
      } else {
        await setLocalPassword(nextPass);
      }
    }
    settings = cleanSettings({
      gasWebhookUrl: gas || settings.gasWebhookUrl,
      sellerNotifyEmail: email,
      bankName: $("set-bank-name").value,
      bankAccount: $("set-bank-account").value,
      bankOwner: $("set-bank-owner").value,
      shipFee: $("set-ship").value
    });
    $("set-pass").value = "";
    $("set-pass2").value = "";
    dirty = false;
    persist();
    renderBank();
    renderCart();
    if (sessionAlive()) await postGas({ action: "syncSettingsAndProducts" }, true);
    showToast(nextPass ? "設定已儲存，密碼已更新。" : "設定已儲存。");
  }

  function saveProduct(id) {
    const product = products.find((p) => p.id === Number(id));
    if (!product) return;
    product.icon = clip($("admin-icon-" + id).value, 8) || product.icon;
    product.name = clip($("admin-name-" + id).value, 80) || product.name;
    product.price = Math.max(0, parseInt($("admin-price-" + id).value, 10) || 0);
    product.parts = $("admin-parts-" + id).value.split(/[,，、]/).map((s) => clip(s, 20)).filter(Boolean).slice(0, 3);
    if (!product.parts.length) product.parts = ["主體顏色"];
    product.shape = SHAPES[$("admin-shape-" + id).value] ? $("admin-shape-" + id).value : product.shape;
    product.customizable = $("admin-custom-" + id).checked;
    while (product.defaultCodes.length < product.parts.length) product.defaultCodes.push("#40");
    dirty = true;
    if (product.id === currentId) selectProduct(product.id);
    else renderProducts();
    persist();
    postGas({ action: "syncSettingsAndProducts" }, true);
    showToast("已儲存「" + product.name + "」。");
  }

  async function syncFromSheet(announce) {
    if (!settings.gasWebhookUrl) return;
    $("sync-status").textContent = "正在跟試算表核對商品…";
    try {
      await refreshAuthMode();
      const sep = settings.gasWebhookUrl.includes("?") ? "&" : "?";
      const res = await fetch(settings.gasWebhookUrl + sep + "action=getData&t=" + Date.now());
      const data = await res.json();
      authVersion = data && data.authVersion === 2 ? 2 : authVersion;
      passwordConfigured = !!(data && data.passwordConfigured);
      if (passwordConfigured) {
        if (Array.isArray(data.products) && !dirty) {
          const next = data.products.map(sanitizeProduct).filter(Boolean);
          if (next.length) products = next;
        }
        if (data.storeSettings) settings = cleanSettings(Object.assign({}, settings, data.storeSettings));
        if (!sessionAlive() && Array.isArray(data.buyerMessages)) {
          messages = data.buyerMessages.map((msg) => ({
            id: msg.id,
            time: clip(msg.time, 40),
            sender: clip(msg.sender, 30),
            content: clipText(msg.content, 500),
            reply: clipText(msg.reply, 500),
            replyTime: clip(msg.replyTime, 40),
            phone: "",
            email: ""
          }));
        }
        if (sessionAlive() && readSession().token) {
          const admin = await postGas({ action: "getAdminData" });
          if (admin && admin.status === "success") {
            if (Array.isArray(admin.orders)) orders = admin.orders;
            if (Array.isArray(admin.buyerMessages)) messages = admin.buyerMessages;
          }
        }
      } else if (data && data.status === "success") {
        applyRemote(data);
      }
      persist();
      if (!products.some((p) => p.id === currentId)) currentId = products[0] ? products[0].id : null;
      selectProduct(currentId);
      renderBank();
      renderMessages();
      renderCart();
      renderAdmin();
      $("sync-status").textContent = passwordConfigured ? "商品已連線。訂單僅在登入後台後載入。" : "已讀取試算表。建議盡快完成「更新網站」裡的上鎖步驟。";
      if (announce) showToast("已同步試算表。");
    } catch (e) {
      $("sync-status").textContent = "目前顯示這份網站裡的商品，試算表暫時連不上。";
      if (announce) showToast("連不到試算表，先顯示網站裡的商品。");
    }
  }

  async function searchStores(query) {
    const frame = $("map-frame");
    frame.src = "https://maps.google.com/maps?q=" + encodeURIComponent(query || "台灣 7-ELEVEN") + "&hl=zh-TW&z=15&output=embed";
    const box = $("store-results");
    box.hidden = false;
    box.replaceChildren();
    const wait = document.createElement("p");
    wait.textContent = "正在找門市…";
    box.append(wait);
    try {
      const geoRes = await fetch("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=tw&q=" + encodeURIComponent(query));
      const geos = await geoRes.json();
      if (!geos.length) throw new Error("no geo");
      const lat = geos[0].lat;
      const lon = geos[0].lon;
      const q = `[out:json][timeout:12];node["shop"="convenience"](around:900,${lat},${lon});out tags 12;`;
      const res = await fetch("https://overpass-api.de/api/interpreter", { method: "POST", body: q });
      const data = await res.json();
      const nodes = (data.elements || []).filter((el) => el.tags && (el.tags.name || el.tags.brand));
      box.replaceChildren();
      if (!nodes.length) {
        const p = document.createElement("p");
        p.textContent = "地圖已更新。若清單是空的，請在地圖複製店名後按貼上。";
        box.append(p);
        return;
      }
      nodes.slice(0, 8).forEach((node) => {
        const name = node.tags.name || node.tags.brand || "超商";
        const addr = [node.tags["addr:city"], node.tags["addr:suburb"], node.tags["addr:street"], node.tags["addr:housenumber"]].filter(Boolean).join("");
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = name + (addr ? "　" + addr : "");
        btn.dataset.act = "pick-store";
        btn.dataset.store = name;
        btn.dataset.address = addr || name;
        box.append(btn);
      });
    } catch (e) {
      box.replaceChildren();
      const p = document.createElement("p");
      p.textContent = "門市清單暫時抓不到，地圖仍可搜尋。找到店之後把店名貼上下方。";
      box.append(p);
    }
  }

  async function exportChart(which) {
    const palette = which === "20" ? palette20 : palette24;
    const cols = which === "20" ? 2 : 6;
    const rows = Math.ceil(palette.length / cols);
    const canvas = document.createElement("canvas");
    canvas.width = cols * 180;
    canvas.height = 120 + rows * 150;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#FBF6EF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#2C241E";
    ctx.font = '700 36px "Noto Sans TC", sans-serif';
    ctx.fillText(which === "20" ? "Momhandmade. 20色粗毛線" : "Momhandmade. 24色毛線", 36, 64);
    palette.forEach((item, index) => {
      const x = 36 + (index % cols) * 180;
      const y = 110 + Math.floor(index / cols) * 150;
      ctx.beginPath();
      ctx.fillStyle = item.hex;
      ctx.arc(x + 50, y + 40, 36, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#2C241E";
      ctx.font = '700 20px "Noto Sans TC", sans-serif';
      ctx.fillText(item.code, x + 100, y + 36);
      ctx.font = '500 20px "Noto Sans TC", sans-serif';
      ctx.fillText(item.name, x + 100, y + 66);
    });
    const link = document.createElement("a");
    link.download = which === "20" ? "Momhandmade-20色粗毛線.png" : "Momhandmade-24色毛線.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  function crcTable() {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c >>> 0;
    }
    return table;
  }
  const CRC = crcTable();
  function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  function dosStamp(date) {
    const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
    const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
    return [time, day];
  }
  function buildZip(files) {
    const encoder = new TextEncoder();
    const parts = [];
    const central = [];
    let offset = 0;
    const now = dosStamp(new Date());
    files.forEach((file) => {
      const name = encoder.encode(file.name);
      const data = file.data;
      const crc = crc32(data);
      const local = new Uint8Array(30 + name.length);
      const view = new DataView(local.buffer);
      view.setUint32(0, 0x04034b50, true);
      view.setUint16(4, 20, true);
      view.setUint16(8, 0, true);
      view.setUint16(10, now[0], true);
      view.setUint16(12, now[1], true);
      view.setUint32(14, crc, true);
      view.setUint32(18, data.length, true);
      view.setUint32(22, data.length, true);
      view.setUint16(26, name.length, true);
      local.set(name, 30);
      parts.push(local, data);
      const cen = new Uint8Array(46 + name.length);
      const cv = new DataView(cen.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, now[0], true);
      cv.setUint16(14, now[1], true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, data.length, true);
      cv.setUint32(24, data.length, true);
      cv.setUint16(28, name.length, true);
      cv.setUint32(42, offset, true);
      cen.set(name, 46);
      central.push(cen);
      offset += local.length + data.length;
    });
    const centralSize = central.reduce((sum, part) => sum + part.length, 0);
    const end = new Uint8Array(22);
    const ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, files.length, true);
    ev.setUint16(10, files.length, true);
    ev.setUint32(12, centralSize, true);
    ev.setUint32(16, offset, true);
    const blobParts = parts.concat(central, [end]);
    return new Blob(blobParts, { type: "application/zip" });
  }
  async function downloadSite() {
    showToast("正在打包網站，照片多會稍等一下。");
    const files = [];
    const exportProducts = [];
    for (const product of products) {
      const images = [];
      for (let i = 0; i < (product.images || []).length; i++) {
        const src = product.images[i];
        let bytes = null;
        let ext = "jpg";
        if (src.startsWith("data:image/")) {
          const match = src.match(/^data:image\/(jpeg|png|webp|gif);base64,([A-Za-z0-9+/=]+)$/);
          if (!match) continue;
          ext = match[1] === "jpeg" ? "jpg" : match[1];
          const bin = atob(match[2]);
          bytes = new Uint8Array(bin.length);
          for (let n = 0; n < bin.length; n++) bytes[n] = bin.charCodeAt(n);
        } else if (/^images\/[A-Za-z0-9._-]+$/.test(src)) {
          const res = await fetch(src);
          bytes = new Uint8Array(await res.arrayBuffer());
          ext = (src.split(".").pop() || "jpg").toLowerCase();
        }
        if (!bytes) continue;
        const name = "images/p" + product.id + "-" + i + "." + ext;
        files.push({ name, data: bytes });
        images.push(name);
      }
      exportProducts.push(Object.assign({}, product, { images }));
    }
    const textFiles = ["index.html", "css/styles.css", "js/app.js", "favicon.svg", "gas/Code.gs", "README.md"];
    for (const path of textFiles) {
      const res = await fetch(path);
      if (!res.ok) continue;
      files.push({ name: path, data: new Uint8Array(await res.arrayBuffer()) });
    }
    const encoder = new TextEncoder();
    const catalogText = "window.MOM_CATALOG = " + JSON.stringify({ products: exportProducts, settings: cleanSettings(settings) }, null, 2) + ";\n";
    const exportedAuth = passwordConfigured
      ? { iterations: 1, salt: "AQIDBAUGBwg=", hash: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=" }
      : auth;
    const authText = "/* 密碼雜湊。請只在賣家後台變更密碼，不要把密碼寫進檔案。 */\nwindow.MOM_AUTH = " + JSON.stringify(exportedAuth) + ";\n";
    files.push({ name: "js/catalog.js", data: encoder.encode(catalogText) });
    files.push({ name: "js/auth-config.js", data: encoder.encode(authText) });
    const blob = buildZip(files);
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "mamahand-site.zip";
    link.click();
    showToast("已下載網站壓縮檔。解開後覆蓋 GitHub 儲存庫裡的同名檔案。");
  }

  function compressImage(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let w = img.width;
          let h = img.height;
          const max = 900;
          if (w > max) { h = Math.round(h * max / w); w = max; }
          canvas.width = w;
          canvas.height = h;
          canvas.getContext("2d").drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL("image/jpeg", 0.76));
        };
        img.onerror = () => resolve("");
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }
  async function addImages(fileList, productId) {
    const product = products.find((p) => p.id === Number(productId || currentId));
    if (!product || !sessionAlive()) { showToast("新增照片只限已登入的賣家。"); return; }
    const files = Array.from(fileList || []).slice(0, 6);
    for (const file of files) {
      if (!file.type.startsWith("image/")) continue;
      const url = await compressImage(file);
      if (isSafeImage(url)) product.images.push(url);
    }
    dirty = true;
    galleryIndex = Math.max(0, product.images.length - 1);
    renderStage();
    renderProducts();
    renderAdminProducts();
    postGas({ action: "syncSettingsAndProducts" }, true);
    showToast("已加上 " + files.length + " 張照片。");
  }

  function fillShapeSelect() {
    const select = $("new-shape");
    Object.keys(SHAPES).forEach((key) => {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = SHAPES[key];
      select.append(opt);
    });
    const emojis = ["🧶", "🌼", "👜", "🧣", "🎀", "🔑", "🧸", "🐢", "🦙", "🐓", "🎃", "🍅"];
    const box = $("emoji-pick");
    emojis.forEach((emoji) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = emoji;
      btn.dataset.act = "emoji";
      btn.dataset.emoji = emoji;
      box.append(btn);
    });
  }

  async function onClick(event) {
    const target = event.target.closest("[data-act]");
    if (!target) return;
    const act = target.dataset.act;
    if (act === "open") openModal(target.dataset.target);
    if (act === "close") closeModal(target.dataset.target);
    if (act === "close-admin") closeModal("admin-modal");
    if (act === "rail") $("product-list").scrollBy({ left: Number(target.dataset.dir) * 420, behavior: "smooth" });
    if (act === "select-product") selectProduct(target.dataset.id);
    if (act === "stage") { stage = target.dataset.tab; renderStage(); }
    if (act === "qty") { qty = Math.max(1, Math.min(99, qty + Number(target.dataset.dir))); renderStage(); }
    if (act === "add-cart") addToCart(false);
    if (act === "add-checkout") addToCart(true);
    if (act === "copy-one") {
      const product = current();
      const draft = { productName: product.name, price: product.price, qty, note: clip($("item-note").value, 120), selections: selectionList(product) };
      await copyText(orderText(draft, qty));
      showToast("已複製這項訂貨資訊。");
    }
    if (act === "pick-part") { activePart = Number(target.dataset.index) || 0; renderStage(); }
    if (act === "palette") { paletteName = target.dataset.name; renderStage(); }
    if (act === "pick-color") {
      const product = current();
      if (!product || !product.customizable) return;
      selections[activePart] = findColor(target.dataset.code);
      renderStage();
    }
    if (act === "gallery-step") {
      const imgs = (current().images || []);
      if (!imgs.length) return;
      galleryIndex = (galleryIndex + Number(target.dataset.dir) + imgs.length) % imgs.length;
      renderStage();
    }
    if (act === "gallery-go") { galleryIndex = Number(target.dataset.index) || 0; renderStage(); }
    if (act === "open-lightbox") {
      const src = $("gallery-main").src;
      if (!src) return;
      $("lightbox-img").src = src;
      openModal("lightbox");
    }
    if (act === "delete-image") {
      if (!sessionAlive()) return;
      const product = current();
      if (!product.images || product.images.length <= 1) { showToast("至少留一張照片。"); return; }
      if (!(await ask("刪除照片", "確定刪掉目前這張照片？"))) return;
      product.images.splice(galleryIndex, 1);
      galleryIndex = Math.max(0, galleryIndex - 1);
      dirty = true;
      renderStage();
      postGas({ action: "syncSettingsAndProducts" }, true);
    }
    if (act === "shipping") { shipping = target.dataset.method; localStorage.setItem("mom_ship_v3", shipping); renderCart(); }
    if (act === "search-brand") { $("map-search").value = target.dataset.brand; searchStores(target.dataset.brand + " 台灣"); }
    if (act === "map-search") searchStores($("map-search").value.trim() || "台灣 7-ELEVEN");
    if (act === "locate-cvs") {
      if (!navigator.geolocation) { showToast("這台裝置不能定位，請改搜區域。"); return; }
      navigator.geolocation.getCurrentPosition((pos) => {
        searchStores(pos.coords.latitude + "," + pos.coords.longitude + " 便利商店");
      }, () => showToast("沒有取得定位，請改用路名搜尋。"));
    }
    if (act === "pick-store") {
      $("cvs-name").value = target.dataset.store || "";
      $("cvs-address").value = target.dataset.address || "";
      showToast("已填入門市，請再看一眼是否正確。");
    }
    if (act === "paste-cvs") {
      try {
        const text = await navigator.clipboard.readText();
        const lines = text.split(/\n/).map((s) => s.trim()).filter(Boolean);
        const name = lines.find((s) => /7-?ELEVEN|7-11|全家|萊爾富|OK/i.test(s)) || lines[0] || "";
        const addr = lines.find((s) => /[市縣區路街號]/.test(s)) || "";
        if (name) $("cvs-name").value = clip(name, 40);
        if (addr) $("cvs-address").value = clip(addr, 80);
        showToast(name ? "已貼上，請確認店名與地址。" : "剪貼簿裡沒有認得出的店名。");
      } catch (e) { showToast("讀不到剪貼簿，請直接把店名貼進欄位。"); }
    }
    if (act === "copy-bank") {
      await copyText((settings.bankName || "") + " 帳號：" + (settings.bankAccount || ""));
      showToast("已複製匯款帳號。");
    }
    if (act === "copy-cart") {
      const text = cart.map((item) => orderText(item)).join("\n\n");
      await copyText(text || "訂購車是空的");
      showToast("已複製整車訂貨資訊。");
    }
    if (act === "remove-cart") { cart.splice(Number(target.dataset.index), 1); persist(); renderCart(); }
    if (act === "cart-qty") {
      const item = cart[Number(target.dataset.index)];
      if (item) item.qty = Math.max(1, Math.min(99, item.qty + Number(target.dataset.dir)));
      persist();
      renderCart();
    }
    if (act === "submit-order") submitOrder();
    if (act === "submit-message") submitMessage();
    if (act === "open-admin") {
      if (sessionAlive()) { openModal("admin-modal"); renderAdmin(); }
      else openModal("login-modal");
    }
    if (act === "login") login();
    if (act === "toggle-pw") {
      const input = $(target.dataset.target);
      input.type = target.checked ? "text" : "password";
    }
    if (act === "logout") { endSession(); showToast("已登出。"); }
    if (act === "admin-tab") {
      ["orders", "messages", "products", "settings", "publish"].forEach((name) => {
        $("panel-" + name).hidden = name !== target.dataset.tab;
      });
      renderAdmin();
    }
    if (act === "sync-sheet") syncFromSheet(true);
    if (act === "save-settings") saveSettings();
    if (act === "test-gas") {
      $("gas-status").textContent = "測試中…";
      const res = await postGas({ action: "test", sellerEmail: settings.sellerNotifyEmail });
      $("gas-status").textContent = res ? "已送到 Apps Script。請看試算表和信箱。" : "連線失敗，請檢查網址。";
    }
    if (act === "download-zip") downloadSite();
    if (act === "order-filter") { orderFilter = target.dataset.name; renderAdminOrders(); }
    if (act === "msg-filter") { messageFilter = target.dataset.mode; renderAdminMessages(); }
    if (act === "copy-order") {
      const order = orders.find((o) => String(o.orderNo) === target.dataset.no);
      if (order) { await copyText("#" + order.orderNo + "\n" + order.customerName + " " + order.customerPhone + "\n" + order.shippingDetail + "\n" + order.itemsSummary + "\n總計 " + money(order.total)); showToast("已複製訂單。"); }
    }
    if (act === "delete-order") {
      if (!(await ask("刪除訂單", "確定刪掉這筆訂單？試算表也會一併刪除。"))) return;
      const no = target.dataset.no;
      orders = orders.filter((o) => String(o.orderNo) !== no);
      persist();
      renderAdmin();
      postGas({ action: "deleteOrder", orderNo: no }, true);
    }
    if (act === "reply-message") {
      const msg = messages.find((m) => String(m.id) === target.dataset.id);
      const text = clipText($("reply-" + target.dataset.id).value, 500);
      if (!msg || !text) { showToast("請先寫回覆。"); return; }
      msg.reply = text;
      msg.replyTime = new Date().toLocaleString("zh-TW");
      persist();
      renderMessages();
      renderAdminMessages();
      const res = await postGas({ action: "replyMessage", id: msg.id, reply: msg.reply, replyTime: msg.replyTime, email: msg.email, sender: msg.sender, content: msg.content }, true);
      showToast(res ? "已回覆，並請試算表寄信。" : "回覆已留在這台裝置，試算表可能還沒收到。");
    }
    if (act === "delete-message") {
      if (!(await ask("刪除留言", "確定刪掉這則留言？"))) return;
      const id = target.dataset.id;
      messages = messages.filter((m) => String(m.id) !== id);
      persist();
      renderMessages();
      renderAdmin();
      postGas({ action: "deleteMessage", id }, true);
    }
    if (act === "save-product") saveProduct(target.dataset.id);
    if (act === "duplicate-product") {
      const product = products.find((p) => p.id === Number(target.dataset.id));
      if (!product) return;
      const copy = sanitizeProduct(JSON.parse(JSON.stringify(product)));
      copy.id = Math.max(...products.map((p) => p.id)) + 1;
      copy.name = clip(product.name + "（複製）", 80);
      products.push(copy);
      dirty = true;
      renderAdminProducts();
      renderProducts();
      postGas({ action: "syncSettingsAndProducts" }, true);
      showToast("已複製商品，記得改名稱。");
    }
    if (act === "delete-product") {
      if (products.length <= 1) { showToast("至少留一項商品。"); return; }
      if (!(await ask("刪除商品", "確定刪掉這項商品？"))) return;
      const id = Number(target.dataset.id);
      products = products.filter((p) => p.id !== id);
      if (currentId === id) currentId = products[0].id;
      dirty = true;
      selectProduct(currentId);
      renderAdminProducts();
      postGas({ action: "syncSettingsAndProducts" }, true);
    }
    if (act === "emoji") $("new-icon").value = target.dataset.emoji;
    if (act === "create-product") createProduct();
    if (act === "export-chart") exportChart(target.dataset.chart);
    if (act === "confirm-yes") settleConfirm(true);
    if (act === "confirm-no") settleConfirm(false);
  }

  async function createProduct() {
    const name = clip($("new-name").value, 80);
    const price = parseInt($("new-price").value, 10);
    if (!name || !Number.isFinite(price) || price < 0) { showToast("請填商品名稱和售價。"); return; }
    const parts = $("new-parts").value.split(/[,，、]/).map((s) => clip(s, 20)).filter(Boolean).slice(0, 3);
    const images = [];
    for (const file of Array.from($("new-images").files || []).slice(0, 6)) {
      const url = await compressImage(file);
      if (isSafeImage(url)) images.push(url);
    }
    const product = sanitizeProduct({
      id: (products.length ? Math.max(...products.map((p) => p.id)) : 0) + 1,
      name,
      price,
      icon: clip($("new-icon").value, 8) || "🧶",
      shape: $("new-shape").value,
      customizable: $("new-custom").value === "true",
      parts: parts.length ? parts : ["主體顏色"],
      defaultCodes: ["#40", "#06", "#23"],
      images
    });
    products.push(product);
    dirty = true;
    closeModal("product-modal");
    selectProduct(product.id);
    renderAdminProducts();
    postGas({ action: "syncSettingsAndProducts" }, true);
    showToast("已新增「" + product.name + "」。");
  }

  function onChange(event) {
    const target = event.target;
    if (target.dataset.act === "order-status") {
      const order = orders.find((o) => String(o.orderNo) === target.dataset.no);
      if (!order) return;
      order.status = target.value;
      persist();
      postGas({ action: "updateOrderStatus", orderNo: order.orderNo, status: order.status, customerName: order.customerName, customerEmail: order.customerEmail, shippingDetail: order.shippingDetail }, true);
      showToast("已更新訂單狀態。");
      renderAdminOrders();
    }
  }

  function boot() {
    const savedAuth = loadJson(AUTH_KEY);
    if (savedAuth && savedAuth.hash && savedAuth.salt && !passwordConfigured) auth = savedAuth;
    const savedSettings = loadJson(SETTINGS_KEY);
    if (savedSettings) settings = cleanSettings(Object.assign({}, settings, savedSettings));
    const savedOrders = loadJson(ORDERS_KEY);
    const savedMessages = loadJson(MESSAGES_KEY);
    if (Array.isArray(savedOrders)) orders = savedOrders;
    if (Array.isArray(savedMessages)) messages = savedMessages;
    try { cart = JSON.parse(sessionStorage.getItem(CART_KEY) || "[]"); } catch (e) { cart = []; }
    if (!Array.isArray(cart)) cart = [];
    shipping = localStorage.getItem("mom_ship_v3") === "pickup" ? "pickup" : "cvs";
    const buyer = loadJson(BUYER_KEY);
    if (buyer) {
      $("customer-name").value = clip(buyer.name, 30);
      $("customer-phone").value = clip(buyer.phone, 20);
      $("customer-email").value = clip(buyer.email, 80);
      $("remember-buyer").checked = true;
    }
    fillShapeSelect();
    paintAdminChrome();
    renderCharts();
    renderBank();
    renderMessages();
    renderCart();
    if (currentId) selectProduct(currentId);
    document.body.addEventListener("click", onClick);
    document.body.addEventListener("change", onChange);
    $("product-search").addEventListener("input", renderProducts);
    $("order-search").addEventListener("input", renderAdminOrders);
    $("admin-product-search").addEventListener("input", renderAdminProducts);
    $("add-style-images").addEventListener("change", (event) => {
      addImages(event.target.files, currentId);
      event.target.value = "";
    });
    $("login-password").addEventListener("keydown", (event) => { if (event.key === "Enter") login(); });
    $("map-search").addEventListener("keydown", (event) => { if (event.key === "Enter") searchStores(event.target.value.trim()); });
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      document.querySelectorAll(".modal:not([hidden])").forEach((el) => { el.hidden = true; });
      document.body.classList.remove("modal-open");
      if (confirmResolve) { confirmResolve(false); confirmResolve = null; }
    });
    ["pointerdown", "keydown"].forEach((type) => document.addEventListener(type, touchSession, { passive: true }));
    setInterval(() => { if (!sessionAlive()) paintAdminChrome(); }, 30000);
    syncFromSheet(false);
  }

  boot();
})();
