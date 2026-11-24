// FMD — module CRM / ERP (refonte du 10 nov. 2026 sur le modèle du logiciel Dolibarr utilisé par FMD :
// captures de l'utilisateur dans « ECO SYSTEME FMD\CRM »).
// Organisation comme Dolibarr : MODULES EN HAUT (Accueil, Tiers, Catalogue, Commerce, Facturation…), MENU SUR LE
// CÔTÉ propre au module ouvert, pages à droite. Créations en 2 pages (« page 1 » = en-tête, « page 2 » = fiche avec
// les lignes) pour ne pas tout mettre sur le même écran.
// Pages : js/erp-tiers.js, erp-catalogue.js, erp-commerce.js (+ briques js/erp-ui.js, données js/erp-donnees.js).
// Le magasin 3D (js/stock.js) est dans Catalogue → « Magasin 3D ».
// Données réelles, enregistrées en ligne (js/erp-nuage.js) ; plus de démo depuis le 18 nov. 2026.
// Utilisé par js/app.js : window.FMDCRM.monter(conteneur, ctx) → { detruire() }.
(function () {
  'use strict';

  // [libellé, route, sous-niveau ?]
  const MODULES = [
    { id: 'accueil', nom: 'Accueil', ico: '⌂', menu: [{ t: 'Mon tableau de bord', r: 'accueil', items: [] }] },
    { id: 'tiers', nom: 'Tiers', ico: '▣', menu: [
      { t: 'Tiers', r: 'tiers', items: [['Nouveau tiers', 'tiers/nouveau'], ['Liste', 'tiers/liste/tous'], ['Liste des prospects', 'tiers/liste/P', 1], ['Nouveau prospect', 'tiers/nouveau/P', 1],
        ['Liste des clients', 'tiers/liste/C', 1], ['Nouveau client', 'tiers/nouveau/C', 1], ['Liste des fournisseurs', 'tiers/liste/F', 1], ['Nouveau fournisseur', 'tiers/nouveau/F', 1], ['Tags/catégories clients', 'tags/clients']] },
      { t: 'Contacts/Adresses', r: 'contacts/liste/tous', items: [['Nouveau contact/adresse', 'contacts/nouveau'], ['Liste', 'contacts/liste/tous'], ['Prospects', 'contacts/liste/P', 1], ['Clients', 'contacts/liste/C', 1], ['Fournisseurs', 'contacts/liste/F', 1]] },
    ] },
    { id: 'catalogue', nom: 'Catalogue', ico: '◇', menu: [
      { t: 'Produits', r: 'produits', items: [['Nouveau produit', 'produits/nouveau'], ['Nouveau produit à variantes', 'modeles/nouveau'], ['Liste', 'produits/liste'], ['Stocks', 'stocks/tous'], ['Statistiques', 'produits/stats'], ['Arborescence', 'tags/produits']] },
      { t: 'Stock', r: 'mouvements', items: [['Mouvements', 'mouvements'], ['Réapprovisionnement', 'stocks/alerte'], ['Magasin 3D', 'magasin']] },
      // Retours fournisseur (20 nov. 2026) : articles renvoyés au fournisseur, stock déduit à la validation (js/erp-retours.js)
      { t: 'Retours fournisseur', r: 'retour', items: [['Nouveau retour', 'retour/nouveau'], ['Liste', 'retour/liste/tous'], ['Brouillon', 'retour/liste/brouillon', 1], ['Validé', 'retour/liste/valide', 1], ['Annulé', 'retour/liste/annule', 1]] },
    ] },
    { id: 'commerce', nom: 'Commerce', ico: '✎', menu: [
      { t: 'Propositions commerciales', r: 'prop', items: [['Nouvelle proposition', 'prop/nouveau'], ['Liste', 'prop/liste/tous'], ['Brouillons', 'prop/liste/brouillon', 1], ['Ouvert', 'prop/liste/ouvert', 1], ['Signée (à facturer)', 'prop/liste/signee', 1], ['Non signée (fermée)', 'prop/liste/non_signee', 1], ['Facturée', 'prop/liste/facturee', 1], ['Statistiques', 'prop/stats']] },
      { t: 'Commandes clients', r: 'cmd', items: [['Nouvelle commande', 'cmd/nouveau'], ['Liste', 'cmd/liste/tous'], ['Brouillon', 'cmd/liste/brouillon', 1], ['Validée', 'cmd/liste/validee', 1], ['En cours', 'cmd/liste/en_cours', 1], ['Livrée', 'cmd/liste/livree', 1], ['Facturée', 'cmd/liste/facturee', 1], ['Non facturées', 'cmd/liste/nonfacturee', 1], ['Annulée', 'cmd/liste/annulee', 1], ['Facturation de fin de mois', 'cmd/finmois'], ['Statistiques', 'cmd/stats']] },
      { t: 'Commandes fournisseurs', r: 'achat', items: [['Nouvelle commande', 'achat/nouveau'], ['Liste', 'achat/liste/tous'], ['Brouillon', 'achat/liste/brouillon', 1], ['Commande envoyée', 'achat/liste/commande', 1], ['AR reçu', 'achat/liste/ar_recu', 1], ['Reçue partiellement', 'achat/liste/recue_partiel', 1], ['Commande reçue', 'achat/liste/recue', 1], ['Attente de facture', 'achat/liste/attente_facture', 1], ['Classée facturée', 'achat/liste/facturee', 1], ['Annulé', 'achat/liste/annule', 1], ['Statistiques', 'achat/stats']] },
    ] },
    { id: 'facturation', nom: 'Facturation | Paiement', ico: '€', menu: [
      { t: 'Factures clients', r: 'fact', items: [['Liste', 'fact/liste/tous'], ['Impayées', 'fact/liste/impayee', 1], ['En retard', 'fact/liste/retard', 1], ['Payées', 'fact/liste/payee', 1], ['Statistiques', 'fact/stats']] },
      // Encours clients (23 nov. 2026, js/erp-encours.js)
      { t: 'Encours clients', r: 'encours/liste/tous', items: [['Tous les encours', 'encours/liste/tous'], ['Plafond dépassé', 'encours/liste/depasse', 1], ['Proche du plafond', 'encours/liste/proche', 1], ['Factures en retard', 'encours/liste/retard', 1]] },
    ] },
    // Outils (19 nov. 2026) : import / export universel des produits, clients et fournisseurs (js/erp-echange.js)
    { id: 'outils', nom: 'Outils', ico: '⇅', menu: [{ t: 'Import / Export', r: 'echange', items: [] }, { t: 'Import de l’historique', r: 'historique', items: [] }, { t: 'Remise à zéro (tests)', r: 'purge', items: [] }, { t: 'Récemment supprimés', r: 'corbeille', items: [] }] },
  ];
  // Modules de Dolibarr pas encore faits : affichés « Bientôt », non cliquables.
  const BIENTOT = ['GPAO', 'Banques | Caisses', 'Comptabilité', 'GRH', 'Documents', 'Modèles PDF', 'Étiquettes'];
  const MODULE_DE = { encours: 'facturation', purge: 'outils', accueil: 'accueil', tiers: 'tiers', contacts: 'tiers', produits: 'catalogue', modeles: 'catalogue', stocks: 'catalogue', mouvements: 'catalogue', magasin: 'catalogue', retour: 'catalogue', prop: 'commerce', cmd: 'commerce', achat: 'commerce', fact: 'facturation', echange: 'outils', historique: 'outils' };

  function monter(conteneur, ctx) {
    const D = window.FMDERP;
    const { esc } = D.ui;
    // Nom de la personne connectée (20 nov. 2026) : « Par » des mouvements de stock, auteur des documents, événements.
    if (ctx && ctx.moi && ctx.moi.nom) D.MOI = ctx.moi.nom;
    // Arborescence V2 (21 nov. 2026, js/erp-arbo.js) : anciennes catégories / anciens rayons du site repris une fois.
    { const db0 = D.charger(); if (D.migrerCategories && D.migrerCategories(db0)) D.sauver(db0); }
    const lire = (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
    const ecrire = (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignoré */ } };
    let db = D.charger();
    let route = lire('fmd-crm-route', 'accueil');
    let module = 'accueil';
    let sous = null; // module monté dans la page (magasin 3D)
    const histo = [];

    let clair = lire('fmd-crm-theme', 'clair') === 'clair';
    conteneur.classList.add('page-crm', 'page-erp');
    conteneur.innerHTML = `
      <header class="erp-haut">
        <div class="erp-marque"><span class="crm-logo">C</span><b>CRM</b></div>
        <nav class="erp-modules" aria-label="Modules du CRM">${MODULES.map((m) => `<button type="button" data-module="${m.id}">${D.ui.ico(m.ico)}${esc(m.nom)}</button>`).join('')}
          <span class="erp-bientot" title="En préparation : ${esc(BIENTOT.join(', '))}">+ ${BIENTOT.length} modules<i>Bientôt</i></span></nav>
        <button type="button" class="btn btn-ligne petit" data-theme-crm title="Changer l’apparence du CRM"></button>
      </header>
      <aside class="erp-cote" aria-label="Menu du module">
        <div class="erp-societe">FMD · Gestion commerciale</div>
        <form class="erp-cherche" data-cherche>${D.ui.ico('recherche')}<input type="search" placeholder="Rechercher…" aria-label="Rechercher un tiers, un produit, un document"></form>
        <nav data-menu></nav>
        <div class="erp-demo" data-etat-nuage>${window.FMDERPNuage && window.FMDERPNuage.actif ? '' : 'Hors ligne : enregistré sur ce PC, envoi en ligne dès le retour d’Internet.'}</div>
      </aside>
      <main class="erp-page" id="erp-page"></main>`;
    const zone = conteneur.querySelector('#erp-page');
    const appliquerTheme = () => {
      conteneur.classList.toggle('crm-clair', clair);
      const f = document.getElementById('fenetre'); if (f) f.classList.toggle('crm-clair', clair);
      conteneur.querySelector('[data-theme-crm]').innerHTML = clair ? '☾ Mode sombre' : '☀ Mode clair';
    };
    appliquerTheme();
    conteneur.querySelector('[data-theme-crm]').addEventListener('click', () => { clair = !clair; ecrire('fmd-crm-theme', clair ? 'clair' : 'sombre'); appliquerTheme(); });

    // Fenêtre (confirmations, petits formulaires)
    function fenetre(titre, corps, pied, apres) {
      const f = document.getElementById('fenetre'); if (!f) return;
      f.innerHTML = `<div class="boite crm-boite"><div class="crm-boite-tete"><h2 id="fenetre-titre">${titre}</h2><button type="button" class="btn-icone" data-fermer aria-label="Fermer">✕</button></div><div class="crm-boite-corps">${corps}</div>${pied ? `<div class="crm-boite-pied">${pied}</div>` : ''}</div>`;
      f.classList.toggle('crm-clair', clair); f.hidden = false;
      f.onclick = (e) => { if (e.target === f || e.target.closest('[data-fermer]')) fermer(); };
      if (apres) apres(f.firstElementChild);
    }
    function fermer() { const f = document.getElementById('fenetre'); if (f && f.querySelector('.crm-boite')) { f.hidden = true; f.innerHTML = ''; f.onclick = null; } }
    const confirmer = (titre, texte, libOk, ok) => fenetre(esc(titre), `<p>${texte}</p>`, `<button type="button" class="btn btn-ligne" data-fermer>Annuler</button><button type="button" class="btn btn-metal" data-ok>${esc(libOk)}</button>`,
      (b) => b.querySelector('[data-ok]').addEventListener('click', () => { fermer(); ok(); }));
    const echap = (e) => { if (e.key === 'Escape') fermer(); };
    document.addEventListener('keydown', echap);

    const v = {
      get db() { return db; }, D, esc, ctx, fenetre, fermer, confirmer,
      sauver() { D.sauver(db); },
      aller, rendre: () => aller(route, true),
      notifier: (m) => { if (ctx.notifier) ctx.notifier(m); },
      // monter un module externe (magasin 3D) dans un élément de la page
      // erp : la base du CRM (toujours la version à jour) → le magasin 3D utilise les mêmes articles et le même stock
      monterSous(el, mod) { if (sous) { try { sous.detruire(); } catch { /* déjà fermé */ } } sous = mod ? mod.monter(el, { ...ctx, erp: { get db() { return db; }, sauver: () => D.sauver(db), D } }) : null; },
    };

    // Icône de chaque entrée du menu de côté (états : pastille de couleur).
    const icoMenu = (l, r, s) => {
      const [tete, vue, etat] = r.split('/');
      if (s && vue === 'liste' && D.ETATS[tete]) { const e = D.ETATS[tete].find((x) => x[0] === etat); if (e) return `<i class="erp-point st-${e[2]}"></i>`; }
      const i = /^Nouve/.test(l) ? 'plus' : /Statistiques/.test(l) ? 'stats' : /Tags/.test(l) ? 'tag' : /Mouvements/.test(l) ? 'mouvement' : /Réappro/.test(l) ? 'reappro' : /Magasin/.test(l) ? 'magasin' : /^Stocks/.test(l) ? 'stock' : /variantes/.test(l) ? 'produit'
        : /prospect/i.test(l) ? 'cible' : /client/i.test(l) ? 'client' : /fournisseur/i.test(l) ? 'camion' : /Impay|retard/i.test(l) ? 'alerte' : /Pay/.test(l) ? 'valider' : 'liste';
      return D.ui.ico(i);
    };
    const ICO_GROUPE = { purge: 'alerte', accueil: 'accueil', tiers: 'tiers', 'contacts/liste/tous': 'contacts', produits: 'produit', mouvements: 'stock', prop: 'commerce', cmd: 'commande', achat: 'camion', retour: 'retour', fact: 'facture', echange: 'liste' };
    function dessinerMenu() {
      const m = MODULES.find((x) => x.id === module) || MODULES[0];
      conteneur.querySelectorAll('[data-module]').forEach((b) => b.classList.toggle('actif', b.dataset.module === module));
      conteneur.querySelector('[data-menu]').innerHTML = m.menu.map((g) => `<div class="erp-menu-g"><button type="button" class="erp-menu-t${route === g.r ? ' actif' : ''}" data-aller="${esc(g.r)}">${D.ui.ico(ICO_GROUPE[g.r] || 'liste')}${esc(g.t)}</button>
        ${g.items.map(([l, r, s]) => `<button type="button" class="erp-menu-i${s ? ' sous' : ''}${route === r ? ' actif' : ''}" data-aller="${esc(r)}">${icoMenu(l, r, s)}${esc(l)}</button>`).join('')}</div>`).join('');
    }

    // Données en ligne (js/erp-nuage.js) : nouvelle version venue du serveur (autre poste ou fusion).
    // Affichée tout de suite, sauf pendant une saisie ou un formulaire : elle sera prise à la page suivante.
    let enAttente = null;
    const N = window.FMDERPNuage;
    const occupe = () => {
      const a = document.activeElement;
      return /\/(nouveau|modifier)/.test(route) || (a && conteneur.contains(a) && a.matches('input, textarea, select'))
        || !!(document.getElementById('fenetre') && !document.getElementById('fenetre').hidden);
    };
    const offMaj = N ? N.surMaj((nv) => { if (occupe()) enAttente = nv; else { db = nv; if (D.appliquerArbo) D.appliquerArbo(db); aller(route, true); } }) : null;
    const zoneEtat = conteneur.querySelector('[data-etat-nuage]');
    const offEtat = N && N.actif ? N.surEtat((e) => {
      const couleur = { ok: 'st-ok', envoi: 'st-info', attente: 'st-info', erreur: 'st-ko' }[e.statut] || 'st-neutre';
      zoneEtat.innerHTML = `<span class="pastille">En ligne</span> <i class="erp-point ${couleur}"></i> ${esc(e.texte)}${e.heure && e.statut === 'ok' ? ' · ' + esc(e.heure) : ''}`;
    }) : null;

    // Présence (25/11, js/presence.js) : fiche tiers ou document ouvert → annoncé aux autres postes ; bandeau si un
    // collègue est déjà dessus.
    let objetPresence = null; let quoiPresence = 'cette fiche';
    const P = window.FMDPresence;
    function majPresence() {
      let b = zone.querySelector('[data-presence]');
      const txt = P && objetPresence ? P.phrase('crm', objetPresence, quoiPresence) : '';
      if (!txt) { if (b) b.remove(); return; }
      if (!b) { zone.insertAdjacentHTML('afterbegin', '<div class="erp-presence" data-presence role="status"></div>'); b = zone.querySelector('[data-presence]'); }
      b.innerHTML = `<span class="erp-presence-point" aria-hidden="true"></span><b>${esc(txt)}</b><small>Vos modifications et les siennes s’enregistrent en direct : en cas de modification du même champ, la dernière version du serveur l’emporte.</small>`;
    }
    const offPresence = P ? P.surChange(majPresence) : null;

    function aller(r, memePlace) {
      if (!r) return;
      if (enAttente) { db = enAttente; enAttente = null; if (D.appliquerArbo) D.appliquerArbo(db); }
      if (!memePlace && r !== route) histo.push(route);
      route = r; ecrire('fmd-crm-route', r);
      const [tete, ...args] = r.split('/');
      const mod = tete === 'tags' ? (args[0] === 'produits' ? 'catalogue' : 'tiers') : tete === 'recherche' ? module : MODULE_DE[tete] || 'accueil';
      module = mod;
      dessinerMenu();
      if (sous) { try { sous.detruire(); } catch { /* déjà fermé */ } sous = null; }
      fermer();
      D.ui.dbCourant = db; // vignettes et recherche des listes déroulantes cherchables (erp-ui.js)
      const page = D.pages[tete] || D.pages.accueil;
      let res;
      try { res = page(v, args); } catch (e) { console.error(e); res = { html: `<div class="erp-vide-page"><h1>Page indisponible</h1><p class="erp-gris">${esc(e.message)}</p>${D.ui.lien('accueil', 'Revenir à l’accueil')}</div>` }; }
      const y = memePlace ? zone.scrollTop : 0;
      zone.innerHTML = `<div class="erp-contenu">${res.html}</div>`;
      zone.scrollTop = y;
      if (res.apres) { try { res.apres(zone.firstElementChild); } catch (e) { console.error(e); } }
      const mp = r.match(/^(prop|cmd|achat|fact|tiers|retour)\/(fiche|modifier)\/([^/]+)/);
      objetPresence = mp ? `${mp[1]}/${mp[3]}` : null; quoiPresence = mp && mp[1] === 'tiers' ? 'cette fiche' : 'ce document';
      if (P) P.etre('crm', objetPresence);
      majPresence();
    }

    // Navigation : tout élément [data-aller] ouvre la route indiquée.
    conteneur.addEventListener('click', (e) => {
      // Sélecteur de période des graphiques (js/erp-ui.js, U.choixPeriode)
      const pm = e.target.closest('[data-periode-mode], [data-periode-nav]');
      if (pm) { const c = pm.closest('[data-periode-cle]'); D.ui.changerPeriode(c.dataset.periodeCle, c.dataset.periodeDefaut, pm.dataset.periodeMode ? { mode: pm.dataset.periodeMode } : { nav: +pm.dataset.periodeNav }); aller(route, true); return; }
      if (e.target.closest('select, input, textarea, label, [data-stop]')) return; // champ dans une ligne cliquable
      const a = e.target.closest('[data-aller]'); if (a && conteneur.contains(a)) { e.preventDefault(); aller(a.dataset.aller); return; }
      const m = e.target.closest('[data-module]');
      if (m) { const mod = MODULES.find((x) => x.id === m.dataset.module); if (mod) aller(mod.menu[0].r); }
    });
    conteneur.addEventListener('change', (e) => { const i = e.target.closest('[data-periode-date]'); if (!i || !i.value) return; const c = i.closest('[data-periode-cle]'); D.ui.changerPeriode(c.dataset.periodeCle, c.dataset.periodeDefaut, { date: i.value }); aller(route, true); });
    conteneur.querySelector('[data-cherche]').addEventListener('submit', (e) => { e.preventDefault(); const q = e.target.querySelector('input').value.trim(); if (q) aller('recherche/' + encodeURIComponent(q)); });

    aller(route, true);

    return {
      detruire() {
        if (offPresence) offPresence(); if (P) P.etre('crm', null);
        if (offMaj) offMaj();
        if (offEtat) offEtat();
        if (sous) { try { sous.detruire(); } catch { /* déjà fermé */ } sous = null; }
        document.removeEventListener('keydown', echap);
        fermer();
        conteneur.classList.remove('page-crm', 'page-erp', 'crm-clair');
        const f = document.getElementById('fenetre'); if (f) f.classList.remove('crm-clair');
        conteneur.innerHTML = '';
      },
    };
  }

  window.FMDCRM = { monter };
})();
