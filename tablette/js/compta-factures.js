// FMD — Compta : lecture des factures fournisseurs à importer (24 nov. 2026, demande : « dans la compta rubrique
// "À payer" créer un importateur qui identifie fournisseur / montant / n° de facture / date de facture / date
// d'échéance etc »). Fonctions SANS écran (l'écran est dans compta.js, page « importer ») :
//  - PDF : texte lu avec pdf.js (vendor/pdf.min.js, chargé seulement à la première lecture), remis en lignes, puis
//    reconnaissance : fournisseur (SIRET / n° de TVA / nom d'un tiers du CRM / fournisseur déjà reconnu / en-tête),
//    n° de facture, date, échéance (ou conditions « 30 jours fin de mois »), total HT, TVA, TTC / net à payer.
//    Facture scannée (image, pas de texte) : ligne à remplir à la main, le fichier est quand même joint.
//  - Excel / CSV (liste de factures) : une ligne par facture, colonnes reconnues par leur titre.
// window.FMDFacturesFourn = { lire(fichiers, db, reconnus) → [ligne], analyserTexte(lignes, db, reconnus) }.
(function () {
  'use strict';
  const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '');
  const txt = (v) => (v == null ? '' : String(v).trim());
  const D = () => window.FMDERP || {};
  const arrondi = (n) => Math.round(n * 100) / 100;

  // ---------- pdf.js ----------
  let charge = null;
  function chargerPdfjs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (!charge) charge = new Promise((ok, ko) => { const s = document.createElement('script'); s.src = 'vendor/pdf.min.js';
      s.onload = () => { if (!window.pdfjsLib) { ko(new Error('Lecteur PDF indisponible.')); return; } window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js'; ok(window.pdfjsLib); };
      s.onerror = () => { charge = null; ko(new Error('Lecteur PDF introuvable (vendor/pdf.min.js).')); }; document.head.appendChild(s); });
    return charge;
  }
  // Texte du PDF remis en lignes (éléments regroupés par hauteur, de gauche à droite), 4 premières pages
  async function lignesPdf(buf) {
    const lib = await chargerPdfjs();
    const doc = await lib.getDocument({ data: new Uint8Array(buf), isEvalSupported: false, disableFontFace: true }).promise;
    const out = []; let grands = [];
    for (let p = 1; p <= Math.min(doc.numPages, 4); p++) {
      const pg = await doc.getPage(p); const tc = await pg.getTextContent();
      const items = tc.items.filter((i) => i.str && i.str.trim()).map((i) => ({ s: i.str, x: i.transform[4], y: i.transform[5], h: Math.abs(i.transform[3]) || 10 }));
      // Page 1 : textes du haut de page, du plus gros au plus petit (le nom du fournisseur est souvent en gros)
      if (p === 1 && items.length) { const haut = Math.max(...items.map((i) => i.y)); grands = items.filter((i) => i.y >= haut - 260).sort((a, b) => b.h - a.h || b.y - a.y).map((i) => i.s.replace(/\s+/g, ' ').trim()); }
      items.sort((a, b) => b.y - a.y || a.x - b.x);
      const lignes = []; items.forEach((i) => { const l = lignes.find((x) => Math.abs(x.y - i.y) <= Math.max(2.5, i.h * 0.35)); if (l) l.p.push(i); else lignes.push({ y: i.y, p: [i] }); });
      lignes.sort((a, b) => b.y - a.y).forEach((l) => out.push(l.p.sort((a, b) => a.x - b.x).map((i) => i.s).join(' ').replace(/\s+/g, ' ').trim()));
    }
    try { doc.destroy(); } catch { /* rien */ }
    const res = out.filter(Boolean); res.grands = grands; return res;
  }

  // ---------- montants et dates ----------
  const RE_MT = /(?<![\d,.])-?\d{1,3}(?:[   .]\d{3})+(?:,\d{1,2})?(?![\d])|(?<![\d,.])-?\d+,\d{1,2}(?![\d,])|(?<![\d,.])-?\d+\.\d{2}(?![\d.])/g;
  const lireMontant = (s) => { s = String(s).replace(/[\s  €]/g, ''); if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.'); else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, ''); const n = parseFloat(s); return Number.isFinite(n) ? n : null; };
  const montantsDe = (s) => (String(s).match(RE_MT) || []).map(lireMontant).filter((n) => n != null);
  const MOIS = { janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, aout: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12, janv: 1, fevr: 2, fev: 2, avr: 4, juil: 7, sept: 9, oct: 10, nov: 11, dec: 12 };
  const iso = (y, m, d) => { y = +y; if (y < 100) y += 2000; m = +m; d = +d; if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return ''; return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`; };
  const datesDe = (s) => { const r = []; const t = String(s);
    for (const m of t.matchAll(/(?<!\d)(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})(?!\d)/g)) { const x = iso(m[3], m[2], m[1]); if (x) r.push({ i: m.index, d: x }); }
    for (const m of t.matchAll(/(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)/g)) { const x = iso(m[1], m[2], m[3]); if (x) r.push({ i: m.index, d: x }); }
    for (const m of t.normalize('NFD').replace(/[̀-ͯ]/g, '').matchAll(/(?<!\d)(\d{1,2})(?:er)?\s+(janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre|janv|fevr|fev|avr|juil|sept|oct|nov|dec)\.?\s+(\d{4})/gi)) { const x = iso(m[3], MOIS[m[2].toLowerCase()], m[1]); if (x) r.push({ i: m.index, d: x }); }
    return r.sort((a, b) => a.i - b.i).map((x) => x.d); };
  const dateIso = (v) => { if (v == null || v === '') return ''; if (typeof v === 'number' && v > 20000 && v < 80000) return new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10);
    const s = txt(v); if (/^\d{5}(\.\d+)?$/.test(s)) return dateIso(+s); return datesDe(s)[0] || ''; };
  const ajoutJours = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
  const finDeMois = (d) => { const x = new Date(d + 'T12:00:00'); return new Date(x.getFullYear(), x.getMonth() + 1, 0, 12).toISOString().slice(0, 10); };

  // Valeur après une étiquette : sur la même ligne (après l'étiquette), sinon sur la ligne suivante
  function apres(lignes, re, lire, o = {}) {
    for (let k = 0; k < lignes.length; k++) {
      const i = o.fin ? lignes.length - 1 - k : k; // totaux : chercher depuis le bas (l'en-tête du tableau dit aussi « Total HT »)
      const l = lignes[i]; const m = l.match(re); if (!m) continue;
      if (o.sauf && o.sauf.test(l)) continue;
      const reste = l.slice(m.index + m[0].length); let v = lire(reste);
      if ((v == null || (Array.isArray(v) && !v.length)) && lignes[i + 1]) v = lire(lignes[i + 1]);
      if (v != null && !(Array.isArray(v) && !v.length)) return Array.isArray(v) ? v : v;
    }
    return null;
  }
  const dernier = (a) => (a && a.length ? a[a.length - 1] : null);

  // ---------- reconnaissance d'une facture ----------
  function analyserTexte(lignes, db, reconnus = {}) {
    const tout = lignes.join('\n'); const nTout = norm(tout); const S = D().SOCIETE || {};
    const r = { nom: '', tiers: '', numero: '', date: '', echeance: '', ht: null, tva: null, ttc: null, cle: '', notes: [] };
    // Fournisseur : 1) SIRET / SIREN / TVA d'un tiers  2) déjà reconnu  3) nom d'un tiers dans le texte  4) en-tête
    const nosIds = new Set([S.siret, S.siren, S.tva].filter(Boolean).map((x) => norm(x)));
    const sirets = [...tout.matchAll(/(?<!\d)(\d{3}[  ]?\d{3}[  ]?\d{3}(?:[  ]?\d{5})?)(?!\d)/g)].map((m) => m[1].replace(/\D/g, '')).filter((x) => (x.length === 9 || x.length === 14) && !nosIds.has(x) && !nosIds.has(x.slice(0, 9)));
    const tvas = [...tout.matchAll(/\b(FR[  ]?[0-9A-Z]{2}[  ]?\d{3}[  ]?\d{3}[  ]?\d{3})\b/gi)].map((m) => norm(m[1])).filter((x) => !nosIds.has(x));
    const tiers = (db.tiers || []).filter((t) => t.nom && norm(t.nom) !== norm(S.nom || 'fmd'));
    let t = null;
    for (const x of [...sirets, ...tvas]) { t = tiers.find((y) => [y.siret, y.siren, y.tva_num].some((z) => z && (norm(z) === x || (x.length === 14 && norm(z) === x.slice(0, 9)))));
      if (t) break; }
    if (sirets[0] || tvas[0]) r.cle = 'id:' + (sirets[0] || tvas[0]);
    if (!t) for (const k of [...sirets.map((x) => 'id:' + x), ...tvas.map((x) => 'id:' + x)]) { if (reconnus[k]) { t = tiers.find((y) => y.id === reconnus[k]); if (t) break; } }
    if (!t) { const cands = tiers.filter((y) => norm(y.nom).length >= 4 && nTout.includes(norm(y.nom))).sort((a, b) => (b.fournisseur ? 1 : 0) - (a.fournisseur ? 1 : 0) || norm(b.nom).length - norm(a.nom).length); t = cands[0] || null; }
    const nosNoms = [norm(S.nom || ''), 'fmd', 'fmdangers', 'fmdistrib'].filter(Boolean);
    // En-tête : un texte du haut de page (le plus gros d'abord), sans « FACTURE », adresse, en-têtes de tableau ni notre nom
    const nomPossible = (l) => { l = String(l).replace(/\s*\b(facture|invoice|avoir|devis|credit note)\b.*$/i, '').trim(); const n = norm(l);
      return /[a-z]{3}/i.test(l) && n.length >= 3 && n.length <= 60 && !/^(facture|invoice|avoir|page|date|n[o°º]|client|devis|commande|adresse|tel|fax|mail|e-mail|www|siret|siren|capital|rcs|tva|iban|bic|code|r[ée]f|d[ée]signation|description|quantit|qt[ée]|prix|total|montant|livraison|conditions)\b|\b(rue|quai|avenue|boulevard|chemin|cedex|bp)\b|^\d/i.test(l) && !nosNoms.some((x) => x && n.includes(x)) ? l : ''; };
    const entete = (lignes.grands || []).map(nomPossible).find(Boolean) || lignes.slice(0, 12).map(nomPossible).find(Boolean) || '';
    if (!r.cle && entete) r.cle = 'nom:' + norm(entete);
    if (!t && r.cle && reconnus[r.cle]) t = tiers.find((y) => y.id === reconnus[r.cle]) || null;
    if (t) { r.tiers = t.id; r.nom = t.nom; } else { r.nom = entete; if (!entete) r.notes.push('fournisseur non trouvé'); }

    // N° de facture
    const RE_NUM = /(?:n[°ºo]\.?|num[ée]ro|no\.?|#)\s*(?:de\s+)?(?:la\s+)?facture|facture\s*(?:n[°ºo]\.?|num[ée]ro|no\.?|#)|invoice\s*(?:n[°ºo]\.?|number|no\.?|#)?|r[ée]f(?:[ée]rence)?\.?\s*(?:de\s+)?facture|^facture\b/im;
    const jeton = (s) => { const m = String(s).replace(/^[\s:#°º.-]+/, '').match(/^([A-Z0-9][A-Z0-9\-/_.]{1,30})/i); if (!m) return null; const v = m[1].replace(/[.\-/]+$/, ''); return /\d/.test(v) && !datesDe(v).length && v.length >= 3 ? v : null; };
    r.numero = apres(lignes, RE_NUM, jeton) || '';
    if (!r.numero) { const m = tout.match(/\b((?:FA|FAC|FACT|F|INV)[-_ /]?\d[\w\-/]{2,20})\b/i); if (m) r.numero = m[1]; }
    if (!r.numero) r.notes.push('n° non trouvé');

    // Dates
    const RE_ECH = /[ée]ch[ée]ance|date\s*limite|payable\s*(?:le|avant|au|jusqu)|[àa]\s*(?:payer|r[ée]gler)\s*(?:avant|le|au plus tard)|due\s*date|date\s*de\s*(?:paiement|r[èe]glement)/i;
    r.echeance = apres(lignes, RE_ECH, (s) => datesDe(s)[0] || null) || '';
    const RE_DATE = /date\s*(?:de\s*(?:la\s*)?)?(?:facture|facturation|[ée]mission)|facture\s*(?:n[°ºo].{0,25}?)?\s*du\b|date\s*:|^date\b|\ble\s*:/im;
    r.date = apres(lignes, RE_DATE, (s) => datesDe(s)[0] || null, { sauf: RE_ECH }) || '';
    if (!r.date) { const toutes = datesDe(tout).filter((d) => d !== r.echeance); r.date = toutes[0] || ''; }
    if (!r.date) r.notes.push('date non trouvée');
    if (!r.echeance && r.date) {
      const c = tout.normalize('NFD').replace(/[̀-ͯ]/g, '').match(/(\d{1,3})\s*j(?:ours?|\.)?\s*(fin\s*de\s*mois|fdm)?/i);
      if (c && +c[1] > 0 && +c[1] <= 120 && /paiement|reglement|condition|echeance|payable/i.test(tout.normalize('NFD').replace(/[̀-ͯ]/g, ''))) { let e = ajoutJours(r.date, +c[1]); if (c[2]) e = finDeMois(e); r.echeance = e; r.notes.push(`échéance calculée (${c[0].trim()})`); }
      else if (/comptant|a\s*reception|a\s*la\s*commande|deja\s*regle|paye\s*par\s*(cb|carte)/i.test(tout.normalize('NFD').replace(/[̀-ͯ]/g, ''))) r.echeance = r.date;
    }
    if (r.echeance && r.date && r.echeance < r.date) r.echeance = '';

    // Montants
    const val = (s) => dernier(montantsDe(s));
    r.ttc = apres(lignes, /net\s*[àa]\s*payer|total\s*[àa]\s*payer|reste\s*[àa]\s*payer|montant\s*[àa]\s*payer|solde\s*[àa]\s*payer/i, val, { fin: true })
      ?? apres(lignes, /total\s*t\.?t\.?c|montant\s*t\.?t\.?c|t\.?t\.?c\.?\s*:|total\s*g[ée]n[ée]ral|total\s*facture/i, val, { fin: true })
      ?? apres(lignes, /amount\s*due|total\s*due|grand\s*total/i, val, { fin: true });
    r.ht = apres(lignes, /total\s*(?:net\s*)?h\.?t|montant\s*(?:net\s*)?h\.?t|total\s*hors\s*taxes?|base\s*h\.?t|sous[-\s]?total/i, val, { sauf: /t\.?t\.?c/i, fin: true });
    r.tva = apres(lignes, /total\s*t\.?v\.?a|montant\s*t\.?v\.?a|^t\.?v\.?a\b(?!\s*intra)/im, val, { sauf: /intra|n[°ºo]|num|fr\s?\d/i, fin: true });
    if (r.ttc == null && r.ht != null) { r.ttc = arrondi(r.ht + (r.tva || 0)); if (r.tva == null) r.notes.push('TTC déduit du HT (TVA non trouvée)'); }
    if (r.ht != null && r.ttc != null && r.ht > r.ttc) [r.ht, r.ttc] = [r.ttc, r.ht];
    if (r.tva == null && r.ht != null && r.ttc != null) r.tva = arrondi(r.ttc - r.ht);
    if (r.ttc == null) { const tous = montantsDe(tout).filter((n) => n > 0); if (tous.length) { r.ttc = Math.max(...tous); r.notes.push('montant = plus grand montant du document, à vérifier'); } else r.notes.push('montant non trouvé'); }
    if (/\bavoir\b|credit\s*note/i.test(lignes.slice(0, 15).join(' '))) r.notes.push('ce document semble être un AVOIR');
    return r;
  }

  // ---------- liste Excel / CSV ----------
  const COLS = [
    ['nom', ['fournisseur', 'nomfournisseur', 'tiers', 'raisonsociale', 'societe', 'emetteur', 'nom', 'libelle', 'creancier']],
    ['numero', ['nfacture', 'numerofacture', 'numfacture', 'numerodefacture', 'nfact', 'facture', 'numero', 'reference', 'ref', 'piece', 'npiece', 'numeropiece']],
    ['date', ['datefacture', 'datedefacture', 'dateemission', 'datedemission', 'datepiece', 'date']],
    ['echeance', ['echeance', 'dateecheance', 'datedecheance', 'datelimite', 'datelimitedepaiement', 'datedepaiementprevue', 'datepaiementprevue', 'datedereglement']],
    ['ht', ['montantht', 'totalht', 'ht', 'montanthorstaxes']],
    ['tva', ['tva', 'montanttva', 'totaltva']],
    ['ttc', ['montantttc', 'totalttc', 'ttc', 'netapayer', 'montant', 'total', 'apayer', 'resteapayer', 'montantdu']],
    ['siret', ['siret', 'siren', 'tvaintracom', 'ntva', 'numerotva']],
  ];
  function lireListe(feuille, db, reconnus) {
    const tete = (feuille.lignes[0] || []).map(norm); const pris = new Set();
    const map = tete.map((h) => { const c = COLS.find(([k, al]) => !pris.has(k) && al.includes(h)); if (!c) return ''; pris.add(c[0]); return c[0]; });
    if (!map.includes('numero') && !map.includes('ttc') && !map.includes('ht')) return null;
    const S = D().SOCIETE || {}; const tiers = (db.tiers || []).filter((t) => t.nom && norm(t.nom) !== norm(S.nom || 'fmd'));
    return feuille.lignes.slice(1).filter((l) => l && l.some((x) => txt(x))).map((l) => {
      const v = (k) => { const i = map.indexOf(k); return i < 0 ? '' : l[i]; };
      const num = (k) => { const x = v(k); if (typeof x === 'number') return x; const n = lireMontant(txt(x)); return n; };
      const r = { nom: txt(v('nom')), tiers: '', numero: txt(v('numero')), date: dateIso(v('date')), echeance: dateIso(v('echeance')), ht: num('ht'), tva: num('tva'), ttc: num('ttc'), cle: '', notes: [] };
      const id = norm(v('siret')); if (id) r.cle = 'id:' + id;
      let t = id ? tiers.find((y) => [y.siret, y.siren, y.tva_num].some((z) => z && norm(z) === id)) : null;
      if (!t && r.cle && reconnus[r.cle]) t = tiers.find((y) => y.id === reconnus[r.cle]);
      if (!t && r.nom) { if (reconnus['nom:' + norm(r.nom)]) t = tiers.find((y) => y.id === reconnus['nom:' + norm(r.nom)]); if (!t) t = tiers.find((y) => norm(y.nom) === norm(r.nom)); r.cle = r.cle || 'nom:' + norm(r.nom); }
      if (t) { r.tiers = t.id; r.nom = t.nom; }
      if (r.ttc == null && r.ht != null) r.ttc = arrondi(r.ht + (r.tva || 0));
      if (r.tva == null && r.ht != null && r.ttc != null) r.tva = arrondi(r.ttc - r.ht);
      if (!r.numero) r.notes.push('n° manquant'); if (!r.date) r.notes.push('date manquante'); if (r.ttc == null) r.notes.push('montant manquant');
      return r;
    });
  }

  // ---------- point d'entrée ----------
  // Une « ligne » par facture trouvée : { fichier, file (à joindre, PDF / image), nom, tiers, numero, date, echeance, ht, tva, ttc, cle, notes, source }
  async function lire(fichiers, db, reconnus = {}, progres = () => {}) {
    const out = []; let i = 0;
    for (const f of fichiers) {
      i++; progres(i, fichiers.length, f.name);
      const ext = (f.name.split('.').pop() || '').toLowerCase();
      try {
        if (ext === 'pdf' || f.type === 'application/pdf') {
          const lignes = await lignesPdf(await f.arrayBuffer());
          if (lignes.join('').replace(/\s/g, '').length < 30) { out.push({ fichier: f.name, file: f, source: 'pdf', nom: '', tiers: '', numero: '', date: '', echeance: '', ht: null, tva: null, ttc: null, cle: '', notes: ['PDF scanné (image) : pas de texte lisible, à remplir à la main'] }); continue; }
          out.push({ fichier: f.name, file: f, source: 'pdf', ...analyserTexte(lignes, db, reconnus) });
        } else if (/^(png|jpe?g|webp|heic)$/.test(ext) || /^image\//.test(f.type)) {
          out.push({ fichier: f.name, file: f, source: 'image', nom: '', tiers: '', numero: '', date: '', echeance: '', ht: null, tva: null, ttc: null, cle: '', notes: ['photo : lecture automatique impossible, à remplir à la main (la photo est jointe)'] });
        } else if (D().echange && D().echange.lireFichier) {
          const feuilles = await D().echange.lireFichier(f); let n = 0;
          feuilles.forEach((fe) => { const l = lireListe(fe, db, reconnus); if (l) { l.forEach((x) => out.push({ fichier: `${f.name} · ${fe.nom}`, source: 'liste', ...x })); n += l.length; } });
          if (!n) out.push({ fichier: f.name, erreur: 'aucune colonne reconnue (il faut au moins « N° facture » ou « Montant »)' });
        } else out.push({ fichier: f.name, erreur: 'format non pris en charge' });
      } catch (e) { out.push({ fichier: f.name, erreur: e.message || String(e) }); }
    }
    return out;
  }

  window.FMDFacturesFourn = { lire, analyserTexte, lignesPdf, datesDe, montantsDe };
})();
