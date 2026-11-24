// FMD — CRM / ERP : Commerce (propositions commerciales, commandes clients, commandes fournisseurs) et Facturation.
// Modèle : captures Dolibarr « CRM\5-Commerce ». Création en 2 PAGES comme Dolibarr : page 1 = en-tête (client,
// dates, conditions) → « Créer brouillon » → page 2 = fiche du document où l'on ajoute les lignes (prix automatique
// selon le client : prix négocié, sinon niveau de prix, + remise client), puis on valide.
// Parcours : proposition → signée → commande → livrée (stock −) → facture → payée ; commande fournisseur → validée →
// approuvée → commandée → réceptionnée (stock +).
(function () {
  'use strict';
  const D = (window.FMDERP = window.FMDERP || {});
  const P = (D.pages = D.pages || {});
  const U = D.ui;
  const esc = U.esc;

  const T = {
    prop: { cle: 'propositions', titre: 'Propositions commerciales', un: 'Proposition commerciale', ico: '✎', ref: 'pr', client: true, espace: 'Espace prospection' },
    cmd: { cle: 'commandes', titre: 'Commandes clients', un: 'Commande client', ico: '▤', ref: 'co', client: true, espace: 'Espace commandes clients' },
    achat: { cle: 'achats', titre: 'Commandes fournisseurs', un: 'Commande fournisseur', ico: '⇩', ref: 'po', client: false, espace: 'Espace commandes fournisseurs' },
    fact: { cle: 'factures', titre: 'Factures clients', un: 'Facture client', ico: '€', ref: 'fa', client: true, espace: 'Espace factures clients' },
  };
  // Contrôle (21 nov. 2026, js/messagerie.js) : à la VALIDATION d'une proposition, d'une commande client ou d'une
  // commande fournisseur, widget « À contrôler » (client / fournisseur, produits, totaux, marge) + lien vers la fiche,
  // envoyé à la personne qui contrôle l'utilisateur connecté (profils.controle_par). Factures : non.
  // (À la création, le brouillon n'a pas encore de lignes : rien n'est envoyé.)
  const QUOI = { prop: 'la proposition commerciale', cmd: 'la commande client', achat: 'la commande fournisseur' };
  const apercuDoc = (db, type, o) => { const x = D.tiers(db, o.tiers) || {};
    const lignes = (o.lignes || []).map((l) => { const p = l.produit && D.produit(db, l.produit); return { ref: p ? p.ref : '', desc: l.desc || '', qte: +l.qte || 0, pu: +l.pu || 0, remise: +l.remise || 0, ht: D.arrondi(D.htLigne(l)) }; });
    return { type, titre: T[type].un, ref: o.ref, role: type === 'achat' ? 'Fournisseur' : 'Client', tiers: x.nom || '', ville: [x.cp, x.ville].filter(Boolean).join(' '),
      date: o.date || '', lignes: lignes.slice(0, 25), nb: lignes.length, ht: D.arrondi(D.ht(o)), ttc: D.arrondi(D.ttc(o)), marge: T[type].client ? D.arrondi(D.ht(o) - D.cout(db, o)) : null }; };
  const signaler = (db, type, o) => { if (QUOI[type] && window.FMDMessagerie && window.FMDMessagerie.signalerCreation) window.FMDMessagerie.signalerCreation({ quoi: QUOI[type], verbe: type === 'achat' ? 'passé' : 'validé', ref: o.ref, tiers: (D.tiers(db, o.tiers) || {}).nom, route: `${type}/fiche/${o.id}`, apercu: apercuDoc(db, type, o) }); };
  const etatDe = (type, d) => (type === 'fact' ? D.etatFacture(d) : type === 'cmd' ? D.etatCommande(d) : d.etat);
  const enRetard = (type, d) => (type === 'prop' ? d.etat === 'ouvert' && d.fin < D.auj() : type === 'cmd' ? ['validee', 'en_cours'].includes(d.etat) && d.livraison && d.livraison < D.auj()
    : type === 'achat' ? ['commande', 'ar_recu', 'recue_partiel'].includes(d.etat) && d.livraison && d.livraison < D.auj() : type === 'fact' && D.etatFacture(d) === 'retard');
  const parDate = (l) => [...l].sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : (b.cree > a.cree ? 1 : -1)));
  // Commande fournisseur passée il y a plus de 8 jours et pas encore entièrement reçue (21 nov. 2026, demande : « mettre en
  // avant dès que la commande a été faite il y a plus de 8 jours ») : en tête de liste, carte / ligne rouge, filtre.
  const JOURS_ALERTE_ACHAT = 8;
  const joursDepuis = (date) => Math.floor((new Date(D.auj() + 'T12:00:00') - new Date(String(date).slice(0, 10) + 'T12:00:00')) / 864e5);
  D.achatAncien = (d) => ['commande', 'ar_recu', 'recue_partiel'].includes(d.etat) && !!d.date && joursDepuis(d.date) > JOURS_ALERTE_ACHAT;
  const badgeAncien = (d) => (D.achatAncien(d) ? ` <span class="pastille st-ko erp-ancien" title="Commande passée le ${D.jour(d.date)}, pas encore entièrement reçue">⏱ ${joursDepuis(d.date)} j</span>` : '');
  const nomTiers = (db, id) => (D.tiers(db, id) || {}).nom || '—';
  const joursCond = (c) => (/60/.test(c) ? 60 : /45/.test(c) ? 45 : /30/.test(c) ? 30 : 0);

  ['prop', 'cmd', 'achat', 'fact'].forEach((type) => {
    P[type] = (v, a) => {
      const [vue, x, y] = a;
      let refs = false; (v.db[T[type].cle] || []).forEach((d) => { if (d.ref_libre !== undefined) { const k = type === 'achat' ? 'ref_fourn' : 'ref_client'; if (d.ref_libre && !d[k]) d[k] = d.ref_libre; delete d.ref_libre; D.toucher(d); refs = true; } }); if (refs) v.sauver();
      if (v.db[T[type].cle].filter((d) => d.etat === 'brouillon').map((d) => D.actualiserBrouillon(v.db, type, d)).some(Boolean)) v.sauver();
      if (vue === 'liste') return liste(v, type, x || 'tous');
      if (vue === 'nouveau' && type !== 'fact') return nouveau(v, type, x);
      // Commande fournisseur : pages « AR reçu », « Joindre la facture », « Ouvrir un litige » (js/erp-achat-suivi.js, 21 nov. 2026)
      if (vue === 'fiche' && type === 'achat' && ['ar', 'facture', 'litige'].includes(y) && D.pageAchatSuivi) return D.pageAchatSuivi(v, y, x);
      if (vue === 'fiche') return fiche(v, type, x, y || 'fiche');
      if (vue === 'stats') return stats(v, type);
      if (vue === 'finmois' && type === 'cmd') return finDeMois(v, x);
      return espace(v, type);
    };
  });

  // ---------------------------------------------------------------- espace (accueil du sous-module)
  function espace(v, type) {
    const db = v.db; const t = T[type]; const docs = db[t.cle];
    const per = U.bornes(U.periode(type, 'annee'), docs.map((d) => d.date.slice(0, 4))); const docsP = docs.filter((d) => per.dans(d.date));
    const parts = D.ETATS[type].map(([id, l, c]) => ({ l: D.etat(type, id)[3], v: docsP.filter((d) => etatDe(type, d) === id).length, c: U.COUL[c], r: `${type}/liste/${id}` }));
    const serieP = U.serie(docsP, per);
    const brouillons = parDate(docs.filter((d) => d.etat === 'brouillon'));
    const recents = [...docs].sort((a, b) => (b.modifie > a.modifie ? 1 : -1)).slice(0, 3);
    const total = (l) => `<tr><td colspan="3"><b>Total</b></td><td class="nb"><b>${D.euros(l.reduce((s, d) => s + D.ht(d), 0))}</b></td><td></td></tr>`;
    let droite = '';
    if (type === 'prop') { const ouv = parDate(docs.filter((d) => d.etat === 'ouvert')); droite = U.bloc('Propositions commerciales ouvertes', D.miniDocs(db, 'prop', ouv.slice(0, 15), { pied: total(ouv) }), { compte: ouv.length, droite: U.lien('prop/liste/ouvert', 'Toutes') }); }
    if (type === 'cmd') { const a = parDate(docs.filter((d) => d.etat === 'validee')), b = parDate(docs.filter((d) => d.etat === 'en_cours')), c = parDate(docs.filter((d) => d.etat === 'livree' && !d.facturee));
      droite = U.bloc('Commandes clients à traiter', D.miniDocs(db, 'cmd', a.slice(0, 8)), { compte: a.length }) + U.bloc('Commandes en cours de traitement', D.miniDocs(db, 'cmd', b.slice(0, 8)), { compte: b.length }) + U.bloc('Commandes livrées à facturer', D.miniDocs(db, 'cmd', c.slice(0, 8)), { compte: c.length, droite: U.lien('cmd/liste/afacturer', 'Toutes') }); }
    if (type === 'achat') { const a = parDate(docs.filter((d) => ['commande', 'ar_recu', 'recue_partiel'].includes(d.etat))); const f = parDate(docs.filter((d) => d.etat === 'attente_facture')); droite = U.bloc('En attente de réception', D.miniDocs(db, 'achat', a.slice(0, 10)), { compte: a.length }) + U.bloc('En attente de facture', D.miniDocs(db, 'achat', f.slice(0, 10)), { compte: f.length }); }
    if (type === 'fact') { const a = [...docs.filter((d) => !d.payee)].sort((x, y) => (x.echeance > y.echeance ? 1 : -1)); droite = U.bloc('Factures impayées (les plus anciennes)', D.miniDocs(db, 'fact', a.slice(0, 12), { echeance: true, pied: `<tr><td colspan="4"><b>Total TTC</b></td><td class="nb"><b>${D.euros(a.reduce((s, f) => s + D.ttc(f), 0))}</b></td><td></td></tr>` }), { compte: a.length }); }
    // Accès direct aux listes depuis le tableau de bord (19 nov. 2026, demande : « je veux pouvoir accéder à la liste depuis
    // chaque dashboard ») : « Voir la liste » + un raccourci par état avec son nombre (toutes périodes).
    const raccourcis = [[`${type}/liste/tous`, 'Toutes', docs.length, 'tous'], ...D.ETATS[type].map(([id, , c]) => [`${type}/liste/${id}`, D.etat(type, id)[3], docs.filter((d) => etatDe(type, d) === id).length, c]),
      ...(type === 'cmd' ? [['cmd/liste/nonfacturee', 'Non facturées', docs.filter(D.commandeNonFacturee).length, 'att'], ['cmd/liste/afacturer', 'Livrées à facturer', docs.filter((d) => d.etat === 'livree' && !d.facturee).length, 'att'], ['cmd/finmois', 'Facturation de fin de mois', docs.filter(D.commandeNonFacturee).length, 'info']] : [])];
    const acces = `<nav class="erp-acces-liste" aria-label="Accès à la liste des ${esc(t.titre.toLowerCase())}">
      <span class="erp-acces-titre">${U.ico('liste')} Liste des ${esc(t.titre.toLowerCase())}</span>
      ${raccourcis.map(([r, l, n, c]) => `<button type="button" class="erp-acces-puce st-${c}${n ? '' : ' vide'}" data-aller="${r}"><i class="erp-point"></i>${esc(l)}<b>${n}</b></button>`).join('')}</nav>`;
    return { html: `${U.titrePage(t.ico, t.espace, null, `${U.btn(`Voir la liste (${docs.length})`, '', 'btn-ligne', `data-aller="${type}/liste/tous"`)}${type === 'fact' ? '' : U.btn(`+ ${type === 'prop' ? 'Nouvelle proposition' : 'Nouvelle commande'}`, '', 'btn-metal', `data-aller="${type}/nouveau"`)}`)}
      ${acces}
      ${U.choixPeriode(type, 'annee')}
      <div class="erp-2col"><div class="erp-col">${U.bloc(`${t.titre} — ${per.lib}`, U.donut(parts, docsP.length, 'sur la période'), { ico: 'stats' })}
        ${U.bloc(`Montant HT — ${per.lib}`, U.barresP(serieP.map((x) => x.mt), per, U.court), { ico: 'stats', compte: D.eurosRond(serieP.reduce((a, x) => a + x.mt, 0)), droite: U.lien(`${type}/stats`, 'Statistiques') })}
        ${type === 'fact' ? '' : U.bloc(`${type === 'prop' ? 'Propositions' : 'Commandes'} brouillons`, D.miniDocs(db, type, brouillons, { pied: total(brouillons) }), { compte: brouillons.length })}</div>
      <div class="erp-col">${U.bloc('Les 3 dernières modifiées', D.miniDocs(db, type, recents), { droite: U.lien(`${type}/liste/tous`, 'Toutes') })}${droite}</div></div>` };
  }

  // ---------------------------------------------------------------- liste
  // Colonnes des listes de documents (tableau et cartes). Aussi utilisées par la carte de la messagerie (D.carteDoc).
  function colsDoc(db, type) {
    return [
      { t: 'Réf.', v: (d) => `<b>${esc(d.ref)}</b>${enRetard(type, d) ? ' <span class="erp-alerte" title="En retard">⚠</span>' : ''}${type === 'achat' ? badgeAncien(d) : ''}`, txt: (d) => d.ref },
      type === 'achat' ? { t: 'Réf. fournisseur', v: (d) => esc(d.ref_fourn || ''), txt: (d) => d.ref_fourn || '' } : type === 'fact' ? null : { t: 'Réf. client', v: (d) => esc(d.ref_client || ''), txt: (d) => d.ref_client || '' },
      { t: type === 'achat' ? 'Fournisseur' : 'Tiers', v: (d) => U.qui(D.tiers(db, d.tiers), '', 26), txt: (d) => nomTiers(db, d.tiers) },
      { t: 'Ville', v: (d) => esc((D.tiers(db, d.tiers) || {}).ville || ''), txt: (d) => (D.tiers(db, d.tiers) || {}).ville || '' },
      { t: type === 'prop' ? 'Date de proposition' : type === 'fact' ? 'Date de facturation' : 'Date de commande', v: (d) => D.jour(d.date), txt: (d) => D.jour(d.date) },
      { t: type === 'prop' ? 'Date fin' : type === 'fact' ? 'Échéance' : 'Livraison prévue', v: (d) => D.jour(type === 'prop' ? d.fin : type === 'fact' ? d.echeance : d.livraison) },
      { t: 'Montant HT', v: (d) => D.euros(D.ht(d)), nb: true },
      type === 'fact' ? { t: 'Montant TTC', v: (d) => D.euros(D.ttc(d)), nb: true } : null,
      { t: 'Auteur', v: (d) => esc(d.auteur), txt: (d) => d.auteur },
      type === 'cmd' ? { t: 'Facturée', v: (d) => (d.facturee ? '<span class="erp-plus">✓</span>' : '') } : null,
      type === 'achat' ? { t: 'Avancement', v: (d) => (d.etat === 'brouillon' || d.etat === 'annule' || d.etat === 'refuse' ? '' : U.avancement(D.etapeAchat(d), D.ETAPES_ACHAT)) } : null,
      { t: 'État', v: (d) => `${U.pastille(type, etatDe(type, d))}${type === 'achat' && d.payee ? ' <span class="pastille st-ok">Payée</span>' : ''}` },
    ].filter(Boolean);
  }
  // Carte « widget » d'un document, identique à celle des listes (21 nov. 2026, js/messagerie.js : widget « À contrôler »,
  // toujours à jour car dessinée avec les données actuelles du CRM).
  D.carteDoc = (db, type, d) => (T[type] && d ? U.carte(colsDoc(db, type), d, '', false, (x) => U.visuelDoc(db, x)) : '');
  function liste(v, type, etat) {
    const db = v.db; const t = T[type];
    const lignes0 = parDate(db[t.cle]);
    const anciennes = type === 'achat' ? lignes0.filter(D.achatAncien).sort((a, b) => String(a.date).localeCompare(String(b.date))) : [];
    const lignes = type === 'achat' ? [...anciennes, ...lignes0.filter((d) => !D.achatAncien(d))] : lignes0;
    const etats = D.ETATS[type].map((e) => [e[0], e[3]]);
    if (type === 'cmd') etats.push(['nonfacturee', 'Non facturées'], ['afacturer', 'Livrées à facturer']);
    if (type === 'achat') etats.unshift(['plus8', `⏱ Plus de ${JOURS_ALERTE_ACHAT} jours`]);
    const filtre = (d, e) => (e === 'plus8' ? D.achatAncien(d) : type === 'fact' ? (e === 'impayee' ? !d.payee : etatDe(type, d) === e) : e === 'nonfacturee' ? D.commandeNonFacturee(d) : e === 'afacturer' ? d.etat === 'livree' && !d.facturee : etatDe(type, d) === e);
    const cols = colsDoc(db, type);
    const nb = cols.findIndex((c) => c.t === 'Montant HT');
    const bandeau = anciennes.length ? `<div class="erp-bandeau-ancien"><b>⏱ ${anciennes.length} commande${anciennes.length > 1 ? 's' : ''} fournisseur passée${anciennes.length > 1 ? 's' : ''} il y a plus de ${JOURS_ALERTE_ACHAT} jours</b> et pas encore entièrement reçue${anciennes.length > 1 ? 's' : ''} : ${anciennes.slice(0, 4).map((d) => `<a href="#" data-aller="achat/fiche/${d.id}">${esc(d.ref)} · ${esc(nomTiers(db, d.tiers))} (${joursDepuis(d.date)} j)</a>`).join(', ')}${anciennes.length > 4 ? '…' : ''}. Relancez le fournisseur.</div>` : '';
    return { html: `${U.titrePage(t.ico, t.titre, lignes.length, `${type === 'cmd' ? U.btn('Facturation de fin de mois', '', 'btn-ligne', 'data-aller="cmd/finmois"') : ''}${type === 'fact' ? '' : U.btn('+ Nouveau', '', 'btn-metal', `data-aller="${type}/nouveau"`)}`)}${bandeau}<div data-liste></div>`,
      apres: (el) => U.liste(el.querySelector('[data-liste]'), { cols, lignes, lien: (d) => `${type}/fiche/${d.id}`, visuel: (d) => U.visuelDoc(db, d), miniature: (d) => U.miniDoc(db, d), etats, etat: etat === 'tous' ? '' : etat, filtre,
        total: (l) => `<td colspan="${nb}"><b>Total</b></td><td class="nb"><b>${D.euros(l.reduce((s, d) => s + D.ht(d), 0))}</b></td>${type === 'fact' ? `<td class="nb"><b>${D.euros(l.reduce((s, d) => s + D.ttc(d), 0))}</b></td>` : ''}<td colspan="${cols.length - nb - (type === 'fact' ? 2 : 1)}"></td>` }) };
  }

  // ---------------------------------------------------------------- facturation de fin de mois (20 nov. 2026)
  // Commandes non facturées, classées par client. On choisit UN client, on coche ses commandes (toutes par défaut) et on crée
  // UNE facture qui reprend toutes leurs lignes, commande par commande (PDF : référence + date de chaque commande, ses produits,
  // sous-total par commande, total général HT / TVA / TTC). Impossible de mélanger deux clients. Les commandes passent « Facturée ».
  function finDeMois(v, tiersId) {
    const db = v.db;
    const aFact = parDate(db.commandes.filter(D.commandeNonFacturee));
    const parClient = new Map(); aFact.forEach((c) => { if (!parClient.has(c.tiers)) parClient.set(c.tiers, []); parClient.get(c.tiers).push(c); });
    const clients = [...parClient.entries()].map(([id, l]) => ({ id, nom: nomTiers(db, id), l, ht: l.reduce((s, c) => s + D.ht(c), 0) })).sort((a, b) => a.nom.localeCompare(b.nom));
    const groupe = (c) => `<tbody class="erp-fm-g" data-fm-client="${esc(c.id)}" data-fm-nom="${esc(c.nom.toLowerCase())}">
      <tr class="erp-fm-tete"><td><input type="checkbox" data-fm-cl="${esc(c.id)}"${c.id === tiersId ? ' checked' : ''} aria-label="Toutes les commandes de ${esc(c.nom)}"></td><td colspan="5">${U.qui(D.tiers(db, c.id), '', 30)} <span class="erp-gris">· ${c.l.length} commande${c.l.length > 1 ? 's' : ''}</span></td><td class="nb"><b>${D.euros(c.ht)}</b></td><td></td></tr>
      ${c.l.map((o) => `<tr><td><input type="checkbox" name="c" value="${o.id}" data-fm-de="${esc(c.id)}"${c.id === tiersId ? ' checked' : ''} aria-label="Inclure ${esc(o.ref)}"></td><td>${U.lien(`cmd/fiche/${o.id}`, `<b>${esc(o.ref)}</b>`)}</td><td>${D.jour(o.date)}</td><td>${esc(o.ref_client || '')}</td><td>${U.pastille('cmd', etatDe('cmd', o))}</td><td class="nb">${o.lignes.length}</td><td class="nb">${D.euros(D.ht(o))}</td><td class="nb">${D.euros(D.ttc(o))}</td></tr>`).join('')}</tbody>`;
    const table = clients.length ? `<form id="erp-fm"><div class="erp-fm-outils"><input type="search" class="erp-recherche" placeholder="Filtrer par client…" data-fm-q aria-label="Filtrer par client">
        <button type="button" class="btn btn-ligne petit" data-fm-tous>Tout cocher</button><button type="button" class="btn btn-ligne petit" data-fm-aucun>Tout décocher</button></div>
      <table class="erp-table erp-fm"><thead><tr><th></th><th>Commande</th><th>Date</th><th>Réf. client</th><th>État</th><th class="nb">Produits</th><th class="nb">Montant HT</th><th class="nb">TTC</th></tr></thead>
      ${clients.map(groupe).join('')}<tfoot><tr><td colspan="6"><b>Sélection</b> <span class="erp-gris" data-fm-nb></span></td><td class="nb"><b data-fm-ht></b></td><td class="nb"><b data-fm-ttc></b></td></tr></tfoot></table>
      <div class="erp-actions-bas">${U.btn('Créer la facture', 'facture', 'btn-metal', 'type="submit" data-fm-creer')}</div></form>`
      : '<p class="erp-gris">Aucune commande à facturer : toutes les commandes validées, en cours ou livrées ont déjà leur facture.</p>';
    return { html: `${U.titrePage('facture', 'Facturation de fin de mois', aFact.length, U.btn('Liste des commandes non facturées', '', 'btn-ligne', 'data-aller="cmd/liste/nonfacturee"'))}
      <p class="erp-gris">Toutes les commandes non facturées, rangées par client. Cochez un client (toutes ses commandes) ou seulement certaines commandes, pour un ou plusieurs clients : FMD crée <b>une seule facture par client</b>, avec le détail de chaque commande (PDF). Les commandes passent ensuite « Facturée ».</p>
      ${U.bloc('Commandes non facturées', table, { compte: aFact.length, ico: 'commande' })}`,
      apres: (el) => { const f = el.querySelector('#erp-fm'); if (!f) return;
        const coches = () => [...f.querySelectorAll('input[name="c"]:checked')].map((i) => aFact.find((c) => c.id === i.value)).filter(Boolean);
        const maj = () => { const l = coches(); const n = new Set(l.map((c) => c.tiers)).size;
          f.querySelectorAll('[data-fm-cl]').forEach((cb) => { const b = [...f.querySelectorAll(`input[data-fm-de="${CSS.escape(cb.dataset.fmCl)}"]`)]; const k = b.filter((x) => x.checked).length; cb.checked = k === b.length; cb.indeterminate = k > 0 && k < b.length; cb.closest('tbody').classList.toggle('actif', k > 0); });
          f.querySelector('[data-fm-nb]').textContent = l.length ? `(${l.length} commande${l.length > 1 ? 's' : ''}, ${n} client${n > 1 ? 's' : ''})` : '(rien de coché)';
          f.querySelector('[data-fm-ht]').textContent = D.euros(l.reduce((s, c) => s + D.ht(c), 0)); f.querySelector('[data-fm-ttc]').textContent = D.euros(l.reduce((s, c) => s + D.ttc(c), 0));
          const bt = f.querySelector('[data-fm-creer]'); bt.disabled = !l.length; bt.lastChild.textContent = n > 1 ? ` Créer ${n} factures (une par client)` : ' Créer la facture'; };
        f.addEventListener('change', (e) => { const cl = e.target.closest('[data-fm-cl]'); if (cl) f.querySelectorAll(`input[data-fm-de="${CSS.escape(cl.dataset.fmCl)}"]`).forEach((i) => { i.checked = cl.checked; }); maj(); });
        const visibles = () => [...f.querySelectorAll('tbody.erp-fm-g')].filter((g) => !g.hidden);
        f.querySelector('[data-fm-tous]').addEventListener('click', () => { visibles().forEach((g) => g.querySelectorAll('input[type=checkbox]').forEach((i) => { i.checked = true; })); maj(); });
        f.querySelector('[data-fm-aucun]').addEventListener('click', () => { f.querySelectorAll('input[type=checkbox]').forEach((i) => { i.checked = false; }); maj(); });
        f.querySelector('[data-fm-q]').addEventListener('input', (e) => { const q = e.target.value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
          f.querySelectorAll('tbody.erp-fm-g').forEach((g) => { g.hidden = !!q && !g.dataset.fmNom.normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(q); }); });
        maj(); const g0 = tiersId && f.querySelector(`tbody[data-fm-client="${CSS.escape(tiersId)}"]`); if (g0) g0.scrollIntoView({ block: 'center' });
        f.addEventListener('submit', (e) => { e.preventDefault(); const l = coches(); if (!l.length) return;
          const parT = new Map(); l.forEach((c) => { if (!parT.has(c.tiers)) parT.set(c.tiers, []); parT.get(c.tiers).push(c); });
          const faites = [...parT.values()].map((cs) => D.factureGroupee(db, cs)).filter(Boolean);
          if (!faites.length) { v.fenetre('Impossible', '<p>Les commandes choisies ont déjà leur facture.</p>', '<button type="button" class="btn btn-metal" data-fermer>Compris</button>'); return; }
          v.sauver(); v.notifier(`${faites.length > 1 ? `${faites.length} factures créées` : `Facture ${faites[0].ref} créée`} pour ${l.length} commande(s) : elles sont classées « Facturée ».`);
          if (faites.length === 1) { v.aller(`fact/fiche/${faites[0].id}`); setTimeout(() => D.ouvrirPdf(v, 'fact', faites[0]), 300); return; }
          v.aller('fact/liste/tous'); faites.reduce((p, fa) => p.then(() => D.ouvrirPdf(v, 'fact', fa)).catch(() => {}), Promise.resolve()); }); } };
  }
  // Facture groupée : toutes les lignes des commandes (l.cmd = commande d'origine) + la liste des commandes (pour le PDF)
  D.factureGroupee = (db, cmds) => {
    if (!cmds.length || cmds.some((c) => c.tiers !== cmds[0].tiers || !D.commandeNonFacturee(c))) return null;
    const l = [...cmds].sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : String(a.ref).localeCompare(String(b.ref))));
    const tiers = D.tiers(db, l[0].tiers) || {}; const date = D.auj();
    const f = { id: D.id('fa'), ref: D.prochaineRef(db, 'fa', date), tiers: l[0].tiers, date, echeance: D.ajout(date, joursCond(tiers.cond || l[0].cond || '')), cond: tiers.cond || l[0].cond, mode: tiers.mode || l[0].mode,
      lignes: l.flatMap((c) => c.lignes.map((x) => ({ ...x, cmd: c.id }))), commandes: l.map((c) => ({ id: c.id, ref: c.ref, date: c.date, ref_client: c.ref_client || '' })),
      payee: false, paiement: '', liens: l.map((c) => ({ type: 'cmd', id: c.id })), note_pub: '', note_priv: '', auteur: D.MOI, cree: D.maintenant() };
    if (D.figerPrix) D.figerPrix(db, f); // type de prix des lignes (commissions)
    D.toucher(f); db.factures.push(f); D.devenirClient(db, f.tiers);
    l.forEach((c) => { c.facturee = true; (c.liens = c.liens || []).push({ type: 'fact', id: f.id }); D.toucher(c);
      (c.liens || []).filter((x) => x.type === 'prop').forEach((x) => { const p = db.propositions.find((o) => o.id === x.id); if (p) { p.etat = 'facturee'; (p.liens = p.liens || []).push({ type: 'fact', id: f.id }); D.toucher(p); } });
      D.evt(db, `Commande ${c.ref} classée Facturée (facture groupée ${f.ref})`, { tiers: c.tiers, objet: { type: 'cmd', id: c.id } }); });
    D.evt(db, `Facture ${f.ref} (fin de mois, ${l.length} commandes) validée`, { tiers: f.tiers, objet: { type: 'fact', id: f.id } });
    return f;
  };

  // ---------------------------------------------------------------- page 1 : nouveau document (en-tête)
  function champsEnTete(type, d, db) {
    const t = T[type];
    const tiersOpts = db.tiers.filter((x) => (t.client ? x.client || x.prospect : x.fournisseur)).sort((a, b) => a.nom.localeCompare(b.nom)).map((x) => [x.id, `${x.nom}${x.prospect ? ' (prospect)' : ''}`]);
    // Une seule référence tapée : « Réf. client » (« Réf. fournisseur » pour les achats), texte libre, la même peut servir sur
    // plusieurs documents (20 nov. 2026) ; le n° automatique (CO…, PR…) reste le numéro du document.
    return `${U.ligne(t.client ? 'Client' : 'Fournisseur', U.sel('tiers', tiersOpts, d.tiers, { req: true, vide: 'Sélectionner un tiers' }), { req: true })}<div data-carte-tiers>${carteTiers(db, d.tiers)}</div>
      ${type === 'achat' ? U.ligne('Réf. fournisseur', U.inp('ref_fourn', d.ref_fourn)) : U.ligne('Réf. client', U.inp('ref_client', d.ref_client, { ph: 'Ex. : chantier, n° de bon du client…' }))}
      <div class="erp-2f">${U.ligne(type === 'prop' ? 'Date de proposition' : 'Date', U.inp('date', d.date, { type: 'date', req: true }), { req: true })}
      ${type === 'prop' ? U.ligne('Durée de validité (jours)', U.inp('validite', d.validite, { type: 'number', min: 1 })) : U.ligne('Date prévue de livraison', U.inp('livraison', d.livraison, { type: 'date' }))}</div>
      <div class="erp-2f">${U.ligne('Conditions de règlement', U.sel('cond', D.CONDITIONS, d.cond, { vide: '—' }))}${U.ligne('Mode de règlement', U.sel('mode', D.MODES, d.mode, { vide: '—' }))}</div>
      ${type === 'achat' ? '' : `<div class="erp-2f">${U.ligne('Méthode d’expédition', U.sel('expedition', D.EXPEDITIONS, d.expedition, { vide: '—' }))}${U.ligne('Origine', U.sel('origine', D.ORIGINES, d.origine, { vide: '—' }))}</div>`}
      ${type === 'prop' ? `<div class="erp-2f">${U.ligne('Délai de livraison (après commande)', U.sel('delai', ['', 'Immédiat', '1 semaine', '2 semaines', '3 semaines', '1 mois'], d.delai))}${U.ligne('Date de livraison', U.inp('livraison', d.livraison, { type: 'date' }))}</div>` : ''}
      ${U.ligne('Note (publique)', U.area('note_pub', d.note_pub, 2), { large: true })}${U.ligne('Note (privée)', U.area('note_priv', d.note_priv, 2), { large: true })}`;
  }
  const carteTiers = (db, id) => { const x = D.tiers(db, id); if (!x) return `<div class="erp-carte-tiers vide">${U.ico('tiers')}<span>Choisissez un tiers : son logo et ses conditions s’affichent ici.</span></div>`;
    return `<div class="erp-carte-tiers">${U.avatar(x, 52)}<div><b>${esc(x.nom)}</b><span>${U.nature(x)} ${esc([x.cp, x.ville].filter(Boolean).join(' '))}</span><span>${U.ico('tag')} ${x.remise ? `Remise client ${x.remise} %` : 'Prix net'} &nbsp; ${U.ico('euro')} ${esc(x.cond || '—')} · ${esc(x.mode || '—')}</span></div></div>`; };
  const lierConditions = (f, db) => f.tiers.addEventListener('change', () => { const c = f.querySelector('[data-carte-tiers]'); if (c) c.innerHTML = carteTiers(db, f.tiers.value); const x = D.tiers(db, f.tiers.value); if (!x) return; if (f.cond) f.cond.value = (f.ref_fourn ? x.cond_fourn || x.cond : x.cond) || ''; if (f.mode) f.mode.value = x.mode || ''; });
  function nouveau(v, type, tiersId) {
    const db = v.db; const t = T[type]; const x = D.tiers(db, tiersId);
    const d = { tiers: tiersId || '', ref_client: '', ref_fourn: '', date: D.auj(), validite: 15, livraison: '', cond: x ? x.cond : '', mode: x ? x.mode : '', expedition: '', origine: '', delai: '', note_pub: '', note_priv: '' };
    const corps = `${U.etapes(1, 2, ['En-tête', 'Lignes et validation'])}${champsEnTete(type, d, db)}`;
    return { html: `${U.titrePage(t.ico, `${type === 'prop' ? 'Nouvelle proposition commerciale' : type === 'cmd' ? 'Créer une commande' : 'Nouvelle commande d’achat'} — page 1 sur 2`)}${U.form('erp-f', corps, `${U.btn('Créer brouillon ›', 'ok', 'btn-metal', 'type="submit"')}${U.btn('Annuler', '', 'btn-ligne', `data-aller="${x ? `tiers/fiche/${x.id}` : type}"`)}`)}`,
      apres: (el) => { const f = el.querySelector('#erp-f'); lierConditions(f, db);
        f.addEventListener('submit', (e) => { e.preventDefault(); const c = U.lire(f);
          const o = { id: D.id(type), ref: D.refBrouillon(db, type), tiers: c.tiers, ref_client: c.ref_client || '', ref_fourn: c.ref_fourn || '', date: c.date, cond: c.cond, mode: c.mode, expedition: c.expedition || '', origine: c.origine || '', delai: c.delai || '',
            livraison: c.livraison || '', note_pub: c.note_pub, note_priv: c.note_priv, etat: 'brouillon', lignes: [], liens: [], auteur: D.MOI, cree: D.maintenant() };
          if (type === 'prop') { o.validite = +c.validite || 15; o.fin = D.ajout(o.date, o.validite); }
          if (type === 'cmd') o.facturee = false;
          D.toucher(o); db[t.cle].push(o); D.evt(db, `${t.un} ${o.ref} créée (brouillon)`, { tiers: o.tiers, objet: { type, id: o.id } }); v.sauver(); v.aller(`${type}/fiche/${o.id}`); }); } };
  }

  // ---------------------------------------------------------------- page 2 : fiche du document
  function fiche(v, type, id, onglet) {
    const db = v.db; const t = T[type]; const d = db[t.cle].find((x) => x.id === id);
    if (!d) return { html: `<div class="erp-vide-page"><h1>Document introuvable</h1>${U.lien(`${type}/liste/tous`, 'Retour à la liste')}</div>` };
    const tiers = D.tiers(db, d.tiers) || { nom: '—' };
    const evts = db.evenements.filter((e) => e.objet && e.objet.type === type && e.objet.id === id);
    const brouillon = d.etat === 'brouillon';
    // TVA imposée (20 nov. 2026) : vente 20 %, achat selon le pays du fournisseur. Factures émises : jamais modifiées.
    if (type !== 'fact' && !d.importe && (d.lignes || []).some((l) => +l.tva !== D.tauxDoc(db, type, d))) { d.lignes.forEach((l) => { l.tva = D.tauxDoc(db, type, d); }); D.toucher(d); v.sauver(); }
    const etat = etatDe(type, d);
    const vois = U.voisins(parDate(db[t.cle]), id, (o) => `${type}/fiche/${o.id}/${onglet}`);
    const tete = U.fiche({ ico: U.avatar(tiers, 64), logo: !!tiers.logo, badge: t.ico, titre: esc(d.ref), sous: `${onglet === 'fiche' ? `<p><label class="erp-inline-ref">${type === 'achat' ? 'Réf. fournisseur' : 'Réf. client'} : <input class="erp-inline" data-ref-doc value="${esc((type === 'achat' ? d.ref_fourn : d.ref_client) || '')}" placeholder="— (cliquer pour écrire)" aria-label="${type === 'achat' ? 'Référence fournisseur' : 'Référence client'}" size="${Math.max(14, String((type === 'achat' ? d.ref_fourn : d.ref_client) || '').length + 2)}"></label></p>` : `<p>${type === 'achat' ? 'Réf. fournisseur' : 'Réf. client'} : ${esc((type === 'achat' ? d.ref_fourn : d.ref_client) || '—')}</p>`}<p>${U.lienTiers(db, d.tiers)}</p>`,
      pastilles: `${U.pastille(type, etat)}${brouillon ? ' <span class="erp-gris">(à valider)</span>' : ''}${d.importe ? ' <span class="pastille st-neutre" title="Importé depuis l’historique : lecture seule">Importé · lecture seule</span>' : ''}`, retour: `${type}/liste/tous`, ...vois,
      onglets: [['fiche', t.un], ['notes', 'Notes', d.note_pub || d.note_priv ? 1 : 0], ['evenements', 'Événements', evts.length]], actif: onglet, base: `${type}/fiche/${id}` });
    const evtD = (titre, o = {}) => D.evt(db, titre, { tiers: d.tiers, objet: { type, id }, ...o });
    if (onglet === 'notes') {
      return { html: tete + `<form class="erp-carte erp-notes" id="erp-notes"><label>Note (publique, imprimée sur le document)<textarea name="note_pub" rows="5">${esc(d.note_pub)}</textarea></label><label>Note (privée)<textarea name="note_priv" rows="6">${esc(d.note_priv)}</textarea></label><div>${U.btn('Enregistrer', 'ok', 'btn-metal', 'type="submit"')}</div></form>`,
        apres: (el) => el.querySelector('#erp-notes').addEventListener('submit', (e) => { e.preventDefault(); const f = U.lire(e.target); d.note_pub = f.note_pub; d.note_priv = f.note_priv; D.toucher(d); v.sauver(); v.notifier('Notes enregistrées.'); v.rendre(); }) };
    }
    if (onglet === 'evenements') return { html: tete + U.bloc('Événements sur ce document', U.chronologie(evts), { compte: evts.length }) };

    const ht = D.ht(d), tva = D.tva(d), ttc = D.ttc(d), cout = D.cout(db, d);
    const remiseTxt = tiers.remise ? `Ce client a une remise relative de ${tiers.remise} % (appliquée automatiquement aux nouvelles lignes)` : 'Ce client n’a pas de remise relative par défaut';
    const infos = U.infos([
      [t.client ? 'Client' : 'Fournisseur', U.lienTiers(db, d.tiers)],
      t.client ? ['Remises', `<span class="erp-gris">${esc(remiseTxt)}</span>`] : null,

      [type === 'prop' ? 'Date de proposition' : type === 'fact' ? 'Date de facturation' : 'Date', D.jour(d.date)],
      type === 'prop' ? ['Date de fin de validité', `${D.jour(d.fin)}${enRetard(type, d) ? ' <span class="erp-alerte">⚠ expirée</span>' : ''}`] : null,
      type === 'fact' && !d.avoir ? ['Date limite de règlement', `${D.jour(d.echeance)}${enRetard(type, d) ? ' <span class="erp-alerte">⚠ en retard</span>' : ''}`] : null,
      type === 'cmd' || type === 'achat' || type === 'prop' ? ['Date prévue de livraison', D.jour(d.livraison)] : null,
      type === 'prop' ? ['Délai de livraison', esc(d.delai || '—')] : null,
      ['Conditions de règlement', esc(d.cond || '—')], ['Mode de règlement', esc(d.mode || '—')],
      type === 'prop' || type === 'cmd' ? ['Méthode d’expédition', esc(d.expedition || '—')] : null, type === 'prop' || type === 'cmd' ? ['Origine', esc(d.origine || '—')] : null,
      type === 'fact' && d.avoir && d.avoir_nature !== 'import' ? ['Avoir', `${d.avoir_nature === 'retour' ? 'Retour de marchandise (remise en stock)' : 'Avoir sur prix (pas de remise en stock)'} · facture ${U.lien(`fact/fiche/${d.origine}`, `<b>${esc(d.origine_ref || '')}</b>`)}${d.motif ? ` · ${esc(d.motif)}` : ''}`] : null,
      type === 'fact' && d.payee ? [d.avoir ? 'Remboursé / déduit le' : 'Payée le', D.jour(d.paiement)] : null,
      d.importe ? ['Import', `Historique importé (${esc(d.import_fichier || 'fichier')}) · lecture seule, compté dans le CA et la marge`] : null,
      type === 'achat' && d.ar_num ? ['N° d’AR', esc(d.ar_num)] : null,
      type === 'achat' && d.facture_num ? ['Facture du fournisseur', `${esc(d.facture_num)} · ${D.jour(d.facture_date)} · ${D.euros(+d.facture_ttc || 0)} TTC${d.payee ? ' · payée' : ' · <b class="erp-moins">non payée</b>'}`] : null,
      (type === 'prop' || type === 'cmd') && D.ligneEncoursDoc ? ['Encours du client', D.ligneEncoursDoc(db, type, d)] : null,
      type === 'achat' ? ['Encours du fournisseur', (() => { const max = +tiers.encours_fourn_max || 0; const u = D.encoursFourn(db, d.tiers); return `${D.euros(u)} de factures non payées${max ? ` · reste <b class="${max - u < 0 ? 'erp-moins' : ''}">${D.euros(max - u)}</b> sur ${D.euros(max)}` : ''}`; })()] : null,
      [type === 'achat' ? 'Auteur/Demandeur' : 'Auteur', esc(d.auteur)],
    ]);
    const marges = t.client ? `<table class="registre erp-table erp-marges"><thead><tr><th>Marges</th><th class="nb">Prix de vente</th><th class="nb">Prix de revient</th><th class="nb">Marge</th><th class="nb">Coef. de marge</th></tr></thead><tbody>
      <tr><td>Marge totale</td><td class="nb">${D.euros(ht)}</td><td class="nb">${D.euros(cout)}</td><td class="nb"><b class="${ht - cout < 0 ? 'erp-moins' : ''}">${D.euros(ht - cout)}</b>${ht ? ` <span class="erp-gris">(${Math.round(((ht - cout) / ht) * 100)} %)</span>` : ''}</td><td class="nb"><b>${D.coefTxt(ht, cout).replace('coef. ', '') || '—'}</b></td></tr></tbody></table>` : '';
    // Pastille « condition client » de chaque ligne : prix donné au client (net, remise comprise) et prix de base à côté.
    const pastilleCond = (l, p) => {
      const c = D.conditionClient(db, d.tiers, p.id); if (!c) return '';
      const net = D.arrondi((+l.pu || 0) * (1 - (+l.remise || 0) / 100)); const base = c.base;
      const ec = base ? Math.round(((net - base) / base) * 100) : 0; const ecart = ec ? ` <i>${ec > 0 ? '+' : '−'}${Math.abs(ec)} %</i>` : '';
      const modifie = l.auto === 'prix modifié' || (Math.abs((+l.pu || 0) - c.pu) >= 0.005 || (+l.remise || 0) !== c.remise);
      const nom = modifie ? 'Prix modifié' : c.type === 'client' ? 'Condition client' : c.type === 'promo' ? 'Prix promo' : c.type === 'remise' ? `Remise client ${D.nombre(c.remise)} %` : '';
      if (!nom) return ` <span class="erp-cond aucune" title="Pas de condition pour ce client : prix de base">Prix de base ${D.euros(base)}</span>`;
      const titre = modifie ? `Prix changé à la main sur cette ligne. Condition du client : ${D.euros(c.net)} HT.` : c.type === 'client' ? `Prix négocié pour ce client${c.depuis ? ' depuis le ' + D.jour(c.depuis) : ''}${c.remise ? `, plus sa remise de ${D.nombre(c.remise)} %` : ''}.` : c.type === 'niveau' ? `Niveau de prix ${c.niveau} du client${c.remise ? `, plus sa remise de ${D.nombre(c.remise)} %` : ''}.` : 'Remise du client sur le prix de base.';
      return ` <span class="erp-cond ${modifie ? 'modifie' : c.type}" title="${esc(titre)}"><b>${esc(nom)}</b> ${D.euros(net)}<s>${D.euros(base)}</s>${ecart}</span>`;
    };
    // Commande fournisseur (21 nov. 2026) : seulement les références de CE fournisseur (prix d'achat chez lui sur la fiche produit).
    const duFourn = (p) => (p.fournisseurs || []).some((x) => x.tiers === d.tiers && +x.pu > 0);
    const proposable = (p) => (t.client ? p.en_vente : p.en_achat !== false && duFourn(p));
    // libellé d'une option de la liste des produits (référence — nom — prix pour ce tiers — stock)
    const libOpt = (p) => `${p.ref} — ${p.libelle || [p.modele, p.couleur, p.taille].filter(Boolean).join(' ')} — ${D.euros(t.client ? D.prixPour(db, d.tiers, p.id).pu : D.prixAchat(db, d.tiers, p.id).pu)} HT — Stock : ${D.nombre(p.stock)}`;
    const lignesHtml = d.lignes.length ? `<table class="registre erp-table erp-lignes"><thead><tr><th>Description</th>${type === 'achat' ? '<th>Réf. fournisseur</th>' : ''}<th class="nb">TVA</th>${t.client ? '<th class="nb">P. achat</th>' : ''}<th class="nb">P.U. HT</th><th class="nb">Qté</th><th class="nb">Réduc.</th><th class="nb">Total HT</th>${type === 'achat' ? '<th class="nb">Reçu</th>' : ''}${t.client ? '<th class="nb">Marge</th>' : ''}${brouillon ? '<th></th>' : ''}</tr></thead><tbody>
      ${d.lignes.map((l, i) => { const p = l.produit && D.produit(db, l.produit); const pa = D.paLigne(db, l); const marge = p || l.pa != null ? D.htLigne(l) - pa * l.qte : null;
        return `<tr><td>${p ? `${U.lien(`produits/fiche/${p.id}`, `<b>${esc(p.ref)}</b>`)} ` : ''}${esc(l.desc)}${p && t.client ? pastilleCond(l, p) + (D.pastilleTypePrix ? ' ' + D.pastilleTypePrix(db, l, d.date) : '') : l.auto ? ` <span class="erp-gris erp-petit">· ${esc(l.auto)}</span>` : ''}${p && t.client && D.pastilleVirtuel ? `<div class="erp-dispo" title="Stock virtuel : physique (${D.nombre(p.stock)}) − réservé (devis et commandes en cours, celui-ci compris) + attendu">Stock physique ${D.nombre(p.stock)} · dispo ${D.pastilleVirtuel(D.stockVirtuel(db, p), p.alerte || 0)}</div>` : ''}</td>${type === 'achat' ? `<td>${esc(l.ref_fourn || '')}</td>` : ''}${brouillon ? `<td class="nb"><span title="${esc(type === 'achat' ? D.raisonTvaAchat(tiers) : 'TVA à la vente : toujours 20 %')}">${D.nombre(l.tva)} %</span></td>${t.client ? `<td class="nb"><input class="erp-inline${l.pa == null ? ' erp-auto' : ''}" type="number" step="0.01" min="0" data-l-champ="pa" data-i="${i}" value="${pa}" aria-label="Prix d’achat HT" title="${l.pa == null ? 'Prix de revient du produit (PMP, sinon meilleur prix d’achat), mis à jour automatiquement. Écrivez un autre prix pour cette ligne.' : 'Prix d’achat écrit pour cette ligne (videz le champ pour reprendre celui du produit).'}"> €</td>` : ''}<td class="nb"><input class="erp-inline" type="number" step="0.01" min="0" data-l-champ="pu" data-i="${i}" value="${l.pu}" aria-label="Prix unitaire HT"> €</td><td class="nb"><input class="erp-inline" type="number" step="1" min="1" data-l-champ="qte" data-i="${i}" value="${l.qte}" aria-label="Quantité"></td><td class="nb"><input class="erp-inline" type="number" step="0.5" min="0" max="100" data-l-champ="remise" data-i="${i}" value="${l.remise || 0}" aria-label="Réduction en %"> %</td>`
          : `<td class="nb">${D.nombre(l.tva)} %</td>${t.client ? `<td class="nb erp-gris">${D.euros(pa)}</td>` : ''}<td class="nb">${D.euros(l.pu)}</td><td class="nb">${D.nombre(l.qte)}</td><td class="nb">${l.remise ? D.nombre(l.remise) + ' %' : ''}</td>`}<td class="nb"><b>${D.euros(D.htLigne(l))}</b></td>
        ${type === 'achat' ? `<td class="nb">${D.nombre(l.recu || 0)} / ${D.nombre(l.qte)}</td>` : ''}${t.client ? `<td class="nb ${marge != null && marge < 0 ? 'erp-moins' : ''}">${marge == null ? '' : `${D.euros(marge)}${D.coefTxt(D.htLigne(l), pa * l.qte) ? `<br><span class="erp-gris erp-petit">${D.coefTxt(D.htLigne(l), pa * l.qte)}</span>` : ''}`}</td>` : ''}${brouillon ? `<td><button type="button" class="btn-icone" data-suppr-ligne="${i}" title="Supprimer la ligne">✕</button></td>` : ''}</tr>`; }).join('')}</tbody></table>` : U.vide('Aucune ligne pour l’instant : ajoutez des produits ci-dessous.');
    const ajout = brouillon ? `<form class="erp-ajout" id="erp-ajout">
        <div class="erp-ajout-choix"><label class="erp-coche"><input type="radio" name="mode_l" value="produit" checked> Produit prédéfini</label><label class="erp-coche"><input type="radio" name="mode_l" value="libre"> Ligne libre</label></div>
        <div data-l-produit><input type="search" placeholder="Rechercher un produit (réf., libellé, fournisseur, code-barres)…" data-cherche-p aria-label="Rechercher un produit">
          <select name="produit" size="6" data-sel-p aria-label="Produit">${db.produits.filter(proposable).slice(0, 150).map((p) => `<option value="${p.id}">${esc(libOpt(p))}</option>`).join('')}</select>${!t.client && !db.produits.some(proposable) ? `<p class="erp-moins">Aucune référence chez ${esc(tiers.nom || 'ce fournisseur')} : seuls les produits qui ont un prix d’achat chez ce fournisseur sont proposés (fiche produit › onglet « Prix d’achat »).</p>` : ''}</div>
        <div data-l-libre hidden><textarea name="desc" rows="2" placeholder="Description de la ligne libre (service, transport…)" aria-label="Description"></textarea></div>
        <div class="erp-ajout-nb"><label title="${esc(type === 'achat' ? D.raisonTvaAchat(tiers) : 'TVA à la vente : toujours 20 %')}">TVA<input name="tva" value="${D.nombre(D.tauxDoc(db, type, d))} %" readonly tabindex="-1" class="erp-tva-fixe"></label>
          ${t.client ? `<label title="Prix d’achat HT de la ligne : prix de revient du produit, modifiable avant d’ajouter">P. achat HT<input name="pa" type="number" step="0.01" min="0" placeholder="—"></label>` : ''}<label>P.U. HT<input name="pu" type="number" step="0.01" min="0" required></label><label>Qté<input name="qte" type="number" step="1" min="1" value="1" required></label>
          <label>Réduc. %<input name="remise" type="number" step="0.5" min="0" max="100" value="0"></label><button type="submit" class="btn petit btn-metal">Ajouter</button></div>
        <p class="erp-prix-info" data-info></p></form>` : '';
    const liens = (d.liens || []).filter((x) => T[x.type]).map((x) => ({ ...x, doc: (db[T[x.type].cle] || []).find((o) => o.id === x.id) })).filter((x) => x.doc);
    const A = [];
    const B = (txt, act, cls = 'btn-metal') => A.push(U.btn(txt, act, cls));
    const demandeEnc = (type === 'prop' || type === 'cmd') && brouillon && D.accordEnAttente && D.accordEnAttente(d);
    if (demandeEnc && D.estValideurEncours && D.estValideurEncours()) { B('Accorder et valider', 'accorder_enc'); B('Refuser', 'refuser_enc', 'btn-ligne erp-danger'); }
    if (brouillon) { B(type === 'achat' ? 'Passer la commande' : 'Valider', 'valider'); B('Modifier l’en-tête', 'entete', 'btn-ligne'); }
    if (type === 'prop') { if (d.etat === 'ouvert') { B('Signée', 'signer'); B('Non signée', 'refuser', 'btn-ligne'); B('Repasser en brouillon', 'modifier', 'btn-ligne'); }
      if (d.etat === 'signee') { if (!liens.some((x) => x.type === 'cmd')) B('Créer la commande', 'commande'); B('Classer facturée', 'facturee', 'btn-ligne'); }
      if (d.etat === 'non_signee') B('Rouvrir', 'rouvrir', 'btn-ligne'); }
    if (type === 'cmd') { if (d.etat === 'validee') { B('Passer en préparation', 'encours'); B('Repasser en brouillon', 'modifier', 'btn-ligne'); }
      if (d.etat === 'validee' || d.etat === 'en_cours') { B('Classer livrée', 'livrer'); B('Annuler la commande', 'annuler', 'btn-ligne erp-danger'); }
      if (!brouillon && d.etat !== 'annulee' && !d.facturee) B('Créer la facture', 'facturer'); }
    // 21 nov. 2026 : AR joint obligatoire avant la réception ; facture jointe obligatoire pour clôturer ; litige sur le reste.
    if (type === 'achat') { if (d.etat === 'commande') { B('AR reçu (joindre l’AR)', 'ar'); A.push(U.btn('Réceptionner les produits', 'recevoir', 'btn-ligne', 'disabled title="Joignez d’abord l’AR du fournisseur (bouton « AR reçu »)"')); }
      if (['ar_recu', 'recue_partiel'].includes(d.etat)) B('Réceptionner les produits', 'recevoir');
      if (['ar_recu', 'recue_partiel'].includes(d.etat) && !(D.litigeOuvert && D.litigeOuvert(d)) && d.lignes.some((l) => (+l.recu || 0) > 0) && d.lignes.some((l) => (+l.recu || 0) < (+l.qte || 0))) B('Ouvrir un litige', 'litige', 'btn-ligne erp-danger');
      if (d.etat === 'recue') B('Passer en attente de facture', 'attente_f', 'btn-ligne');
      if (D.peutJoindreFacture && D.peutJoindreFacture(d)) B('Joindre la facture (clôturer)', 'facturer_a');
      if (d.etat === 'facturee' && !d.payee) B('Facture payée', 'payer_a');
      if (d.etat === 'commande') B('Repasser en brouillon', 'modifier', 'btn-ligne');
      if (['commande', 'ar_recu'].includes(d.etat)) B('Annuler', 'annuler_a', 'btn-ligne erp-danger'); }
    if (type === 'fact' && !d.payee) B(d.avoir ? 'Classer remboursé / déduit' : 'Classer payée', 'payer');
    if (type === 'fact' && !d.avoir) B('Créer un avoir', 'avoir', 'btn-ligne');
    if (!brouillon && d.lignes.length) B("Envoyer par e-mail", "email");
    if (d.lignes.length) B('PDF / Imprimer', 'pdf', 'btn-ligne');
    if (type !== 'fact') B('Cloner', 'cloner', 'btn-ligne');
    // 24 nov. 2026 : les commandes (clients et fournisseurs) se suppriment aussi une fois validées
    if (brouillon || type === 'cmd' || type === 'achat') B('Supprimer', 'supprimer', 'btn-ligne erp-danger');
    // Historique importé (erp-historique.js) : spectateur, seulement le PDF
    if (d.importe) { A.length = 0; if (d.lignes.length) B('PDF / Imprimer', 'pdf', 'btn-ligne'); }

    const html = `${tete}${brouillon && d.lignes.length === 0 ? U.etapes(2, 2, ['En-tête', 'Lignes et validation']) : ''}${type === 'achat' && !brouillon && !['annule', 'refuse'].includes(d.etat) ? `<div class="erp-carte erp-avance-carte">${U.avancement(D.etapeAchat(d), D.ETAPES_ACHAT)}${d.payee ? '<p class="erp-plus">✓ Facture payée</p>' : ''}${D.achatAncien(d) ? `<p class="erp-moins"><b>⏱ Commande passée il y a ${joursDepuis(d.date)} jours</b> (le ${D.jour(d.date)}) et pas encore entièrement reçue : relancez le fournisseur.</p>` : ''}</div>` : ''}
      <div class="erp-carte erp-2c erp-doc-tete"><div>${infos}</div><div>${U.infos([['Montant HT', `<b>${D.euros(ht)}</b>`], ['Montant TVA', D.euros(tva)], ['Montant TTC', `<b class="erp-ttc">${D.euros(ttc)}</b>`]])}${marges}</div></div>
      ${U.bloc('Lignes', lignesHtml + ajout, { compte: d.lignes.length })}
      ${(type === 'prop' || type === 'cmd') && D.etiquetteAccordEncours && (D.etiquetteAccordEncours(d) || D.etiquetteAccordRemise(d)) ? `<p class="erp-accord-enc">${D.etiquetteAccordRemise(d)} ${D.etiquetteAccordEncours(d)}</p>` : ''}
      ${U.boutons(A)}
      ${type === 'achat' && D.blocPiecesAchat ? D.blocPiecesAchat(v, d) : ''}
      <div class="erp-2col"><div class="erp-col">${U.bloc('Objets liés', U.table([['Type', (x) => esc(x.doc.avoir ? 'Avoir client' : T[x.type].un)], ['Réf.', (x) => `<b>${esc(x.doc.ref)}</b>`], ['Date', (x) => D.jour(x.doc.date)], ['Montant HT', (x) => D.euros(D.ht(x.doc)), 'nb'], ['État', (x) => U.pastille(x.type, etatDe(x.type, x.doc))]], liens, { lien: (x) => D.routeDoc(x.type, x.id), vide: 'Aucun' }))}</div>
      <div class="erp-col">${U.bloc('Les 10 derniers événements', U.derniersEvt(evts), { droite: U.lien(`${type}/fiche/${id}/evenements`, 'Tous') })}</div></div>`;

    const apres = (el) => {
      if (type === 'achat' && D.lierPiecesAchat) D.lierPiecesAchat(el, v, d);
      const f = el.querySelector('#erp-ajout');
      // Modifier sur place (19 nov. 2026, demande : « modifier la réf. client, la TVA ou la quantité directement à
      // l'endroit concerné ») : enregistré dès qu'on quitte le champ ou appuie sur Entrée ; totaux recalculés.
      const refDoc = el.querySelector('[data-ref-doc]');
      if (refDoc) refDoc.addEventListener('change', () => { const x = refDoc.value.trim(); const k = type === 'achat' ? 'ref_fourn' : 'ref_client'; if ((d[k] || '') === x) return;
        d[k] = x; D.toucher(d); evtD(`${type === 'achat' ? 'Réf. fournisseur' : 'Réf. client'} de ${d.ref} : ${x || '(vide)'}`); v.sauver(); v.notifier('Référence enregistrée.'); });
      el.querySelectorAll('.erp-inline').forEach((c) => c.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); c.blur(); } }));
      el.querySelectorAll('[data-l-champ]').forEach((c) => c.addEventListener('change', () => {
        const l = d.lignes[+c.dataset.i]; const k = c.dataset.lChamp; if (!l) return;
        if (k === 'pa' && String(c.value).trim() === '') { if (l.pa == null) return; delete l.pa; D.toucher(d); v.sauver(); setTimeout(() => v.rendre(), 0); return; }
        let x = +String(c.value).replace(',', '.'); if (!Number.isFinite(x) || x < 0) x = 0; if (k === 'qte' && x <= 0) x = 1; if (k === 'remise') x = Math.min(100, x);
        if (l[k] === x) return; l[k] = x;
        if (k === 'pu' && l.produit && t.client) { const px = D.prixPour(db, d.tiers, l.produit); l.auto = Math.abs(px.pu - x) < 0.005 ? (px.source === 'client' ? 'prix client' : px.source === 'promo' ? 'prix promo' : 'prix net') : 'prix modifié'; }
        D.toucher(d); v.sauver();
        setTimeout(() => { const a = document.activeElement; const suite = a && a.dataset && a.dataset.lChamp ? `[data-l-champ="${a.dataset.lChamp}"][data-i="${a.dataset.i}"]` : null;
          v.rendre(); if (suite) { const n = document.querySelector(suite); if (n) { n.focus(); if (n.select) n.select(); } } }, 0);
      }));
      if (f) {
        const info = f.querySelector('[data-info]'); const sel = f.querySelector('[data-sel-p]');
        // Recherche de produit (19 nov. 2026, « quand je tape le libellé, ex. T-SHIRT, ça ne propose pas le produit ») :
        // par réf., libellé, nom du produit à variantes, couleur, taille, fournisseur ou code-barres ; sans tenir compte des
        // majuscules, accents, tirets ni espaces (« tshirt » = « T-Shirt ») ; chaque mot tapé doit se retrouver.
        // Suggestions avec photo sous le champ + liste filtrée (options reconstruites : fiable, contrairement à « hidden »).
        const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '');
        // catalogue complet (jusqu'à 100 000 produits) : texte de recherche calculé une fois, à la première frappe
        const cands = db.produits.filter(proposable); let textes = null;
        const texteDe = (p) => norm([p.ref, p.libelle, p.modele, p.couleur, p.taille, p.marque, p.code_barres, Object.values(p.attributs || {}).join(' ')].join(' '));
        const option = (p) => { const o = document.createElement('option'); o.value = p.id; o.textContent = libOpt(p); return o; };
        const zoneS = document.createElement('div'); zoneS.className = 'erp-sugg'; zoneS.hidden = true; sel.before(zoneS);
        const choisir = (id) => { sel.value = id; sel.dispatchEvent(new Event('change')); zoneS.hidden = true; const p = D.produit(db, id); if (p) chercheP.value = `${p.ref} — ${p.libelle || p.modele || ''}`; };
        const chercheP = f.querySelector('[data-cherche-p]');
        chercheP.addEventListener('input', () => {
          const mots = chercheP.value.split(/\s+/).map(norm).filter(Boolean);
          if (!textes) textes = cands.map(texteDe);
          const ok = []; for (let i = 0; i < cands.length; i++) if (mots.every((m) => textes[i].includes(m))) ok.push({ p: cands[i] });
          const montres = (mots.length ? ok : cands.slice(0, 150).map((p) => ({ p }))).slice(0, 200); montres.forEach((x) => { x.o = option(x.p); });
          const garde = sel.value; sel.replaceChildren(...montres.map((x) => x.o)); if (montres.some((x) => x.o.value === garde)) sel.value = garde;
          zoneS.hidden = !mots.length;
          zoneS.innerHTML = !mots.length ? '' : ok.length ? ok.slice(0, 8).map(({ p, o }) => p ? `<button type="button" class="erp-sugg-i" data-sugg="${p.id}">${U.vignetteProduit(p, 34)}<span><b>${esc(p.ref)}</b><small>${esc(p.libelle || p.modele || '')}</small>${t.client ? condSugg(p) : ''}</span><em>${esc((o.textContent.split(' — ')[2] || '').trim())}</em></button>` : '').join('') + (ok.length > 8 ? `<p class="erp-gris">… et ${ok.length - 8} autre(s) ${ok.length > 200 ? '(200 dans la liste ci-dessous : précisez la recherche)' : 'dans la liste ci-dessous'}</p>` : '')
            : `<p class="erp-gris">Aucun produit ne correspond à « ${esc(chercheP.value)} ».</p>`;
          if (ok.length === 1 && montres[0] && sel.value !== montres[0].o.value) { sel.value = montres[0].o.value; sel.dispatchEvent(new Event('change')); } // un seul résultat : présélectionné (le texte tapé reste)
        });
        chercheP.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); const b = zoneS.querySelector('[data-sugg]'); if (b) choisir(b.dataset.sugg); } });
        const condSugg = (p) => { const c = D.conditionClient(db, d.tiers, p.id); if (!c || !c.type) return '';
          return `<span class="erp-cond ${c.type}"><b>${c.type === 'client' ? 'Condition client' : c.type === 'promo' ? 'Prix promo' : 'Remise ' + D.nombre(c.remise) + ' %'}</b> ${D.euros(c.net)}<s>${D.euros(c.base)}</s></span>`; };
        zoneS.addEventListener('click', (e) => { const b = e.target.closest('[data-sugg]'); if (b) choisir(b.dataset.sugg); });
        f.querySelectorAll('[name="mode_l"]').forEach((r) => r.addEventListener('change', () => { const libre = f.mode_l.value === 'libre'; f.querySelector('[data-l-produit]').hidden = libre; f.querySelector('[data-l-libre]').hidden = !libre; info.textContent = ''; if (libre && f.pa) f.pa.value = ''; }));
        // Marge recalculée en direct avec le prix d'achat, le prix de vente et la réduction saisis (21 nov. 2026)
        const majMarge = () => { const z = info.querySelector('[data-marge]'); if (!z || !f.pa) return; const p = D.produit(db, sel.value);
          const net = (+f.pu.value || 0) * (1 - (+f.remise.value || 0) / 100); const pa = +f.pa.value || 0; const tx = net ? Math.round(((net - pa) / net) * 100) : 0;
          z.innerHTML = `Marge : ${D.euros(net - pa)} par unité (${tx} %${D.coefTxt(net, pa) ? ` · ${D.coefTxt(net, pa)}` : ''})${net < pa ? ' · <span class="erp-moins">vente à perte</span>' : p && net < p.prix_min ? ' · <span class="erp-moins">sous le prix minimum</span>' : ''}`; };
        if (t.client) ['pa', 'pu', 'remise'].forEach((n) => f[n].addEventListener('input', majMarge));
        sel.addEventListener('change', () => {
          const p = D.produit(db, sel.value); if (!p) return; 
          if (t.client) {
            const px = D.prixPour(db, d.tiers, p.id); f.pu.value = px.pu; f.remise.value = px.remise; const der = D.dernierPrix(db, d.tiers, p.id);
            f.pa.value = D.arrondi(D.prixRevient(p));
            info.innerHTML = `<b>Prix automatique : ${D.euros(px.pu)} HT</b> — ${esc(px.detail)}.${der ? ` Dernier prix payé par ce client : ${D.euros(der.pu)}${der.remise ? ` (−${der.remise} %)` : ''} le ${D.jour(der.date)} (${esc(der.ref)}).` : ''} <span data-marge></span>. Stock physique : ${D.nombre(p.stock)} · disponible (après devis et commandes en cours) : ${D.nombre(D.stockVirtuel(db, p))}.`;
            majMarge();
          } else { const a = D.prixAchat(db, d.tiers, p.id); f.pu.value = a.pu; f.remise.value = a.remise || 0; info.innerHTML = a.ref ? `Prix d’achat chez ce fournisseur : <b>${D.euros(a.pu)} HT</b> (réf. ${esc(a.ref)}).` : `Pas de prix enregistré chez ce fournisseur : prix moyen pondéré (${D.euros(a.pu)}).`; f.qte.value = Math.max(1, p.optimal - p.stock); }
        });
        f.addEventListener('submit', (e) => { e.preventDefault(); const c = U.lire(f); const libre = c.mode_l === 'libre'; const p = !libre && D.produit(db, c.produit);
          if (!libre && !p) { info.textContent = 'Choisissez un produit dans la liste.'; return; } if (libre && !c.desc) { info.textContent = 'Écrivez la description de la ligne libre.'; return; }
          const l = { produit: p ? p.id : null, desc: p ? (p.libelle || [p.modele, p.couleur, p.taille].filter(Boolean).join(' ') || p.ref) : c.desc, tva: D.tauxDoc(db, type, d), pu: +c.pu || 0, qte: +c.qte || 1, remise: +c.remise || 0 };
          if (p && t.client) { const px = D.prixPour(db, d.tiers, p.id); l.auto = Math.abs(px.pu - l.pu) < 0.005 ? (px.source === 'client' ? 'prix client' : px.source === 'promo' ? 'prix promo' : 'prix net') : 'prix modifié'; }
          if (t.client && c.pa !== '' && c.pa != null && (!p || Math.abs(+c.pa - D.prixRevient(p)) >= 0.005)) l.pa = +c.pa;
          if (type === 'achat') { l.ref_fourn = p ? D.prixAchat(db, d.tiers, p.id).ref : ''; l.recu = 0; }
          d.lignes.push(l); D.toucher(d); v.sauver(); v.rendre(); });
      }
      el.addEventListener('click', (e) => {
        const sl = e.target.closest('[data-suppr-ligne]'); if (sl) { const lr = d.lignes[+sl.dataset.supprLigne]; if (d.auto_reappro && lr && lr.produit) (d.retires = d.retires || []).push(lr.produit); /* réappro : ne pas le remettre */ d.lignes.splice(+sl.dataset.supprLigne, 1); D.toucher(d); v.sauver(); v.rendre(); return; }
        const b = e.target.closest('[data-act]'); if (!b || !b.closest('.erp-actions')) return;
        actions[b.dataset.act] && actions[b.dataset.act]();
      });
    };
    const fin = (msg) => { D.toucher(d); v.sauver(); if (msg) v.notifier(msg); v.rendre(); };
    const nouvelleFacture = () => {
      const date = D.auj(); const f = { id: D.id('fa'), ref: D.prochaineRef(db, 'fa', date), tiers: d.tiers, date, echeance: D.ajout(date, joursCond(d.cond || tiers.cond || '')), cond: d.cond, mode: d.mode, lignes: d.lignes.map((l) => ({ ...l })), ref_client: d.ref_client || '', payee: false, paiement: '', liens: [{ type, id: d.id }], note_pub: d.note_pub, note_priv: '', auteur: D.MOI, cree: D.maintenant() };
      if (D.figerPrix) D.figerPrix(db, f); // type de prix des lignes (commissions)
      D.toucher(f); db.factures.push(f); (d.liens = d.liens || []).push({ type: 'fact', id: f.id }); D.devenirClient(db, f.tiers);
      D.evt(db, `Facture ${f.ref} validée`, { tiers: f.tiers, objet: { type: 'fact', id: f.id } }); return f;
    };
    const actions = {
      valider() {
        if (!d.lignes.length) { v.fenetre('Impossible de valider', '<p>Ajoutez au moins une ligne avant de valider.</p>', '<button type="button" class="btn btn-metal" data-fermer>Compris</button>'); return; }
        // Validation effective (référence définitive, état, client, message « À contrôler »)
        const faire = (note) => {
          if (note) D.evt(db, `${t.un} ${d.ref} validée ${note}`, { tiers: d.tiers, objet: { type, id: d.id } });
          const ancien = d.ref; if (/^\(PROV/.test(d.ref)) d.ref = D.prochaineRef(db, t.ref, d.date);
          d.etat = type === 'prop' ? 'ouvert' : type === 'cmd' ? 'validee' : 'commande'; if (type === 'prop') d.fin = D.ajout(d.date, d.validite || 15);
          if (type === 'achat' && !d.livraison) d.livraison = D.ajout(D.auj(), +(tiers.delai_livraison || 7));
          if (type === 'cmd') D.devenirClient(db, d.tiers); // première commande d'un prospect → client
          if ((type === 'prop' || type === 'cmd') && D.figerPrix) D.figerPrix(db, d); // type de prix des lignes (commissions, js/erp-prix.js)
          signaler(db, type, d); // widget « À contrôler » (js/messagerie.js)
          if (type === 'achat') { evtD(`Commande fournisseur ${d.ref} envoyée au fournisseur${ancien !== d.ref ? ` (brouillon ${ancien})` : ''}`); fin(`${d.ref} : commande envoyée.`); return; }
          evtD(`${t.un} ${d.ref} validée${ancien !== d.ref ? ` (brouillon ${ancien})` : ''}`); fin(`${d.ref} validée.`); };
        const fin2 = 'Le document recevra sa référence définitive et ne sera plus modifiable (sauf en le repassant en brouillon).';
        // Encours client (23 nov. 2026, js/erp-encours.js) : jusqu'à +5 % → alerte « Valider quand même » ; au-delà → accord de Farid Medegueb
        const c = (type === 'prop' || type === 'cmd') && D.controleEncours ? D.controleEncours(db, type, d) : { niveau: 'ok' };
        // Remises au-delà de l'autorisé (23 nov. 2026, js/erp-prix.js) : accord de Farid aussi ; une seule demande pour les deux.
        const r = (type === 'prop' || type === 'cmd') && D.controleRemises ? D.controleRemises(db, type, d) : { hors: [] };
        const besoinEnc = c.niveau === 'accord' && !c.accorde; const besoinRem = r.hors.length > 0 && !r.accorde;
        if (besoinEnc || besoinRem) {
          const o = { enc: besoinEnc ? c : null, rem: besoinRem ? r : null };
          const txt = `<span class="erp-alerte-encours">🛑 ${besoinRem ? `<b>Remise au-delà de l’autorisé</b> : ${esc(D.texteRemises(db, r))}.${besoinEnc ? '<br>' : ''}` : ''}${besoinEnc ? `${c.texte}<br><b>${D.texteAccordEncours(c)}</b>` : ''}</span><br><br>`;
          if (D.estValideurEncours()) { v.confirmer(`Accorder et valider ${d.ref} ?`, txt + (besoinRem ? 'Commission 0 % sur les lignes hors limite. ' : '') + fin2, 'Accorder et valider', () => { D.accorderFarid(db, type, d, o); faire(''); }); return; }
          if (D.accordEnAttente(d)) { v.fenetre('Accord déjà demandé', `<p>${[D.etiquetteAccordRemise(d), D.etiquetteAccordEncours(d)].filter(Boolean).join(' ')}</p>`, '<button type="button" class="btn btn-metal" data-fermer>Compris</button>'); return; }
          v.confirmer(`Accord de ${D.VALIDEUR_ENCOURS} nécessaire`, `${txt}${esc(t.un)} ${esc(d.ref)} ne sera validé(e) qu’après son accord. Une demande lui est envoyée dans la Messagerie, avec le document.`, `Demander l’accord de ${D.VALIDEUR_ENCOURS}`, () => D.demanderAccordFarid(v, db, type, d, o));
          return; }
        const alerteEnc = c.niveau !== 'ok' ? c.texte : '';
        const accordTxt = c.niveau === 'accord' && c.accorde ? `<span class="erp-alerte-encours">✓ Encours accordé par ${esc(d.accord_encours.decide_par || '')} jusqu’à ${D.euros(+d.accord_encours.montant || 0)}.</span><br><br>` : '';
        v.confirmer(`Valider ${d.ref} ?`, `${accordTxt}${alerteEnc && !accordTxt ? `<span class="erp-alerte-encours">⚠ ${alerteEnc}</span><br><br>` : ''}${fin2}`, alerteEnc && !accordTxt ? 'Valider quand même' : 'Valider',
          () => faire(accordTxt ? 'avec l’accord d’encours' : alerteEnc ? 'malgré l’alerte d’encours client' : ''));
      },
      // Accord d'encours (Farid Medegueb) depuis la fiche : accorder = valider ; refuser = rester en brouillon
      accorder_enc() { this.valider(); },
      refuser_enc() {
        v.fenetre(`Refuser l’encours pour ${esc(d.ref)}`, `<form id="erp-ref-enc" class="erp-form-fen">${U.ligne('Motif (envoyé à la personne qui a demandé)', U.inp('motif', '', { ph: 'Ex. : régler d’abord la facture en retard' }))}</form>`,
          '<button type="button" class="btn btn-ligne" data-fermer>Annuler</button><button type="submit" form="erp-ref-enc" class="btn btn-metal">Refuser</button>', (bx) => {
            bx.querySelector('#erp-ref-enc').addEventListener('submit', (e) => { e.preventDefault(); D.refuserFarid(db, type, d, U.lire(e.target).motif); v.fermer(); fin('Encours refusé : le document reste en brouillon.'); }); });
      },
      entete() {
        v.fenetre('Modifier l’en-tête', `<form id="erp-et" class="erp-form erp-form-fen">${champsEnTete(type, d, db)}</form>`, `<button type="button" class="btn btn-ligne" data-fermer>Annuler</button><button type="submit" form="erp-et" class="btn btn-metal">Enregistrer</button>`, (bx) => {
          const f = bx.querySelector('#erp-et'); lierConditions(f, db);
          f.addEventListener('submit', (e) => { e.preventDefault(); const c = U.lire(f); Object.assign(d, { tiers: c.tiers, ref_client: c.ref_client ?? d.ref_client, ref_fourn: c.ref_fourn ?? d.ref_fourn, date: c.date, cond: c.cond, mode: c.mode, expedition: c.expedition ?? d.expedition, origine: c.origine ?? d.origine, delai: c.delai ?? d.delai, livraison: c.livraison ?? d.livraison, note_pub: c.note_pub, note_priv: c.note_priv });
            if (type === 'prop') { d.validite = +c.validite || 15; d.fin = D.ajout(d.date, d.validite); } v.fermer(); fin('En-tête enregistré.'); });
        });
      },
      modifier() { d.etat = 'brouillon'; evtD(`${t.un} ${d.ref} repassée en brouillon`); fin(); },
      signer() { d.etat = 'signee'; evtD(`Proposition ${d.ref} signée`); const x = D.tiers(db, d.tiers); if (x && x.prospect) { x.prospect = false; x.client = true; x.statut_prospect = 'fait'; D.evt(db, `${x.nom} est maintenant client`, { tiers: x.id }); } fin('Proposition signée.'); },
      refuser() { d.etat = 'non_signee'; evtD(`Proposition ${d.ref} classée non signée`); fin(); },
      rouvrir() { d.etat = 'ouvert'; evtD(`Proposition ${d.ref} rouverte`); fin(); },
      facturee() { d.etat = 'facturee'; evtD(`Proposition ${d.ref} classée facturée`); fin(); },
      commande() {
        const c = { id: D.id('cmd'), ref: D.refBrouillon(db, 'cmd'), tiers: d.tiers, ref_client: d.ref_client, date: D.auj(), livraison: '', cond: d.cond, mode: d.mode, expedition: d.expedition, origine: d.origine, etat: 'brouillon', facturee: false,
          lignes: d.lignes.map((l) => ({ ...l })), note_pub: d.note_pub, note_priv: '', auteur: D.MOI, liens: [{ type: 'prop', id: d.id }], cree: D.maintenant() };
        D.toucher(c); db.commandes.push(c); (d.liens = d.liens || []).push({ type: 'cmd', id: c.id }); evtD(`Commande ${c.ref} créée depuis la proposition ${d.ref}`); D.evt(db, `Commande ${c.ref} créée depuis la proposition ${d.ref}`, { tiers: c.tiers, objet: { type: 'cmd', id: c.id } });
        D.toucher(d); v.sauver(); v.aller(`cmd/fiche/${c.id}`);
      },
      encours() { d.etat = 'en_cours'; evtD(`Commande ${d.ref} en préparation`); fin(); },
      livrer() {
        // Stock insuffisant = livraison refusée (23 nov. 2026, demande : « sur les livraisons, ne pas permettre de mettre sur la
        // commande un article où il n'y a pas de stock suffisant ») : quantité commandée (toutes lignes du même produit) > stock physique.
        const besoin = {}; d.lignes.forEach((l) => { if (l.produit && +l.qte > 0) besoin[l.produit] = (besoin[l.produit] || 0) + +l.qte; });
        const manque = Object.entries(besoin).map(([pid, q]) => ({ p: D.produit(db, pid), q })).filter((x) => x.p && (+x.p.stock || 0) < x.q);
        if (manque.length) {
          v.fenetre('Livraison impossible : stock insuffisant', `<p>Ces articles n’ont pas assez de stock physique pour livrer la commande <b>${esc(d.ref)}</b> :</p>
            <ul class="erp-manque">${manque.map((x) => `<li><b>${esc(x.p.ref)}</b> ${esc(x.p.libelle || '')} : commandé <b>${D.nombre(x.q)}</b>, en stock <b>${D.nombre(Math.max(0, +x.p.stock || 0))}</b> · <span class="erp-moins">manque ${D.nombre(x.q - Math.max(0, +x.p.stock || 0))}</span></li>`).join('')}</ul>
            <p class="erp-gris">Réceptionnez la marchandise (commande fournisseur) ou corrigez le stock, ou réduisez la ligne, puis classez la commande livrée.</p>`,
            '<button type="button" class="btn btn-metal" data-fermer>Compris</button>');
          return;
        }
        v.confirmer(`Classer ${d.ref} livrée ?`, 'Les quantités livrées seront retirées du stock.', 'Classer livrée', () => {
        d.etat = 'livree'; d.livraison = D.auj(); d.lignes.forEach((l) => { if (l.produit) D.mouvement(db, l.produit, -l.qte, `Livraison commande ${d.ref}`); }); evtD(`Commande ${d.ref} classée Livrée`); fin('Commande livrée, stock mis à jour.'); }); },
      annuler() { v.confirmer(`Annuler ${d.ref} ?`, 'La commande sera classée « Annulée ».', 'Annuler la commande', () => { d.etat = 'annulee'; evtD(`Commande ${d.ref} annulée`); fin(); }); },
      facturer() { const f = nouvelleFacture(); d.facturee = true; (d.liens || []).filter((x) => x.type === 'prop').forEach((x) => { const p = db.propositions.find((o) => o.id === x.id); if (p) { p.etat = 'facturee'; (p.liens = p.liens || []).push({ type: 'fact', id: f.id }); } });
        evtD(`Commande ${d.ref} classée Facturée (facture ${f.ref})`); D.toucher(d); v.sauver(); v.notifier(`Facture ${f.ref} créée : la commande ${d.ref} est classée « Facturée ».`); v.aller(`fact/fiche/${f.id}`); },
      approuver() { d.etat = 'approuve'; evtD(`Commande fournisseur ${d.ref} approuvée par ${D.MOI}`); fin(); },
      refuser_a() { d.etat = 'refuse'; evtD(`Commande fournisseur ${d.ref} refusée`); fin(); },
      ar() { v.aller(`achat/fiche/${d.id}/ar`); },
      litige() { v.aller(`achat/fiche/${d.id}/litige`); },
      ar_ancien() { v.fenetre(`AR reçu pour ${esc(d.ref)}`, `<form id="erp-ar" class="erp-form-fen">${U.ligne('N° de l’AR (confirmation du fournisseur)', U.inp('ar_num', d.ar_num || ''))}${U.ligne('Date de livraison confirmée', U.inp('livraison', d.livraison || '', { type: 'date' }))}</form>`,
          '<button type="button" class="btn btn-ligne" data-fermer>Annuler</button><button type="submit" form="erp-ar" class="btn btn-metal">Enregistrer l’AR</button>', (bx) => {
            bx.querySelector('#erp-ar').addEventListener('submit', (e) => { e.preventDefault(); const c = U.lire(e.target); d.etat = 'ar_recu'; d.ar_num = c.ar_num; d.ar_date = D.auj(); if (c.livraison) d.livraison = c.livraison;
              evtD(`Commande fournisseur ${d.ref} : AR reçu${c.ar_num ? ' (n° ' + c.ar_num + ')' : ''}`); v.fermer(); fin('AR enregistré.'); }); }); },
      attente_f() { d.etat = 'attente_facture'; evtD(`Commande fournisseur ${d.ref} en attente de facture`); fin(); },
      facturer_a() { v.aller(`achat/fiche/${d.id}/facture`); },
      facturer_a_ancien() { v.fenetre(`Classer ${esc(d.ref)} facturée`, `<form id="erp-fa" class="erp-form-fen">${U.ligne('N° de la facture du fournisseur', U.inp('num', d.facture_num || '', { req: true }))}${U.ligne('Date de la facture', U.inp('date', D.auj(), { type: 'date', req: true }))}${U.ligne('Montant TTC (€)', U.inp('ttc', D.ttc(d), { type: 'number', step: '0.01', min: 0, req: true }))}</form>`,
          '<button type="button" class="btn btn-ligne" data-fermer>Annuler</button><button type="submit" form="erp-fa" class="btn btn-metal">Classer facturée</button>', (bx) => {
            bx.querySelector('#erp-fa').addEventListener('submit', (e) => { e.preventDefault(); const c = U.lire(e.target); d.etat = 'facturee'; d.facture_num = c.num; d.facture_date = c.date; d.facture_ttc = +c.ttc || D.ttc(d); d.payee = false;
              evtD(`Commande fournisseur ${d.ref} classée facturée (facture ${c.num}, ${D.euros(d.facture_ttc)} TTC)`); v.fermer(); fin('Commande classée facturée.'); }); }); },
      payer_a() { v.confirmer(`Facture de ${d.ref} payée ?`, `Facture ${esc(d.facture_num || '')} : ${D.euros(+d.facture_ttc || D.ttc(d))} TTC. L’encours du fournisseur baisse d’autant.`, 'Facture payée', () => { d.payee = true; d.paiement = D.auj(); evtD(`Facture fournisseur de ${d.ref} payée`); fin('Paiement enregistré.'); }); },
      annuler_a() { d.etat = 'annule'; evtD(`Commande fournisseur ${d.ref} annulée`); fin(); },
      commander() { d.etat = 'commande'; if (!d.livraison) d.livraison = D.ajout(D.auj(), 7); evtD(`Commande fournisseur ${d.ref} envoyée au fournisseur`); fin(); },
      recevoir() {
        // PMP mis à jour à chaque réception (prix moyen pondéré : ancien stock × ancien PMP + reçu × prix d'achat net).
        // Prix payé = nouveau prix d'achat de ce fournisseur pour ce produit (onglet « Prix d'achat »), ajouté s'il n'existait pas.
        const majPrixFourn = (l) => { const p = D.produit(db, l.produit); if (!p || !(+l.pu > 0)) return; const fs = (p.fournisseurs = p.fournisseurs || []);
          const f = fs.find((x) => x.tiers === d.tiers); if (f) { f.pu = +l.pu; f.remise = +l.remise || 0; if (l.ref_fourn) f.ref = l.ref_fourn; } else fs.push({ tiers: d.tiers, ref: l.ref_fourn || '', pu: +l.pu, remise: +l.remise || 0 }); D.toucher(p); };
        const majPmp = (pid, q, net) => { const p = D.produit(db, pid); if (!p || !(net > 0)) return; const st = Math.max(0, +p.stock || 0); const ancien = +p.pmp > 0 ? +p.pmp : net;
          p.pmp = D.arrondi((st * ancien + q * net) / (st + q)); };
        v.fenetre(`Réceptionner ${esc(d.ref)}`, `<form id="erp-rec" class="erp-form-fen"><table class="registre erp-table"><thead><tr><th>Produit</th><th class="nb">Commandé</th><th class="nb">Déjà reçu</th><th class="nb">Reçu maintenant</th></tr></thead><tbody>
          ${d.lignes.map((l, i) => `<tr><td>${esc(l.desc)}</td><td class="nb">${D.nombre(l.qte)}</td><td class="nb">${D.nombre(l.recu || 0)}</td><td class="nb"><input class="erp-inp-nb" type="number" min="0" max="${l.qte - (l.recu || 0)}" name="r${i}" value="${l.qte - (l.recu || 0)}" aria-label="Quantité reçue"></td></tr>`).join('')}</tbody></table></form>`, `<button type="button" class="btn btn-ligne" data-fermer>Annuler</button><button type="submit" form="erp-rec" class="btn btn-metal">Valider la réception</button>`, (bx) => {
          bx.querySelector('#erp-rec').addEventListener('submit', (e) => { e.preventDefault(); const c = U.lire(e.target);
            d.lignes.forEach((l, i) => { const q = Math.min(+c['r' + i] || 0, l.qte - (l.recu || 0)); if (q > 0) { l.recu = (l.recu || 0) + q; if (l.produit) majPrixFourn(l); if (l.produit) majPmp(l.produit, q, (+l.pu || 0) * (1 - (+l.remise || 0) / 100)); if (l.produit) D.mouvement(db, l.produit, q, `Réception commande fournisseur ${d.ref}`, { nature: 'commande' }); } });
            d.etat = d.lignes.every((l) => (l.recu || 0) >= l.qte) ? 'recue' : 'recue_partiel'; evtD(d.etat === 'recue' ? `Commande fournisseur ${d.ref} : tous les produits reçus` : `Commande fournisseur ${d.ref} reçue partiellement`); v.fermer(); fin('Réception enregistrée, stock mis à jour.'); });
        });
      },
      payer() {
        v.fenetre(`Classer ${esc(d.ref)} payée`, `<form id="erp-pay" class="erp-form-fen">${U.ligne('Date du paiement', U.inp('date', D.auj(), { type: 'date', req: true }))}${U.ligne('Mode de règlement', U.sel('mode', D.MODES, d.mode))}<p class="erp-gris">Montant : <b>${D.euros(ttc)}</b> TTC</p></form>`,
          `<button type="button" class="btn btn-ligne" data-fermer>Annuler</button><button type="submit" form="erp-pay" class="btn btn-metal">Enregistrer le paiement</button>`, (bx) => {
            bx.querySelector('#erp-pay').addEventListener('submit', (e) => { e.preventDefault(); const c = U.lire(e.target); d.payee = true; d.paiement = c.date; d.mode = c.mode; evtD(`Facture ${d.ref} passée à payée (${c.mode})`); v.fermer(); fin('Paiement enregistré.'); });
          });
      },
      // Avoir (23 nov. 2026, demande : « sur les factures ajoute une option pour faire un avoir, avoir d'un article avec retour
      // en stock de l'article ou juste un avoir prix, le client garde le produit et pas de remise en stock ») : facture client
      // à part (db.factures, avoir: true, n° AV-…), lignes en quantités négatives → montants négatifs partout (encours, Compta).
      // « retour » : lignes de la facture, quantités rendues, remises en stock. « prix » : montant HT par ligne, stock inchangé.
      // Une facture ne peut pas être créditée au-delà de ce qu'elle vaut (avoirs précédents déduits).
      avoir() {
        const avs = db.factures.filter((f) => f.avoir && f.origine === d.id);
        const deja = (i, retourSeul) => avs.filter((a) => !retourSeul || a.avoir_nature === 'retour').reduce((s, a) => s + a.lignes.filter((x) => x.avoir_ligne === i).reduce((s2, x) => s2 + (retourSeul ? -x.qte : -D.htLigne(x)), 0), 0);
        const restQ = d.lignes.map((l, i) => Math.max(0, (+l.qte || 0) - deja(i, true)));
        const restM = d.lignes.map((l, i) => D.arrondi(Math.max(0, D.htLigne(l) - deja(i, false))));
        if (!restM.some((x) => x > 0)) { v.notifier(`La facture ${d.ref} est déjà entièrement couverte par des avoirs.`); return; }
        const net = (l) => D.arrondi((+l.pu || 0) * (1 - (l.remise || 0) / 100));
        const lignesF = d.lignes.map((l, i) => { const p = l.produit && D.produit(db, l.produit); const dm = deja(i, false);
          return `<tr><td>${p ? `<b>${esc(p.ref)}</b> ` : ''}${esc(l.desc)}${dm > 0 ? `<br><small class="erp-gris">déjà en avoir : ${D.euros(dm)} HT</small>` : ''}</td><td class="nb">${D.nombre(l.qte)}</td><td class="nb">${D.euros(net(l))}</td>
            <td class="nb" data-av-q><input name="q${i}" type="number" min="0" max="${restQ[i]}" step="1" value="0"${restQ[i] ? '' : ' disabled'} aria-label="Quantité rendue"></td>
            <td class="nb" data-av-m hidden><input name="m${i}" type="number" min="0" max="${restM[i]}" step="0.01" placeholder="0,00"${restM[i] ? '' : ' disabled'} aria-label="Montant HT à rembourser"></td></tr>`; }).join('');
        v.fenetre(`Créer un avoir sur la facture ${esc(d.ref)}`, `<form id="erp-av" class="erp-form-fen">
          <div class="erp-av-choix"><label><input type="radio" name="nature" value="retour" checked><span><b>Retour de marchandise</b><small>Le client rend l’article : il est remis en stock.</small></span></label>
            <label><input type="radio" name="nature" value="prix"><span><b>Avoir sur prix</b><small>Le client garde l’article, pas de remise en stock (ex. erreur de prix).</small></span></label></div>
          <div class="erp-av-wrap"><table class="registre erp-table erp-av-table"><thead><tr><th>Article</th><th class="nb">Qté facturée</th><th class="nb">P.U. net HT</th><th class="nb" data-av-q>Qté rendue</th><th class="nb" data-av-m hidden>Montant HT à rembourser</th></tr></thead><tbody>${lignesF}</tbody></table></div>
          ${U.ligne('Motif', U.inp('motif', '', { ph: 'Ex. article défectueux, erreur de prix…' }))}
          <p class="erp-av-total" data-av-total></p></form>`,
        `<button type="button" class="btn btn-ligne" data-fermer>Annuler</button><button type="submit" form="erp-av" class="btn btn-metal">Créer l’avoir</button>`, (bx) => {
          const f = bx.querySelector('#erp-av'); const mode = () => f.querySelector('[name="nature"]:checked').value;
          const calcul = () => { const m = mode(); const lignes = [];
            d.lignes.forEach((l, i) => {
              if (m === 'retour') { const q = Math.min(restQ[i], Math.max(0, Math.floor(+f.elements['q' + i].value || 0))); if (q > 0) lignes.push({ ...JSON.parse(JSON.stringify(l)), qte: -q, avoir_ligne: i }); }
              else { const x = D.arrondi(Math.min(restM[i], Math.max(0, +f.elements['m' + i].value || 0))); if (x > 0) lignes.push({ desc: `Avoir sur prix · ${l.desc || ''}`, pu: x, qte: -1, remise: 0, tva: l.tva ?? D.TVA, pa: 0, avoir_ligne: i }); }
            });
            return lignes; };
          const maj = () => { const m = mode(); f.querySelectorAll('[data-av-q]').forEach((x) => { x.hidden = m !== 'retour'; }); f.querySelectorAll('[data-av-m]').forEach((x) => { x.hidden = m === 'retour'; });
            const l = calcul(); const doc = { lignes: l };
            f.querySelector('[data-av-total]').innerHTML = l.length ? `Avoir : <b>${D.euros(-D.ht(doc))}</b> HT · <b>${D.euros(-D.ttc(doc))}</b> TTC${m === 'retour' ? ` · ${D.nombre(l.reduce((s, x) => s - x.qte, 0))} article(s) remis en stock` : ' · stock inchangé'}` : '<span class="erp-gris">Indiquez les quantités rendues ou les montants à rembourser.</span>'; };
          f.addEventListener('input', maj); f.addEventListener('change', maj); maj();
          f.addEventListener('submit', (e) => { e.preventDefault(); const m = mode(); const lignes = calcul();
            if (!lignes.length) { v.notifier('Indiquez au moins une quantité rendue ou un montant à rembourser.'); return; }
            const date = D.auj(); const motif = f.elements.motif.value.trim();
            const av = { id: D.id('fa'), ref: D.prochaineRef(db, 'av', date), avoir: true, avoir_nature: m, origine: d.id, origine_ref: d.ref, motif, tiers: d.tiers, date, echeance: date, cond: d.cond, mode: d.mode, lignes,
              ref_client: d.ref_client || '', payee: false, paiement: '', liens: [{ type: 'fact', id: d.id }], note_pub: `Avoir sur la facture N° ${d.ref} du ${D.jour(d.date)}${motif ? ` · ${motif}` : ''}`, note_priv: '', auteur: D.MOI, cree: D.maintenant() };
            D.toucher(av); db.factures.push(av); (d.liens = d.liens || []).push({ type: 'fact', id: av.id }); D.toucher(d);
            if (m === 'retour') lignes.forEach((x) => { if (x.produit) D.mouvement(db, x.produit, -x.qte, `Retour client · avoir ${av.ref} (facture ${d.ref})`, { nature: 'avoir', doc: { type: 'fact', id: av.id } }); });
            evtD(`Avoir ${av.ref} créé sur la facture ${d.ref} (${m === 'retour' ? 'retour de marchandise, remise en stock' : 'avoir sur prix'}) : ${D.euros(-D.ttc(av))} TTC`);
            D.evt(db, `Avoir ${av.ref} créé (facture ${d.ref})`, { tiers: av.tiers, objet: { type: 'fact', id: av.id } });
            v.sauver(); v.fermer(); v.notifier(`Avoir ${av.ref} créé${m === 'retour' ? ' : articles remis en stock' : ''}.`); v.aller(`fact/fiche/${av.id}`);
          });
        });
      },
      cloner() {
        const c = { ...JSON.parse(JSON.stringify(d)), id: D.id(type), ref: D.refBrouillon(db, type), etat: 'brouillon', date: D.auj(), liens: [], facturee: false, cree: D.maintenant() };
        if (type === 'prop') c.fin = D.ajout(c.date, c.validite || 15); if (type === 'achat') c.lignes.forEach((l) => { l.recu = 0; });
        D.toucher(c); db[t.cle].push(c); D.evt(db, `${t.un} ${c.ref} créée (copie de ${d.ref})`, { tiers: c.tiers, objet: { type, id: c.id } }); v.sauver(); v.aller(`${type}/fiche/${c.id}`);
      },
      supprimer() { // 24/11 : vers la corbeille « Récemment supprimés » (js/erp-corbeille.js), restaurable 30 jours
        const texte = (brouillon ? 'Ce brouillon' : `Cette commande (état : ${D.etat(type, d.etat)[3] || d.etat})`) + ' ira dans « Récemment supprimés » (Outils) : vous pourrez la restaurer pendant 30 jours.'
          + (brouillon ? '' : ' Le stock déjà livré ou reçu n’est pas modifié.');
        v.confirmer(`Supprimer ${d.ref} ?`, texte, 'Supprimer', () => {
          if (D.jeter) D.jeter(db, t.cle, d); else db[t.cle] = db[t.cle].filter((x) => x.id !== id);
          v.sauver(); v.aller(`${type}/liste/tous`); });
      },
      pdf() { D.ouvrirPdf(v, type, d); },
      email() { D.envoyerDoc(v, type, d); },
    };
    return { html, apres };
  }

  // ---------------------------------------------------------------- statistiques (comme Dolibarr : filtre + tableau par année + 3 graphiques par mois)
  const filtres = {};
  function stats(v, type) {
    const db = v.db; const t = T[type]; const fl = filtres[type] || (filtres[type] = { tiers: '', etat: '' });
    const docs = db[t.cle].filter((d) => d.etat !== 'brouillon' || type === 'fact').filter((d) => (!fl.tiers || d.tiers === fl.tiers) && (!fl.etat || etatDe(type, d) === fl.etat || (type === 'fact' && fl.etat === 'impayee' && !d.payee)));
    const ans = [...new Set([...db[t.cle].map((d) => d.date.slice(0, 4)), D.auj().slice(0, 4)])].sort().reverse();
    const per = U.bornes(U.periode(type + '-stats', 'annee'), ans);
    const parAn = ans.map((an) => { const l = docs.filter((d) => d.date.startsWith(an)); const mt = l.reduce((s, d) => s + D.ht(d), 0); return { an, n: l.length, mt, moy: l.length ? mt / l.length : 0 }; });
    const m = U.serie(docs, per); const tot = m.reduce((a, x) => a + x.n, 0), totM = m.reduce((a, x) => a + x.mt, 0);
    const tiersOpts = db.tiers.filter((x) => (t.client ? x.client || x.prospect : x.fournisseur)).sort((a, b) => a.nom.localeCompare(b.nom)).map((x) => [x.id, x.nom]);
    return { html: `${U.titrePage(t.ico, `Statistiques — ${t.titre}`)}${U.choixPeriode(type + '-stats', 'annee')}
      <div class="erp-stats"><div class="erp-col">${U.bloc('Filtre', `<form class="erp-form erp-form-filtre" id="erp-fs">${U.ligne(t.client ? 'Tiers' : 'Fournisseur', U.sel('tiers', tiersOpts, fl.tiers, { vide: 'Tous' }))}${U.ligne('État', U.sel('etat', D.ETATS[type].map((e) => [e[0], e[3]]), fl.etat, { vide: 'Tous (hors brouillons)' }))}</form>`, { ico: 'recherche' })}
        ${U.bloc(`Sur la période — ${per.lib}`, U.infos([['Nombre', `<b>${tot}</b>`, 'liste'], ['Montant total HT', `<b>${D.euros(totM)}</b>`, 'euro'], ['Montant moyen', D.euros(tot ? totM / tot : 0), 'stats']]), { ico: 'temps' })}
        ${U.bloc('Par année', U.table([['Année', (x) => `<b>${x.an}</b>`], ['Nombre', (x) => String(x.n), 'nb'], ['Montant total HT', (x) => D.euros(x.mt), 'nb'], ['Montant moyen', (x) => D.euros(x.moy), 'nb']], parAn))}</div>
      <div class="erp-col">${U.bloc(`Nombre — ${per.lib}`, U.barresP(m.map((x) => x.n), per), { ico: 'stats' })}${U.bloc(`Montant HT — ${per.lib}`, U.barresP(m.map((x) => x.mt), per, U.court), { ico: 'stats' })}${U.bloc(`Montant moyen — ${per.lib}`, U.barresP(m.map((x) => x.moy), per, U.court), { ico: 'stats' })}</div></div>`,
      apres: (el) => el.querySelector('#erp-fs').addEventListener('change', (e) => { const c = U.lire(e.currentTarget); filtres[type] = { tiers: c.tiers, etat: c.etat }; v.rendre(); }) };
  }
})();
