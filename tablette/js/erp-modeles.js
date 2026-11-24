// FMD — CRM : « Produits à variantes » (11 nov. 2026). Demande de l'utilisateur : un article comme le T-shirt Print Payper
// existe en beaucoup de couleurs et de tailles, chaque variante a sa propre référence ; au lieu de créer les fiches une par
// une, on crée le produit une fois puis on remplit un TABLEAU (couleur, taille, référence, code EAN, prix d'achat, prix de
// vente, stock). Trois façons de remplir : « Générer » (couleurs × tailles cochées), « Coller depuis Excel », « + Ligne ».
// Chaque ligne enregistrée devient un vrai produit (db.produits, p.modele_id) : devis, commandes, stock, réappro et site web
// fonctionnent sans rien changer. Ce qui est commun (fournisseur, catégorie, description, TVA, site web, images) est réglé
// dans le modèle et recopié sur les variantes (D.appliquerModele, js/erp-donnees.js). Images : lien ou fichier (une par couleur).
// Routes : modeles (liste), modeles/nouveau, modeles/modifier/<id>, modeles/fiche/<id>.
(function () {
  'use strict';
  const D = (window.FMDERP = window.FMDERP || {});
  const P = (D.pages = D.pages || {});
  const U = D.ui;
  const esc = U.esc;

  const sansAccent = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
  // Abréviation d'une couleur pour la référence proposée : « Noir » → NOI, « Bleu marine » → BM.
  const abrege = (c) => { const m = sansAccent(c).toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim().split(' ').filter(Boolean); return !m.length ? '' : m.length === 1 ? m[0].slice(0, 3) : m.map((w) => w[0]).join('').slice(0, 4); };
  const nombre = (x) => { const t = String(x ?? '').replace(/\s|€/g, '').replace(',', '.'); if (t === '') return null; const n = parseFloat(t); return Number.isFinite(n) ? n : null; };
  const niveaux = (pu) => [pu, D.arrondi(pu * 0.92), D.arrondi(pu * 0.88), D.arrondi(pu * 0.82)];
  const majuscule = (c) => { const t = String(c || '').trim(); return t ? t[0].toUpperCase() + t.slice(1) : ''; };
  const TVA = [['20', '20 %'], ['10', '10 %'], ['5.5', '5,5 %'], ['0', '0 %']];
  const fournisseurs = (db) => [...new Set([...db.tiers.filter((t) => t.fournisseur).map((t) => t.nom), ...db.produits.map((p) => p.marque)].filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const enDocuments = (db, id) => [db.propositions, db.commandes, db.factures, db.achats].some((l) => l.some((d) => d.lignes.some((x) => x.produit === id)));
  const variantesDe = (db, m) => db.produits.filter((p) => p.modele_id === m.id).sort((a, b) => String(a.couleur || '').localeCompare(String(b.couleur || '')) || D.ordreTaille(a.taille) - D.ordreTaille(b.taille)
    || (m.axes || []).reduce((r, ax) => r || D.valeurAxe(a, ax).localeCompare(D.valeurAxe(b, ax), 'fr', { numeric: true }), 0));
  // Clé d'une variante (toutes ses caractéristiques) : deux variantes ne peuvent pas avoir la même.
  const cleVar = (m, x) => D.axesModele(m).map((ax) => String(ax === 'Couleur' ? majuscule(x.couleur) : ax === 'Taille' ? String(x.taille || '').toUpperCase() : (x.a || x.attributs || {})[ax] || '').trim().toUpperCase()).join('|');
  // « Diamètre, Longueur » → ['Diamètre', 'Longueur'] (Couleur et Taille existent toujours, on ne les répète pas).
  const lireAxes = (t) => [...new Set(String(t || '').split(/[,;\n]/).map((x) => majuscule(x.trim())).filter((x) => x && !/^(couleur|taille)$/i.test(x)))];

  // Nouvelles lignes en cours de saisie (gardées tant qu'on reste sur le même modèle, même après « Générer » ou « Coller »).
  let edition = null; // { mid, lignes: [{ couleur, taille, ref, ean, pa, pv, stock }], modifie }

  P.modeles = (v, a) => {
    const [vue, id] = a;
    if (!vue || vue === 'liste') { setTimeout(() => v.aller('produits/liste'), 0); return { html: '' }; } // liste unique : Catalogue › Produits › Liste
    if (vue === 'nouveau') return formulaire(v, null);
    if (vue === 'modifier') return formulaire(v, D.modele(v.db, id));
    if (vue === 'fiche') return fiche(v, D.modele(v.db, id));
    return liste(v);
  };

  // ---------- liste ----------
  function liste(v) {
    const db = v.db; const ms = [...(db.modeles || [])].sort((a, b) => a.nom.localeCompare(b.nom));
    const lignes = ms.map((m) => { const vs = variantesDe(db, m); return { m, vs, couleurs: [...new Set(vs.map((p) => p.couleur).filter(Boolean))], tailles: [...new Set(vs.map((p) => p.taille).filter(Boolean))].sort((x, y) => D.ordreTaille(x) - D.ordreTaille(y)) }; });
    return { html: `${U.titrePage('◇', 'Produits à variantes', ms.length, U.btn('+ Nouveau produit à variantes', '', 'btn-metal', 'data-aller="modeles/nouveau"'))}
      <p class="erp-gris">Un article décliné en couleurs et en tailles (ex. T-shirt Print Payper) : un seul écran pour toutes ses références. Sur le site, une seule page avec le choix de la couleur et de la taille.</p>
      ${U.bloc('Produits à variantes', U.table([
        ['', (x) => U.vignetteProduit({ ...x.vs[0], image: x.m.image || Object.values(x.m.images || {})[0] || '' }, 40)],
        ['Produit', (x) => `${U.lien(`modeles/fiche/${x.m.id}`, `<b>${esc(x.m.nom)}</b>`)}`], ['Fournisseur', (x) => esc(x.m.marque)], ['Catégorie', (x) => esc(D.categorie(x.m.categorie))],
        ['Couleurs', (x) => `<span class="erp-couleurs">${x.couleurs.map((c) => `<i title="${esc(c)}" style="background:${D.teinte(c) || 'transparent'}"></i>`).join('')}</span> ${x.couleurs.length || ''}`],
        ['Tailles', (x) => esc(x.tailles.length > 1 ? `${x.tailles[0]} → ${x.tailles[x.tailles.length - 1]}` : x.tailles[0] || '—')], ['Variantes', (x) => String(x.vs.length), 'nb'], ['Stock total', (x) => D.nombre(x.vs.reduce((s, p) => s + (p.stock || 0), 0)), 'nb'],
      ], lignes, { vide: 'Aucun produit à variantes pour l’instant' }), { compte: ms.length })}` };
  }

  // ---------- créer / modifier le modèle (partie commune) ----------
  function formulaire(v, m) {
    const db = v.db; const neuf = !m;
    const b = m || { nom: '', ref_base: '', marque: '', categorie: 'vetements', description: '', tva: 20, pv: '', pa: '', en_vente: true, en_achat: true, web_publie: true, web_rayon: '', image: '', axes: [], galerie: [], certifs: [] };
    const optsGab = [['', 'Aucun (je saisis les caractéristiques moi-même)'], ...(D.GABARITS || []).map((g) => [g.id, `${g.groupe} — ${g.nom}`])];
    const corps = `${U.ligne('Type de produit (gabarit)', U.sel('gabarit', optsGab, b.gabarit || ''), { aide: 'Choisissez le type (vêtements, vis à bois, vis placo, vis autoperceuse…) : la catégorie et les caractéristiques se remplissent, et « Générer » proposera toutes les dimensions qui existent, à cocher.' })}
      ${U.ligne('Nom commun (sans les caractéristiques des variantes)', U.inp('nom', b.nom, { req: true, ph: 'Ex. : T-shirt Print Payper, HECO-TOPIX-plus tête fraisée' }), { req: true, aide: 'Le nom affiché sur le site. Couleur, taille et autres caractéristiques se mettent à l’étape suivante : chaque variante s’appellera « Nom Couleur Taille Diamètre… ».' })}
      ${U.ligne('Début des références des variantes', U.inp('ref_base', b.ref_base, { ph: 'Ex. : TS-PRINT' }), { aide: 'Facultatif : sert seulement à proposer les références des variantes (ex. TS-PRINT-NOI-M) quand vous cliquez sur « Générer ».' })}
      <div class="erp-2f">${U.ligne('Fournisseur', U.sel('fournisseur', db.tiers.filter((x) => x.fournisseur).sort((a, z) => String(a.nom).localeCompare(String(z.nom))).map((x) => [x.id, x.nom]), b.fournisseur || '', { req: true, vide: 'Sélectionner un fournisseur' }), { req: true, aide: 'Obligatoire (21 nov. 2026) : toutes les variantes sont proposées dans les commandes de ce fournisseur.' })}${U.ligne('Marque', `${U.inp('marque', b.marque, { list: 'erp-fourn-m', ph: 'Ex. : Payper' })}<datalist id="erp-fourn-m">${fournisseurs(db).map((x) => `<option value="${esc(x)}">`).join('')}</datalist>`)}</div>
      ${D.champsCategorie(b)}
      <div class="erp-2f">${U.ligne('État (Vente)', U.sel('en_vente', [['1', 'En vente'], ['', 'Hors vente']], b.en_vente !== false ? '1' : ''))}${U.ligne('État (Achat)', U.sel('en_achat', [['1', 'En achat'], ['', 'Hors achat']], b.en_achat !== false ? '1' : ''))}</div>
      <div class="erp-2f">${U.ligne('Prix de vente HT par défaut', U.inp('pv', b.pv, { type: 'number', step: '0.01', min: 0 }), { aide: 'Proposé pour chaque nouvelle variante.' })}${U.ligne('Prix d’achat HT par défaut', U.inp('pa', b.pa, { type: 'number', step: '0.01', min: 0 }), { aide: 'Le prix d’achat de chaque variante est obligatoire.' })}</div>
      ${U.ligne('TVA', `<span class="erp-gris">${D.TEXTE_TVA}</span>`)}
      ${U.ligne('Autres caractéristiques des variantes', U.inp('axes', (b.axes || []).join(', '), { ph: 'Ex. : Diamètre, Longueur, Empreinte, Matériau, Quantité par boîte' }), { aide: 'Facultatif, en plus de Couleur et Taille (laissées vides si inutiles). Une colonne par caractéristique dans le tableau des variantes ; sur le site, un choix par caractéristique.' })}
      ${U.ligne('Description (« Caractéristiques du produit » sur le site)', U.area('description', b.description, 4), { large: true })}
      ${U.ligne('Image par défaut', `<div class="erp-img-ligne"><span data-img-apercu>${U.vignetteProduit({ categorie: b.categorie, image: b.image }, 56)}</span>${U.btn(b.image ? 'Changer l’image' : 'Ajouter une image', 'img-pop', 'btn-ligne')}<input type="hidden" name="image" value="${esc(b.image || '')}"></div>`, { aide: 'Utilisée pour les couleurs qui n’ont pas leur propre image (réglable sous le tableau des variantes).' })}
      ${U.blocMedias(db, b)}
      <h3 class="erp-sous-titre">${U.ico('web')} Site web</h3>
      ${U.ligne('Sur le site', U.coche('web_publie', b.web_publie !== false, 'Afficher ce produit sur le site'))}${U.ligne('Rayon du site', U.sel('web_rayon', [['', 'Automatique (selon la catégorie)'], ...D.RAYONS_SITE], b.web_rayon || ''))}`;
    return { html: `${U.titrePage('◇', neuf ? 'Nouveau produit à variantes' : `Modifier ${m.nom}`)}${neuf ? `<p class="erp-rappel">Étape 1 : ce qui est commun à toutes les couleurs et tailles. Étape 2 : le tableau des variantes.</p>` : ''}
      ${U.form('erp-f', corps, `${U.btn(neuf ? 'Suivant : les variantes ›' : 'Enregistrer', 'ok', 'btn-metal', 'type="submit"')}${U.btn('Annuler', '', 'btn-ligne', `data-aller="${neuf ? 'produits/liste' : `modeles/fiche/${m.id}`}"`)}`)}`,
      apres: (el) => { const hid = el.querySelector('input[name="image"]'); const medias = U.lierMedias(el, v, db); D.lierChampsCategorie(el);
        el.querySelector('[name="gabarit"]').addEventListener('change', (e) => { const g = D.gabarit(e.target.value); if (!g) return;
          { const c = el.querySelector('[name="categorie"]'); c.value = g.categorie; c.dispatchEvent(new Event('change')); }
          el.querySelector('[name="axes"]').value = g.axes.filter((ax) => !/^(Couleur|Taille)$/.test(ax)).join(', ');
          v.notifier(`Gabarit « ${g.nom} » : catégorie et caractéristiques remplies.`); });
        el.querySelector('[data-act="img-pop"]').addEventListener('click', () => U.choisirImage(v, { titre: 'Image par défaut', actuelle: hid.value, apercu: (x) => U.vignetteProduit({ categorie: b.categorie, image: x }, 160), max: 600, jpeg: true }, (x) => { hid.value = x; el.querySelector('[data-img-apercu]').innerHTML = U.vignetteProduit({ categorie: b.categorie, image: x }, 56); }));
        el.querySelector('#erp-f').addEventListener('submit', (e) => { e.preventDefault(); const d = U.lire(e.target);
        const autre = (db.modeles || []).find((x) => x.nom.trim().toLowerCase() === d.nom.toLowerCase() && (!m || x.id !== m.id));
        if (autre) { v.fenetre('Nom déjà utilisé', `<p>Un produit à variantes s’appelle déjà « ${esc(d.nom)} ».</p>`, '<button type="button" class="btn btn-metal" data-fermer>Compris</button>'); return; }
        const champs = { nom: d.nom, ref_base: d.ref_base.toUpperCase(), marque: d.marque, fournisseur: d.fournisseur || '', categorie: d.categorie, souscat: d.souscat || '', soussouscat: d.soussouscat || '', description: d.description, tva: D.TVA, tva_achat: D.TVA, pv: nombre(d.pv) ?? 0, pa: nombre(d.pa) ?? 0,
          en_vente: d.en_vente === '1', en_achat: d.en_achat === '1', web_publie: !!d.web_publie, web_rayon: d.web_rayon || '', image: d.image,
          axes: lireAxes(d.axes), galerie: medias.galerie(), certifs: medias.certifs(), gabarit: d.gabarit || '' };
        let mo = m;
        if (neuf) { mo = { id: D.id('m'), images: {}, cree: D.maintenant(), ...champs }; (db.modeles = db.modeles || []).push(mo); D.evt(db, `Produit à variantes « ${mo.nom} » créé`); }
        else { Object.assign(mo, champs); D.appliquerModele(db, mo); D.evt(db, `Produit à variantes « ${mo.nom} » modifié`); }
        D.toucher(mo); v.sauver(); v.aller(`modeles/fiche/${mo.id}`); }); } };
  }

  // ---------- fiche : infos + images par couleur + tableau des variantes ----------
  function fiche(v, m) {
    const db = v.db;
    if (!m) return { html: `<div class="erp-vide-page"><h1>Produit à variantes introuvable</h1>${U.lien('produits/liste', 'Retour à la liste')}</div>` };
    // Le tableau ne sert qu'à CRÉER de nouvelles variantes (demande de l'utilisateur, 11 nov. 2026) : les variantes déjà
    // enregistrées s'affichent en lecture (photo modifiable), un clic ouvre leur fiche produit où tout se modifie.
    if (!edition || edition.mid !== m.id) edition = { mid: m.id, lignes: [], modifie: false };
    const L = edition.lignes;
    const vs = variantesDe(db, m);
    const AX = m.axes || []; // autres caractéristiques (Diamètre, Longueur…)
    const G = m.gabarit && D.gabarit && D.gabarit(m.gabarit);
    const chip = (attrs, label, coche) => `<label class="erp-chip-t"><input type="checkbox" ${attrs}${coche ? ' checked' : ''}><span>${esc(label)}</span></label>`;
    // Générer d'après le gabarit : dimensions qui existent (par diamètre), empreinte déduite, autres valeurs à cocher.
    const genGabarit = () => {
      const dims = G.dimensions ? `<div class="erp-ligne-f"><label>Dimensions<br><button type="button" class="lien" data-gtout="">Tout cocher</button></label><div class="erp-gab-dims">${Object.entries(G.dimensions).map(([d, ls]) =>
        `<div class="erp-gab-l"><b>Ø ${esc(D.diametreTxt(d))}</b><button type="button" class="lien" data-gtout="${esc(d)}">tout</button><div class="erp-chips-tailles">${ls.map((lg) => chip(`data-g="dim" data-d="${esc(d)}" data-lg="${lg}"`, `${D.diametreTxt(d)} × ${lg}`)).join('')}</div></div>`).join('')}</div></div>` : '';
      const emp = G.empreintes ? U.ligne('Empreinte', `<div class="erp-chips-tailles">${Object.keys(G.empreintes).map((sy, i) => chip(`data-g="emp" data-s="${esc(sy)}"`, sy, i === 0)).join('')}</div>`, { aide: 'Déduite du diamètre (ex. Ø 4 → PZ2 en Pozidriv, T20 en Torx).' }) : '';
      const autres = G.axes.filter((ax) => !['Diamètre', 'Longueur'].includes(ax) && !(ax === 'Empreinte' && G.empreintes)).map((ax) => `<div data-gax="${esc(ax)}">${U.ligne(ax,
        `<div class="erp-chips-tailles">${((G.valeurs || {})[ax] || []).map((x) => chip(`data-g="val" data-v="${esc(x)}"`, x)).join('')}</div><input data-g="libre" placeholder="Autres valeurs, séparées par des virgules">`)}</div>`).join('');
      return `<form id="erp-gen-g" class="erp-gen"><p class="erp-gris">Gabarit <b>${esc(G.nom)}</b> : cochez ce que vous vendez. Toutes les combinaisons cochées deviennent des lignes (référence proposée), à vérifier avant d’enregistrer.</p>${dims}${emp}${autres}${U.boutons([U.btn('Générer les lignes', 'ok', 'btn-metal', 'type="submit"')])}</form>`; };
    // Abréviation d'une valeur pour la référence proposée : « Acier zingué blanc » → AZB, « Inox A2 » → A2, « 500 » → 500.
    const court = (x) => { const t = sansAccent(String(x).replace(/\(.*?\)/g, '')).toUpperCase().trim(); if (!t) return '';
      if (/^[A-Z]+$/.test(t) && t.length > 6) return t.slice(0, 3); // un seul mot : « AIGUILLE » → AIG const inox = /\bA([24])\b/.exec(t); if (inox) return 'A' + inox[1];
      const c = t.replace(/\s+/g, ''); if (/^[A-Z0-9.]{1,6}$/.test(c)) return c; return t.split(/[^A-Z0-9]+/).filter(Boolean).map((w) => (/\d/.test(w) ? w : w[0])).join('').slice(0, 5); };
    const avecC = !AX.length || vs.some((p) => p.couleur); const avecT = !AX.length || vs.some((p) => p.taille);
    const valeursAx = (ax) => [...new Set(db.produits.map((p) => D.valeurAxe(p, ax)).filter(Boolean))];
    const couleurs = [...new Set([...vs.map((p) => majuscule(p.couleur)), ...L.map((l) => majuscule(l.couleur))].filter(Boolean))];
    const toutesCouleurs = [...new Set([...Object.keys(D.COULEURS).map(majuscule), ...db.produits.map((p) => majuscule(p.couleur)).filter(Boolean)])];
    const tailles = [...new Set([...D.TAILLES, ...db.produits.map((p) => p.taille).filter(Boolean)])];
    const cell = (i, k, val, o = {}) => `<input data-l="${i}" data-k="${k}" value="${esc(val ?? '')}"${o.type ? ` type="${o.type}"` : ''}${o.step ? ` step="${o.step}" min="0"` : ''}${o.list ? ` list="${o.list}"` : ''}${o.ph ? ` placeholder="${esc(o.ph)}"` : ''} aria-label="${esc(o.aria || k)}">`;
    const pastilleC = (c) => (c ? `<span class="erp-couleur"><i style="background:${D.teinte(c) || 'transparent'}"></i>${esc(c)}</span>` : '—');
    // Variantes enregistrées : photo (cliquable = changer) + infos ; la ligne ouvre la fiche produit.
    const ligneVar = (p) => `<tr class="cliquable" data-aller="produits/fiche/${esc(p.id)}" title="Ouvrir la fiche de ${esc(p.ref)}">
        <td><button type="button" class="erp-var-photo" data-stop data-img-var="${esc(p.id)}" title="Changer la photo de ${esc(p.ref)}">${U.vignetteProduit(p, 44)}<span class="erp-var-photo-ico">${U.ico('image')}</span></button></td>
        ${avecC ? `<td>${pastilleC(p.couleur)}</td>` : ''}${avecT ? `<td><b>${esc(p.taille || '—')}</b></td>` : ''}${AX.map((ax) => `<td><b>${esc(D.valeurAxe(p, ax) || '—')}</b></td>`).join('')}<td><span class="erp-ref-copie"><b>${esc(p.ref)}</b>${U.copier(p.ref)}</span></td>
        <td class="erp-gris">${esc(p.code_barres || '—')}</td><td class="nb">${D.euros(p.pmp)}</td><td class="nb"><b>${D.euros(p.prix[0])}</b></td><td class="nb">${D.nombre(p.stock)}</td>
        <td>${D.surLeSite(p) ? '<span class="pastille st-ok">Sur le site</span>' : '<span class="pastille st-neutre">Hors site</span>'}</td><td class="erp-gris">›</td></tr>`;
    const ligneNeuve = (l, i) => `<tr data-ligne="${i}"><td>${cell(i, 'couleur', l.couleur, { list: 'erp-coul-v', ph: 'Couleur', aria: 'Couleur' })}</td><td>${cell(i, 'taille', l.taille, { list: 'erp-tail-v', ph: 'Taille', aria: 'Taille' })}</td>${AX.map((ax, j) => `<td>${cell(i, 'a:' + ax, (l.a || {})[ax], { list: 'erp-ax-' + j, ph: ax, aria: ax })}</td>`).join('')}
        <td>${cell(i, 'ref', l.ref, { ph: 'Référence', aria: 'Référence' })}</td><td>${cell(i, 'ean', l.ean, { ph: '13 chiffres', aria: 'Code EAN' })}</td>
        <td class="nb">${cell(i, 'pa', l.pa, { type: 'number', step: '0.01', aria: 'Prix d’achat HT' })}</td><td class="nb">${cell(i, 'pv', l.pv, { type: 'number', step: '0.01', aria: 'Prix de vente HT' })}</td>
        <td class="nb">${cell(i, 'stock', l.stock, { type: 'number', step: '1', aria: 'Stock' })}</td>
        <td><button type="button" class="btn-icone" data-retirer="${i}" title="Retirer cette ligne">✕</button></td></tr>`;
    const imagesHtml = couleurs.length ? `<p class="erp-gris">Photo utilisée pour toutes les tailles d’une couleur (sauf les variantes qui ont leur propre photo).</p><div class="erp-img-couleurs">${couleurs.map((c) => { const url = (m.images || {})[c] || '';
      return `<div class="erp-img-coul"><span class="erp-couleur"><i style="background:${D.teinte(c) || 'transparent'}"></i><b>${esc(c)}</b></span>${U.vignetteProduit({ categorie: m.categorie, image: url || m.image || '' }, 44)}<span class="erp-gris">${url ? (/^data:/.test(url) ? 'Image chargée' : esc(url)) : m.image ? 'Image par défaut' : 'Pas d’image'}</span><button type="button" class="btn petit btn-ligne" data-img-coul="${esc(c)}">${url ? 'Changer' : 'Ajouter'}</button></div>`; }).join('')}</div>`
      : '<p class="erp-gris">Les couleurs apparaîtront ici dès qu’il y aura des variantes : une photo par couleur, utilisée pour toutes les tailles.</p>';

    const refM = D.refModele(db, m);
    const html = `${U.titrePage('◇', m.nom, null, `${vs.length && refM ? U.btn('Voir dans la liste des produits', 'voir-liste', 'btn-ligne') : ''}${U.btn('Modifier le produit', '', 'btn-ligne', `data-aller="modeles/modifier/${m.id}"`)}${U.btn('Supprimer', 'suppr-m', 'btn-ligne erp-danger')}`)}
      ${L.length ? '<p class="erp-rappel erp-rappel-alerte"><b>Nouvelles lignes non enregistrées</b> : cliquez sur « Enregistrer les nouvelles variantes » pour les créer.</p>' : ''}
      ${!vs.length && !L.length ? '<p class="erp-rappel erp-rappel-alerte"><b>Pas encore sur le site :</b> aucune variante n’est enregistrée. Utilisez « Générer », « Coller depuis Excel » ou « + Ligne » plus bas, puis <b>Enregistrer les nouvelles variantes</b>.</p>' : ''}
      ${U.bloc('Variantes', vs.length ? `<p class="erp-gris">Cliquez sur une variante pour ouvrir sa fiche produit (tout se modifie là-bas). Cliquez sur la photo pour la changer.</p>
        <div class="erp-var-table"><table class="registre erp-table erp-var-liste"><thead><tr><th>Photo</th>${avecC ? '<th>Couleur</th>' : ''}${avecT ? '<th>Taille</th>' : ''}${AX.map((ax) => `<th>${esc(ax)}</th>`).join('')}<th>Référence</th><th>Code EAN</th><th class="nb">Prix d’achat HT</th><th class="nb">Prix de vente HT</th><th class="nb">Stock</th><th>Site</th><th></th></tr></thead>
        <tbody>${vs.map(ligneVar).join('')}</tbody></table></div>` : '<p class="erp-gris">Aucune variante enregistrée pour l’instant.</p>', { compte: vs.length })}
      ${U.bloc('Ajouter des variantes', `<datalist id="erp-coul-v">${toutesCouleurs.map((c) => `<option value="${esc(c)}">`).join('')}</datalist><datalist id="erp-tail-v">${tailles.map((t) => `<option value="${esc(t)}">`).join('')}</datalist>${AX.map((ax, j) => `<datalist id="erp-ax-${j}">${valeursAx(ax).map((x) => `<option value="${esc(x)}">`).join('')}</datalist>`).join('')}
        ${L.length ? `<div class="erp-var-table"><table class="registre erp-table erp-var"><thead><tr><th>Couleur</th><th>Taille</th>${AX.map((ax) => `<th>${esc(ax)}</th>`).join('')}<th>Référence</th><th>Code EAN</th><th class="nb">Prix d’achat HT</th><th class="nb">Prix de vente HT</th><th class="nb">Stock</th><th></th></tr></thead>
        <tbody>${L.map(ligneNeuve).join('')}</tbody></table></div>` : '<p class="erp-gris">Utilisez « Générer » ou « Coller depuis Excel » ci-dessous, ou « + Ligne ». Les nouvelles lignes apparaissent ici, à vérifier avant d’enregistrer.</p>'}
        <p class="erp-alerte" data-var-err></p>
        ${U.boutons([U.btn('+ Ligne', 'ligne', 'btn-ligne'), L.length ? U.btn('Enregistrer les nouvelles variantes', 'enreg', 'btn-metal') : ''])}`, { compte: L.length || null, ico: 'plus' })}
      <div class="erp-2col"><div class="erp-col">${G ? U.bloc('Générer des variantes', genGabarit()) : ''}${G ? '' : U.bloc('Générer des variantes', `<form id="erp-gen" class="erp-gen">
          ${U.ligne('Couleurs', `${U.inp('couleurs', '', { ph: 'Ex. : Noir, Blanc, Bleu marine' })}`, { aide: 'Séparées par des virgules.' })}
          <div class="erp-ligne-f"><label>Tailles</label><div><div class="erp-chips-tailles">${D.TAILLES.map((t) => `<label class="erp-chip-t"><input type="checkbox" name="t_${esc(t)}"><span>${esc(t)}</span></label>`).join('')}</div>${U.inp('autres', '', { ph: 'Autres tailles : 38, 40, 42…' })}</div></div>
          ${AX.map((ax, j) => U.ligne(ax, U.inp('ax_' + j, '', { ph: 'Valeurs séparées par des virgules' }))).join('')}
          ${U.boutons([U.btn('Générer les lignes', 'ok', 'btn-metal', 'type="submit"')])}</form>`)}</div>
        <div class="erp-col">${U.bloc('Coller depuis Excel', `<p class="erp-gris">Copiez les colonnes dans Excel puis collez-les ici, dans cet ordre : <b>Référence · Couleur · Taille · Code EAN · Prix d’achat · Prix de vente · Stock${AX.map((ax) => ' · ' + esc(ax)).join('')}</b> (les dernières colonnes peuvent manquer).</p>
          <textarea id="erp-colle" rows="5" placeholder="TS-PRINT-NOI-M&#9;Noir&#9;M&#9;3666…&#9;3,20&#9;6,90&#9;12"></textarea>${U.boutons([U.btn('Ajouter au tableau', 'coller', 'btn-ligne')])}<p class="erp-alerte" data-colle-err></p>`)}</div></div>
      ${U.bloc('Photos par couleur', imagesHtml, { compte: couleurs.length })}`;

    const existe = (x) => { const k = cleVar(m, x); return vs.some((p) => cleVar(m, p) === k) || L.some((l) => cleVar(m, l) === k); };
    const apres = (el) => {
      // Recopie les cases des nouvelles lignes dans edition.lignes (avant tout redessin).
      const lire = () => { el.querySelectorAll('[data-l]').forEach((i) => { const l = L[+i.dataset.l]; if (!l) return; const k = i.dataset.k;
        if (k.startsWith('a:')) (l.a = l.a || {})[k.slice(2)] = i.value.trim(); else l[k] = i.value.trim(); }); };
      const redessiner = () => { lire(); edition.modifie = L.length > 0; v.rendre(); };
      const fg = el.querySelector('#erp-gen-g');
      if (fg) {
        fg.addEventListener('click', (e) => { const b = e.target.closest('[data-gtout]'); if (!b) return; e.preventDefault();
          const boites = [...fg.querySelectorAll('input[data-g="dim"]')].filter((i) => !b.dataset.gtout || i.dataset.d === b.dataset.gtout);
          const tout = boites.some((i) => !i.checked); boites.forEach((i) => { i.checked = tout; }); });
        fg.addEventListener('submit', (e) => { e.preventDefault(); lire();
          const cochees = (sel) => [...fg.querySelectorAll(sel)].filter((i) => i.checked);
          const dims = cochees('input[data-g="dim"]').map((i) => ({ d: i.dataset.d, l: i.dataset.lg }));
          if (G.dimensions && !dims.length) { v.notifier('Cochez au moins une dimension.'); return; }
          const systemes = cochees('input[data-g="emp"]').map((i) => i.dataset.s);
          if (G.empreintes && !systemes.length) { v.notifier('Cochez au moins une empreinte.'); return; }
          let combis = [{}];
          if (G.dimensions) combis = combis.flatMap((o) => dims.map((x) => ({ ...o, Diamètre: D.diametreTxt(x.d), Longueur: x.l, _d: x.d })));
          if (G.empreintes) combis = combis.flatMap((o) => systemes.map((sy) => ({ ...o, Empreinte: (G.empreintes[sy] || {})[o._d] || sy })));
          fg.querySelectorAll('[data-gax]').forEach((z) => { const ax = z.dataset.gax;
            const vals = [...z.querySelectorAll('input[data-g="val"]')].filter((i) => i.checked).map((i) => i.dataset.v);
            vals.push(...String((z.querySelector('[data-g="libre"]') || {}).value || '').split(/[,;]/).map((x) => x.trim()).filter(Boolean));
            if (vals.length) combis = combis.flatMap((o) => [...new Set(vals)].map((x) => ({ ...o, [ax]: x }))); });
          if (combis.length > 3000) { v.notifier(`${combis.length} combinaisons : c'est trop en une fois, cochez moins de valeurs.`); return; }
          const base = (m.ref_base || sansAccent(m.nom).toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 12));
          let n = 0;
          combis.forEach((o) => {
            const couleur = o.Couleur ? majuscule(o.Couleur) : ''; const taille = o.Taille ? String(o.Taille).toUpperCase() : '';
            const a = {}; AX.forEach((ax) => { if (o[ax] !== undefined && o[ax] !== '') a[ax] = String(o[ax]); });
            const ref = [base, o.Diamètre ? `${String(o.Diamètre).replace(',', '.')}X${o.Longueur}` : '', abrege(couleur), taille,
              ...AX.filter((ax) => !['Diamètre', 'Longueur'].includes(ax)).map((ax) => court(a[ax] || ''))].filter(Boolean).join('-');
            const l = { couleur, taille, a, ref, ean: '', pa: m.pa || '', pv: m.pv || '', stock: 0 };
            if (existe(l)) return; L.push(l); n++; });
          v.notifier(n ? `${n} ligne(s) ajoutée(s) : vérifiez les références puis « Enregistrer les nouvelles variantes ».` : 'Ces variantes existent déjà.'); redessiner(); });
      }
      if (el.querySelector('#erp-gen')) el.querySelector('#erp-gen').addEventListener('submit', (e) => { e.preventDefault(); lire(); const fo = e.target;
        const cs = fo.couleurs.value.split(/[,;\n]/).map(majuscule).filter(Boolean);
        const ts = [...D.TAILLES.filter((t) => fo[`t_${t}`] && fo[`t_${t}`].checked), ...fo.autres.value.split(/[,;\s]+/).map((t) => t.trim().toUpperCase()).filter(Boolean)];
        const axv = AX.map((ax, j) => (fo['ax_' + j] ? fo['ax_' + j].value : '').split(/[,;]/).map((x) => x.trim()).filter(Boolean));
        if (!cs.length && !ts.length && !axv.some((l) => l.length)) { v.notifier('Indiquez au moins une couleur, une taille ou une valeur.'); return; }
        const base = (m.ref_base || sansAccent(m.nom).toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 12));
        let n = 0;
        let combis = [{}];
        AX.forEach((ax, j) => { const vals = axv[j].length ? axv[j] : ['']; combis = combis.flatMap((o) => vals.map((x) => ({ ...o, [ax]: x }))); });
        (cs.length ? cs : ['']).forEach((c) => (ts.length ? ts : ['']).forEach((t) => combis.forEach((a) => {
          const l = { couleur: c, taille: t, a, ref: [base, abrege(c), t, ...AX.map((ax) => sansAccent(a[ax] || '').toUpperCase().replace(/[^A-Z0-9.,]+/g, ''))].filter(Boolean).join('-'), ean: '', pa: m.pa || '', pv: m.pv || '', stock: 0 };
          if (existe(l)) return; L.push(l); n++; })));
        v.notifier(n ? `${n} ligne(s) ajoutée(s) : vérifiez les références puis « Enregistrer les nouvelles variantes ».` : 'Ces variantes existent déjà.'); redessiner(); });
      el.addEventListener('click', (e) => { const bt = e.target.closest('[data-act],[data-retirer],[data-img-var]'); if (!bt) return;
        if (bt.dataset.imgVar) { e.stopPropagation(); lire(); const p = D.produit(db, bt.dataset.imgVar); if (!p) return;
          U.choisirImage(v, { titre: `Photo de ${p.ref}`, actuelle: p.image, apercu: (x) => U.vignetteProduit({ ...p, image: x }, 160), max: 600, jpeg: true }, (x) => {
            p.image_perso = !!x; p.image = x || D.imageVariante(m, p); D.toucher(p); D.evt(db, `Photo de ${p.ref} ${x ? 'modifiée' : 'retirée'}`, { objet: { type: 'produit', id: p.id } }); v.sauver(); v.rendre(); }); return; }
        if (bt.dataset.retirer != null) { lire(); L.splice(+bt.dataset.retirer, 1); redessiner(); return; }
        const act = bt.dataset.act;
        if (act === 'ligne') { lire(); const last = L[L.length - 1] || vs[vs.length - 1] || {}; L.push({ couleur: last.couleur || '', taille: '', a: {}, ref: '', ean: '', pa: m.pa || '', pv: m.pv || '', stock: 0 }); redessiner(); }
        if (act === 'coller') { lire(); const txt = el.querySelector('#erp-colle').value; const err = el.querySelector('[data-colle-err]'); let n = 0, ignorees = 0;
          txt.split(/\r?\n/).map((x) => x.trim()).filter(Boolean).forEach((x) => { const c = x.split(/\t|;/).map((y) => y.trim());
            if (!c[0] || /^r[ée]f/i.test(c[0])) { ignorees++; return; } // ligne d'en-tête ou vide
            const a = {}; AX.forEach((ax, j) => { if (c[7 + j]) a[ax] = c[7 + j]; });
            L.push({ ref: c[0].toUpperCase(), couleur: majuscule(c[1]), taille: String(c[2] || '').toUpperCase(), a, ean: c[3] || '', pa: nombre(c[4]) ?? (m.pa || ''), pv: nombre(c[5]) ?? (m.pv || ''), stock: nombre(c[6]) ?? 0 }); n++; });
          if (!n) { err.textContent = 'Rien à ajouter : collez au moins une ligne avec une référence.'; return; }
          v.notifier(`${n} ligne(s) ajoutée(s)${ignorees ? ` (${ignorees} ignorée(s))` : ''} : vérifiez puis « Enregistrer les nouvelles variantes ».`); redessiner(); }
        if (act === 'enreg') { lire(); enregistrer(el); }
        if (act === 'suppr-m') supprimerModele();
        if (act === 'voir-liste') { D.rechercheProduits = refM; v.aller('produits/liste'); } });
      // Photos par couleur : enregistrées tout de suite (sur les variantes de cette couleur sans photo à elles).
      el.querySelectorAll('[data-img-coul]').forEach((bt) => bt.addEventListener('click', () => { lire(); const c = bt.dataset.imgCoul; m.images = m.images || {};
        U.choisirImage(v, { titre: `Photo « ${m.nom} » ${c}`, actuelle: m.images[c] || '', apercu: (x) => U.vignetteProduit({ categorie: m.categorie, image: x || m.image || '' }, 160), max: 600, jpeg: true }, (x) => {
          if (x) m.images[c] = x; else delete m.images[c];
          vs.filter((p) => !p.image_perso).forEach((p) => { p.image = D.imageVariante(m, p); D.toucher(p); });
          D.toucher(m); v.sauver(); v.notifier(`Photo ${c} ${x ? 'enregistrée' : 'retirée'} (toutes les tailles).`); v.rendre(); }); }));
    };

    // Crée les nouvelles lignes (les variantes existantes ne sont pas touchées : elles se modifient dans leur fiche).
    function enregistrer(el) {
      const err = el.querySelector('[data-var-err]'); const pb = [];
      L.forEach((l) => { l.ref = String(l.ref || '').toUpperCase(); l.couleur = majuscule(l.couleur); l.taille = String(l.taille || '').trim().toUpperCase(); });
      L.forEach((l, i) => {
        if (!l.ref) pb.push(`ligne ${i + 1} : référence manquante`);
        if (!cleVar(m, l).replace(/\|/g, '')) pb.push(`ligne ${i + 1} : indiquez au moins une caractéristique (couleur, taille${AX.map((ax) => ', ' + ax.toLowerCase()).join('')})`);
        if (L.some((x, j) => j !== i && x.ref === l.ref && l.ref)) pb.push(`${l.ref} : référence en double dans le tableau`);
        if (l.ref && db.produits.some((p) => p.ref.toUpperCase() === l.ref)) pb.push(`${l.ref} : référence déjà utilisée`);
        if (L.some((x, j) => j < i && cleVar(m, x) === cleVar(m, l)) || vs.some((p) => cleVar(m, p) === cleVar(m, l))) pb.push(`${[l.couleur, l.taille, ...AX.map((ax) => (l.a || {})[ax])].filter(Boolean).join(' ')} : cette variante existe déjà`);
        if (l.ean && !/^\d{8,14}$/.test(l.ean)) pb.push(`${l.ref} : code EAN à 8–14 chiffres`);
        if (!((nombre(l.pa) ?? 0) > 0)) pb.push(`${l.ref || 'ligne ' + (i + 1)} : prix d’achat obligatoire`); });
      if (!m.fournisseur || !D.tiers(db, m.fournisseur)) pb.push('choisissez le fournisseur du produit à variantes (bouton « Modifier », en haut)');
      if (pb.length) { err.innerHTML = `<b>À corriger :</b> ${[...new Set(pb)].map(esc).join(' · ')}`; return; }
      const ids = [];
      L.forEach((l) => { const pa = nombre(l.pa) ?? 0; const pv = nombre(l.pv) ?? 0; const st = Math.round(nombre(l.stock) ?? 0);
        const p = { id: D.id('p'), ref: l.ref, libelle: '', marque: m.marque, categorie: m.categorie, code_barres: l.ean, en_vente: true, en_achat: true, description: m.description, url: '', image: '',
          modele_id: m.id, modele: m.nom, couleur: l.couleur, taille: l.taille, attributs: Object.fromEntries(AX.map((ax) => [ax, String((l.a || {})[ax] || '').trim()]).filter((x) => x[1])), entrepot: 'Showroom', poids: 0, alerte: 0, optimal: 0, prix: niveaux(pv), prix_min: 0, pmp: pa, tva: m.tva, tva_achat: m.tva_achat ?? m.tva, stock: 0, note: '',
          cpt_vente: '707100', cpt_achat: '607100', fournisseurs: [{ tiers: m.fournisseur, ref: l.ref, qte_min: 1, pu: pa, remise: 0, delai: 0, depuis: D.auj() }], historique: [{ d: D.maintenant(), niveau: 1, pu: pv, par: D.MOI }], cree: D.maintenant() };
        db.produits.push(p); ids.push(p.id); if (st) D.mouvement(db, p.id, st, 'Stock initial'); });
      D.appliquerModele(db, m, ids); D.toucher(m);
      D.evt(db, `${ids.length} variante(s) ajoutée(s) à « ${m.nom} »`);
      v.sauver(); edition = { mid: m.id, lignes: [], modifie: false };
      v.notifier(`${ids.length} variante(s) créée(s).`); v.rendre();
    }

    function supprimerModele() {
      const lies = variantesDe(db, m).filter((p) => enDocuments(db, p.id));
      if (lies.length) { v.fenetre('Suppression impossible', `<p>${lies.length} variante(s) sont utilisées dans des documents (${esc(lies.slice(0, 3).map((p) => p.ref).join(', '))}…). Passez le produit « Hors vente » (Modifier le produit).</p>`, '<button type="button" class="btn btn-metal" data-fermer>Compris</button>'); return; }
      v.confirmer(`Supprimer « ${m.nom} » ?`, `Le produit et ses ${variantesDe(db, m).length} variante(s) seront supprimés. Cette action ne peut pas être annulée.`, 'Supprimer', () => {
        const ids = new Set(variantesDe(db, m).map((p) => p.id));
        db.produits = db.produits.filter((p) => !ids.has(p.id)); db.prixClients = db.prixClients.filter((x) => !ids.has(x.produit)); db.modeles = db.modeles.filter((x) => x.id !== m.id);
        D.evt(db, `Produit à variantes « ${m.nom} » supprimé`); edition = null; v.sauver(); v.aller('produits/liste'); });
    }

    return { html, apres };
  }
})();
