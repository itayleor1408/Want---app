// ---- product page reader (shared by the worker and the local tests) ----
function decodeEnt(s) {
  return String(s || '')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}
function numPrice(v) {
  if (v == null) return '';
  if (typeof v === 'number') return isFinite(v) && v > 0 ? String(Math.round(v * 100) / 100) : '';
  let s = String(v).replace(/[^\d.,]/g, '');
  if (!s) return '';
  const lc = s.lastIndexOf(','), ld = s.lastIndexOf('.');
  if (lc > -1 && ld > -1) s = lc > ld ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (lc > -1) s = /,\d{1,2}$/.test(s) ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\.(?=.*\.)/g, '');
  const n = parseFloat(s);
  return isFinite(n) && n > 0 ? String(Math.round(n * 100) / 100) : '';
}
const SYM = { '₪': 'ILS', '$': 'USD', '€': 'EUR', '£': 'GBP', '¥': 'JPY' };
function curOf(v) {
  if (!v) return '';
  const s = String(v).trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(s)) return s === 'NIS' ? 'ILS' : s;
  for (const k in SYM) if (String(v).includes(k)) return SYM[k];
  if (/ש"ח|ש״ח|שח/.test(v)) return 'ILS';
  return '';
}
function imgOf(v, base) {
  if (!v) return '';
  if (Array.isArray(v)) return imgOf(v[0], base);
  if (typeof v === 'object') return imgOf(v.url || v.contentUrl || v['@id'], base);
  try { return new URL(decodeEnt(v), base).href; } catch (e) { return ''; }
}
function extract(html, base) {
  const out = { title: '', image: '', price: '', currency: '', store: '', brand: '' };
  const meta = k => {
    const re1 = new RegExp('<meta[^>]+(?:property|name|itemprop)\\s*=\\s*["\']' + k + '["\'][^>]*?content\\s*=\\s*["\']([^"\']*)["\']', 'i');
    const re2 = new RegExp('<meta[^>]+content\\s*=\\s*["\']([^"\']*)["\'][^>]*?(?:property|name|itemprop)\\s*=\\s*["\']' + k + '["\']', 'i');
    const m = html.match(re1) || html.match(re2);
    return m ? decodeEnt(m[1]).trim() : '';
  };
  // 1) structured data (JSON-LD) — most shops publish a Product here
  const isProd = o => { const t = o && o['@type']; return t && (Array.isArray(t) ? t : [t]).some(x => /^(Product|ProductGroup|IndividualProduct|Car|Book|Offer)$/i.test(x)); };
  const fromOffers = off => {
    if (!off) return;
    const list = Array.isArray(off) ? off : [off];
    for (const o of list) {
      if (!o || typeof o !== 'object') continue;
      const p = numPrice(o.price ?? o.lowPrice ?? (o.priceSpecification && (Array.isArray(o.priceSpecification) ? o.priceSpecification[0] : o.priceSpecification).price));
      if (p && !out.price) { out.price = p; out.currency = curOf(o.priceCurrency || (o.priceSpecification && o.priceSpecification.priceCurrency)) || out.currency; }
      if (o.offers) fromOffers(o.offers);
    }
  };
  const seen = new Set();
  const walk = o => {
    if (!o || typeof o !== 'object' || seen.has(o)) return;
    seen.add(o);
    if (Array.isArray(o)) { o.forEach(walk); return; }
    if (isProd(o)) {
      if (!out.title && o.name) out.title = decodeEnt(o.name);
      if (!out.image && o.image) out.image = imgOf(o.image, base);
      if (!out.brand && o.brand) out.brand = decodeEnt(typeof o.brand === 'object' ? o.brand.name : o.brand);
      fromOffers(o.offers);
      if (!out.price && o.price) { out.price = numPrice(o.price); out.currency = curOf(o.priceCurrency); }
      if (o.hasVariant) walk(o.hasVariant);
    }
    for (const k in o) if (k !== 'offers') walk(o[k]);
  };
  for (const m of html.matchAll(/<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    const raw = m[1].replace(/^\s*<!--|-->\s*$/g, '').replace(/^\s*\/\*<!\[CDATA\[\*\/|\/\*\]\]>\*\/\s*$/g, '').trim();
    try { walk(JSON.parse(raw)); } catch (e) {
      try { walk(JSON.parse(raw.replace(/[\u0000-\u001f]+/g, ' '))); } catch (e2) {}
    }
  }
  // 1b) site-specific readers, for stores whose server HTML doesn't carry clean JSON-LD/OG data
  let host0 = '';
  try { host0 = new URL(base).hostname.replace(/^(www|m|shop)\./, ''); } catch (e) {}
  if (/aliexpress\./i.test(host0)) {
    // AliExpress hydrates the page from window.runParams = {... data: {...}}; pull the fields
    // directly out of that blob by key (it's not strict JSON, so we don't try to JSON.parse it).
    const run = (html.match(/runParams\s*=\s*\{[\s\S]{0,400000}?\n\s*<\/script>/i) || [html])[0];
    // keys in this blob may or may not be quoted (it's a JS object literal, not JSON)
    if (!out.price) {
      const p = run.match(/"?(?:formatedActivityPrice|formatedPrice|salePrice|minActivityAmount|minAmount)"?\s*:\s*"?([^",}]+)"?/i);
      if (p && numPrice(p[1])) { out.price = numPrice(p[1]); out.currency = out.currency || curOf(p[1]); }
      const c = run.match(/"?currency"?\s*:\s*"([A-Z]{3})"/i);
      if (c && !out.currency) out.currency = curOf(c[1]);
    }
    if (!out.title) {
      const t = run.match(/"?subject"?\s*:\s*"([^"]+)"/i);
      if (t) out.title = decodeEnt(t[1].replace(/\\u([0-9a-f]{4})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/\\\//g, '/'));
    }
    if (!out.image) {
      const i = run.match(/"?imagePathList"?\s*:\s*\[\s*"([^"]+)"/i) || run.match(/"?imageUrl"?\s*:\s*"([^"]+)"/i);
      if (i) out.image = imgOf(i[1].replace(/\\\//g, '/'), base);
    }
  } else if (/amazon\./i.test(host0)) {
    if (!out.image) {
      const dyn = html.match(/id\s*=\s*["']landingImage["'][^>]*data-old-hires\s*=\s*["']([^"']+)["']/i);
      if (dyn && dyn[1]) out.image = imgOf(dyn[1], base);
      if (!out.image) {
        const dynMap = html.match(/id\s*=\s*["']landingImage["'][^>]*data-a-dynamic-image\s*=\s*["']([^"']+)["']/i);
        if (dynMap) { const k = Object.keys(JSON.parse(decodeEnt(dynMap[1]).replace(/&quot;/g, '"')) || {})[0]; if (k) out.image = imgOf(k, base); }
      }
    }
    if (!out.price) {
      const whole = html.match(/class\s*=\s*["'][^"']*a-price-whole[^"']*["'][^>]*>\s*([\d.,]+)/i);
      const frac = html.match(/class\s*=\s*["'][^"']*a-price-fraction[^"']*["'][^>]*>\s*(\d+)/i);
      if (whole) { out.price = numPrice(whole[1] + (frac ? '.' + frac[1] : '')); }
      if (!out.price) {
        const blk = html.match(/id\s*=\s*["'](?:priceblock_ourprice|priceblock_dealprice|priceblock_saleprice)["'][^>]*>\s*([^<]{1,30})</i);
        if (blk && numPrice(blk[1])) { out.price = numPrice(blk[1]); out.currency = out.currency || curOf(blk[1]); }
      }
    }
  }
  // 2) Open Graph / product meta tags
  out.title = out.title || meta('og:title') || meta('twitter:title') || meta('name');
  out.image = out.image || imgOf(meta('og:image:secure_url') || meta('og:image') || meta('twitter:image') || meta('twitter:image:src') || meta('image'), base);
  if (!out.price) {
    const p = meta('product:price:amount') || meta('og:price:amount') || meta('product:sale_price:amount') || meta('price') || meta('twitter:data1');
    if (numPrice(p)) { out.price = numPrice(p); out.currency = curOf(meta('product:price:currency') || meta('og:price:currency') || meta('priceCurrency') || p); }
  }
  if (!out.currency) out.currency = curOf(meta('product:price:currency') || meta('og:price:currency') || meta('priceCurrency'));
  // 3) microdata and common inline JSON
  if (!out.price) {
    const m = html.match(/itemprop\s*=\s*["']price["'][^>]*content\s*=\s*["']([^"']+)["']/i) || html.match(/content\s*=\s*["']([\d.,]+)["'][^>]*itemprop\s*=\s*["']price["']/i);
    if (m) out.price = numPrice(m[1]);
  }
  if (!out.price) {
    const m = html.match(/"(?:price|salePrice|currentPrice|finalPrice)"\s*:\s*"?(\d[\d.,]*)"?/i);
    if (m) out.price = numPrice(m[1]);
    const c = html.match(/"(?:priceCurrency|currency|currencyCode)"\s*:\s*"([A-Z]{3})"/);
    if (c && !out.currency) out.currency = c[1];
  }
  if (!out.price) {
    const m = html.match(/class\s*=\s*["'][^"']*a-offscreen[^"']*["'][^>]*>\s*([^<]{1,30})</i);
    if (m && numPrice(m[1])) { out.price = numPrice(m[1]); out.currency = out.currency || curOf(m[1]); }
  }
  if (!out.image) {
    const m = html.match(/<link[^>]+rel\s*=\s*["']image_src["'][^>]*href\s*=\s*["']([^"']+)["']/i);
    if (m) out.image = imgOf(m[1], base);
  }
  if (!out.image) {
    const m = html.match(/<(?:img|link)[^>]+itemprop\s*=\s*["']image["'][^>]*(?:src|href|content)\s*=\s*["']([^"']+)["']/i)
      || html.match(/<(?:img|link)[^>]+(?:src|href|content)\s*=\s*["']([^"']+)["'][^>]*itemprop\s*=\s*["']image["']/i);
    if (m) out.image = imgOf(m[1], base);
  }
  if (!out.title) { const m = html.match(/<title[^>]*>([^<]*)<\/title>/i); if (m) out.title = decodeEnt(m[1]); }
  // tidy
  let host = '';
  try { host = new URL(base).hostname.replace(/^(www|m|shop)\./, ''); } catch (e) {}
  const sn = meta('og:site_name') || meta('application-name');
  out.store = sn || (host ? host.split('.')[0].replace(/^./, c => c.toUpperCase()) : '');
  if (!sn && out.store.length <= 4) out.store = out.store.toUpperCase();
  out.title = out.title.replace(/\s+/g, ' ').trim();
  if (out.store) {
    const esc = out.store.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out.title = out.title.replace(new RegExp('\\s*[|\\-–—:]\\s*' + esc + '.*$', 'i'), '').replace(new RegExp('^' + esc + '(\\.[a-z.]+)?\\s*[|\\-–—:]\\s*', 'i'), '');
  }
  out.title = out.title.replace(/\s*[|–—]\s*[^|–—]{1,30}$/, m => (out.title.length - m.length > 8 ? '' : m)).slice(0, 120).trim();
  if (!out.currency && out.price && /\.co\.il$|\.il$/.test(host)) out.currency = 'ILS';
  return out;
}
