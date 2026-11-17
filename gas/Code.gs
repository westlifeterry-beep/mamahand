/**
 * Momhandmade. 試算表後端
 * 部署：執行身分選「自己」，存取權選「所有人」，每次改完都要部署新版本。
 * 密碼只放在指令碼屬性，不寫回試算表，也不要留在這份程式裡。
 */
var SPREADSHEET_ID = "1kwxHfwrEQZOIqh64c2EMsTmPlERTT2PKaPVuSeLUQuA";
var SHEET_SETTINGS = "商店與商品設定";
var SHEET_PRODUCTS = "商品清單";
var SHEET_ORDERS = "訂單紀錄";
var SHEET_MESSAGES = "留言問答紀錄";
var CHUNK = 45000;

function doGet(e) {
  var action = e && e.parameter && e.parameter.action ? String(e.parameter.action) : "getData";
  if (action === "getAdminData") return json(adminPayload(e.parameter.token));
  return json(publicPayload());
}

function doPost(e) {
  var body = {};
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json({ status: "error", message: "格式不正確" });
  }
  var action = String(body.action || "");
  if (action === "login") return json(login(body.password));
  if (action === "newOrder") return json(addOrder(body));
  if (action === "newMessage") return json(addMessage(body));
  if (!isPasswordConfigured()) {
    return json(handleAdmin(body));
  }
  if (!tokenValid(body.token)) return json({ status: "unauthorized", authVersion: 2, passwordConfigured: true });
  return json(handleAdmin(body));
}

function handleAdmin(body) {
  var action = String(body.action || "");
  if (action === "getAdminData") return adminPayload(body.token);
  if (action === "test") {
    mail(sellerEmail(), "Momhandmade. 測試信", "這封信代表試算表與寄信連線正常。若你沒有按測試，請盡快更換 Apps Script 部署。");
    return { status: "success", authVersion: 2 };
  }
  if (action === "changePassword") return changePassword(body.newPassword);
  if (action === "updateOrderStatus") return updateOrderStatus(body);
  if (action === "deleteOrder") return deleteOrder(body.orderNo);
  if (action === "replyMessage") return replyMessage(body);
  if (action === "deleteMessage") return deleteMessage(body.id);
  if (action === "syncSettingsAndProducts") return saveCatalog(body.syncState || {});
  return { status: "error", authVersion: 2, message: "不認識的動作" };
}

function publicPayload() {
  var state = loadState();
  var configured = isPasswordConfigured();
  return {
    status: "success",
    authVersion: 2,
    passwordConfigured: configured,
    products: state.products,
    storeSettings: cleanSettings(state.settings),
    buyerMessages: state.messages.map(publicMessage),
    orders: configured ? [] : state.orders
  };
}

function adminPayload(token) {
  if (isPasswordConfigured() && !tokenValid(token)) {
    return { status: "unauthorized", authVersion: 2, passwordConfigured: true };
  }
  var state = loadState();
  return {
    status: "success",
    authVersion: 2,
    passwordConfigured: isPasswordConfigured(),
    admin: true,
    orders: state.orders,
    buyerMessages: state.messages,
    products: state.products,
    storeSettings: cleanSettings(state.settings)
  };
}

function addOrder(body) {
  if (!allowRate("order", 40)) return { status: "error", message: "目前訂單太多，請稍後再試" };
  var order = body.orderObj || body;
  if (!order || !order.orderNo || !order.customerName) return { status: "error", message: "訂單資料不完整" };
  rememberOrder(order);
  var seller = "新訂單 #" + order.orderNo + "\n買家：" + order.customerName + " " + (order.customerPhone || "") +
    "\n信箱：" + (order.customerEmail || "") + "\n取貨：" + (order.shippingDetail || "") +
    "\n後五碼：" + (order.remitLast5 || "") + "\n金額：" + order.total + "\n\n" + (order.itemsSummary || "");
  mail(sellerEmail(), "Momhandmade. 新訂單 #" + order.orderNo, seller);
  if (order.customerEmail) {
    mail(order.customerEmail, "Momhandmade. 已收到訂單 #" + order.orderNo,
      order.customerName + " 你好，已收到訂單 #" + order.orderNo + "。\n匯款確認後才會開始編織，不接急件，選色後不能更改。\n\n" + (order.itemsSummary || "") + "\n應付 " + order.total + " 元");
  }
  return { status: "success", authVersion: 2, orderNo: order.orderNo };
}

function addMessage(body) {
  if (!allowRate("message", 30)) return { status: "error", message: "留言太頻繁，請稍後再試" };
  if (!body || !body.id || !body.content) return { status: "error", message: "留言不完整" };
  var msg = {
    id: body.id,
    time: text(body.time, 40),
    sender: text(body.sender, 30),
    phone: text(body.phone, 20),
    email: text(body.email, 80),
    content: text(body.content, 500),
    reply: "",
    replyTime: ""
  };
  var sheet = byName(SHEET_MESSAGES);
  sheet.appendRow([msg.id, msg.time, msg.sender, msg.phone, msg.email, msg.content, "", ""]);
  mail(sellerEmail(), "Momhandmade. 新留言", msg.sender + " " + msg.phone + "\n" + msg.email + "\n\n" + msg.content);
  return { status: "success", authVersion: 2 };
}

function updateOrderStatus(body) {
  var sheet = byName(SHEET_ORDERS);
  var values = sheet.getDataRange().getValues();
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][0]) !== String(body.orderNo)) continue;
    var order = parseOrderRow(values[r]);
    order.status = text(body.status, 40) || order.status;
    sheet.getRange(r + 1, 12).setValue(order.status);
    sheet.getRange(r + 1, 13).setValue(JSON.stringify(order));
    if (order.customerEmail) {
      mail(order.customerEmail, "Momhandmade. 訂單 #" + order.orderNo + " 進度更新",
        "訂單 #" + order.orderNo + " 目前狀態：" + order.status + "\n" + (order.shippingDetail || ""));
    }
    return { status: "success", authVersion: 2 };
  }
  return { status: "error", message: "找不到訂單" };
}

function deleteOrder(orderNo) {
  var sheet = byName(SHEET_ORDERS);
  var values = sheet.getDataRange().getValues();
  for (var r = values.length - 1; r >= 1; r--) {
    if (String(values[r][0]) === String(orderNo)) sheet.deleteRow(r + 1);
  }
  return { status: "success", authVersion: 2 };
}

function replyMessage(body) {
  var sheet = byName(SHEET_MESSAGES);
  var values = sheet.getDataRange().getValues();
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][0]) !== String(body.id)) continue;
    var reply = text(body.reply, 500);
    var when = text(body.replyTime, 40) || new Date().toLocaleString("zh-TW");
    sheet.getRange(r + 1, 7).setValue(reply);
    sheet.getRange(r + 1, 8).setValue(when);
    var email = values[r][4];
    if (email) mail(email, "Momhandmade. 賣家回覆了你的留言", "你好，賣家回覆：\n\n" + reply);
    return { status: "success", authVersion: 2 };
  }
  return { status: "error", message: "找不到留言" };
}

function deleteMessage(id) {
  var sheet = byName(SHEET_MESSAGES);
  var values = sheet.getDataRange().getValues();
  for (var r = values.length - 1; r >= 1; r--) {
    if (String(values[r][0]) === String(id)) sheet.deleteRow(r + 1);
  }
  return { status: "success", authVersion: 2 };
}

function saveCatalog(state) {
  var products = Array.isArray(state.products) ? state.products : [];
  var settings = cleanSettings(state.storeSettings || {});
  writeKeyedJson(byName(SHEET_SETTINGS), "products", products);
  writeKeyedJson(byName(SHEET_SETTINGS), "storeSettings", settings);
  writeProductTable(products);
  return { status: "success", authVersion: 2 };
}

function loadState() {
  var settingsSheet = byName(SHEET_SETTINGS);
  var products = readKeyedJson(settingsSheet, "products") || [];
  var settings = cleanSettings(readKeyedJson(settingsSheet, "storeSettings") || {});
  return { products: products, settings: settings, orders: readOrders(), messages: readMessages() };
}

function readOrders() {
  var values = byName(SHEET_ORDERS).getDataRange().getValues();
  var list = [];
  for (var r = 1; r < values.length; r++) {
    if (!values[r][0]) continue;
    list.push(parseOrderRow(values[r]));
  }
  return list;
}

function parseOrderRow(row) {
  if (row[12]) {
    try { return JSON.parse(String(row[12])); } catch (err) {}
  }
  return {
    orderNo: row[0], createdAt: row[1], customerName: row[2], customerPhone: row[3], customerEmail: row[4],
    shippingDetail: row[5], remitLast5: row[6], itemsSummary: row[7], subtotal: row[8], shipFee: row[9],
    total: row[10], status: row[11] || "待確認匯款後五碼"
  };
}

function rememberOrder(order) {
  var sheet = byName(SHEET_ORDERS);
  var values = sheet.getDataRange().getValues();
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][0]) === String(order.orderNo)) return;
  }
  sheet.appendRow([
    order.orderNo, order.createdAt || "", order.customerName || "", order.customerPhone || "", order.customerEmail || "",
    order.shippingDetail || "", order.remitLast5 || "", order.itemsSummary || "", order.subtotal || 0, order.shipFee || 0,
    order.total || 0, order.status || "待確認匯款後五碼", JSON.stringify(order)
  ]);
}

function readMessages() {
  var values = byName(SHEET_MESSAGES).getDataRange().getValues();
  var list = [];
  for (var r = 1; r < values.length; r++) {
    if (!values[r][0]) continue;
    list.push({
      id: values[r][0], time: values[r][1], sender: values[r][2], phone: values[r][3], email: values[r][4],
      content: values[r][5], reply: values[r][6] || "", replyTime: values[r][7] || ""
    });
  }
  return list.reverse();
}

function writeProductTable(products) {
  var sheet = byName(SHEET_PRODUCTS);
  if (sheet.getLastRow() > 1) sheet.getRange(2, 1, sheet.getLastRow() - 1, 8).clearContent();
  if (!products.length) return;
  var rows = products.map(function (p) {
    return [p.id, p.name, p.price, p.icon, p.shape, p.customizable ? "可選色" : "固定配色", (p.parts || []).join("、"), (p.defaultCodes || []).join("、")];
  });
  sheet.getRange(2, 1, rows.length, 8).setValues(rows);
}

function publicMessage(msg) {
  return { id: msg.id, time: msg.time, sender: msg.sender, content: msg.content, reply: msg.reply || "", replyTime: msg.replyTime || "" };
}

function cleanSettings(raw) {
  raw = raw || {};
  var fee = parseInt(raw.shipFee, 10);
  var gas = String(raw.gasWebhookUrl || "");
  return {
    bankName: text(raw.bankName, 40),
    bankAccount: text(raw.bankAccount, 40),
    bankOwner: text(raw.bankOwner, 40),
    sellerNotifyEmail: text(raw.sellerNotifyEmail, 80),
    gasWebhookUrl: gas.indexOf("https://script.google.com/") === 0 ? gas : "",
    shipFee: isFinite(fee) && fee >= 0 && fee <= 999 ? fee : 60
  };
}

function sellerEmail() {
  var email = loadState().settings.sellerNotifyEmail;
  return email && email.indexOf("@") > 0 ? email : "";
}

function login(password) {
  if (!isPasswordConfigured()) return { status: "unconfigured", authVersion: 2, passwordConfigured: false };
  var props = PropertiesService.getScriptProperties();
  var until = Number(props.getProperty("LOGIN_LOCK_UNTIL") || 0);
  if (until > Date.now()) return { status: "locked", authVersion: 2, retryIn: Math.ceil((until - Date.now()) / 1000) };
  var salt = props.getProperty("ADMIN_SALT");
  var iterations = Number(props.getProperty("ADMIN_ITERATIONS") || 4000);
  var expected = props.getProperty("ADMIN_HASH");
  var actual = serverHash(String(password || ""), salt, iterations);
  if (!sameText(actual, expected)) {
    var fails = Number(props.getProperty("LOGIN_FAILS") || 0) + 1;
    props.setProperty("LOGIN_FAILS", String(fails));
    if (fails >= 8) props.setProperty("LOGIN_LOCK_UNTIL", String(Date.now() + 15 * 60 * 1000));
    else if (fails >= 5) props.setProperty("LOGIN_LOCK_UNTIL", String(Date.now() + 2 * 60 * 1000));
    return { status: "unauthorized", authVersion: 2, passwordConfigured: true };
  }
  props.deleteProperty("LOGIN_FAILS");
  props.deleteProperty("LOGIN_LOCK_UNTIL");
  return { status: "success", authVersion: 2, passwordConfigured: true, token: issueToken(), expiresIn: 8 * 60 * 60 };
}

function changePassword(password) {
  if (!passwordOk(String(password || ""))) return { status: "error", message: "密碼至少 10 碼，且要有英文、數字與符號" };
  storePassword(String(password));
  return { status: "success", authVersion: 2, passwordConfigured: true };
}

function isPasswordConfigured() {
  var props = PropertiesService.getScriptProperties();
  return !!(props.getProperty("ADMIN_HASH") && props.getProperty("ADMIN_SALT"));
}

function issueToken() {
  ensureSecret();
  var exp = Date.now() + 8 * 60 * 60 * 1000;
  var sig = Utilities.base64Encode(Utilities.computeHmacSha256Signature(String(exp), PropertiesService.getScriptProperties().getProperty("TOKEN_SECRET")));
  return Utilities.base64EncodeWebSafe(exp + "." + sig);
}

function tokenValid(token) {
  if (!token) return false;
  try {
    var raw = Utilities.newBlob(Utilities.base64DecodeWebSafe(String(token))).getDataAsString();
    var parts = raw.split(".");
    var exp = Number(parts[0]);
    if (!exp || Date.now() > exp) return false;
    var sig = Utilities.base64Encode(Utilities.computeHmacSha256Signature(String(exp), PropertiesService.getScriptProperties().getProperty("TOKEN_SECRET")));
    return sameText(sig, parts.slice(1).join("."));
  } catch (err) {
    return false;
  }
}

function ensureSecret() {
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty("TOKEN_SECRET")) props.setProperty("TOKEN_SECRET", Utilities.getUuid() + Utilities.getUuid());
}

function serverHash(password, salt, iterations) {
  var current = String(salt) + "|" + String(password);
  var n = Math.max(1, Math.min(8000, Number(iterations) || 4000));
  for (var i = 0; i < n; i++) {
    var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, current, Utilities.Charset.UTF_8);
    current = Utilities.base64Encode(digest);
  }
  return current;
}

function storePassword(password) {
  var props = PropertiesService.getScriptProperties();
  var salt = Utilities.getUuid() + Utilities.getUuid();
  props.setProperty("ADMIN_SALT", salt);
  props.setProperty("ADMIN_ITERATIONS", "4000");
  props.setProperty("ADMIN_HASH", serverHash(password, salt, 4000));
  props.deleteProperty("LOGIN_FAILS");
  props.deleteProperty("LOGIN_LOCK_UNTIL");
  ensureSecret();
}

function passwordOk(password) {
  return password.length >= 10 && /[A-Za-z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);
}

function sameText(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function allowRate(kind, limit) {
  var cache = CacheService.getScriptCache();
  var key = kind + "-" + Math.floor(Date.now() / 3600000);
  var count = Number(cache.get(key) || 0) + 1;
  cache.put(key, String(count), 3600);
  return count <= limit;
}

function readKeyedJson(sheet, key) {
  var values = sheet.getDataRange().getValues();
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][0]) !== key) continue;
    var joined = "";
    for (var c = 1; c < values[r].length; c++) {
      if (values[r][c] !== "" && values[r][c] != null) joined += String(values[r][c]);
    }
    if (!joined) return null;
    return JSON.parse(joined);
  }
  return null;
}

function writeKeyedJson(sheet, key, obj) {
  var textValue = JSON.stringify(obj);
  var parts = [];
  for (var i = 0; i < textValue.length; i += CHUNK) parts.push(textValue.substring(i, i + CHUNK));
  var values = sheet.getDataRange().getValues();
  var row = 0;
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][0]) === key) { row = r + 1; break; }
  }
  if (!row) row = Math.max(sheet.getLastRow() + 1, 2);
  var width = Math.max(sheet.getLastColumn(), parts.length + 1, 2);
  var blank = [];
  for (var c = 0; c < width; c++) blank.push("");
  sheet.getRange(row, 1, 1, width).setValues([blank]);
  var rowValues = [key].concat(parts);
  sheet.getRange(row, 1, 1, rowValues.length).setValues([rowValues]);
}

function byName(name) {
  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(name);
  if (!sheet) throw new Error("找不到工作表：" + name);
  return sheet;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function text(value, max) {
  return String(value || "").replace(/[<>]/g, "").trim().substring(0, max);
}

function mail(to, subject, body) {
  if (!to || String(to).indexOf("@") < 1) return;
  try { MailApp.sendEmail(String(to), subject, body); } catch (err) {}
}

/** 在編輯器暫時把 password 填上，按執行，完成後立刻改回空字串再存檔。 */
function 設定賣家密碼() {
  var password = "";
  if (!passwordOk(password)) {
    throw new Error("請先在這支函式裡暫時填入至少 10 碼、含英文、數字與符號的新密碼。執行完立刻刪掉並存檔。");
  }
  storePassword(password);
}

/** 從試算表設定裡移除已外洩的密碼與 GitHub 權杖。可重複執行。 */
function 清除試算表裡的密碼與權杖() {
  var sheet = byName(SHEET_SETTINGS);
  var current = readKeyedJson(sheet, "storeSettings") || {};
  writeKeyedJson(sheet, "storeSettings", cleanSettings(current));
}
