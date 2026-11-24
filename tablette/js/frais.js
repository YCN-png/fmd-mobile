// FMD — Notes de frais et indemnités kilométriques (23 nov. 2026, proposition de réorganisation des modules fournie par
// l'utilisateur : « La gestion des indemnités kilométriques peut être intégrée à FINANCES, dans la partie Notes de frais »).
// Contenu : véhicules (puissance fiscale), déplacements professionnels (date, départ, destination, motif, distance saisie
// ou calculée, client du CRM, rendez-vous de l'agenda), calcul selon le barème kilométrique, historique, suivi des
// remboursements, validation par un responsable (administrateur). Notes de frais classiques (repas, péage, hôtel…).
// Barème : barème fiscal des frais kilométriques (impots.gouv.fr), gelé depuis 2023 (encore valable pour 2026).
// Calcul : le barème est annuel et dépend du total de km de l'année pour un véhicule → chaque déplacement vaut
// barème(km cumulés de l'année après lui) − barème(km cumulés avant lui). Montant figé à la validation.
// Données : db.frais de la base du CRM (enregistrée en ligne par js/erp-nuage.js) : { vehicules, trajets, notes, n }.
// Chacun voit ses propres frais ; un administrateur voit tout et valide.
// Styles : ceux de FM'PAREBRISE / FM'RENOV (.page-renov rv-, .page-pb pb-) + préfixe fr- (app.css).
// Utilisé par js/app.js : window.FMDFrais.monter(conteneur, ctx) → { detruire() }.
(function () {
  'use strict';

  // [clé, libellé, cv max, [[a, b] par tranche]] : montant annuel = d × a + b. Tranches : seuils (km).
  const BAREME = {
    voiture: { lib: 'Voiture', seuils: [5000, 20000], cv: [
      [3, '3 CV et moins', [[0.529, 0], [0.316, 1065], [0.370, 0]]],
      [4, '4 CV', [[0.606, 0], [0.340, 1330], [0.407, 0]]],
      [5, '5 CV', [[0.636, 0], [0.357, 1395], [0.427, 0]]],
      [6, '6 CV', [[0.665, 0], [0.374, 1457], [0.447, 0]]],
      [99, '7 CV et plus', [[0.697, 0], [0.394, 1515], [0.470, 0]]]] },
    moto: { lib: 'Moto (plus de 50 cm³)', seuils: [3000, 6000], cv: [
      [2, '1 ou 2 CV', [[0.395, 0], [0.099, 891], [0.248, 0]]],
      [5, '3 à 5 CV', [[0.468, 0], [0.082, 1158], [0.275, 0]]],
      [99, 'Plus de 5 CV', [[0.606, 0], [0.079, 1583], [0.343, 0]]]] },
    cyclo: { lib: 'Cyclomoteur (50 cm³ et moins)', seuils: [3000, 6000], cv: [
      [99, 'Toutes puissances', [[0.315, 0], [0.079, 711], [0.198, 0]]]] },
  };
  const BAREME_NOM = 'Barème fiscal des frais kilométriques (inchangé depuis 2023, valable 2026)';
  const CATS = [['repas', 'Repas'], ['hebergement', 'Hébergement'], ['carburant', 'Carburant'], ['peage', 'Péage'], ['parking', 'Stationnement'],
    ['transport', 'Train, avion, taxi'], ['fournitures', 'Petites fournitures'], ['reception', 'Repas d’affaires / réception'], ['autre', 'Autre']];
  const STATUTS = [['brouillon', 'Brouillon', 'st-neutre'], ['soumise', 'À valider', 'st-att'], ['validee', 'Validée · à rembourser', 'st-info'],
    ['refusee', 'Refusée', 'st-ko'], ['remboursee', 'Remboursée', 'st-ok']];

  function monter(conteneur, ctx) {
    const D = window.FMDERP, U = D.ui, esc = U.esc;
    const lireLS = (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
    const ecrireLS = (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignoré */ } };
    let db = D.charger();
    const B = () => { const r = (db.frais = db.frais || {}); ['vehicules', 'trajets', 'notes'].forEach((k) => { r[k] = r[k] || []; }); r.n = r.n || 0; return r; };
    const sauver = () => D.sauver(db);
    const notifier = (m) => { if (ctx.notifier) ctx.notifier(m); };
    const moi = (ctx.moi && ctx.moi.id) || 'local', moiNom = (ctx.moi && ctx.moi.nom) || 'Moi';
    const admin = !!ctx.admin;
    let route = lireLS('fmd-fr-route', 'accueil'); const histo = [];

    // ---------- calculs ----------
    const ligneBareme = (v) => { const t = BAREME[v.type] || BAREME.voiture; return t.cv.find((c) => (+v.cv || 0) <= c[0]) || t.cv[t.cv.length - 1]; };
    function annuel(v, d) { // montant annuel du barème pour d km dans l'année
      if (!v || d <= 0) return 0;
      const t = BAREME[v.type] || BAREME.voiture; const [a, b] = ligneBareme(v)[2][d <= t.seuils[0] ? 0 : d <= t.seuils[1] ? 1 : 2];
      return (d * a + b) * (v.electrique ? 1.2 : 1);
    }
    const kmTrajet = (x) => (+x.km || 0) * (x.ar ? 2 : 1);
    const vehicule = (id) => B().vehicules.find((v) => v.id === id);
    const ordre = (a, b) => (a.date || '').localeCompare(b.date || '') || (a.cree || '').localeCompare(b.cree || '');
    // Montant de chaque déplacement (cumul de l'année, par véhicule ; refusés exclus)
    function montants() {
      const res = new Map(); const cumul = new Map();
      B().trajets.filter((x) => x.statut !== 'refusee').slice().sort(ordre).forEach((x) => {
        const k = `${x.vehicule}|${String(x.date || '').slice(0, 4)}`; const avant = cumul.get(k) || 0; const apres = avant + kmTrajet(x);
        cumul.set(k, apres);
        res.set(x.id, x.montant_fige != null ? +x.montant_fige : D.arrondi(annuel(vehicule(x.vehicule), apres) - annuel(vehicule(x.vehicule), avant)));
      });
      return res;
    }
    let M = montants();
    const montantDe = (x) => (x.km != null && x.vehicule ? (x.statut === 'refusee' ? 0 : M.get(x.id) || 0) : +x.montant || 0);
    const visibles = (l) => (admin ? l : l.filter((x) => x.auteur === moi));
    const statutPill = (x) => { const s = STATUTS.find((t) => t[0] === (x.statut || 'brouillon')) || STATUTS[0]; return `<span class="pastille ${s[2]}"><i class="erp-point"></i>${esc(s[1])}</span>`; };
    const nomTiers = (id) => { const t = id && db.tiers && db.tiers.find((y) => y.id === id); return t ? t.nom : ''; };
    const annee = String(new Date().getFullYear());
    const tout = () => [...visibles(B().trajets).map((x) => ({ ...x, _t: 'trajet' })), ...visibles(B().notes).map((x) => ({ ...x, _t: 'note' }))];
    const lienDe = (x) => `${x._t}/${x.id}`;
    const quoi = (x) => (x._t === 'trajet' ? `🚗 ${esc(x.depart || '?')} → ${esc(x.arrivee || '?')}${x.ar ? ' (A/R)' : ''}` : `${esc((CATS.find((c) => c[0] === x.categorie) || CATS[8])[1])} · ${esc(x.libelle || '')}`);

    // ---------- coquille ----------
    conteneur.classList.add('page-crm', 'page-erp', 'page-renov', 'page-pb', 'page-frais', 'crm-clair');
    const fen = document.getElementById('fenetre'); if (fen) fen.classList.add('crm-clair');
    const ONGLETS = [['accueil', 'Accueil', 'euro'], ['notes', 'Notes de frais', 'liste'], ['trajets', 'Indemnités kilométriques', 'liste'], ['vehicules', 'Mes véhicules', 'liste'], ...(admin ? [['valider', 'À valider', 'valider']] : [])];
    conteneur.innerHTML = `
      <header class="erp-haut"><div class="erp-marque"><span class="crm-logo">€</span><b>Notes de frais</b></div>
        <button type="button" class="btn btn-ligne petit renov-retour" data-retour>← Retour</button>
        <nav class="erp-modules" aria-label="Notes de frais">${ONGLETS.map(([k, t, i]) => `<button type="button" data-aller="${k}" data-onglet="${k}">${U.ico(i)}${esc(t)}</button>`).join('')}</nav></header>
      <aside class="erp-cote" aria-label="Raccourcis"><div class="erp-societe">FINANCES · Notes de frais</div><nav data-menu></nav></aside>
      <main class="erp-page" id="fr-page"></main>`;
    const zone = conteneur.querySelector('#fr-page');
    const PARENT = { note: 'notes', trajet: 'trajets', vehicule: 'vehicules' };
    function menu() {
      const tete = route.split('/')[0]; const onglet = PARENT[tete] || tete;
      conteneur.querySelectorAll('[data-onglet]').forEach((b) => b.classList.toggle('actif', b.dataset.onglet === onglet));
      const aValider = [...B().trajets, ...B().notes].filter((x) => x.statut === 'soumise').length;
      conteneur.querySelector('[data-menu]').innerHTML = `<div class="erp-menu-g">
        <button type="button" class="erp-menu-i" data-aller="trajet/nouveau">+ Nouveau déplacement</button>
        <button type="button" class="erp-menu-i" data-aller="note/nouveau">+ Nouvelle note de frais</button>
        <button type="button" class="erp-menu-i" data-aller="vehicule/nouveau">+ Ajouter un véhicule</button>
        ${admin ? `<button type="button" class="erp-menu-i${tete === 'valider' ? ' actif' : ''}" data-aller="valider">À valider <span class="erp-compte">${aValider}</span></button>` : ''}</div>`;
      conteneur.querySelector('[data-retour]').disabled = !histo.length;
    }
    function aller(r, memePlace) {
      if (!r) return;
      if (!memePlace) { db = D.charger(); if (r !== route) histo.push(route); if (histo.length > 50) histo.shift(); }
      M = montants(); route = r; ecrireLS('fmd-fr-route', r); menu();
      const [tete, ...a] = r.split('/');
      let res; try { res = (PAGES[tete] || PAGES.accueil)(a); } catch (e) { console.error(e); res = { html: `<div class="erp-vide-page"><h1>Page indisponible</h1><p class="erp-gris">${esc(e.message)}</p>${U.lien('accueil', 'Revenir à l’accueil')}</div>` }; }
      const y = memePlace ? zone.scrollTop : 0;
      zone.innerHTML = `<div class="erp-contenu">${res.html}</div>`; zone.scrollTop = y;
      if (res.apres) { try { res.apres(zone.firstElementChild); } catch (e) { console.error(e); } }
    }
    const rendre = () => aller(route, true);
    const retour = () => { if (!histo.length) return; route = histo.pop(); aller(route, true); };
    const clic = (e) => { if (e.target.closest('[data-retour]')) { retour(); return; } const a = e.target.closest('[data-aller]'); if (a && conteneur.contains(a) && !a.disabled) { e.preventDefault(); aller(a.dataset.aller); } };
    const souris = (e) => { if (e.button === 3) { e.preventDefault(); retour(); } };
    conteneur.addEventListener('click', clic); conteneur.addEventListener('mouseup', souris);

    // ---------- pages ----------
    const PAGES = {};
    const tete = (titre, nb, bouton) => `<div class="rv-tete"><div><p class="rv-sur">FINANCES · Notes de frais</p><h1>${titre}${nb != null ? ` <span class="rv-nb">${nb}</span>` : ''}</h1></div>${bouton || ''}</div>`;
    const widget = (lib, val, sous, cls = '') => `<div class="rv-widget rv-petit"><div><span class="rv-label">${esc(lib)}</span><b class="${cls}">${val}</b><small>${esc(sous)}</small></div></div>`;
    const colonnes = (avecQui) => [['Date', (x) => D.jour(x.date)], ...(avecQui ? [['Personne', (x) => esc(x.auteur_nom || '—')]] : []), ['Quoi', quoi],
      ['Client', (x) => esc(nomTiers(x.tiers) || '—')], ['Statut', statutPill], ['Montant', (x) => D.euros(montantDe(x)), 'nb']];

    PAGES.accueil = () => {
      const l = tout(); const an = l.filter((x) => String(x.date || '').startsWith(annee));
      const somme = (f) => D.arrondi(l.filter(f).reduce((s, x) => s + montantDe(x), 0));
      const km = an.filter((x) => x._t === 'trajet' && x.statut !== 'refusee').reduce((s, x) => s + kmTrajet(x), 0);
      const recents = l.slice().sort((a, b) => ordre(b, a)).slice(0, 12);
      return { html: `${tete(admin ? 'Frais de l’équipe' : 'Mes frais')}
        <div class="pb-totaux">${widget('À rembourser', D.euros(somme((x) => x.statut === 'validee')), 'validé, pas encore payé', 'neg')}
          ${widget('En attente de validation', D.euros(somme((x) => x.statut === 'soumise')), `${l.filter((x) => x.statut === 'soumise').length} élément(s)`)}
          ${widget(`Remboursé en ${annee}`, D.euros(somme((x) => x.statut === 'remboursee' && String(x.date || '').startsWith(annee))), 'notes + indemnités km', 'pos')}
          ${widget(`Kilomètres pro ${annee}`, `${D.nombre(km)} km`, `${B().vehicules.filter((v) => admin || v.proprio === moi).length} véhicule(s)`)}</div>
        <div class="fr-actions">${U.btn('+ Nouveau déplacement', 'ok', 'btn-metal', 'data-aller="trajet/nouveau"')}${U.btn('+ Nouvelle note de frais', 'ok', 'btn-ligne', 'data-aller="note/nouveau"')}</div>
        <section class="rv-widget"><h2 class="pb-h2">Derniers frais</h2>${U.tableau(colonnes(admin), recents, { lien: lienDe, vide: 'Aucun frais pour le moment.' })}</section>` };
    };

    const liste = (type, titre, bouton) => {
      const l = tout().filter((x) => x._t === type).sort((a, b) => ordre(b, a));
      const total = D.arrondi(l.reduce((s, x) => s + montantDe(x), 0));
      return { html: `${tete(titre, l.length, bouton)}
        <section class="rv-widget">${U.tableau(colonnes(admin), l, { lien: lienDe, vide: 'Rien pour le moment.', pied: l.length ? `<tr><td colspan="${admin ? 5 : 4}">Total</td><td class="nb"><b>${D.euros(total)}</b></td></tr>` : '' })}</section>` };
    };
    PAGES.notes = () => liste('note', 'Notes de frais', U.btn('+ Nouvelle note de frais', 'ok', 'btn-metal', 'data-aller="note/nouveau"'));
    PAGES.trajets = () => {
      const r = liste('trajet', 'Indemnités kilométriques', U.btn('+ Nouveau déplacement', 'ok', 'btn-metal', 'data-aller="trajet/nouveau"'));
      r.html += `<p class="pb-aide">${esc(BAREME_NOM)}. Le montant d’un déplacement dépend du total de km de l’année pour le véhicule ; il est figé quand le déplacement est validé.${B().vehicules.length ? '' : ' Ajoutez d’abord un véhicule (onglet « Mes véhicules »).'}</p>`;
      return r;
    };
    PAGES.valider = () => {
      if (!admin) return PAGES.accueil();
      const l = [...B().trajets.map((x) => ({ ...x, _t: 'trajet' })), ...B().notes.map((x) => ({ ...x, _t: 'note' }))];
      const av = l.filter((x) => x.statut === 'soumise').sort(ordre), ar = l.filter((x) => x.statut === 'validee').sort(ordre);
      return { html: `${tete('À valider', av.length)}<section class="rv-widget"><h2 class="pb-h2">Demandes à valider</h2>${U.tableau(colonnes(true), av, { lien: lienDe, vide: 'Aucune demande en attente.' })}</section>
        <section class="rv-widget"><h2 class="pb-h2">Validé, à rembourser</h2>${U.tableau(colonnes(true), ar, { lien: lienDe, vide: 'Rien à rembourser.' })}</section>` };
    };

    // ---------- véhicules ----------
    PAGES.vehicules = () => {
      const l = B().vehicules.filter((v) => admin || v.proprio === moi);
      return { html: `${tete('Mes véhicules', l.length, U.btn('+ Ajouter un véhicule', 'ok', 'btn-metal', 'data-aller="vehicule/nouveau"'))}
        <section class="rv-widget">${U.tableau([['Véhicule', (v) => `<b>${esc(v.nom)}</b>`], ['Immatriculation', (v) => esc(v.immat || '—')], ...(admin ? [['Propriétaire', (v) => esc(v.proprio_nom || '—')]] : []),
          ['Type', (v) => esc((BAREME[v.type] || BAREME.voiture).lib)], ['Puissance fiscale', (v) => `${esc(ligneBareme(v)[1])}${v.electrique ? ' · électrique (+20 %)' : ''}`]], l, { lien: (v) => `vehicule/${v.id}`, vide: 'Aucun véhicule. Ajoutez celui que vous utilisez pour vos déplacements professionnels.' })}</section>` };
    };
    PAGES.vehicule = ([id]) => {
      const neuf = id === 'nouveau'; const v = neuf ? { type: 'voiture', cv: 5 } : vehicule(id);
      if (!v) return { html: `<div class="erp-vide-page"><h1>Véhicule introuvable</h1>${U.lien('vehicules', 'Voir les véhicules')}</div>` };
      const ch = (lib, html, o = {}) => `<label class="pb-champ${o.large ? ' large' : ''}"><span>${esc(lib)}${o.req ? ' *' : ''}</span>${html}</label>`;
      return { html: `${tete(neuf ? 'Ajouter un véhicule' : esc(v.nom))}
        <form id="fr-v" class="pb-form erp-ajout" autocomplete="off"><section class="rv-widget fr-plein"><div class="pb-grille">
          ${ch('Nom du véhicule', U.inp('nom', v.nom || '', { req: true, ph: 'Ex : Clio perso' }), { req: true })}${ch('Immatriculation', U.inp('immat', v.immat || '', { ph: 'AB-123-CD' }))}
          ${ch('Type', U.sel('type', Object.entries(BAREME).map(([k, t]) => [k, t.lib]), v.type))}${ch('Puissance fiscale (CV, carte grise P.6)', U.inp('cv', v.cv ?? '', { type: 'number', min: 1, req: true }), { req: true })}
          <label class="pb-champ"><span>Électrique</span><span><input type="checkbox" name="electrique"${v.electrique ? ' checked' : ''}> Oui (barème +20 %)</span></label></div>
          <p class="pb-aide">La puissance fiscale est sur la carte grise, case P.6.</p></section>
          <div class="pb-pied">${U.btn(neuf ? 'Ajouter' : 'Enregistrer', 'ok', 'btn-metal', 'type="submit"')}${neuf ? U.btn('Annuler', '', 'btn-ligne', 'type="button" data-retour') : U.btn('Supprimer', 'supprimer', 'btn-ligne', 'type="button" data-fr="suppr"')}</div></form>`,
      apres: (el) => {
        el.querySelector('#fr-v').addEventListener('submit', (e) => { e.preventDefault(); const f = U.lire(e.target);
          const x = neuf ? { id: D.id('vh'), proprio: moi, proprio_nom: moiNom, cree: D.maintenant() } : v;
          Object.assign(x, { nom: f.nom, immat: String(f.immat || '').toUpperCase(), type: f.type, cv: +f.cv || 0, electrique: !!f.electrique }); D.toucher(x);
          if (neuf) B().vehicules.push(x); sauver(); notifier(neuf ? 'Véhicule ajouté.' : 'Véhicule enregistré.'); aller('vehicules'); });
        const s = el.querySelector('[data-fr="suppr"]'); if (s) s.addEventListener('click', () => {
          if (B().trajets.some((t) => t.vehicule === v.id)) { notifier('Ce véhicule a des déplacements : il ne peut pas être supprimé.'); return; }
          if (!confirm(`Supprimer le véhicule « ${v.nom} » ?`)) return; B().vehicules.splice(B().vehicules.indexOf(v), 1); sauver(); notifier('Véhicule supprimé.'); aller('vehicules'); });
      } };
    };

    // ---------- fiche commune (déplacement ou note) : statut, actions de validation ----------
    const modifiable = (x) => admin || (x.auteur === moi && ['brouillon', 'refusee'].includes(x.statut || 'brouillon'));
    function barreStatut(x, liste) {
      const acts = [];
      const a = (k, t, cls = 'btn-ligne') => acts.push(`<button type="button" class="btn ${cls} petit" data-statut="${k}">${esc(t)}</button>`);
      const s = x.statut || 'brouillon';
      if (x.auteur === moi && ['brouillon', 'refusee'].includes(s)) a('soumise', admin ? 'Envoyer à la validation' : 'Envoyer au responsable', 'btn-metal');
      if (x.auteur === moi && s === 'soumise') a('brouillon', 'Reprendre (brouillon)');
      if (admin && s === 'soumise') { a('validee', 'Valider', 'btn-metal'); a('refusee', 'Refuser'); }
      if (admin && s === 'validee') { a('remboursee', 'Marquer remboursé', 'btn-metal'); a('soumise', 'Annuler la validation'); }
      if (admin && s === 'remboursee') a('validee', 'Annuler le remboursement');
      return `<section class="rv-widget fr-statut"><div>${statutPill(x)}${x.valide_par ? `<small>Validé par ${esc(x.valide_par)} le ${D.jour(x.valide_le)}</small>` : ''}${x.rembourse_le ? `<small>Remboursé le ${D.jour(x.rembourse_le)}</small>` : ''}${x.refus ? `<small>Motif du refus : ${esc(x.refus)}</small>` : ''}</div>
        <div class="fr-montant"><span class="rv-label">Montant</span><b>${D.euros(montantDe(x))}</b></div><div class="fr-acts">${acts.join('')}</div></section>`;
    }
    function brancherStatut(el, x, liste) {
      el.querySelectorAll('[data-statut]').forEach((b) => b.addEventListener('click', () => {
        const k = b.dataset.statut;
        if (k === 'refusee') { const m = prompt('Motif du refus (facultatif) :', ''); if (m === null) return; x.refus = m; } else if (k !== 'remboursee') delete x.refus;
        if (k === 'validee' && x.statut === 'soumise') { x.valide_par = moiNom; x.valide_le = D.auj(); if (liste === 'trajets') x.montant_fige = M.get(x.id) || 0; }
        if (k === 'soumise' || k === 'brouillon') { delete x.valide_par; delete x.valide_le; delete x.montant_fige; }
        if (k === 'remboursee') x.rembourse_le = D.auj(); else delete x.rembourse_le;
        x.statut = k; D.toucher(x); sauver();
        notifier({ soumise: 'Envoyé à la validation.', validee: 'Validé.', refusee: 'Refusé.', remboursee: 'Marqué remboursé.', brouillon: 'Repassé en brouillon.' }[k]); rendre();
      }));
    }
    const ch = (lib, html, o = {}) => `<label class="pb-champ${o.large ? ' large' : ''}"><span>${esc(lib)}${o.req ? ' *' : ''}</span>${html}</label>`;
    const clients = () => (db.tiers || []).filter((t) => t.client || t.prospect).map((t) => [t.id, t.nom]).sort((a, b) => String(a[1]).localeCompare(String(b[1])));

    // ---------- déplacements (indemnités kilométriques) ----------
    PAGES.trajet = ([id]) => {
      const neuf = id === 'nouveau'; const x = neuf ? { date: D.auj(), statut: 'brouillon', auteur: moi } : B().trajets.find((t) => t.id === id);
      if (!x || (!admin && x.auteur !== moi)) return { html: `<div class="erp-vide-page"><h1>Déplacement introuvable</h1>${U.lien('trajets', 'Voir les déplacements')}</div>` };
      const mesV = B().vehicules.filter((v) => v.proprio === (x.auteur || moi) || v.id === x.vehicule);
      if (!mesV.length) return { html: `${tete('Nouveau déplacement')}<div class="rv-widget rv-vide"><p>Ajoutez d’abord le véhicule utilisé (puissance fiscale) : elle sert au calcul de l’indemnité.</p>${U.btn('+ Ajouter un véhicule', 'ok', 'btn-metal', 'data-aller="vehicule/nouveau"')}</div>` };
      const edit = neuf || modifiable(x); const ro = edit ? '' : ' disabled';
      return { html: `${tete(neuf ? 'Nouveau déplacement' : `Déplacement du ${D.jour(x.date)}`)}${neuf ? '' : barreStatut(x, 'trajets')}
        <form id="fr-t" class="pb-form erp-ajout" autocomplete="off"><fieldset class="fr-fs"${ro}>
          <section class="rv-widget"><h2 class="pb-h2">Trajet</h2><div class="pb-grille">
            ${ch('Partir d’un rendez-vous de l’agenda', '<select name="rdv" data-rdv><option value="">— Aucun —</option></select>', { large: true })}
            ${ch('Date', U.inp('date', x.date || '', { type: 'date', req: true }), { req: true })}${ch('Véhicule', U.sel('vehicule', mesV.map((v) => [v.id, `${v.nom} · ${ligneBareme(v)[1]}${v.electrique ? ' · élec.' : ''}`]), x.vehicule || mesV[0].id))}
            ${ch('Lieu de départ', U.inp('depart', x.depart || 'FMD, 3 quai Félix Faure, Angers', { req: true }), { req: true, large: true })}
            ${ch('Destination', U.inp('arrivee', x.arrivee || '', { req: true, ph: 'Adresse ou ville' }), { req: true, large: true })}
            ${ch('Motif', U.inp('motif', x.motif || '', { req: true, ph: 'Ex : rendez-vous client, livraison…' }), { req: true, large: true })}</div></section>
          <section class="rv-widget"><h2 class="pb-h2">Distance et client</h2><div class="pb-grille">
            ${ch('Distance aller (km)', `<span class="fr-km">${U.inp('km', x.km ?? '', { type: 'number', step: '0.1', min: 0, req: true })}<button type="button" class="btn btn-ligne petit" data-calc>Calculer</button></span>`, { req: true })}
            <label class="pb-champ"><span>Aller-retour</span><span><input type="checkbox" name="ar"${x.ar || neuf ? ' checked' : ''}> Oui (distance × 2)</span></label>
            ${ch('Client (CRM)', U.sel('tiers', clients(), x.tiers || '', { vide: '— Aucun —' }))}
            ${ch('Note', U.area('note', x.note || '', 2), { large: true })}</div>
            <p class="pb-aide" data-calc-info>« Calculer » cherche la distance par la route (service public adresse.data.gouv.fr + OpenStreetMap). Vérifiez-la avant d’envoyer.</p>
            <p class="fr-estim" data-estim></p></section>
          ${edit ? `<div class="pb-pied">${U.btn(neuf ? 'Enregistrer le déplacement' : 'Enregistrer', 'ok', 'btn-metal', 'type="submit"')}${neuf ? U.btn('Annuler', '', 'btn-ligne', 'type="button" data-retour') : U.btn('Supprimer', 'supprimer', 'btn-ligne', 'type="button" data-fr="suppr"')}</div>` : ''}
        </fieldset></form>`,
      apres: (el) => {
        const f = el.querySelector('#fr-t');
        if (!neuf) brancherStatut(el, x, 'trajets');
        // Estimation en direct (même calcul que la liste)
        const estimer = () => { const v = U.lire(f); const ve = vehicule(v.vehicule); const km = (+v.km || 0) * (v.ar ? 2 : 1); const o = el.querySelector('[data-estim]');
          if (!ve || !km) { o.textContent = ''; return; }
          const an = String(v.date || '').slice(0, 4); const avant = B().trajets.filter((t) => t.id !== x.id && t.statut !== 'refusee' && t.vehicule === ve.id && String(t.date || '').startsWith(an) && ordre(t, { date: v.date, cree: x.cree || '9' }) < 0).reduce((s, t) => s + kmTrajet(t), 0);
          const m = x.montant_fige != null ? +x.montant_fige : D.arrondi(annuel(ve, avant + km) - annuel(ve, avant));
          o.innerHTML = `Indemnité : <b>${D.euros(m)}</b> pour ${D.nombre(km)} km <small>(${D.nombre(avant)} km déjà faits en ${esc(an)} avec ce véhicule${x.montant_fige != null ? ' · montant figé à la validation' : ''})</small>`; };
        f.addEventListener('input', estimer); f.addEventListener('change', estimer); estimer();
        // Rendez-vous de l'agenda (90 derniers jours et 30 prochains) : préremplit date, destination, motif
        const selR = el.querySelector('[data-rdv]');
        if (ctx.sb && edit) {
          const d1 = new Date(Date.now() - 90 * 864e5).toISOString(), d2 = new Date(Date.now() + 30 * 864e5).toISOString();
          // Promise.resolve : la requête Supabase n'a que « then » (pas de « catch »)
          Promise.resolve(ctx.sb.from('agenda').select('id,titre,lieu,debut').eq('proprietaire', x.auteur || moi).gte('debut', d1).lte('debut', d2).order('debut', { ascending: false }).limit(150))
            .then(({ data }) => { if (!data || !selR.isConnected) return; const rdv = new Map(data.map((r) => [String(r.id), r]));
              selR.insertAdjacentHTML('beforeend', data.map((r) => `<option value="${esc(r.id)}"${String(x.rdv || '') === String(r.id) ? ' selected' : ''}>${esc(D.jour(String(r.debut).slice(0, 10)))} · ${esc(r.titre)}${r.lieu ? ` · ${esc(r.lieu)}` : ''}</option>`).join(''));
              selR.addEventListener('change', () => { const r = rdv.get(selR.value); if (!r) return; f.date.value = String(r.debut).slice(0, 10); if (r.lieu) f.arrivee.value = r.lieu; if (!f.motif.value) f.motif.value = r.titre || ''; estimer(); }); })
            .catch(() => { /* agenda indisponible : liste vide */ });
        } else if (selR) selR.closest('label').hidden = true;
        // Calcul de la distance par la route
        const bc = el.querySelector('[data-calc]');
        if (bc) bc.addEventListener('click', async () => {
          const info = el.querySelector('[data-calc-info]'); const a = f.depart.value.trim(), b = f.arrivee.value.trim();
          if (!a || !b) { info.textContent = 'Indiquez le départ et la destination.'; return; }
          bc.disabled = true; info.textContent = 'Calcul de la distance…';
          try {
            const geo = async (q) => { const r = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=1`); const j = await r.json(); const p = j.features && j.features[0]; if (!p) throw new Error(`Adresse introuvable : ${q}`); return p.geometry.coordinates; };
            const [p1, p2] = [await geo(a), await geo(b)];
            const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${p1.join(',')};${p2.join(',')}?overview=false`); const j = await r.json();
            if (!j.routes || !j.routes[0]) throw new Error('Itinéraire introuvable.');
            f.km.value = (Math.round(j.routes[0].distance / 100) / 10).toString(); info.textContent = 'Distance par la route calculée (aller simple). Vérifiez-la avant d’envoyer.'; estimer();
          } catch (e) { info.textContent = `Calcul impossible (${e.message || 'pas de connexion'}) : saisissez la distance à la main.`; } finally { bc.disabled = false; }
        });
        if (!edit) return;
        f.addEventListener('submit', (e) => { e.preventDefault(); const v = U.lire(f); const y = neuf ? { id: D.id('ik'), statut: 'brouillon', auteur: moi, auteur_nom: moiNom, cree: D.maintenant() } : x;
          Object.assign(y, { date: v.date, vehicule: v.vehicule, depart: v.depart, arrivee: v.arrivee, motif: v.motif, km: +v.km || 0, ar: !!v.ar, tiers: v.tiers || '', rdv: v.rdv || '', note: v.note || '' });
          D.toucher(y); if (neuf) B().trajets.push(y); sauver(); notifier(neuf ? 'Déplacement enregistré (brouillon).' : 'Déplacement enregistré.'); aller(`trajet/${y.id}`); });
        const s = el.querySelector('[data-fr="suppr"]'); if (s) s.addEventListener('click', () => { if (!confirm('Supprimer ce déplacement ?')) return; B().trajets.splice(B().trajets.indexOf(x), 1); sauver(); notifier('Déplacement supprimé.'); aller('trajets'); });
      } };
    };

    // ---------- notes de frais ----------
    PAGES.note = ([id]) => {
      const neuf = id === 'nouveau'; const x = neuf ? { date: D.auj(), statut: 'brouillon', auteur: moi, categorie: 'repas' } : B().notes.find((t) => t.id === id);
      if (!x || (!admin && x.auteur !== moi)) return { html: `<div class="erp-vide-page"><h1>Note introuvable</h1>${U.lien('notes', 'Voir les notes de frais')}</div>` };
      const edit = neuf || modifiable(x); const ro = edit ? '' : ' disabled';
      return { html: `${tete(neuf ? 'Nouvelle note de frais' : esc(x.libelle || 'Note de frais'))}${neuf ? '' : barreStatut(x, 'notes')}
        <form id="fr-n" class="pb-form erp-ajout" autocomplete="off"><fieldset class="fr-fs"${ro}>
          <section class="rv-widget"><h2 class="pb-h2">Dépense</h2><div class="pb-grille">
            ${ch('Date', U.inp('date', x.date || '', { type: 'date', req: true }), { req: true })}${ch('Catégorie', U.sel('categorie', CATS, x.categorie))}
            ${ch('Libellé', U.inp('libelle', x.libelle || '', { req: true, ph: 'Ex : déjeuner client, péage A11…' }), { req: true, large: true })}
            ${ch('Montant TTC (€)', U.inp('montant', x.montant ?? '', { type: 'number', step: '0.01', min: 0, req: true }), { req: true })}${ch('Dont TVA (€)', U.inp('tva', x.tva ?? '', { type: 'number', step: '0.01', min: 0 }))}
            ${ch('Client (CRM)', U.sel('tiers', clients(), x.tiers || '', { vide: '— Aucun —' }))}${ch('Note', U.area('note', x.note || '', 2), { large: true })}</div></section>
          <section class="rv-widget"><h2 class="pb-h2">Justificatif</h2>${x.justif ? `<img class="fr-justif" src="${esc(x.justif)}" alt="Justificatif">` : '<p class="erp-gris">Aucun justificatif.</p>'}
            ${edit ? `${ch('Photo ou scan du ticket (image)', '<input type="file" name="justif_fichier" accept="image/*">')}${x.justif ? '<button type="button" class="erp-lien" data-fr="sans-justif">Retirer le justificatif</button>' : ''}` : ''}</section>
          ${edit ? `<div class="pb-pied">${U.btn(neuf ? 'Enregistrer la note' : 'Enregistrer', 'ok', 'btn-metal', 'type="submit"')}${neuf ? U.btn('Annuler', '', 'btn-ligne', 'type="button" data-retour') : U.btn('Supprimer', 'supprimer', 'btn-ligne', 'type="button" data-fr="suppr"')}</div>` : ''}
        </fieldset></form>`,
      apres: (el) => {
        if (!neuf) brancherStatut(el, x, 'notes');
        if (!edit) return;
        const f = el.querySelector('#fr-n');
        f.addEventListener('submit', async (e) => { e.preventDefault(); const v = U.lire(f); const y = neuf ? { id: D.id('nf'), statut: 'brouillon', auteur: moi, auteur_nom: moiNom, cree: D.maintenant() } : x;
          Object.assign(y, { date: v.date, categorie: v.categorie, libelle: v.libelle, montant: D.arrondi(+v.montant || 0), tva: v.tva === '' ? '' : D.arrondi(+v.tva || 0), tiers: v.tiers || '', note: v.note || '' });
          const fi = f.justif_fichier && f.justif_fichier.files[0]; if (fi) { try { y.justif = await U.lireImage(fi, { max: 1400, jpeg: true, centrer: false }); } catch (err) { notifier(err.message); } }
          D.toucher(y); if (neuf) B().notes.push(y); sauver(); notifier(neuf ? 'Note de frais enregistrée (brouillon).' : 'Note enregistrée.'); aller(`note/${y.id}`); });
        const sj = el.querySelector('[data-fr="sans-justif"]'); if (sj) sj.addEventListener('click', () => { delete x.justif; D.toucher(x); sauver(); rendre(); });
        const s = el.querySelector('[data-fr="suppr"]'); if (s) s.addEventListener('click', () => { if (!confirm('Supprimer cette note de frais ?')) return; B().notes.splice(B().notes.indexOf(x), 1); sauver(); notifier('Note supprimée.'); aller('notes'); });
      } };
    };

    aller(route, true);
    return {
      detruire() {
        conteneur.removeEventListener('click', clic); conteneur.removeEventListener('mouseup', souris);
        conteneur.classList.remove('page-crm', 'page-erp', 'page-renov', 'page-pb', 'page-frais', 'crm-clair'); if (fen) fen.classList.remove('crm-clair'); conteneur.innerHTML = '';
      },
      aller,
    };
  }

  window.FMDFrais = { monter, BAREME, _annuel: (v, d) => { const t = BAREME[v.type] || BAREME.voiture; const l = t.cv.find((c) => (+v.cv || 0) <= c[0]) || t.cv[t.cv.length - 1]; const [a, b] = l[2][d <= t.seuils[0] ? 0 : d <= t.seuils[1] ? 1 : 2]; return (d * a + b) * (v.electrique ? 1.2 : 1); } };
})();
