// FiyatBul — Tavily Search ile mobil fiyat karşılaştırma
// Çoklu API anahtarı: karışık (rastgele) kullanım + kota/bitmiş anahta otomatik yedek
const $ = (id) => document.getElementById(id);
const form = $("searchForm"), q = $("queryInput"), bc = $("barcodeInput"), res = $("results"),
  loading = $("loading"), emptyMsg = $("emptyMsg"),
  toolbar = $("toolbar"), count = $("resultCount"),
  recentChips = $("recentChips");

const TKEYS = "tavily_keys";
const TCUSTOM = "tavily_custom";

// Koda gömülü varsayılan anahtarlar — yeni anahtar eklemek için diziye satır ekle.
// Site her aramada rastgele birini kullanır (karışık), hata vereni atlayıp diğerini dener.
const DEFAULT_TAVILY_KEYS = [
  "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",
  "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",
  "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",
  "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",
  "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"
];
const RECENT = "fiyatbul_recent";
let lastResults = [];

function getKeys(){
  if(localStorage.getItem(TCUSTOM) === "1"){
    try{
      const arr = JSON.parse(localStorage.getItem(TKEYS) || "[]").map(s=>String(s).trim()).filter(Boolean);
      if(arr.length) return arr;
    }catch{}
  }
  return DEFAULT_TAVILY_KEYS.slice();
}
// Fisher-Yates karıştırma
function shuffledKeys(){
  const arr = getKeys().slice();
  for(let i = arr.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Ayar paneli
$("settingsBtn").onclick = () => {
  $("settingsPanel").classList.toggle("hidden");
  $("tavilyKeysInput").value = getKeys().join("\n");
  updateKeyStatus();
};
$("closeSettingsBtn").onclick = () => $("settingsPanel").classList.add("hidden");
$("resetKeyBtn").onclick = () => {
  localStorage.removeItem(TKEYS); localStorage.removeItem(TCUSTOM);
  $("tavilyKeysInput").value = getKeys().join("\n");
  updateKeyStatus();
};
$("saveKeyBtn").onclick = () => {
  const arr = $("tavilyKeysInput").value.split("\n").map(s=>s.trim()).filter(Boolean);
  if(arr.length){ localStorage.setItem(TKEYS, JSON.stringify(arr)); localStorage.setItem(TCUSTOM, "1"); }
  else { localStorage.removeItem(TKEYS); localStorage.removeItem(TCUSTOM); }
  updateKeyStatus();
};
function updateKeyStatus(){
  const n = getKeys().length;
  const src = localStorage.getItem(TCUSTOM) === "1" ? "el ile girilen" : "gömülü";
  $("keyStatus").textContent = n ? `✅ ${n} Tavily anahtarı kayıtlı (${src}), karışık kullanılıyor` : "⚠️ En az 1 Tavily anahtarı gerekli — arama çalışmaz.";
}

// Son aramalar
function getRecent(){ try{ const v = JSON.parse(localStorage.getItem(RECENT)||"[]"); return v.map(x=> typeof x==="string" ? {term:x,barcode:"",label:x} : x); }catch{ return []; } }
function pushRecent(item){
  const label = item.label || item.term;
  let r = getRecent().filter(x=>(x.label||x.term)!==label); r.unshift(item); r = r.slice(0,6);
  localStorage.setItem(RECENT, JSON.stringify(r)); renderRecent();
}
function renderRecent(){
  const r = getRecent(); recentChips.innerHTML = "";
  // Otomatik arama YOK: çipe dokununca sadece kutular dolar, arama için Ara'ya basılır
  r.forEach(t=>{ const b=document.createElement("button"); b.className="chip"; b.type="button"; b.textContent=t.label || t.term;
    b.onclick=()=>{ q.value=t.term || ""; if(bc) bc.value=t.barcode || ""; q.focus(); }; recentChips.appendChild(b); });
}
renderRecent(); updateKeyStatus();
// Arama geçmişini sil tuşu
if($("clearHistoryBtn")) $("clearHistoryBtn").onclick = () => {
  localStorage.removeItem(RECENT);
  renderRecent();
};

// Tema: varsayılan dark, seçim hatırlanır (☀️/🌙)
const THEME_KEY = "fiyatbul_theme";
function applyTheme(t){
  document.documentElement.setAttribute("data-theme", t);
  const btn = $("themeBtn");
  if(btn) btn.textContent = t === "dark" ? "☀️" : "🌙";
  try{ localStorage.setItem(THEME_KEY, t); }catch{}
}
(function initTheme(){
  let t = "dark";
  try{ t = localStorage.getItem(THEME_KEY) || "dark"; }catch{}
  if(t !== "dark" && t !== "light") t = "dark";
  applyTheme(t);
})();
if($("themeBtn")) $("themeBtn").onclick = () => {
  const cur = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
  applyTheme(cur === "dark" ? "light" : "dark");
};

// TL fiyat yakala: 64.999 TL, 64.999,99 ₺, ₺64.999, 64999 TL
function extractPrices(text){
  if(!text) return [];
  const re = /(₺\s?\d[\d\s\.,]*)|(\d[\d\s\.,]*\s?(TL|₺|TRY))/gi;
  const out = []; let m;
  while((m = re.exec(text)) && out.length < 8){
    const raw = m[0];
    const num = raw.replace(/[^\d.,]/g,"").trim();
    if(!num) continue;
    let norm = num;
    if(norm.includes(",") && norm.includes(".")){
      norm = norm.replace(/\./g,"").replace(",",".");
    } else if(norm.includes(",")){
      const parts = norm.split(",");
      norm = parts.length===2 && parts[1].length===2 ? parts[0].replace(/\./g,"")+ "."+parts[1] : norm.replace(/,/g,"");
    } else {
      norm = norm.replace(/\.(?=\d{3}(\D|$))/g,"");
    }
    const val = parseFloat(norm.replace(/[^\d.]/g,""));
    if(val > 0.5 && val < 20000000) out.push({raw: raw.trim(), value: val});
  }
  return out;
}
function cheapest(text){ const p = extractPrices(text); if(!p.length) return null; return p.reduce((a,b)=>a.value<b.value?a:b); }
function hostOf(url){ try{ return new URL(url).hostname.replace(/^www\./,""); }catch{ return url; } }
// Sonuç süzgeci: sosyal ağ linklerini ayıkla (exclude_domains'e ek güvenlik)
function isSocialUrl(url){
  try{
    const h = new URL(url).hostname.toLowerCase().replace(/^www\./,"").replace(/^m\./,"").replace(/^mobile\./,"");
    return SOCIAL_EXCLUDE.some(d => h === d || h.endsWith("." + d));
  }catch{ return false; }
}
// Alakasız sonuç süzgeci: /marka/ gibi liste sayfaları + aranan ürünle eşleşmeyenler
// (örn: "nutella" aramasında marketkarsilastir.com/marka/algida gelmesin)
const LISTING_PATH_RE = /(^|\/)(marka|markalar|brand|brands)($|\/|\?)/i;
const TOKEN_STOP = new Set(["gr","gram","g","ml","cl","lt","l","kg","adet","paket","fiyat","fiyati","fiyatı","fiyatlar","fiyatlari","fiyatları","satın","satin","al","karsilastirma","karşılaştırma","tl","try","ve","ile","icin","için"]);
function queryTokens(term){
  return String(term||"").toLowerCase().replace(/[^a-zçğıöşü0-9\s]/g," ").split(/\s+/)
    .filter(t => t.length >= 3 && !TOKEN_STOP.has(t));
}
function isListingPage(url){
  try{ return LISTING_PATH_RE.test(new URL(url).pathname); }catch{ return false; }
}
function isRelevant(r, term, barcode){
  // Sadece barkodla arama yapıldıysa ürün adı bilinmiyor → eleme (barkod eşleşmesi yeterli)
  const termDigits = String(term||"").replace(/\D/g,"");
  const termText = String(term||"").replace(/[\d\s]/g,"");
  if(termDigits.length >= 6 && !termText) return true;
  const digits = String(barcode||"").replace(/\D/g,"");
  const text = ((r.title||"") + " " + (r.content||"") + " " + (r.url||"")).toLowerCase();
  if(digits.length >= 6 && text.includes(digits)) return true;
  const toks = queryTokens(term);
  if(!toks.length) return true;
  const long = toks.filter(t => t.length >= 4);
  const set = long.length ? long : toks;
  return set.some(t => text.includes(t));
}

const PRIORITY_DOMAIN = "marketkarsilastir.com";
// Satın alınabilir (e-ticaret/market) + fiyat karşılaştırma siteleri.
// Liste ne kadar genişse sonuçlar o kadar alışveriş odaklı olur.
const MARKETS = [
  { domain: "carrefoursa.com", name: "CarrefourSA", kind: "market" },
  { domain: "migros.com.tr", name: "Migros", kind: "market" },
  { domain: "sokmarket.com.tr", name: "ŞOK", kind: "market" },
  { domain: "bim.com.tr", name: "BİM", kind: "market" },
  { domain: "a101.com.tr", name: "A101", kind: "market" },
  { domain: "getir.com", name: "Getir", kind: "maret" },
  { domain: "istegelsin.com", name: "İsteGelsin", kind: "market" },
  { domain: "macrocenter.com.tr", name: "Macrocenter", kind: "market" },
  { domain: "trendyol.com", name: "Trendyol", kind: "eticaret" },
  { domain: "hepsiburada.com", name: "Hepsiburada", kind: "eticaret" },
  { domain: "n11.com", name: "n11", kind: "eticaret" },
  { domain: "amazon.com.tr", name: "Amazon TR", kind: "eticaret" },
  { domain: "pttavm.com", name: "PTT AVM", kind: "eticaret" },
  { domain: "teknosa.com", name: "Teknosa", kind: "eticaret" },
  { domain: "mediamarkt.com.tr", name: "MediaMarkt", kind: "eticaret" },
  { domain: "vatanbilgisayar.com", name: "Vatan", kind: "eticaret" },
  { domain: "ebebek.com", name: "ebebek", kind: "eticaret" },
  { domain: "gratis.com", name: "Gratis", kind: "eticaret" },
  { domain: "watsons.com.tr", name: "Watsons", kind: "eticaret" },
  { domain: "rossmann.com.tr", name: "Rossmann", kind: "eticaret" },
  { domain: "koctas.com.tr", name: "Koçtaş", kind: "eticaret" },
  { domain: "cimri.com", name: "Cimri", kind: "karsilastir" },
  { domain: "akakce.com", name: "Akakçe", kind: "karsilastir" },
  { domain: "epey.com", name: "Epey", kind: "karsilastir" }
];
// Tavily include_domains ile doğrudan bu sitelerde arama yapmak için düz liste
const SHOP_DOMAINS = MARKETS.map(m => m.domain);
const COMPARE_DOMAINS = MARKETS.filter(m => m.kind === "karsilastir").map(m => m.domain);
// Zincir marketler — ayrı sorguyla özellikle bu sitelerde aranır
const MARKET_DOMAINS = MARKETS.filter(m => m.kind === "market").map(m => m.domain);
// Sadece Türk siteleri: .tr uzantılı + bilinen Türk e-ticaret/market domainleri.
// Yabancı siteler (amazon.com, ebay.com vb.) sonuçlara hiç girmez.
const TR_COM = new Set([...MARKETS.map(m => m.domain).filter(d => !d.endsWith(".tr")), PRIORITY_DOMAIN]);
function isTurkishSite(url){
  try{
    const h = new URL(url).hostname.toLowerCase().replace(/^www\./,"").replace(/^m\./,"").replace(/^mobile\./,"");
    if(h.endsWith(".tr")) return true;
    for(const d of TR_COM){ if(h === d || h.endsWith("." + d)) return true; }
    return false;
  }catch{ return false; }
}
// Sosyal / video / forum siteleri — sonuçlara hiç karışmasın diye her aramada dışlanır
const SOCIAL_EXCLUDE = [
  "facebook.com", "instagram.com", "twitter.com", "x.com", "tiktok.com",
  "youtube.com", "linkedin.com", "pinterest.com", "snapchat.com", "reddit.com",
  "threads.net", "tumblr.com", "vk.com", "whatsapp.com", "telegram.me", "t.me"
];

function marketNameOf(url){
  const h = hostOf(url);
  if(h === PRIORITY_DOMAIN || h.endsWith("."+PRIORITY_DOMAIN)) return "MarketKarşılaştır";
  for(const m of MARKETS){ if(h === m.domain || h.endsWith("."+m.domain)) return m.name; }
  return h;
}
function marketKindOf(url){
  try{
    const h = new URL(url).hostname;
    const m = MARKETS.find(m => h === m.domain || h.endsWith("."+m.domain));
    return m ? m.kind : null;
  }catch{ return null; }
}
function priorityOf(url){
  try{
    const h = new URL(url).hostname;
    if(h === PRIORITY_DOMAIN || h.endsWith("."+PRIORITY_DOMAIN)) return 0;
    if(MARKETS.some(m => h === m.domain || h.endsWith("."+m.domain))) return 1;
    return 2;
  }catch{ return 2; }
}

// Tek Tavily çağrısı — anahtarları karışık sırayla dener (401/429/432/433'te sonrakine geç)
async function tavilyCall(body, keys){
  let lastErr = null;
  for(const key of keys){
    try{
      const r = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {"Content-Type":"application/json","Authorization":"Bearer "+key},
        body: JSON.stringify(body)
      });
      if(r.status === 401 || r.status === 403 || r.status === 429 || r.status === 432 || r.status === 433){
        let detail = "";
        try{ const e = await r.json(); detail = e.detail || e.message || ""; }catch{}
        lastErr = new Error("Anahtar kota/hata (" + r.status + ")" + (detail ? ": " + String(detail).slice(0,150) : "") + " — diğer anahtar deneniyor");
        continue; // sıradaki anahtarı dene
      }
      if(!r.ok){
        let detail = "";
        try{ const e = await r.json(); detail = e.detail || e.message || ""; }catch{}
        throw new Error("Tavily hatası " + r.status + (detail ? ": " + String(detail).slice(0,200) : ""));
      }
      return r.json();
    }catch(err){
      // Ağ hatasıysa da sıradaki anahtarla bir kez daha dene
      lastErr = err;
      if(String((err && err.message) || "").startsWith("Tavily hatası")) throw err;
    }
  }
  throw lastErr || new Error("Tüm anahtarlar başarısız oldu");
}

async function tavilySearch(term, barcode){
  const base = [term || "", barcode || ""].filter(Boolean).join(" ");
  const call = async (qtext, domains, num) => {
    const body = {
      query: qtext, max_results: num, search_depth: "advanced",
      include_answer: false, country: "turkey",
      exclude_domains: SOCIAL_EXCLUDE // facebook vb. sosyal siteler gelmesin
    };
    if(domains) body.include_domains = domains;
    return tavilyCall(body, shuffledKeys()); // her çağrıda karışık anahtar
  };
  // 4 paralel arama:
  // 1) MarketKarşılaştır (öncelikli), 2) zincir marketler (BİM/A101/ŞOK/Migros…),
  // 3) e-ticaret + karşılaştırma siteleri, 4) tüm web (sosyal siteler hariç).
  const [mk, markets, shops, broad] = await Promise.all([
    call(base + " fiyat", [PRIORITY_DOMAIN], 5),
    call(base + " fiyat", MARKET_DOMAINS, 10),
    call(base + " satın al fiyat", SHOP_DOMAINS, 10),
    call(base + " fiyat karşılaştırma", null, 10)
  ]);
  const seen = new Set();
  const merged = [];
  for(const it of [...(((mk||{}).results)||[]), ...(((markets||{}).results)||[]), ...(((shops||{}).results)||[]), ...(((broad||{}).results)||[])]){
    if(!it.url || seen.has(it.url)) continue;
    if(!isTurkishSite(it.url)) continue; // yabancı site gelmesin, sadece Türk siteleri
    if(isSocialUrl(it.url)) continue; // ikinci güvenlik: sosyal link kaldıysa ele
    if(isListingPage(it.url)) continue; // /marka/ gibi liste sayfaları gelmesin
    if(!isRelevant(it, term, barcode)) continue; // ürün adıyla eşleşmeyen sonuç gelmesin
    seen.add(it.url);
    const c = cheapest((it.title||"") + " " + (it.content||""));
    merged.push({ title: it.title, url: it.url, content: it.content || "", _price: c ? c.value : null, _priceRaw: c ? c.raw : null });
  }
  return { results: merged };
}

form.onsubmit = async (e) => {
  e.preventDefault();
  const term = q.value.trim(); if(!term && !(bc && bc.value.trim())) return;
  const barcode = bc ? bc.value.replace(/[^\d]/g,"").trim() : "";
  if(!getKeys().length){ $("settingsPanel").classList.remove("hidden"); alert("Önce en az 1 Tavily anahtarı kaydet (⚙️)."); return; }
  res.innerHTML=""; emptyMsg.style.display="none";
  loading.classList.remove("hidden"); toolbar.classList.add("hidden");
  try{
    const data = await tavilySearch(term || barcode, barcode);
    pushRecent({ term, barcode, label: barcode ? `${term} • ${barcode}` : (term || barcode) });
    lastResults = data.results || [];
    render();
  }catch(err){
    emptyMsg.style.display="block";
    emptyMsg.textContent = "Hata: " + err.message + " (anahtarları ⚙️ menüsünden kontrol et)";
  }finally{ loading.classList.add("hidden"); }
};

function render(){
  // Sadece fiyat bilgisi olanlar filtresi (araç çubuğundaki kutu)
  const arr = [...lastResults];
  // Sıra: önce MarketKarşılaştır, sonra market/e-ticaret/karşılaştırma siteleri,
  // her grupta fiyatı görünenler üstte (satın alınabilir sonuçlar önce)
  arr.sort((a,b)=> (priorityOf(a.url)-priorityOf(b.url)) || ((b._price?1:0)-(a._price?1:0)));
  res.innerHTML="";
  arr.forEach((r)=>{
    const d=document.createElement("div"); d.className="card";
    const kind = marketKindOf(r.url);
    const badge = priorityOf(r.url)===0 ? "⭐ MarketKarşılaştır" : priorityOf(r.url)===1 ? (kind==="karsilastir" ? "🔎 " : kind==="eticaret" ? "🛒 " : "🏪 ")+marketNameOf(r.url) : hostOf(r.url);
    const priceHtml = r._price
      ? `<div class="price">${escapeHtml(r._priceRaw)}</div>`
      : `<div class="price unknown">Fiyat için siteye bak</div>`;
    d.innerHTML = `<div class="badge">${escapeHtml(badge)}</div>
      <h3><a href="${escapeAttr(r.url)}" target="_blank" rel="noopener">${escapeHtml(r.title||"İsimsiz ürün")}</a></h3>
      ${priceHtml}
      <a class="open-btn" href="${escapeAttr(r.url)}" target="_blank" rel="noopener">Siteye git →</a>`;
    res.appendChild(d);
  });
  toolbar.classList.remove("hidden");
  const nPriced = arr.filter(r=>r._price).length;
  count.textContent = arr.length + " sonuç (" + nPriced + " fiyatlı)";
  emptyMsg.style.display = arr.length ? "none" : "block";
  if(!arr.length) emptyMsg.textContent = "Sonuç yok — farklı yazmayı dene (örn: Coca Cola 1L, Pınar Süt 1L).";
}
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function escapeAttr(s){ return String(s).replace(/"/g, "&quot;"); }

// 📷 Barkod tarayıcı (destekleyen telefonda BarcodeDetector, yoksa manuel uyarı)
let scanStream = null;
$("scanBtn").onclick = async () => {
  const box = $("scannerBox"), video = $("scannerVideo"), status = $("scanStatus");
  if(!("BarcodeDetector" in window)){
    alert("Bu tarayıcı otomatik barkod okumuyor. Barkodu elle yaz (örn: 8690…).");
    if(bc) bc.focus();
    return;
  }
  try{
    box.classList.remove("hidden");
    status.textContent = "Kamera açılıyor… Barkodu kameraya tut.";
    scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    video.srcObject = scanStream;
    await video.play();
    const detector = new BarcodeDetector({ formats: ["ean_13","ean_8","upc_a","upc_e","code_128","code_39","itf"] });
    const tick = async () => {
      if(video.paused || video.ended || box.classList.contains("hidden")) return;
      try{
        const codes = await detector.detect(video);
        if(codes && codes.length){
          const val = codes[0].rawValue || "";
          // Otomatik arama YOK: barkod kutuya yazılır, aramak için Ara'ya basılır
          if(bc) bc.value = val.replace(/[^\d]/g,"");
          status.textContent = "Bulundu: " + val + " — aramak için Ara'ya bas.";
          stopScan();
          return;
        }
      }catch{}
      requestAnimationFrame(()=>setTimeout(tick, 300));
    };
    tick();
  }catch(err){
    status.textContent = "Kamera açılamadı: " + err.message;
  }
};
function stopScan(){
  $("scannerBox").classList.add("hidden");
  if(scanStream){ scanStream.getTracks().forEach(t=>t.stop()); scanStream = null; }
  const v = $("scannerVideo"); if(v){ v.pause(); v.srcObject = null; }
}
$("stopScanBtn").onclick = stopScan;
