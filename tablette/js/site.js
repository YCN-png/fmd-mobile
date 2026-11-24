// FMD — module « Site web » (10 nov. 2026) : première maquette du futur site fmdistrib.fr.
// Fond blanc + D.A. FMD (noir #080808, dégradé rose gold, Montserrat / Alternates). Mélange demandé par l'utilisateur :
// Würth (bandeau noir, recherche + « Commande rapide » par référence, univers en pastilles sur la bannière, « Nos gammes »),
// Boulanger (bannière arrondie avec flèches, menu latéral des univers, « tops catégories » en cartes teintées, onglets),
// Leroy Merlin (bandeau de services, fournisseurs). Infos reprises du site actuel fmdistrib.fr (téléphone, livraison offerte
// dès 150 €, rayons). Les produits, prix (niveau Public, HT) et stocks viennent du catalogue du CRM (js/erp-donnees.js).
// Tout est cliquable dans l'aperçu (pages accueil / rayon / produit / recherche / panier / contact). Rien n'est en ligne :
// c'est une maquette dans le logiciel. Panier mémorisé sur ce PC (localStorage fmd-site-panier).
// Utilisé par js/app.js : window.FMDSite.monter(conteneur, ctx) → { detruire() }.
(function () {
  'use strict';

  const TEL = '07 44 22 82 54';
  const ADRESSE = '3 quai Félix Faure, 49000 Angers';
  const FRANCO = 150; // livraison offerte dès 150 € (comme sur fmdistrib.fr)

  // Icônes (traits, 24 × 24)
  const I = {
    menu: 'M4 7h16M4 12h16M4 17h16', loupe: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4', compte: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
    panier: 'M3 4h2l2.4 11h11l2-8H6.2M9 20h.01M18 20h.01', eclair: 'M13 2 4 14h7l-1 8 9-12h-7z', tel: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z',
    lieu: 'M12 21s-7-6.1-7-11a7 7 0 0 1 14 0c0 4.9-7 11-7 11zM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z', camion: 'M3 6h11v10H3zM14 10h4l3 3v3h-7M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
    horloge: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2', conseil: 'M4 5h16v11H8l-4 4zM8 9h8M8 12h5', pro: 'M4 8h16v11H4zM9 8V5h6v3M4 13h16',
    fleche: 'M9 6l6 6-6 6', gauche: 'M15 6l-6 6 6 6', droite: 'M9 6l6 6-6 6', x: 'M6 6l12 12M18 6 6 18', plus: 'M12 5v14M5 12h14', moins: 'M5 12h14',
    ok: 'M5 12l5 5 9-10', devis: 'M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5', ecran: 'M3 5h18v12H3zM8 21h8M12 17v4', mobile: 'M8 3h8v18H8zM11 18h2',
    // univers
    outillage: 'M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z', visserie: 'M9 3h6l-1 4h-4zM10 7h4v12l-2 2-2-2zM10 10l4 1M10 13l4 1M10 16l4 1',
    quincaillerie: 'M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5zM12 15v2', electricite: 'M13 2 4 14h7l-1 8 9-12h-7z', sanitaire: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z',
    peinture: 'M4 4h12v5H4zM16 6h3v6h-8v3M10 15h2v6h-2z', vetements: 'M8 3 4 6l2 4 2-1v12h8V9l2 1 2-4-4-3a4 4 0 0 1-8 0z', automobile: 'M5 16h14v-4l-2-5H7l-2 5zM5 16v2M19 16v2M7.5 13h.01M16.5 13h.01',
    metiers: 'M4 14a8 8 0 0 1 16 0v2H4zM12 6V3M9 6.5 8 4M15 6.5 16 4',
    // rayons de l'arborescence V2 (21 nov. 2026)
    accessoires: 'M3 12V4h8l10 10-8 8zM7.5 8.5h.01', atelier: 'M3 9h18v10H3zM8 9V6h8v3M3 13h18', climatisation: 'M12 2v20M4 7l16 10M20 7 4 17M9 4l3 2 3-2M9 20l3-2 3 2',
    collage: 'M9 3h6v4H9zM8 7h8l-1 14H9zM12 11v6', construction: 'M3 6h18v12H3zM3 12h18M9 6v6M15 12v6', masquage: 'M4 4h12v5H4zM16 6h3v6h-8v3M10 15h2v6h-2z',
    plomberie: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z', genie_climatique: 'M12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM12 10c0-4 1-7 4-7 2 0 2 3-1 5M14 12c4 0 7 1 7 4 0 2-3 2-5-1M12 14c0 4-1 7-4 7-2 0-2-3 1-5M10 12c-4 0-7-1-7-4 0-2 3-2 5 1',
    electroportatif: 'M3 7h11v6H3zM14 9h5M19 8v2M6 13l-1 8h4l1-8',
  };
  const svg = (n, cls = '') => `<svg class="sw-i ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${I[n] || I.outillage}"/></svg>`;

  // Rayons du site (repris de fmdistrib.fr ; « Climatisation », jamais « Ventilation »). cat = catégories du CRM rangées dedans.
  // Le rayon de chaque produit est choisi dans le CRM (fiche produit → Site web), sinon automatique : D.rayonSite (erp-donnees.js).
  // Arborescence V2 (21 nov. 2026, js/erp-arbo.js) : les 14 rayons du catalogue, puis « Métiers » (accès transversal).
  const UNIVERS = [];
  const UNIVERS_FIXES = [{ id: 'metiers', court: 'Métiers', txt: 'Sélections par corps de métier' }];
  const TEINTES = ['#F7DAC5', '#EFE4DC', '#F3D9CB', '#E9DDD3', '#F6E7DC', '#EBD2C3', '#F1E9E3', '#F4DFD2', '#E8DCD2'];
  const SERVICES = [
    ['horloge', 'Retrait au comptoir', 'Commandé le matin, prêt dans l’heure'], ['camion', 'Livraison offerte', `Dès ${FRANCO} € d’achat`],
    ['conseil', 'Conseil de pro', 'Une équipe du métier, à Angers'], ['pro', 'Compte pro', 'Vos prix, vos devis, vos factures'],
  ];

  const prixTxt = (n) => `${Number(n || 0).toFixed(2).replace('.', ',')} €`;

  function monter(conteneur, ctx) {
    const esc = (ctx && ctx.esc) || ((s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
    const D = window.FMDERP;
    // Même base que le CRM (catalogue, prix, stock) : relue à chaque ouverture du module → une référence créée ou modifiée
    // dans le CRM apparaît tout de suite ici.
    const db = D && D.charger ? D.charger() : { produits: [], commandes: [] };
    UNIVERS.length = 0; UNIVERS.push(...(D.ARBO || []).map((r) => ({ id: r.id, court: r.court, txt: r.sous.slice(0, 3).map((x) => x.nom).join(', '), arbo: r })), ...UNIVERS_FIXES.map((u) => ({ ...u })));
    UNIVERS.forEach((u) => { u.nom = u.arbo ? u.arbo.nom : D.nomRayon(u.id); });
    const produits = (db.produits || []).filter(D.surLeSite);
    const prix = (p) => (Array.isArray(p.prix) ? p.prix[0] : p.prix) || 0;
    const parId = (id) => produits.find((p) => p.id === id);
    const universDe = (p) => UNIVERS.find((u) => u.id === D.rayonSite(p)) || UNIVERS[0];
    // Groupes = une page / une carte sur le site : les variantes d'un même modèle (même nom de modèle dans le CRM) sont réunies.
    const groupes = []; const parCle = {};
    produits.forEach((p) => { const k = D.cleModele(p); if (!parCle[k]) { parCle[k] = { cle: k, variantes: [] }; groupes.push(parCle[k]); } parCle[k].variantes.push(p); });
    groupes.forEach((g) => { const v = g.variantes; g.multi = v.length > 1; const p0 = v[0];
      g.nom = g.multi || p0.modele ? (p0.modele || p0.libelle).trim() : p0.libelle;
      g.rep = v.find((p) => p.image && p.stock > 0) || v.find((p) => p.image) || v.find((p) => p.stock > 0) || p0;
      g.min = Math.min(...v.map(prix)); g.max = Math.max(...v.map(prix)); g.stock = v.some((p) => p.stock > 0);
      g.couleurs = [...new Set(v.map((p) => (p.couleur || '').trim()).filter(Boolean))];
      g.tailles = [...new Set(v.map((p) => (p.taille || '').trim()).filter(Boolean))].sort((a, b) => D.ordreTaille(a) - D.ordreTaille(b));
      g.cree = v.reduce((m, p) => (String(p.cree) > m ? String(p.cree) : m), ''); });
    const groupeDe = (p) => parCle[D.cleModele(p)];
    const dans = (u) => groupes.filter((g) => D.rayonSite(g.rep) === u.id);
    // Meilleures ventes : quantités vendues dans les commandes du CRM (toutes variantes confondues)
    const vendus = {}; (db.commandes || []).forEach((d) => (d.lignes || []).forEach((l) => { if (l.produit) vendus[l.produit] = (vendus[l.produit] || 0) + (l.qte || 0); }));
    const venteG = (g) => g.variantes.reduce((s, p) => s + (vendus[p.id] || 0), 0);
    const meilleures = [...groupes].sort((a, b) => venteG(b) - venteG(a));
    const nouveautes = [...groupes].sort((a, b) => (b.cree > a.cree ? 1 : -1));
    const petitsPrix = [...groupes].sort((a, b) => a.min - b.min);
    const varTxt = (p) => [p.couleur, p.taille, ...Object.values(p.attributs || {})].filter(Boolean).join(' · ');

    let panier = {}; try { panier = JSON.parse(localStorage.getItem('fmd-site-panier') || '{}') || {}; } catch { panier = {}; }
    const garderPanier = () => { try { localStorage.setItem('fmd-site-panier', JSON.stringify(panier)); } catch { /* reste en mémoire */ } };
    const nbPanier = () => Object.values(panier).reduce((s, n) => s + n, 0);
    const totalPanier = () => Object.entries(panier).reduce((s, [id, n]) => { const p = parId(id); return s + (p ? prix(p) * n : 0); }, 0);

    let favoris = []; try { favoris = JSON.parse(localStorage.getItem('fmd-site-favoris') || '[]') || []; } catch { favoris = []; }
    const garderFavoris = () => { try { localStorage.setItem('fmd-site-favoris', JSON.stringify(favoris)); } catch { /* reste en mémoire */ } };
    let photo = 0; // photo affichée dans la galerie de la page produit
    let route = ['accueil']; let appareil = 'ordi'; let slide = 0; let onglet = 'ventes'; let gamme = 0; let tiroir = false; let minuteur = null; let message = '';

    const visuel = (p, cls = '') => {
      if (p.image) return `<span class="sw-visuel ${cls} img"><img src="${esc(p.image)}" alt=""></span>`;
      const u = universDe(p); const i = UNIVERS.indexOf(u);
      return `<span class="sw-visuel ${cls}" style="--teinte:${TEINTES[(i) % TEINTES.length]}">${svg(u.id)}<em>${esc(p.marque || '')}</em></span>`;
    };
    const stockTxt = (p) => (p.stock > 0 ? `<span class="sw-stock ok">${svg('ok')} En stock au comptoir</span>` : '<span class="sw-stock">Sur commande</span>');
    const pastille = (c) => { const t = D.teinte(c); return `<i class="sw-pt${t ? '' : ' sans'}" style="${t ? `background:${t}` : ''}" title="${esc(c)}"></i>`; };
    const carte = (g) => { const p = g.rep;
      if (!g.multi) return `<article class="sw-carte">
        <a href="#" data-sw="produit/${esc(p.id)}" class="sw-carte-lien">${visuel(p)}
          <span class="sw-marque">${esc(p.marque || '')}</span><b class="sw-lib">${esc(g.nom)}</b><span class="sw-ref">Réf. ${esc(p.ref)}${varTxt(p) ? ` · ${esc(varTxt(p))}` : ''}</span></a>
        <div class="sw-carte-bas"><span class="sw-prix">${prixTxt(prix(p))}<small> HT</small></span>
          <button type="button" class="sw-ajout" data-sw-ajout="${esc(p.id)}" title="Ajouter au panier">${svg('panier')}</button></div>
        ${stockTxt(p)}</article>`;
      const coul = g.couleurs.length ? `<span class="sw-pts">${g.couleurs.slice(0, 7).map(pastille).join('')}${g.couleurs.length > 7 ? `<small>+${g.couleurs.length - 7}</small>` : ''}</span>` : '';
      const tai = g.tailles.length ? `<span class="sw-ref">Tailles : ${esc(g.tailles.length > 1 ? `${g.tailles[0]} → ${g.tailles[g.tailles.length - 1]}` : g.tailles[0])}</span>` : '';
      return `<article class="sw-carte">
        <a href="#" data-sw="produit/${esc(p.id)}" class="sw-carte-lien">${visuel(p)}
          <span class="sw-marque">${esc(p.marque || '')}</span><b class="sw-lib">${esc(g.nom)}</b>${coul}${tai || `<span class="sw-ref">${g.variantes.length} variantes</span>`}</a>
        <div class="sw-carte-bas"><span class="sw-prix">${g.min !== g.max ? '<small>dès </small>' : ''}${prixTxt(g.min)}<small> HT</small></span>
          <a href="#" class="sw-choisir" data-sw="produit/${esc(p.id)}">Choisir</a></div>
        ${g.stock ? `<span class="sw-stock ok">${svg('ok')} En stock au comptoir</span>` : '<span class="sw-stock">Sur commande</span>'}</article>`; };
    const grille = (l) => (l.length ? `<div class="sw-grille">${l.map(carte).join('')}</div>`
      : `<div class="sw-vide">${svg('horloge')}<b>Produits bientôt en ligne</b><p>Ce rayon arrive sur le site. En attendant, appelez-nous au ${TEL} ou passez au comptoir.</p></div>`);

    // ---------- en-tête (bandeau noir + logo/recherche/commande rapide + menu) ----------
    const entete = () => `
      <div class="sw-bandeau"><div class="sw-centre">
        <a href="#" data-sw="contact">${svg('tel')} ${TEL}</a><a href="#" data-sw="contact">${svg('lieu')} Nous trouver</a>
        <span class="sw-bandeau-msg">${svg('camion')} Livraison offerte dès ${FRANCO} € HT · Retrait au comptoir à Angers</span>
        <a href="#" data-sw="compte" class="sw-bandeau-cpt">Créer mon compte pro</a></div></div>
      <header class="sw-tete"><div class="sw-centre">
        <a href="#" data-sw="accueil" class="sw-logo" title="Accueil"><img src="assets/logos/apercus/FMD-logo-horizontal-metallique.png" alt="FMD"></a>
        <form class="sw-recherche" data-sw-form="recherche"><input name="q" placeholder="Rechercher un produit, un fournisseur, une référence…" value="${esc(route[0] === 'recherche' ? route[1] || '' : '')}" autocomplete="off"><button type="submit" title="Rechercher">${svg('loupe')}</button><div class="sw-sugg" data-sw-sugg hidden></div></form>
        <form class="sw-rapide" data-sw-form="rapide" title="Commande rapide : tapez la référence et la quantité">${svg('eclair')}<input name="ref" placeholder="Commande rapide : réf." autocomplete="off"><input name="qte" type="number" min="1" value="1" aria-label="Quantité"><button type="submit">OK</button><div class="sw-sugg" data-sw-sugg hidden></div></form>
        <a href="#" data-sw="compte" class="sw-tete-btn">${svg('compte')}<span>Espace pro</span></a>
        <a href="#" data-sw="favoris" class="sw-tete-btn"><svg class="sw-i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20s-7-4.4-9.2-8.6C1.3 8.4 3 5 6.3 5c2 0 3.2 1.1 3.9 2.2.3.5 1.3.5 1.6 0C12.5 6.1 13.7 5 15.7 5 19 5 20.7 8.4 19.2 11.4 17 15.6 12 20 12 20z"/></svg><span>Favoris</span>${favoris.length ? `<i class="sw-badge">${favoris.length}</i>` : ''}</a>
        <a href="#" data-sw="panier" class="sw-tete-btn">${svg('panier')}<span>Panier</span>${nbPanier() ? `<i class="sw-badge">${nbPanier()}</i>` : ''}</a>
      </div>${message ? `<div class="sw-centre"><p class="sw-message">${esc(message)}</p></div>` : ''}</header>
      <nav class="sw-nav"><div class="sw-centre">
        <button type="button" class="sw-menu-btn" data-sw-tiroir>${svg('menu')} Tous les rayons</button>
        ${[...UNIVERS].sort((a, b) => (dans(b).length ? 1 : 0) - (dans(a).length ? 1 : 0)).slice(0, 7).sort((a, b) => UNIVERS.indexOf(a) - UNIVERS.indexOf(b)).map((u) => `<a href="#" data-sw="univers/${u.id}" class="${route[1] === u.id ? 'actif' : ''}">${esc(u.court)}</a>`).join('')}
        <a href="#" data-sw="devis" class="sw-nav-devis">${svg('devis')} Devis</a></div></nav>`;

    const tiroirHtml = () => `<div class="sw-voile${tiroir ? ' ouvert' : ''}" data-sw-tiroir></div>
      <aside class="sw-tiroir${tiroir ? ' ouvert' : ''}" aria-hidden="${!tiroir}">
        <div class="sw-tiroir-tete"><b>Nos univers</b><button type="button" data-sw-tiroir title="Fermer">${svg('x')}</button></div>
        <a href="#" data-sw="accueil" class="sw-tiroir-une">En ce moment : livraison offerte dès ${FRANCO} € ${svg('fleche')}</a>
        ${UNIVERS.map((u, i) => `<a href="#" data-sw="univers/${u.id}" class="sw-tiroir-l"><span class="sw-pastille-ico" style="--teinte:${TEINTES[(i) % TEINTES.length]}">${svg(u.id)}</span><span>${esc(u.nom)}<small>${dans(u).length ? `${dans(u).length} produits` : 'Bientôt'}</small></span>${svg('fleche')}</a>`).join('')}
      </aside>`;

    // ---------- pages ----------
    const SLIDES = [
      { sur: 'FMD · Quincaillerie B2B à Angers', titre: 'Tout pour<br>les pros du bâtiment.', txt: 'Outillage, visserie, quincaillerie, électricité et climatisation : au comptoir ou livrés sur chantier.', cta: 'Voir les rayons', aller: 'univers/outillage', ico: 'outillage' },
      { sur: 'Livraison', titre: `Livraison offerte<br>dès ${FRANCO} € HT.`, txt: 'Sur Angers et ses alentours. Ou retrait au comptoir, 3 quai Félix Faure.', cta: 'Commander', aller: 'univers/visserie', ico: 'camion' },
      { sur: 'Gagnez du temps', titre: 'Commande rapide<br>par référence.', txt: 'Vous connaissez la référence ? Tapez-la en haut de la page, avec la quantité : c’est dans le panier.', cta: 'Essayer', aller: 'rapide', ico: 'eclair' },
    ];
    const accueil = () => {
      const s = SLIDES[slide]; const top = meilleures.slice(0, 2);
      const liste = { ventes: meilleures, nouveautes, prix: petitsPrix }[onglet].slice(0, 8);
      const g = UNIVERS[gamme];
      return `
      <section class="sw-centre sw-une">
        <div class="sw-hero">
          <div class="sw-hero-txt"><span class="sw-sur">${esc(s.sur)}</span><h1>${s.titre}</h1><p>${esc(s.txt)}</p>
            <a href="#" class="sw-cta" data-sw="${s.aller}">${esc(s.cta)} ${svg('fleche')}</a></div>
          <div class="sw-hero-vis">${svg(s.ico)}</div>
          <button type="button" class="sw-fl g" data-sw-slide="-1" title="Précédent">${svg('gauche')}</button>
          <button type="button" class="sw-fl d" data-sw-slide="1" title="Suivant">${svg('droite')}</button>
          <div class="sw-points">${SLIDES.map((_, i) => `<button type="button" data-sw-point="${i}" class="${i === slide ? 'actif' : ''}" title="Bannière ${i + 1}"></button>`).join('')}</div>
        </div>
        <div class="sw-promos">${top.map((g) => { const p = g.rep; return `<div class="sw-promo">${visuel(p, 'petit')}<div><span class="sw-marque">${esc(p.marque || '')}</span><b>${esc(g.nom)}</b>
          <span class="sw-prix">${g.min !== g.max ? '<small>dès </small>' : ''}${prixTxt(g.min)}<small> HT</small></span>${g.multi ? `<a href="#" class="sw-cta petit" data-sw="produit/${esc(p.id)}">Choisir</a>` : `<button type="button" class="sw-cta petit" data-sw-ajout="${esc(p.id)}">Commander</button>`}</div></div>`; }).join('')}</div>
      </section>
      <div class="sw-centre"><div class="sw-univers-barre"><span>Découvrez<br>nos univers</span>${UNIVERS.map((u) => `<a href="#" data-sw="univers/${u.id}">${svg(u.id)} ${esc(u.court)}</a>`).join('')}</div></div>

      <section class="sw-centre sw-bloc"><h2 class="sw-h2">Les tops catégories</h2><p class="sw-sous">Tout ce qu’il faut sur le chantier, au même endroit</p>
        <div class="sw-tops">${UNIVERS.slice(0, 6).map((u) => `<a href="#" data-sw="univers/${u.id}" class="sw-top"><span class="sw-top-vis" style="--teinte:${TEINTES[(UNIVERS.indexOf(u)) % TEINTES.length]}">${svg(u.id)}</span><b>${esc(u.court)}</b></a>`).join('')}</div></section>

      <section class="sw-centre sw-bloc sw-gammes">
        <div><span class="sw-etiq">Nos gammes</span>
          ${UNIVERS.slice(0, 6).map((u, i) => `<button type="button" class="sw-gamme${i === gamme ? ' actif' : ''}" data-sw-gamme="${i}">${esc(u.nom)}</button>`).join('')}
          <a href="#" data-sw="univers/${g.id}" class="sw-lien">Voir tout le rayon ${esc(g.court)} ${svg('fleche')}</a></div>
        <a href="#" data-sw="univers/${g.id}" class="sw-gamme-vis">${svg(g.id)}<span><b>${esc(g.nom)}</b>${esc(g.txt)}<small>${dans(g).length} produits en ligne</small></span></a>
      </section>

      <section class="sw-centre sw-bloc"><h2 class="sw-h2">Tendances &amp; suggestions</h2><p class="sw-sous">Ce que les pros commandent chez FMD</p>
        <div class="sw-onglets">${[['ventes', 'Meilleures ventes'], ['nouveautes', 'Nouveautés'], ['prix', 'Petits prix']].map(([k, t]) => `<button type="button" data-sw-onglet="${k}" class="${onglet === k ? 'actif' : ''}">${t}</button>`).join('')}</div>
        ${grille(liste)}</section>

      <section class="sw-centre sw-bloc"><div class="sw-services">${SERVICES.map(([i, t, x]) => `<div>${svg(i)}<b>${t}</b><span>${x}</span></div>`).join('')}</div></section>
      <section class="sw-centre sw-bloc"><h2 class="sw-h2">Nos fournisseurs</h2>
        <div class="sw-marques">${[...new Set(produits.map((p) => p.marque).filter(Boolean))].map((m) => `<a href="#" data-sw="recherche/${esc(m)}">${esc(m)}</a>`).join('')}</div></section>`;
    };

    const fil = (...l) => `<nav class="sw-fil"><a href="#" data-sw="accueil">Accueil</a>${l.map((x) => ` ${svg('fleche')} ${x}`).join('')}</nav>`;
    // Page d'un rayon (arborescence V2, 21 nov. 2026) : rayon › sous-catégorie › sous-sous-catégorie. Seules les rubriques qui
    // contiennent des produits sont proposées ; les produits pas encore classés restent visibles dans « Tout le rayon ».
    const pageUnivers = (id, sid, ssid) => { const u = UNIVERS.find((x) => x.id === id) || UNIVERS[0]; const l0 = dans(u);
      const sous = u.arbo ? u.arbo.sous.map((x) => ({ x, n: l0.filter((g) => g.rep.souscat === x.id).length })).filter((o) => o.n) : [];
      const s = sid && u.arbo ? u.arbo.sous.find((x) => x.id === sid) : null;
      const l1 = s ? l0.filter((g) => g.rep.souscat === s.id) : l0;
      const ss = s ? s.sous.map((x) => ({ x, n: l1.filter((g) => g.rep.soussouscat === x.id).length })).filter((o) => o.n) : [];
      const t = s && ssid ? s.sous.find((x) => x.id === ssid) : null;
      const l = t ? l1.filter((g) => g.rep.soussouscat === t.id) : l1;
      const lienU = (...p) => ['univers', u.id, ...p].map(encodeURIComponent).join('/');
      const chemin = [s ? `<a href="#" data-sw="${lienU()}">${esc(u.nom)}</a>` : esc(u.nom), s && (t ? `<a href="#" data-sw="${lienU(s.id)}">${esc(s.nom)}</a>` : esc(s.nom)), t && esc(t.nom)].filter(Boolean);
      return `<section class="sw-centre sw-bloc">${fil(...chemin)}
        <div class="sw-rayon-tete"><span class="sw-pastille-ico grand" style="--teinte:${TEINTES[(UNIVERS.indexOf(u)) % TEINTES.length]}">${svg(u.id)}</span><div><h1>${esc(t ? t.nom : s ? s.nom : u.nom)}</h1><p>${esc(s ? u.nom : u.txt)} · ${l.length} produit${l.length > 1 ? 's' : ''}</p></div></div>
        <div class="sw-chips">${UNIVERS.map((x) => `<a href="#" data-sw="univers/${x.id}" class="${x.id === u.id ? 'actif' : ''}">${esc(x.court)}</a>`).join('')}</div>
        ${sous.length ? `<div class="sw-chips sw-sous-cats"><a href="#" data-sw="${lienU()}" class="${s ? '' : 'actif'}">Tout le rayon</a>${sous.map((o) => `<a href="#" data-sw="${lienU(o.x.id)}" class="${s && s.id === o.x.id ? 'actif' : ''}">${esc(o.x.nom)} <small>${o.n}</small></a>`).join('')}</div>` : ''}
        ${ss.length ? `<div class="sw-chips sw-sous-cats sw-ss-cats"><a href="#" data-sw="${lienU(s.id)}" class="${t ? '' : 'actif'}">Tout « ${esc(s.nom)} »</a>${ss.map((o) => `<a href="#" data-sw="${lienU(s.id, o.x.id)}" class="${t && t.id === o.x.id ? 'actif' : ''}">${esc(o.x.nom)} <small>${o.n}</small></a>`).join('')}</div>` : ''}
        ${grille(l)}</section>`; };
    const pageRecherche = (q) => { const t = String(q || '').toLowerCase().trim();
      const l = t ? groupes.filter((g) => g.variantes.some((p) => `${p.ref} ${p.libelle} ${p.marque} ${p.modele || ''} ${varTxt(p)} ${p.code_barres || ''}`.toLowerCase().includes(t))) : [];
      return `<section class="sw-centre sw-bloc">${fil('Recherche')}<h1 class="sw-h1">Résultats pour « ${esc(q)} »</h1><p class="sw-sous gauche">${l.length} produit${l.length > 1 ? 's' : ''}</p>
        ${l.length ? grille(l) : `<div class="sw-vide">${svg('loupe')}<b>Aucun produit trouvé</b><p>Essayez un fournisseur (Sika, Legrand…), une référence ou appelez-nous au ${TEL}.</p></div>`}</section>`; };
    // Choix des variantes (11 nov. 2026, modèle HECO) : une ligne par caractéristique du produit à variantes (Couleur,
    // Taille, puis Diamètre, Longueur, Empreinte, Matériau…). Plus de 6 valeurs → liste déroulante, sinon boutons.
    // Une valeur qui n'existe pas avec les autres choix actuels est grisée : un clic mène à la variante la plus proche.
    const choixVariantes = (g, p) => { if (!g.multi) return '';
      const v = g.variantes; const m = p.modele_id && D.modele(db, p.modele_id);
      const axes = D.axesModele(m || {}).filter((ax) => v.some((x) => D.valeurAxe(x, ax)));
      const actuel = Object.fromEntries(axes.map((ax) => [ax, D.valeurAxe(p, ax)]));
      const tri = (ax, l) => (ax === 'Taille' ? l.sort((a, b) => D.ordreTaille(a) - D.ordreTaille(b)) : l.sort((a, b) => a.localeCompare(b, 'fr', { numeric: true })));
      const exacte = (ax, val) => v.find((x) => axes.every((a2) => D.valeurAxe(x, a2) === (a2 === ax ? val : actuel[a2])));
      const proche = (ax, val) => { const score = (x) => axes.reduce((n, a2) => n + (a2 !== ax && D.valeurAxe(x, a2) === actuel[a2] ? 2 : 0), x.stock > 0 ? 1 : 0);
        return v.filter((x) => D.valeurAxe(x, ax) === val).sort((a, b) => score(b) - score(a))[0]; };
      return axes.map((ax) => { const vals = tri(ax, [...new Set(v.map((x) => D.valeurAxe(x, ax)).filter(Boolean))]);
        const etat = (val) => { const e = exacte(ax, val); return val === actuel[ax] ? 'actif' : !e ? 'indispo' : !(e.stock > 0) ? 'rupture' : ''; };
        const cible = (val) => exacte(ax, val) || proche(ax, val);
        const titre = (val) => (etat(val) === 'indispo' ? 'Pas avec les choix actuels : variante la plus proche' : etat(val) === 'rupture' ? 'Sur commande' : 'En stock');
        if (ax === 'Couleur') return `<div class="sw-choix"><span class="sw-choix-t">Couleur : <b>${esc(actuel[ax] || '—')}</b></span><div class="sw-couleurs">${vals.map((c) => { const t = D.teinte(c);
          return `<button type="button" class="sw-coul ${etat(c)}" data-sw-var="${esc(cible(c).id)}" title="${esc(c + ' · ' + titre(c))}"><i class="${t ? '' : 'sans'}" style="${t ? `background:${t}` : ''}"></i><span>${esc(c)}</span></button>`; }).join('')}</div></div>`;
        if (vals.length > 6) return `<div class="sw-choix"><label class="sw-choix-t">${esc(ax)}</label><select class="sw-select" data-sw-sel>${vals.map((val) => `<option value="${esc(cible(val).id)}"${val === actuel[ax] ? ' selected' : ''}>${esc(val)}${etat(val) === 'indispo' ? ' (autre combinaison)' : ''}</option>`).join('')}</select></div>`;
        return `<div class="sw-choix"><span class="sw-choix-t">${esc(ax)}</span><div class="sw-tailles">${vals.map((val) => `<button type="button" class="sw-tai ${etat(val)}" data-sw-var="${esc(cible(val).id)}" title="${esc(titre(val))}">${esc(val)}</button>`).join('')}</div></div>`; }).join(''); };

    // Page produit (11 nov. 2026, modèle HECO) : galerie (photo à 3/4 du cadre, flèches, points, miniatures), titre,
    // réf. produit + GTIN, choix des variantes, prix et panier, logos de certification, PDF, favoris, puis
    // « Caractéristiques du produit » (description). Rien en dessous (avantages, données techniques…).
    const pageProduit = (id) => { const p = parId(id); if (!p) return pageUnivers('outillage'); const u = universDe(p); const g = groupeDe(p);
      const m = p.modele_id && D.modele(db, p.modele_id);
      const memes = dans(u).filter((x) => x !== g).slice(0, 4);
      const photos = D.galerieProduit(db, p);
      if (photo >= photos.length) photo = 0;
      const certifs = D.certifsDe(db, (p.certifs && p.certifs.length) || !m ? p : m);
      const titre = g.multi ? (m ? m.nom : g.nom) : p.libelle;
      const fav = favoris.includes(p.id);
      const galerie = photos.length ? `<div class="sw-galerie"><div class="sw-galerie-grand"><span class="sw-visuel grand img"><img src="${esc(photos[photo])}" alt="${esc(titre)}"></span>
          ${photos.length > 1 ? `<button type="button" class="sw-gal-fl g" data-sw-photo-pas="-1" title="Photo précédente">${svg('gauche')}</button><button type="button" class="sw-gal-fl d" data-sw-photo-pas="1" title="Photo suivante">${svg('droite')}</button>` : ''}</div>
        ${photos.length > 1 ? `<div class="sw-gal-pts">${photos.map((_, i) => `<button type="button" data-sw-photo="${i}" class="${i === photo ? 'actif' : ''}" title="Photo ${i + 1}"></button>`).join('')}</div>
          <div class="sw-gal-mini">${photos.map((src, i) => `<button type="button" data-sw-photo="${i}" class="${i === photo ? 'actif' : ''}" title="Photo ${i + 1}"><span class="sw-visuel img"><img src="${esc(src)}" alt=""></span></button>`).join('')}</div>` : ''}</div>`
        : `<div class="sw-galerie">${visuel(p, 'grand')}</div>`;
      return `<section class="sw-centre sw-bloc">${fil(`<a href="#" data-sw="univers/${u.id}">${esc(u.nom)}</a>`, ...(p.souscat && D.nomSousCat(u.id, p.souscat) ? [`<a href="#" data-sw="univers/${u.id}/${encodeURIComponent(p.souscat)}">${esc(D.nomSousCat(u.id, p.souscat))}</a>`] : []), ...(p.souscat && p.soussouscat && D.nomSousSousCat(u.id, p.souscat, p.soussouscat) ? [`<a href="#" data-sw="univers/${u.id}/${encodeURIComponent(p.souscat)}/${encodeURIComponent(p.soussouscat)}">${esc(D.nomSousSousCat(u.id, p.souscat, p.soussouscat))}</a>`] : []), esc(g.nom))}
        <div class="sw-fiche sw-pp">${galerie}
          <div class="sw-fiche-txt">${p.marque ? `<span class="sw-marque">${esc(p.marque)}</span>` : ''}
            <h1 class="sw-pp-titre">${esc(titre)}${g.multi && varTxt(p) ? `, ${esc(varTxt(p).replace(/ · /g, ', '))}` : ''}</h1>
            <div class="sw-pp-ids"><div><b>Réf. produit :</b><span>${esc(p.ref)}</span></div><div><b>GTIN :</b><span>${esc(p.code_barres || '—')}</span></div></div>
            ${choixVariantes(g, p)}
            <div class="sw-fiche-prix"><span class="sw-prix grand">${prixTxt(prix(p))}<small> HT</small></span><span class="sw-ttc">${prixTxt(prix(p) * (1 + (p.tva ?? 20) / 100))} TTC</span></div>
            ${stockTxt(p)}
            <form class="sw-fiche-ajout" data-sw-form="ajout" data-id="${esc(p.id)}"><div class="sw-qte"><button type="button" data-sw-q="-1">${svg('moins')}</button><input name="qte" type="number" min="1" value="1" aria-label="Quantité"><button type="button" data-sw-q="1">${svg('plus')}</button></div>
              <button type="submit" class="sw-cta">${svg('panier')} Ajouter au panier</button></form>
            ${certifs.length ? `<div class="sw-pp-certifs"><b>Caractéristiques :</b><div>${certifs.map((c) => `<img src="${esc(c.image)}" alt="${esc(c.nom)}" title="${esc(c.nom)}">`).join('')}</div></div>` : ''}
            <div class="sw-pp-btns"><button type="button" class="sw-pp-btn" data-sw-pdf="${esc(p.id)}"><span class="sw-pp-pdf">PDF</span> Enregistrer en PDF</button>
              <button type="button" class="sw-pp-btn plein${fav ? ' fav' : ''}" data-sw-fav="${esc(p.id)}"><svg class="sw-i" viewBox="0 0 24 24" fill="${fav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8"><path d="M12 20s-7-4.4-9.2-8.6C1.3 8.4 3 5 6.3 5c2 0 3.2 1.1 3.9 2.2.3.5 1.3.5 1.6 0C12.5 6.1 13.7 5 15.7 5 19 5 20.7 8.4 19.2 11.4 17 15.6 12 20 12 20z"/></svg> ${fav ? 'Retirer des favoris' : 'Ajouter aux favoris'}</button></div>
          </div></div>
        ${p.description ? `<div class="sw-pp-carac"><h2>Caractéristiques du produit</h2><p>${esc(p.description)}</p></div>` : ''}
        ${memes.length ? `<h2 class="sw-h2 gauche">Dans le même rayon</h2>${grille(memes)}` : ''}</section>`; };
    const pageFavoris = () => { const l = groupes.filter((g) => g.variantes.some((p) => favoris.includes(p.id)));
      return `<section class="sw-centre sw-bloc">${fil('Favoris')}<h1 class="sw-h1">Mes favoris</h1><p class="sw-sous gauche">${l.length} produit${l.length > 1 ? 's' : ''}</p>
        ${l.length ? grille(l) : `<div class="sw-vide">${svg('pro')}<b>Aucun favori pour l’instant</b><p>Sur la page d’un produit, cliquez sur « Ajouter aux favoris ».</p></div>`}</section>`; };
    // Fiche produit en PDF (A4, charte FMD) : fabriquée par le logiciel FMD (même méthode que les devis du CRM).
    const fichePdf = async (p) => { const m = p.modele_id && D.modele(db, p.modele_id); const g = groupeDe(p);
      const certifs = D.certifsDe(db, (p.certifs && p.certifs.length) || !m ? p : m); const photos = D.galerieProduit(db, p);
      const res = D.ressourcesDocs ? await D.ressourcesDocs() : {};
      const titre = (g.multi ? (m ? m.nom : g.nom) : p.libelle) + (g.multi && varTxt(p) ? ', ' + varTxt(p).replace(/ · /g, ', ') : '');
      return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(p.ref)}</title><style>
${res.police ? `@font-face{font-family:'Montserrat';src:url(${res.police}) format('woff2');font-weight:100 900}` : ''}
@page{size:A4;margin:16mm}*{box-sizing:border-box}body{font:11pt/1.5 Montserrat,Arial,sans-serif;color:#1b1513;margin:0}
.tete{display:flex;justify-content:space-between;align-items:center;background:#080808;border-radius:10px;padding:10px 16px;margin-bottom:14px}.tete img{height:26px}.tete span{color:#EAC2A9;font-size:8pt;letter-spacing:.2em}
.filet{height:2px;background:linear-gradient(90deg,#F7DAC5,#C9987D,#6F4A3C);margin-bottom:18px}
.haut{display:grid;grid-template-columns:76mm 1fr;gap:10mm}.photo{border:1px solid #eadfd8;border-radius:10px;aspect-ratio:1;display:grid;place-items:center;overflow:hidden}.photo img{width:100%;height:100%;object-fit:contain;padding:12.5%}
.minis{display:flex;gap:6px;margin-top:6px}.minis img{width:22mm;height:22mm;object-fit:contain;padding:8%;border:1px solid #eadfd8;border-radius:6px}
h1{font-size:16pt;line-height:1.25;margin:0 0 10px;text-transform:uppercase}.ids{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:10px 0}.ids b{display:block;font-size:8.5pt;color:#6F4A3C}
.prix{font-size:15pt;font-weight:800;margin:8px 0}.prix small{font-size:9pt;font-weight:600;color:#6F4A3C}.var{margin:6px 0}.var b{color:#6F4A3C}
.certifs{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:12px}.certifs img{height:20mm;max-width:34mm;object-fit:contain}
h2{font-size:12pt;margin:18px 0 6px;border-top:1px solid #eadfd8;padding-top:12px}p{margin:0;white-space:pre-wrap}.pied{margin-top:20px;font-size:8pt;color:#8d7c72;text-align:center}
</style></head><body><div class="tete">${res.logo ? `<img src="${res.logo}" alt="FMD">` : '<b style="color:#EAC2A9">FMD</b>'}<span>QUINCAILLERIE · OUTILLAGE · CLIMATISATION</span></div><div class="filet"></div>
<div class="haut"><div><div class="photo">${photos[0] ? `<img src="${esc(photos[0])}">` : ''}</div>${photos.length > 1 ? `<div class="minis">${photos.slice(1, 4).map((x) => `<img src="${esc(x)}">`).join('')}</div>` : ''}</div>
<div>${p.marque ? `<div style="color:#A3735C;font-weight:700;font-size:9pt">${esc(p.marque)}</div>` : ''}<h1>${esc(titre)}</h1>
<div class="ids"><div><b>Réf. produit</b>${esc(p.ref)}</div><div><b>GTIN</b>${esc(p.code_barres || '—')}</div></div>
${varTxt(p) ? `<div class="var"><b>Variante :</b> ${esc(varTxt(p))}</div>` : ''}
<div class="prix">${prixTxt(prix(p))} <small>HT · ${prixTxt(prix(p) * (1 + (p.tva ?? 20) / 100))} TTC</small></div>
${certifs.length ? `<div class="certifs">${certifs.map((c) => `<img src="${esc(c.image)}" alt="${esc(c.nom)}">`).join('')}</div>` : ''}</div></div>
${p.description ? `<h2>Caractéristiques du produit</h2><p>${esc(p.description)}</p>` : ''}
<div class="pied">FMD · ${esc(ADRESSE)} · ${esc(TEL)} · fmdistrib.fr</div></body></html>`; };
    const pagePanier = () => { const l = Object.entries(panier).map(([id, n]) => [parId(id), n]).filter(([p]) => p); const tot = totalPanier(); const reste = Math.max(0, FRANCO - tot);
      return `<section class="sw-centre sw-bloc">${fil('Panier')}<h1 class="sw-h1">Mon panier</h1>
        ${l.length ? `<div class="sw-panier"><div class="sw-panier-l">${l.map(([p, n]) => `<div class="sw-pl">${visuel(p, 'petit')}<a href="#" data-sw="produit/${esc(p.id)}"><b>${esc(p.modele || p.libelle)}</b>${varTxt(p) ? `<span class="sw-var">${esc(varTxt(p))}</span>` : ''}<span class="sw-ref">Réf. ${esc(p.ref)} · ${prixTxt(prix(p))} HT</span></a>
            <div class="sw-qte"><button type="button" data-sw-pq="${esc(p.id)}" data-d="-1">${svg('moins')}</button><b>${n}</b><button type="button" data-sw-pq="${esc(p.id)}" data-d="1">${svg('plus')}</button></div>
            <b class="sw-pl-tot">${prixTxt(prix(p) * n)}</b><button type="button" class="sw-pl-x" data-sw-pq="${esc(p.id)}" data-d="x" title="Retirer">${svg('x')}</button></div>`).join('')}</div>
          <aside class="sw-recap"><div class="sw-franco"><span>${reste ? `Plus que <b>${prixTxt(reste)}</b> pour la livraison offerte` : '<b>Livraison offerte</b> sur cette commande'}</span><i style="--p:${Math.min(100, tot / FRANCO * 100)}%"></i></div>
            <p><span>Total HT</span><b>${prixTxt(tot)}</b></p><p><span>TVA 20 %</span><b>${prixTxt(tot * 0.2)}</b></p><p class="tot"><span>Total TTC</span><b>${prixTxt(tot * 1.2)}</b></p>
            <span class="sw-bientot">Paiement en ligne : bientôt</span><a href="#" data-sw="devis" class="sw-cta">${svg('devis')} Recevoir un devis</a></aside></div>`
        : `<div class="sw-vide">${svg('panier')}<b>Votre panier est vide</b><p>Parcourez les rayons ou utilisez la commande rapide par référence.</p><a href="#" class="sw-cta" data-sw="accueil">Continuer mes achats</a></div>`}</section>`; };
    const pageContact = () => `<section class="sw-centre sw-bloc">${fil('Contact')}<h1 class="sw-h1">Nous trouver</h1>
      <div class="sw-contact"><div>${svg('lieu')}<b>Le comptoir FMD</b><span>${ADRESSE}</span></div><div>${svg('tel')}<b>Téléphone</b><span>${TEL}</span></div>
        <div>${svg('camion')}<b>Livraison</b><span>Offerte dès ${FRANCO} € HT, Angers et alentours</span></div></div></section>`;
    const pageBientot = (titre, txt) => `<section class="sw-centre sw-bloc">${fil(esc(titre))}<div class="sw-vide">${svg('pro')}<b>${esc(titre)}</b><p>${esc(txt)}</p><span class="sw-bientot">Bientôt</span></div></section>`;

    const pied = () => `<footer class="sw-pied"><div class="sw-centre">
        <div><img src="assets/logos/apercus/FMD-logo-blanc-transparent.png" alt="FMD" class="sw-pied-logo"><p>Quincaillerie, outillage et fournitures pour les professionnels du bâtiment.</p></div>
        <div><b>Rayons</b>${UNIVERS.slice(0, 6).map((u) => `<a href="#" data-sw="univers/${u.id}">${esc(u.court)}</a>`).join('')}</div>
        <div><b>FMD</b><a href="#" data-sw="contact">Nous trouver</a><a href="#" data-sw="compte">Espace pro</a><a href="#" data-sw="devis">Demander un devis</a></div>
        <div><b>Contact</b><span>${ADRESSE}</span><span>${TEL}</span></div></div>
        <div class="sw-centre sw-pied-bas">© FMD · fmdistrib.fr · Maquette du futur site</div></footer>`;

    const corps = () => { const [r, a, b, c] = route;
      if (r === 'univers') return pageUnivers(a, b, c); if (r === 'produit') return pageProduit(a); if (r === 'recherche') return pageRecherche(a);
      if (r === 'panier') return pagePanier(); if (r === 'contact') return pageContact(); if (r === 'favoris') return pageFavoris();
      if (r === 'compte') return pageBientot('Espace pro', 'Connexion des clients pros : vos prix négociés, vos devis, vos commandes et vos factures, directement depuis le CRM.');
      if (r === 'devis') return pageBientot('Demande de devis', 'Le client enverra son panier ou sa liste : le devis arrivera directement dans le CRM, onglet Propositions commerciales.');
      return accueil(); };

    // ---------- coquille du module (barre d'outils du logiciel + aperçu du site) ----------
    conteneur.classList.add('page-site');
    conteneur.innerHTML = `<div class="site-outils">
        <div class="site-outils-t"><b>Site web</b><span>Maquette v1 · fond blanc, D.A. FMD · produits et prix du CRM</span></div>
        <div class="site-appareils"><button type="button" data-sw-app="ordi" title="Ordinateur">${svg('ecran')} Ordinateur</button><button type="button" data-sw-app="mobile" title="Téléphone">${svg('mobile')} Téléphone</button></div>
        <span class="pastille">Pas encore en ligne</span></div>
      <div class="site-cadre"><div class="site-boite" id="site-boite"><div class="site-ecran" id="site-ecran"></div><div id="site-calque"></div></div></div>`;
    const ecran = conteneur.querySelector('#site-ecran'); const boite = conteneur.querySelector('#site-boite'); const calque = conteneur.querySelector('#site-calque');

    const dessiner = (haut = false) => {
      const y = ecran.scrollTop;
      boite.className = `site-boite sw ${appareil}`;
      ecran.innerHTML = entete() + `<main class="sw-main">${corps()}</main>` + pied(); calque.innerHTML = tiroirHtml();
      conteneur.querySelectorAll('[data-sw-app]').forEach((b) => b.classList.toggle('actif', b.dataset.swApp === appareil));
      ecran.scrollTop = haut ? 0 : y;
    };
    const aller = (r) => { if (r === 'rapide') { const i = ecran.querySelector('.sw-rapide input'); if (i) { ecran.scrollTop = 0; i.focus(); } return; }
      route = r.split('/').map(decodeURIComponent); tiroir = false; message = ''; photo = 0; dessiner(true); };
    const ajouter = (id, n = 1) => { const p = parId(id); if (!p) return; panier[id] = (panier[id] || 0) + Math.max(1, n); garderPanier(); message = `${p.modele || p.libelle}${varTxt(p) ? ` (${varTxt(p)})` : ''} ajouté au panier : ${panier[id]}.`; dessiner(); };
    const tourner = () => { clearInterval(minuteur); minuteur = setInterval(() => { const a = document.activeElement; if (route[0] === 'accueil' && !tiroir && document.body.contains(ecran) && !(a && ecran.contains(a) && a.tagName === 'INPUT')) { slide = (slide + 1) % SLIDES.length; const y = ecran.scrollTop; dessiner(); ecran.scrollTop = y; } }, 7000); };

    // Aperçu des produits pendant la frappe (demande de l'utilisateur, 11 nov. 2026) : réf. ou libellé, dans la recherche et
    // dans la commande rapide. Recherche : clic = page du produit. Commande rapide : clic = la réf. est mise dans le champ.
    const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const chercher = (q) => { const t = norm(q).trim(); if (t.length < 2) return [];
      const score = (p) => { const ref = norm(p.ref); const txt = norm(`${p.libelle} ${p.marque} ${p.modele || ''} ${varTxt(p)} ${p.code_barres || ''}`);
        return ref === t ? 0 : ref.startsWith(t) ? 1 : ref.includes(t) ? 2 : t.split(/\s+/).every((m) => txt.includes(m) || ref.includes(m)) ? 3 : -1; };
      return produits.map((p) => [p, score(p)]).filter((x) => x[1] >= 0).sort((a, b) => a[1] - b[1] || a[0].ref.localeCompare(b[0].ref)).map((x) => x[0]); };
    const cacherApercus = (sauf) => conteneur.querySelectorAll('[data-sw-sugg]').forEach((z) => { if (z !== sauf) { z.hidden = true; z.innerHTML = ''; } });
    const apercu = (inp) => { const form = inp.closest('form'); const zone = form && form.querySelector('[data-sw-sugg]'); if (!zone) return;
      const rapide = form.dataset.swForm === 'rapide'; const l = chercher(inp.value); cacherApercus(zone);
      if (inp.value.trim().length < 2) { zone.hidden = true; zone.innerHTML = ''; return; }
      zone.innerHTML = (l.length ? l.slice(0, 6).map((p) => `<button type="button" class="sw-sugg-l" data-sw-sugg-id="${esc(p.id)}" data-mode="${rapide ? 'rapide' : 'voir'}">${visuel(p, 'mini')}
          <span class="sw-sugg-t"><b>${esc(p.modele || p.libelle)}</b><small>Réf. ${esc(p.ref)}${varTxt(p) ? ` · ${esc(varTxt(p))}` : ''}</small></span>
          <span class="sw-sugg-px"><b>${prixTxt(prix(p))}</b><small>${p.stock > 0 ? 'En stock' : 'Sur commande'}</small></span></button>`).join('')
        : `<p class="sw-sugg-vide">Aucun produit pour « ${esc(inp.value.trim())} »</p>`)
        + (!rapide && l.length ? `<a href="#" class="sw-sugg-tous" data-sw="recherche/${encodeURIComponent(inp.value.trim())}">Voir les ${l.length} résultat${l.length > 1 ? 's' : ''} ${svg('fleche')}</a>` : '')
        + (rapide && l.length ? '<p class="sw-sugg-aide">Cliquez pour mettre la référence, puis OK pour l’ajouter au panier.</p>' : '');
      zone.hidden = false; };
    const frappe = (e) => { if (e.target.matches('.sw-recherche input[name="q"], .sw-rapide input[name="ref"]')) apercu(e.target); };
    const clic = (e) => {
      if (!e.target.closest('.sw-recherche, .sw-rapide')) cacherApercus();
      const sg = e.target.closest('[data-sw-sugg-id]');
      if (sg) { e.preventDefault(); const p = parId(sg.dataset.swSuggId); if (!p) return;
        if (sg.dataset.mode === 'rapide') { const f = sg.closest('form'); f.ref.value = p.ref; cacherApercus(); f.qte.focus(); f.qte.select(); }
        else { cacherApercus(); aller('produit/' + p.id); }
        return; }
      const t = e.target.closest('[data-sw],[data-sw-ajout],[data-sw-tiroir],[data-sw-slide],[data-sw-point],[data-sw-onglet],[data-sw-gamme],[data-sw-pq],[data-sw-q],[data-sw-app],[data-sw-var],[data-sw-photo],[data-sw-photo-pas],[data-sw-fav],[data-sw-pdf]');
      if (!t || !conteneur.contains(t)) return; e.preventDefault();
      const d = t.dataset;
      if (d.swVar) { route = ['produit', d.swVar]; message = ''; photo = 0; dessiner(); }
      else if (d.swPhoto) { photo = Number(d.swPhoto); dessiner(); }
      else if (d.swPhotoPas) { const n = D.galerieProduit(db, parId(route[1]) || {}).length || 1; photo = (photo + Number(d.swPhotoPas) + n) % n; dessiner(); }
      else if (d.swFav) { const id = d.swFav; favoris = favoris.includes(id) ? favoris.filter((x) => x !== id) : [...favoris, id]; garderFavoris(); message = favoris.includes(id) ? 'Ajouté à vos favoris.' : 'Retiré de vos favoris.'; dessiner(); }
      else if (d.swPdf) { const p = parId(d.swPdf); if (!p) return; const L = window.lanceur;
        if (!L || !L.docPdf) { message = 'Le PDF se fabrique dans le logiciel FMD.'; dessiner(); return; }
        message = 'Préparation du PDF…'; dessiner();
        fichePdf(p).then((html) => L.docPdf(html, 'Fiches produits', String(p.ref).replace(/[\\/:*?"<>|]/g, '-'))).then((chemin) => { message = ''; dessiner(); return L.docAfficher(chemin); })
          .catch((er) => { message = 'PDF impossible : ' + er.message; dessiner(); }); }
      else if (d.sw !== undefined) aller(d.sw);
      else if (d.swAjout) ajouter(d.swAjout);
      else if (d.swTiroir !== undefined) { tiroir = !tiroir; dessiner(); }
      else if (d.swSlide) { slide = (slide + Number(d.swSlide) + SLIDES.length) % SLIDES.length; dessiner(); tourner(); }
      else if (d.swPoint) { slide = Number(d.swPoint); dessiner(); tourner(); }
      else if (d.swOnglet) { onglet = d.swOnglet; dessiner(); }
      else if (d.swGamme) { gamme = Number(d.swGamme); dessiner(); }
      else if (d.swPq) { const id = d.swPq; if (d.d === 'x') delete panier[id]; else { panier[id] = (panier[id] || 0) + Number(d.d); if (panier[id] <= 0) delete panier[id]; } garderPanier(); dessiner(); }
      else if (d.swQ) { const i = t.parentElement.querySelector('input'); i.value = Math.max(1, (Number(i.value) || 1) + Number(d.swQ)); }
      else if (d.swApp) { appareil = d.swApp; dessiner(true); }
    };
    const envoi = (e) => { const f = e.target.closest('[data-sw-form]'); if (!f) return; e.preventDefault();
      const k = f.dataset.swForm;
      if (k === 'recherche') { const q = f.q.value.trim(); if (q) aller('recherche/' + encodeURIComponent(q)); }
      else if (k === 'ajout') ajouter(f.dataset.id, Number(f.qte.value) || 1);
      else if (k === 'rapide') { const r = f.ref.value.trim().toLowerCase(); const p = produits.find((x) => x.ref.toLowerCase() === r) || (r ? produits.find((x) => x.ref.toLowerCase().includes(r)) : null);
        if (p) ajouter(p.id, Number(f.qte.value) || 1); else { message = r ? `Aucune référence « ${f.ref.value.trim()} ». Essayez la recherche.` : 'Tapez une référence (ex. MSK-GRI-9104).'; dessiner(); } } };
    const changement = (e) => { const sel = e.target.closest('[data-sw-sel]'); if (!sel || !conteneur.contains(sel)) return; route = ['produit', sel.value]; message = ''; photo = 0; dessiner(); };
    const clavier = (e) => { if (e.key === 'Escape') { cacherApercus(); if (tiroir) { tiroir = false; dessiner(); } } };
    conteneur.addEventListener('click', clic); conteneur.addEventListener('change', changement); conteneur.addEventListener('submit', envoi); conteneur.addEventListener('input', frappe); document.addEventListener('keydown', clavier);
    dessiner(true); tourner();
    return { detruire() { clearInterval(minuteur); document.removeEventListener('keydown', clavier); conteneur.removeEventListener('click', clic); conteneur.removeEventListener('change', changement); conteneur.removeEventListener('submit', envoi); conteneur.removeEventListener('input', frappe); conteneur.classList.remove('page-site'); conteneur.innerHTML = ''; } };
  }

  window.FMDSite = { monter };
})();
