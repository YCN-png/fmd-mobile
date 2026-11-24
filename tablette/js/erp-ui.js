// FMD — CRM / ERP : briques d'affichage communes (listes, fiches à onglets, formulaires, graphiques).
// Voir js/erp-donnees.js (données) et js/crm.js (coquille : modules en haut, menu sur le côté, navigation).
(function () {
  'use strict';
  const D = (window.FMDERP = window.FMDERP || {});
  const U = (D.ui = {});
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  U.esc = esc;
  U.MOIS = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];
  // Couleurs des graphiques (palette validée le 9 nov. ; mode clair / sombre dans app.css).
  U.COUL = { neutre: 'var(--erp-neutre)', att: 'var(--cat-3)', info: 'var(--cat-2)', ok: 'var(--succes)', ko: 'var(--danger)', c1: 'var(--cat-1)', c2: 'var(--cat-2)', c3: 'var(--cat-3)', c4: 'var(--cat-4)', c5: 'var(--cat-5)' };

  // ---------- icônes (10 nov., demande « il manque d'icônes, trop de texte ») : traits fins 24 × 24 ----------
  const P = {
    web: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z',
    accueil: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
    tiers: 'M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M15 9h4a1 1 0 0 1 1 1v11M2 21h20M8 8h3M8 12h3M8 16h3',
    contact: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
    contacts: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M16 3.5a4 4 0 0 1 0 7.5M18 14a6 6 0 0 1 4 7',
    produit: 'M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8',
    commerce: 'M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8zM14 3v5h5M9 13h6M9 17h4',
    facture: 'M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2zM9 8h6M9 12h6M9 16h3',
    commande: 'M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L20 8H6.2M9 20.5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1zM17 20.5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1z',
    camion: 'M3 6h11v10H3zM14 9h4l3 3v4h-7M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
    euro: 'M18 6.5A7 7 0 1 0 18 17.5M4 10h10M4 14h10',
    plus: 'M12 5v14M5 12h14',
    liste: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01',
    grille: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
    stats: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
    tag: 'M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8zM7.5 7.5h.01',
    stock: 'M12 3 2 8l10 5 10-5zM2 13l10 5 10-5M2 17.5l10 5 10-5',
    mouvement: 'M7 4v16M7 4 3 8M7 4l4 4M17 20V4M17 20l-4-4M17 20l4-4',
    reappro: 'M21 12a9 9 0 0 1-15.5 6.3L3 16M3 12a9 9 0 0 1 15.5-6.3L21 8M21 3v5h-5M3 21v-5h5',
    magasin: 'M3 9l1.5-5h15L21 9M3 9v11h18V9M3 9h18M9 20v-6h6v6',
    recherche: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-5-5',
    email: 'M3 5h18v14H3zM3 6l9 7 9-7',
    pdf: 'M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2M7 14h10v7H7z',
    valider: 'M20 6 9 17l-5-5',
    modifier: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
    retour: 'M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3',
    cloner: 'M8 8h12v12H8zM16 8V4H4v12h4',
    supprimer: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
    signer: 'M3 21c3-1 5-4 7-4s2 3 4 3 3-2 7-4M14 4l6 6-8 8H6v-6z',
    croix: 'M18 6 6 18M6 6l12 12',
    livrer: 'M3 6h11v10H3zM14 9h4l3 3v4h-7M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
    recevoir: 'M21 8 12 3 3 8v8l9 5 9-5zM8 12l3 3 5-5',
    preparer: 'M9 4h6v3H9zM6 5H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-1M8 13l3 3 5-5',
    envoyer: 'M22 2 11 13M22 2l-7 20-4-9-9-4z',
    alerte: 'M12 3 2 20h20zM12 10v4M12 17h.01',
    temps: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 3',
    note: 'M5 3h14v12l-6 6H5zM13 21v-6h6',
    banque: 'M3 10 12 4l9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 21h18',
    image: 'M4 4h16v16H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01',
    telephone: 'M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2z',
    lieu: 'M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11zM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
    cube: 'M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8',
    client: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 12.5-6.6M16 19l2 2 4-4',
    cible: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01',
    lien: 'M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1',
  };
  // Anciens symboles utilisés dans les pages → icône
  const GLYPHES = { '⌂': 'accueil', '▣': 'tiers', '☺': 'contact', '◇': 'produit', '✎': 'commerce', '▤': 'commande', '€': 'facture', '⇩': 'camion', '▦': 'stock', '◈': 'tag', '⌕': 'recherche', '⇅': 'mouvement', '◉': 'cible' };
  U.ico = (n, cls = '') => { const k = P[n] ? n : GLYPHES[n]; return k ? `<svg class="erp-svg ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${P[k]}"/></svg>` : esc(n); };
  U.ICO_ACT = { valider: 'valider', ok: 'valider', entete: 'modifier', modifier: 'retour', signer: 'signer', refuser: 'croix', rouvrir: 'retour', facturee: 'facture', commande: 'commande', encours: 'preparer', livrer: 'livrer',
    annuler: 'croix', facturer: 'facture', approuver: 'valider', refuser_a: 'croix', annuler_a: 'croix', commander: 'envoyer', recevoir: 'recevoir', payer: 'euro', pdf: 'pdf', email: 'email', cloner: 'cloner',
    supprimer: 'supprimer', suppr: 'supprimer', client: 'client', preparer: 'commande', logo: 'image' };
  const icoTexte = (t) => (/^\+ /.test(t) ? 'plus' : /^Modifier/.test(t) ? 'modifier' : /fournisseur/i.test(t) ? 'camion' : /proposition|devis/i.test(t) ? 'commerce' : /commande/i.test(t) ? 'commande' : /Annuler|‹/.test(t) ? '' : /Enregistrer|Créer|Ajouter|Suivant/.test(t) ? 'valider' : '');

  // ---------- logo / avatar d'un tiers (logo choisi, sinon initiales colorées) ----------
  U.avatar = (t, taille = 28) => {
    if (!t) return '';
    if (t.logo) return `<span class="erp-avatar logo" style="--t:${taille}px"><img src="${esc(t.logo)}" alt=""></span>`;
    const ini = String(t.nom || '?').replace(/[^A-Za-zÀ-ÿ0-9 ]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 2).map((m) => m[0]).join('').toUpperCase() || '?';
    const h = [...String(t.id || t.nom)].reduce((s, c) => s + c.charCodeAt(0), 0) % 5 + 1;
    return `<span class="erp-avatar" style="--t:${taille}px;--c:var(--cat-${h})">${esc(ini)}</span>`;
  };
  // Image d'un produit (choisie dans le CRM), sinon vignette avec l'icône produit à la couleur de sa catégorie.
  // Image introuvable (URL fausse, pas d'internet…) : on remet l'icône à la place de l'image cassée (CRM et site web).
  document.addEventListener('error', (e) => { const im = e.target; if (!im || im.tagName !== 'IMG') return; const b = im.closest('.erp-vprod.img, .sw-visuel.img'); if (!b) return;
    b.classList.remove('img'); b.classList.add('img-ko'); b.title = 'Image introuvable : vérifiez l’adresse (URL)'; b.innerHTML = U.ico('image'); }, true);
  // Fenêtre commune pour TOUTE image (produit, produit à variantes, logo d'un client / fournisseur…) : demande de
  // l'utilisateur (11 nov. 2026) « à chaque fois que je peux changer une image, propose un pop-up : soit un lien, soit
  // charger l'image ». o = { titre, actuelle, apercu: (image) => html, max, jpeg }. fin(image) : URL https://…, image
  // chargée (data URL réduite) ou '' (image retirée). Rien n'est appelé si on annule.
  U.choisirImage = (v, o, fin) => {
    const actuelle = o.actuelle || ''; const lien = /^https?:\/\//i.test(actuelle) ? actuelle : '';
    const corps = `<div class="erp-img-pop"><div class="erp-img-pop-apercu" data-ip-apercu>${o.apercu(actuelle)}</div>
      <div class="erp-img-pop-choix">
        <label class="erp-img-pop-t" for="erp-ip-url">${U.ico('web')} Lien de l’image (URL)</label>
        <input id="erp-ip-url" type="url" data-ip-url value="${esc(lien)}" placeholder="https://…">
        <div class="erp-img-pop-ou"><span>ou</span></div>
        <button type="button" class="btn btn-ligne" data-ip-fichier>${U.ico('image')} Charger une image depuis l’ordinateur</button>
        <input type="file" accept="image/*" data-ip-input hidden>
        <button type="button" class="btn btn-ligne" data-ip-modifier hidden>✎ Modifier l’image (agrandir, recadrer, pivoter…)</button>
        <p class="erp-gris">Vous pouvez aussi coller une image copiée (Ctrl + V) dans cette fenêtre.</p>
        <p class="erp-alerte" data-ip-err></p></div></div>`;
    const pied = `<button type="button" class="btn btn-metal" data-ip-ok>${U.ico('valider')} Valider</button>${actuelle ? '<button type="button" class="btn btn-ligne erp-danger" data-ip-retirer>Retirer l’image</button>' : ''}<button type="button" class="btn btn-ligne" data-fermer>Annuler</button>`;
    v.fenetre(esc(o.titre || 'Image'), corps, pied, (b) => {
      let image = actuelle; const url = b.querySelector('[data-ip-url]'); const err = b.querySelector('[data-ip-err]'); const inp = b.querySelector('[data-ip-input]');
      const modif = b.querySelector('[data-ip-modifier]');
      const montrer = () => { b.querySelector('[data-ip-apercu]').innerHTML = o.apercu(image); modif.hidden = !image || !window.FMDRetouche; };
      b.querySelector('[data-ip-apercu]').addEventListener('click', () => { if (!modif.hidden) modif.click(); });
      modif.addEventListener('click', async () => { const x = await window.FMDRetouche.ouvrir(image, { titre: o.titre ? 'Modifier — ' + o.titre : 'Modifier l’image' }); if (x) { image = await U.reduireImage(x, o.max || 200, o.jpeg); url.value = ''; err.textContent = ''; montrer(); } });
      // 23 nov. 2026 : à l'ajout d'une photo, la fenêtre de recadrage s'ouvre (carré, sujet centré, zoom) ; son « Valider » enregistre.
      const recadrer = async (x) => { if (!window.FMDRetouche) return false; const y = await window.FMDRetouche.ouvrir(x, { titre: (o.titre || 'Image') + ' — centrer et zoomer', format: 'carre', centrer: true, simple: true }); if (y) { image = await U.reduireImage(y, o.max || 200, o.jpeg); montrer(); b.querySelector('[data-ip-ok]').click(); return true; } return false; };
      const prendre = (fichier) => U.lireImage(fichier, { max: o.max, jpeg: o.jpeg }).then((x) => { image = x; url.value = ''; err.textContent = ''; montrer(); return recadrer(x); }).catch((er) => { err.textContent = er.message; });
      url.addEventListener('input', () => { const t = url.value.trim(); if (/^https?:\/\/\S+/i.test(t)) { image = t; err.textContent = ''; montrer(); } });
      b.querySelector('[data-ip-fichier]').addEventListener('click', () => inp.click());
      inp.addEventListener('change', () => { if (inp.files[0]) prendre(inp.files[0]); inp.value = ''; });
      b.addEventListener('paste', (e) => { const it = [...((e.clipboardData || {}).items || [])].find((x) => /^image\//.test(x.type)); if (it) { e.preventDefault(); prendre(it.getAsFile()); } });
      b.addEventListener('dragover', (e) => e.preventDefault());
      b.addEventListener('drop', (e) => { const fi = [...((e.dataTransfer || {}).files || [])].find((x) => /^image\//.test(x.type)); if (fi) { e.preventDefault(); prendre(fi); } });
      b.querySelector('[data-ip-ok]').addEventListener('click', () => { const t = url.value.trim();
        if (t && !/^https?:\/\/\S+/i.test(t)) { err.textContent = 'Le lien doit commencer par https://'; return; }
        if (t) image = t; v.fermer(); fin(image); });
      const ret = b.querySelector('[data-ip-retirer]'); if (ret) ret.addEventListener('click', () => { v.fermer(); fin(''); });
      montrer(); setTimeout(() => url.focus(), 30);
    });
  };
  // Bouton « copier » (référence…) dans une ligne cliquable : copie dans le presse-papiers sans ouvrir la ligne.
  U.copier = (txt) => `<button type="button" class="erp-copier" data-stop data-copier="${esc(txt)}" title="Copier « ${esc(txt)} »" aria-label="Copier ${esc(txt)}">${U.ico('cloner')}</button>`;
  document.addEventListener('click', (e) => { const b = e.target.closest('[data-copier]'); if (!b) return; e.preventDefault(); e.stopPropagation(); const t = b.dataset.copier;
    const ok = () => { b.classList.add('copie'); b.title = 'Copié !'; setTimeout(() => { b.classList.remove('copie'); b.title = `Copier « ${t} »`; }, 1200); };
    const secours = () => { const a = document.createElement('textarea'); a.value = t; a.style.position = 'fixed'; a.style.opacity = '0'; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); } catch { /* rien */ } a.remove(); ok(); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok, secours); else secours(); }, true);
  U.vignetteProduit = (p, taille = 40) => {
    if (!p) return '';
    if (p.image) return `<span class="erp-vprod img" style="--t:${taille}px"><img src="${esc(p.image)}" alt=""></span>`;
    const i = Math.max(0, D.CATEGORIES.findIndex((c) => c[0] === p.categorie)) % 5 + 1;
    return `<span class="erp-vprod" style="--t:${taille}px;--c:var(--cat-${i})" title="Pas encore d’image">${U.ico('produit')}</span>`;
  };
  // ---------- Photos supplémentaires (galerie du site) + logos de certification / normes (11 nov. 2026) ----------
  // Bloc de formulaire commun : produit simple, produit à variantes. Valeurs gardées dans deux champs cachés lus par
  // U.lierMedias (galerie = liste d'images, certifs = identifiants de db.certifs). La bibliothèque des logos est enregistrée
  // tout de suite (pas besoin d'enregistrer le produit pour qu'un nouveau logo existe).
  U.blocMedias = (db, x) => `<h3 class="erp-sous-titre">${U.ico('image')} Photos supplémentaires</h3>
      <p class="erp-gris">Affichées dans la galerie du site après la photo principale : autre vue, schéma technique, photo en situation…</p>
      <div class="erp-galerie" data-galerie></div><input type="hidden" name="galerie" value="${esc(JSON.stringify(x.galerie || []))}">
      <h3 class="erp-sous-titre">${U.ico('valider')} Certifications et normes</h3>
      <p class="erp-gris">Cliquez sur un logo pour l’ajouter ou le retirer. Ils s’affichent sur la fiche du site (« Caractéristiques »).</p>
      <div class="erp-certifs" data-certifs></div><input type="hidden" name="certifs" value="${esc((x.certifs || []).join(','))}">`;
  U.lierMedias = (el, v, db) => {
    const inpG = el.querySelector('input[name="galerie"]'); const inpC = el.querySelector('input[name="certifs"]');
    let galerie = []; try { galerie = JSON.parse(inpG.value || '[]'); } catch { galerie = []; }
    let certifs = (inpC.value || '').split(',').filter(Boolean);
    const zoneG = el.querySelector('[data-galerie]'); const zoneC = el.querySelector('[data-certifs]');
    const vignette = (src) => `<span class="erp-vprod img" style="--t:72px"><img src="${esc(src)}" alt=""></span>`;
    const dessiner = () => {
      inpG.value = JSON.stringify(galerie); inpC.value = certifs.join(',');
      zoneG.innerHTML = galerie.map((src, i) => `<span class="erp-galerie-i">${vignette(src)}<button type="button" class="btn-icone" data-gal-x="${i}" title="Retirer cette photo">✕</button></span>`).join('')
        + `<button type="button" class="erp-galerie-plus" data-gal-plus title="Ajouter une photo">${U.ico('plus')}<span>Ajouter une photo</span></button>`;
      zoneC.innerHTML = (db.certifs || []).map((c) => `<button type="button" class="erp-certif${certifs.includes(c.id) ? ' actif' : ''}" data-certif="${esc(c.id)}" title="${esc(c.nom)}"><img src="${esc(c.image)}" alt=""><span>${esc(c.nom)}</span></button>`).join('')
        + `<button type="button" class="erp-certif erp-certif-plus" data-certif-plus>${U.ico('plus')}<span>Nouveau logo</span></button>`;
    };
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-gal-x],[data-gal-plus],[data-certif],[data-certif-plus]'); if (!b || !el.contains(b)) return;
      e.preventDefault();
      if (b.dataset.galX != null) { galerie.splice(+b.dataset.galX, 1); dessiner(); return; }
      if (b.dataset.galPlus != null) { U.choisirImage(v, { titre: 'Photo supplémentaire', actuelle: '', apercu: (x) => (x ? vignette(x).replace('--t:72px', '--t:160px') : ''), max: 900, jpeg: true }, (x) => { if (x) { galerie.push(x); dessiner(); } }); return; }
      if (b.dataset.certif) { const id = b.dataset.certif; certifs = certifs.includes(id) ? certifs.filter((c) => c !== id) : [...certifs, id]; dessiner(); return; }
      if (b.dataset.certifPlus != null) {
        U.choisirImage(v, { titre: 'Logo de certification ou de norme', actuelle: '', apercu: (x) => (x ? `<img src="${esc(x)}" alt="" style="max-width:200px;max-height:120px;object-fit:contain">` : ''), max: 300 }, (img) => {
          if (!img) return;
          v.fenetre('Nom du logo', `<div class="erp-ligne-f"><label for="erp-certif-nom">Nom</label><input id="erp-certif-nom" placeholder="Ex. : CE, ETA-19/0553, NF, SKH-001"></div><p class="erp-gris">Le logo rejoint la bibliothèque : il pourra être coché sur tous les produits.</p>`,
            `<button type="button" class="btn btn-metal" data-certif-ok>${U.ico('valider')} Ajouter</button><button type="button" class="btn btn-ligne" data-fermer>Annuler</button>`, (f) => {
              const inp = f.querySelector('#erp-certif-nom'); setTimeout(() => inp.focus(), 30);
              const ok = () => { const nom = inp.value.trim() || 'Certification'; const c = { id: D.id('ce'), nom, image: img };
                (db.certifs = db.certifs || []).push(c); certifs.push(c.id); D.evt(db, `Logo « ${nom} » ajouté à la bibliothèque`); v.sauver(); v.fermer(); dessiner(); };
              f.querySelector('[data-certif-ok]').addEventListener('click', ok); inp.addEventListener('keydown', (k) => { if (k.key === 'Enter') { k.preventDefault(); ok(); } });
            });
        });
      }
    });
    dessiner();
    return { galerie: () => [...galerie], certifs: () => [...certifs] };
  };
  U.qui = (t, sous = '', taille = 28) => (t ? `<span class="erp-qui">${U.avatar(t, taille)}<span><b>${esc(t.nom)}</b>${sous ? `<small>${sous}</small>` : ''}</span></span>` : '—');
  // Choisir une image (fichier) → carré PNG 200 px max (transparence gardée), rendu en data URL.
  // o.max : plus grand côté en px (200 par défaut, logos) ; o.jpeg : JPEG (photos de produits, plus léger).
  U.lireImage = (fichier, o = {}) => new Promise((ok, ko) => {
    if (!fichier || !/^image\//.test(fichier.type)) { ko(new Error('Choisissez une image (PNG, JPG, SVG…).')); return; }
    const r = new FileReader(); r.onerror = () => ko(new Error('Lecture impossible'));
    r.onload = () => { const img = new Image(); img.onerror = () => ko(new Error('Image illisible'));
      img.onload = () => { const m = o.max || 200; const src = o.centrer === false ? img : U.centrerImage(img); const k = Math.min(1, m / Math.max(src.width, src.height)); const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(src.width * k)); c.height = Math.max(1, Math.round(src.height * k));
        c.getContext('2d').drawImage(src, 0, 0, c.width, c.height); ok(o.jpeg ? (() => { const x = c.getContext('2d'); x.globalCompositeOperation = 'destination-over'; x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.85); })() : c.toDataURL('image/png')); };
      img.src = r.result; };
    r.readAsDataURL(fichier);
  });

  // Réduit une image (data URL) à « max » px de côté (taille stockée dans la base), JPEG ou PNG.
  U.reduireImage = (src, max, jpeg) => new Promise((ok) => { const i = new Image(); i.onload = () => { const k = Math.min(1, max / Math.max(i.width, i.height)); const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(i.width * k)); c.height = Math.max(1, Math.round(i.height * k)); const x = c.getContext('2d'); if (jpeg) { x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); } x.drawImage(i, 0, 0, c.width, c.height); ok(jpeg ? c.toDataURL('image/jpeg', 0.85) : c.toDataURL('image/png')); }; i.onerror = () => ok(src); i.src = src; });
  // Centrage automatique (23 nov. 2026) : on retire les bords vides (transparents ou blancs) autour du sujet, puis on le
  // place au centre d'un carré (marge 6 %). Photo sans bord vide (ex. voiture) : rendue telle quelle.
  U.centrerImage = (img) => {
    const L = 600, k = Math.min(1, L / Math.max(img.width, img.height)); const w = Math.max(1, Math.round(img.width * k)), h = Math.max(1, Math.round(img.height * k));
    const a = document.createElement('canvas'); a.width = w; a.height = h; const x = a.getContext('2d'); x.drawImage(img, 0, 0, w, h);
    let d; try { d = x.getImageData(0, 0, w, h).data; } catch { return img; }
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) for (let i = 0; i < w; i++) { const p = (y * w + i) * 4; if (d[p + 3] > 16 && !(d[p] > 238 && d[p + 1] > 238 && d[p + 2] > 238)) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
    if (x1 < 0 || ((x1 - x0) > w * 0.96 && (y1 - y0) > h * 0.96)) return img;
    const sx = x0 / k, sy = y0 / k, sw = (x1 - x0 + 1) / k, sh = (y1 - y0 + 1) / k; const cote = Math.max(sw, sh) * 1.12;
    const c = document.createElement('canvas'); c.width = Math.round(cote); c.height = Math.round(cote);
    c.getContext('2d').drawImage(img, sx, sy, sw, sh, (cote - sw) / 2, (cote - sh) / 2, sw, sh); return c;
  };
  // ---------- petits éléments ----------
  U.pastille =(type, id) => { const e = D.etat(type, id); return `<span class="pastille st-${e[2]}"><i class="erp-point"></i>${esc(e[3])}</span>`; };
  U.nature = (t) => `${t.prospect ? '<span class="erp-nat erp-nat-p" title="Prospect">P</span>' : ''}${t.client ? '<span class="erp-nat erp-nat-c" title="Client">C</span>' : ''}${t.fournisseur ? '<span class="erp-nat erp-nat-f" title="Fournisseur">F</span>' : ''}`;
  U.lien = (route, texte, cls = '') => `<button type="button" class="erp-lien ${cls}" data-aller="${esc(route)}">${texte}</button>`;
  U.lienTiers = (db, id) => { const t = D.tiers(db, id); return t ? U.lien(`tiers/fiche/${t.id}`, `${U.avatar(t, 20)} ${esc(t.nom)}`, 'erp-lien-t') : '—'; };
  U.lienProduit = (db, id) => { const p = D.produit(db, id); return p ? U.lien(`produits/fiche/${p.id}`, esc(p.ref)) : '—'; };
  U.vide = (txt = 'Aucun') => `<p class="erp-aucun">${esc(txt)}</p>`;
  U.titrePage = (ico, titre, nb, droite = '') => `<div class="erp-titre"><span class="erp-titre-ico">${U.ico(ico)}</span><h1>${esc(titre)}${nb != null ? ` <span class="erp-nb">(${nb})</span>` : ''}</h1><div class="erp-titre-d">${droite}</div></div>`;
  U.bloc = (titre, contenu, o = {}) => `<section class="erp-bloc ${o.cls || ''}"><header><h2>${o.ico ? U.ico(o.ico) : ''}${esc(titre)}${o.compte != null ? ` <span class="erp-compte">${o.compte}</span>` : ''}</h2>${o.droite || ''}</header><div class="erp-bloc-corps">${contenu}</div></section>`;
  // paires : [libellé, valeur, icône ?]
  U.infos = (paires) => `<dl class="erp-infos">${paires.filter((p) => p && p[1] !== '' && p[1] != null && p[1] !== '—' && p[1] !== '<span class="erp-gris">—</span>').map(([k, v, i]) => `<dt>${i ? U.ico(i) : ''}${esc(k)}</dt><dd>${v === '' || v == null ? '<span class="erp-gris">—</span>' : v}</dd>`).join('')}</dl>`;
  U.boutons = (l) => `<div class="erp-actions">${l.filter(Boolean).join('')}</div>`;
  U.btn = (txt, act, cls = 'btn-metal', extra = '') => { const i = U.ICO_ACT[act] || icoTexte(txt); const t = String(txt).replace(/^\+ /, '');
    return `<button${/type=/.test(extra) ? '' : ' type="button"'} class="btn petit ${cls}" data-act="${esc(act)}" ${extra}>${i ? U.ico(i) : ''}${t}</button>`; };

  // ---------- Listes en WIDGETS (18 nov. 2026, demande de l'utilisateur : « quand il y a une liste je la veux sous forme
  // de widget ») : chaque fiche d'une liste devient une carte (photo / logo, titre, pastilles d'état, infos, montants).
  // Construit automatiquement à partir des colonnes du tableau : rien à changer dans les écrans.
  // cols = [{ t, v(o), nb, cls }]. Principal = colonne avec logo (erp-qui) ou « Nom / Libellé… » ; pastilles = colonnes
  // dont le contenu est une pastille ; montants = colonnes « nb ».
  const vide_ = (h) => { const s = String(h ?? '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim(); return !s || s === '—' || s === '-'; };
  const estImg = (c) => /^(Image|Photo|Logo)$/i.test(c.t || '') || /erp-col-img/.test(c.cls || '');
  const PRINCIPAL = /^(Nom|Libellé|Contact|Désignation|Catégorie|Client|Produit|Fournisseur|Tiers|Chantier|Type|Entrepôt|Tag|Année)/i;
  U.carte = (cols, o, lien, mini, visuel) => {
    const vals = cols.map((c) => ({ c, h: c.v(o) }));
    const img = vals.find((x) => estImg(x.c) && !vide_(x.h) || estImg(x.c) && /<img|<svg|erp-vign/.test(x.h));
    let reste = vals.filter((x) => x !== img && !estImg(x.c));
    const pastilles = reste.filter((x) => /class="(pastille|erp-nat)/.test(x.h) && !x.c.nb && !/<select/.test(x.h));
    reste = reste.filter((x) => !pastilles.includes(x));
    const princ = reste.find((x) => /erp-qui/.test(x.h)) || reste.find((x) => PRINCIPAL.test(x.c.t || '')) || reste[0];
    const tete = reste[0] !== princ ? reste[0] : null;
    reste = reste.filter((x) => x !== princ && x !== tete && !vide_(x.h));
    const montants = reste.filter((x) => x.c.nb).sort((a, b) => !/erp-stock/.test(a.h) - !/erp-stock/.test(b.h)).slice(0, 3); // stocks (codes couleur) d’abord
    const infos = reste.filter((x) => !montants.includes(x));
    // Grande photo « studio » (19 nov. 2026, demande : « chaque truc qui peut avoir un visuel avec image, je le veux ») :
    // image / photo du produit, ou logo du tiers (sinon ses initiales) quand la colonne principale est « Nom… » avec logo.
    // Les documents (devis, commandes…) ont déjà leur visuel des produits (option visuel) : pas de photo en plus.
    let titre = princ ? princ.h : '';
    let photo = '';
    if (!visuel) {
      if (img) photo = img.h;
      else if (princ && /^Nom/i.test(princ.c.t || '')) { const m = titre.match(/<span class="erp-avatar[^"]*"[^>]*>(?:<img[^>]*>|[^<]*)<\/span>/); if (m) { photo = m[0]; titre = titre.replace(m[0], ''); } }
    }
    const tag = lien ? `div class="erp-w cliquable${mini ? ' mini' : ''}${photo ? ' avec-photo' : ''}" data-aller="${esc(lien)}" tabindex="0" role="link"` : `div class="erp-w${mini ? ' mini' : ''}${photo ? ' avec-photo' : ''}"`;
    return `<${tag}>
      ${photo ? `<figure class="erp-w-photo erp-studio-scene"><span class="erp-studio-obj r0">${photo}</span></figure>` : ''}
      <div class="erp-w-haut">${img && !photo && !visuel ? `<div class="erp-w-img">${img.h}</div>` : ''}<div class="erp-w-titres">${tete && !vide_(tete.h) ? `<div class="erp-w-sur">${tete.h}</div>` : ''}<div class="erp-w-titre">${titre}</div>
        ${pastilles.length ? `<div class="erp-w-etats">${pastilles.filter((x) => !vide_(x.h) || /erp-nat/.test(x.h)).map((x) => x.h).join('')}</div>` : ''}</div></div>
      ${visuel ? visuel(o) : ''}
      ${infos.length ? `<dl class="erp-w-infos">${infos.map((x) => `<div><dt>${esc(x.c.t)}</dt><dd>${x.h}</dd></div>`).join('')}</dl>` : ''}
      ${montants.length ? `<div class="erp-w-pied">${montants.map((x) => `<div><small>${esc(x.c.t)}</small><b>${x.h}</b></div>`).join('')}</div>` : ''}
    </div>`;
  };
  // Visuel « studio » des produits d'un document (devis, commande, facture, achat), 18 nov. 2026 (demande : « un visuel des
  // produits avant de cliquer, comme la voiture dans FM'PAREBRISE ») : le produit principal (plus gros montant) en grand au
  // centre, deux autres derrière en éventail, ombres ; « +N » s'il y en a plus ; nombre d'articles. Sans photo : icône de famille.
  U.visuelDoc = (db, doc, mini) => {
    const parProduit = new Map();
    (doc.lignes || []).forEach((l) => { const p = l.produit && D.produit(db, l.produit); if (!p) return; const x = parProduit.get(p.id) || { p, qte: 0, ht: 0 }; x.qte += +l.qte || 0; x.ht += D.htLigne(l); parProduit.set(p.id, x); });
    const l = [...parProduit.values()].sort((a, b) => (!!b.p.image - !!a.p.image) || b.ht - a.ht); // avec photo d’abord, puis plus gros montant
    const libres = (doc.lignes || []).filter((x) => !x.produit || !D.produit(db, x.produit)).length;
    if (!l.length && !libres) return '';
    const pieces = (doc.lignes || []).reduce((t, x) => t + (+x.qte || 0), 0);
    const montre = l.slice(0, 3); const ordre = [1, 0, 2].filter((i) => montre[i]);
    const objet = (x, rang) => `<span class="erp-studio-obj r${rang}" title="${esc(x.p.ref + ' — ' + x.p.libelle)}">${x.p.image ? `<img src="${esc(x.p.image)}" alt="" loading="lazy">` : U.vignetteProduit(x.p, mini ? 40 : 56)}</span>`;
    const reste = l.length - montre.length + libres;
    return `<div class="erp-studio${mini ? ' mini' : ''}"><figure class="erp-studio-scene n${montre.length}">${ordre.map((i) => objet(montre[i], i)).join('')}${!montre.length ? `<span class="erp-studio-obj r0">${U.ico('liste')}</span>` : ''}${reste > 0 ? `<em class="erp-studio-plus">+${reste}</em>` : ''}</figure>
      <div class="erp-studio-txt"><b>${esc(montre[0] ? montre[0].p.libelle : 'Lignes libres')}</b><small>${l.length + libres} article${l.length + libres > 1 ? 's' : ''} · ${D.nombre(pieces)} pièce${pieces > 1 ? 's' : ''}</small></div></div>`;
  };
  // Vue Tableau des documents : petite pile des photos des produits (3 au plus, avec photo d'abord, puis plus gros montant).
  U.miniDoc = (db, doc) => {
    const parProduit = new Map();
    (doc.lignes || []).forEach((l) => { const p = l.produit && D.produit(db, l.produit); if (!p) return; const x = parProduit.get(p.id) || { p, ht: 0 }; x.ht += D.htLigne(l); parProduit.set(p.id, x); });
    const l = [...parProduit.values()].sort((a, b) => (!!b.p.image - !!a.p.image) || b.ht - a.ht);
    if (!l.length) return '<span class="erp-gris">—</span>';
    return `<span class="erp-pile" title="${esc(l.map((x) => x.p.ref).join(', '))}">${l.slice(0, 3).map((x) => U.vignetteProduit(x.p, 36)).join('')}${l.length > 3 ? `<em>+${l.length - 3}</em>` : ''}</span>`;
  };
  // Clavier : Entrée ou Espace sur une carte = l'ouvrir (comme un clic).
  document.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('erp-w') && e.target.dataset.aller) { e.preventDefault(); e.target.click(); } });
  U.cartes = (cols, lignes, lien, mini, visuel) => `<div class="erp-cartes${mini ? ' mini' : ''}${visuel ? ' avec-visuel' : ''}">${lignes.map((o, i) => U.carte(cols, o, lien ? lien(o) : '', mini, visuel).replace('<div class="erp-w', `<div style="--i:${Math.min(i, 14)}" class="erp-w`)).join('')}</div>`;
  // Choix Cartes / Tableau, mémorisé sur ce PC pour chaque liste (cle = titres des colonnes).
  const CLE_VUES = 'fmd-vue-listes';
  const vues = () => { try { return JSON.parse(localStorage.getItem(CLE_VUES) || '{}') || {}; } catch { return {}; } };
  U.vueListe = (cle) => vues()[cle] || 'cartes';
  U.choisirVue = (cle, v) => { const x = vues(); x[cle] = v; try { localStorage.setItem(CLE_VUES, JSON.stringify(x)); } catch { /* ignoré */ } };

  // Petit tableau : cols = [[titre, (o) => html, 'nb'?]]. Avec o.lien (liste de fiches à ouvrir) → cartes widgets ;
  // sans lien (lignes de document, historiques, chiffres) → tableau, plus lisible en colonnes.
  U.table = (cols, lignes, o = {}) => lignes.length && o.lien && o.cartes !== false
    ? U.cartes(cols.filter(Boolean).map((c) => ({ t: c[0], v: c[1], nb: /nb|nombre/.test(c[2] || ''), cls: c[2] || '' })), lignes, o.lien, true, o.visuel)
    : U.tableau(cols, lignes, o);
  U.tableau = (cols, lignes, o = {}) => lignes.length ? `<table class="registre erp-table">${o.tete === false ? '' : `<thead><tr>${cols.map((c) => `<th class="${c[2] || ''}">${esc(c[0])}</th>`).join('')}</tr></thead>`}<tbody>${lignes.map((l) => `<tr${o.lien ? ` class="cliquable" data-aller="${esc(o.lien(l))}"` : ''}>${cols.map((c) => `<td class="${c[2] || ''}">${c[1](l)}</td>`).join('')}</tr>`).join('')}</tbody>${o.pied ? `<tfoot>${o.pied}</tfoot>` : ''}</table>` : U.vide(o.vide);

  // ---------- graphiques ----------
  // Anneau : parts = [{ l, v, c, r (route au clic) }]
  U.donut = (parts, centre, sous, o = {}) => {
    const tot = parts.reduce((s, p) => s + p.v, 0); const R = 52, C = 2 * Math.PI * R; let acc = 0;
    const arcs = tot ? parts.filter((p) => p.v > 0).map((p) => { const len = (p.v / tot) * C; const gap = parts.filter((x) => x.v > 0).length > 1 ? Math.min(2, len / 3) : 0;
      const s = `<circle r="${R}" cx="70" cy="70" fill="none" stroke="${p.c}" stroke-width="18" stroke-dasharray="${Math.max(0, len - gap)} ${C}" stroke-dashoffset="${-acc}" transform="rotate(-90 70 70)"${p.r ? ` data-aller="${esc(p.r)}" class="erp-arc"` : ''}><title>${esc(p.l)} : ${esc(o.fmt ? o.fmt(p.v) : p.v)}</title></circle>`; acc += len; return s; }).join('')
      : `<circle r="${R}" cx="70" cy="70" fill="none" stroke="var(--ligne)" stroke-width="18"/>`;
    const leg = parts.map((p) => `<li${p.r ? ` data-aller="${esc(p.r)}" class="cliquable"` : ''}><i style="background:${p.c}"></i><span>${esc(p.l)}</span><b>${esc(o.fmt ? o.fmt(p.v) : p.v)}</b><em>${tot ? Math.round((p.v / tot) * 100) : 0} %</em></li>`).join('');
    return `<div class="erp-donut"><svg viewBox="0 0 140 140" role="img" aria-label="${esc(sous)}">${arcs}<text x="70" y="68" text-anchor="middle" class="erp-donut-v">${esc(centre)}</text><text x="70" y="86" text-anchor="middle" class="erp-donut-s">${esc(sous)}</text></svg><ul>${leg}</ul></div>`;
  };
  // Barres par mois : vals = 12 nombres ; fmt pour l'étiquette.
  U.barres = (vals, fmt = (n) => n, o = {}) => {
    const max = Math.max(1, ...vals); const cours = o.cours ?? -1;
    const lib = o.libelles || U.MOIS; const dense = vals.length > 14;
    return `<div class="erp-barres${dense ? ' dense' : ''}">${vals.map((v, i) => `<div class="erp-barre${i === cours ? ' cours' : ''}" title="${esc(lib[i])} : ${esc(fmt(v))}"><span>${v && !dense ? esc(fmt(v)) : ''}</span><i style="height:${v ? Math.max(2, Math.round((v / max) * 100)) : 0}%"></i><em>${!dense || i % 5 === 0 || i === vals.length - 1 ? esc(lib[i]) : ''}</em></div>`).join('')}</div>`;
  };
  U.court = (n) => (n >= 1000 ? `${D.nombre(Math.round(n / 100) / 10)} k€` : `${Math.round(n)} €`);

  // ---------- liste interactive (recherche, filtre d'état, pagination 20 par page, total) ----------
  // cfg : { cols: [{ t, v(o), nb, txt(o) (texte pour la recherche) }], lignes, lien(o), etats: [[id, libellé]], etat, filtre(o, etat), total(lignes) → html, vide }
  // Ligne « Total » d'une liste affichée en cartes : les cellules du pied de tableau deviennent des pastilles « titre : valeur ».
  const totalCartes = (cols, tds) => {
    const t = document.createElement('table'); t.innerHTML = '<tbody><tr>' + tds + '</tr></tbody>';
    let i = 0; const out = [];
    t.querySelectorAll('td').forEach((td) => { const n = +td.getAttribute('colspan') || 1; const txt = td.textContent.trim(); if (txt && !/^total$/i.test(txt) && n === 1 && cols[i]) out.push(`<div><small>${esc(cols[i].t)}</small><b>${esc(txt)}</b></div>`); i += n; });
    return out.length ? `<div class="erp-w-total"><span>Total de la liste</span>${out.join('')}</div>` : '';
  };
  U.liste = (el, cfg) => {
    let q = cfg.q || '', page = 0, etat = cfg.etat || '';
    // Nombre de lignes par page au choix (21 nov. 2026, demande : « dans l'affichage des produits, choisir le nombre de produits
    // à afficher par page ») : 20, 50, 100 ou 200, mémorisé sur ce PC pour chaque liste.
    const CHOIX_PAGE = [20, 50, 100, 200];
    const cleParPage = 'fmd-par-page:' + (cfg.cle || cfg.cols.map((c) => c.t).join('|'));
    let parPage = (() => { try { const n = +localStorage.getItem(cleParPage); return CHOIX_PAGE.includes(n) ? n : 20; } catch { return 20; } })();
    const cleVue = cfg.cle || cfg.cols.map((c) => c.t).join('|');
    let vue = U.vueListe(cleVue);
    const dessiner = () => {
      const txt = (o) => cfg.cols.map((c) => (c.txt ? c.txt(o) : '')).join(' ').toLowerCase();
      let l = cfg.lignes;
      if (etat && cfg.filtre) l = l.filter((o) => cfg.filtre(o, etat));
      if (q) { const m = q.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); l = l.filter((o) => txt(o).normalize('NFD').replace(/[̀-ͯ]/g, '').includes(m)); }
      const pages = Math.max(1, Math.ceil(l.length / parPage)); if (page >= pages) page = pages - 1;
      const morceau = l.slice(page * parPage, page * parPage + parPage);
      const corps = el.querySelector('[data-l-corps]');
      corps.classList.toggle('erp-carte-table', vue !== 'cartes');
      el.querySelectorAll('[data-l-vue]').forEach((b) => { b.classList.toggle('actif', b.dataset.lVue === vue); b.setAttribute('aria-pressed', b.dataset.lVue === vue); });
      if (vue === 'cartes') { corps.innerHTML = morceau.length ? U.cartes(cfg.cols, morceau, cfg.lien, false, cfg.visuel) + (cfg.total ? totalCartes(cfg.cols, cfg.total(l)) : '') : U.vide(cfg.vide || 'Aucun résultat'); }
      else corps.innerHTML = morceau.length ? `<table class="registre erp-table erp-liste"><thead><tr>${cfg.miniature ? '<th class="erp-col-img">Produits</th>' : ''}${cfg.cols.map((c) => `<th class="${c.nb ? 'nb' : ''}">${esc(c.t)}</th>`).join('')}</tr></thead><tbody>${morceau.map((o) => `<tr class="cliquable" data-aller="${esc(cfg.lien(o))}">${cfg.miniature ? `<td class="erp-col-img">${cfg.miniature(o)}</td>` : ''}${cfg.cols.map((c) => `<td class="${c.nb ? 'nb' : ''}${c.cls ? ' ' + c.cls : ''}">${c.v(o)}</td>`).join('')}</tr>`).join('')}</tbody>${cfg.total ? `<tfoot><tr>${cfg.miniature ? '<td></td>' : ''}${cfg.total(l)}</tr></tfoot>` : ''}</table>` : U.vide(cfg.vide || 'Aucun résultat');
      el.querySelector('[data-l-nb]').textContent = l.length;
      el.querySelector('[data-l-pages]').innerHTML = pages > 1 ? `<button type="button" class="btn-icone" data-l-p="-1" ${page ? '' : 'disabled'} aria-label="Page précédente">‹</button><span>${page + 1} / ${pages}</span><button type="button" class="btn-icone" data-l-p="1" ${page < pages - 1 ? '' : 'disabled'} aria-label="Page suivante">›</button>` : '';
      el.querySelectorAll('[data-l-etat]').forEach((b) => b.classList.toggle('actif', b.dataset.lEtat === etat));
    };
    el.innerHTML = `<div class="erp-liste-outils"><input type="search" class="erp-recherche" placeholder="Rechercher dans la liste…" data-l-q aria-label="Rechercher dans la liste" value="${esc(q)}">
      ${cfg.etats ? `<div class="erp-puces"><button type="button" data-l-etat="">Tous</button>${cfg.etats.map(([id, lib]) => `<button type="button" data-l-etat="${esc(id)}">${esc(lib)}</button>`).join('')}</div>` : ''}
      ${cfg.outils || ''}<span class="erp-gris"><b data-l-nb></b> résultat(s)</span><label class="erp-par-page">Afficher <select data-l-par-page aria-label="Nombre de lignes par page" data-sans-recherche>${CHOIX_PAGE.map((n) => `<option value="${n}"${n === parPage ? ' selected' : ''}>${n}</option>`).join('')}</select> par page</label><div class="erp-pages" data-l-pages></div>
      <div class="erp-vues" role="group" aria-label="Affichage de la liste"><button type="button" data-l-vue="cartes" title="Afficher en cartes">${U.ico('grille')}Cartes</button><button type="button" data-l-vue="tableau" title="Afficher en tableau">${U.ico('liste')}Tableau</button></div></div><div data-l-corps></div>`;
    el.querySelector('[data-l-q]').addEventListener('input', (e) => { q = e.target.value.trim(); page = 0; dessiner(); });
    el.querySelectorAll('[data-l-etat]').forEach((b) => b.addEventListener('click', () => { etat = b.dataset.lEtat; page = 0; dessiner(); }));
    el.querySelectorAll('[data-l-vue]').forEach((b) => b.addEventListener('click', () => { vue = b.dataset.lVue; U.choisirVue(cleVue, vue); dessiner(); }));
    el.querySelector('[data-l-pages]').addEventListener('click', (e) => { const b = e.target.closest('[data-l-p]'); if (b) { page += +b.dataset.lP; dessiner(); } });
    el.querySelector('[data-l-par-page]').addEventListener('change', (e) => { const premier = page * parPage; parPage = +e.target.value || 20; page = Math.floor(premier / parPage);
      try { localStorage.setItem(cleParPage, String(parPage)); } catch { /* reste pour cette fois */ } dessiner(); });
    dessiner();
    return { redessiner: (lignes) => { if (lignes) cfg.lignes = lignes; dessiner(); } };
  };

  // ---------- formulaires (ligne « libellé | champ » comme Dolibarr) ----------
  U.inp = (nom, val = '', o = {}) => `<input name="${nom}" type="${o.type || 'text'}" value="${esc(val)}"${o.ph ? ` placeholder="${esc(o.ph)}"` : ''}${o.req ? ' required' : ''}${o.step ? ` step="${o.step}"` : ''}${o.min != null ? ` min="${o.min}"` : ''}${o.list ? ` list="${o.list}"` : ''}${o.cls ? ` class="${o.cls}"` : ''}${o.lecture ? ' readonly' : ''}>`;
  U.sel = (nom, opts, val = '', o = {}) => `<select name="${nom}"${o.req ? ' required' : ''}>${o.vide != null ? `<option value="">${esc(o.vide)}</option>` : ''}${opts.map((x) => { const [v, l] = Array.isArray(x) ? x : [x, x]; return `<option value="${esc(v)}"${String(v) === String(val) ? ' selected' : ''}>${esc(l)}</option>`; }).join('')}</select>`;
  U.area = (nom, val = '', rows = 3) => `<textarea name="${nom}" rows="${rows}">${esc(val)}</textarea>`;
  U.coche = (nom, val, lib) => `<label class="erp-coche"><input type="checkbox" name="${nom}"${val ? ' checked' : ''}> ${esc(lib)}</label>`;
  U.ligne = (lib, champ, o = {}) => `<div class="erp-ligne-f${o.large ? ' large' : ''}"><label class="${o.req ? 'req' : ''}">${esc(lib)}</label><div>${champ}${o.aide ? `<small class="erp-gris">${esc(o.aide)}</small>` : ''}</div></div>`;
  U.form = (id, corps, pied) => `<form id="${id}" class="erp-form" autocomplete="off"><div class="erp-form-corps">${corps}</div><div class="erp-form-pied">${pied}</div></form>`;
  U.lire = (form) => { const o = {}; new FormData(form).forEach((v, k) => { o[k] = typeof v === 'string' ? v.trim() : v; }); form.querySelectorAll('input[type=checkbox]').forEach((c) => { o[c.name] = c.checked; }); return o; };
  // Avancement façon FM'RENOV (pastilles reliées) : n étapes faites, la suivante en cours.
  U.avancement = (n, libelles) => `<ol class="erp-avance" aria-label="Avancement : ${n} sur ${libelles.length}">${libelles.map((e, i) => `<li class="${i < n ? 'fait' : ''}${i === n ? ' actif' : ''}"><i></i><span>${esc(e)}</span></li>`).join('')}</ol>`;
  U.etapes = (n, total, libelles) => `<ol class="erp-etapes">${libelles.map((l, i) => `<li class="${i + 1 === n ? 'actif' : i + 1 < n ? 'fait' : ''}"><b>${i + 1}</b>${esc(l)}</li>`).join('')}</ol>`;

  // ---------- fiche (en-tête + onglets) ----------
  // cfg : { ico, titre, sous (html), pastilles (html), retour, prec, suiv, onglets: [[id, libellé, compte]], actif, base }
  const ICO_ONGLET = { tiers: 'tiers', contacts: 'contacts', client: 'client', fournisseur: 'camion', prix: 'tag', reglement: 'banque', notes: 'note', evenements: 'temps', produit: 'produit', vente: 'tag', achat: 'camion', stock: 'stock', stats: 'stats', fiche: 'commerce', site: 'web' };
  U.fiche = (cfg) => `<div class="erp-onglets" role="tablist">${cfg.onglets.map(([id, l, n]) => `<button type="button" role="tab" class="${id === cfg.actif ? 'actif' : ''}" data-aller="${esc(cfg.base + '/' + id)}">${U.ico(ICO_ONGLET[id] || 'liste')}${esc(l)}${n ? ` <span class="erp-compte">${n}</span>` : ''}</button>`).join('')}</div>
    <div class="erp-entete-fiche"><div class="erp-vignette${cfg.logo ? ' avec-logo' : ''}"${cfg.vignetteAct ? ` role="button" tabindex="0" title="Changer le logo" data-act="${cfg.vignetteAct}"` : ''}>${String(cfg.ico).startsWith('<') ? cfg.ico : U.ico(cfg.ico)}${cfg.badge ? `<span class="erp-vignette-badge">${U.ico(cfg.badge)}</span>` : ''}</div><div class="erp-entete-txt"><h1>${cfg.titre}</h1>${cfg.sous || ''}</div>
      <div class="erp-entete-d"><div class="erp-nav-fiche">${U.lien(cfg.retour, `${U.ico('retour')} Retour liste`, 'fort')}${cfg.prec ? U.lien(cfg.prec, '‹', 'fleche') : '<span class="erp-gris">‹</span>'}${cfg.suiv ? U.lien(cfg.suiv, '›', 'fleche') : '<span class="erp-gris">›</span>'}</div><div>${cfg.pastilles || ''}</div></div></div>`;
  U.voisins = (liste, id, route) => { const i = liste.findIndex((o) => o.id === id); return { prec: i > 0 ? route(liste[i - 1]) : '', suiv: i >= 0 && i < liste.length - 1 ? route(liste[i + 1]) : '' }; };

  // Les N derniers événements (table) et la chronologie complète (groupée par jour).
  U.derniersEvt = (evts, n = 10) => U.table([['Date', (e) => `${D.jour(e.d)} <span class="erp-gris">${D.heure(e.d)}</span>`], ['Par', (e) => esc(e.par)], ['Titre', (e) => esc(e.titre)]], evts.slice(0, n), { vide: 'Aucun événement' });
  U.chronologie = (evts) => {
    if (!evts.length) return U.vide('Aucun événement');
    let j = ''; return `<div class="erp-chrono">${evts.map((e) => { const jj = D.jour(e.d); const t = jj !== j ? `<div class="erp-chrono-jour">${new Date(String(e.d).slice(0, 10) + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</div>` : ''; j = jj;
      return `${t}<article class="erp-evt"><div><b>${esc(e.par)}</b> ${esc(e.titre)}${e.texte ? `<details><summary>Lire plus</summary><pre>${esc(e.texte)}</pre></details>` : ''}</div><span class="erp-gris">${D.jour(e.d)} ${D.heure(e.d)}</span></article>`; }).join('')}</div>`;
  };

  // ---------- statistiques par mois (propositions, commandes, factures, achats) ----------
  // docs = liste, champ date ; filtres : tiers, état, année.
  U.statsParMois = (docs, an) => {
    const m = Array.from({ length: 12 }, () => ({ n: 0, mt: 0 }));
    docs.filter((d) => d.date.startsWith(String(an))).forEach((d) => { const i = +d.date.slice(5, 7) - 1; m[i].n++; m[i].mt += D.ht(d); });
    return m.map((x) => ({ ...x, moy: x.n ? x.mt / x.n : 0 }));
  };
  // ---------- période des graphiques (10 nov. 2026 : « à chaque graphique, choisir le jour, la semaine, le mois, l'année ») ----------
  // Un sélecteur par page (clé = page) : Jour / Semaine / Mois / Année / Tout, flèches ‹ ›, date au choix, « Aujourd'hui ».
  // Mémorisé sur le PC (localStorage « fmd-crm-periodes »). Les clics sont gérés par js/crm.js (data-periode-*).
  const MODES = [['jour', 'Jour'], ['semaine', 'Semaine'], ['mois', 'Mois'], ['annee', 'Année'], ['tout', 'Tout']];
  let PER = {}; try { PER = JSON.parse(localStorage.getItem('fmd-crm-periodes') || '{}') || {}; } catch { PER = {}; }
  U.periode = (cle, defaut = 'annee') => PER[cle] || { mode: defaut, ref: D.auj() };
  U.changerPeriode = (cle, defaut, o) => {
    const st = { ...U.periode(cle, defaut) };
    if (o.mode) st.mode = o.mode;
    if (o.date) st.ref = o.date;
    if (o.nav === 0) st.ref = D.auj();
    else if (o.nav) { const x = new Date(st.ref + 'T12:00:00');
      if (st.mode === 'jour') x.setDate(x.getDate() + o.nav); else if (st.mode === 'semaine') x.setDate(x.getDate() + 7 * o.nav);
      else if (st.mode === 'mois') { x.setDate(1); x.setMonth(x.getMonth() + o.nav); } else if (st.mode === 'annee') x.setFullYear(x.getFullYear() + o.nav);
      st.ref = D.iso(x); }
    PER[cle] = st; try { localStorage.setItem('fmd-crm-periodes', JSON.stringify(PER)); } catch { /* ignoré */ }
  };
  const lundi = (d) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return D.iso(x); };
  const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  const longue = (d, o) => new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', o);
  // Bornes d'une période + découpage en barres (heures, jours, mois ou années).
  U.bornes = (st, ans = []) => {
    const ref = st.ref || D.auj(); const [y, m] = ref.split('-').map(Number); const auj = D.auj();
    let debut, fin, unites, lib, unite;
    if (st.mode === 'jour') { debut = fin = ref; unite = 'heure'; unites = Array.from({ length: 13 }, (_, i) => ({ l: `${i + 7} h`, h: i + 7 })); lib = longue(ref, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }
    else if (st.mode === 'semaine') { debut = lundi(ref); fin = D.ajout(debut, 6); unite = 'jour'; unites = JOURS.map((j, i) => { const d = D.ajout(debut, i); return { l: `${j} ${+d.slice(8)}`, d }; }); lib = `Semaine du ${longue(debut, { day: 'numeric', month: 'short' })} au ${longue(fin, { day: 'numeric', month: 'short', year: 'numeric' })}`; }
    else if (st.mode === 'mois') { debut = `${y}-${String(m).padStart(2, '0')}-01`; const n = new Date(y, m, 0).getDate(); fin = `${y}-${String(m).padStart(2, '0')}-${n}`; unite = 'jour'; unites = Array.from({ length: n }, (_, i) => ({ l: String(i + 1), d: D.ajout(debut, i) })); lib = longue(debut, { month: 'long', year: 'numeric' }); }
    else if (st.mode === 'tout') { const l = [...new Set([...ans, auj.slice(0, 4)])].sort(); debut = '0000-01-01'; fin = '9999-12-31'; unite = 'an'; unites = l.map((a) => ({ l: a, a })); lib = 'Depuis le début'; }
    else { debut = `${y}-01-01`; fin = `${y}-12-31`; unite = 'mois'; unites = U.MOIS.map((l, i) => ({ l, mo: i + 1 })); lib = String(y); }
    const index = (d) => { const j = String(d.date || d).slice(0, 10);
      if (unite === 'heure') { const h = String(d.cree || '').length > 10 ? new Date(d.cree).getHours() : 9; return Math.min(12, Math.max(0, h - 7)); }
      if (unite === 'jour') return unites.findIndex((u) => u.d === j);
      if (unite === 'mois') return +j.slice(5, 7) - 1;
      return unites.findIndex((u) => u.a === j.slice(0, 4)); };
    const cours = unite === 'heure' ? (ref === auj ? new Date().getHours() - 7 : -1) : index(auj);
    return { mode: st.mode, ref, debut, fin, unites, lib, unite, index, cours, dans: (d) => { const j = String(d || '').slice(0, 10); return j >= debut && j <= fin; } };
  };
  // Série par barre : nombre, montant HT, moyenne (documents datés par d.date).
  U.serie = (docs, b, montant = (d) => D.ht(d)) => {
    const s = b.unites.map(() => ({ n: 0, mt: 0 }));
    docs.filter((d) => b.dans(d.date)).forEach((d) => { const i = b.index(d); if (i >= 0 && s[i]) { s[i].n++; s[i].mt += montant(d); } });
    return s.map((x) => ({ ...x, moy: x.n ? x.mt / x.n : 0 }));
  };
  U.barresP = (vals, b, fmt = (n) => n) => U.barres(vals, fmt, { cours: b.cours, libelles: b.unites.map((u) => u.l) });
  U.choixPeriode = (cle, defaut = 'annee') => { const st = U.periode(cle, defaut); const b = U.bornes(st);
    return `<div class="erp-periode" data-periode-cle="${esc(cle)}" data-periode-defaut="${esc(defaut)}"><div class="erp-puces">${MODES.map(([id, l]) => `<button type="button" class="${id === st.mode ? 'actif' : ''}" data-periode-mode="${id}">${l}</button>`).join('')}</div>
      ${st.mode === 'tout' ? '' : `<span class="erp-periode-nav"><button type="button" class="btn-icone" data-periode-nav="-1" aria-label="Période précédente">‹</button><b>${U.ico('temps')} ${esc(b.lib)}</b><button type="button" class="btn-icone" data-periode-nav="1" aria-label="Période suivante">›</button></span>
      <input type="date" value="${esc(st.ref)}" data-periode-date aria-label="Choisir une date"><button type="button" class="erp-lien" data-periode-nav="0">Aujourd’hui</button>`}</div>`; };
  // ---------- Recherche par frappe sur les listes déroulantes (19 nov. 2026) ----------
  // Demande : « quand je veux choisir un produit, un fournisseur ou un client/prospect (ex. prix client sur la fiche client),
  // je veux pouvoir taper son nom au lieu de parcourir toute la liste ; vérifie tout ». Toute liste déroulante de produits /
  // tiers / contacts / modèles / chantiers (nom du champ), ou de plus de 15 choix, reçoit au-dessus un champ « Rechercher… »
  // avec suggestions (photo du produit, logo du tiers) : chaque mot tapé doit se retrouver (accents et tirets ignorés).
  // Automatique partout (MutationObserver sur la page) : rien à ajouter quand on crée un nouvel écran. Exclu : [data-sel-p]
  // (lignes des documents, recherche déjà faite), [data-sans-recherche], listes multiples, petites listes.
  // U.dbCourant : base du CRM (crm.js) pour les vignettes et la recherche par code-barres, ville, SIRET…
  const normC = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const NOMS_C = /produit|tiers|client|fournisseur|contact|modele|chantier|prospect|article|soustraitant/i;
  const TEXTE_C = { produit: 'un produit (réf., nom, code-barres)', tiers: 'un client, prospect ou fournisseur', client: 'un client', fournisseur: 'un fournisseur', contact: 'un contact', modele: 'un produit à variantes', chantier: 'un chantier' };
  U.selectCherchable = (sel) => {
    if (!sel || sel.dataset.cherchable || sel.multiple || sel.matches('[data-sel-p], [data-sans-recherche], .erp-inline')) return;
    const opts = [...sel.options].filter((o) => o.value !== '');
    if (sel.dataset.source !== 'produits' && (opts.length < 8 || (!NOMS_C.test(`${sel.name} ${sel.getAttribute('aria-label') || ''}`) && opts.length < 15))) return;
    sel.dataset.cherchable = '1';
    const cle = Object.keys(TEXTE_C).find((k) => new RegExp(k, 'i').test(sel.name || '')) || '';
    const boite = document.createElement('div'); boite.className = 'erp-sc';
    boite.innerHTML = `<input type="search" class="erp-sc-in" placeholder="Rechercher ${esc(TEXTE_C[cle] || 'dans la liste')}…" aria-label="Rechercher dans la liste" autocomplete="off"><div class="erp-sc-sugg" hidden role="listbox"></div>`;
    sel.before(boite);
    const inp = boite.querySelector('input'); const zone = boite.querySelector('.erp-sc-sugg');
    // Clients / fournisseurs / prospects (20 nov. 2026, demande : « mets juste la barre de recherche des clients, je n'ai pas
    // besoin du déroulant ») : la liste déroulante est cachée (elle garde la valeur du formulaire) ; la barre affiche le
    // tiers choisi, et un clic dessus montre toute la liste.
    const seul = /tiers|client|fournisseur|prospect|soustraitant/i.test(sel.name || '');
    const texteChoisi = () => { const o = sel.selectedOptions[0]; return o && o.value !== '' ? o.textContent.trim() : ''; };
    if (seul) { sel.classList.add('erp-sc-cache'); sel.tabIndex = -1; boite.classList.add('seul'); inp.value = texteChoisi();
      sel.addEventListener('change', () => { if (document.activeElement !== inp) inp.value = texteChoisi(); });
      sel.addEventListener('invalid', () => { inp.focus(); }); }
    document.body.appendChild(zone); zone._proprio = sel; // hors des blocs (leurs animations enferment même une position fixe)
    const db = () => U.dbCourant || null;
    const produitDe = (o) => { const d = db(); return d && Array.isArray(d.produits) ? d.produits.find((x) => x.id === o.value) : null; };
    const tiersDe = (o) => { const d = db(); return d && Array.isArray(d.tiers) ? d.tiers.find((x) => x.id === o.value) : null; };
    const extra = (o) => { const p = produitDe(o); if (p) return `${p.ref} ${p.libelle} ${p.code_barres || ''} ${p.marque || ''} ${p.modele || ''}`;
      const t = tiersDe(o); return t ? `${t.nom} ${t.alt || ''} ${t.code_client || ''} ${t.code_fourn || ''} ${t.ville || ''} ${t.siret || ''}` : ''; };
    const visuel = (o) => { const p = produitDe(o); if (p) return U.vignetteProduit(p, 30); const t = tiersDe(o); return t ? U.avatar(t, 30) : ''; };
    // data-source="produits" (20 nov. 2026, catalogue en base jusqu'à 100 000 produits) : la liste n'affiche qu'une partie du
    // catalogue ; la recherche porte sur TOUS les produits, l'option du produit choisi est créée à la demande.
    let idxCat = null;
    const optionDe = (p) => { let o = [...sel.options].find((y) => y.value === p.id); if (!o) { o = document.createElement('option'); o.value = p.id; o.textContent = `${p.ref} — ${p.libelle || ''}`; sel.append(o); } return o; };
    const index = () => { if (sel.dataset.source === 'produits' && db()) { const l = db().produits || [];
        if (!idxCat || idxCat.n !== l.length) idxCat = { n: l.length, l: l.map((p) => ({ p, n: normC(`${p.ref} ${p.libelle} ${p.code_barres || ''} ${p.marque || ''} ${p.modele || ''}`) })) };
        return idxCat.l.map((x) => ({ p: x.p, n: x.n, get o() { return optionDe(x.p); } })); }
      return [...sel.options].filter((o) => o.value !== '').map((o) => ({ o, n: normC(`${o.textContent} ${extra(o)}`) })); };
    let liste = []; let actif = 0;
    // suggestions au-dessus de tout (les blocs du CRM coupent ce qui dépasse) : position fixe sous le champ, ou au-dessus s'il n'y a pas la place
    const placer = () => { const r = inp.getBoundingClientRect(); const h = Math.min(340, zone.scrollHeight || 340); const dessous = window.innerHeight - r.bottom > h + 12 || r.top < h + 12;
      Object.assign(zone.style, { position: 'fixed', left: r.left + 'px', width: Math.min(window.innerWidth - r.left - 16, Math.max(r.width, 520)) + 'px', right: 'auto', top: dessous ? r.bottom + 4 + 'px' : 'auto', bottom: dessous ? 'auto' : window.innerHeight - r.top + 4 + 'px' }); };
    window.addEventListener('scroll', () => { if (!zone.hidden) placer(); }, true); window.addEventListener('resize', () => { if (!zone.hidden) placer(); });
    const toutMontrer = () => { [...sel.options].forEach((x) => { x.hidden = false; }); };
    const choisir = (o) => { sel.value = o.value; inp.value = seul ? o.textContent.trim() : ''; zone.hidden = true; toutMontrer(); if (seul) inp.blur();
      sel.dispatchEvent(new Event('input', { bubbles: true })); sel.dispatchEvent(new Event('change', { bubbles: true })); };
    const dessiner = () => { zone.innerHTML = liste.length ? liste.slice(0, seul ? 200 : 8).map((x, i) => `<button type="button" class="erp-sc-i${i === actif ? ' actif' : ''}" data-i="${i}" role="option">${x.p ? U.vignetteProduit(x.p, 30) : visuel(x.o)}<span>${esc(x.p ? `${x.p.ref} — ${x.p.libelle || ''}` : x.o.textContent)}</span></button>`).join('') + (liste.length > (seul ? 200 : 8) ? `<p class="erp-gris">… ${liste.length - 8} autre(s) : précisez</p>` : '')
      : `<p class="erp-gris">Aucun résultat pour « ${esc(inp.value)} ».</p>`; };
    inp.addEventListener('input', () => { const mots = normC(inp.value).split(' ').filter(Boolean); const tout = index();
      liste = mots.length ? tout.filter((x) => mots.every((m) => x.n.includes(m))) : []; actif = 0;
      if (sel.dataset.source !== 'produits') [...sel.options].forEach((o) => { o.hidden = mots.length > 0 && o.value !== '' && !liste.some((x) => x.o === o); });
      zone.hidden = !mots.length; if (mots.length) { dessiner(); placer(); } });
    inp.addEventListener('keydown', (e) => { if (zone.hidden) { if (e.key === 'Enter') e.preventDefault(); return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); actif = Math.max(0, Math.min(Math.min(liste.length, 8) - 1, actif + (e.key === 'ArrowDown' ? 1 : -1))); dessiner(); }
      else if (e.key === 'Enter') { e.preventDefault(); if (liste[actif]) choisir(liste[actif].o); }
      else if (e.key === 'Escape') { e.stopPropagation(); zone.hidden = true; } });
    zone.addEventListener('mousedown', (e) => { const b = e.target.closest('[data-i]'); if (!b) return; e.preventDefault(); choisir(liste[+b.dataset.i].o); });
    inp.addEventListener('blur', () => setTimeout(() => { zone.hidden = true; if (seul) { inp.value = texteChoisi(); toutMontrer(); } }, 150));
    if (seul) { // clic ou tabulation dans la barre : toute la liste, le texte sélectionné pour retaper par-dessus
      const ouvrir = () => { liste = index(); actif = Math.max(0, liste.findIndex((x) => x.o.value === sel.value)); zone.hidden = false; dessiner(); placer(); };
      inp.addEventListener('focus', () => { inp.select(); ouvrir(); });
      inp.addEventListener('input', () => { if (!inp.value.trim()) ouvrir(); }); }
  };
  U.selectsCherchables = (racine) => { document.querySelectorAll('body > .erp-sc-sugg').forEach((z) => { if (z._proprio && !z._proprio.isConnected) z.remove(); }); (racine || document).querySelectorAll('select:not([data-cherchable])').forEach((s) => { try { U.selectCherchable(s); } catch (e) { console.error(e); } }); };
  // automatique sur toute la page (CRM, fenêtres, FM'RENOV, Paramètres…)
  if (typeof MutationObserver !== 'undefined' && typeof document !== 'undefined') {
    let prevu = false; const lancer = () => { prevu = false; U.selectsCherchables(document); };
    const go = () => { new MutationObserver(() => { if (!prevu) { prevu = true; requestAnimationFrame(lancer); } }).observe(document.body, { childList: true, subtree: true }); lancer(); };
    if (document.body) go(); else document.addEventListener('DOMContentLoaded', go);
  }
})();
