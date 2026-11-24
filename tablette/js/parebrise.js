// FMD — FM'PAREBRISE : dossiers de bris de glace (17 nov. 2026, demande de l'utilisateur : même contenu que son
// logiciel actuel « Onify Glass » — véhicule, plaque, modèle, assurance, franchise, statut, avancement
// Décl. → Sign. → LRE → Rel. → Payé, montants — mais présenté en WIDGETS, dans la D.A. FMD).
// Pas d'image ni de logo repris : la voiture est dessinée (SVG) selon la carrosserie et la couleur.
// Données : db.parebrise de la base du CRM, seulement pour l'enregistrement automatique en ligne (js/erp-nuage.js).
// Styles : ceux des widgets de FM'RENOV (.page-renov, préfixe rv-) + préfixe pb-.
// Utilisé par js/app.js : window.FMDParebrise.monter(conteneur, ctx) → { detruire() }.
(function () {
  'use strict';

  const ETAPES = [['decl', 'Décl.', 'À déclarer'], ['sign', 'Sign.', 'À signer'], ['lre', 'LRE', 'LRE à envoyer'], ['rel', 'Rel.', 'En relance'], ['paye', 'Payé', 'Payée']];
  const STATUTS = [['attente', 'Travaux en attente', 'att'], ['autorises', 'Travaux autorisés', 'ok'], ['termines', 'Travaux terminés', 'info'], ['annule', 'Annulé', 'ko'], ['non_couvert', 'Non couvert', 'ko']];
  const CARROSSERIES = [['citadine', 'Citadine'], ['berline', 'Berline / compacte'], ['break', 'Break / monospace'], ['suv', 'SUV / 4x4'], ['utilitaire', 'Utilitaire / ludospace']];
  const COULEURS = [['#c9ccd1', 'Gris clair'], ['#7c8189', 'Gris foncé'], ['#f4f4f2', 'Blanc'], ['#1f2125', 'Noir'], ['#2f5fa8', 'Bleu'], ['#b3312c', 'Rouge'], ['#d8c7a0', 'Beige'], ['#3f6b48', 'Vert']];
  const VITRAGES = ['Pare-brise', 'Lunette arrière', 'Vitre latérale', 'Toit vitré', 'Rétroviseur'];
  const ASSURANCES = ['ACM IARD', 'Allianz', 'AXA', 'BPCE Assurances IARD', 'Direct Assurance', 'Generali', 'GMF', 'Groupama', 'L’olivier Assurance', 'MAAF Assurances SA', 'MACIF', 'MAIF', 'Matmut', 'MMA', 'Pacifica', 'SMABTP', 'Thélem', 'Allianz Direct', 'Leocare'];
  const MARQUES = ['Citroën', 'Peugeot', 'Renault', 'Dacia', 'Volkswagen', 'Toyota', 'Ford', 'Opel', 'Fiat', 'Nissan', 'Mercedes-Benz', 'BMW', 'Audi', 'Skoda', 'Seat', 'Kia', 'Hyundai', 'Tesla'];
  const DOCS = [['carte_grise', 'Carte grise'], ['controle', 'Contrôle technique'], ['carte_verte', 'Carte verte']];

  function monter(conteneur, ctx) {
    const D = window.FMDERP, U = D.ui, esc = U.esc;
    const lireLS = (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
    const ecrireLS = (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignoré */ } };
    let db = D.charger();
    const B = () => { const r = (db.parebrise = db.parebrise || {}); r.dossiers = r.dossiers || []; r.n = r.n || 0; return r; };
    const sauver = () => D.sauver(db);
    const notifier = (m) => { if (ctx.notifier) ctx.notifier(m); };
    let route = lireLS('fmd-pb-route', 'dossiers'); const histo = [];

    // ---------- calculs ----------
    // Étape où en est le dossier : 0 à déclarer, 1 à signer, 2 LRE à envoyer, 3 en relance (LRE envoyée, pas payé), 4 payé
    const etapeEnCours = (x) => { const e = x.etapes || {}; return !e.decl ? 0 : !e.sign ? 1 : !e.lre ? 2 : !e.paye ? 3 : 4; };
    const filtre = (x) => (x.statut === 'annule' || x.statut === 'non_couvert' ? 'clos' : ETAPES[etapeEnCours(x)][0]);
    const franchiseTxt = (x) => { const v = +x.franchise || 0; return x.franchise_type === 'eur' ? `${D.euros(v)}` : `${D.nombre(v)} %${+x.franchise_max ? ` / max ${D.euros(+x.franchise_max)}` : ''}`; };
    const du = (x) => +x.du_assurance || 0, enc = (x) => +x.encaisse || 0;
    const ecart = (x) => D.arrondi(enc(x) - du(x));
    const jours = (d) => (d ? Math.max(0, Math.round((Date.now() - new Date(String(d).slice(0, 10) + 'T12:00:00')) / 864e5)) : 0);
    // Badges de statut (comme Onify) : pastille pleine en dégradé, icône, MAJUSCULES ; tampon « PAYÉ » / « ANNULÉ »
    const ICO_STATUT = {
      attente: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
      autorises: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
      termines: '<svg viewBox="0 0 24 24"><path d="M2.5 12.5l4.5 4.5L16.5 7.5M10 15.5l1.5 1.5L21 7.5"/></svg>',
      non_couvert: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M6 6l12 12"/></svg>',
    };
    const tampon = (t, cls) => `<span class="pb-tampon ${cls}">${t}</span>`;
    const statutPill = (x, plein) => {
      if (x.statut === 'annule') return tampon('Annulé', 'ko');
      const paye = x.etapes && x.etapes.paye;
      if (paye && !plein) return tampon('Payé', 'ok');
      const s = STATUTS.find((t) => t[0] === x.statut) || STATUTS[0];
      return `<span class="pb-statut pb-st-${s[0]}" title="${esc(s[1])}">${ICO_STATUT[s[0]] || ''}<b>${esc(s[1])}</b></span>`;
    };
    const trouve = (id) => B().dossiers.find((x) => x.id === id);

    // ---------- dessins : voiture (profil) et plaque française ----------
    // Illustration du véhicule (17/11/2026, « des schémas modernes, pas de vraies photos ») : profil vectoriel détaillé,
    // rendu « studio » — carrosserie en dégradé avec reflet, vitres teintées, jantes alliage, optiques lumineuses, ombre.
    // 5 silhouettes × couleur choisie dans le dossier. Coordonnées : viewBox 320 × 136, avant du véhicule à droite.
    const SILHOUETTES = {
      citadine: { roues: [80, 236], porte: [160, 222],
        corps: 'M40 94 C38 82 44 74 56 72 L84 66 C96 48 112 38 136 37 L186 37 C204 37 218 46 230 60 L262 66 C278 69 286 76 287 88 L287 98 C287 102 284 104 280 104 L46 104 C41 104 39 100 40 94 Z',
        vitres: ['M92 65 C102 50 116 42 136 41 L156 41 L156 65 Z', 'M163 41 L184 41 C200 41 212 49 222 62 L163 65 Z'], phare: [276, 76], feu: [44, 78], retro: [222, 64] },
      berline: { roues: [80, 248], porte: [163, 230],
        corps: 'M22 92 C20 80 26 73 40 71 L80 66 C94 50 110 41 134 40 L196 40 C214 40 228 48 242 62 L278 67 C294 70 302 77 303 88 L303 98 C303 102 300 104 296 104 L28 104 C23 104 21 100 22 92 Z',
        vitres: ['M90 65 C102 51 116 44 134 44 L160 44 L160 65 Z', 'M166 44 L194 44 C210 44 222 51 233 63 L166 65 Z'], phare: [292, 76], feu: [26, 77], retro: [232, 64] },
      break: { roues: [78, 250], porte: [160, 232],
        corps: 'M18 90 C17 78 20 66 26 56 L34 44 C38 40 42 39 50 39 L198 39 C216 39 230 48 244 62 L280 67 C295 70 303 77 304 88 L304 98 C304 102 301 104 297 104 L24 104 C19 104 17 100 18 90 Z',
        vitres: ['M38 47 C40 44 44 43 50 43 L94 43 L94 64 L32 64 Z', 'M100 43 L156 43 L156 64 L100 64 Z', 'M163 43 L196 43 C212 43 224 51 235 63 L163 64 Z'], phare: [293, 76], feu: [22, 72], retro: [234, 63] },
      suv: { roues: [80, 248], porte: [161, 230],
        corps: 'M20 88 C18 74 22 62 30 54 L38 40 C42 34 48 32 58 32 L192 32 C210 32 224 40 238 54 L274 60 C292 63 302 72 303 86 L303 96 C303 101 299 103 295 103 L26 103 C21 103 19 98 20 88 Z',
        vitres: ['M46 38 L96 38 L96 58 L36 58 Z', 'M102 38 L158 38 L158 58 L102 58 Z', 'M164 38 L190 38 C206 38 218 45 229 56 L164 58 Z'], phare: [292, 70], feu: [24, 66], retro: [228, 56] },
      utilitaire: { roues: [80, 248], porte: [150, 226],
        corps: 'M18 92 L18 34 C18 26 22 22 30 22 L196 22 C208 22 216 28 224 40 L240 60 L278 66 C294 69 302 76 303 88 L303 98 C303 102 300 104 296 104 L24 104 C20 104 18 100 18 92 Z',
        vitres: ['M26 30 L92 30 L92 58 L26 58 Z', 'M98 30 L146 30 L146 60 L98 60 Z', 'M153 28 L194 28 C204 28 210 32 216 42 L230 60 L153 60 Z'], phare: [292, 74], feu: [20, 50], retro: [228, 60] },
    };
    function dessinVoiture(x, w = 200) {
      const k = SILHOUETTES[x.carrosserie] ? x.carrosserie : 'berline'; const S = SILHOUETTES[k];
      const c = x.couleur || '#c9ccd1'; const id = 'v' + Math.random().toString(36).slice(2, 8);
      const roue = (cx) => `<g transform="translate(${cx} 104)"><circle r="26" fill="#0c0d0f"/><circle r="22" fill="#1b1d21"/><circle r="20.5" fill="none" stroke="#33363c" stroke-width="1.4"/>
        <circle r="15" fill="#2c3036"/>${[0, 72, 144, 216, 288].map((a) => `<path transform="rotate(${a})" d="M-2.4 -3.2 L-4.2 -14 L4.2 -14 L2.4 -3.2 Z" fill="url(#${id}j)"/>`).join('')}
        <circle r="15" fill="none" stroke="url(#${id}j)" stroke-width="1.8"/><circle r="4.2" fill="url(#${id}j)"/><circle r="1.6" fill="#5b616a"/><path d="M-13 -9 A16 16 0 0 1 -2 -15.6" stroke="#fff" stroke-opacity=".5" stroke-width="1.2" fill="none"/></g>`;
      const yv = S.vitres.length ? +(S.vitres[S.vitres.length - 1].match(/L\d+ (\d+) Z$/) || [0, 64])[1] : 64;
      return `<svg class="pb-voiture" viewBox="0 0 320 136" width="${w}" role="img" aria-label="${esc([x.marque, x.modele].filter(Boolean).join(' ') || 'Véhicule')}">
        <defs>
          <linearGradient id="${id}c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".28" stop-color="#fff" stop-opacity=".12"/><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".38"/></linearGradient>
          <linearGradient id="${id}v" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3d4c5c"/><stop offset=".6" stop-color="#1b2632"/><stop offset="1" stop-color="#0f161e"/></linearGradient>
          <linearGradient id="${id}j" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4f6f8"/><stop offset=".5" stop-color="#b8bec6"/><stop offset="1" stop-color="#7d848d"/></linearGradient>
          <radialGradient id="${id}o" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#000" stop-opacity=".45"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
          <filter id="${id}f" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2"/></filter>
          <filter id="${id}l" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="3"/></filter>
          <clipPath id="${id}k"><path d="${S.corps}"/></clipPath>
        </defs>
        <ellipse cx="164" cy="128" rx="150" ry="9" fill="url(#${id}o)"/>
        <path d="${S.corps}" fill="${esc(c)}"/>
        <g clip-path="url(#${id}k)">
          <rect x="0" y="0" width="320" height="136" fill="url(#${id}c)"/>
          <rect x="0" y="94" width="320" height="12" fill="#000" opacity=".28"/>
          <path d="M20 ${yv + 8} C120 ${yv + 2} 220 ${yv + 2} 310 ${yv + 10}" stroke="#fff" stroke-opacity=".75" stroke-width="3" fill="none" filter="url(#${id}f)"/>
          ${S.porte.map((p) => `<path d="M${p} ${yv - 22} L${p} 100" stroke="#000" stroke-opacity=".22" stroke-width="1.1"/>`).join('')}
          ${S.porte.map((p) => `<rect x="${p - 18}" y="${yv + 6}" width="11" height="2.6" rx="1.3" fill="#000" opacity=".3"/>`).join('')}
        </g>
        ${S.vitres.map((v) => `<path d="${v}" fill="url(#${id}v)"/>`).join('')}
        <g clip-path="url(#${id}k)" opacity=".22"><path d="M60 20 L120 20 L70 80 L10 80 Z M140 20 L170 20 L120 80 L90 80 Z" fill="#fff"/></g>
        <path d="M${S.retro[0]} ${S.retro[1]} l6 -5 h6 l-1 6 z" fill="${esc(c)}" stroke="#000" stroke-opacity=".3" stroke-width=".8"/>
        <ellipse cx="${S.phare[0]}" cy="${S.phare[1]}" rx="9" ry="3.6" fill="#fff4cf" filter="url(#${id}l)" opacity=".9"/><path d="M${S.phare[0] - 9} ${S.phare[1] - 2} h15 l3 3 l-3 3 h-15 z" fill="#fffaf0" stroke="#9aa0a8" stroke-width=".6"/>
        <ellipse cx="${S.feu[0]}" cy="${S.feu[1]}" rx="5" ry="4" fill="#ff3b30" filter="url(#${id}l)" opacity=".85"/><rect x="${S.feu[0] - 3}" y="${S.feu[1] - 3.5}" width="6" height="7" rx="2" fill="#d1261d"/>
        ${S.roues.map(roue).join('')}
      </svg>`;
    }
    // Photo du véhicule : photo perso du dossier si l'utilisateur en a mis une, sinon l'illustration.
    function voiture(x, w = 200) {
      const titre = esc([x.marque, x.modele].filter(Boolean).join(' ') || 'Véhicule');
      return `<figure class="pb-photo${x.photo ? ' avec' : ''}" style="--w:${w}px">${x.photo ? `<img src="${esc(x.photo)}" alt="${titre}" loading="lazy">` : dessinVoiture(x, w)}</figure>`;
    }
    // Après chaque affichage : logos d'assurance introuvables → initiales
    function hydrater(el) {
      el.querySelectorAll('img[data-repli]').forEach((im) => {
        const repli = () => { const s = document.createElement('span'); s.className = 'pb-assu-init'; s.textContent = im.dataset.repli; im.replaceWith(s); };
        if (im.complete && !im.naturalWidth) repli(); else im.addEventListener('error', repli, { once: true });
      });
    }
    // Plaque d'immatriculation française (520 × 110 mm) : bandes bleues, étoiles de l'UE, « F », département
    const formatImmat = (t) => { const v = String(t || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); const m = v.match(/^([A-Z]{2})(\d{3})([A-Z]{2})$/); return m ? m.slice(1).join('-') : v || '— — —'; };
    function plaque(immat, dept, w = 170) {
      const id = 'p' + Math.random().toString(36).slice(2, 7); const t = formatImmat(immat);
      const etoiles = Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * 2 * Math.PI, cx = 35 + 17 * Math.cos(a), cy = 38 + 17 * Math.sin(a);
        const pts = Array.from({ length: 10 }, (_, j) => { const r = j % 2 ? 1.6 : 3.8, b = -Math.PI / 2 + (j * Math.PI) / 5; return `${(cx + r * Math.cos(b)).toFixed(1)},${(cy + r * Math.sin(b)).toFixed(1)}`; }).join(' ');
        return `<polygon points="${pts}" fill="#ffd200"/>`;
      }).join('');
      return `<svg class="pb-plaque" viewBox="0 0 520 110" width="${w}" role="img" aria-label="Plaque ${esc(t)}">
        <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#f6f7f8"/><stop offset="1" stop-color="#dfe3e8"/></linearGradient>
          <linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1450c8"/><stop offset="1" stop-color="#062f86"/></linearGradient></defs>
        <rect x="2" y="2" width="516" height="106" rx="11" fill="url(#${id})" stroke="#0d0d0d" stroke-width="4"/>
        <rect x="8" y="8" width="54" height="94" rx="6" fill="url(#${id}b)"/>${etoiles}<text x="35" y="92" fill="#fff" font-family="Arial, sans-serif" font-weight="700" font-size="30" text-anchor="middle">F</text>
        <rect x="458" y="8" width="54" height="94" rx="6" fill="url(#${id}b)"/><path d="M485 20 l11 7 v12 c0 8 -5 13 -11 16 c-6 -3 -11 -8 -11 -16 v-12 z" fill="none" stroke="#fff" stroke-width="2.4"/><path d="M479 34 h12 M485 28 v14" stroke="#fff" stroke-width="2"/>
        <text x="485" y="92" fill="#fff" font-family="Arial, sans-serif" font-weight="700" font-size="28" text-anchor="middle">${esc(String(dept || '49').slice(0, 3))}</text>
        <text x="260" y="80" fill="#0b0b0b" font-family="'Arial Narrow', 'Roboto Condensed', 'Helvetica Neue', Arial, sans-serif" font-weight="700" font-size="74" text-anchor="middle" textLength="372" lengthAdjust="spacingAndGlyphs">${esc(t)}</text>
        <rect x="2" y="2" width="516" height="50" rx="11" fill="#fff" opacity=".18"/></svg>`;
    }
    // Logo de l'assurance : icône officielle du site de l'assureur (service d'icônes de Google), sinon initiales
    const DOMAINES = [[/acm|cr[eé]dit mutuel/i, 'creditmutuel.fr'], [/allianz direct/i, 'allianzdirect.fr'], [/allianz/i, 'allianz.fr'], [/axa/i, 'axa.fr'], [/bpce|caisse d.?[eé]pargne/i, 'caisse-epargne.fr'],
      [/direct assurance/i, 'direct-assurance.fr'], [/generali/i, 'generali.fr'], [/gmf/i, 'gmf.fr'], [/groupama/i, 'groupama.fr'], [/olivier/i, 'olivier.fr'], [/maaf/i, 'maaf.fr'], [/macif/i, 'macif.fr'], [/maif/i, 'maif.fr'],
      [/matmut/i, 'matmut.fr'], [/\bmma\b/i, 'mma.fr'], [/pacifica|cr[eé]dit agricole/i, 'credit-agricole.fr'], [/smabtp|\bsma\b/i, 'groupe-sma.fr'], [/th[eé]lem/i, 'thelem-assurances.fr'], [/leocare/i, 'leocare.eu'],
      [/hiscox/i, 'hiscox.fr'], [/swiss ?life/i, 'swisslife.fr'], [/aviva|abeille/i, 'abeille-assurances.fr'], [/\blcl\b/i, 'lcl.fr'], [/bnp|cardif/i, 'bnpparibas.fr'], [/soci[eé]t[eé] g[eé]n[eé]rale|sogessur/i, 'societegenerale.fr'],
      [/banque postale/i, 'labanquepostale.fr'], [/april/i, 'april.fr']];
    const initiales = (nom) => String(nom || '?').replace(/[^A-Za-zÀ-ÿ ]/g, '').split(/\s+/).filter(Boolean).slice(0, 2).map((m) => m[0]).join('').toUpperCase() || '?';
    const logoAssu = (nom) => {
      const d = (DOMAINES.find(([re]) => re.test(nom || '')) || [])[1];
      return `<span class="pb-assu-logo">${d ? `<img src="https://www.google.com/s2/favicons?domain=${d}&sz=128" alt="" data-repli="${esc(initiales(nom))}" referrerpolicy="no-referrer">` : `<span class="pb-assu-init">${esc(initiales(nom))}</span>`}</span>`;
    };
    function avancement(x, cliquable) {
      const e = x.etapes || {};
      return `<ol class="pb-etapes">${ETAPES.map(([k, l]) => { const fait = k === 'rel' ? (+e.rel || 0) > 0 : !!e[k];
        return `<li class="${fait ? 'fait' : ''}">${cliquable ? `<button type="button" data-etape="${k}" aria-pressed="${fait}" title="${k === 'rel' ? 'Ajouter une relance' : fait ? 'Annuler cette étape' : 'Marquer comme fait'}">` : '<span>'}${ICONES[k]}${k === 'rel' && +e.rel ? `<em>${+e.rel}</em>` : ''}${cliquable ? '</button>' : '</span>'}<small>${l}</small></li>`; }).join('')}</ol>`;
    }
    const svg = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
    const ICONES = {
      decl: svg('M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1z'),
      sign: svg('M3 17c3-1 4-5 6-5s1 4 3 4 3-3 5-3M4 21h16M15 4l5 5-8 8H7v-5z'),
      lre: svg('M3 6h18v12H3zM3 7l9 6 9-6'),
      rel: svg('M12 6V3L8 7l4 4V8a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z'),
      paye: svg('M15 18.5A6.5 6.5 0 0 1 9.2 15H15v-2H8.6a6.6 6.6 0 0 1 0-2H15V9H9.2A6.5 6.5 0 0 1 15 5.5c1.6 0 3.1.6 4.2 1.6L21 5.3A9 9 0 0 0 6.6 9H3v2h3.1a9.4 9.4 0 0 0 0 2H3v2h3.6A9 9 0 0 0 21 18.7l-1.8-1.8a6.5 6.5 0 0 1-4.2 1.6z'),
    };

    // ---------- coquille (même principe que FM'RENOV : menu en haut, ← Retour) ----------
    conteneur.classList.add('page-crm', 'page-erp', 'page-renov', 'page-pb', 'crm-clair');
    const fen = document.getElementById('fenetre'); if (fen) fen.classList.add('crm-clair');
    conteneur.innerHTML = `
      <header class="erp-haut"><div class="erp-marque"><span class="crm-logo">Pb</span><b>FM’PAREBRISE</b></div>
        <button type="button" class="btn btn-ligne petit renov-retour" data-retour>← Retour</button>
        <nav class="erp-modules" aria-label="FM’PAREBRISE"><button type="button" data-aller="dossiers" data-onglet="dossiers">${U.ico('liste')}Mes dossiers</button><button type="button" data-aller="nouveau" data-onglet="nouveau">${U.ico('plus')}Nouveau dossier</button></nav></header>
      <aside class="erp-cote" aria-label="Filtres"><div class="erp-societe">FM’PAREBRISE · Dossiers</div><nav data-menu></nav></aside>
      <main class="erp-page" id="pb-page"></main>`;
    const zone = conteneur.querySelector('#pb-page');
    function menu() {
      const tete = route.split('/')[0]; const f = route.split('/')[1] || 'tous'; const l = B().dossiers;
      conteneur.querySelectorAll('[data-onglet]').forEach((b) => b.classList.toggle('actif', b.dataset.onglet === (tete === 'dossier' ? 'dossiers' : tete)));
      const n = (k) => (k === 'tous' ? l.length : l.filter((x) => filtre(x) === k).length);
      conteneur.querySelector('[data-menu]').innerHTML = `<div class="erp-menu-g">${[['tous', 'Tous'], ...ETAPES.map(([k, , t]) => [k, t]), ['clos', 'Annulés / non couverts']].map(([k, t]) => `<button type="button" class="erp-menu-i${tete === 'dossiers' && f === k ? ' actif' : ''}" data-aller="dossiers/${k}">${esc(t)} <span class="erp-compte">${n(k)}</span></button>`).join('')}</div>`;
      conteneur.querySelector('[data-retour]').disabled = !histo.length;
    }
    function aller(r, memePlace) {
      if (!r) return;
      if (!memePlace) { db = D.charger(); if (r !== route) histo.push(route); if (histo.length > 50) histo.shift(); }
      route = r; ecrireLS('fmd-pb-route', r); menu();
      const [tete, ...a] = r.split('/');
      let res; try { res = (PAGES[tete] || PAGES.dossiers)(a); } catch (e) { console.error(e); res = { html: `<div class="erp-vide-page"><h1>Page indisponible</h1><p class="erp-gris">${esc(e.message)}</p>${U.lien('dossiers', 'Revenir aux dossiers')}</div>` }; }
      const y = memePlace ? zone.scrollTop : 0;
      zone.innerHTML = `<div class="erp-contenu">${res.html}</div>`; zone.scrollTop = y;
      if (res.apres) { try { res.apres(zone.firstElementChild); } catch (e) { console.error(e); } }
      hydrater(zone);
    }
    const rendre = () => aller(route, true);
    const retour = () => { if (!histo.length) return; route = histo.pop(); aller(route, true); };
    const clic = (e) => { if (e.target.closest('[data-retour]')) { retour(); return; } const a = e.target.closest('[data-aller]'); if (a && conteneur.contains(a) && !a.disabled) { e.preventDefault(); aller(a.dataset.aller); } };
    const touche = (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role=button][data-aller]')) { e.preventDefault(); aller(e.target.dataset.aller); } };
    const souris = (e) => { if (e.button === 3) { e.preventDefault(); retour(); } };
    conteneur.addEventListener('click', clic); conteneur.addEventListener('keydown', touche); conteneur.addEventListener('mouseup', souris);

    // ---------- pages ----------
    const PAGES = {};
    const carte = (x) => { const fini = x.statut === 'annule' || x.statut === 'non_couvert';
      return `<article class="rv-widget pb-carte${fini ? ' pb-clos' : ''}" data-aller="dossier/${x.id}" role="button" tabindex="0" aria-label="Ouvrir le dossier de ${esc(x.client_nom)}">
        <header><div><h3>${esc(x.client_nom || 'Client')}</h3><small>Déposé le ${D.jour(x.depot)}</small></div>${statutPill(x)}</header>
        <div class="pb-auto">${voiture(x, 190)}<div>${plaque(x.immat, x.dept)}<span class="pb-modele">${esc([x.marque, x.modele].filter(Boolean).join(' ').toUpperCase() || '—')}</span></div></div>
        <div class="pb-assu">${logoAssu(x.assurance)}<div><b>${esc(x.assurance || 'Assurance ?')}</b><small>Franchise · ${esc(franchiseTxt(x))}</small></div><span class="pb-vitrage">${esc(x.vitrage || 'Pare-brise')}</span></div>
        ${avancement(x)}
        <footer>${du(x) ? `<div><small>Dû assurance TTC</small><b>${D.euros(du(x))}</b></div><div><small>Encaissé</small><b>${D.euros(enc(x))}</b></div>${x.etapes && x.etapes.paye && ecart(x) ? `<div><small>Écart</small><b class="${ecart(x) < 0 ? 'neg' : 'pos'}">${D.euros(ecart(x))}</b></div>` : `<div><small>DSO</small><b>${jours(x.depot)} j</b></div>`}` : `<div class="pb-sans"><small>Pas de facture</small><b>DSO ${jours(x.depot)} j</b></div>`}</footer></article>`; };

    PAGES.dossiers = ([f = 'tous']) => {
      const tous = B().dossiers.slice().sort((a, b) => (b.depot || '').localeCompare(a.depot || ''));
      const l = f === 'tous' ? tous : tous.filter((x) => filtre(x) === f);
      const actifs = tous.filter((x) => filtre(x) !== 'clos');
      const totDu = actifs.reduce((s, x) => s + du(x), 0), totEnc = actifs.reduce((s, x) => s + enc(x), 0);
      const reste = D.arrondi(actifs.filter((x) => !(x.etapes && x.etapes.paye)).reduce((s, x) => s + Math.max(0, du(x) - enc(x)), 0));
      const n = (k) => (k === 'tous' ? tous.length : tous.filter((x) => filtre(x) === k).length);
      return { html: `<div class="rv-tete"><div><p class="rv-sur">FM’PAREBRISE</p><h1>Mes dossiers <span class="rv-nb">${l.length}</span></h1></div>${U.btn('+ Nouveau dossier', 'ok', 'btn-metal', 'data-aller="nouveau"')}</div>
        <div class="pb-filtres" role="tablist">${[['tous', 'Tous', 'liste'], ...ETAPES.map(([k, , t]) => [k, t, k])].map(([k, t, i]) => `<button type="button" role="tab" class="${f === k ? 'actif' : ''}" data-aller="dossiers/${k}"><span class="pb-rond">${ICONES[i] || U.ico('liste')}</span><span>${esc(t)}</span><b>${n(k)}</b></button>`).join('')}</div>
        <div class="pb-totaux"><div class="rv-widget rv-petit"><div><span class="rv-label">Dû par les assurances (TTC)</span><b>${D.euros(totDu)}</b><small>${actifs.length} dossier(s) actif(s)</small></div></div>
          <div class="rv-widget rv-petit"><div><span class="rv-label">Encaissé</span><b class="pos">${D.euros(totEnc)}</b><small>${tous.filter((x) => x.etapes && x.etapes.paye).length} dossier(s) payé(s)</small></div></div>
          <div class="rv-widget rv-petit"><div><span class="rv-label">Reste à encaisser</span><b class="${reste > 0 ? 'neg' : ''}">${D.euros(reste)}</b><small>dossiers non payés</small></div></div></div>
        ${l.length ? `<div class="pb-cartes">${l.map(carte).join('')}</div>` : `<div class="rv-widget rv-vide"><p>${f === 'tous' ? 'Aucun dossier pour le moment.' : 'Aucun dossier à cette étape.'}</p>${U.btn('+ Nouveau dossier', 'ok', 'btn-metal', 'data-aller="nouveau"')}</div>`}` };
    };

    // Formulaire : mêmes rubriques que la fiche (Client & véhicule, Sinistre, Assurance, Montants)
    function formulaire(x) {
      const ch = (lib, html, o = {}) => `<label class="pb-champ${o.large ? ' large' : ''}"><span>${esc(lib)}${o.req ? ' *' : ''}</span>${html}</label>`;
      const i = (n, o = {}) => U.inp(n, x[n] ?? '', o);
      return `<form id="pb-f" class="pb-form erp-ajout" autocomplete="off">
        <section class="rv-widget"><h2 class="pb-h2">Client & véhicule</h2><div class="pb-grille">
          ${ch('Client', i('client_nom', { req: true, ph: 'Nom et prénom' }), { req: true })}${ch('Téléphone', i('client_tel'))}${ch('E-mail', i('client_email', { type: 'email' }))}${ch('Adresse', i('client_adresse'), { large: true })}
          ${ch('Immatriculation', i('immat', { ph: 'AB-123-CD', req: true }), { req: true })}${ch('Département (plaque)', i('dept', { ph: '49' }))}${ch('Marque', i('marque', { list: 'pb-marques' }))}${ch('Modèle', i('modele', { ph: 'Ex : Berlingo II' }))}${ch('N° de série (VIN)', i('vin'))}${ch('Kilométrage', i('km', { type: 'number', min: 0 }))}
          ${ch('Carrosserie', U.sel('carrosserie', CARROSSERIES, x.carrosserie || 'berline'))}${ch('Couleur', U.sel('couleur', COULEURS, x.couleur || '#c9ccd1'))}${ch('Photo du véhicule (facultatif)', '<input type="file" name="photo_fichier" accept="image/*">')}</div><p class="pb-aide">Sans photo : une illustration du véhicule (carrosserie et couleur choisies) est affichée.${x.photo ? ' <button type="button" class="erp-lien" data-pb="modif-photo">✎ Modifier ma photo</button> · <button type="button" class="erp-lien" data-pb="sans-photo">Retirer ma photo</button>' : ''}</p></section>
        <section class="rv-widget"><h2 class="pb-h2">Sinistre</h2><div class="pb-grille">
          ${ch('Date du sinistre', i('date_sinistre', { type: 'date' }))}${ch('Date de dépôt', U.inp('depot', x.depot || D.auj(), { type: 'date' }))}${ch('Vitrage endommagé', U.sel('vitrage', VITRAGES, x.vitrage || 'Pare-brise'))}
          ${ch('Capteurs ADAS', U.sel('adas', [['non_verifies', 'Non vérifiés'], ['ok', 'Vérifiés / recalibrés'], ['sans', 'Pas de capteur']], x.adas || 'non_verifies'))}${ch('Statut du dossier', U.sel('statut', STATUTS.map((s) => [s[0], s[1]]), x.statut || 'attente'))}${ch('Technicien', i('technicien'))}</div></section>
        <section class="rv-widget"><h2 class="pb-h2">Assurance</h2><div class="pb-grille">
          ${ch('Assurance', i('assurance', { list: 'pb-assus', ph: 'Ex : MAAF Assurances SA' }))}${ch('N° assuré / contrat', i('num_assure'))}
          ${ch('Franchise', i('franchise', { type: 'number', step: '0.01', min: 0 }))}${ch('Type de franchise', U.sel('franchise_type', [['pct', '%'], ['eur', '€']], x.franchise_type || 'pct'))}${ch('Franchise max (€)', i('franchise_max', { type: 'number', step: '0.01', min: 0 }))}</div></section>
        <section class="rv-widget"><h2 class="pb-h2">Montants</h2><div class="pb-grille">
          ${ch('Dû par l’assurance (€ TTC)', i('du_assurance', { type: 'number', step: '0.01', min: 0 }))}${ch('Encaissé (€)', i('encaisse', { type: 'number', step: '0.01', min: 0 }))}${ch('Note', U.area('note', x.note || '', 2), { large: true })}</div></section>
        <datalist id="pb-marques">${MARQUES.map((m) => `<option value="${esc(m)}">`).join('')}</datalist><datalist id="pb-assus">${ASSURANCES.map((m) => `<option value="${esc(m)}">`).join('')}</datalist>
        <div class="pb-pied">${U.btn(x.id ? 'Enregistrer' : 'Créer le dossier', 'ok', 'btn-metal', 'type="submit"')}${x.id ? U.btn('Supprimer le dossier', 'supprimer', 'btn-ligne', 'type="button" data-pb="suppr"') : U.btn('Annuler', '', 'btn-ligne', 'type="button" data-retour')}</div></form>`;
    }
    const photoDe = async (x, f) => { const fi = f.photo_fichier && f.photo_fichier.files[0]; if (!fi) return; try { x.photo = await U.lireImage(fi, { max: 720, jpeg: true }); } catch (err) { notifier(err.message); } };
    const CHAMPS = ['client_nom', 'client_tel', 'client_email', 'client_adresse', 'immat', 'dept', 'marque', 'modele', 'vin', 'km', 'carrosserie', 'couleur', 'date_sinistre', 'depot', 'vitrage', 'adas', 'statut', 'technicien', 'assurance', 'num_assure', 'franchise', 'franchise_type', 'franchise_max', 'du_assurance', 'encaisse', 'note'];
    const lire = (x, f) => { const v = U.lire(f); CHAMPS.forEach((k) => { x[k] = typeof v[k] === 'string' ? v[k] : v[k] ?? ''; }); x.immat = String(x.immat || '').toUpperCase(); D.toucher(x); };

    PAGES.nouveau = () => ({ html: `<div class="rv-tete"><div><p class="rv-sur">FM’PAREBRISE</p><h1>Nouveau dossier</h1></div></div>${formulaire({})}`,
      apres: (el) => el.querySelector('#pb-f').addEventListener('submit', async (e) => { e.preventDefault(); const r = B(); r.n += 1;
        const x = { id: D.id('pb'), num: `PB-${new Date().getFullYear()}-${String(r.n).padStart(4, '0')}`, etapes: { decl: false, sign: false, lre: false, rel: 0, paye: false }, docs: {}, cree: D.maintenant() };
        lire(x, e.target); await photoDe(x, e.target); r.dossiers.push(x); sauver(); notifier(`Dossier ${x.num} créé.`); aller(`dossier/${x.id}`); }) });

    PAGES.dossier = ([id]) => {
      const x = trouve(id); if (!x) return { html: `<div class="erp-vide-page"><h1>Dossier introuvable</h1>${U.lien('dossiers', 'Voir les dossiers')}</div>` };
      const l = B().dossiers.slice().sort((a, b) => (b.depot || '').localeCompare(a.depot || '')); const i = l.indexOf(x);
      const manquants = DOCS.filter(([k]) => !(x.docs || {})[k]).length;
      const reste = du(x) ? D.euros(Math.max(0, du(x) - enc(x))) : 'Pas de facture';
      return { html: `<section class="rv-widget pb-tete">
          <div class="pb-tete-g"><h1>${esc(x.client_nom)}</h1><span class="pb-num">${esc(x.num)}</span><small>Déposé le ${D.jour(x.depot)}</small>
            <dl class="pb-chiffres"><div><dt>Dû assurance</dt><dd>${du(x) ? D.euros(du(x)) : '-'}</dd></div><div><dt>Encaissé</dt><dd>${D.euros(enc(x))}</dd></div><div><dt>Reste</dt><dd>${esc(reste)}</dd></div></dl></div>
          <div class="pb-tete-m">${avancement(x, true)}<small class="erp-gris">Cliquez sur une étape pour la marquer faite (Rel. = ajouter une relance).</small></div>
          <div class="pb-tete-d"><div class="pb-nav">${i > 0 ? U.lien(`dossier/${l[i - 1].id}`, '‹', 'fleche') : '<span class="erp-gris">‹</span>'}<span>${i + 1} / ${l.length}</span>${i < l.length - 1 ? U.lien(`dossier/${l[i + 1].id}`, '›', 'fleche') : '<span class="erp-gris">›</span>'}</div>${x.etapes && x.etapes.paye && x.statut !== 'annule' ? tampon('Payé', 'ok') : ''}${statutPill(x, true)}
            ${manquants ? `<span class="pb-manque">${manquants} document(s) manquant(s)</span>` : '<span class="pastille st-ok"><i class="erp-point"></i>Dossier complet</span>'}</div></section>
        <div class="pb-fiche">
          <section class="rv-widget pb-vehicule"><span class="rv-label">Client & véhicule</span>
            <div class="pb-auto grand">${voiture(x, 260)}<div>${plaque(x.immat, x.dept)}<span class="pb-modele">${esc([x.marque, x.modele].filter(Boolean).join(' ').toUpperCase() || '—')}</span>${x.vin ? `<small>VIN ${esc(x.vin)}</small>` : ''}${x.km ? `<small>${D.nombre(+x.km)} km</small>` : ''}</div></div>
            <ul class="pb-infos"><li><b>${esc(x.client_nom)}</b></li>${x.client_tel ? `<li>☎ ${esc(x.client_tel)}</li>` : ''}${x.client_email ? `<li>✉ ${esc(x.client_email)}</li>` : ''}${x.client_adresse ? `<li>⌂ ${esc(x.client_adresse)}</li>` : ''}</ul></section>
          <section class="rv-widget"><span class="rv-label">Sinistre</span><h3 class="pb-h3">Bris de glace</h3>
            <ul class="pb-infos"><li>Date : ${D.jour(x.date_sinistre)}</li><li>Vitrage : <span class="pb-vitrage">${esc(x.vitrage || 'Pare-brise')}</span></li><li>Capteurs ADAS : ${{ ok: 'vérifiés / recalibrés', sans: 'pas de capteur' }[x.adas] || 'non vérifiés'}</li>${x.technicien ? `<li>Technicien : ${esc(x.technicien)}</li>` : '<li class="erp-gris">Aucun technicien en charge</li>'}</ul></section>
          <section class="rv-widget"><span class="rv-label">Assurance</span><div class="pb-assu grand">${logoAssu(x.assurance)}<div><b>${esc(x.assurance || '—')}</b><small>Franchise ${esc(franchiseTxt(x))}</small>${x.num_assure ? `<small>N° assuré : ${esc(x.num_assure)}</small>` : ''}</div></div></section>
          <section class="rv-widget"><span class="rv-label">Documents</span><ul class="pb-docs">${DOCS.map(([k, t]) => { const ok = !!(x.docs || {})[k];
            return `<li class="${ok ? 'ok' : 'manque'}"><span>${esc(t)}</span><b>${ok ? 'Fourni' : 'Manquant'}</b><button type="button" class="btn btn-ligne petit" data-doc="${k}">${ok ? 'Retirer' : '+ Ajouter'}</button></li>`; }).join('')}</ul>
            <p class="pb-bientot">Photos avant / pendant / après <span class="pastille">Bientôt</span></p></section>
        </div>
        <h2 class="pb-h2 pb-modif">Modifier le dossier</h2>${formulaire(x)}`,
      apres: (el) => {
        el.querySelector('#pb-f').addEventListener('submit', async (e) => { e.preventDefault(); lire(x, e.target); await photoDe(x, e.target); sauver(); notifier('Dossier enregistré.'); rendre(); });
        el.addEventListener('click', (e) => {
          const et = e.target.closest('[data-etape]'); const dc = e.target.closest('[data-doc]'); const sp = e.target.closest('[data-pb="suppr"]'); if (e.target.closest('[data-pb="sans-photo"]')) { delete x.photo; D.toucher(x); sauver(); rendre(); return; }
          if (e.target.closest('[data-pb="modif-photo"]') && x.photo && window.FMDRetouche) { window.FMDRetouche.ouvrir(x.photo, { titre: 'Photo du véhicule' }).then((p) => { if (p) { x.photo = p; D.toucher(x); sauver(); rendre(); } }); return; }
          if (et) { const k = et.dataset.etape; x.etapes = x.etapes || {}; if (k === 'rel') x.etapes.rel = (+x.etapes.rel || 0) + 1; else x.etapes[k] = !x.etapes[k];
            if (k === 'paye' && x.etapes.paye) { x.paye_le = D.auj(); if (!enc(x) && du(x)) x.encaisse = du(x); }
            D.toucher(x); sauver(); rendre(); }
          if (dc) { x.docs = x.docs || {}; x.docs[dc.dataset.doc] = !x.docs[dc.dataset.doc]; D.toucher(x); sauver(); rendre(); }
          if (sp && confirm(`Supprimer le dossier de ${x.client_nom} ?`)) { const r = B(); r.dossiers.splice(r.dossiers.indexOf(x), 1); sauver(); notifier('Dossier supprimé.'); aller('dossiers'); }
        });
      } };
    };

    aller(route, true);
    return {
      detruire() {
        conteneur.removeEventListener('click', clic); conteneur.removeEventListener('keydown', touche); conteneur.removeEventListener('mouseup', souris);
        conteneur.classList.remove('page-crm', 'page-erp', 'page-renov', 'page-pb', 'crm-clair'); if (fen) fen.classList.remove('crm-clair'); conteneur.innerHTML = '';
      },
      aller,
    };
  }

  window.FMDParebrise = { monter };
})();
