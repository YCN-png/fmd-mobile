// FMD — FM'RENOV : chantiers de rénovation réalisés avec des sous-traitants (17 nov. 2026, demande de l'utilisateur,
// inspiré de l'écran « Nouveau chantier » de MS ÉNERGIE : D:\MS ENERGIE\code\frontend\src\pages\ChantierEditor.jsx).
// BASE À PART, au plus simple (demande du 17/11) : ses propres clients et sous-traitants, ses devis et factures,
// pas de fournisseurs / contacts du CRM. Les données sont rangées dans db.renov de la base du CRM uniquement pour
// profiter de son enregistrement automatique en ligne (js/erp-nuage.js) ; aucun écran du CRM ne les affiche.
// Écrans : tableau de bord (widgets + graphiques des dépenses), chantiers, clients, sous-traitants, devis, factures.
// Bouton « ← Retour » : revient à l'écran précédent. Briques d'affichage : js/erp-ui.js (D.ui), styles .page-erp.
// Utilisé par js/app.js : window.FMDRenov.monter(conteneur, ctx) → { detruire() }.
(function () {
  'use strict';

  const TYPES = ['Rénovation complète', 'Salle de bain', 'Cuisine', 'Peinture', 'Électricité', 'Plomberie', 'Menuiserie', 'Isolation', 'Climatisation', 'Toiture', 'Maçonnerie', 'Autre'];
  const STATUTS = [['a_planifier', 'À planifier', 'neutre'], ['planifie', 'Planifié', 'att'], ['en_cours', 'En cours', 'info'], ['termine', 'Terminé', 'ok'], ['annule', 'Annulé', 'ko']];
  const ETATS_DEVIS = [['brouillon', 'Brouillon', 'neutre'], ['envoye', 'Envoyé', 'att'], ['accepte', 'Accepté', 'ok'], ['refuse', 'Refusé', 'ko']];
  // Ordre fixe des 3 dépenses (couleurs catégorielles 1, 2, 3 du logiciel), jamais permuté.
  const DEPENSES = [['mo', 'Main d’œuvre', 'var(--cat-1)'], ['achat', 'Matériel acheté', 'var(--cat-2)'], ['location', 'Matériel loué', 'var(--cat-3)']];
  const TVAS = [[20, '20 %'], [10, '10 % (rénovation)'], [5.5, '5,5 % (rénovation énergétique)'], [0, '0 %']];
  const MENU = [['bord', 'Tableau de bord', 'stats'], ['chantiers', 'Chantiers', 'preparer'], ['clients', 'Clients', 'client'], ['st', 'Sous-traitants', 'tiers'], ['devis', 'Devis', 'commerce'], ['factures', 'Factures', 'facture']];

  function monter(conteneur, ctx) {
    const D = window.FMDERP, U = D.ui, esc = U.esc;
    const lireLS = (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
    const ecrireLS = (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignoré */ } };
    let db = D.charger();
    const R = () => { const r = (db.renov = db.renov || {}); ['clients', 'st', 'chantiers', 'devis', 'factures'].forEach((k) => { r[k] = r[k] || []; }); r.n = r.n || {}; return r; };
    const sauver = () => D.sauver(db);
    const notifier = (m) => { if (ctx.notifier) ctx.notifier(m); };
    let route = lireLS('fmd-renov-route', 'bord'); const histo = [];

    // ---------- calculs ----------
    const totalDep = (l) => D.arrondi((+l.qte || 0) * (+l.pu || 0));
    const cout = (c, type) => D.arrondi((c.depenses || []).filter((l) => !type || l.type === type).reduce((s, l) => s + totalDep(l), 0));
    // Montant total facturé (€ HT) saisi par l'utilisateur ; ma marge = montant − dépenses (17/11/2026).
    // Anciens chantiers : « ma part » (0.4.63) → montant = dépenses + part ; sinon marge % sur les dépenses.
    const montant = (c) => (c.montant != null && c.montant !== '' ? +c.montant || 0 : c.part != null && c.part !== '' ? D.arrondi(cout(c) + (+c.part || 0)) : null);
    const vente = (c) => (montant(c) != null ? montant(c) : D.arrondi(cout(c) * (1 + (+c.marge || 0) / 100)));
    const gain = (c) => D.arrondi(vente(c) - cout(c)); // ma marge
    const ht = (d) => D.arrondi(d.lignes.reduce((s, l) => s + (+l.qte || 0) * (+l.pu || 0), 0));
    const tva = (d) => D.arrondi(d.lignes.reduce((s, l) => s + (+l.qte || 0) * (+l.pu || 0) * (+l.tva || 0) / 100, 0));
    const ttc = (d) => D.arrondi(ht(d) + tva(d));
    const num = (k, p) => { const r = R(); r.n[k] = (r.n[k] || 0) + 1; return `${p}-${new Date().getFullYear()}-${String(r.n[k]).padStart(4, '0')}`; };
    const trouve = (k, id) => R()[k].find((x) => x.id === id);
    const nomDe = (k, id) => (trouve(k, id) || {}).nom || '—';
    const pastille = (liste, id) => { const s = liste.find((x) => x[0] === id) || liste[0]; return `<span class="pastille st-${s[2]}"><i class="erp-point"></i>${s[1]}</span>`; };
    const etatFacture = (f) => (f.payee ? ['payee', 'Payée', 'ok'] : f.echeance < D.auj() ? ['retard', 'En retard', 'ko'] : ['impayee', 'Impayée', 'att']);
    const pastFact = (f) => { const e = etatFacture(f); return `<span class="pastille st-${e[2]}"><i class="erp-point"></i>${e[1]}</span>`; };
    const lienC = (id) => (trouve('clients', id) ? U.lien(`client/${id}`, esc(nomDe('clients', id))) : '—');
    const lienS = (id) => (trouve('st', id) ? U.lien(`sst/${id}`, esc(nomDe('st', id))) : '—');

    // ---------- coquille ----------
    const clair = true; // FM'RENOV : mode clair (demande du 17/11), widgets rose gold
    conteneur.classList.add('page-crm', 'page-erp', 'page-renov'); conteneur.classList.toggle('crm-clair', clair);
    const fen = document.getElementById('fenetre'); if (fen) fen.classList.toggle('crm-clair', clair);
    conteneur.innerHTML = `
      <header class="erp-haut"><div class="erp-marque"><span class="crm-logo">Rn</span><b>FM’RENOV</b></div>
        <button type="button" class="btn btn-ligne petit renov-retour" data-retour>← Retour</button>
        <nav class="erp-modules" aria-label="FM’RENOV">${MENU.map(([r, l, i]) => `<button type="button" data-aller="${r}" data-onglet="${r}">${U.ico(i)}${esc(l)}</button>`).join('')}</nav></header>
      <aside class="erp-cote" aria-label="Raccourcis"><div class="erp-societe">FM’RENOV · Chantiers</div><nav data-menu></nav></aside>
      <main class="erp-page" id="renov-page"></main>`;
    const zone = conteneur.querySelector('#renov-page');
    const section = (r) => ({ chantier: 'chantiers', client: 'clients', sst: 'st', doc: r.split('/')[1] === 'fa' ? 'factures' : 'devis' })[r.split('/')[0]] || r.split('/')[0];
    function menu() {
      const s = section(route);
      conteneur.querySelectorAll('[data-onglet]').forEach((b) => b.classList.toggle('actif', b.dataset.onglet === s));
      const items = [['chantiers/nouveau', '+ Nouveau chantier'], ['clients/nouveau', '+ Nouveau client'], ['st/nouveau', '+ Nouveau sous-traitant']];
      conteneur.querySelector('[data-menu]').innerHTML = `<div class="erp-menu-g">${MENU.map(([r, l, i]) => `<button type="button" class="erp-menu-i${s === r ? ' actif' : ''}" data-aller="${r}">${U.ico(i)}${esc(l)}</button>`).join('')}</div>
        <div class="erp-menu-g">${items.map(([r, l]) => `<button type="button" class="erp-menu-i${route === r ? ' actif' : ''}" data-aller="${r}">${U.ico('plus')}${esc(l.slice(2))}</button>`).join('')}</div>`;
      conteneur.querySelector('[data-retour]').disabled = !histo.length;
    }
    function aller(r, memePlace) {
      if (!r) return;
      if (!memePlace) { db = D.charger(); if (r !== route) histo.push(route); if (histo.length > 50) histo.shift(); }
      route = r; ecrireLS('fmd-renov-route', r); menu();
      const [tete, ...a] = r.split('/');
      let res; try { res = (PAGES[tete] || PAGES.bord)(a); } catch (e) { console.error(e); res = { html: `<div class="erp-vide-page"><h1>Page indisponible</h1><p class="erp-gris">${esc(e.message)}</p>${U.lien('bord', 'Revenir au tableau de bord')}</div>` }; }
      const y = memePlace ? zone.scrollTop : 0;
      zone.innerHTML = `<div class="erp-contenu">${res.html}</div>`; zone.scrollTop = y;
      if (res.apres) { try { res.apres(zone.firstElementChild); } catch (e) { console.error(e); } }
    }
    const rendre = () => aller(route, true);
    const fin = (o, msg) => { if (o) D.toucher(o); sauver(); if (msg) notifier(msg); rendre(); };
    const retour = () => { if (!histo.length) return; route = histo.pop(); aller(route, true); };
    const clic = (e) => {
      if (e.target.closest('[data-retour]')) { retour(); return; }
      const a = e.target.closest('[data-aller]'); if (a && conteneur.contains(a) && !a.disabled) { e.preventDefault(); aller(a.dataset.aller); }
    };
    conteneur.addEventListener('click', clic);
    const touche = (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role=button][data-aller]')) { e.preventDefault(); aller(e.target.dataset.aller); } };
    conteneur.addEventListener('keydown', touche);
    const souris = (e) => { if (e.button === 3) { e.preventDefault(); retour(); } }; // bouton « précédent » de la souris
    conteneur.addEventListener('mouseup', souris);

    // ---------- graphiques ----------
    // Barres empilées par mois (6 derniers mois), 3 séries dans l'ordre fixe, survol = détail du mois.
    function barresMois(chantiers) {
      const mois = []; const d0 = new Date(); for (let i = 5; i >= 0; i--) { const d = new Date(d0.getFullYear(), d0.getMonth() - i, 1); mois.push({ cle: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, lib: U.MOIS[d.getMonth()], v: { mo: 0, achat: 0, location: 0 } }); }
      chantiers.forEach((c) => (c.depenses || []).forEach((l) => { const m = mois.find((x) => x.cle === String(l.date || '').slice(0, 7)); if (m) m.v[l.type] += totalDep(l); }));
      const max = Math.max(1, ...mois.map((m) => m.v.mo + m.v.achat + m.v.location));
      return `<div class="renov-barres" role="img" aria-label="Dépenses des 6 derniers mois par type">${mois.map((m) => { const tot = m.v.mo + m.v.achat + m.v.location;
        return `<div class="renov-col" title="${esc(m.lib)} : ${DEPENSES.map(([k, l]) => `${l} ${D.euros(m.v[k])}`).join(' · ')} · Total ${D.euros(tot)}"><span>${tot ? esc(U.court(tot)) : ''}</span>
          <div class="renov-pile">${DEPENSES.slice().reverse().map(([k, , c]) => (m.v[k] ? `<i style="height:${(m.v[k] / max) * 100}%;background:${c}"></i>` : '')).join('')}</div><em>${esc(m.lib)}</em></div>`; }).join('')}</div>
        <ul class="renov-legende">${DEPENSES.map(([, l, c]) => `<li><i style="background:${c}"></i>${l}</li>`).join('')}</ul>`;
    }

    // ---------- pages ----------
    const champ = (lib, html, o) => U.ligne(lib, html, o);
    const PAGES = {};

    // ---------- widgets (style « Apple », D.A. noir + rose gold) ----------
    const moisListe = (n = 6) => { const l = []; const d0 = new Date(); for (let i = n - 1; i >= 0; i--) { const d = new Date(d0.getFullYear(), d0.getMonth() - i, 1); l.push({ cle: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, lib: U.MOIS[d.getMonth()] }); } return l; };
    const encaisseLe = (f) => String(f.payee_le || f.date || '').slice(0, 7);
    const gros = (n) => { const [e, c] = D.euros(n).replace(/\s?€/, '').split(','); return `<b class="rv-gros">${esc(e)}<small>,${esc(c || '00')} €</small></b>`; };
    const fleche = (haut, neutre) => `<span class="rv-fleche ${neutre ? 'neutre' : haut ? 'haut' : 'bas'}" aria-hidden="true">${neutre ? '•' : haut ? '↑' : '↓'}</span>`;
    const ecart = (a, b) => (b ? Math.round(((a - b) / Math.abs(b)) * 1000) / 10 : null);
    const txtEcart = (p) => (p == null ? 'pas de comparaison' : `${p >= 0 ? '+' : ''}${D.nombre(p)} % vs mois dernier`);
    // Courbe fine (une seule série) : trait rose gold, aire en fondu ; survol de chaque point = valeur du mois.
    function courbe(vals, libs, id) {
      const W = 320, H = 90, P = 6; const max = Math.max(1, ...vals), min = Math.min(0, ...vals);
      const pts = vals.map((v, i) => [P + (i * (W - 2 * P)) / Math.max(1, vals.length - 1), H - P - ((v - min) / (max - min || 1)) * (H - 2 * P)]);
      const ligne = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
      const der = pts[pts.length - 1];
      return `<svg class="rv-courbe" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Revenu des 6 derniers mois">
        <defs><linearGradient id="${id}t" x1="0" x2="1"><stop offset="0" stop-color="#F7DAC5"/><stop offset="1" stop-color="#C08A6E"/></linearGradient>
          <linearGradient id="${id}a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E9BFA6" stop-opacity=".28"/><stop offset="1" stop-color="#E9BFA6" stop-opacity="0"/></linearGradient></defs>
        <line x1="${P}" x2="${W - P}" y1="${H - P}" y2="${H - P}" class="rv-base"/>
        <path d="${ligne} L${der[0].toFixed(1)} ${H - P} L${P} ${H - P} Z" fill="url(#${id}a)"/>
        <path d="${ligne}" fill="none" stroke="url(#${id}t)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
        ${pts.map((p, i) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="9" class="rv-cible"><title>${esc(libs[i])} : ${esc(D.euros(vals[i]))}</title></circle>`).join('')}
      </svg><div class="rv-axe">${libs.map((l) => `<span>${esc(l)}</span>`).join('')}</div>`;
    }
    const miniBarres = (vals, libs, c) => { const max = Math.max(1, ...vals); return `<div class="rv-mini">${vals.map((v, i) => `<i title="${esc(libs[i])} : ${esc(D.euros(v))}" style="height:${v ? Math.max(6, (v / max) * 100) : 4}%;background:${v ? c : 'var(--ligne)'}"></i>`).join('')}</div>`; };

    // Avancement d'un chantier (comme Onify) : Devis → Accepté → Travaux → Facturé → Payé
    const ETAPES = ['Devis', 'Accepté', 'Travaux', 'Facturé', 'Payé'];
    const avancement = (c) => { const r = R(); const dv = r.devis.filter((d) => d.chantier === c.id), fa = r.factures.filter((f) => f.chantier === c.id);
      if (fa.length && fa.every((f) => f.payee)) return 5; if (fa.length) return 4; if (['en_cours', 'termine'].includes(c.statut)) return 3; if (dv.some((d) => d.etat === 'accepte')) return 2; return dv.length ? 1 : 0; };
    const carteChantier = (c) => { const n = avancement(c); const m = gain(c);
      return `<article class="rv-widget rv-carte" data-aller="chantier/${c.id}/general" tabindex="0" role="button" aria-label="Ouvrir ${esc(c.intitule || c.ref)}">
        <header><span class="rv-ref">${esc(c.ref)}</span>${pastille(STATUTS, c.statut)}</header>
        <h3>${esc(c.intitule || 'Chantier')}</h3><p>${esc([nomDe('clients', c.client), c.type].join(' · '))}</p>
        <ol class="rv-etapes" aria-label="Avancement : ${n} sur 5">${ETAPES.map((e, i) => `<li class="${i < n ? 'fait' : ''}${i === n ? ' actif' : ''}"><i></i><span>${e}</span></li>`).join('')}</ol>
        <footer><div><small>Montant HT</small><b>${D.euros(vente(c))}</b></div><div><small>Dépenses</small><b>${D.euros(cout(c))}</b></div><div><small>Ma marge</small><b class="${m >= 0 ? 'pos' : 'neg'}">${D.euros(m)}</b></div></footer></article>`; };
    const grilleChantiers = (l) => (l.length ? `<div class="rv-cartes">${l.map(carteChantier).join('')}</div>` : `<div class="rv-widget rv-vide"><p>Aucun chantier pour le moment.</p>${U.btn('+ Nouveau chantier', 'ok', 'btn-metal', 'data-aller="chantiers/nouveau"')}</div>`);

    PAGES.bord = () => {
      const r = R(); const mois = moisListe(6); const libs = mois.map((m) => m.lib);
      const tot = { mo: 0, achat: 0, location: 0 }; r.chantiers.forEach((c) => DEPENSES.forEach(([k]) => { tot[k] += cout(c, k); }));
      const toutes = D.arrondi(tot.mo + tot.achat + tot.location);
      const payees = r.factures.filter((f) => f.payee);
      const actifs = r.chantiers.filter((c) => c.statut !== 'annule');
      const moisDe = (c) => String(c.fin || c.debut || c.cree || '').slice(0, 7);
      const revenu = D.arrondi(actifs.reduce((s, c) => s + gain(c), 0));
      const encaisse = D.arrondi(actifs.filter((c) => avancement(c) === 5).reduce((s, c) => s + gain(c), 0));
      const serie = mois.map((m) => D.arrondi(actifs.filter((c) => moisDe(c) === m.cle).reduce((s, c) => s + gain(c), 0)));
      const pRev = ecart(serie[5], serie[4]);
      const facture = D.arrondi(r.factures.reduce((s, f) => s + ht(f), 0)), aEncaisser = D.arrondi(r.factures.filter((f) => !f.payee).reduce((s, f) => s + ttc(f), 0));
      const resultat = D.arrondi(facture - toutes);
      const depMois = (k) => mois.map((m) => r.chantiers.reduce((s, c) => s + (c.depenses || []).filter((l) => l.type === k && String(l.date || '').slice(0, 7) === m.cle).reduce((t, l) => t + totalDep(l), 0), 0));
      const enCours = r.chantiers.filter((c) => !['termine', 'annule'].includes(c.statut)).sort((a, b) => (b.cree || '').localeCompare(a.cree || ''));
      return { html: `<div class="rv-tete"><div><p class="rv-sur">FM’RENOV</p><h1>Tableau de bord</h1></div>${U.btn('+ Nouveau chantier', 'ok', 'btn-metal', 'data-aller="chantiers/nouveau"')}</div>
        <div class="rv-grille">
          <section class="rv-widget rv-revenu" aria-label="Mon revenu">
            <header><div><span class="rv-label">Mon revenu</span>${gros(revenu)}<span class="rv-sous">Ma marge HT · dont ${esc(D.euros(encaisse))} encaissé · ${esc(txtEcart(pRev))}</span></div>${fleche(pRev == null || pRev >= 0, pRev == null)}</header>
            ${courbe(serie, libs, 'rvc')}
            <div class="rv-duo">
              <div class="rv-widget rv-petit" data-aller="factures" role="button" tabindex="0"><div><span class="rv-label">Facturé HT</span><b>${D.euros(facture)}</b><small>${esc(D.euros(aEncaisser))} TTC à encaisser</small></div>${fleche(true)}</div>
              <div class="rv-widget rv-petit"><div><span class="rv-label">Résultat</span><b class="${resultat >= 0 ? 'pos' : 'neg'}">${D.euros(resultat)}</b><small>facturé − dépenses</small></div>${fleche(resultat >= 0)}</div>
            </div>
          </section>
          <section class="rv-widget rv-repart" aria-label="Répartition des dépenses"><span class="rv-label">Répartition des dépenses</span>${U.donut(DEPENSES.map(([k, l, c]) => ({ l, v: tot[k], c })), U.court(toutes), 'HT', { fmt: D.euros })}</section>
          ${DEPENSES.map(([k, l, c]) => `<section class="rv-widget rv-dep" aria-label="Dépense ${esc(l)}"><span class="rv-label"><i style="background:${c}"></i>Dépense ${esc(l.toLowerCase())}</span><b>${D.euros(tot[k])}</b><small>${toutes ? Math.round((tot[k] / toutes) * 100) : 0} % des dépenses · 6 derniers mois</small>${miniBarres(depMois(k), libs, c)}</section>`).join('')}
          <section class="rv-widget rv-compteurs"><div data-aller="chantiers" role="button" tabindex="0"><b>${enCours.length}</b><span>chantiers actifs</span></div><div data-aller="clients" role="button" tabindex="0"><b>${r.clients.length}</b><span>clients</span></div><div data-aller="st" role="button" tabindex="0"><b>${r.st.length}</b><span>sous-traitants</span></div></section>
        </div>
        <div class="rv-tete petite"><h2>Chantiers en cours</h2>${U.lien('chantiers', 'Tout voir ›')}</div>
        ${grilleChantiers(enCours.slice(0, 6))}
        <section class="rv-widget rv-mois"><span class="rv-label">Dépenses par mois</span>${barresMois(r.chantiers)}</section>` };
    };

    const tableChantiers = (l) => U.table([
      ['Réf.', (c) => `<b>${esc(c.ref)}</b>`], ['Intitulé', (c) => esc(c.intitule || '—')], ['Client', (c) => esc(nomDe('clients', c.client))], ['Début', (c) => D.jour(c.debut)],
      ...DEPENSES.map(([k, l]) => [l, (c) => D.euros(cout(c, k)), 'nombre']), ['Statut', (c) => pastille(STATUTS, c.statut)],
    ], l, { lien: (c) => `chantier/${c.id}/general`, vide: 'Aucun chantier : cliquez sur « Nouveau chantier ».' });

    PAGES.chantiers = (a) => {
      if (a[0] === 'nouveau') return formChantier(null);
      const l = R().chantiers.slice().sort((x, y) => (y.cree || '').localeCompare(x.cree || ''));
      const vue = lireLS('fmd-renov-vue', 'cartes');
      const bascule = `<div class="rv-bascule" role="group" aria-label="Affichage">${[['cartes', '▦ Cartes'], ['liste', '☰ Liste']].map(([k, t]) => `<button type="button" data-vue="${k}" class="${vue === k ? 'actif' : ''}" aria-pressed="${vue === k}">${t}</button>`).join('')}</div>`;
      return { html: `<div class="rv-tete"><div><p class="rv-sur">FM’RENOV</p><h1>Chantiers <span class="rv-nb">${l.length}</span></h1></div><div class="rv-actions">${bascule}${U.btn('+ Nouveau chantier', 'ok', 'btn-metal', 'data-aller="chantiers/nouveau"')}</div></div>
        ${vue === 'liste' ? U.bloc('Tous les chantiers', tableChantiers(l), { compte: l.length }) : grilleChantiers(l)}`,
      apres: (el) => el.querySelectorAll('[data-vue]').forEach((b) => b.addEventListener('click', () => { ecrireLS('fmd-renov-vue', b.dataset.vue); rendre(); })) };
    };

    function champsChantier(c) {
      const clients = R().clients.slice().sort((x, y) => x.nom.localeCompare(y.nom));
      return `${champ('Montant total de la facture (€ HT)', U.inp('montant', montant(c) ?? '', { type: 'number', step: '0.01', min: 0, ph: 'Ex : 4 500', req: true }), { req: true, aide: 'Le prix des travaux pour le client. Ajoutez ensuite les dépenses au fur et à mesure : votre marge = montant − dépenses.' })}
        ${champ('Client', `${U.sel('client', clients.map((t) => [t.id, t.nom]), c.client, { req: true, vide: 'Sélectionner un client' })}<button type="button" class="erp-lien renov-creer" data-aller="clients/nouveau">+ Créer un client</button>`, { req: true })}
        ${champ('Intitulé du chantier', U.inp('intitule', c.intitule, { ph: 'Ex : Rénovation salle de bain + carrelage cuisine', req: true }), { req: true })}
        ${champ('Type de chantier', U.sel('type', TYPES, c.type))}${champ('Statut', U.sel('statut', STATUTS.map((s) => [s[0], s[1]]), c.statut))}
        ${champ('Adresse du chantier', U.inp('adresse', c.adresse, { ph: 'Ex : 12 rue Bressigny, Angers' }), { large: true })}
        ${champ('Date de visite technique', U.inp('visite', c.visite, { type: 'date' }))}${champ('Début des travaux', U.inp('debut', c.debut, { type: 'date' }))}${champ('Fin des travaux', U.inp('fin', c.fin, { type: 'date' }))}
        ${champ('TVA du devis', U.sel('tva', TVAS, c.tva))}${champ('Description des travaux', U.area('description', c.description, 4), { large: true })}`;
    }
    const lireChantier = (c, f) => { const x = U.lire(f); Object.assign(c, { client: x.client, intitule: x.intitule, type: x.type, statut: x.statut, adresse: x.adresse, visite: x.visite, debut: x.debut, fin: x.fin, montant: x.montant === '' ? null : +x.montant, part: null, tva: +x.tva, description: x.description }); };
    function formChantier() {
      const c = { client: '', intitule: '', type: TYPES[0], statut: 'a_planifier', adresse: '', visite: '', debut: '', fin: '', montant: null, tva: 10, description: '' };
      if (!R().clients.length) return { html: `${U.titrePage('preparer', 'Nouveau chantier')}<div class="erp-carte"><p>Créez d’abord un client : le chantier lui sera rattaché.</p>${U.btn('+ Créer un client', 'ok', 'btn-metal', 'data-aller="clients/nouveau"')}</div>` };
      return { html: `${U.titrePage('preparer', 'Nouveau chantier')}<p class="erp-gris renov-intro">Renseignez les données du chantier, puis ajoutez les dépenses : le devis se génère tout seul.</p>${U.form('renov-f', champsChantier(c), `${U.btn('Créer le chantier ›', 'ok', 'btn-metal', 'type="submit"')}${U.btn('Annuler', '', 'btn-ligne', 'data-retour')}`)}`,
        apres: (el) => el.querySelector('#renov-f').addEventListener('submit', (e) => { e.preventDefault(); lireChantier(c, e.target);
          Object.assign(c, { id: D.id('ch'), ref: num('ch', 'CH'), depenses: [], partenaires: [], note: '', cree: D.maintenant() }); R().chantiers.push(c); D.toucher(c); sauver(); aller(`chantier/${c.id}/depenses`); }) };
    }

    PAGES.chantier = ([id, onglet = 'general']) => {
      const r = R(); const c = trouve('chantiers', id);
      if (!c) return { html: `<div class="erp-vide-page"><h1>Chantier introuvable</h1>${U.lien('chantiers', 'Voir les chantiers')}</div>` };
      const devis = r.devis.filter((d) => d.chantier === id), factures = r.factures.filter((f) => f.chantier === id);
      const tete = `${U.fiche({ ico: 'preparer', titre: `${esc(c.intitule || 'Chantier')} <span class="erp-gris">${esc(c.ref)}</span>`, sous: `<p>${lienC(c.client)}</p><p class="erp-gris">${esc([c.type, c.adresse].filter(Boolean).join(' · '))}</p>`,
        pastilles: pastille(STATUTS, c.statut), retour: 'chantiers', ...U.voisins(r.chantiers, id, (o) => `chantier/${o.id}/${onglet}`),
        onglets: [['general', 'Général'], ['depenses', 'Dépenses', (c.depenses || []).length], ['partenaires', 'Sous-traitants', (c.partenaires || []).length], ['documents', 'Devis & factures', devis.length + factures.length], ['notes', 'Notes', c.note ? 1 : 0]], actif: onglet, base: `chantier/${id}` })}
        <div class="renov-barre">${U.btn('Générer le devis', 'ok', 'btn-metal', 'data-ch="devis"')}${U.btn('Faire la facture', 'facturee', 'btn-ligne', `data-ch="facture"${devis.length ? '' : ' disabled title="Générez d’abord le devis"'}`)}
          <span class="renov-total">Montant <b>${D.euros(vente(c))}</b> HT − Dépenses <b>${D.euros(cout(c))}</b> = Ma marge <b class="${gain(c) >= 0 ? 'pos' : 'neg'}">${D.euros(gain(c))}</b></span></div>`;
      let corps = '', apres = null;
      if (onglet === 'depenses') {
        const l = c.depenses || [];
        corps = `${U.bloc('Ajouter une dépense', `<form id="renov-dep" class="renov-dep erp-ajout" autocomplete="off">
            <div class="renov-types">${DEPENSES.map(([t, lib], i) => `<label><input type="radio" name="type" value="${t}"${i ? '' : ' checked'}><span>${lib}</span></label>`).join('')}</div>
            <label>Libellé${U.inp('libelle', '', { ph: 'Ex : Pose carrelage, Placo BA13, Location échafaudage', req: true })}</label>
            <label>Sous-traitant${U.sel('qui', r.st.map((t) => [t.id, t.nom]), '', { vide: '—' })}</label>
            <label>Quantité${U.inp('qte', 1, { type: 'number', step: '0.01', min: 0 })}</label>
            <label>Prix unitaire HT (€)${U.inp('pu', '', { type: 'number', step: '0.01', min: 0, req: true })}</label>
            <label>Date${U.inp('date', D.auj(), { type: 'date' })}</label>
            <div>${U.btn('+ Ajouter la dépense', 'ok', 'btn-metal', 'type="submit"')}</div></form>`, { ico: 'euro' })}
          ${U.bloc('Dépenses du chantier', `${U.table([
            ['Type', (x) => `<span class="renov-tag"><i style="background:${(DEPENSES.find((d) => d[0] === x.type) || DEPENSES[0])[2]}"></i>${(DEPENSES.find((d) => d[0] === x.type) || DEPENSES[0])[1]}</span>`],
            ['Libellé', (x) => esc(x.libelle)], ['Sous-traitant', (x) => (x.qui ? lienS(x.qui) : '—')], ['Date', (x) => D.jour(x.date)],
            ['Qté', (x) => D.nombre(x.qte), 'nombre'], ['P.U. HT', (x) => D.euros(x.pu), 'nombre'], ['Total HT', (x) => `<b>${D.euros(totalDep(x))}</b>`, 'nombre'],
            ['', (x) => `<button type="button" class="erp-lien" data-suppr="${l.indexOf(x)}" title="Supprimer cette dépense" aria-label="Supprimer">✕</button>`],
          ], l, { vide: 'Aucune dépense : ajoutez la main d’œuvre et le matériel ci-dessus.' })}<div class="renov-sous">${DEPENSES.map(([k, lib]) => `<div><span>${lib}</span><b>${D.euros(cout(c, k))}</b></div>`).join('')}<div class="fort"><span>Total dépenses HT</span><b>${D.euros(cout(c))}</b></div></div>`, { compte: l.length })}`;
        apres = (el) => {
          const f = el.querySelector('#renov-dep');
          f.addEventListener('submit', (e) => { e.preventDefault(); const x = U.lire(f); (c.depenses = c.depenses || []).push({ type: x.type, libelle: x.libelle, qui: x.qui || '', qte: +x.qte || 1, pu: +x.pu || 0, date: x.date }); fin(c, `Dépense ajoutée : ${x.libelle}.`); });
          el.addEventListener('click', (e) => { const s = e.target.closest('[data-suppr]'); if (s) { c.depenses.splice(+s.dataset.suppr, 1); fin(c, 'Dépense supprimée.'); } });
        };
      } else if (onglet === 'partenaires') {
        const l = c.partenaires || [];
        corps = U.bloc('Sous-traitants du chantier', `${U.table([
            ['Sous-traitant', (p) => lienS(p.st)], ['Lot / mission', (p) => esc(p.role || '—')],
            ['Dépenses liées HT', (p) => D.euros(D.arrondi((c.depenses || []).filter((d) => d.qui === p.st).reduce((s, d) => s + totalDep(d), 0))), 'nombre'],
            ['', (p) => `<button type="button" class="erp-lien" data-retirer="${l.indexOf(p)}" title="Retirer" aria-label="Retirer">✕</button>`],
          ], l, { vide: 'Aucun sous-traitant sur ce chantier.' })}
          <form id="renov-st" class="renov-dep erp-ajout" autocomplete="off"><label>Sous-traitant${U.sel('st', r.st.map((t) => [t.id, t.nom]), '', { req: true, vide: 'Choisir…' })}</label>
            <label>Lot / mission${U.inp('role', '', { ph: 'Ex : Électricité, Plomberie, Plâtrerie' })}</label>
            <div>${U.btn('+ Ajouter', 'ok', 'btn-metal', 'type="submit"')}<button type="button" class="erp-lien renov-creer" data-aller="st/nouveau">+ Créer un sous-traitant</button></div></form>`, { ico: 'tiers', compte: l.length });
        apres = (el) => {
          el.querySelector('#renov-st').addEventListener('submit', (e) => { e.preventDefault(); const x = U.lire(e.target); (c.partenaires = c.partenaires || []).push({ st: x.st, role: x.role }); fin(c, 'Sous-traitant ajouté.'); });
          el.addEventListener('click', (e) => { const s = e.target.closest('[data-retirer]'); if (s) { c.partenaires.splice(+s.dataset.retirer, 1); fin(c, 'Sous-traitant retiré.'); } });
        };
      } else if (onglet === 'documents') {
        corps = U.bloc('Devis', tableDocs(devis, 'dv'), { ico: 'commerce', compte: devis.length }) + U.bloc('Factures', tableDocs(factures, 'fa'), { ico: 'facture', compte: factures.length });
      } else if (onglet === 'notes') {
        corps = `<form class="erp-carte erp-notes" id="renov-notes"><label>Notes du chantier<textarea name="note" rows="8">${esc(c.note || '')}</textarea></label><div>${U.btn('Enregistrer', 'ok', 'btn-metal', 'type="submit"')}</div></form>`;
        apres = (el) => el.querySelector('#renov-notes').addEventListener('submit', (e) => { e.preventDefault(); c.note = U.lire(e.target).note; fin(c, 'Notes enregistrées.'); });
      } else {
        corps = U.form('renov-f', champsChantier(c), `${U.btn('Enregistrer', 'ok', 'btn-metal', 'type="submit"')}${U.btn('Supprimer le chantier', 'supprimer', 'btn-ligne', 'type="button" data-ch="suppr"')}`);
        apres = (el) => el.querySelector('#renov-f').addEventListener('submit', (e) => { e.preventDefault(); lireChantier(c, e.target); fin(c, 'Chantier enregistré.'); });
      }
      return { html: tete + corps, apres: (el) => {
        el.addEventListener('click', (e) => { const b = e.target.closest('[data-ch]'); if (!b || b.disabled) return;
          if (b.dataset.ch === 'devis') genererDevis(c);
          if (b.dataset.ch === 'facture') { const d = devis.find((x) => x.etat === 'accepte') || devis[devis.length - 1]; faireFacture(d); }
          if (b.dataset.ch === 'suppr' && confirm(`Supprimer le chantier « ${c.intitule} » ? Ses devis et factures sont conservés.`)) { r.chantiers.splice(r.chantiers.indexOf(c), 1); sauver(); notifier('Chantier supprimé.'); aller('chantiers'); } });
        if (apres) apres(el); } };
    };

    // ---------- clients et sous-traitants (fiches simples) ----------
    const FICHES = {
      clients: { cle: 'clients', un: 'client', titre: 'Clients', ico: 'client', route: 'client', champs: [['nom', 'Nom ou société', true], ['tel', 'Téléphone'], ['email', 'E-mail'], ['adresse', 'Adresse']] },
      st: { cle: 'st', un: 'sous-traitant', titre: 'Sous-traitants', ico: 'tiers', route: 'sst', champs: [['nom', 'Nom ou société', true], ['metier', 'Métier (ex : électricien)'], ['tel', 'Téléphone'], ['email', 'E-mail'], ['siret', 'SIRET']] },
    };
    function listeFiches(F, a) {
      if (a[0] === 'nouveau') return formFiche(F, null);
      const r = R(); const l = r[F.cle].slice().sort((x, y) => x.nom.localeCompare(y.nom));
      const cols = [['Nom', (x) => `<b>${esc(x.nom)}</b>`], ...F.champs.slice(1, 3).map(([k, lib]) => [lib.replace(/ \(.*/, ''), (x) => esc(x[k] || '—')]),
        F.cle === 'clients' ? ['Chantiers', (x) => String(r.chantiers.filter((c) => c.client === x.id).length), 'nombre'] : ['Dépenses HT', (x) => D.euros(r.chantiers.reduce((s, c) => s + (c.depenses || []).filter((d) => d.qui === x.id).reduce((t, d) => t + totalDep(d), 0), 0)), 'nombre']];
      return { html: `${U.titrePage(F.ico, F.titre, l.length, U.btn(`+ Nouveau ${F.un}`, 'ok', 'btn-metal', `data-aller="${F.cle}/nouveau"`))}${U.bloc(`Liste des ${F.titre.toLowerCase()}`, U.table(cols, l, { lien: (x) => `${F.route}/${x.id}`, vide: `Aucun ${F.un} pour le moment.` }), { compte: l.length })}` };
    }
    function formFiche(F, x) {
      const o = x || {}; const neuf = !x;
      const corps = F.champs.map(([k, lib, req]) => champ(lib, U.inp(k, o[k] || '', { req, type: k === 'email' ? 'email' : 'text' }), { req })).join('') + champ('Note', U.area('note', o.note || '', 3), { large: true });
      return { html: `${neuf ? U.titrePage(F.ico, `Nouveau ${F.un}`) : ''}${U.form('renov-fiche', corps, `${U.btn(neuf ? `Créer le ${F.un}` : 'Enregistrer', 'ok', 'btn-metal', 'type="submit"')}${neuf ? U.btn('Annuler', '', 'btn-ligne', 'type="button" data-retour') : U.btn('Supprimer', 'supprimer', 'btn-ligne', 'type="button" data-suppr-fiche')}`)}`,
        apres: (el) => { const f = el.querySelector('#renov-fiche');
          f.addEventListener('submit', (e) => { e.preventDefault(); const v = U.lire(f); const cible = x || { id: D.id(F.cle === 'st' ? 'st' : 'cl'), cree: D.maintenant() };
            F.champs.forEach(([k]) => { cible[k] = v[k]; }); cible.note = v.note; D.toucher(cible);
            if (neuf) { R()[F.cle].push(cible); sauver(); notifier(`${cible.nom} ajouté.`); if (histo.length) retour(); else aller(`${F.route}/${cible.id}`); } else fin(null, 'Fiche enregistrée.'); });
          const s = el.querySelector('[data-suppr-fiche]');
          if (s) s.addEventListener('click', () => { const r = R(); const utilise = F.cle === 'clients' ? r.chantiers.some((c) => c.client === x.id) : r.chantiers.some((c) => (c.depenses || []).some((d) => d.qui === x.id) || (c.partenaires || []).some((p) => p.st === x.id));
            if (utilise) { notifier(`Impossible : ce ${F.un} est utilisé sur un chantier.`); return; }
            if (confirm(`Supprimer « ${x.nom} » ?`)) { r[F.cle].splice(r[F.cle].indexOf(x), 1); sauver(); aller(F.cle); } }); } };
    }
    function ficheTiers(F, id) {
      const r = R(); const x = trouve(F.cle, id);
      if (!x) return { html: `<div class="erp-vide-page"><h1>Fiche introuvable</h1>${U.lien(F.cle, 'Voir la liste')}</div>` };
      const ch = F.cle === 'clients' ? r.chantiers.filter((c) => c.client === id) : r.chantiers.filter((c) => (c.depenses || []).some((d) => d.qui === id) || (c.partenaires || []).some((p) => p.st === id));
      const f = formFiche(F, x);
      return { html: `${U.titrePage(F.ico, x.nom, null, `<span class="erp-gris">${esc(F.un)}${x.metier ? ' · ' + esc(x.metier) : ''}</span>`)}${f.html}${U.bloc('Chantiers', tableChantiers(ch), { compte: ch.length, ico: 'preparer' })}`, apres: f.apres };
    }
    PAGES.clients = (a) => listeFiches(FICHES.clients, a);
    PAGES.st = (a) => listeFiches(FICHES.st, a);
    PAGES.client = ([id]) => ficheTiers(FICHES.clients, id);
    PAGES.sst = ([id]) => ficheTiers(FICHES.st, id);

    // ---------- devis et factures ----------
    const tableDocs = (l, t) => U.table([
      ['Réf.', (d) => `<b>${esc(d.ref)}</b>`], ['Date', (d) => D.jour(d.date)], ['Client', (d) => esc(nomDe('clients', d.client))], ['Chantier', (d) => esc((trouve('chantiers', d.chantier) || {}).intitule || '—')],
      ['Total TTC', (d) => D.euros(ttc(d)), 'nombre'], ['État', (d) => (t === 'fa' ? pastFact(d) : pastille(ETATS_DEVIS, d.etat))],
    ], l, { lien: (d) => `doc/${t}/${d.id}`, vide: t === 'fa' ? 'Pas encore de facture.' : 'Pas encore de devis : ouvrez un chantier et cliquez sur « Générer le devis ».' });
    const parDate = (l) => l.slice().sort((a, b) => (b.cree || '').localeCompare(a.cree || ''));
    PAGES.devis = () => { const l = parDate(R().devis); return { html: `${U.titrePage('commerce', 'Devis', l.length)}${U.bloc('Tous les devis', tableDocs(l, 'dv'), { compte: l.length })}` }; };
    PAGES.factures = () => { const l = parDate(R().factures); return { html: `${U.titrePage('facture', 'Factures', l.length)}${U.bloc('Toutes les factures', tableDocs(l, 'fa'), { compte: l.length })}` }; };

    function genererDevis(c) {
      if (!trouve('clients', c.client)) { notifier('Choisissez d’abord le client du chantier (onglet Général).'); return; }
      if (montant(c) == null) { notifier('Indiquez d’abord le montant total de la facture (onglet Général).'); aller(`chantier/${c.id}/general`); return; }
      const date = D.auj();
      const d = { id: D.id('dv'), ref: num('dv', 'DV'), chantier: c.id, client: c.client, date, validite: D.ajout(date, 30), etat: 'brouillon', cree: D.maintenant(),
        lignes: [{ desc: [`${c.type ? c.type + ' — ' : ''}${c.intitule}`, c.adresse ? `Adresse du chantier : ${c.adresse}` : '', c.description || ''].filter(Boolean).join('\n'), qte: 1, pu: vente(c), tva: c.tva ?? 20 }] };
      D.toucher(d); R().devis.push(d); sauver(); notifier(`Devis ${d.ref} créé.`); aller(`doc/dv/${d.id}`);
    }
    function faireFacture(d) {
      if (!d) { notifier('Générez d’abord le devis.'); return; }
      const date = D.auj();
      const f = { id: D.id('fa'), ref: num('fa', 'FR'), chantier: d.chantier, client: d.client, devis: d.id, date, echeance: D.ajout(date, 30), payee: false, cree: D.maintenant(), lignes: d.lignes.map((l) => ({ ...l })) };
      D.toucher(f); R().factures.push(f); if (d.etat !== 'refuse') d.etat = 'accepte'; D.toucher(d); sauver(); notifier(`Facture ${f.ref} créée depuis le devis ${d.ref}.`); aller(`doc/fa/${f.id}`);
    }
    PAGES.doc = ([t, id]) => {
      const r = R(); const fa = t === 'fa'; const d = r[fa ? 'factures' : 'devis'].find((x) => x.id === id);
      if (!d) return { html: `<div class="erp-vide-page"><h1>Document introuvable</h1>${U.lien(fa ? 'factures' : 'devis', 'Voir la liste')}</div>` };
      const c = trouve('chantiers', d.chantier); const cl = trouve('clients', d.client) || {};
      const facts = fa ? [] : r.factures.filter((f) => f.devis === d.id);
      const act = fa ? [d.payee ? U.btn('Marquer impayée', 'rouvrir', 'btn-ligne', 'data-doc="impayee"') : U.btn('Marquer payée', 'valider', 'btn-metal', 'data-doc="payee"')]
        : [...ETATS_DEVIS.filter((e) => e[0] !== d.etat && e[0] !== 'brouillon').map((e) => U.btn(`Marquer ${e[1].toLowerCase()}`, e[0] === 'refuse' ? 'refuser' : 'valider', 'btn-ligne', `data-doc="${e[0]}"`)), U.btn('Faire la facture', 'facturee', 'btn-metal', 'data-doc="facture"')];
      return { html: `${U.titrePage(fa ? 'facture' : 'commerce', `${fa ? 'Facture' : 'Devis'} ${d.ref}`, null, fa ? pastFact(d) : pastille(ETATS_DEVIS, d.etat))}
        <div class="renov-barre">${act.join('')}${U.btn('PDF', 'pdf', 'btn-ligne', 'data-doc="pdf"')}${c ? U.btn('Voir le chantier', '', 'btn-ligne', `data-aller="chantier/${c.id}/documents"`) : ''}</div>
        ${U.bloc('Informations', U.infos([['Client', lienC(d.client)], ['Adresse', esc(cl.adresse || '—')], ['Chantier', c ? U.lien(`chantier/${c.id}/general`, esc(`${c.ref} — ${c.intitule}`)) : '—'], ['Date', D.jour(d.date)],
          fa ? ['Échéance', D.jour(d.echeance)] : ['Valable jusqu’au', D.jour(d.validite)], fa && d.devis ? ['Devis', U.lien(`doc/dv/${d.devis}`, esc((trouve('devis', d.devis) || {}).ref || '—'))] : null,
          facts.length ? ['Factures', facts.map((f) => U.lien(`doc/fa/${f.id}`, esc(f.ref))).join(' ')] : null]))}
        ${U.bloc('Lignes', U.table([['Désignation', (l) => esc(l.desc).replace(/\n/g, '<br>')], ['Qté', (l) => D.nombre(l.qte), 'nombre'], ['P.U. HT', (l) => D.euros(l.pu), 'nombre'], ['TVA', (l) => `${D.nombre(l.tva)} %`, 'nombre'], ['Total HT', (l) => `<b>${D.euros(l.qte * l.pu)}</b>`, 'nombre']], d.lignes)
          + `<div class="renov-sous"><div><span>Total HT</span><b>${D.euros(ht(d))}</b></div><div><span>TVA</span><b>${D.euros(tva(d))}</b></div><div class="fort"><span>Total TTC</span><b>${D.euros(ttc(d))}</b></div></div>`, { compte: d.lignes.length })}`,
      apres: (el) => el.addEventListener('click', (e) => { const b = e.target.closest('[data-doc]'); if (!b) return; const k = b.dataset.doc;
        if (k === 'pdf') { pdf(fa ? 'fa' : 'dv', d); return; }
        if (k === 'facture') { faireFacture(d); return; }
        if (k === 'payee' || k === 'impayee') { d.payee = k === 'payee'; d.payee_le = d.payee ? D.auj() : ''; fin(d, d.payee ? 'Facture payée.' : 'Facture remise en impayée.'); return; }
        d.etat = k; fin(d, 'Devis mis à jour.'); }) };
    };

    // ---------- PDF (charte FMD) ----------
    async function pdf(t, d) {
      const S = D.SOCIETE || { nom: 'FMD' }; const cl = trouve('clients', d.client) || {}; const c = trouve('chantiers', d.chantier) || {};
      const titre = t === 'fa' ? 'FACTURE' : 'DEVIS';
      const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${titre} ${esc(d.ref)}</title><style>
        @page{size:A4;margin:0}body{margin:0;font:12px/1.45 Montserrat,Arial,sans-serif;color:#1d1a18}
        .h{background:#080808;color:#f6eee9;padding:28px 40px;display:flex;justify-content:space-between;align-items:flex-end}
        .h b{font-size:26px;letter-spacing:2px;background:linear-gradient(135deg,#F7DAC5,#6F4A3C);-webkit-background-clip:text;color:transparent}.h small{display:block;color:#cbb3a4}
        .c{padding:28px 40px}.g{display:flex;justify-content:space-between;gap:30px;margin-bottom:22px}.g div{flex:1}.g h3{margin:0 0 6px;font-size:10px;letter-spacing:1px;color:#8a6a5a;text-transform:uppercase}
        table{width:100%;border-collapse:collapse}th{text-align:left;font-size:10px;text-transform:uppercase;color:#8a6a5a;border-bottom:2px solid #c9a08a;padding:6px}td{padding:7px 6px;border-bottom:1px solid #eee}.n{text-align:right;white-space:nowrap}
        .t{margin:16px 0 0 auto;width:260px}.t div{display:flex;justify-content:space-between;padding:4px 0}.t .f{font-weight:700;font-size:15px;border-top:2px solid #080808;margin-top:4px;padding-top:8px}
        .p{margin-top:40px;color:#777;font-size:10px}</style></head><body>
        <div class="h"><div><b>${esc(S.nom)}</b><small>FM’RENOV · ${esc(S.adresse || '')} ${esc(S.ville || '')}${S.tel ? ' · ' + esc(S.tel) : ''}</small></div><div style="text-align:right"><b>${titre}</b><small>${esc(d.ref)} · ${D.jour(d.date)}</small></div></div>
        <div class="c"><div class="g"><div><h3>Client</h3><strong>${esc(cl.nom || '')}</strong><br>${esc(cl.adresse || '')}<br>${esc([cl.tel, cl.email].filter(Boolean).join(' · '))}</div>
          <div><h3>Chantier</h3><strong>${esc(c.intitule || '')}</strong><br>${esc(c.adresse || '')}<br>${t === 'fa' ? `Échéance : ${D.jour(d.echeance)}` : `Valable jusqu’au ${D.jour(d.validite)}`}</div></div>
        <table><thead><tr><th>Désignation</th><th class="n">Qté</th><th class="n">P.U. HT</th><th class="n">TVA</th><th class="n">Total HT</th></tr></thead><tbody>
        ${d.lignes.map((l) => `<tr><td>${esc(l.desc).replace(/\n/g, '<br>')}</td><td class="n">${D.nombre(l.qte)}</td><td class="n">${D.euros(l.pu)}</td><td class="n">${D.nombre(l.tva)} %</td><td class="n">${D.euros(l.qte * l.pu)}</td></tr>`).join('')}</tbody></table>
        <div class="t"><div><span>Total HT</span><span>${D.euros(ht(d))}</span></div><div><span>TVA</span><span>${D.euros(tva(d))}</span></div><div class="f"><span>Total TTC</span><span>${D.euros(ttc(d))}</span></div></div>
        ${t === 'dv' ? '<p class="p">Bon pour accord — date et signature du client :</p>' : ''}</div></body></html>`;
      if (window.lanceur && window.lanceur.docPdf) {
        notifier('Préparation du PDF…');
        try { const f = await window.lanceur.docPdf(html, t === 'fa' ? 'FM’RENOV Factures' : 'FM’RENOV Devis', `${d.ref} ${(trouve('clients', d.client) || {}).nom || ''}`.trim()); if (f) await window.lanceur.docAfficher(f); }
        catch (e) { notifier('Le PDF n’a pas pu être fabriqué : ' + e.message); }
        return;
      }
      const fr = document.createElement('iframe'); fr.style.cssText = 'position:fixed;width:0;height:0;border:0'; document.body.appendChild(fr);
      fr.contentDocument.open(); fr.contentDocument.write(html); fr.contentDocument.close();
      setTimeout(() => { try { fr.contentWindow.print(); } catch { /* impression indisponible */ } setTimeout(() => fr.remove(), 1500); }, 300);
    }

    aller(route, true);
    return {
      detruire() {
        conteneur.removeEventListener('click', clic); conteneur.removeEventListener('keydown', touche); conteneur.removeEventListener('mouseup', souris);
        conteneur.classList.remove('page-crm', 'page-erp', 'page-renov', 'crm-clair'); if (fen) fen.classList.remove('crm-clair'); conteneur.innerHTML = '';
      },
      aller, // essais
    };
  }

  window.FMDRenov = { monter };
})();
