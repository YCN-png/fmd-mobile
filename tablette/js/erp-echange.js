// FMD — CRM / ERP : Import / Export UNIVERSEL (19 nov. 2026, demande : « un exportateur et un importateur universel
// pour les produits, les clients et les fournisseurs, avec toutes les infos, je ne veux plus rien avoir à faire »).
// Menu Outils → Import / Export (route « echange »).
//  - EXPORT : un seul fichier Excel (.xlsx) avec un onglet par liste : Mode d'emploi, Produits, Prix d'achat (tous les
//    fournisseurs de chaque produit), Clients (clients + prospects), Fournisseurs, Contacts, Prix clients (prix négociés).
//    Ou une liste seule en CSV (point-virgule, lisible par Excel et par la plupart des logiciels).
//  - IMPORT : Excel (.xlsx) ou CSV / TXT (séparateur ; , ou tabulation détecté tout seul, UTF-8 ou Windows).
//    Les colonnes sont reconnues par leur titre, même venant d'un autre logiciel (Dolibarr, tableur fait main…) : voir
//    les « al » (autres noms acceptés) de chaque colonne. Aperçu avant d'importer (nouveaux / mis à jour / inchangés /
//    erreurs), calculé sur une COPIE de la base ; rien n'est supprimé, une case vide n'efface rien.
//    Fiche retrouvée par : identifiant FMD, puis référence (ou code-barres) pour un produit ; code client / fournisseur,
//    SIRET, puis nom pour un tiers. Stock modifié = mouvement « Import (inventaire) » (historique gardé).
// Aucune bibliothèque : le .xlsx est un ZIP de fichiers XML, écrit et lu ici (CompressionStream de Chromium).
(function () {
  'use strict';
  const D = (window.FMDERP = window.FMDERP || {});
  const P = (D.pages = D.pages || {});
  const U = D.ui;
  const esc = U.esc;

  // =====================================================================================================
  // ZIP (écriture et lecture)
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = (u) => { let c = 0xffffffff; for (let i = 0; i < u.length; i++) c = CRC[(c ^ u[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const flux = async (u, T) => new Uint8Array(await new Response(new Blob([u]).stream().pipeThrough(new T('deflate-raw'))).arrayBuffer());
  async function zip(fichiers) {
    const enc = new TextEncoder(); const parts = []; const central = []; let off = 0;
    for (const f of fichiers) {
      const nom = enc.encode(f.nom); const brut = typeof f.data === 'string' ? enc.encode(f.data) : f.data; const crc = crc32(brut);
      let d = brut; let meth = 0;
      try { if (window.CompressionStream) { const z = await flux(brut, CompressionStream); if (z.length < brut.length) { d = z; meth = 8; } } } catch { /* sans compression */ }
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, meth, true); h.setUint16(10, 0, true); h.setUint16(12, 0x5b73, true);
      h.setUint32(14, crc, true); h.setUint32(18, d.length, true); h.setUint32(22, brut.length, true); h.setUint16(26, nom.length, true); h.setUint16(28, 0, true);
      parts.push(new Uint8Array(h.buffer), nom, d);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, meth, true); c.setUint16(12, 0, true); c.setUint16(14, 0x5b73, true);
      c.setUint32(16, crc, true); c.setUint32(20, d.length, true); c.setUint32(24, brut.length, true); c.setUint16(28, nom.length, true); c.setUint32(42, off, true);
      central.push(new Uint8Array(c.buffer), nom); off += 30 + nom.length + d.length;
    }
    const taille = central.reduce((s, x) => s + x.length, 0);
    const e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, fichiers.length, true); e.setUint16(10, fichiers.length, true); e.setUint32(12, taille, true); e.setUint32(16, off, true);
    return new Blob([...parts, ...central, new Uint8Array(e.buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }
  function dezip(buf) {
    const u = new Uint8Array(buf); const dv = new DataView(buf); let e = -1;
    for (let i = u.length - 22; i >= Math.max(0, u.length - 65558); i--) if (dv.getUint32(i, true) === 0x06054b50) { e = i; break; }
    if (e < 0) throw new Error('Ce fichier n’est pas un vrai fichier Excel (.xlsx).');
    const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true); const f = {}; const dec = new TextDecoder();
    for (let k = 0; k < n; k++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const meth = dv.getUint16(p + 10, true); const cs = dv.getUint32(p + 20, true); const ln = dv.getUint16(p + 28, true); const lx = dv.getUint16(p + 30, true); const lc = dv.getUint16(p + 32, true); const lo = dv.getUint32(p + 42, true);
      const nom = dec.decode(u.subarray(p + 46, p + 46 + ln)); const debut = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true);
      f[nom.replace(/^\//, '')] = { meth, d: u.subarray(debut, debut + cs) }; p += 46 + ln + lx + lc;
    }
    return { noms: Object.keys(f), async texte(nom) { const x = f[nom]; if (!x) return null; const b = x.meth === 0 ? x.d : await flux(x.d, DecompressionStream); return new TextDecoder().decode(b); } };
  }

  // =====================================================================================================
  // EXCEL (.xlsx) : écriture
  const xml = (s) => String(s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const lettre = (i) => { let s = ''; i += 1; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
  const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const NSR = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  // Styles : 0 normal, 1 titre de colonne (noir + rose gold), 2 texte (codes-barres, SIRET, téléphones : jamais « 3,25E+12 »), 3 texte à la ligne.
  const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="${NS}">
<fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFF7DAC5"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF080808"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  // feuilles : [{ nom, cols: [{ t, f, l }], lignes: [[valeurs]], libre?: true (mode d'emploi, sans filtre) }]
  async function ecrireXlsx(feuilles) {
    const cellule = (v, ref, col) => {
      if (v == null || v === '') return '';
      if (col.f === 'n' && typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}"><v>${v}</v></c>`;
      const st = col.titre ? 4 : col.f === 't' ? 2 : col.l > 50 ? 3 : 0;
      return `<c r="${ref}" t="inlineStr"${st ? ` s="${st}"` : ''}><is><t xml:space="preserve">${xml(String(v).slice(0, 32000))}</t></is></c>`;
    };
    const fichiers = []; const noms = [];
    feuilles.forEach((f, i) => {
      const nom = f.nom.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31); noms.push(nom);
      const entete = f.libre ? '' : `<row r="1">${f.cols.map((c, j) => `<c r="${lettre(j)}1" t="inlineStr" s="1"><is><t xml:space="preserve">${xml(c.t)}</t></is></c>`).join('')}</row>`;
      const d0 = f.libre ? 1 : 2;
      const lignes = f.lignes.map((l, k) => `<row r="${k + d0}">${l.map((v, j) => cellule(v, lettre(j) + (k + d0), { ...(f.cols[j] || {}), titre: f.libre && l.titre })).join('')}</row>`).join('');
      const derniere = Math.max(1, f.lignes.length + d0 - 1);
      fichiers.push({ nom: `xl/worksheets/sheet${i + 1}.xml`, data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="${NS}" xmlns:r="${NSR}">`
        + (f.libre ? '' : '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>')
        + `<cols>${f.cols.map((c, j) => `<col min="${j + 1}" max="${j + 1}" width="${c.l || 16}" customWidth="1"${c.f === 't' ? ' style="2"' : ''}/>`).join('')}</cols>`
        + `<sheetData>${entete}${lignes}</sheetData>${f.libre ? '' : `<autoFilter ref="A1:${lettre(f.cols.length - 1)}${derniere}"/>`}</worksheet>` });
    });
    const filtres = feuilles.map((f, i) => (f.libre ? '' : `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${xml(noms[i].replace(/'/g, "''"))}'!$A$1:$${lettre(f.cols.length - 1)}$${Math.max(1, f.lignes.length + 1)}</definedName>`)).join('');
    return zip([
      { nom: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${feuilles.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>` },
      { nom: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${NSR}/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
      { nom: 'xl/workbook.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="${NS}" xmlns:r="${NSR}"><sheets>${noms.map((n, i) => `<sheet name="${xml(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>${filtres ? `<definedNames>${filtres}</definedNames>` : ''}</workbook>` },
      { nom: 'xl/_rels/workbook.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${feuilles.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${NSR}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${feuilles.length + 1}" Type="${NSR}/styles" Target="styles.xml"/></Relationships>` },
      { nom: 'xl/styles.xml', data: STYLES },
      ...fichiers,
    ]);
  }

  // =====================================================================================================
  // EXCEL (.xlsx) et CSV : lecture → [{ nom, lignes: [[valeurs]] }]
  const parser = (s) => new DOMParser().parseFromString(s, 'application/xml');
  const tous = (n, tag) => Array.from(n.getElementsByTagNameNS('*', tag));
  const texteDe = (n) => tous(n, 't').filter((t) => !t.parentNode || t.parentNode.localName !== 'rPh').map((t) => t.textContent).join('');
  // Lecture rapide des feuilles (20 nov. 2026) : le catalogue de 100 000 lignes × 43 colonnes chargé en « document » (DOMParser)
  // prenait plus de 5 Go de mémoire. Les feuilles et les textes partagés sont maintenant lus directement dans le texte XML.
  // fins de ligne normalisées comme le fait un lecteur XML (\r\n → \n), puis entités (&amp; &#13; …)
  const decXml = (x) => ((x = x.indexOf('\r') < 0 ? x : x.replace(/\r\n?/g, '\n')).indexOf('&') < 0 ? x : x.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (m, e) => (e[0] === '#'
    ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1)) : { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[e.toLowerCase()])));
  const texteXml = (x) => { if (!x) return ''; x = x.replace(/<(?:\w+:)?rPh\b[\s\S]*?<\/(?:\w+:)?rPh>/g, ''); let o = ''; const re = /<(?:\w+:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?t>/g; let m;
    while ((m = re.exec(x))) o += decXml(m[1]); return o; };
  const RE_ATTR = {}; const attr = (a, n) => { const re = RE_ATTR[n] || (RE_ATTR[n] = new RegExp('(?:^|\\s)' + n + '="([^"]*)"')); const m = re.exec(a); return m ? m[1] : null; };
  function lireFeuilleTexte(contenu, partages) {
    const lignes = []; const reL = /<(?:\w+:)?row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?row>)/g; let mL; let ir = 0;
    while ((mL = reL.exec(contenu))) {
      const num = (+attr(mL[1], 'r') || ir + 1) - 1; ir = num + 1; const l = []; let j = 0;
      const reC = /<(?:\w+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g; let mC; const corps = mL[2] || '';
      while ((mC = reC.exec(corps))) {
        const ref = attr(mC[1], 'r'); if (ref) { const m = /^([A-Z]+)/.exec(ref); if (m) j = [...m[1]].reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0) - 1; }
        const t = attr(mC[1], 't'); const in_ = mC[2] || ''; const mv = /<(?:\w+:)?v(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?v>/.exec(in_); const v = mv ? decXml(mv[1]) : '';
        l[j] = t === 's' ? partages[+v] ?? '' : t === 'inlineStr' ? texteXml(in_) : t === 'str' || t === 'e' ? v : t === 'b' ? (v === '1' ? 'Oui' : 'Non') : v === '' ? '' : Number.isFinite(+v) ? +v : v;
        j++;
      }
      lignes[num] = l;
    }
    return lignes;
  }
  // onglets annexes du fichier catalogue enrichi : pas lus du tout (100 000 lignes de « À vérifier » pour rien)
  const ANNEXES = /modedemploi|doublonssupprimes|averifier|categoriestags|lisezmoi/;
  async function lireXlsx(buf) {
    const z = dezip(buf);
    const wb = await z.texte('xl/workbook.xml'); if (!wb) throw new Error('Fichier Excel incomplet (classeur introuvable).');
    const rels = parser((await z.texte('xl/_rels/workbook.xml.rels')) || '<r/>'); const cible = {};
    tous(rels, 'Relationship').forEach((r) => { let t = r.getAttribute('Target') || ''; t = t.startsWith('/') ? t.slice(1) : 'xl/' + t; cible[r.getAttribute('Id')] = t.replace(/\/\.\//g, '/'); });
    const ss = await z.texte('xl/sharedStrings.xml'); const partages = [];
    if (ss) { const re = /<(?:\w+:)?si\b[^>]*?(?:\/>|>([\s\S]*?)<\/(?:\w+:)?si>)/g; let m; while ((m = re.exec(ss))) partages.push(texteXml(m[1] || '')); }
    const res = [];
    for (const s of tous(parser(wb), 'sheet')) {
      const nom = s.getAttribute('name') || 'Feuille'; if (ANNEXES.test(norm(nom))) continue;
      const id = s.getAttributeNS(NSR, 'id') || s.getAttribute('r:id'); const chemin = cible[id]; const contenu = chemin && await z.texte(chemin); if (!contenu) continue;
      const lignes = lireFeuilleTexte(contenu, partages);
      res.push({ nom, lignes: Array.from(lignes, (l) => Array.from(l || [], (x) => x ?? '')) });
    }
    return res;
  }
  async function lireXlsxDom(buf) { // ancienne lecture (essais de comparaison)
    const z = dezip(buf);
    const wb = await z.texte('xl/workbook.xml'); if (!wb) throw new Error('Fichier Excel incomplet (classeur introuvable).');
    const rels = parser((await z.texte('xl/_rels/workbook.xml.rels')) || '<r/>'); const cible = {};
    tous(rels, 'Relationship').forEach((r) => { let t = r.getAttribute('Target') || ''; t = t.startsWith('/') ? t.slice(1) : 'xl/' + t; cible[r.getAttribute('Id')] = t.replace(/\/\.\//g, '/'); });
    const ss = await z.texte('xl/sharedStrings.xml'); const partages = ss ? tous(parser(ss), 'si').map(texteDe) : [];
    const res = [];
    for (const s of tous(parser(wb), 'sheet')) {
      const id = s.getAttributeNS(NSR, 'id') || s.getAttribute('r:id'); const chemin = cible[id]; const contenu = chemin && await z.texte(chemin); if (!contenu) continue;
      const lignes = [];
      tous(parser(contenu), 'row').forEach((r, ir) => {
        const num = (+r.getAttribute('r') || ir + 1) - 1; const l = []; let j = 0;
        tous(r, 'c').forEach((c) => {
          const ref = c.getAttribute('r'); if (ref) { const m = /^([A-Z]+)/.exec(ref); j = [...m[1]].reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0) - 1; }
          const t = c.getAttribute('t'); const vn = tous(c, 'v')[0]; const v = vn ? vn.textContent : '';
          l[j] = t === 's' ? partages[+v] ?? '' : t === 'inlineStr' ? texteDe(c) : t === 'str' || t === 'e' ? v : t === 'b' ? (v === '1' ? 'Oui' : 'Non') : v === '' ? '' : Number.isFinite(+v) ? +v : v;
          j++;
        });
        lignes[num] = l;
      });
      res.push({ nom: s.getAttribute('name') || 'Feuille', lignes: Array.from(lignes, (l) => Array.from(l || [], (x) => x ?? '')) });
    }
    return res;
  }
  function lireCsv(buf, nom) {
    const u = new Uint8Array(buf); let s = new TextDecoder('utf-8').decode(u);
    if (s.includes('�')) s = new TextDecoder('windows-1252').decode(u); // fichier Excel « CSV (séparateur : point-virgule) » ancien
    s = s.replace(/^﻿/, '');
    const premiere = s.split(/\r?\n/).find((x) => x.trim()) || '';
    const compte = (c) => premiere.split('"').filter((_, i) => i % 2 === 0).join('').split(c).length - 1;
    const sep = [';', '\t', ',', '|'].sort((a, b) => compte(b) - compte(a))[0];
    const lignes = []; let l = []; let v = ''; let q = false;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (q) { if (ch === '"') { if (s[i + 1] === '"') { v += '"'; i++; } else q = false; } else v += ch; continue; }
      if (ch === '"' && v === '') q = true; else if (ch === sep) { l.push(v); v = ''; } else if (ch === '\n' || ch === '\r') { if (ch === '\r' && s[i + 1] === '\n') i++; l.push(v); lignes.push(l); l = []; v = ''; } else v += ch;
    }
    if (v !== '' || l.length) { l.push(v); lignes.push(l); }
    return [{ nom: nom.replace(/\.[^.]+$/, ''), lignes }];
  }
  function ecrireCsv(cols, lignes) {
    const c = (v) => { const s = v == null ? '' : typeof v === 'number' ? String(v).replace('.', ',') : String(v); return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    return new Blob(['﻿' + [cols.map((x) => c(x.t)), ...lignes.map((l) => l.map(c))].map((l) => l.join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  }

  // =====================================================================================================
  // Valeurs
  const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '');
  const txt = (v) => (v == null ? '' : String(v).trim());
  const num = (v) => { if (typeof v === 'number') return v; let s = txt(v); if (!s) return undefined; if (!/\d/.test(s)) return NaN; s = s.replace(/[^\d,.-]/g, '');
    const x = +(/,\d*$/.test(s) && s.includes('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(',', '.')); return Number.isFinite(x) ? x : NaN; };
  const oui = (v) => { const s = norm(v); if (!s) return undefined; if (/^(oui|o|yes|y|1|vrai|true|x|actif|active)$/.test(s)) return true; if (/^(non|n|no|0|faux|false|inactif)$/.test(s)) return false; return null; };
  const ouiNon = (b) => (b ? 'Oui' : 'Non');
  const chiffres = (s) => String(s || '').replace(/\D/g, '');
  const IMG_FMD = '(image enregistrée dans FMD)';
  const imgExport = (s) => (!s ? '' : /^data:/.test(s) ? IMG_FMD : s);
  const imgImport = (s) => { s = txt(s); return s && s !== IMG_FMD && (/^(https?:|data:image\/|file:)/i.test(s) || /^www\./i.test(s)) ? (/^www\./i.test(s) ? 'https://' + s : s) : null; };
  const liste = (s) => txt(s).split(/\s*[|\n;]\s*/).map((x) => x.trim()).filter(Boolean);
  const choix = (opts, v) => { const n = norm(v); if (!n) return undefined; const o = opts.find((x) => norm(x[0]) === n || norm(x[1]) === n) || opts.find((x) => norm(x[1]).includes(n) || n.includes(norm(x[1]))); return o ? o[0] : null; };
  const jour = (s) => (s ? String(s).slice(0, 10) : '');

  // =====================================================================================================
  // Colonnes de chaque liste. t : titre exporté ; al : autres titres reconnus à l'import ; g(o, db) : valeur exportée ;
  // s(o, valeur, x) : écrit la valeur lue (x = { db, avert(msg) }) ; f : 'n' nombre, 't' texte (codes), sinon texte ;
  // lecture : exporté seulement (calculé) ; l : largeur de colonne.
  const C = (t, al, g, s, o = {}) => ({ t, al, g, s, ...o });
  const setTxt = (k) => (o, v) => { o[k] = txt(v); };
  const setNum = (k) => (o, v, x) => { const n = num(v); if (Number.isNaN(n)) return x.avert(`« ${v} » n’est pas un nombre`); o[k] = n; };
  const setOui = (k, inverse) => (o, v, x) => { const b = oui(v); if (b === null) return x.avert(`« ${v} » : écrire Oui ou Non`); o[k] = inverse ? !b : b; };
  const setImg = (k) => (o, v, x) => { const s = imgImport(v); if (s) o[k] = s; else if (txt(v) !== IMG_FMD) x.avert(`image ignorée (pas un lien http…) : ${String(v).slice(0, 40)}`); };
  const meilleur = (p) => (p.fournisseurs || []).reduce((m, f) => (m == null || f.pu * (1 - (f.remise || 0) / 100) < m.pu * (1 - (m.remise || 0) / 100) ? f : m), null);
  const nomTiers = (db, id) => (D.tiers(db, id) || {}).nom || '';

  const COL_PRODUITS = [
    C('Référence', ['ref', 'réf', 'réf.', 'reference produit', 'réf. produit', 'code article', 'code produit', 'sku', 'article', 'code'], (p) => p.ref, setTxt('ref'), { f: 't', l: 18, cle: true }),
    C('Libellé', ['designation', 'désignation', 'nom', 'nom du produit', 'nom produit', 'label', 'intitule', 'libelle produit', 'titre'], (p) => p.libelle, setTxt('libelle'), { l: 40 }),
    C('Code-barres EAN13 (GTIN)', ['ean', 'ean13', 'gtin', 'gtin13', 'code barre', 'code barres', 'code-barres', 'codebarre', 'barcode', 'valeur du code-barres', 'valeur du code barres (ean13)', 'ean 13'], (p) => p.code_barres,
      (p, v, x) => { const s = typeof v === 'number' ? String(Math.round(v)) : txt(v).replace(/\s/g, ''); if (s && !/^\d{8,14}$/.test(s)) x.avert(`code-barres inhabituel : ${s}`); p.code_barres = s; }, { f: 't', l: 17 }),
    C('Catégorie (magasin)', ['categorie', 'catégorie', 'famille', 'categorie produit', 'type de produit'], (p) => D.categorie(p.categorie),
      (p, v, x) => { const c = choix(D.CATEGORIES, v); if (c) { if (c !== p.categorie) { p.souscat = ''; p.soussouscat = ''; } p.categorie = c; } else if (c === null) x.avert(`catégorie inconnue « ${v} » (gardée : ${D.categorie(p.categorie)})`); }, { l: 24 }),
    // Arborescence V2 (21 nov. 2026) : sous-catégorie et sous-sous-catégorie, par leur nom (dans le rayon de la ligne)
    C('Sous-catégorie', ['sous categorie', 'sous-catégorie', 'sous famille', 'sous-famille'], (p) => D.nomSousCat(p.categorie, p.souscat),
      (p, v, x) => { const c = choix(D.sousCats(p.categorie), v); if (c) { if (c !== p.souscat) p.soussouscat = ''; p.souscat = c; } else if (c === null) x.avert(`sous-catégorie inconnue dans ${D.categorie(p.categorie)} : « ${v} »`); }, { l: 28 }),
    C('Sous-sous-catégorie', ['sous sous categorie', 'sous-sous-catégorie', 'sous sous famille'], (p) => D.nomSousSousCat(p.categorie, p.souscat, p.soussouscat),
      (p, v, x) => { const c = choix(D.sousSousCats(p.categorie, p.souscat), v); if (c) p.soussouscat = c; else if (c === null) x.avert(`sous-sous-catégorie inconnue dans ${D.nomSousCat(p.categorie, p.souscat) || D.categorie(p.categorie)} : « ${v} »`); }, { l: 32 }),
    C('Rayon du site web', ['rayon', 'rayon site', 'rayon web', 'categorie site', 'catégorie site web'], (p) => (p.web_rayon ? D.nomRayon(p.web_rayon) : `Automatique (${D.nomRayon(D.rayonSite(p))})`),
      (p, v, x) => { if (/^auto/i.test(txt(v))) { p.web_rayon = ''; return; } const c = choix(D.RAYONS_SITE, v); if (c) p.web_rayon = c; else if (c === null) x.avert(`rayon inconnu « ${v} »`); }, { l: 26 }),
    C('Fournisseur / marque', ['fournisseur', 'marque', 'fabricant', 'brand', 'marque produit'], (p) => p.marque, setTxt('marque'), { l: 18 }),
    C('Description', ['description', 'descriptif', 'description longue', 'texte', 'description courte'], (p) => p.description, setTxt('description'), { l: 60 }),
    ...D.NIVEAUX.map((n, i) => C(i ? `Prix ${n} HT` : 'Prix de vente HT', i ? [`prix ${n}`, `prix niveau ${i + 1}`, `niveau ${i + 1}`] : ['prix de vente', 'prix vente', 'pv', 'pv ht', 'prix ht', 'prix public', 'prix public ht', 'prix', 'prix de vente ht (public)', 'tarif', 'prix unitaire ht', 'prix de vente unitaire'],
      (p) => (p.prix || [])[i] ?? '', (p, v, x) => { const pu = num(v); if (Number.isNaN(pu)) return x.avert(`prix « ${v} » non compris`); x.prix[i] = pu; }, { f: 'n', l: 14 })),
    C('Prix de vente TTC', ['prix ttc', 'prix de vente ttc', 'pv ttc', 'prix public ttc'], (p) => D.arrondi(((p.prix || [])[0] || 0) * (1 + (p.tva ?? 20) / 100)), (p, v, x) => { const n = num(v); if (Number.isNaN(n)) return x.avert(`prix TTC « ${v} » non compris`); x.ttc = n; }, { f: 'n', l: 14 }),
    C('Prix minimum HT', ['prix minimum', 'prix min', 'prix plancher'], (p) => p.prix_min || '', setNum('prix_min'), { f: 'n', l: 13 }),
    C('TVA vente (%)', ['tva', 'taux tva', 'tva %', 'taux de tva', 'tva vente', 'tva à la vente'], (p) => p.tva ?? 20, setNum('tva'), { f: 'n', l: 10 }),
    C('TVA achat (%)', ['tva achat', 'tva à l achat', 'taux tva achat'], (p) => D.tvaAchat(p), setNum('tva_achat'), { f: 'n', l: 10 }),
    C('Fournisseur du prix d’achat', ['fournisseur achat', 'fournisseur principal', 'fournisseur prix achat', 'fournisseur d achat'], (p, db) => { const f = meilleur(p); return f ? nomTiers(db, f.tiers) : ''; }, (p, v, x) => { x.achat.fourn = txt(v); }, { l: 22 }),
    C('Réf. chez le fournisseur', ['ref fournisseur', 'réf fournisseur', 'reference fournisseur', 'ref. fournisseur', 'code fournisseur article'], (p) => (meilleur(p) || {}).ref || '', (p, v, x) => { x.achat.ref = txt(v); }, { f: 't', l: 16 }),
    C('Prix d’achat HT', ['prix achat', 'prix d achat', 'pa', 'pa ht', 'prix achat ht', 'cout achat', 'prix fournisseur', 'prix d achat unitaire', 'prix unitaire achat'], (p) => (meilleur(p) || {}).pu ?? '', (p, v, x) => { const n = num(v); if (Number.isNaN(n)) return x.avert(`prix d’achat « ${v} » non compris`); x.achat.pu = n; }, { f: 'n', l: 13 }),
    C('Remise achat (%)', ['remise achat', 'remise fournisseur'], (p) => (meilleur(p) || {}).remise || '', (p, v, x) => { const n = num(v); if (!Number.isNaN(n)) x.achat.remise = n; }, { f: 'n', l: 11 }),
    C('Qté minimum d’achat', ['qte min', 'quantite minimum', 'minimum de commande', 'conditionnement'], (p) => (meilleur(p) || {}).qte_min || '', (p, v, x) => { const n = num(v); if (!Number.isNaN(n)) x.achat.qte_min = n; }, { f: 'n', l: 11 }),
    C('Délai fournisseur (jours)', ['delai', 'délai', 'delai livraison', 'délai de livraison'], (p) => (meilleur(p) || {}).delai || '', (p, v, x) => { const n = num(v); if (!Number.isNaN(n)) x.achat.delai = n; }, { f: 'n', l: 11 }),
    C('PMP HT', ['pmp', 'prix moyen pondere', 'prix moyen pondéré', 'cump'], (p) => p.pmp || '', setNum('pmp'), { f: 'n', l: 11 }),
    C('Prix de revient HT', [], (p) => D.prixRevient(p) || '', null, { f: 'n', l: 12, lecture: true }),
    C('Stock physique', ['stock', 'stock reel', 'stock réel', 'quantite', 'quantité', 'qte', 'qté', 'quantite en stock', 'stock disponible', 'en stock'], (p) => p.stock || 0, (p, v, x) => { const n = num(v); if (Number.isNaN(n)) return x.avert(`stock « ${v} » non compris`); x.stock = n; }, { f: 'n', l: 11 }),
    C('Stock virtuel', [], (p, db) => (D.stockVirtuel ? D.stockVirtuel(db, p) : p.stock || 0), null, { f: 'n', l: 11, lecture: true }),
    C('Seuil d’alerte', ['alerte', 'seuil alerte', 'stock alerte', 'limite stock', 'limite stock pour alerte', 'stock minimum', 'stock mini'], (p) => p.alerte || 0, setNum('alerte'), { f: 'n', l: 10 }),
    C('Stock optimal', ['stock optimal', 'stock desire', 'stock désiré optimal', 'stock maxi'], (p) => p.optimal || '', setNum('optimal'), { f: 'n', l: 10 }),
    C('Poids (kg)', ['poids', 'poids kg', 'masse'], (p) => p.poids || '', setNum('poids'), { f: 'n', l: 9 }),
    C('En vente', ['en vente', 'vendu', 'actif', 'etat vente'], (p) => ouiNon(p.en_vente !== false), setOui('en_vente'), { l: 9 }),
    C('En achat', ['en achat', 'achete', 'etat achat'], (p) => ouiNon(p.en_achat !== false), setOui('en_achat'), { l: 9 }),
    C('Sur le site web', ['sur le site', 'publie', 'publié', 'site web', 'visible site', 'web'], (p) => ouiNon(p.web_publie !== false), setOui('web_publie'), { l: 10 }),
    C('Produit à variantes', [], (p, db) => (p.modele_id && D.modele(db, p.modele_id) ? D.modele(db, p.modele_id).nom : ''), null, { l: 22, lecture: true }),
    C('Couleur', ['couleur', 'coloris', 'color'], (p) => p.couleur || '', setTxt('couleur'), { l: 12 }),
    C('Taille', ['taille', 'size', 'pointure'], (p) => p.taille || '', setTxt('taille'), { l: 9 }),
    C('Image (URL)', ['image', 'photo', 'url image', 'lien image', 'image url', 'visuel', 'url photo', 'image principale'], (p) => imgExport(p.image), (p, v, x) => { const av = p.image; setImg('image')(p, v, x); if (p.modele_id && p.image !== av) p.image_perso = true; }, { l: 40 }),
    C('Autres photos (URL, séparées par |)', ['galerie', 'autres photos', 'photos', 'images supplementaires', 'images'], (p) => (p.galerie || []).map(imgExport).filter((s) => s !== IMG_FMD).join(' | '), (p, v) => { const l = liste(v).map(imgImport).filter(Boolean); if (l.length) p.galerie = l; }, { l: 40 }),
    C('URL publique (page produit)', ['url', 'url publique', 'lien', 'page produit', 'lien produit', 'url produit'], (p) => p.url || '', setTxt('url'), { l: 30 }),
    C('Note interne', ['note', 'note interne', 'commentaire', 'remarque'], (p) => p.note || '', setTxt('note'), { l: 30 }),
    C('Compte comptable vente', ['compte vente', 'code comptable vente', 'cpt vente'], (p) => p.cpt_vente || '', setTxt('cpt_vente'), { f: 't', l: 12 }),
    C('Compte comptable achat', ['compte achat', 'code comptable achat', 'cpt achat'], (p) => p.cpt_achat || '', setTxt('cpt_achat'), { f: 't', l: 12 }),
    C('Créé le', [], (p) => jour(p.cree), null, { l: 11, lecture: true }),
    C('Modifié le', [], (p) => jour(p.modifie), null, { l: 11, lecture: true }),
    C('Identifiant FMD', ['identifiant fmd', 'id fmd'], (p) => p.id, null, { f: 't', l: 20, id: true }),
  ];

  const NATURE = (t) => [t.client && 'Client', t.prospect && 'Prospect', t.fournisseur && 'Fournisseur'].filter(Boolean).join(', ');
  const COL_TIERS = [
    C('Code client', ['code client', 'code tiers', 'n client', 'numero client', 'num client'], (t) => t.code_client || '', null, { f: 't', l: 15, cleClient: true }),
    C('Code fournisseur', ['code fournisseur', 'n fournisseur', 'numero fournisseur'], (t) => t.code_fourn || '', null, { f: 't', l: 15, cleFourn: true }),
    C('Nom', ['nom', 'nom du tiers', 'raison sociale', 'société', 'societe', 'entreprise', 'nom de l entreprise', 'name', 'denomination', 'nom client', 'nom fournisseur'], (t) => t.nom, setTxt('nom'), { l: 30, nom: true }),
    C('Nom alternatif', ['nom alternatif', 'nom commercial', 'enseigne', 'alias'], (t) => t.alt || '', setTxt('alt'), { l: 20 }),
    C('Nature (Client, Prospect, Fournisseur)', ['nature', 'nature de tiers', 'type de relation'], NATURE, (t, v, x) => { const s = norm(v); if (!s) return; x.nature = true; t.client = s.includes('client'); t.prospect = s.includes('prospect') && !t.client; t.fournisseur = s.includes('fournisseur'); }, { l: 22 }),
    C('Adresse', ['adresse', 'adresse 1', 'rue', 'adresse postale', 'address'], (t) => t.adresse || '', setTxt('adresse'), { l: 32 }),
    C('Code postal', ['code postal', 'cp', 'zip', 'postal'], (t) => t.cp || '', (t, v) => { t.cp = typeof v === 'number' ? String(v).padStart(5, '0') : txt(v); }, { f: 't', l: 10 }),
    C('Ville', ['ville', 'commune', 'localite', 'city'], (t) => t.ville || '', setTxt('ville'), { l: 18 }),
    C('Département', ['departement', 'departement canton', 'canton'], (t) => t.departement || '', setTxt('departement'), { l: 16 }),
    C('Région', ['region'], (t) => t.region || '', setTxt('region'), { l: 18 }),
    C('Pays', ['pays', 'country'], (t) => t.pays || '', setTxt('pays'), { l: 10 }),
    C('Téléphone', ['telephone', 'téléphone', 'tel', 'tél', 'tel fixe', 'téléphone fixe', 'phone', 'tel standard'], (t) => t.tel || '', (t, v) => { t.tel = tel(v); }, { f: 't', l: 15 }),
    C('Téléphone portable', ['portable', 'mobile', 'tel portable', 'tél. portable', 'gsm', 'cellulaire'], (t) => t.portable || '', (t, v) => { t.portable = tel(v); }, { f: 't', l: 15 }),
    C('Fax', ['fax', 'telecopie'], (t) => t.fax || '', (t, v) => { t.fax = tel(v); }, { f: 't', l: 13 }),
    C('E-mail', ['email', 'e-mail', 'mail', 'courriel', 'adresse mail', 'adresse e-mail'], (t) => t.email || '', (t, v, x) => { const s = txt(v); if (s && !/^\S+@\S+\.\S+$/.test(s)) x.avert(`e-mail douteux : ${s}`); t.email = s; }, { l: 26 }),
    C('Site web', ['site web', 'site', 'site internet', 'web', 'url', 'website'], (t) => t.web || '', setTxt('web'), { l: 24 }),
    C('Refuse les e-mails de masse', ['refuse e-mails', 'pas de mail', 'refuser les e-mails de masse', 'desabonne', 'optout'], (t) => ouiNon(t.pas_mail), setOui('pas_mail'), { l: 12 }),
    C('SIREN', ['siren', 'n siren', 'numero siren', 'identifiant professionnel 1', 'idprof1'], (t) => t.siren || '', (t, v) => { t.siren = typeof v === 'number' ? String(v) : txt(v); }, { f: 't', l: 12 }),
    C('SIRET', ['siret', 'n siret', 'numero siret', 'siret siege', 'identifiant professionnel 2', 'idprof2'], (t) => t.siret || '', (t, v, x) => { const s = typeof v === 'number' ? String(v) : txt(v); if (chiffres(s).length === 9) { if (!t.siren) t.siren = chiffres(s); x.avert(`${s} : 9 chiffres = un SIREN, rangé dans la case SIREN`); return; } if (s && chiffres(s).length !== 14) x.avert(`SIRET de ${chiffres(s).length} chiffres (14 attendus) : ${s}`); t.siret = s; if (!t.siren && chiffres(s).length === 14) t.siren = chiffres(s).slice(0, 9); }, { f: 't', l: 17 }),
    C('NAF-APE', ['naf', 'ape', 'code naf', 'code ape', 'naf ape', 'activite', 'identifiant professionnel 3', 'idprof3'], (t) => t.naf || '', setTxt('naf'), { f: 't', l: 9 }),
    C('RCS/RM', ['rcs', 'rm', 'rcs rm', 'registre', 'identifiant professionnel 4', 'idprof4'], (t) => t.rcs || '', setTxt('rcs'), { l: 14 }),
    C('EORI', ['eori', 'numero eori', 'identifiant professionnel 5', 'idprof5'], (t) => t.eori || '', setTxt('eori'), { f: 't', l: 14 }),
    C('Forme juridique', ['forme juridique', 'type d entite legale', 'statut juridique', 'forme'], (t) => t.forme_juridique || '', setTxt('forme_juridique'), { l: 22 }),
    C('Capital (€)', ['capital', 'capital social'], (t) => t.capital || '', setNum('capital'), { f: 'n', l: 12 }),
    C('Maison mère', ['maison mere', 'societe mere', 'groupe'], (t) => t.maison_mere || '', setTxt('maison_mere'), { l: 20 }),
    C('Assujetti à la TVA', ['assujetti', 'assujetti tva', 'assujetti à la tva'], (t) => ouiNon(t.assujetti !== false), setOui('assujetti'), { l: 10 }),
    C('N° TVA intracommunautaire', ['tva intracom', 'numero tva', 'numéro de tva', 'n tva', 'tva intracommunautaire', 'vat', 'tva num'], (t) => t.tva_num || '', (t, v) => { t.tva_num = txt(v).replace(/\s/g, '').toUpperCase(); }, { f: 't', l: 17 }),
    C('Type de tiers', ['type', 'type de tiers', 'type tiers', 'taille entreprise', 'type du tiers'], (t) => t.type || '', (t, v, x) => { if (DOLI.type[txt(v)]) { t.type = DOLI.type[txt(v)]; return; } const c = choix(D.TYPES_TIERS.map((y) => [y, y]), v); if (c) t.type = c; else if (c === null) x.avert(`type inconnu « ${v} »`); }, { l: 13 }),
    C('Effectif', ['effectif', 'effectifs', 'salaries', 'nombre de salaries'], (t) => t.effectif || '', (t, v) => { t.effectif = DOLI.effectif[txt(v)] || txt(v); }, { l: 9 }),
    C('Commercial', ['commercial', 'commercial attitre', 'vendeur', 'representant'], (t) => t.commercial || '', setTxt('commercial'), { l: 18 }),
    C('Tags (séparés par des virgules)', ['tags', 'tag', 'categories', 'catégories', 'etiquettes', 'segments'], (t) => (t.tags || []).join(', '), (t, v) => { t.tags = txt(v).split(/\s*[,;|]\s*/).filter(Boolean); }, { l: 20 }),
    C('Statut de prospection', ['statut', 'statut prospection', 'statut de prospection', 'etat prospection', 'statut prospect', 'statut du prospect'], (t) => (D.STATUTS_PROSPECT.find((s) => s[0] === t.statut_prospect) || ['', ''])[1], (t, v, x) => { if (DOLI.statut[txt(v)]) { t.statut_prospect = DOLI.statut[txt(v)]; return; } const c = choix(D.STATUTS_PROSPECT, v); if (c) t.statut_prospect = c; else if (c === null) x.avert(`statut inconnu « ${v} »`); }, { l: 18 }),
    C('Potentiel', ['potentiel', 'potentiel du prospect'], (t) => D.POTENTIELS[t.potentiel || 0] || '', (t, v) => { if (DOLI.potentiel[txt(v)] != null) { t.potentiel = DOLI.potentiel[txt(v)]; return; } const i = D.POTENTIELS.findIndex((p) => p && norm(p) === norm(v)); if (i > 0) t.potentiel = i; else if (Number.isFinite(+v)) t.potentiel = Math.max(0, Math.min(3, +v)); }, { l: 10 }),
    C('Remise client (%)', ['remise', 'remise client', 'remise %', 'escompte'], (t) => t.remise || 0, setNum('remise'), { f: 'n', l: 10 }),
    C('Conditions de règlement', ['conditions de reglement', 'condition de paiement', 'conditions de paiement', 'delai de paiement', 'echeance'], (t) => t.cond || '', (t, v) => { t.cond = DOLI.cond[norm(v)] || txt(v); }, { l: 18 }),
    C('Mode de règlement', ['mode de reglement', 'mode de paiement', 'moyen de paiement', 'reglement'], (t) => t.mode || '', (t, v) => { t.mode = DOLI.mode[norm(v)] || txt(v); }, { l: 14 }),
    C('Encours autorisé (€)', ['encours autorise', 'encours max', 'plafond', 'encours maximum', 'montant encours autorise'], (t) => t.encours_max || 0, setNum('encours_max'), { f: 'n', l: 12 }),
    C('Encours actuel TTC (€)', [], (t, db) => D.encours(db, t.id), null, { f: 'n', l: 12, lecture: true }),
    C('Délai de livraison fournisseur (jours)', ['delai de livraison', 'delai livraison fournisseur'], (t) => t.delai_livraison || '', setNum('delai_livraison'), { f: 'n', l: 12 }),
    C('Franco (€ HT)', ['franco', 'franco de port', 'minimum franco'], (t) => t.franco || '', setNum('franco'), { f: 'n', l: 11 }),
    C('Conditions de règlement fournisseur', ['conditions fournisseur', 'conditions de reglement fournisseur'], (t) => t.cond_fourn || '', setTxt('cond_fourn'), { l: 18 }),
    C('Encours autorisé fournisseur (€)', ['encours fournisseur', 'encours autorise fournisseur'], (t) => t.encours_fourn_max || '', setNum('encours_fourn_max'), { f: 'n', l: 12 }),
    C('Logo (URL)', ['logo', 'url logo', 'image', 'lien logo', 'photo'], (t) => imgExport(t.logo), setImg('logo'), { l: 36 }),
    C('Compte comptable client', ['compte client', 'compte comptable client', 'compte tiers', 'code comptable', 'code comptable client'], (t) => t.compta_client || '', setTxt('compta_client'), { f: 't', l: 13 }),
    C('Compte comptable fournisseur', ['compte fournisseur', 'compte comptable fournisseur', 'code comptable fournisseur'], (t) => t.compta_fourn || '', setTxt('compta_fourn'), { f: 't', l: 13 }),
    C('Note publique', ['note publique', 'note', 'commentaire', 'remarque'], (t) => t.note_pub || '', setTxt('note_pub'), { l: 30 }),
    C('Note privée', ['note privee', 'note interne'], (t) => t.note_priv || '', setTxt('note_priv'), { l: 30 }),
    C('Contact principal', [], (t, db) => { const k = db.contacts.filter((c) => c.tiers === t.id); const c = k.find((y) => y.defaut) || k[0]; return c ? `${c.prenom || ''} ${c.nom || ''}`.trim() : ''; }, null, { l: 20, lecture: true }),
    C('Nombre de contacts', [], (t, db) => db.contacts.filter((c) => c.tiers === t.id).length, null, { f: 'n', l: 9, lecture: true }),
    C('Créé le', [], (t) => jour(t.cree), null, { l: 11, lecture: true }),
    C('Id ancien logiciel', ['id', 'rowid', 'id dolibarr', 'identifiant'], (t) => t.id_ancien || '', setTxt('id_ancien'), { f: 't', l: 10, cleAncien: true }),
    C('Identifiant FMD', ['identifiant fmd', 'id fmd'], (t) => t.id, null, { f: 't', l: 20, id: true }),
  ];
  // Codes de Dolibarr (l'ancien logiciel de FMD, export « Tiers ») → valeurs de FMD.
  const DOLI = {
    type: { TE_GROUP: 'Grand compte', TE_MEDIUM: 'PME/PMI', TE_SMALL: 'TPE', TE_PRIVATE: 'Particulier', TE_ADMIN: 'Administration', TE_STARTUP: 'TPE', TE_RETAIL: 'PME/PMI', TE_WHOLE: 'PME/PMI', TE_OTHER: 'TPE' },
    effectif: { 'EF1-5': '1-5', 'EF6-10': '6-10', 'EF11-50': '11-50', 'EF51-100': '51-100', 'EF100-500': '100+', 'EF500-': '100+' },
    statut: { ST_NEVER: 'jamais', ST_TODO: 'a_contacter', ST_PEND: 'en_cours', ST_DONE: 'fait', ST_NO: 'ne_pas' },
    potentiel: { PL_NONE: 0, PL_LOW: 1, PL_MEDIUM: 2, PL_HIGH: 3 },
    cond: { dueuponreceipt: 'À réception', dueonorder: 'À réception', '30days': '30 jours', '30daysendofmonth': '30 jours fin de mois', '45daysendofmonth': '45 jours fin de mois', '60days': '60 jours', '60daysendofmonth': '60 jours', '45days': '45 jours fin de mois' },
    mode: { credittransfer: 'Virement', creditcard: 'Carte bancaire', directdebit: 'Prélèvement', cheque: 'Chèque', check: 'Chèque', cash: 'Espèces', bankcard: 'Carte bancaire' },
  };
  // Colonnes reconnues à l'import mais pas exportées (fichier « Tiers » de Dolibarr).
  const EXTRA_TIERS = [
    C('Client (code 0 à 3)', ['client', 'est client'], null, (t, v, x) => { const n = parseInt(v, 10); const b = oui(v); x.nature = true;
      if (Number.isFinite(n)) { t.client = n === 1 || n === 3; t.prospect = n === 2; } else if (b != null) { t.client = b; if (b) t.prospect = false; } }),
    C('Prospect (0/1)', ['prospect', 'est prospect'], null, (t, v, x) => { const b = oui(v); if (b == null) return; x.nature = true; t.prospect = b && !t.client; }),
    C('Fournisseur (0/1)', ['fournisseur', 'est fournisseur'], null, (t, v, x) => { const b = oui(v); if (b == null) return; x.nature = true; t.fournisseur = b; }),
    C('État', ['etat', 'statut du tiers', 'actif'], null, (t, v) => { const b = oui(v); if (b != null) t.etat = b ? 'ouvert' : 'ferme'; }),
    C('Date création', ['date creation', 'date de creation', 'cree le'], null, (t, v, x) => { if (!x.neuf || !txt(v)) return; t.cree = typeof v === 'number' ? new Date(Date.UTC(1899, 11, 30) + Math.round(v * 864e5)).toISOString().slice(0, 19) : txt(v).replace(' ', 'T'); }),
    C('Prénom du commercial', ['prenom du commercial'], null, (t, v, x) => { x.comPrenom = txt(v); }),
    C('Nom du commercial', ['nom du commercial'], null, (t, v, x) => { x.comNom = txt(v); }),
  ];
  function tel(v) { if (typeof v === 'number') { const s = String(v); return s.length === 9 ? '0' + s : s; } return txt(v); }

  const COL_CONTACTS = [
    C('Tiers (nom)', ['tiers', 'societe', 'société', 'entreprise', 'client', 'nom du tiers', 'raison sociale'], (k, db) => nomTiers(db, k.tiers), null, { l: 26, tiersNom: true }),
    C('Code du tiers', ['code tiers', 'code client', 'code fournisseur'], (k, db) => { const t = D.tiers(db, k.tiers); return t ? t.code_client || t.code_fourn || '' : ''; }, null, { f: 't', l: 15, tiersCode: true }),
    C('Civilité', ['civilite', 'titre civilite', 'titre'], (k) => k.civilite || '', setTxt('civilite'), { l: 8 }),
    C('Prénom', ['prenom', 'first name', 'firstname'], (k) => k.prenom || '', setTxt('prenom'), { l: 14 }),
    C('Nom', ['nom', 'nom du contact', 'last name', 'lastname'], (k) => k.nom || '', setTxt('nom'), { l: 16 }),
    C('Poste / fonction', ['poste', 'fonction', 'job', 'role'], (k) => k.poste || '', setTxt('poste'), { l: 18 }),
    C('Adresse', ['adresse'], (k) => k.adresse || '', setTxt('adresse'), { l: 28 }),
    C('Code postal', ['code postal', 'cp'], (k) => k.cp || '', (k, v) => { k.cp = typeof v === 'number' ? String(v).padStart(5, '0') : txt(v); }, { f: 't', l: 9 }),
    C('Ville', ['ville'], (k) => k.ville || '', setTxt('ville'), { l: 16 }),
    C('Tél. pro', ['tel pro', 'telephone pro', 'téléphone', 'tel', 'telephone'], (k) => k.tel_pro || '', (k, v) => { k.tel_pro = tel(v); }, { f: 't', l: 14 }),
    C('Tél. perso', ['tel perso', 'telephone perso'], (k) => k.tel_perso || '', (k, v) => { k.tel_perso = tel(v); }, { f: 't', l: 14 }),
    C('Tél. portable', ['portable', 'mobile', 'gsm'], (k) => k.portable || '', (k, v) => { k.portable = tel(v); }, { f: 't', l: 14 }),
    C('E-mail', ['email', 'e-mail', 'mail', 'courriel'], (k) => k.email || '', setTxt('email'), { l: 26 }),
    C('Date de naissance', ['naissance', 'date de naissance', 'anniversaire'], (k) => k.naissance || '', (k, v) => { k.naissance = typeof v === 'number' ? D.iso(new Date(Date.UTC(1899, 11, 30) + v * 864e5)) : txt(v); }, { l: 12 }),
    C('Contact par défaut', ['par defaut', 'contact par defaut', 'principal', 'contact principal'], (k) => ouiNon(k.defaut), setOui('defaut'), { l: 9 }),
    C('Identifiant FMD', ['identifiant fmd', 'id fmd'], (k) => k.id, null, { f: 't', l: 20, id: true }),
  ];

  const COL_PRIX_ACHAT = [
    C('Référence produit', ['reference', 'ref', 'réf', 'reference produit', 'code article', 'sku'], (r) => r.p.ref, null, { f: 't', l: 18, produitRef: true }),
    C('Code-barres EAN13 (GTIN)', ['ean', 'ean13', 'gtin', 'code barre', 'code-barres', 'code barres'], (r) => r.p.code_barres || '', null, { f: 't', l: 16, produitEan: true }),
    C('Libellé', [], (r) => r.p.libelle, null, { l: 34, lecture: true }),
    C('Fournisseur', ['fournisseur', 'nom fournisseur', 'tiers'], (r, db) => nomTiers(db, r.f.tiers), null, { l: 24, tiersNom: true }),
    C('Code fournisseur', ['code fournisseur', 'code tiers'], (r, db) => (D.tiers(db, r.f.tiers) || {}).code_fourn || '', null, { f: 't', l: 15, tiersCode: true }),
    C('Réf. chez le fournisseur', ['ref fournisseur', 'réf fournisseur', 'reference fournisseur', 'ref. produit fournisseur'], (r) => r.f.ref || '', setTxt('ref'), { f: 't', l: 16 }),
    C('Prix d’achat HT', ['prix achat', 'prix d achat', 'pa', 'prix unitaire ht', 'prix', 'pu ht', 'prix fournisseur'], (r) => r.f.pu ?? '', setNum('pu'), { f: 'n', l: 13 }),
    C('Remise (%)', ['remise', 'remise achat'], (r) => r.f.remise || 0, setNum('remise'), { f: 'n', l: 9 }),
    C('Prix net HT', [], (r) => D.arrondi((r.f.pu || 0) * (1 - (r.f.remise || 0) / 100)), null, { f: 'n', l: 11, lecture: true }),
    C('TVA achat (%)', [], (r) => D.tvaAchat(r.p), null, { f: 'n', l: 9, lecture: true }),
    C('Qté minimum', ['qte min', 'quantite minimum', 'conditionnement'], (r) => r.f.qte_min || 1, setNum('qte_min'), { f: 'n', l: 9 }),
    C('Délai (jours)', ['delai', 'délai'], (r) => r.f.delai || '', setNum('delai'), { f: 'n', l: 9 }),
    C('Pratiqué depuis', [], (r) => jour(r.f.depuis), null, { l: 12, lecture: true }),
  ];
  const COL_PRIX_CLIENTS = [
    C('Client', ['client', 'tiers', 'nom', 'nom du client'], (x, db) => nomTiers(db, x.tiers), null, { l: 26, tiersNom: true }),
    C('Code client', ['code client', 'code tiers'], (x, db) => (D.tiers(db, x.tiers) || {}).code_client || '', null, { f: 't', l: 15, tiersCode: true }),
    C('Référence produit', ['reference', 'ref', 'réf', 'reference produit', 'code article'], (x, db) => (D.produit(db, x.produit) || {}).ref || '', null, { f: 't', l: 18, produitRef: true }),
    C('Libellé', [], (x, db) => (D.produit(db, x.produit) || {}).libelle || '', null, { l: 34, lecture: true }),
    C('Prix négocié HT', ['prix', 'prix negocie', 'prix client', 'prix ht', 'pu ht', 'prix special'], (x) => x.pu, setNum('pu'), { f: 'n', l: 13 }),
    C('Depuis', [], (x) => jour(x.depuis), null, { l: 12, lecture: true }),
  ];

  // Listes : clé, nom de l'onglet, colonnes, lignes exportées, mots qui la reconnaissent dans un nom d'onglet / de fichier.
  const LISTES = [
    { k: 'produits', nom: 'Produits', cols: COL_PRODUITS, lignes: (db) => [...db.produits].sort((a, b) => String(a.ref).localeCompare(String(b.ref))), mots: /produit|article|catalogue|stock|item|product/ },
    { k: 'prixAchat', nom: 'Prix d’achat', cols: COL_PRIX_ACHAT, lignes: (db) => db.produits.flatMap((p) => (p.fournisseurs || []).map((f) => ({ p, f }))), mots: /prix.?d.?achat|achat|tarif.?fourn/ },
    { k: 'clients', nom: 'Clients', cols: COL_TIERS, extra: EXTRA_TIERS, lignes: (db) => db.tiers.filter((t) => t.client || t.prospect).sort((a, b) => a.nom.localeCompare(b.nom)), mots: /client|prospect|customer/ },
    { k: 'fournisseurs', nom: 'Fournisseurs', cols: COL_TIERS, extra: EXTRA_TIERS, lignes: (db) => db.tiers.filter((t) => t.fournisseur).sort((a, b) => a.nom.localeCompare(b.nom)), mots: /fournisseur|supplier|vendor/ },
    { k: 'contacts', nom: 'Contacts', cols: COL_CONTACTS, lignes: (db) => db.contacts.slice().sort((a, b) => `${a.nom}`.localeCompare(`${b.nom}`)), mots: /contact|adresse|interlocut/ },
    { k: 'prixClients', nom: 'Prix clients', cols: COL_PRIX_CLIENTS, lignes: (db) => db.prixClients.slice(), mots: /prix.?client|negoci|tarif.?client/ },
  ];
  const liste_ = (k) => LISTES.find((l) => l.k === k);
  const colsImp = (L) => [...L.cols, ...(L.extra || [])];
  const ORDRE = ['fournisseurs', 'clients', 'contacts', 'produits', 'prixAchat', 'prixClients']; // ordre d'import (dépendances)

  function modeEmploi() {
    const L = (s, titre) => Object.assign([s], { titre });
    return { nom: 'Mode d’emploi', libre: true, cols: [{ t: '', l: 130 }], lignes: [
      L('FMD — Import / Export des produits, clients et fournisseurs', true), [`Exporté le ${new Date().toLocaleString('fr-FR')}`], [''],
      ['Ce fichier peut être modifié dans Excel puis réimporté dans FMD (CRM → Outils → Import / Export) : les fiches existantes sont mises à jour, les nouvelles lignes créent de nouvelles fiches.'],
      ['Rien n’est jamais supprimé par un import. Une case vide ne change rien : pour effacer une information, faites-le dans FMD.'],
      ['Les colonnes « Identifiant FMD » permettent de retrouver chaque fiche à coup sûr : ne les modifiez pas. Pour une nouvelle fiche, laissez-la vide.'],
      ['Sans identifiant, un produit est retrouvé par sa référence (sinon son code-barres) ; un client ou fournisseur par son code, son SIRET, puis son nom.'],
      ['Les colonnes calculées (Prix de revient, Stock virtuel, Encours actuel, Créé le…) sont ignorées à l’import.'],
      ['Stock physique modifié = mouvement de stock « Import (inventaire) » enregistré dans FMD (historique gardé).'],
      ['Images : mettez un lien internet (https://…). Les images ajoutées depuis le PC restent dans FMD et apparaissent ici comme « (image enregistrée dans FMD) ».'],
      ['Un fichier venant d’un autre logiciel (Dolibarr, tableur…) est accepté : FMD reconnaît les titres de colonnes courants (Réf., Désignation, EAN, Prix HT, Raison sociale, SIRET, Téléphone…).'],
      [''], L('Valeurs acceptées', true),
      ['Catégorie (magasin) : ' + D.CATEGORIES.map((c) => c[1]).join(' · ')],
      ['Rayon du site web : Automatique · ' + D.RAYONS_SITE.map((c) => c[1]).join(' · ')],
      ['Type de tiers : ' + D.TYPES_TIERS.join(' · ')],
      ['Statut de prospection : ' + D.STATUTS_PROSPECT.map((s) => s[1]).join(' · ')],
      ['Conditions de règlement : ' + D.CONDITIONS.join(' · ') + '   —   Mode de règlement : ' + D.MODES.join(' · ')],
      ['Oui / Non : En vente, En achat, Sur le site web, Assujetti à la TVA, Refuse les e-mails de masse, Contact par défaut.'],
      ['Prix : en euros HT, virgule ou point (12,50). Si seule la colonne « Prix de vente TTC » est remplie, le prix HT est calculé avec la TVA.'],
    ] };
  }
  const feuilleDe = (db, L) => ({ nom: L.nom, cols: L.cols, lignes: L.lignes(db).map((o) => L.cols.map((c) => { try { const v = c.g(o, db); return v == null ? '' : v; } catch { return ''; } })) });

  // =====================================================================================================
  // IMPORT
  // Tableau lu → { liste devinée, entêtes, colonnes reconnues, lignes (objets { colonne → valeur }) }
  // =====================================================================================================
  // FORMAT « GRILLE TARIFAIRE » FMD (20 nov. 2026) : le fichier catalogue de FMD (Google Sheets, onglet Grille Tarifaire),
  // 1 ligne = 1 produit, colonnes A–Q d'origine + R–AQ ajoutées (nom commercial, EAN, dimensions, catégories, tags…).
  // Reconnu tout seul (A « Produit », C « Marque », E « Prix net »). Clé : Référence (B), puis EAN (U). Contrôles : nom
  // < 140 caractères, résumé ≤ 300, EAN13 valide (clé de contrôle), doublons de référence / d'EAN dans le fichier.
  // Catégories du site (Univers > Catégorie > Sous-catégorie) et tags créés tout seuls (db.categoriesSite).
  // Export dans exactement le même format (bouton « Catalogue au format Grille Tarifaire »).
  // Prix : E « Prix net » = prix de vente public HT (niveau 1) ; F, G, H (−10 / −20 / −30 %) = niveaux Artisan, Entreprise,
  // Grand compte ; D « Prix achat » = prix d'achat chez le fournisseur de la marque. Colonnes I à Q gardées telles quelles.
  const GRILLE = ['Produit', 'Référence', 'Marque', 'Prix achat', 'Prix net', 'Remise 10 %', 'Remise 20 %', 'Remise 30 %', 'Remise 40 %', 'Remise 50 %', 'PC', 'PA', 'Boitage', 'Tarification', 'Prix TTC', 'Achat E', 'PA L',
    'Nom commercial', 'Gamme / Modèle', 'Type de code-barres', 'Valeur du code-barres', 'Poids (kg)', 'Longueur (mm)', 'Largeur (mm)', 'Hauteur (mm)', 'Diamètre (mm)', 'Surface (m²)', 'Volume / Contenance',
    "Pays d'origine", 'Couleur', 'Conditionnement', 'Quantité par conditionnement', 'Catégorie', 'Sous-catégorie', 'Tags', 'Métier associé', 'Résumé commercial', 'Description', 'URL image principale',
    'URL images secondaires', 'Source(s)', 'Statut', 'Commentaire'];
  const estGrille = (tete) => norm(tete[0]) === 'produit' && norm(tete[2]) === 'marque' && /prixnet/.test(norm(tete[4]));
  // Catalogue dans la table crm_produits (js/erp-produits.js) : jusqu'à 500 000 produits. Sinon (fichier du CRM) : 5 000.
  const limiteProduits = () => (D.produitsEnTable && D.produitsEnTable() ? 500000 : 5000);
  const ean13Valide = (s) => { if (!/^\d{13}$/.test(s)) return false; const d = [...s].map(Number); const t = d.slice(0, 12).reduce((a, x, i) => a + x * (i % 2 ? 3 : 1), 0); return (10 - (t % 10)) % 10 === d[12]; };
  // univers du site → catégorie magasin du CRM et rayon du site existants
  // Anciens univers de la grille → rayons de l'arborescence V2 (js/erp-arbo.js, 21 nov. 2026)
  const UNIVERS_CRM = { 'Fixation & visserie': ['visserie', 'visserie'], 'Outillage à main': ['outillage', 'outillage'], 'Électroportatif & accessoires': ['electroportatif', 'electroportatif'],
    'Outillage automobile & atelier': ['automobile', 'automobile'], 'Chimie & mastics': ['collage', 'collage'], 'Électricité & climatisation': ['electricite', 'electricite'], 'Peinture & préparation': ['masquage', 'masquage'],
    'Protection & EPI': ['vetements', 'vetements'], 'Plomberie & sanitaire': ['plomberie', 'plomberie'], 'Nettoyage & entretien': ['atelier', 'atelier'], 'Rangement & manutention': ['atelier', 'atelier'],
    'Couverture & toiture': ['construction', 'construction'] };
  const nbr = (v) => { const n = num(v); return Number.isFinite(n) ? n : undefined; };
  function ligneGrille(db, p) { // export : une fiche produit → une ligne A–AQ
    const g = p.grille || {}; const f = (p.fournisseurs || []).find((x) => norm((D.tiers(db, x.tiers) || {}).nom) === norm(p.marque)) || meilleur(p) || {};
    const pn = (p.prix || [])[0]; const rem = (k, x) => (g[k] != null ? g[k] : pn ? D.arrondi(pn * (1 - x)) : '');
    return [p.libelle_fournisseur || p.libelle, p.ref, p.marque, f.pu ?? '', pn ?? '', (p.prix || [])[1] ?? rem('r10', 0.1), (p.prix || [])[2] ?? rem('r20', 0.2), (p.prix || [])[3] ?? rem('r30', 0.3), rem('r40', 0.4), rem('r50', 0.5),
      g.pc ?? '', g.pa ?? '', g.boitage ?? (p.qte_cond || ''), g.tarification ?? '', pn ? D.arrondi(pn * (1 + (p.tva ?? 20) / 100)) : '', g.achat_e ?? '', g.pa_l ?? '',
      p.libelle, p.gamme || '', p.code_barres ? 'EAN13' : '', p.code_barres || '', p.poids || '', p.longueur || '', p.largeur || '', p.hauteur || '', p.diametre || '', p.surface || '', p.contenance || '',
      p.origine || '', p.couleur || '', p.conditionnement || '', p.qte_cond || '', p.cat_site || '', p.souscat_site || '', (p.tags_site || []).join(', '), p.metier || '', p.resume || '', p.description || '',
      imgExport(p.image), (p.galerie || []).map(imgExport).filter((s) => s !== IMG_FMD).join(', '), p.sources || '', p.statut_fiche || '', p.commentaire_fiche || ''];
  }
  const feuilleGrille = (db) => ({ nom: 'Grille Tarifaire', cols: GRILLE.map((t, i) => ({ t, f: [1, 20].includes(i) ? 't' : [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 21, 22, 23, 24, 25, 26, 31].includes(i) ? 'n' : '', l: [0, 17, 36, 37].includes(i) ? 50 : 16 })),
    lignes: [...db.produits].sort((a, b) => String(a.marque).localeCompare(String(b.marque)) || String(a.ref).localeCompare(String(b.ref))).map((p) => ligneGrille(db, p)) });
  const marquesGrille = (a) => { const c = {}; a.lignes.forEach((l) => { const m = txt(l[2]) || '(sans marque)'; c[m] = (c[m] || 0) + 1; }); return Object.entries(c).sort((x, y) => y[1] - x[1]); };

  function analyser(t) {
    const brut = t.lignes.filter((l) => l && l.some((v) => txt(v) !== ''));
    if (!brut.length) return null;
    // ligne de titres : la première qui reconnaît le plus de colonnes parmi les 5 premières
    let iTete = 0; let meilleurScore = -1; let scores = {};
    brut.slice(0, 5).forEach((l, i) => { const sc = {}; LISTES.forEach((L) => { sc[L.k] = l.filter((h) => trouverCol(colsImp(L), h)).length; }); const m = Math.max(...Object.values(sc)); if (m > meilleurScore) { meilleurScore = m; iTete = i; scores = sc; } });
    const tete = brut[iTete].map((h) => txt(h));
    // les titres des colonnes décident ; le nom de l'onglet (ou du fichier) départage les listes proches (clients / fournisseurs,
    // produits / prix d'achat) : il gagne seulement si ses colonnes sont presque aussi bien reconnues.
    const parNom = ['prixAchat', 'prixClients', 'contacts', 'fournisseurs', 'clients', 'produits'].filter((k) => liste_(k).mots.test(norm(t.nom)));
    const ordre = ['produits', 'clients', 'fournisseurs', 'contacts', 'prixAchat', 'prixClients'];
    let k = meilleurScore >= 2 ? ordre.reduce((m, x) => (scores[x] > scores[m] ? x : m), ordre[0]) : null;
    const kNom = parNom.find((x) => scores[x] >= 2 && scores[x] >= meilleurScore * 0.7);
    if (kNom) k = kNom;
    if (/modedemploi|doublonssupprimes|averifier|categoriestags|lisezmoi/.test(norm(t.nom))) k = 'ignorer'; // onglets annexes (mode d'emploi, fichier catalogue enrichi)
    if (estGrille(tete)) k = 'grille'; // catalogue FMD (Grille Tarifaire, colonnes A–AQ)
    return { nom: t.nom, k: k || 'ignorer', tete, lignes: brut.slice(iTete + 1), score: meilleurScore };
  }
  function trouverCol(cols, h) {
    const n = norm(h); if (!n) return null;
    return cols.find((c) => norm(c.t) === n) || cols.find((c) => (c.al || []).some((a) => norm(a) === n)) || null;
  }
  const lignesObjets = (a, L) => { const map = a.tete.map((h) => trouverCol(colsImp(L), h)); return { map, objs: a.lignes.map((l, i) => ({ n: i + 2, v: map.map((c, j) => [c, l[j]]).filter(([c, x]) => c && txt(x) !== '') })) }; };

  // Applique les tableaux à la base db (une copie pour l'aperçu, la vraie ensuite). Renvoie le bilan.
  function importer(db, analyses, opt) {
    const bilan = {}; const journal = [];
    const B = (k) => (bilan[k] = bilan[k] || { nouveaux: 0, maj: 0, inchanges: 0, ignores: 0, erreurs: [], avert: [] });
    // Index des tiers et des produits : construits UNE fois, puis complétés fiche par fiche (20 nov. 2026 : les reconstruire à
    // chaque ligne prenait des heures avec le catalogue de 100 000 produits et bloquait FMD).
    const ajTiers = (m, t) => { m.id[t.id] = t; if (t.id_ancien) m.anc[norm(t.id_ancien)] = t; if (t.code_client) m.cc[norm(t.code_client)] = t; if (t.code_fourn) m.cf[norm(t.code_fourn)] = t; if (chiffres(t.siret).length === 14) m.siret[chiffres(t.siret)] = t; m.nom[norm(t.nom)] = m.nom[norm(t.nom)] || t; };
    const idxTiers = () => { const m = { id: {}, cc: {}, cf: {}, siret: {}, nom: {}, anc: {} }; db.tiers.forEach((t) => ajTiers(m, t)); return m; };
    let IT = idxTiers();
    const ajProd = (m, p) => { m.id[p.id] = p; if (p.ref) m.ref[norm(p.ref)] = p; if (p.code_barres) m.ean[chiffres(p.code_barres)] = p; };
    const idxProd = () => { const m = { id: {}, ref: {}, ean: {} }; db.produits.forEach((p) => ajProd(m, p)); return m; };
    let IP = idxProd();
    const tiersPar = (nomT, code) => (code && (IT.cc[norm(code)] || IT.cf[norm(code)])) || (nomT && IT.nom[norm(nomT)]) || null;
    const produitPar = (ref, ean) => (ref && IP.ref[norm(ref)]) || (ean && chiffres(ean) && IP.ean[chiffres(ean)]) || null;
    const codes = (t) => { const nn = t.nom.normalize('NFD').replace(/[^A-Za-z]/g, '').slice(0, 5).toUpperCase();
      if ((t.client || t.prospect) && !t.code_client) { t.code_client = D.prochaineRef(db, 'cu'); t.compta_client = t.compta_client || '411' + nn; }
      if (t.fournisseur && !t.code_fourn) { t.code_fourn = D.prochaineRef(db, 'su'); t.compta_fourn = t.compta_fourn || '401' + nn; } };
    const nouveauTiers = (nom) => ({ id: D.id('t'), nom, alt: '', prospect: false, client: false, fournisseur: false, adresse: '', cp: '', ville: '', pays: 'France', tel: '', portable: '', fax: '', web: '', email: '', pas_mail: false,
      siren: '', siret: '', naf: '', rcs: '', tva_num: '', assujetti: true, type: 'TPE', effectif: '', commercial: D.MOI, statut_prospect: 'jamais', potentiel: 0, niveau: 1, remise: 0, cond: '30 jours', mode: 'Virement', encours_max: 0, tags: [],
      contacts: [], comptes: [], note_pub: '', note_priv: '', etat: 'ouvert', cree: D.maintenant(), code_client: '', code_fourn: '', compta_client: '', compta_fourn: '', logo: '' });
    // fournisseur d'un prix d'achat : retrouvé, sinon créé (nature Fournisseur)
    const fournisseurNomme = (nomF, code, b) => { let t = tiersPar(nomF, code); if (!t && !nomF) return null;
      if (!t) { t = nouveauTiers(nomF); t.fournisseur = true; codes(t); db.tiers.push(t); ajTiers(IT, t); b.avert.push(`Fournisseur « ${nomF} » créé`); journal.push(`Fournisseur ${nomF} créé (import)`); bilanTiersCree++; }
      else if (!t.fournisseur) { t.fournisseur = true; codes(t); D.toucher(t); }
      return t; };
    let bilanTiersCree = 0;
    const sig = (k, o) => JSON.stringify(liste_(k).cols.filter((c) => c.s && !c.lecture).map((c) => { try { const v = c.g(o, db); return v == null ? '' : String(v); } catch { return ''; } }));
    const appliquer = (o, champs, x) => champs.forEach(([c, v]) => { if (c.s && !c.lecture) { try { c.s(o, v, x); } catch (e) { x.avert(`${c.t} : ${e.message}`); } } });

    const parListe = {}; analyses.forEach((a) => { if (a.k && a.k !== 'ignorer') (parListe[a.k] = parListe[a.k] || []).push(a); });
    // ---------- format Grille Tarifaire FMD (colonnes A–AQ, par position) ----------
    (parListe.grille || []).forEach((a) => {
      const b = B('grille'); const vusRef = new Set(); const vusEan = new Set();
      db.categoriesSite = db.categoriesSite || [];
      const lignes = a.lignes.map((l, i) => ({ n: i + 2, l })).filter(({ l }) => !opt.marqueGrille || (txt(l[2]) || '(sans marque)') === opt.marqueGrille);
      let nouveauxPrevus = lignes.filter(({ l }) => txt(l[1]) && !IP.ref[norm(txt(l[1]))]).length;
      if (opt.creer && db.produits.length + nouveauxPrevus > limiteProduits()) {
        b.erreurs.push(`Trop de produits pour l’enregistrement actuel : ${db.produits.length} déjà + ${nouveauxPrevus} nouveaux > ${limiteProduits()}. Importez une marque à la fois (choix ci-dessus)${limiteProduits() < 500000 ? ' ; le catalogue complet demande la base de données des produits (en place à la première connexion après la mise à jour du serveur)' : ''}.`);
        b.bloque = true; return; }
      lignes.forEach(({ n, l }) => {
        const avertL = (m) => { if (b.avert.length < 300) b.avert.push(`Ligne ${n} : ${m}`); };
        const ref = typeof l[1] === 'number' ? String(l[1]) : txt(l[1]); const nom = txt(l[17]) || txt(l[0]);
        let ean = typeof l[20] === 'number' ? String(Math.round(l[20])) : txt(l[20]).replace(/\s/g, ''); const resume = txt(l[36]);
        // contrôles
        if (!ref) { b.erreurs.push(`Ligne ${n} : référence vide`); return; }
        if (vusRef.has(norm(ref))) { b.erreurs.push(`Ligne ${n} : référence ${ref} en double dans le fichier`); return; }
        if (nom.length >= 140) { b.erreurs.push(`Ligne ${n} (${ref}) : nom commercial de ${nom.length} caractères (moins de 140 demandés)`); return; }
        if (resume.length > 300) { b.erreurs.push(`Ligne ${n} (${ref}) : résumé de ${resume.length} caractères (300 au plus)`); return; }
        if (ean && !ean13Valide(ean)) { b.erreurs.push(`Ligne ${n} (${ref}) : EAN13 ${ean} invalide (clé de contrôle)`); return; }
        if (ean && vusEan.has(ean)) { b.erreurs.push(`Ligne ${n} (${ref}) : EAN ${ean} déjà utilisé plus haut dans le fichier`); return; }
        vusRef.add(norm(ref)); if (ean) vusEan.add(ean);
        let p = IP.ref[norm(ref)] || (ean && IP.ean[ean]) || null; const neuf = !p;
        if (neuf && !opt.creer) { b.ignores++; return; } if (!neuf && !opt.maj) { b.ignores++; return; }
        const avant = neuf ? '' : JSON.stringify(ligneGrille(db, p));
        if (neuf) p = { id: D.id('p'), ref, libelle: '', marque: '', categorie: 'outillage', code_barres: '', en_vente: true, en_achat: true, description: '', url: '', image: '', galerie: [], certifs: [], web_publie: true, web_rayon: '',
          entrepot: 'Showroom', poids: 0, alerte: 0, optimal: 0, prix: [0, 0, 0, 0], prix_min: 0, pmp: 0, tva: 20, tva_achat: 20, stock: 0, note: '', cpt_vente: '', cpt_achat: '', fournisseurs: [], historique: [], cree: D.maintenant() };
        const mettre = (k, v) => { if (v !== undefined && v !== '' && v !== null) p[k] = v; };
        mettre('libelle', nom); mettre('libelle_fournisseur', txt(l[0])); mettre('marque', txt(l[2])); mettre('gamme', txt(l[18])); if (ean) p.code_barres = ean;
        mettre('poids', nbr(l[21])); mettre('longueur', nbr(l[22])); mettre('largeur', nbr(l[23])); mettre('hauteur', nbr(l[24])); mettre('diametre', nbr(l[25])); mettre('surface', nbr(l[26])); mettre('contenance', txt(l[27]));
        mettre('origine', txt(l[28])); mettre('couleur', txt(l[29])); mettre('conditionnement', txt(l[30])); mettre('qte_cond', nbr(l[31]));
        mettre('metier', txt(l[35])); mettre('resume', resume); mettre('description', txt(l[37])); mettre('sources', txt(l[40])); mettre('statut_fiche', txt(l[41])); mettre('commentaire_fiche', txt(l[42]));
        const tags = txt(l[34]).split(/\s*,\s*/).filter(Boolean); if (tags.length) p.tags_site = tags;
        const img = imgImport(l[38]); if (img) p.image = img; else if (txt(l[38]) && txt(l[38]) !== IMG_FMD) avertL(`image ignorée (pas un lien http) : ${txt(l[38]).slice(0, 40)}`);
        const gal = liste(String(l[39] || '').replace(/,\s*(?=https?:)/g, '|')).map(imgImport).filter(Boolean); if (gal.length) p.galerie = gal;
        // catégories du site : « Univers > Catégorie » + sous-catégorie, créées si absentes ; catégorie magasin et rayon du site déduits
        const cat = txt(l[32]); const sous = txt(l[33]);
        if (cat) { const [u, c] = cat.split(/\s*>\s*/); p.cat_site = cat; p.univers = u; p.souscat_site = sous;
          if (!db.categoriesSite.some((x) => x.univers === u && x.categorie === (c || '') && x.souscat === sous)) { db.categoriesSite.push({ id: D.id('cs'), univers: u, categorie: c || '', souscat: sous }); journal.push(`Catégorie du site créée : ${[u, c, sous].filter(Boolean).join(' > ')}`); }
          const m = UNIVERS_CRM[u]; if (m) { p.categorie = m[0]; if (!p.web_rayon) p.web_rayon = m[1]; } }
        // prix de vente (E, F, G, H) et prix d'achat (D, chez le fournisseur de la marque)
        const pv = [nbr(l[4]), nbr(l[5]), nbr(l[6]), nbr(l[7])];
        pv.forEach((pu, i) => { if (pu == null || !(pu > 0)) return; pu = D.arrondi(pu); if (pu !== p.prix[i]) { p.prix[i] = pu; (p.historique = p.historique || []).push({ d: D.maintenant(), niveau: i + 1, pu, par: D.MOI + ' (import)' }); } });
        if (neuf && pv[0] > 0) [1, 2, 3].forEach((i) => { if (!(p.prix[i] > 0)) p.prix[i] = p.prix[i - 1]; }); // niveau absent = celui du dessus (jamais plus cher)
        const pa = nbr(l[3]);
        if (pa > 0 && p.marque) { const t = fournisseurNomme(p.marque, '', b); if (t) { const fs = (p.fournisseurs = p.fournisseurs || []); let f = fs.find((x) => x.tiers === t.id);
          if (!f) { f = { tiers: t.id, ref, qte_min: 1, pu: 0, remise: 0, delai: 0, depuis: D.auj() }; fs.push(f); } if (f.pu !== pa) { f.pu = pa; f.depuis = D.auj(); } } }
        // colonnes I à Q gardées telles quelles (export identique)
        p.grille = { r40: nbr(l[8]) ?? null, r50: nbr(l[9]) ?? null, pc: l[10] ?? null, pa: l[11] ?? null, boitage: l[12] ?? null, tarification: l[13] ?? null, achat_e: l[15] ?? null, pa_l: l[16] ?? null };
        if (neuf && !D.aFournisseur(p)) { b.erreurs.push(`Ligne ${n} : ${ref} non créé — fournisseur (marque = un fournisseur des Tiers) et prix d’achat obligatoires`); return; }
        if (neuf) { D.toucher(p); db.produits.push(p); ajProd(IP, p); b.nouveaux++; }
        else if (JSON.stringify(ligneGrille(db, p)) !== avant) { D.toucher(p); b.maj++; ajProd(IP, p); } else b.inchanges++;
      });
    });

    // Codes clients / fournisseurs du fichier (ex. Dolibarr CU2611-00186) : compteurs FMD relevés AVANT l'import, sinon un
    // code créé pour une ligne sans code pourrait être celui d'une ligne plus bas (les deux fiches seraient fusionnées).
    db.compteurs = db.compteurs || {};
    ['clients', 'fournisseurs'].forEach((k) => (parListe[k] || []).forEach((a) => { const { objs } = lignesObjets(a, liste_(k));
      objs.forEach(({ v }) => v.forEach(([c, x]) => { const cpt = c.cleClient ? 'cu' : c.cleFourn ? 'su' : null; const code = txt(x); const m = /^(CU|SU)\d*-?(\d+)$/i.exec(code);
        if (cpt && m && m[1].toLowerCase() === cpt) db.compteurs[cpt] = Math.max(db.compteurs[cpt] || 0, +m[2]); })); }));
    ORDRE.forEach((k) => (parListe[k] || []).forEach((a) => {
      const L = liste_(k); const b = B(k); const { objs } = lignesObjets(a, L);
      objs.forEach(({ n, v }) => {
        const val = (pred) => { const e = v.find(([c]) => pred(c)); return e ? e[1] : undefined; };
        const avertL = (m) => { if (b.avert.length < 200) b.avert.push(`Ligne ${n} : ${m}`); };
        try {
          if (k === 'clients' || k === 'fournisseurs') {
            const id = txt(val((c) => c.id)); const cc = txt(val((c) => c.cleClient)); const cf = txt(val((c) => c.cleFourn)); const nom = txt(val((c) => c.nom));
            const siret = chiffres(val((c) => c.t === 'SIRET'));
            const anc = txt(val((c) => c.cleAncien));
            const parNom = nom && IT.nom[norm(nom)];
            // même nom mais autre SIRET / autre code : une autre entreprise ou une autre agence (ex. SMAC Angers, Rennes, Nantes)
            const autre = parNom && ((siret.length === 14 && chiffres(parNom.siret).length === 14 && chiffres(parNom.siret) !== siret) || (cc && parNom.code_client && norm(parNom.code_client) !== norm(cc)) || (cf && parNom.code_fourn && norm(parNom.code_fourn) !== norm(cf)));
            let t = (id && IT.id[id]) || (cc && IT.cc[norm(cc)]) || (cf && IT.cf[norm(cf)]) || (siret.length === 14 && IT.siret[siret]) || (anc && IT.anc[norm(anc)]) || (!autre && parNom) || null;
            if (!t && !nom) { b.erreurs.push(`Ligne ${n} : nom manquant`); return; }
            const neuf = !t; if (neuf && !opt.creer) { b.ignores++; return; } if (!neuf && !opt.maj) { b.ignores++; return; }
            const avant = neuf ? '' : sig(k, t) + NATURE(t);
            if (neuf) { t = nouveauTiers(nom); if (k === 'clients') t.client = true; else t.fournisseur = true; }
            const x = { db, avert: avertL, neuf };
            appliquer(t, v, x);
            if (x.comPrenom || x.comNom) t.commercial = [x.comPrenom, x.comNom].filter(Boolean).join(' ');
            // nature : celle du fichier si elle y est ; sinon d'après l'onglet (Clients / Fournisseurs)
            if (!t.client && !t.prospect && !t.fournisseur) { if (x.nature) t.prospect = true; else if (k === 'clients') t.client = true; else t.fournisseur = true; } // ni client ni fournisseur dans l'autre logiciel → prospect
            if (!x.nature && k === 'fournisseurs' && !neuf && !t.fournisseur) t.fournisseur = true;
            if (!x.nature && k === 'clients' && !neuf && !t.client && !t.prospect) t.client = true;
            // code venant d'un autre logiciel (ex. Dolibarr) : gardé s'il est libre, et le compteur FMD passe au-dessus
            const garder = (code, champ, cpt) => { if (!neuf || !code || IT.cc[norm(code)] || IT.cf[norm(code)]) return; t[champ] = code; const m = /(\d+)$/.exec(code);
              if (m && new RegExp('^' + cpt, 'i').test(code)) db.compteurs[cpt] = Math.max(db.compteurs[cpt] || 0, +m[1]); };
            db.compteurs = db.compteurs || {}; garder(cc, 'code_client', 'cu'); garder(cf, 'code_fourn', 'su');
            codes(t);
            if (neuf) { db.tiers.push(t); b.nouveaux++; ajTiers(IT, t); journal.push(`Tiers ${t.nom} créé (import)`); }
            else if (sig(k, t) + NATURE(t) !== avant) { D.toucher(t); b.maj++; ajTiers(IT, t); } else b.inchanges++;
            if (neuf) D.toucher(t);
          } else if (k === 'contacts') {
            const id = txt(val((c) => c.id)); const t = tiersPar(txt(val((c) => c.tiersNom)), txt(val((c) => c.tiersCode)));
            const nomK = txt(val((c) => c.t === 'Nom')); const pren = txt(val((c) => c.t === 'Prénom')); const mail = norm(val((c) => c.t === 'E-mail'));
            if (!nomK && !pren && !mail) { b.erreurs.push(`Ligne ${n} : contact sans nom ni e-mail`); return; }
            if (!t && txt(val((c) => c.tiersNom))) avertL(`tiers « ${txt(val((c) => c.tiersNom))} » introuvable : contact enregistré sans tiers`);
            let k0 = (id && db.contacts.find((x) => x.id === id)) || db.contacts.find((x) => (x.tiers || null) === (t ? t.id : null) && ((mail && norm(x.email) === mail) || (nomK && norm(x.nom) === norm(nomK) && norm(x.prenom) === norm(pren)))) || null;
            const neuf = !k0; if (neuf && !opt.creer) { b.ignores++; return; } if (!neuf && !opt.maj) { b.ignores++; return; }
            const avant = neuf ? '' : sig(k, k0) + k0.tiers;
            if (neuf) k0 = { id: D.id('k'), cree: D.maintenant(), nom: '', prenom: '', tiers: t ? t.id : '', civilite: '', poste: '', adresse: '', cp: '', ville: '', tel_pro: '', tel_perso: '', portable: '', email: '', naissance: '', defaut: false };
            else if (t) k0.tiers = t.id;
            appliquer(k0, v, { db, avert: avertL });
            if (neuf) { D.toucher(k0); db.contacts.push(k0); b.nouveaux++; } else if (sig(k, k0) + k0.tiers !== avant) { D.toucher(k0); b.maj++; } else b.inchanges++;
          } else if (k === 'produits') {
            const id = txt(val((c) => c.id)); const ref0 = val((c) => c.cle); const ean0 = val((c) => c.t.startsWith('Code-barres'));
            const ref = txt(ref0); const ean = typeof ean0 === 'number' ? String(Math.round(ean0)) : txt(ean0);
            let p = (id && IP.id[id]) || produitPar(ref, ean);
            const libelle = txt(val((c) => c.t === 'Libellé'));
            if (!p && !ref && !ean) { b.erreurs.push(`Ligne ${n} : référence manquante${libelle ? ` (${libelle})` : ''}`); return; }
            const neuf = !p; if (neuf && !opt.creer) { b.ignores++; return; } if (!neuf && !opt.maj) { b.ignores++; return; }
            const avant = neuf ? '' : sig(k, p) + JSON.stringify(p.fournisseurs || []);
            if (neuf) p = { id: D.id('p'), ref: ref || ean, libelle: '', marque: '', categorie: 'outillage', code_barres: '', en_vente: true, en_achat: true, description: '', url: '', image: '', galerie: [], certifs: [], web_publie: true, web_rayon: '',
              entrepot: 'Showroom', poids: 0, alerte: 0, optimal: 0, prix: [0, 0, 0, 0], prix_min: 0, pmp: 0, tva: 20, tva_achat: 20, stock: 0, note: '', cpt_vente: '', cpt_achat: '', fournisseurs: [], historique: [], cree: D.maintenant() };
            const x = { db, avert: avertL, prix: [], achat: {}, stock: undefined, ttc: undefined };
            appliquer(p, v, x);
            if (!p.ref) p.ref = ref || ean;
            if (neuf && !p.libelle) p.libelle = p.ref;
            // prix de vente : HT, sinon calculé depuis le TTC ; nouveau produit avec un seul prix → même prix à tous les niveaux
            if (x.prix[0] == null && x.ttc != null) x.prix[0] = D.arrondi(x.ttc / (1 + (p.tva ?? 20) / 100));
            p.prix = p.prix && p.prix.length ? p.prix : [0, 0, 0, 0];
            D.NIVEAUX.forEach((_, i) => { let pu = x.prix[i]; if (pu == null && neuf && x.prix[0] != null) pu = x.prix[0]; if (pu == null) return; pu = D.arrondi(pu);
              if (pu !== p.prix[i]) { p.prix[i] = pu; (p.historique = p.historique || []).push({ d: D.maintenant(), niveau: i + 1, pu, par: D.MOI + ' (import)' }); } });
            // prix d'achat de la ligne : chez le fournisseur nommé (sinon le « Fournisseur / marque »), sinon PMP
            const a = x.achat;
            if (a.pu != null || a.ref || a.fourn) {
              const nomF = a.fourn || (a.pu != null ? p.marque : '');
              const t = nomF ? fournisseurNomme(nomF, '', b) : null;
              if (t) { const fs = (p.fournisseurs = p.fournisseurs || []); let f = fs.find((y) => y.tiers === t.id);
                if (!f) { f = { tiers: t.id, ref: '', qte_min: 1, pu: 0, remise: 0, delai: 0, depuis: D.auj() }; fs.push(f); }
                if (a.ref) f.ref = a.ref; if (a.pu != null) { if (f.pu !== a.pu) f.depuis = D.auj(); f.pu = a.pu; } if (a.remise != null) f.remise = a.remise; if (a.qte_min != null) f.qte_min = a.qte_min; if (a.delai != null) f.delai = a.delai; }
              else if (a.pu != null && !(+p.pmp > 0)) p.pmp = a.pu;
            }
            if (neuf && !D.aFournisseur(p)) { b.erreurs.push(`Ligne ${n} : ${p.ref} non créé — colonnes « Fournisseur du prix d’achat » et « Prix d’achat HT » obligatoires pour une nouvelle référence`); return; }
            if (neuf) { D.toucher(p); db.produits.push(p); ajProd(IP, p); b.nouveaux++; journal.push(`Produit ${p.ref} créé (import)`); }
            const stockAvant = +p.stock || 0;
            if (x.stock != null && D.arrondi(x.stock) !== stockAvant) D.mouvement(db, p.id, D.arrondi(x.stock - stockAvant), 'Import (inventaire)');
            if (!neuf) { if (sig(k, p) + JSON.stringify(p.fournisseurs || []) !== avant) { D.toucher(p); b.maj++; ajProd(IP, p); } else b.inchanges++; }
          } else if (k === 'prixAchat') {
            const p = produitPar(txt(val((c) => c.produitRef)), txt(val((c) => c.produitEan)));
            if (!p) { b.erreurs.push(`Ligne ${n} : produit introuvable (${txt(val((c) => c.produitRef)) || txt(val((c) => c.produitEan)) || 'sans référence'})`); return; }
            const nomF = txt(val((c) => c.tiersNom)); const code = txt(val((c) => c.tiersCode));
            if (!nomF && !code) { b.erreurs.push(`Ligne ${n} : fournisseur manquant`); return; }
            const t = tiersPar(nomF, code) || (opt.creer ? fournisseurNomme(nomF || code, code, b) : null); if (!t) { b.ignores++; return; }
            if (!t.fournisseur) { t.fournisseur = true; codes(t); D.toucher(t); }
            const fs = (p.fournisseurs = p.fournisseurs || []); let f = fs.find((y) => y.tiers === t.id); const neuf = !f;
            if (neuf && !opt.creer) { b.ignores++; return; } if (!neuf && !opt.maj) { b.ignores++; return; }
            const avant = neuf ? '' : sig(k, { p, f });
            if (neuf) f = { tiers: t.id, ref: '', qte_min: 1, pu: 0, remise: 0, delai: 0, depuis: D.auj() };
            const pu0 = f.pu; appliquer(f, v, { db, avert: avertL }); if (!neuf && f.pu !== pu0) f.depuis = D.auj();
            if (neuf) { fs.push(f); D.toucher(p); b.nouveaux++; } else if (sig(k, { p, f }) !== avant) { D.toucher(p); b.maj++; } else b.inchanges++;
          } else if (k === 'prixClients') {
            const t = tiersPar(txt(val((c) => c.tiersNom)), txt(val((c) => c.tiersCode))); const p = produitPar(txt(val((c) => c.produitRef)), '');
            if (!t) { b.erreurs.push(`Ligne ${n} : client introuvable (${txt(val((c) => c.tiersNom)) || txt(val((c) => c.tiersCode)) || '?'})`); return; }
            if (!p) { b.erreurs.push(`Ligne ${n} : produit introuvable (${txt(val((c) => c.produitRef)) || '?'})`); return; }
            let x0 = db.prixClients.find((y) => y.tiers === t.id && y.produit === p.id); const neuf = !x0;
            if (neuf && !opt.creer) { b.ignores++; return; } if (!neuf && !opt.maj) { b.ignores++; return; }
            const avant = neuf ? '' : sig(k, x0);
            if (neuf) x0 = { id: D.id('px'), tiers: t.id, produit: p.id, pu: 0, depuis: D.auj(), par: D.MOI };
            appliquer(x0, v, { db, avert: avertL });
            if (neuf) { db.prixClients.push(x0); b.nouveaux++; } else if (sig(k, x0) !== avant) { x0.depuis = D.auj(); D.toucher(x0); b.maj++; } else b.inchanges++;
          }
        } catch (e) { b.erreurs.push(`Ligne ${n} : ${e.message}`); }
      });
    }));
    if (D.natureClients) D.natureClients(db); // jamais prospect et client à la fois ; prospect qui a déjà commandé → client
    return { bilan, journal, fournisseursCrees: bilanTiersCree };
  }

  // =====================================================================================================
  // Fichiers
  const telecharger = (blob, nom) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nom; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000); };
  const horodate = () => { const d = new Date(); return `${D.iso(d)} ${String(d.getHours()).padStart(2, '0')}h${String(d.getMinutes()).padStart(2, '0')}`; };
  async function lireFichier(f) {
    const buf = await f.arrayBuffer(); const u = new Uint8Array(buf.slice(0, 8));
    if (u[0] === 0x50 && u[1] === 0x4b) return lireXlsx(buf);
    if (u[0] === 0xd0 && u[1] === 0xcf) throw new Error('Ancien format Excel (.xls) : ouvrez-le dans Excel puis « Enregistrer sous » → Classeur Excel (.xlsx), ou CSV.');
    if (/\.(ods|numbers)$/i.test(f.name)) throw new Error('Format non pris en charge : enregistrez le fichier en .xlsx ou en .csv.');
    return lireCsv(buf, f.name);
  }
  D.echange = { lireXlsxDom, ean13Valide, feuilleGrille, ecrireXlsx, lireXlsx, lireCsv, ecrireCsv, analyser, importer, LISTES, feuilleDe, modeEmploi, lireFichier }; // aussi pour les essais

  // =====================================================================================================
  // PAGE
  const NOMS = { grille: 'Catalogue FMD (Grille Tarifaire A–AQ)', produits: 'Produits', prixAchat: 'Prix d’achat', clients: 'Clients', fournisseurs: 'Fournisseurs', contacts: 'Contacts', prixClients: 'Prix clients', ignorer: 'Ne pas importer' };
  let analyses = null; let nomFichier = ''; let options = { creer: true, maj: true };
  P.echange = (v) => {
    const db = v.db; const n = { produits: db.produits.length, prixAchat: db.produits.reduce((s, p) => s + (p.fournisseurs || []).length, 0), clients: db.tiers.filter((t) => t.client || t.prospect).length, fournisseurs: db.tiers.filter((t) => t.fournisseur).length, contacts: db.contacts.length, prixClients: db.prixClients.length };
    const coches = LISTES.map((L) => `<label class="erp-coche erp-ech-coche"><input type="checkbox" data-exp="${L.k}" checked> ${esc(L.nom)} <span class="erp-gris">(${n[L.k]})</span></label>`).join('');
    const ORDRE_AFF = ['grille', ...ORDRE];
    const bilanHtml = (r, fait) => {
      const lignes = ORDRE_AFF.filter((k) => r.bilan[k]).map((k) => { const b = r.bilan[k]; return `<tr><td><b>${esc(NOMS[k])}</b></td><td class="nb">${b.nouveaux ? `<span class="pastille st-ok">${b.nouveaux}</span>` : '0'}</td><td class="nb">${b.maj ? `<span class="pastille st-info">${b.maj}</span>` : '0'}</td><td class="nb">${b.inchanges}</td><td class="nb">${b.erreurs.length ? `<span class="pastille st-ko">${b.erreurs.length}</span>` : '0'}</td></tr>`; }).join('');
      const errs = ORDRE_AFF.flatMap((k) => (r.bilan[k] ? r.bilan[k].erreurs.map((e) => `${NOMS[k]} · ${e}`) : []));
      const avs = ORDRE_AFF.flatMap((k) => (r.bilan[k] ? r.bilan[k].avert.map((e) => `${NOMS[k]} · ${e}`) : []));
      return `<table class="erp-table erp-ech-bilan"><thead><tr><th>Liste</th><th class="nb">${fait ? 'Créées' : 'Nouvelles'}</th><th class="nb">${fait ? 'Mises à jour' : 'À mettre à jour'}</th><th class="nb">Inchangées</th><th class="nb">Erreurs</th></tr></thead><tbody>${lignes || '<tr><td colspan="5" class="erp-gris">Aucune ligne à importer.</td></tr>'}</tbody></table>
        ${errs.length ? `<details class="erp-ech-det" open><summary>${errs.length} ligne${errs.length > 1 ? 's' : ''} non importée${errs.length > 1 ? 's' : ''}</summary><ul>${errs.slice(0, 60).map((e) => `<li>${esc(e)}</li>`).join('')}${errs.length > 60 ? `<li>… et ${errs.length - 60} autres</li>` : ''}</ul></details>` : ''}
        ${avs.length ? `<details class="erp-ech-det"><summary>${avs.length} remarque${avs.length > 1 ? 's' : ''} (importé quand même)</summary><ul>${avs.slice(0, 80).map((e) => `<li>${esc(e)}</li>`).join('')}${avs.length > 80 ? `<li>… et ${avs.length - 80} autres</li>` : ''}</ul></details>` : ''}`;
    };
    const apercu = () => {
      if (!analyses) return '';
      const tables = analyses.map((a, i) => { const L = a.k !== 'ignorer' ? liste_(a.k) : null; const map = L ? a.tete.map((h) => trouverCol(colsImp(L), h)) : [];
        const reconnues = a.tete.map((h, j) => (h ? `<span class="pastille ${map[j] && !map[j].lecture ? 'st-ok' : 'st-neutre'}" title="${map[j] ? (map[j].lecture ? 'Colonne calculée : ignorée' : `→ ${esc(map[j].t)}`) : 'Colonne non reconnue : ignorée'}">${esc(h)}</span>` : '')).join(' ');
        return `<div class="erp-ech-table"><div class="erp-ech-table-t"><b>${esc(a.nom)}</b> <span class="erp-gris">${a.lignes.length} ligne${a.lignes.length > 1 ? 's' : ''}</span>
          <label>Contient : <select data-type-table="${i}">${Object.entries(NOMS).map(([k, l]) => `<option value="${k}"${a.k === k ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label></div>
          ${L ? `<div class="erp-ech-cols">${reconnues}</div>` : ''}${a.k === 'grille' ? `<p class="erp-gris">Format du catalogue FMD reconnu : colonnes A à AQ lues par position (Référence = B, EAN = U). ${a.lignes.length} lignes, ${marquesGrille(a).length} marques.</p><label>Importer : <select data-marque-grille><option value="">Toutes les marques</option>${marquesGrille(a).map(([m, k]) => `<option value="${esc(m)}"${opts().marqueGrille === m ? ' selected' : ''}>${esc(m)} (${k})</option>`).join('')}</select></label>` : ''}</div>`; }).join('');
      const essai = importer(structuredClone(db), analyses, opts()); const bloque = Object.values(essai.bilan).some((x) => x.bloque);
      return U.bloc(`Aperçu : ${nomFichier}`, `${tables}
        <div class="erp-ech-options">${U.coche('creer', opts().creer, 'Créer les fiches qui n’existent pas')} ${U.coche('maj', opts().maj, 'Mettre à jour les fiches existantes')}</div>
        <h3 class="erp-sous-titre">Ce qui va se passer</h3>${bilanHtml(essai)}
        ${essai.fournisseursCrees ? `<p class="erp-gris">${essai.fournisseursCrees} fournisseur${essai.fournisseursCrees > 1 ? 's' : ''} nommé${essai.fournisseursCrees > 1 ? 's' : ''} dans les prix d’achat sera créé${essai.fournisseursCrees > 1 ? 's' : ''}.</p>` : ''}
        ${U.boutons([bloque ? '' : U.btn('Importer maintenant', 'ok', 'btn-metal', 'data-ech="importer"'), U.btn('Annuler', '', 'btn-ligne', 'data-ech="annuler"')])}`, { ico: 'liste' });
    };
    const opts = () => options;
    return {
      html: `${U.titrePage('liste', 'Import / Export')}
        <p class="erp-gris">Toutes vos fiches dans un fichier Excel (produits, prix d’achat, clients, fournisseurs, contacts, prix négociés), et l’inverse : un fichier Excel ou CSV, même venant d’un autre logiciel, devient des fiches FMD.</p>
        <div class="erp-2col"><div class="erp-col">${U.bloc('Exporter', `<div class="erp-ech-coches">${coches}</div>
          ${U.boutons([U.btn('Exporter en Excel (.xlsx)', '', 'btn-metal', 'data-ech="xlsx"'), U.btn('Modèle vide à remplir', '', 'btn-ligne', 'data-ech="modele"'), U.btn('Catalogue au format Grille Tarifaire (A–AQ)', '', 'btn-ligne', 'data-ech="grille"')])}
          <p class="erp-gris">CSV (une seule liste, pour un autre logiciel) : <select data-csv>${LISTES.map((L) => `<option value="${L.k}">${esc(L.nom)}</option>`).join('')}</select> ${U.btn('Exporter en CSV', '', 'btn-ligne petit', 'data-ech="csv"')}</p>`, { ico: 'liste' })}</div>
        <div class="erp-col">${U.bloc('Importer', `<p>Choisissez un fichier <b>Excel (.xlsx)</b> ou <b>CSV</b>. Un aperçu s’affiche : rien n’est enregistré avant « Importer maintenant ».</p>
          <label class="btn btn-metal erp-ech-fichier">Choisir un fichier…<input type="file" accept=".xlsx,.xlsm,.csv,.txt,.tsv,.xls" data-ech-fichier hidden></label>
          <p class="erp-gris">Astuce : exportez d’abord, modifiez le fichier dans Excel, puis réimportez-le. Rien n’est supprimé ; une case vide ne change rien.</p>`, { ico: 'liste' })}</div></div>
        <div data-ech-apercu>${apercu()}</div>`,
      apres: (el) => {
        const zone = el.querySelector('[data-ech-apercu]'); const majApercu = () => { zone.innerHTML = apercu(); };
        const exporter = async (vide) => {
          const ks = [...el.querySelectorAll('[data-exp]:checked')].map((c) => c.dataset.exp); if (!ks.length && !vide) { v.notifier('Cochez au moins une liste.'); return; }
          v.notifier('Préparation du fichier Excel…');
          const f = [modeEmploi(), ...LISTES.filter((L) => vide || ks.includes(L.k)).map((L) => (vide ? { nom: L.nom, cols: L.cols, lignes: [] } : feuilleDe(db, L)))];
          telecharger(await ecrireXlsx(f), vide ? 'FMD modèle import.xlsx' : `FMD export ${horodate()}.xlsx`);
          D.evt(db, vide ? 'Modèle d’import téléchargé' : `Export Excel : ${ks.map((k) => NOMS[k]).join(', ')}`); v.sauver();
        };
        el.addEventListener('click', async (e) => {
          const b = e.target.closest('[data-ech]'); if (!b) return; const act = b.dataset.ech;
          try {
            if (act === 'xlsx') await exporter(false);
            else if (act === 'modele') await exporter(true);
            else if (act === 'grille') { v.notifier('Préparation du catalogue…'); telecharger(await ecrireXlsx([feuilleGrille(db)]), `FMD catalogue Grille Tarifaire ${horodate()}.xlsx`); D.evt(db, 'Export du catalogue au format Grille Tarifaire'); v.sauver(); }
            else if (act === 'csv') { const L = liste_(el.querySelector('[data-csv]').value); const f = feuilleDe(db, L); telecharger(ecrireCsv(L.cols, f.lignes), `FMD ${L.nom} ${horodate()}.csv`); }
            else if (act === 'annuler') { analyses = null; majApercu(); }
            else if (act === 'importer') {
              const r = importer(db, analyses, opts());
              const tot = Object.values(r.bilan).reduce((s, x) => s + x.nouveaux + x.maj, 0);
              r.journal.slice(0, 50).forEach((j) => D.evt(db, j));
              D.evt(db, `Import « ${nomFichier} » : ${Object.entries(r.bilan).map(([k, x]) => `${NOMS[k]} ${x.nouveaux} créé(s), ${x.maj} mis à jour`).join(' · ')}`);
              v.sauver(); analyses = null;
              v.notifier(tot ? `Import terminé : ${tot} fiche${tot > 1 ? 's' : ''} créée${tot > 1 ? 's' : ''} ou mise${tot > 1 ? 's' : ''} à jour, enregistré en ligne.` : 'Import terminé : rien à changer.');
              zone.innerHTML = U.bloc(`Import terminé : ${nomFichier}`, `${bilanHtml(r, true)}${U.boutons([U.btn('Voir les produits', '', 'btn-ligne', 'data-aller="produits/liste"'), U.btn('Voir les tiers', '', 'btn-ligne', 'data-aller="tiers/liste/tous"')])}`, { ico: 'valider' });
            }
          } catch (err) { console.error(err); v.notifier('Erreur : ' + err.message); }
        });
        el.addEventListener('change', async (e) => {
          const inp = e.target.closest('[data-ech-fichier]');
          if (inp && inp.files[0]) {
            const f = inp.files[0]; nomFichier = f.name; inp.value = '';
            zone.innerHTML = `<p class="erp-gris">Lecture de ${esc(f.name)}… Un gros fichier (catalogue de 100 000 lignes) peut prendre une minute : ne fermez pas FMD.</p>`;
            try { const t = await lireFichier(f); analyses = t.filter((x) => !/modedemploi/.test(norm(x.nom))).map(analyser).filter(Boolean);
              // CSV / onglet unique de tiers sans indication : « fournisseur » dans le nom du fichier
              if (!analyses.length) throw new Error('Le fichier est vide.');
              majApercu();
            } catch (err) { analyses = null; zone.innerHTML = U.bloc('Fichier non lu', `<p class="erp-alerte-txt">${esc(err.message)}</p>`); }
            return;
          }
          const s = e.target.closest('[data-type-table]'); if (s && analyses) { analyses[+s.dataset.typeTable].k = s.value; majApercu(); return; }
          const mg = e.target.closest('[data-marque-grille]'); if (mg) { options = { ...options, marqueGrille: mg.value }; majApercu(); return; }
          if (e.target.name === 'creer' || e.target.name === 'maj') { options = { ...options, [e.target.name]: e.target.checked }; majApercu(); }
        });
      },
    };
  };
})();
