// FMD — CRM / ERP : Catalogue (produits, prix de vente par niveau et par client, prix d'achat fournisseurs, stock,
// mouvements, réapprovisionnement, magasin 3D). Modèle : captures Dolibarr « CRM\3-Catalogue ».
// Nouveau produit en 2 pages (page 1 : identité et stock, page 2 : prix, TVA, comptabilité).
(function () {
  'use strict';
  const D = (window.FMDERP = window.FMDERP || {});
  const P = (D.pages = D.pages || {});
  const U = D.ui;
  const esc = U.esc;
  let brouillon = null; // nouveau produit entre la page 1 et la page 2

  // Réservé (19 nov. 2026, demande : « quand je fais une proposition ou une commande en brouillon, je veux que le stock soit
  // déduit, pour savoir où j'en suis ») : tout ce qui est promis à un client et pas encore livré = commandes en brouillon,
  // validées ou en préparation + propositions en brouillon, ouvertes ou signées qui n'ont pas encore leur commande
  // (sinon elles compteraient deux fois). Déduit du STOCK VIRTUEL tout de suite ; le stock PHYSIQUE (ce qui est vraiment
  // en rayon) ne baisse qu'à la livraison. Supprimer / refuser / annuler le document rend le stock aussitôt.
  const qteDe = (doc, id) => doc.lignes.filter((l) => l.produit === id).reduce((a, l) => a + (+l.qte || 0), 0);
  const reserve = (db, id) => db.commandes.filter((c) => ['brouillon', 'validee', 'en_cours'].includes(c.etat)).reduce((s, c) => s + qteDe(c, id), 0)
    + db.propositions.filter((p) => ['brouillon', 'ouvert', 'signee'].includes(p.etat) && !(p.liens || []).some((x) => x.type === 'cmd')).reduce((s, p) => s + qteDe(p, id), 0);
  D.stockReserve = reserve;
  const attendu = (db, id) => db.achats.filter((a) => ['commande', 'ar_recu', 'recue_partiel'].includes(a.etat)).reduce((s, a) => s + a.lignes.filter((l) => l.produit === id).reduce((x, l) => x + l.qte - (l.recu || 0), 0), 0);
  D.stockVirtuel = (db, p) => p.stock - reserve(db, p.id) + attendu(db, p.id);
  // Valeur du stock (23 nov. 2026, demande : « ajoute sur le tableau de bord la valeur du stock et dans la partie catalogue »).
  // Stock physique positif seulement. achat = au prix de revient (PMP, sinon meilleur prix d'achat) ; vente = au prix public HT.
  D.valeurStock = (db) => db.produits.reduce((t, p) => { const q = Math.max(0, +p.stock || 0); if (q) { t.refs += 1; t.unites += q; }
    t.achat += D.prixRevient(p) * q; t.vente += ((p.prix && +p.prix[0]) || 0) * q; return t; }, { achat: 0, vente: 0, refs: 0, unites: 0 });
  const meilleurAchat = (p) => (p.fournisseurs || []).reduce((m, f) => (m == null || f.pu < m.pu ? f : m), null);
  // Codes couleur du stock (19 nov. 2026, demande : « si le stock est insuffisant, un truc rouge ou orange pour prévenir
  // qu'il faut recommander, et un autre code couleur pour le stock virtuel »). Physique (pastille pleine) : vert = en stock,
  // orange = à recommander (≤ seuil d'alerte), rouge = rupture (≤ 0). Virtuel = physique − réservé + attendu (pastille
  // en pointillés) : bleu = suffisant, violet = à commander (≤ seuil), rose = manque (les commandes clients dépassent le stock).
  const etatPhys = (n, alerte) => (n <= 0 ? ['rupture', 'Rupture'] : n <= alerte ? ['bas', 'À recommander'] : ['ok', 'En stock']);
  const etatVirt = (n, alerte) => (n < 0 ? ['manque', 'Manque'] : n <= alerte ? ['bas', 'À commander'] : ['ok', 'Suffisant']);
  const pastilleStock = (n, alerte) => { const [c, l] = etatPhys(n, alerte);
    return `<span class="erp-stock p-${c}" title="Stock physique : ${l} (alerte à ${alerte})"><i></i>${c !== 'ok' ? '⚠ ' : ''}${D.nombre(n)}${c !== 'ok' ? `<small>${l}</small>` : ''}</span>`; };
  const pastilleVirtuel = (n, alerte) => { const [c, l] = etatVirt(n, alerte);
    return `<span class="erp-stock v-${c}" title="Stock virtuel (physique − réservé + attendu) : ${l} (alerte à ${alerte})"><i></i>≈ ${D.nombre(n)}${c !== 'ok' ? `<small>${l}</small>` : ''}</span>`; };
  const alerteStock = (p) => pastilleStock(p.stock || 0, p.alerte || 0);
  D.pastilleVirtuel = pastilleVirtuel; // utilisée aussi dans les lignes des devis / commandes (erp-commerce.js)
  const legendeStock = () => `<div class="erp-legende-stock"><b>Stock physique</b>${[['ok', 'En stock'], ['bas', 'À recommander'], ['rupture', 'Rupture']].map(([c, l]) => `<span class="erp-stock p-${c}"><i></i>${l}</span>`).join('')}
    <b>Stock virtuel</b>${[['ok', 'Suffisant'], ['bas', 'À commander'], ['manque', 'Manque']].map(([c, l]) => `<span class="erp-stock v-${c}"><i></i>${l}</span>`).join('')}</div>`;

  // Lignes vendues (commandes clients validées, hors annulées) sur la période choisie.
  const ventesPeriode = (db, per, produitId) => { const l = [];
    D.ventes(db).filter((c) => c.etat !== 'annulee' && c.etat !== 'brouillon' && per.dans(c.date)).forEach((c) => c.lignes.forEach((x) => { if (x.produit && (!produitId || x.produit === produitId)) l.push({ c, x }); }));
    return l; };
  const ansCmd = (db) => D.ventes(db).map((c) => String(c.date).slice(0, 4));
  // Image du produit : fenêtre « lien ou fichier » (U.choisirImage). Photos chargées : JPEG 600 px (site web).
  const OPT_IMG_PRODUIT = { max: 600, jpeg: true };
  const blocImage = (p) => `<h3 class="erp-sous-titre">${U.ico('image')} Image du produit</h3>
      <div class="erp-logo-choix"><div data-img-apercu>${U.vignetteProduit(p, 84)}</div>
        <div><p class="erp-gris">L’image apparaît dans la liste, sur la fiche et sur le site : un lien (URL) ou une image de l’ordinateur.</p>
        <div class="erp-actions gauche">${U.btn(p.image ? 'Changer l’image' : 'Ajouter une image', 'img-pop', 'btn-ligne')}</div><input type="hidden" name="image" value="${esc(p.image || '')}"></div></div>`;
  // Branche le bloc : renvoie une fonction qui donne l'image choisie (URL, image chargée ou '').
  const lierImage = (el, p, v) => { const inp = el.querySelector('input[name="image"]');
    el.querySelector('[data-act="img-pop"]').addEventListener('click', () => U.choisirImage(v, { titre: 'Image du produit', actuelle: inp.value, apercu: (x) => U.vignetteProduit({ ...p, image: x }, 160), ...OPT_IMG_PRODUIT }, (x) => {
      inp.value = x; el.querySelector('[data-img-apercu]').innerHTML = U.vignetteProduit({ ...p, image: x }, 84); }));
    return () => inp.value; };
  // Bloc « Site web » : publication et rayon du site. Les couleurs / tailles se gèrent dans un « produit à variantes » (js/erp-modeles.js).
  const blocWeb = (db, p) => `<h3 class="erp-sous-titre">${U.ico('web')} Site web</h3>
      ${U.ligne('Sur le site', U.coche('web_publie', p.web_publie !== false, 'Afficher ce produit sur le site'))}${U.ligne('Rayon du site', U.sel('web_rayon', [['', 'Automatique (selon la catégorie)'], ...D.RAYONS_SITE], p.web_rayon || ''))}`;
  const champsWeb = (d) => ({ web_publie: !!d.web_publie, web_rayon: d.web_rayon || '' });
  P.produits = (v, a) => {
    const [vue, x, y] = a;
    if (vue === 'liste') return liste(v, x);
    if (vue === 'nouveau') return nouveau(v, x === '2' ? 2 : 1);
    if (vue === 'modifier') return modifier(v, D.produit(v.db, x));
    if (vue === 'fiche') return fiche(v, x, y || 'produit');
    if (vue === 'stats') return stats(v);
    return espace(v);
  };

  function espace(v) {
    const db = v.db; const p = db.produits;
    const parts = [{ l: 'En vente et en achat', v: p.filter((x) => x.en_vente && x.en_achat).length, c: U.COUL.c2 }, { l: 'En vente seulement', v: p.filter((x) => x.en_vente && !x.en_achat).length, c: U.COUL.c4 },
      { l: 'En achat seulement', v: p.filter((x) => !x.en_vente && x.en_achat).length, c: U.COUL.c3 }, { l: 'Hors vente et hors achat', v: p.filter((x) => !x.en_vente && !x.en_achat).length, c: U.COUL.neutre }];
    const sous = p.filter((x) => x.stock <= x.alerte);
    const vs = D.valeurStock(db);
    const blocValeur = U.bloc('Valeur du stock', `${U.infos([['Au prix de revient (PMP)', `<b>${D.euros(vs.achat)}</b> HT`], ['Au prix de vente public', `${D.euros(vs.vente)} HT`],
      ['Marge potentielle', vs.vente ? D.margeTxt(vs.vente, vs.achat) : '—'], ['Produits en stock', `${D.nombre(vs.refs)} référence${vs.refs > 1 ? 's' : ''} · ${D.nombre(vs.unites)} unité${vs.unites > 1 ? 's' : ''}`]])}`,
      { ico: 'stock', compte: D.eurosRond(vs.achat), droite: U.lien('stocks/tous', 'Détail par produit') });
    const per = U.bornes(U.periode('produits', 'mois'), ansCmd(db)); const caP = per.unites.map(() => 0), qP = per.unites.map(() => 0);
    ventesPeriode(db, per).forEach(({ c, x }) => { const i = per.index(c); if (i >= 0) { caP[i] += D.htLigne(x); qP[i] += x.qte; } });
    return { html: `${U.titrePage('◇', 'Espace produits', null, U.btn('+ Nouveau produit', '', 'btn-metal', 'data-aller="produits/nouveau"'))}${U.choixPeriode('produits', 'mois')}
      <div class="erp-2col"><div class="erp-col">${U.bloc(`Ventes HT — ${per.lib}`, U.barresP(caP, per, U.court), { ico: 'stats', compte: D.eurosRond(caP.reduce((a, x) => a + x, 0)), droite: U.lien('produits/stats', 'Statistiques') })}${U.bloc(`Articles vendus — ${per.lib}`, U.barresP(qP, per, D.nombre), { ico: 'stats', compte: D.nombre(qP.reduce((a, x) => a + x, 0)) })}${U.bloc('Catalogue', U.donut(parts.map((x) => ({ ...x, r: 'produits/liste' })), p.length, 'produits'), { ico: 'produit' })}
        ${U.bloc('Produits sous le seuil d’alerte', U.table([['Image', (o) => U.vignetteProduit(o, 40), 'erp-col-img'], ['Réf.', (o) => `<b>${esc(o.ref)}</b>`], ['Libellé', (o) => esc(o.libelle)], ['Stock', (o) => alerteStock(o), 'nb'], ['Alerte', (o) => String(o.alerte), 'nb']], sous, { lien: (o) => `produits/fiche/${o.id}/stock`, vide: 'Aucun produit sous le seuil' }), { compte: sous.length, droite: U.lien('stocks/alerte', 'Réapprovisionner') })}</div>
      <div class="erp-col">${blocValeur}${U.bloc('Les 3 derniers produits modifiés', U.table([['Image', (o) => U.vignetteProduit(o, 40), 'erp-col-img'], ['Réf.', (o) => `<b>${esc(o.ref)}</b>`], ['Libellé', (o) => esc(o.libelle)], ['Modifié', (o) => D.jour(o.modifie)], ['Prix HT', (o) => D.euros(o.prix[0]), 'nb']], [...p].sort((q, r) => (r.modifie > q.modifie ? 1 : -1)).slice(0, 3), { lien: (o) => `produits/fiche/${o.id}` }), { droite: U.lien('produits/liste', 'Tous') })}
        ${U.bloc('Les 3 derniers mouvements de stock', tableMvts(db, db.mouvements.slice(0, 3)), { droite: U.lien('mouvements', 'Tous') })}</div></div>` };
  }
  const tableMvts = (db, l, sansProduit) => U.table([['Date', (m) => `${D.jour(m.d)} <span class="erp-gris">${D.heure(m.d)}</span>`], sansProduit ? null : ['Produit', (m) => { const p = D.produit(db, m.produit); return p ? `<b>${esc(p.ref)}</b>` : '—'; }],
    ['Type', (m) => D.pastilleMouvement(m)], ['Motif', (m) => esc(m.motif)], ['Par', (m) => esc(m.par)], ['Quantité', (m) => `<b class="${m.qte < 0 ? 'erp-moins' : 'erp-plus'}">${m.qte > 0 ? '+' : ''}${D.nombre(m.qte)}</b>`, 'nb']].filter(Boolean), l, { lien: sansProduit ? null : (m) => `produits/fiche/${m.produit}/stock`, vide: 'Aucun mouvement' });
  // Historique des mouvements avec filtre par type (manuel, commande, retour, inventaire…) et nom de la personne.
  // Un mouvement venu d'un document (retour fournisseur) ouvre ce document. Utilisé par la fiche produit et « Mouvements ».
  const colsMvts = (db, avecProduit) => [
    avecProduit ? { t: 'Image', v: (m) => { const p = D.produit(db, m.produit); return p ? U.vignetteProduit(p, 44) : ''; }, cls: 'erp-col-img' } : null,
    { t: 'Date', v: (m) => `${D.jour(m.d)} <span class="erp-gris">${D.heure(m.d)}</span>` },
    avecProduit ? { t: 'Produit', v: (m) => { const p = D.produit(db, m.produit); return p ? `<b>${esc(p.ref)}</b> ${esc(p.libelle)}` : '—'; }, txt: (m) => { const p = D.produit(db, m.produit); return p ? p.ref + ' ' + p.libelle : ''; } } : null,
    { t: 'Type', v: (m) => D.pastilleMouvement(m), txt: (m) => (D.NATURES_MVT.find((x) => x[0] === D.natureMouvement(m)) || [])[1] || '' },
    { t: 'Motif', v: (m) => esc(m.motif), txt: (m) => m.motif },
    { t: 'Par', v: (m) => `<b>${esc(m.par || '—')}</b>`, txt: (m) => m.par },
    { t: 'Quantité', v: (m) => `<b class="${m.qte < 0 ? 'erp-moins' : 'erp-plus'}">${m.qte > 0 ? '+' : ''}${D.nombre(m.qte)}</b>`, nb: true }].filter(Boolean);
  const listeMvts = (el, db, lignes, avecProduit) => U.liste(el, { cols: colsMvts(db, avecProduit), lignes, cle: avecProduit ? 'mouvements' : 'mouvements-produit',
    lien: (m) => (m.doc ? `${m.doc.type}/fiche/${m.doc.id}` : `produits/fiche/${m.produit}/stock`),
    etats: D.NATURES_MVT.map(([id, l]) => ['n:' + id, l]),
    filtre: (m, e) => D.natureMouvement(m) === e.slice(2), vide: 'Aucun mouvement' });

  function liste(v, cat) {
    const db = v.db;
    // Une seule liste (demande de l'utilisateur, 11 nov. 2026) : produits simples, variantes ET produits à variantes (ligne
    // « modèle » rangée juste avant ses variantes grâce à sa référence ; bouton copier pour la coller dans la recherche).
    const modeles = (db.modeles || []).map((m) => { const vs = db.produits.filter((p) => p.modele_id === m.id); const ref = D.refModele(db, m) || m.nom.toUpperCase();
      const px = vs.map((p) => p.prix[0]); return { _m: m, id: m.id, ref, libelle: m.nom, marque: m.marque, categorie: m.categorie, vs, image: m.image || Object.values(m.images || {})[0] || (vs.find((p) => p.image) || {}).image || '',
        couleurs: [...new Set(vs.map((p) => p.couleur).filter(Boolean))], min: px.length ? Math.min(...px) : m.pv, max: px.length ? Math.max(...px) : m.pv }; });
    const lignes = [...db.produits, ...modeles].sort((a, b) => a.ref.localeCompare(b.ref) || (a._m ? -1 : b._m ? 1 : 0));
    const colsM = {
      Image: (o) => U.vignetteProduit({ categorie: o.categorie, image: o.image }, 44),
      'Réf. produit': () => '<span class="erp-gris">Variantes ›</span>',
      Libellé: (o) => `<b>${esc(o.libelle)}</b><br><small class="erp-gris"><span class="pastille st-info">Produit à variantes</span> ${o.vs.length ? `${o.vs.length} variante${o.vs.length > 1 ? 's' : ''}${o.couleurs.length ? ` · ${o.couleurs.length} couleur${o.couleurs.length > 1 ? 's' : ''}` : ''}` : '<b class="erp-alerte-txt">aucune variante enregistrée</b>'}</small>`,
      Fournisseur: (o) => esc(o.marque),
      'Prix de vente': (o) => `${o.min !== o.max ? 'dès ' : ''}${D.euros(o.min)} HT`,
      'Stock physique': (o) => pastilleStock(o.vs.reduce((t, p) => t + (p.stock || 0), 0), o.vs.reduce((t, p) => t + (p.alerte || 0), 0)),
      'Stock virtuel': (o) => pastilleVirtuel(o.vs.reduce((t, p) => t + D.stockVirtuel(db, p), 0), o.vs.reduce((t, p) => t + (p.alerte || 0), 0)),
      Vente: (o) => (o._m.en_vente !== false ? '<span class="pastille st-ok">En vente</span>' : '<span class="pastille st-neutre">Hors vente</span>'),
      Achat: (o) => (o._m.en_achat !== false ? '<span class="pastille st-ok">En achat</span>' : '<span class="pastille st-neutre">Hors achat</span>'),
    };
    const cols0 = [
      { t: 'Image', v: (p) => U.vignetteProduit(p, 44), cls: 'erp-col-img' }, { t: 'Réf. produit', v: (p) => `<span class="erp-ref-copie"><b>${esc(p.ref)}</b>${U.copier(p.ref)}</span>`, txt: (p) => p.ref }, { t: 'Libellé', v: (p) => `${esc(p.libelle)}${p.couleur || p.taille ? `<br><small class="erp-gris">${esc([p.couleur, p.taille].filter(Boolean).join(' · '))}</small>` : ''}`, txt: (p) => `${p.libelle} ${p.marque} ${p.modele || ''} ${p.couleur || ''} ${p.taille || ''}` }, { t: 'Fournisseur', v: (p) => esc(p.marque), txt: (p) => p.marque },
      { t: 'Catégorie', v: (p) => (p.souscat ? `<small>${esc(D.cheminCategorie(p))}</small>` : `<small>${esc(D.categorie(p.categorie))}</small> <span class="pastille st-att">À classer</span>`), txt: (p) => D.cheminCategorie(p) },
      { t: 'Code-barres', v: (p) => `<span class="erp-gris">${esc(p.code_barres)}</span>`, txt: (p) => p.code_barres }, { t: 'Prix de vente', v: (p) => `${D.euros(p.prix[0])} HT`, nb: true },
      { t: 'Meilleur prix d’achat', v: (p) => { const m = meilleurAchat(p); return m ? `${D.euros(m.pu)} HT` : '—'; }, nb: true }, { t: 'Stock désiré', v: (p) => String(p.optimal), nb: true },
      { t: 'Stock physique', v: (p) => alerteStock(p), nb: true }, { t: 'Stock virtuel', v: (p) => pastilleVirtuel(D.stockVirtuel(db, p), p.alerte || 0), nb: true },
      { t: 'Vente', v: (p) => (p.en_vente ? '<span class="pastille st-ok">En vente</span>' : '<span class="pastille st-neutre">Hors vente</span>') }, { t: 'Achat', v: (p) => (p.en_achat ? '<span class="pastille st-ok">En achat</span>' : '<span class="pastille st-neutre">Hors achat</span>') },
    ];
    const cols = cols0.map((c) => ({ ...c, v: (o) => (o._m ? (colsM[c.t] ? colsM[c.t](o) : '<span class="erp-gris">—</span>') : c.v(o)), txt: (o) => (o._m ? `${o.ref} ${o.libelle} ${o.marque} variantes` : c.txt ? c.txt(o) : '') }));
    const q = D.rechercheProduits || ''; D.rechercheProduits = '';
    return { html: `${U.titrePage('◇', 'Produits', lignes.length, `${U.btn('+ Produit à variantes', '', 'btn-ligne', 'data-aller="modeles/nouveau"')}${U.btn('+ Nouveau produit', '', 'btn-metal', 'data-aller="produits/nouveau"')}`)}${legendeStock()}<div data-liste></div>`,
      apres: (el) => U.liste(el.querySelector('[data-liste]'), { cols, lignes, q, lien: (p) => (p._m ? `modeles/fiche/${p.id}` : `produits/fiche/${p.id}`), etats: [['_variantes', 'Produits à variantes'], ...D.CATEGORIES], etat: cat || '', filtre: (p, c) => (c === '_variantes' ? !!p._m : p.categorie === c) }) };
  }

  // ---------- nouveau produit : page 1 puis page 2 ----------
  // « Fournisseur » affiché (demande de l'utilisateur, 10 nov. 2026) ; la donnée reste p.marque. Suggestions : fournisseurs du CRM + valeurs déjà saisies.
  const marques = (db) => [...new Set([...db.tiers.filter((t) => t.fournisseur).map((t) => t.nom), ...db.produits.map((p) => p.marque)].filter(Boolean))].sort((a, b) => a.localeCompare(b));
  function nouveau(v, page) {
    const db = v.db;
    if (page === 2 && !brouillon) page = 1;
    const b = brouillon || { ref: '', libelle: '', en_vente: true, en_achat: true, code_barres: '', marque: '', categorie: D.CATEGORIES[0][0], description: '', url: '', entrepot: 'Showroom', alerte: '', optimal: '', poids: '' };
    if (page === 1) {
      const corps = `${U.etapes(1, 2, ['Identité et stock', 'Prix, TVA et comptabilité'])}
        <p class="erp-rappel">Plusieurs couleurs ou tailles (ex. un T-shirt) ? ${U.lien('modeles/nouveau', 'Créer plutôt un produit à variantes ›')}</p>
        ${U.ligne('Réf. produit', U.inp('ref', b.ref, { req: true, ph: 'Ex. : VIS-SPX-4X40' }), { req: true })}${U.ligne('Libellé', U.inp('libelle', b.libelle, { req: true }), { req: true })}
        <div class="erp-2f">${U.ligne('État (Vente)', U.sel('en_vente', [['1', 'En vente'], ['', 'Hors vente']], b.en_vente ? '1' : ''))}${U.ligne('État (Achat)', U.sel('en_achat', [['1', 'En achat'], ['', 'Hors achat']], b.en_achat ? '1' : ''))}</div>
        ${U.ligne('Valeur du code-barres (EAN13)', U.inp('code_barres', b.code_barres, { ph: '13 chiffres' }))}
        ${D.champsCategorie(b)}
        ${blocImage(b)}
        ${U.blocMedias(db, b)}
        ${blocWeb(db, b)}
        ${U.ligne('Description', U.area('description', b.description, 4), { large: true })}
        ${U.ligne('URL publique', U.inp('url', b.url, { ph: 'https://fmdistrib.fr/…' }))}
        <div class="erp-2f">${'<input type="hidden" name="entrepot" value="Magasin">'}${U.ligne('Poids (kg)', U.inp('poids', b.poids, { type: 'number', step: '0.01', min: 0 }))}</div>
        <div class="erp-2f">${U.ligne('Limite stock pour alerte', U.inp('alerte', b.alerte, { type: 'number', min: 0 }))}${U.ligne('Stock désiré optimal', U.inp('optimal', b.optimal, { type: 'number', min: 0 }))}</div>`;
      return { html: `${U.titrePage('◇', 'Nouveau produit — page 1 sur 2')}${U.form('erp-f', corps, `${U.btn('Suivant : prix et TVA ›', 'ok', 'btn-metal', 'type="submit"')}${U.btn('Annuler', 'annuler', 'btn-ligne')}`)}`,
        apres: (el) => { const f = el.querySelector('#erp-f'); const imageChoisie = lierImage(el, b, v); const medias = U.lierMedias(el, v, db); D.lierChampsCategorie(el);
          f.querySelector('[data-act="annuler"]').addEventListener('click', () => { brouillon = null; v.aller('produits/liste'); });
          f.addEventListener('submit', (e) => { e.preventDefault(); const d = U.lire(f);
            if (db.produits.some((p) => p.ref.toLowerCase() === d.ref.toLowerCase())) { v.fenetre('Référence déjà utilisée', `<p>La référence « ${esc(d.ref)} » existe déjà dans le catalogue.</p>`, '<button type="button" class="btn btn-metal" data-fermer>Compris</button>'); return; }
            brouillon = { ...b, ...d, en_vente: d.en_vente === '1', en_achat: d.en_achat === '1', image: imageChoisie(), galerie: medias.galerie(), certifs: medias.certifs(), ...champsWeb(d) }; v.aller('produits/nouveau/2'); }); } };
    }
    // Fournisseur + prix d'achat obligatoires (21 nov. 2026, demande : « à la création d'une référence il faut renseigner le
    // fournisseur et le prix d'achat obligatoirement » → seules ses références sont proposées dans ses commandes).
    const fournsP = db.tiers.filter((x) => x.fournisseur).sort((a, z) => String(a.nom).localeCompare(String(z.nom)));
    const corps = `${U.etapes(2, 2, ['Identité et stock', 'Prix, TVA et comptabilité'])}
      <p class="erp-rappel"><b>${esc(b.ref)}</b> — ${esc(b.libelle)} ${U.lien('produits/nouveau', '‹ Revenir à la page 1')}</p>
      <div class="erp-2f">${U.ligne('Prix net HT', U.inp('pu', '', { type: 'number', step: '0.01', min: 0, req: true }), { req: true })}${U.ligne('Prix de vente minimum HT', U.inp('prix_min', '', { type: 'number', step: '0.01', min: 0 }))}</div>
      ${U.ligne('Remise max à l’unité (%)', U.inp('remise_max', '', { type: 'number', step: '0.5', min: 0, ph: `${D.REMISE_MAX_DEFAUT} (par défaut)` }), { aide: 'Remises par quantité et prix promo : onglet « Prix de vente » du produit.' })}
      ${fournsP.length ? '' : `<p class="erp-moins">Aucun fournisseur dans les Tiers : ${U.lien('tiers/nouveau/F', 'créez d’abord le fournisseur')}, puis revenez ici (le produit en cours est gardé).</p>`}
      <div class="erp-2f">${U.ligne('Fournisseur', U.sel('fournisseur', fournsP.map((x) => [x.id, x.nom]), b.fournisseur || '', { req: true, vide: 'Sélectionner un fournisseur' }), { req: true, aide: 'Obligatoire : le produit sera proposé dans les commandes de ce fournisseur.' })}${U.ligne('Réf. produit chez le fournisseur', U.inp('ref_fourn', b.ref_fourn || ''))}</div>
      <div class="erp-2f">${U.ligne('Prix d’achat HT', U.inp('pa', b.pa || '', { type: 'number', step: '0.01', min: 0.01, req: true }), { req: true, aide: 'Obligatoire : prix chez ce fournisseur (sert aussi de prix de revient).' })}</div>
      ${U.ligne('TVA', `<span class="erp-gris">${D.TEXTE_TVA}</span>`)}
      ${U.ligne('Stock initial', U.inp('stock', '0', { type: 'number', min: 0 }))}
      ${U.ligne('Note (non visible sur les factures, propositions…)', U.area('note', '', 3), { large: true })}
      <div class="erp-2f">${U.ligne('Code comptable (vente)', U.inp('cpt_vente', '707100'))}${U.ligne('Code comptable (achat)', U.inp('cpt_achat', '607100'))}</div>`;
    return { html: `${U.titrePage('◇', 'Nouveau produit — page 2 sur 2')}${U.form('erp-f', corps, `${U.btn('Créer le produit', 'ok', 'btn-metal', 'type="submit"')}${U.btn('‹ Page 1', '', 'btn-ligne', 'data-aller="produits/nouveau"')}${U.btn('Annuler', 'annuler', 'btn-ligne')}`)}`,
      apres: (el) => { const f = el.querySelector('#erp-f'); U.selectsCherchables(el);
        f.querySelector('[data-act="annuler"]').addEventListener('click', () => { brouillon = null; v.aller('produits/liste'); });
        f.addEventListener('submit', (e) => { e.preventDefault(); const d = U.lire(f); const pu = +d.pu || 0; const pa = D.arrondi(+d.pa || 0);
          if (!d.fournisseur || !(pa > 0)) { v.notifier('Fournisseur et prix d’achat obligatoires.'); return; }
          const p = { id: D.id('p'), ref: b.ref, libelle: b.libelle, marque: b.marque, categorie: b.categorie, souscat: b.souscat || '', soussouscat: b.soussouscat || '', code_barres: b.code_barres, en_vente: b.en_vente, en_achat: b.en_achat, description: b.description, url: b.url, image: b.image || '', galerie: b.galerie || [], certifs: b.certifs || [], ...champsWeb(b),
            entrepot: b.entrepot, poids: +b.poids || 0, alerte: +b.alerte || 0, optimal: +b.optimal || 0, prix: [pu, pu, pu, pu], remise_max: d.remise_max === '' ? null : +d.remise_max, remises_qte: [],
            prix_min: +d.prix_min || 0, pmp: pa, tva: D.TVA, tva_achat: D.TVA, stock: 0, note: d.note, cpt_vente: d.cpt_vente, cpt_achat: d.cpt_achat, fournisseurs: [{ tiers: d.fournisseur, ref: d.ref_fourn || '', qte_min: 1, pu: pa, remise: 0, delai: 0, depuis: D.auj() }], historique: [{ d: D.maintenant(), niveau: 1, pu, par: D.MOI }], cree: D.maintenant() };
          D.toucher(p); db.produits.push(p); if (+d.stock) D.mouvement(db, p.id, +d.stock, 'Stock initial');
          D.evt(db, `Produit ${p.ref} créé`, { objet: { type: 'produit', id: p.id } }); brouillon = null; v.sauver(); v.notifier(`Produit ${p.ref} créé.`); v.aller(`produits/fiche/${p.id}`); }); } };
  }

  function modifier(v, p) {
    const db = v.db; if (!p) return { html: U.vide('Produit introuvable') };
    const corps = `${U.ligne('Réf. produit', U.inp('ref', p.ref, { req: true }), { req: true })}${U.ligne('Libellé', U.inp('libelle', p.libelle, { req: true }), { req: true })}
      <div class="erp-2f">${U.ligne('État (Vente)', U.sel('en_vente', [['1', 'En vente'], ['', 'Hors vente']], p.en_vente ? '1' : ''))}${U.ligne('État (Achat)', U.sel('en_achat', [['1', 'En achat'], ['', 'Hors achat']], p.en_achat ? '1' : ''))}</div>
      <div class="erp-2f">${U.ligne('Code-barres', U.inp('code_barres', p.code_barres))}${U.ligne('Fournisseur', `${U.inp('marque', p.marque, { list: 'erp-marques', ph: 'Ex. : Payper, Fischer…' })}<datalist id="erp-marques">${marques(db).map((m) => `<option value="${esc(m)}">`).join('')}</datalist>`)}</div>
      ${D.champsCategorie(p)}
      ${U.ligne('TVA', `<span class="erp-gris">${D.TEXTE_TVA}</span>`)}
      ${U.ligne('Description', U.area('description', p.description, 4), { large: true })}${U.ligne('URL publique', U.inp('url', p.url))}
      <div class="erp-2f">${'<input type="hidden" name="entrepot" value="Magasin">'}${U.ligne('Poids (kg)', U.inp('poids', p.poids, { type: 'number', step: '0.01', min: 0 }))}</div>
      ${p.modele_id ? `<div class="erp-2f">${U.ligne('Couleur', U.inp('couleur', p.couleur || ''))}${U.ligne('Taille', U.inp('taille', p.taille || ''))}</div>
        ${((D.modele(db, p.modele_id) || {}).axes || []).map((ax, j) => U.ligne(ax, U.inp('ax_' + j, D.valeurAxe(p, ax)))).join('')}` : ''}
      ${blocImage(p)}
      ${p.modele_id ? '<p class="erp-rappel">Photos supplémentaires et certifications : réglées dans le produit à variantes (communes à toutes ses variantes).</p>' : U.blocMedias(db, p)}
      ${blocWeb(db, p)}`;
    const mo = p.modele_id && D.modele(db, p.modele_id);
    return { html: `${U.titrePage('◇', `Modifier ${p.ref}`)}${mo ? `<p class="erp-rappel">Variante de ${U.lien(`modeles/fiche/${mo.id}`, `<b>${esc(mo.nom)}</b>`)} : ce que vous modifiez ici ne concerne que cette référence.</p>` : ''}${U.form('erp-f', corps, `${U.btn('Enregistrer', 'ok', 'btn-metal', 'type="submit"')}${U.btn('Annuler', '', 'btn-ligne', `data-aller="produits/fiche/${p.id}"`)}`)}`,
      apres: (el) => { const imageChoisie = lierImage(el, p, v); const medias = p.modele_id ? null : U.lierMedias(el, v, db); D.lierChampsCategorie(el); el.querySelector('#erp-f').addEventListener('submit', (e) => { e.preventDefault(); const d = U.lire(e.target);
        if (db.produits.some((x) => x.id !== p.id && x.ref.toLowerCase() === d.ref.toLowerCase())) { v.fenetre('Référence déjà utilisée', `<p>La référence « ${esc(d.ref)} » existe déjà dans le catalogue.</p>`, '<button type="button" class="btn btn-metal" data-fermer>Compris</button>'); return; }
        Object.assign(p, { image: imageChoisie(), ref: d.ref, libelle: d.libelle, en_vente: d.en_vente === '1', en_achat: d.en_achat === '1', code_barres: d.code_barres, marque: d.marque, categorie: d.categorie, souscat: d.souscat || '', soussouscat: d.soussouscat || '', tva: D.TVA, tva_achat: D.TVA, description: d.description, url: d.url, entrepot: d.entrepot, poids: +d.poids || 0, ...champsWeb(d), ...(medias ? { galerie: medias.galerie(), certifs: medias.certifs() } : {}) });
        if (p.modele_id) { p.couleur = d.couleur || ''; p.taille = (d.taille || '').toUpperCase();
          const axes = (D.modele(db, p.modele_id) || {}).axes || []; p.attributs = Object.fromEntries(axes.map((ax, j) => [ax, String(d['ax_' + j] || '').trim()]).filter((x) => x[1])); const mo2 = D.modele(db, p.modele_id); p.image_perso = !!p.image && (!mo2 || p.image !== D.imageVariante(mo2, p)); }
        D.toucher(p); D.evt(db, `Produit ${p.ref} modifié`, { objet: { type: 'produit', id: p.id } }); v.sauver(); v.aller(`produits/fiche/${p.id}`); }); } };
  }

  function fiche(v, id, onglet) {
    const db = v.db; const p = D.produit(db, id);
    if (!p) return { html: `<div class="erp-vide-page"><h1>Produit introuvable</h1>${U.lien('produits/liste', 'Retour à la liste')}</div>` };
    const evts = db.evenements.filter((e) => e.objet && e.objet.type === 'produit' && e.objet.id === id);
    const mvts = db.mouvements.filter((m) => m.produit === id);
    const onglets = [['produit', 'Produit'], ['vente', 'Prix de vente'], ['achat', 'Prix d’achat', (p.fournisseurs || []).length], ['stock', 'Stock'], ['site', 'Site web', p.modele_id ? D.variantes(db, p).length : 0], ['stats', 'Statistiques'], ['notes', 'Notes'], ['evenements', 'Événements', evts.length]];
    const vois = U.voisins([...db.produits].sort((a, b) => a.ref.localeCompare(b.ref)), id, (o) => `produits/fiche/${o.id}/${onglet}`);
    const tete = U.fiche({ ico: U.vignetteProduit(p, 64), logo: !!p.image, vignetteAct: 'image-produit', titre: esc(p.ref), sous: `<p class="erp-gris">${esc(p.libelle)}</p>${p.code_barres ? `<p class="erp-codebarre" aria-label="Code-barres">${esc(p.code_barres)}</p>` : ''}`,
      pastilles: `${p.en_vente ? '<span class="pastille st-ok">En vente</span>' : '<span class="pastille st-neutre">Hors vente</span>'} ${p.en_achat ? '<span class="pastille st-ok">En achat</span>' : '<span class="pastille st-neutre">Hors achat</span>'}`,
      retour: 'produits/liste', ...vois, onglets, actif: onglet, base: `produits/fiche/${id}` });
    let corps = '', apres = null;
    const evtP = (t) => D.evt(db, t, { objet: { type: 'produit', id } });

    if (onglet === 'produit') {
      const m = meilleurAchat(p);
      corps = `<div class="erp-carte erp-2c">${U.infos([['Type', 'Produit'], ['Fournisseur', esc(p.marque)], ['Catégorie', esc(D.cheminCategorie(p)) + (p.souscat ? '' : ' <span class="pastille st-att">À classer</span>')], ['Produit à variantes', p.modele_id && D.modele(db, p.modele_id) ? U.lien(`modeles/fiche/${p.modele_id}`, esc(D.modele(db, p.modele_id).nom)) : ''], ['Couleur', esc(p.couleur)], ['Taille', esc(p.taille)], ['Rayon du site', D.surLeSite(p) ? esc(D.nomRayon(D.rayonSite(p))) : 'Non affiché sur le site'], ['Code-barres (EAN13)', esc(p.code_barres)], ['TVA à la vente', '20 %'], ['TVA à l’achat', 'Selon le fournisseur : 20 % (France) · 0 % hors France (autoliquidation)'], ['Code comptable (vente)', esc(p.cpt_vente || '707100')], ['Code comptable (achat)', esc(p.cpt_achat || '607100')], ['URL publique', p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.url)}</a>` : '']])}
        ${U.infos([['Prix de vente (public)', `${D.euros(p.prix[0])} HT · ${D.euros(p.prix[0] * (1 + p.tva / 100))} TTC`], ['Prix moyen pondéré (PMP)', `${D.euros(p.pmp)} HT`], ['Meilleur prix d’achat', m ? `${D.euros(m.pu)} HT` : '—'], ['Prix de revient (pour les marges)', `${D.euros(D.prixRevient(p))} HT${+p.pmp > 0 ? ' (PMP)' : D.prixRevient(p) ? ' (meilleur prix d’achat)' : ''}`], ['Marge (prix public)', p.prix[0] ? D.margeTxt(p.prix[0], D.prixRevient(p)) : '—'], ['Stock physique', alerteStock(p)], ['Stock virtuel', pastilleVirtuel(D.stockVirtuel(db, p), p.alerte || 0)], ['Poids', p.poids ? `${D.nombre(p.poids)} kg` : ''], ['Description', esc(p.description)]])}</div>
        ${U.boutons([U.btn('Modifier', '', 'btn-metal', `data-aller="produits/modifier/${id}"`), U.btn('Cloner', 'cloner', 'btn-ligne'), p.modele_id ? U.btn('Gérer les variantes', '', 'btn-ligne', `data-aller="modeles/fiche/${p.modele_id}"`) : '', U.btn('Supprimer', 'suppr', 'btn-ligne erp-danger')])}
        <div class="erp-2col"><div class="erp-col">${U.bloc('Derniers mouvements de stock', tableMvts(db, mvts.slice(0, 5), true))}</div><div class="erp-col">${U.bloc('Les 10 derniers événements', U.derniersEvt(evts))}</div></div>`;
      apres = (el) => el.addEventListener('click', (e) => { const b = e.target.closest('[data-act]'); if (!b) return;
        if (b.dataset.act === 'cloner' && !D.aFournisseur(p)) { v.fenetre('Copie impossible', `<p>« ${esc(p.ref)} » n’a pas de fournisseur avec un prix d’achat. Ajoutez-en un (onglet « Prix d’achat ») avant de le copier : toute nouvelle référence doit avoir son fournisseur et son prix d’achat.</p>`, '<button type="button" class="btn btn-metal" data-fermer>Compris</button>'); return; }
        if (b.dataset.act === 'cloner') { const c = { ...JSON.parse(JSON.stringify(p)), id: D.id('p'), ref: p.ref + '-COPIE', stock: 0, cree: D.maintenant() }; D.toucher(c); db.produits.push(c); D.evt(db, `Produit ${c.ref} créé (copie de ${p.ref})`, { objet: { type: 'produit', id: c.id } }); v.sauver(); v.aller(`produits/modifier/${c.id}`); }
        if (b.dataset.act === 'suppr') { const lie = [db.propositions, db.commandes, db.factures, db.achats].some((l) => l.some((d) => d.lignes.some((x) => x.produit === id)));
          if (lie) { v.fenetre('Suppression impossible', '<p>Ce produit est utilisé dans des documents. Passez-le plutôt « Hors vente » et « Hors achat » (bouton Modifier).</p>', '<button type="button" class="btn btn-metal" data-fermer>Compris</button>'); return; }
          v.confirmer(`Supprimer ${p.ref} ?`, 'Cette action ne peut pas être annulée.', 'Supprimer', () => { db.produits = db.produits.filter((x) => x.id !== id); db.prixClients = db.prixClients.filter((x) => x.produit !== id); v.sauver(); v.aller('produits/liste'); }); } });
    } else if (onglet === 'site') {
      const mo = p.modele_id && D.modele(db, p.modele_id);
      const vs = mo ? D.variantes(db, p).sort((a, b) => String(a.couleur || '').localeCompare(String(b.couleur || '')) || D.ordreTaille(a.taille) - D.ordreTaille(b.taille)) : [];
      const pastilleCouleur = (c) => (c ? `<span class="erp-couleur"><i style="background:${D.teinte(c) || 'transparent'}"></i>${esc(c)}</span>` : '—');
      corps = `<div class="erp-carte erp-2c">${U.infos([['Sur le site', D.surLeSite(p) ? '<span class="pastille st-ok">Affiché</span>' : `<span class="pastille st-neutre">Non affiché</span> ${p.en_vente === false ? '(hors vente)' : ''}`], ['Rayon du site', `${esc(D.nomRayon(D.rayonSite(p)))}${p.web_rayon ? '' : ' <span class="erp-gris">(automatique)</span>'}`], ['Prix affiché', `${D.euros(p.prix[0])} HT`], ['Stock affiché', p.stock > 0 ? 'En stock au comptoir' : 'Sur commande'], ['Image (URL)', p.image && !/^data:/.test(p.image) ? `<span class="erp-gris">${esc(p.image)}</span>` : '']])}
        ${U.infos([['Produit à variantes', mo ? U.lien(`modeles/fiche/${mo.id}`, `<b>${esc(mo.nom)}</b>`) : '<span class="erp-gris">Non : produit simple</span>'], ['Couleur', mo ? pastilleCouleur(p.couleur) : ''], ['Taille', mo ? esc(p.taille) || '—' : ''], ['Variantes', mo ? String(vs.length) : '']])}</div>
        ${mo ? U.boutons([U.btn('Gérer les variantes', '', 'btn-metal', `data-aller="modeles/fiche/${mo.id}"`)]) : U.boutons([U.btn('Modifier', '', 'btn-metal', `data-aller="produits/modifier/${id}"`)])}
        ${mo ? U.bloc(`Variantes de « ${mo.nom} »`, U.table([['Réf.', (x) => `${U.lien(`produits/fiche/${x.id}/site`, `<b>${esc(x.ref)}</b>`)}${x.id === id ? ' <span class="pastille">cette fiche</span>' : ''}`], ['Couleur', (x) => pastilleCouleur(x.couleur)], ['Taille', (x) => esc(x.taille) || '—'], ['Prix HT', (x) => D.euros(x.prix[0]), 'nb'], ['Stock', (x) => D.nombre(x.stock), 'nb']], vs), { compte: vs.length })
          : U.bloc('Plusieurs couleurs ou tailles ?', `<p class="erp-gris">Créez un « produit à variantes » : un seul écran pour toutes les couleurs et tailles, avec la référence, le code EAN, le prix d’achat, le prix de vente et le stock de chacune.</p>${U.boutons([U.btn('Nouveau produit à variantes', '', 'btn-ligne', 'data-aller="modeles/nouveau"')])}`)}`;
    } else if (onglet === 'vente') {
      const px = db.prixClients.filter((x) => x.produit === id);
      // Prix net, remise max à l'unité, remises par quantité, prix promo (23 nov. 2026, js/erp-prix.js). Niveaux de prix supprimés.
      const rq = [...(p.remises_qte || [])].sort((a, b) => a.qte - b.qte);
      corps = `<form class="erp-carte" id="erp-niv"><h3 class="erp-sous-titre">Prix de vente</h3><p class="erp-gris">Taux de TVA : ${D.nombre(p.tva)} %. Une remise au-delà de la remise autorisée doit être accordée par ${esc(D.VALIDEUR_ENCOURS || 'Farid Medegueb')} (commission 0 % sur la ligne).</p>
          <div class="erp-2f">${U.ligne('Prix net HT', U.inp('n0', p.prix[0], { type: 'number', step: '0.01', min: 0, req: true }), { req: true, aide: `TTC : ${D.euros(p.prix[0] * (1 + p.tva / 100))}` })}${U.ligne('Remise max à l’unité (%)', U.inp('remise_max', p.remise_max ?? '', { type: 'number', step: '0.5', min: 0, ph: `${D.REMISE_MAX_DEFAUT} (par défaut)` }), { aide: 'Vide = remise par défaut.' })}</div>
          <h3 class="erp-sous-titre">Remises par quantité</h3><p class="erp-gris">Remise maximale autorisée à partir d’une quantité (ex. 15 % dès 10 unités).</p>
          <table class="registre erp-table"><thead><tr><th class="nb">À partir de (unités)</th><th class="nb">Remise max (%)</th><th></th></tr></thead><tbody data-rq>
          ${[...rq, { qte: '', remise: '' }].map((x, i) => `<tr><td class="nb"><input name="rq_q${i}" type="number" min="1" step="1" value="${esc(x.qte)}" class="erp-inp-nb" aria-label="Quantité"></td><td class="nb"><input name="rq_r${i}" type="number" min="0" step="0.5" value="${esc(x.remise)}" class="erp-inp-nb" aria-label="Remise"></td><td>${x.qte !== '' ? `<button type="button" class="btn-icone" data-rq-suppr="${i}" title="Supprimer">✕</button>` : '<span class="erp-gris">nouvelle</span>'}</td></tr>`).join('')}</tbody></table>
          <h3 class="erp-sous-titre">Prix promo</h3>
          <div class="erp-2f">${U.ligne('Prix promo HT', U.inp('prix_promo', p.prix_promo || '', { type: 'number', step: '0.01', min: 0, ph: 'Aucun' }), { aide: D.promoActive(p) ? '● Promo en cours' : '' })}${U.ligne('Prix de vente minimum HT', U.inp('prix_min', p.prix_min, { type: 'number', step: '0.01', min: 0 }))}</div>
          <div class="erp-2f">${U.ligne('Promo du', U.inp('promo_du', p.promo_du || '', { type: 'date' }))}${U.ligne('au', U.inp('promo_au', p.promo_au || '', { type: 'date' }))}</div>
          ${U.boutons([U.btn('Enregistrer les prix', 'ok', 'btn-metal', 'type="submit"')])}</form>
        ${U.bloc('Prix différents pour chaque client', `${U.table([['Client', (x) => esc((D.tiers(db, x.tiers) || {}).nom || '—')], ['Pratiqué depuis', (x) => D.jour(x.depuis)], ['HT', (x) => `<b>${D.euros(x.pu)}</b>`, 'nb'], ['TTC', (x) => D.euros(x.pu * (1 + p.tva / 100)), 'nb'], ['Modifié par', (x) => esc(x.par)], ['', (x) => `<button type="button" class="btn-icone" data-suppr="${x.id}" title="Supprimer ce prix">✕</button>`]], px, { vide: 'Aucun prix client' })}
          <form class="erp-form-ligne" id="erp-pxc"><select name="tiers" required aria-label="Client"><option value="">Choisir un client…</option>${db.tiers.filter((t) => t.client || t.prospect).sort((a, b) => a.nom.localeCompare(b.nom)).map((t) => `<option value="${t.id}">${esc(t.nom)}</option>`).join('')}</select><input name="pu" type="number" step="0.01" min="0" placeholder="Prix HT" required aria-label="Prix HT"><button type="submit" class="btn petit btn-metal">Ajouter prix par client</button></form>`, { compte: px.length })}
        ${U.bloc('Historique des prix', U.table([['Pratiqués à partir du', (h) => D.jour(h.d)], ['HT', (h) => D.euros(h.pu), 'nb'], ['TTC', (h) => D.euros(h.pu * (1 + p.tva / 100)), 'nb'], ['Modifié par', (h) => esc(h.par)]], [...(p.historique || [])].reverse()))}`;
      apres = (el) => {
        el.querySelector('#erp-niv').addEventListener('submit', (e) => { e.preventDefault(); const d = U.lire(e.target);
          { const pu = +d.n0 || 0; if (pu !== p.prix[0]) { p.prix[0] = pu; (p.historique = p.historique || []).push({ d: D.maintenant(), niveau: 1, pu, par: D.MOI }); } }
          p.remise_max = d.remise_max === '' ? null : Math.max(0, +d.remise_max || 0);
          p.remises_qte = Object.keys(d).filter((k) => /^rq_q\d+$/.test(k)).map((k) => ({ qte: Math.round(+d[k] || 0), remise: +d['rq_r' + k.slice(4)] || 0 })).filter((x) => x.qte > 0 && x.remise > 0).sort((a, b) => a.qte - b.qte);
          p.prix_promo = +d.prix_promo > 0 ? +d.prix_promo : null; p.promo_du = d.promo_du || ''; p.promo_au = d.promo_au || '';
          p.prix_min = +d.prix_min || 0; D.toucher(p); evtP(`Prix de vente de ${p.ref} modifiés`); v.sauver(); v.notifier('Prix enregistrés.'); v.rendre(); });
        el.querySelector('#erp-pxc').addEventListener('submit', (e) => { e.preventDefault(); const d = U.lire(e.target); db.prixClients = db.prixClients.filter((x) => !(x.tiers === d.tiers && x.produit === id));
          db.prixClients.push({ id: D.id('px'), tiers: d.tiers, produit: id, pu: +d.pu, depuis: D.auj(), par: D.MOI }); D.evt(db, `Prix client ajouté pour ${p.ref} : ${D.euros(+d.pu)} HT`, { tiers: d.tiers, objet: { type: 'produit', id } }); v.sauver(); v.rendre(); });
        el.addEventListener('click', (e) => { const r = e.target.closest('[data-rq-suppr]'); if (r) { const tr = r.closest('tr'); tr.querySelectorAll('input').forEach((i) => { i.value = ''; }); tr.hidden = true; return; }
          const b = e.target.closest('[data-suppr]'); if (b) { db.prixClients = db.prixClients.filter((x) => x.id !== b.dataset.suppr); v.sauver(); v.rendre(); } });
      };
    } else if (onglet === 'achat') {
      const fourns = db.tiers.filter((t) => t.fournisseur).sort((a, b) => a.nom.localeCompare(b.nom)); const m = meilleurAchat(p);
      corps = `<div class="erp-carte">${U.infos([['Prix moyen pondéré (PMP)', `${D.euros(p.pmp)} HT`], ['Meilleur prix d’achat', m ? `${D.euros(m.pu)} HT chez ${esc((D.tiers(db, m.tiers) || {}).nom || '')}` : '—']])}</div>
        ${U.bloc('Ajouter un prix d’achat', U.form('erp-pa', `<div class="erp-2f">${U.ligne('Fournisseur', U.sel('tiers', fourns.map((t) => [t.id, t.nom]), '', { req: true, vide: 'Sélectionner un tiers' }), { req: true })}${U.ligne('Réf. produit fournisseur', U.inp('ref', '', { req: true }), { req: true })}</div>
          <div class="erp-2f">${U.ligne('Qté achat minimum', U.inp('qte_min', 1, { type: 'number', min: 1 }))}${U.ligne('Prix unitaire HT', U.inp('pu', '', { type: 'number', step: '0.01', min: 0, req: true }), { req: true })}</div>
          <div class="erp-2f">${U.ligne('Remise pour cette qté (%)', U.inp('remise', 0, { type: 'number', step: '0.5', min: 0 }))}${U.ligne('Délai de livraison (jours)', U.inp('delai', '', { type: 'number', min: 0 }))}</div>`, U.btn('Enregistrer', 'ok', 'btn-metal', 'type="submit"')))}
        ${U.bloc('Prix fournisseurs', U.table([['Pratiqué depuis', (f) => D.jour(f.depuis)], ['Fournisseur', (f) => esc((D.tiers(db, f.tiers) || {}).nom || '—')], ['Réf. produit fournisseur', (f) => esc(f.ref)], ['Qté min.', (f) => String(f.qte_min), 'nb'], ['Prix unitaire HT', (f) => `<b>${D.euros(f.pu)}</b>`, 'nb'], ['Remise', (f) => (f.remise ? `${f.remise} %` : ''), 'nb'], ['Délai', (f) => (f.delai ? `${f.delai} j` : ''), 'nb'], ['', (f) => `<button type="button" class="btn-icone" data-suppr="${f.tiers}" title="Supprimer">✕</button>`]], p.fournisseurs || [], { vide: 'Aucun' }), { compte: (p.fournisseurs || []).length })}`;
      apres = (el) => {
        el.querySelector('#erp-pa').addEventListener('submit', (e) => { e.preventDefault(); const d = U.lire(e.target); p.fournisseurs = (p.fournisseurs || []).filter((f) => f.tiers !== d.tiers);
          p.fournisseurs.push({ tiers: d.tiers, ref: d.ref, qte_min: +d.qte_min || 1, pu: +d.pu, remise: +d.remise || 0, delai: +d.delai || 0, depuis: D.auj() }); D.toucher(p); evtP(`Prix d’achat de ${p.ref} ajouté (${D.euros(+d.pu)} HT)`); v.sauver(); v.rendre(); });
        el.addEventListener('click', (e) => { const b = e.target.closest('[data-suppr]'); if (b) { p.fournisseurs = p.fournisseurs.filter((f) => f.tiers !== b.dataset.suppr); v.sauver(); v.rendre(); } });
      };
    } else if (onglet === 'stock') {
      corps = `<div class="erp-carte erp-2c">${U.infos([['Prix moyen pondéré (PMP)', `${D.euros(p.pmp)} HT`], ['Prix de vente', `${D.euros(p.prix[0])} HT`], ['Valorisation achat (PMP)', D.euros(D.prixRevient(p) * Math.max(0, p.stock))], ['Valeur à la vente', D.euros(p.prix[0] * Math.max(0, p.stock))]])}
        ${U.infos([['Limite stock pour alerte', String(p.alerte)], ['Stock désiré optimal', String(p.optimal)], ['Stock physique', alerteStock(p)], ['Réservé (propositions et commandes en cours, brouillons compris)', D.nombre(reserve(db, id))], ['Attendu (commandes fournisseurs)', D.nombre(attendu(db, id))], ['Stock virtuel', pastilleVirtuel(D.stockVirtuel(db, p), p.alerte || 0)], ['Dernier mouvement', mvts[0] ? D.jour(mvts[0].d) : '—']])}</div>
        <div class="erp-2col"><div class="erp-col">${U.bloc('Corriger le stock', U.form('erp-cs', `${U.ligne('Type', U.sel('nature', [['manuel', 'Correction manuelle (+ / −)'], ['inventaire', 'Inventaire (quantité comptée)']], 'manuel'))}${U.ligne('Quantité (+ pour ajouter, − pour retirer)', U.inp('qte', '', { type: 'number', step: '1', req: true }), { req: true })}${U.ligne('Motif', U.inp('motif', '', { ph: 'Ex. casse, erreur de saisie…' }))}`, U.btn('Corriger le stock', 'ok', 'btn-metal', 'type="submit"')))}</div>
        <div class="erp-col">${U.bloc('Définir la limite d’alerte et le stock désiré', U.form('erp-al', `${U.ligne('Limite stock pour alerte', U.inp('alerte', p.alerte, { type: 'number', min: 0 }))}${U.ligne('Stock désiré optimal', U.inp('optimal', p.optimal, { type: 'number', min: 0 }))}`, U.btn('Enregistrer', 'ok', 'btn-metal', 'type="submit"')))}</div></div>
        ${U.bloc('Historique des mouvements de stock', '<div data-mvts></div>', { compte: mvts.length })}`;
      apres = (el) => {
        listeMvts(el.querySelector('[data-mvts]'), db, mvts, false);
        // Inventaire : on saisit la quantité comptée, le mouvement = l'écart avec le stock enregistré.
        const fcs = el.querySelector('#erp-cs'); const libQ = fcs.querySelector('[name="qte"]').closest('.erp-ligne-f').querySelector('label');
        fcs.querySelector('[name="nature"]').addEventListener('change', (e) => { libQ.textContent = e.target.value === 'inventaire' ? `Quantité comptée (stock enregistré : ${D.nombre(p.stock || 0)})` : 'Quantité (+ pour ajouter, − pour retirer)'; });
        fcs.addEventListener('submit', (e) => { e.preventDefault(); const d = U.lire(e.target); const inv = d.nature === 'inventaire';
          if (d.qte === '' || Number.isNaN(+d.qte)) return; const q = inv ? D.arrondi(+d.qte - (p.stock || 0)) : +d.qte;
          if (!q) { v.notifier(inv ? 'Inventaire : le stock compté est déjà le bon, rien à corriger.' : 'Quantité à 0 : rien à corriger.'); return; }
          D.mouvement(db, id, q, d.motif || (inv ? `Inventaire (compté : ${D.nombre(+d.qte)})` : 'Correction manuelle'), { nature: inv ? 'inventaire' : 'manuel' });
          evtP(`Stock de ${p.ref} ${inv ? 'inventorié' : 'corrigé'} (${q > 0 ? '+' : ''}${q})`); v.sauver(); v.rendre(); });
        el.querySelector('#erp-al').addEventListener('submit', (e) => { e.preventDefault(); const d = U.lire(e.target); p.alerte = +d.alerte || 0; p.optimal = +d.optimal || 0; D.toucher(p); v.sauver(); v.notifier('Limites enregistrées.'); v.rendre(); });
      };
    } else if (onglet === 'stats') {
      const per = U.bornes(U.periode('produit-stats', 'annee'), ansCmd(db)); const q = per.unites.map(() => 0), ca = per.unites.map(() => 0); const parClient = {};
      ventesPeriode(db, per, id).forEach(({ c, x: l }) => { const i = per.index(c); if (i >= 0) { q[i] += l.qte; ca[i] += D.htLigne(l); } parClient[c.tiers] = (parClient[c.tiers] || 0) + D.htLigne(l); });
      const top = Object.entries(parClient).sort((a, b) => b[1] - a[1]).slice(0, 5);
      corps = `${U.choixPeriode('produit-stats', 'annee')}<div class="erp-2col"><div class="erp-col">${U.bloc(`Quantités vendues — ${per.lib}`, U.barresP(q, per, D.nombre), { ico: 'stats', compte: D.nombre(q.reduce((s, x) => s + x, 0)) })}${U.bloc(`Chiffre d’affaires HT — ${per.lib}`, U.barresP(ca, per, U.court), { ico: 'stats', compte: D.eurosRond(ca.reduce((s, x) => s + x, 0)) })}</div>
        <div class="erp-col">${U.bloc('Meilleurs clients pour ce produit', U.table([['Client', (x) => esc((D.tiers(db, x[0]) || {}).nom || '—')], ['CA HT', (x) => D.euros(x[1]), 'nb']], top, { lien: (x) => `tiers/fiche/${x[0]}/client`, vide: 'Pas vendu sur cette période' }))}</div></div>`;
    } else if (onglet === 'notes') {
      corps = `<form class="erp-carte erp-notes" id="erp-notes"><label>Description (visible sur les documents)<textarea name="description" rows="5">${esc(p.description)}</textarea></label><label>Note (non visible sur les factures, propositions…)<textarea name="note" rows="6">${esc(p.note)}</textarea></label><div>${U.btn('Enregistrer', 'ok', 'btn-metal', 'type="submit"')}</div></form>`;
      apres = (el) => el.querySelector('#erp-notes').addEventListener('submit', (e) => { e.preventDefault(); const d = U.lire(e.target); p.description = d.description; p.note = d.note; D.toucher(p); v.sauver(); v.notifier('Notes enregistrées.'); v.rendre(); });
    } else if (onglet === 'evenements') {
      corps = U.bloc('Événements sur ce produit', U.chronologie(evts), { compte: evts.length });
    }
    const apresFiche = (el) => {
      if (apres) apres(el);
      const vg = el.querySelector('[data-act="image-produit"]'); if (!vg) return;
      const mo = p.modele_id && D.modele(db, p.modele_id); const coul = String(p.couleur || '').trim();
      const ouvrir = () => U.choisirImage(v, { titre: `Image de ${p.ref}`, actuelle: p.image, apercu: (x) => U.vignetteProduit({ ...p, image: x }, 160), ...OPT_IMG_PRODUIT }, (x) => {
        if (mo) { p.image_perso = !!x; p.image = x || D.imageVariante(mo, p); } else p.image = x;
        D.toucher(p);
        evtP(`Image de ${p.ref} ${x ? 'modifiée' : 'retirée'}`); v.sauver(); v.rendre(); });
      vg.title = 'Changer l’image';
      vg.addEventListener('click', (e) => { e.stopPropagation(); ouvrir(); }); vg.addEventListener('keydown', (e) => { if (e.key === 'Enter') ouvrir(); });
    };
    return { html: tete + corps, apres: apresFiche };
  }

  function stats(v) {
    const db = v.db; const per = U.bornes(U.periode('produits-stats', 'annee'), ansCmd(db)); const ventes = {}; const caP = per.unites.map(() => 0);
    ventesPeriode(db, per).forEach(({ c, x: l }) => { const x = ventes[l.produit] || (ventes[l.produit] = { q: 0, ca: 0, marge: 0 }); const p = D.produit(db, l.produit); x.q += l.qte; x.ca += D.htLigne(l); x.marge += D.htLigne(l) - D.paLigne(db, l) * l.qte; const i = per.index(c); if (i >= 0) caP[i] += D.htLigne(l); });
    const top = Object.entries(ventes).sort((a, b) => b[1].ca - a[1].ca);
    const parts = D.CATEGORIES.map(([id, l], i) => ({ l, v: Math.round(top.filter(([pid]) => (D.produit(db, pid) || {}).categorie === id).reduce((s, x) => s + x[1].ca, 0)), c: U.COUL['c' + ((i % 5) + 1)], r: `produits/liste/${id}` }));
    return { html: `${U.titrePage('◇', 'Statistiques des produits')}${U.choixPeriode('produits-stats', 'annee')}<div class="erp-2col"><div class="erp-col">${U.bloc(`Chiffre d’affaires HT — ${per.lib}`, U.barresP(caP, per, U.court), { ico: 'stats', compte: D.eurosRond(caP.reduce((a, x) => a + x, 0)) })}${U.bloc(`Chiffre d’affaires par catégorie — ${per.lib}`, U.donut(parts, U.court(parts.reduce((s, x) => s + x.v, 0)), 'HT commandé', { fmt: D.eurosRond }))}</div>
      <div class="erp-col">${U.bloc(`Produits les plus vendus — ${per.lib}`, U.table([['Image', ([pid]) => { const p = D.produit(db, pid); return p ? U.vignetteProduit(p, 40) : ''; }, 'erp-col-img'], ['Produit', ([pid]) => { const p = D.produit(db, pid); return p ? `<b>${esc(p.ref)}</b> ${esc(p.libelle)}` : '—'; }], ['Qté', ([, x]) => D.nombre(x.q), 'nb'], ['CA HT', ([, x]) => D.euros(x.ca), 'nb'], ['Marge', ([, x]) => D.euros(x.marge), 'nb'], ['Coef.', ([, x]) => D.coefTxt(x.ca, x.ca - x.marge).replace('coef. ', '') || '—', 'nb']], top.slice(0, 12), { lien: ([pid]) => `produits/fiche/${pid}/stats` }))}</div></div>` };
  }

  // ---------- stocks, réapprovisionnement, mouvements, magasin 3D ----------
  // Articles à commander : stock virtuel sous le stock désiré (p.optimal), ou, sans stock désiré, sous le seuil d'alerte.
  // Quantité = de quoi revenir au stock désiré (au moins la quantité minimum du fournisseur). Fournisseur = meilleur prix.
  D.besoinsReappro = (db) => db.produits.filter((p) => p.en_achat !== false).map((p) => { const virt = D.stockVirtuel(db, p); const opt = +p.optimal || 0; const al = +p.alerte || 0;
    if (!(opt > 0 ? virt < opt : al > 0 && virt <= al)) return null; const f = meilleurAchat(p);
    return { p, virt, f, qte: Math.max(1, Math.ceil((opt > 0 ? opt : al) - virt), +(f && f.qte_min) || 1) }; }).filter(Boolean);
  // Un brouillon « auto_reappro » par fournisseur, tenu à jour : articles ajoutés / retirés, quantités recalculées tant
  // qu'elles n'ont pas été changées à la main (l.qte === l.qte_auto). Brouillon vidé → supprimé. Renvoie true si la base a changé.
  D.reapproAuto = (db) => { let ch = false; const parF = {};
    D.besoinsReappro(db).filter((b) => b.f).forEach((b) => { (parF[b.f.tiers] = parF[b.f.tiers] || []).push(b); });
    db.achats.filter((o) => o.auto_reappro && o.etat === 'brouillon' && !parF[o.tiers]).forEach((o) => { parF[o.tiers] = []; });
    Object.entries(parF).forEach(([fid, besoins]) => { const t = D.tiers(db, fid); if (!t) return;
      let o = db.achats.find((x) => x.auto_reappro && x.etat === 'brouillon' && x.tiers === fid); let mod = false;
      if (!o) { if (!besoins.length) return; o = { id: D.id('po'), ref: D.refBrouillon(db, 'achat'), tiers: fid, ref_fourn: '', date: D.auj(), livraison: '', cond: t.cond_fourn || t.cond, mode: t.mode, etat: 'brouillon', note_pub: '', note_priv: 'Créée automatiquement par le réapprovisionnement', auteur: D.MOI, liens: [], lignes: [], auto_reappro: true, cree: D.maintenant() };
        db.achats.push(o); D.evt(db, `Commande fournisseur ${o.ref} créée automatiquement (réapprovisionnement)`, { tiers: fid, objet: { type: 'achat', id: o.id } }); mod = true; }
      besoins.filter((b) => !(o.retires || []).includes(b.p.id)).forEach((b) => { const l = o.lignes.find((x) => x.produit === b.p.id);
        if (!l) { o.lignes.push({ produit: b.p.id, desc: b.p.libelle, ref_fourn: b.f.ref || '', tva: D.tvaAchatFourn(t), pu: +b.f.pu || 0, qte: b.qte, remise: +b.f.remise || 0, recu: 0, auto_reappro: true, qte_auto: b.qte }); mod = true; }
        else if (l.auto_reappro && l.qte === l.qte_auto && l.qte !== b.qte) { l.qte = b.qte; l.qte_auto = b.qte; mod = true; } });
      const garder = o.lignes.filter((l) => !(l.auto_reappro && l.qte === l.qte_auto && !besoins.some((b) => b.p.id === l.produit)));
      if (garder.length !== o.lignes.length) { o.lignes = garder; mod = true; }
      if (!o.lignes.length) { db.achats = db.achats.filter((x) => x !== o); ch = true; return; }
      if (mod) { D.toucher(o); ch = true; } });
    return ch; };
  P.stocks = (v, a) => {
    const db = v.db; const alerte = a[0] === 'alerte';
    const lignes = [...db.produits].sort((x, y) => x.ref.localeCompare(y.ref));
    const cols = [{ t: 'Image', v: (p) => U.vignetteProduit(p, 44), cls: 'erp-col-img' }, { t: 'Réf.', v: (p) => `<b>${esc(p.ref)}</b>`, txt: (p) => p.ref }, { t: 'Libellé', v: (p) => esc(p.libelle), txt: (p) => p.libelle },
      { t: 'Limite alerte', v: (p) => String(p.alerte), nb: true }, { t: 'Stock désiré', v: (p) => String(p.optimal), nb: true }, { t: 'Stock physique', v: (p) => alerteStock(p), nb: true }, { t: 'Stock virtuel', v: (p) => pastilleVirtuel(D.stockVirtuel(db, p), p.alerte || 0), nb: true },
      { t: 'Valorisation (PMP)', v: (p) => D.euros(D.prixRevient(p) * Math.max(0, p.stock)), nb: true }];
    if (!alerte) {
      const val = db.produits.reduce((s, p) => s + D.prixRevient(p) * Math.max(0, p.stock), 0);
      return { html: `${U.titrePage('▦', 'Produits (stocks)', lignes.length, `<span class="erp-gris">Valorisation totale : <b>${D.euros(val)}</b> HT</span>`)}${legendeStock()}<div data-liste></div>`,
        apres: (el) => U.liste(el.querySelector('[data-liste]'), { cols, lignes, lien: (p) => `produits/fiche/${p.id}/stock`, etats: [['insuffisant', 'Stock insuffisant']], filtre: (p) => p.stock <= p.alerte }) };
    }
    // Réapprovisionnement PAR FOURNISSEUR (19 nov. 2026, demande : « une liste par fournisseur ; pour chaque fournisseur une
    // commande brouillon créée automatiquement avec tous les articles sous le stock désiré ; chaque brouillon en widget, rouge
    // tant que le franco n'est pas atteint, vert dès qu'il l'est, et la commande peut alors être passée »). Voir D.reapproAuto.
    if (D.reapproAuto(db)) v.sauver();
    const brouillons = db.achats.filter((o) => o.auto_reappro && o.etat === 'brouillon').map((o) => { const t = D.tiers(db, o.tiers) || {}; const ht = D.ht(o); const franco = +t.franco || 0;
      return { o, t, ht, franco, ok: !franco || ht >= franco }; }).sort((x, y) => (y.ok - x.ok) || (y.ht - x.ht));
    const sansF = D.besoinsReappro(db).filter((b) => !b.f);
    const widget = ({ o, t, ht, franco, ok }) => { const pct = franco ? Math.min(100, Math.round((ht / franco) * 100)) : 100;
      const lignes = o.lignes.slice(0, 6).map((l) => { const p = D.produit(db, l.produit); return `<li>${p ? U.vignetteProduit(p, 30) : ''}<span><b>${esc(p ? p.ref : l.desc)}</b><small>${esc(l.desc || '')}</small></span><em>× ${D.nombre(l.qte)}</em></li>`; }).join('');
      return `<article class="erp-reap ${ok ? 'ok' : 'ko'}">
        <header>${U.avatar(t, 40)}<div><h3>${esc(t.nom || 'Fournisseur')}</h3><small>${esc(o.ref)} · ${o.lignes.length} article${o.lignes.length > 1 ? 's' : ''}${t.delai_livraison ? ` · livré en ${t.delai_livraison} j` : ''}</small></div>
          <span class="erp-reap-etat">${ok ? (franco ? '● Franco atteint' : '● Pas de franco') : '● Franco non atteint'}</span></header>
        <div class="erp-reap-barre" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div>
        <p class="erp-reap-montant"><b>${D.euros(ht)} HT</b>${franco ? ` / franco ${D.euros(franco)}${ok ? '' : ` · <span>manque ${D.euros(franco - ht)}</span>`}` : ' · franco non renseigné sur la fiche du fournisseur'}</p>
        <ul class="erp-reap-l">${lignes}${o.lignes.length > 6 ? `<li class="erp-gris">… et ${o.lignes.length - 6} autre(s)</li>` : ''}</ul>
        <footer>${U.btn('Ouvrir / modifier', '', 'btn-ligne', `data-aller="achat/fiche/${o.id}"`)}${U.btn('Passer la commande', 'valider', 'btn-metal', `data-passer="${o.id}"${ok ? '' : ' disabled title="Franco pas encore atteint : complétez la commande"'}`)}</footer></article>`; };
    return { html: `${U.titrePage('▦', 'Réapprovisionnement', brouillons.length)}<p class="erp-gris">Une commande brouillon par fournisseur, créée et mise à jour automatiquement avec tous les articles dont le stock virtuel est sous le stock désiré (sinon sous le seuil d’alerte). <b class="erp-moins">Rouge</b> tant que le franco n’est pas atteint, <b class="erp-plus">vert</b> dès qu’il l’est : la commande peut alors être passée. Une quantité changée à la main dans le brouillon est gardée.</p>
      ${brouillons.length ? `<div class="erp-reap-grille">${brouillons.map(widget).join('')}</div>` : U.vide('Aucun article sous le stock désiré : rien à commander.')}
      ${sansF.length ? U.bloc('Articles à commander sans fournisseur', U.table([['Image', (b) => U.vignetteProduit(b.p, 36), 'erp-col-img'], ['Réf.', (b) => `<b>${esc(b.p.ref)}</b>`], ['Libellé', (b) => esc(b.p.libelle)], ['Virtuel', (b) => D.nombre(b.virt), 'nb'], ['Désiré', (b) => D.nombre(b.p.optimal || b.p.alerte), 'nb'], ['À commander', (b) => D.nombre(b.qte), 'nb']], sansF, { lien: (b) => `produits/fiche/${b.p.id}/achat` }), { compte: sansF.length, droite: '<span class="erp-gris">Ajoutez un prix d’achat fournisseur sur le produit</span>' }) : ''}`,
      apres: (el) => el.addEventListener('click', (e) => { const b = e.target.closest('[data-passer]'); if (!b || b.disabled) return; const o = db.achats.find((x) => x.id === b.dataset.passer); if (!o) return; const t = D.tiers(db, o.tiers) || {};
        v.confirmer(`Passer la commande chez ${t.nom || 'ce fournisseur'} ?`, `${o.lignes.length} article(s) pour ${D.euros(D.ht(o))} HT. Elle reçoit sa référence définitive et passe à « Commande envoyée ».`, 'Passer la commande', () => {
          const ancien = o.ref; o.ref = D.prochaineRef(db, 'po', D.auj()); o.date = D.auj(); o.etat = 'commande'; o.livraison = D.ajout(D.auj(), +(t.delai_livraison || 7)); D.toucher(o);
          D.evt(db, `Commande fournisseur ${o.ref} envoyée au fournisseur (réapprovisionnement, brouillon ${ancien})`, { tiers: o.tiers, objet: { type: 'achat', id: o.id } });
          v.sauver(); v.notifier(`${o.ref} : commande envoyée.`); v.rendre(); }); }) };
  };

  P.mouvements = (v) => {
    const db = v.db; const lignes = db.mouvements;
    return { html: `${U.titrePage('⇅', 'Mouvements de stock', lignes.length)}<div data-liste></div>`,
      apres: (el) => listeMvts(el.querySelector('[data-liste]'), db, lignes, true) };
  };

  P.magasin = (v) => ({ html: `<div class="erp-magasin page-agenda" data-mag></div>`,
    apres: (el) => { const z = el.querySelector('[data-mag]'); if (window.FMDStock) v.monterSous(z, window.FMDStock); else z.innerHTML = U.vide('Module Stock & Magasin introuvable.'); } });
})();
