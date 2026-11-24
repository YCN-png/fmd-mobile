// FMD — CRM / ERP : Accueil (tableau de bord), Tiers (prospects, clients, fournisseurs), Contacts, Tags, Recherche.
// Modèle : captures Dolibarr « CRM\1-Accueil » et « CRM\2-Tiers » (fiche client à onglets : Tiers, Contacts, Client,
// Prix clients, Modes de règlement, Notes, Événements).
(function () {
  'use strict';
  const D = (window.FMDERP = window.FMDERP || {});
  const P = (D.pages = D.pages || {});
  const U = D.ui;
  const esc = U.esc;
  // Contrôle des créations (21 nov. 2026, js/messagerie.js) : nouveau tiers → message « À contrôler » avec le lien.
  const signalerTiers = (o) => { if (!window.FMDMessagerie || !window.FMDMessagerie.signalerCreation) return;
    const nature = [o.client && 'Client', o.prospect && 'Prospect', o.fournisseur && 'Fournisseur'].filter(Boolean).join(' · ');
    window.FMDMessagerie.signalerCreation({ quoi: o.fournisseur && !o.client ? 'le fournisseur' : o.client ? 'le client' : 'le prospect', ref: o.nom, route: `tiers/fiche/${o.id}`,
      apercu: { type: 'tiers', titre: nature || 'Tiers', ref: o.nom, adresse: o.adresse || '', ville: [o.cp, o.ville].filter(Boolean).join(' '), tel: o.tel || o.portable || '', email: o.email || '', siret: o.siret || '', code: o.code_client || o.code_fourn || '' } }); };
  const routeDoc = { prop: 'prop/fiche/', cmd: 'cmd/fiche/', fact: 'fact/fiche/', achat: 'achat/fiche/' };
  D.routeDoc = (type, id) => routeDoc[type] + id;
  const parModif = (l) => [...l].sort((a, b) => (b.modifie > a.modifie ? 1 : -1));
  const parDate = (l) => [...l].sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : (b.ref > a.ref ? 1 : -1)));
  // Petite liste de documents (réf, tiers, montant, date, état)
  D.miniDocs = (db, type, docs, o = {}) => U.table([
    ['Réf.', (d) => `<b>${esc(d.ref)}</b>`],
    o.sansTiers ? null : ['Tiers', (d) => U.qui(D.tiers(db, d.tiers), '', 22)],
    ['Date', (d) => D.jour(d.date)],
    o.echeance ? ['Échéance', (d) => D.jour(d.echeance)] : null,
    ['Montant HT', (d) => D.euros(D.ht(d)), 'nb'],
    ['État', (d) => U.pastille(type, type === 'fact' ? D.etatFacture(d) : d.etat)],
  ].filter(Boolean), docs, { lien: (d) => D.routeDoc(type, d.id), vide: o.vide || 'Aucun', pied: o.pied, visuel: (d) => U.visuelDoc(db, d, true) });

  // =====================================================================================================
  // ACCUEIL
  P.accueil = (v) => {
    const db = v.db; const auj = D.auj(); const an = auj.slice(0, 4); const moisCours = +auj.slice(5, 7) - 1;
    const props = db.propositions, cmds = db.commandes, facts = db.factures, achats = db.achats;
    const ouvertes = props.filter((p) => p.etat === 'ouvert'), expirees = ouvertes.filter((p) => p.fin < auj);
    const aFacturerP = props.filter((p) => p.etat === 'signee');
    const cmdOuv = cmds.filter((c) => c.etat === 'validee' || c.etat === 'en_cours'), cmdAFact = cmds.filter((c) => c.etat === 'livree' && !c.facturee);
    const impayees = facts.filter((f) => !f.payee), retard = impayees.filter((f) => f.echeance < auj);
    const achOuv = achats.filter((a) => a.etat === 'brouillon'), achAttente = achats.filter((a) => ['commande', 'ar_recu', 'recue_partiel'].includes(a.etat));
    const sousAlerte = db.produits.filter((p) => p.stock <= p.alerte);
    const aContacter = db.tiers.filter((t) => t.prospect && (t.statut_prospect === 'jamais' || t.statut_prospect === 'a_contacter'));
    const widget = (ico, titre, l) => `<div class="erp-widget"><span class="erp-widget-ico">${U.ico(ico)}</span><div><h3>${esc(titre)}</h3>${l.map(([lib, n, r, alerte]) => `<button type="button" data-aller="${esc(r)}"><span>${esc(lib)}</span><b class="${alerte && n ? 'alerte' : ''}">${n}</b></button>`).join('')}</div></div>`;
    // Période choisie (Jour / Semaine / Mois / Année / Tout) pour les graphiques de l'accueil
    const ans = [...new Set([...cmds, ...facts].map((d) => String(d.date).slice(0, 4)))];
    const per = U.bornes(U.periode('accueil', 'annee'), ans);
    const sm = U.serie(D.ventes(db).filter((c) => c.etat !== 'brouillon' && c.etat !== 'annulee'), per);
    const fm = U.serie(facts, per);
    const encoursDep = db.tiers.filter((t) => t.client && t.encours_max && D.encours(db, t.id) > t.encours_max);
    const base = [['Clients', db.tiers.filter((t) => t.client).length, 'tiers/liste/C', 'client'], ['Prospects', db.tiers.filter((t) => t.prospect).length, 'tiers/liste/P', 'cible'], ['Fournisseurs', db.tiers.filter((t) => t.fournisseur).length, 'tiers/liste/F', 'camion'],
      ['Contacts', db.contacts.length, 'contacts/liste/tous', 'contacts'], ['Produits', db.produits.length, 'produits/liste', 'produit'], ['Propositions', props.length, 'prop/liste/tous', 'commerce'], ['Commandes', cmds.length, 'cmd/liste/tous', 'commande'],
      ['Factures', facts.length, 'fact/liste/tous', 'facture'], ['Achats', achats.length, 'achat/liste/tous', 'camion']];
    const ventesCat = D.CATEGORIES.map(([id, l], i) => ({ l, v: Math.round(D.ventes(db).filter((c) => per.dans(c.date) && c.etat !== 'annulee' && c.etat !== 'brouillon').reduce((s, c) => s + c.lignes.filter((x) => (D.produit(db, x.produit) || {}).categorie === id).reduce((a, x) => a + D.htLigne(x), 0), 0)), c: U.COUL['c' + ((i % 5) + 1)], r: 'tags/produits' }));
    const totalImp = impayees.reduce((s, f) => s + D.ttc(f), 0);
    // Chiffres de l'année en cours (23 nov. 2026, demande : « sur l'accueil : nombre de commandes clients / CA client 2026, nombre
    // de références vendues, top 3 des ventes avec CA, diagramme de marge ») : commandes clients validées, en cours, livrées ou
    // facturées (hors brouillons et annulées) datées de l'année ; marge = HT − prix de revient des lignes.
    const cmdsAn = D.ventes(db).filter((c) => String(c.date).slice(0, 4) === an && c.etat !== 'brouillon' && c.etat !== 'annulee');
    const nbVentes = cmdsAn.filter((c) => !c.avoir).length; // avoirs : comptés dans le CA (en négatif), pas comme des commandes
    const caAn = cmdsAn.reduce((s, c) => s + D.ht(c), 0); const coutAn = cmdsAn.reduce((s, c) => s + D.cout(db, c), 0); const margeAn = caAn - coutAn;
    const parProd = {}; cmdsAn.forEach((c) => c.lignes.forEach((l) => { if (!l.produit) return; const x = parProd[l.produit] || (parProd[l.produit] = { q: 0, ca: 0, marge: 0 });
      x.q += +l.qte || 0; x.ca += D.htLigne(l); x.marge += D.htLigne(l) - D.paLigne(db, l) * (+l.qte || 0); }));
    const top3 = Object.entries(parProd).sort((a, b) => b[1].ca - a[1].ca).slice(0, 3);
    const margeMois = Array.from({ length: 12 }, (_, m) => cmdsAn.filter((c) => +String(c.date).slice(5, 7) === m + 1).reduce((s, c) => s + D.ht(c) - D.cout(db, c), 0));
    const caMois = Array.from({ length: 12 }, (_, m) => cmdsAn.filter((c) => +String(c.date).slice(5, 7) === m + 1).reduce((s, c) => s + D.ht(c), 0));
    // Objectif de chiffre d'affaires (23 nov. 2026, demande : « compteur d'objectif de CA mensuel et le cumul annuel ») :
    // db.objectifs.ca = { defaut: € HT par mois, mois: { 'AAAA-MM': € HT } } (enregistré en ligne avec le CRM). Réglé UNIQUEMENT par Farid Medegueb (demande : « personne à part Farid ne peut
    // modifier les objectifs ») : nom de la personne connectée = D.VALIDEUR_ENCOURS (js/erp-encours.js), jamais le nom par défaut.
    // CA = même base que « CA clients » : commandes clients HT de l'année, hors brouillons et annulées, au mois de leur date.
    const admin = !!(v.ctx && v.ctx.moi && v.ctx.moi.nom && D.estValideurEncours && D.estValideurEncours());
    const objCa = (db.objectifs && db.objectifs.ca) || {};
    const cleMois = (m) => `${an}-${String(m + 1).padStart(2, '0')}`;
    const objMois = Array.from({ length: 12 }, (_, m) => { const x = (objCa.mois || {})[cleMois(m)]; return x !== undefined && x !== null && x !== '' ? +x || 0 : +objCa.defaut || 0; });
    const somme = (l) => l.reduce((s, x) => s + x, 0);
    const objAn = somme(objMois); const jourM = +auj.slice(8, 10); const nbJours = new Date(+an, moisCours + 1, 0).getDate();
    const objADate = somme(objMois.slice(0, moisCours)) + (objMois[moisCours] * jourM) / nbJours;
    const caCeMois = caMois[moisCours]; const caCumul = somme(caMois.slice(0, moisCours + 1));
    const pcDe = (x, cible) => (cible > 0 ? Math.round((x / cible) * 100) : 0);
    const jauge = (titre, val, cible, sous, repere) => { const pc = pcDe(val, cible);
      return `<div class="erp-obj-j${pc >= 100 ? ' atteint' : ''}"><div class="erp-obj-h"><small>${esc(titre)}</small><b>${D.eurosRond(val)} <span>HT</span></b><em>objectif ${D.eurosRond(cible)}</em></div>
        <div class="erp-obj-barre" role="progressbar" aria-label="${esc(titre)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(100, pc)}"><i style="width:${Math.min(100, pc)}%"></i>${repere != null && cible > 0 ? `<u style="left:${Math.min(100, (repere / cible) * 100)}%" title="Objectif à date : ${esc(D.eurosRond(repere))}"></u>` : ''}</div>
        <div class="erp-obj-p"><b>${pc} %</b><span>${sous}</span></div></div>`; };
    const resteJ = nbJours - jourM;
    const blocObjectif = U.bloc(`Objectif de chiffre d’affaires ${an}`, objAn > 0
      ? `<div class="erp-obj">${jauge(`${U.MOIS[moisCours]} ${an}`, caCeMois, objMois[moisCours], caCeMois >= objMois[moisCours] ? `Objectif atteint${caCeMois > objMois[moisCours] ? ` · +${esc(D.eurosRond(caCeMois - objMois[moisCours]))}` : ''}` : `Reste ${esc(D.eurosRond(objMois[moisCours] - caCeMois))} · ${resteJ} jour${resteJ > 1 ? 's' : ''} restant${resteJ > 1 ? 's' : ''}`)}
        ${jauge(`Cumul ${an} (Janv. → ${U.MOIS[moisCours]})`, caCumul, objAn, `${caCumul >= objADate ? 'En avance' : 'En retard'} de ${esc(D.eurosRond(Math.abs(caCumul - objADate)))} sur l’objectif à date (${esc(D.eurosRond(objADate))})`, objADate)}</div>`
      : U.vide(admin ? 'Aucun objectif défini : cliquez sur « Définir l’objectif ».' : `Aucun objectif défini (à régler par ${D.VALIDEUR_ENCOURS || 'Farid Medegueb'}).`),
      { ico: 'stats', droite: admin ? `<button type="button" class="btn btn-ligne" data-obj-ca>${objAn > 0 ? 'Modifier l’objectif' : 'Définir l’objectif'}</button>` : '' });
    const brancherObjectif = (el) => { const b = el.querySelector('[data-obj-ca]'); if (!b) return;
      b.addEventListener('click', () => {
        const mois = objCa.mois || {}; const def = objCa.defaut || '';
        v.fenetre(`Objectif de chiffre d’affaires ${an}`, `<div class="erp-ligne-f"><label for="erp-obj-def">Objectif mensuel (€ HT)</label><input id="erp-obj-def" type="number" min="0" step="100" value="${esc(def)}" placeholder="Ex. : 50000"></div>
          <p class="erp-gris">Un mois différent ? Saisissez-le ci-dessous (vide = objectif mensuel).</p>
          <div class="erp-obj-mois">${U.MOIS.map((l, m) => `<label><span>${esc(l)}</span><input type="number" min="0" step="100" data-obj-m="${m}" value="${esc(mois[cleMois(m)] ?? '')}" placeholder="${esc(def)}"></label>`).join('')}</div>
          <p class="erp-obj-tot">Objectif annuel ${an} : <b data-obj-tot></b></p>`,
          `<button type="button" class="btn btn-metal" data-obj-ok>${U.ico('valider')} Enregistrer</button><button type="button" class="btn btn-ligne" data-fermer>Annuler</button>`, (f) => {
            const d = f.querySelector('#erp-obj-def'); const ms = [...f.querySelectorAll('[data-obj-m]')];
            const total = () => { ms.forEach((i) => { i.placeholder = d.value; }); f.querySelector('[data-obj-tot]').textContent = D.eurosRond(ms.reduce((s, i) => s + (i.value !== '' ? +i.value || 0 : +d.value || 0), 0)) + ' HT'; };
            f.addEventListener('input', total); total(); setTimeout(() => d.focus(), 30);
            f.querySelector('[data-obj-ok]').addEventListener('click', () => {
              db.objectifs = db.objectifs || {}; const o = (db.objectifs.ca = db.objectifs.ca || {}); o.defaut = Math.max(0, +d.value || 0); o.mois = o.mois || {};
              ms.forEach((i) => { const k = cleMois(+i.dataset.objM); if (i.value === '') delete o.mois[k]; else o.mois[k] = Math.max(0, +i.value || 0); });
              D.evt(db, `Objectif de chiffre d’affaires ${an} modifié : ${D.eurosRond(o.defaut)} HT par mois`); v.sauver(); v.fermer(); v.notifier('Objectif enregistré.'); v.rendre(); });
          });
      }); };
    const kpi = (ico, lib, val, sous, r) => `<button type="button" class="erp-kpi" data-aller="${r}"><span class="erp-kpi-ico">${U.ico(ico)}</span><span><small>${esc(lib)}</small><b>${val}</b>${sous ? `<em>${sous}</em>` : ''}</span></button>`;
    const valStock = D.valeurStock ? D.valeurStock(db) : { achat: 0, vente: 0 };
    const blocAn = `<div class="erp-kpis">
        ${kpi('commande', `Commandes clients ${an}`, D.nombre(nbVentes), `${cmdsAn.filter((c) => !c.avoir && (c.etat === 'livree' || c.facturee)).length} livrées / facturées`, 'cmd/liste/tous')}
        ${kpi('facture', `CA clients ${an}`, `${D.eurosRond(caAn)} HT`, nbVentes ? `panier moyen ${D.eurosRond(caAn / nbVentes)}` : '', 'cmd/stats')}
        ${kpi('produit', `Références vendues ${an}`, D.nombre(Object.keys(parProd).length), `${D.nombre(Object.values(parProd).reduce((s, x) => s + x.q, 0))} unités`, 'produits/stats')}
        ${kpi('stats', `Marge ${an}`, `${D.eurosRond(margeAn)}`, caAn ? `${D.nombre(Math.round((margeAn / caAn) * 1000) / 10)} % du CA${D.coefTxt(caAn, coutAn) ? ` · ${D.coefTxt(caAn, coutAn)}` : ''}` : '', 'cmd/stats')}
        ${kpi('stock', 'Valeur du stock', `${D.eurosRond(valStock.achat)} HT`, `au prix de revient · ${D.eurosRond(valStock.vente)} à la vente`, 'stocks/tous')}</div>
      <div class="erp-2col"><div class="erp-col">${U.bloc(`Top 3 des ventes ${an}`, top3.length ? `<ol class="erp-top3">${top3.map(([pid, x], i) => { const p = D.produit(db, pid) || { ref: '—', libelle: '' };
          return `<li data-aller="produits/fiche/${pid}/stats"><span class="erp-top3-rang">${i + 1}</span>${U.vignetteProduit(p, 44)}<span class="erp-top3-nom"><b>${esc(p.ref)}</b><small>${esc(p.libelle || p.modele || '')}</small></span><span class="erp-top3-ca"><b>${D.euros(x.ca)}</b><small>${D.nombre(x.q)} vendu${x.q > 1 ? 's' : ''} · marge ${D.eurosRond(x.marge)}${D.coefTxt(x.ca, x.ca - x.marge) ? ` · ${D.coefTxt(x.ca, x.ca - x.marge)}` : ''}</small></span></li>`; }).join('')}</ol>` : U.vide(`Aucune vente en ${an}.`), { ico: 'stats' })}</div>
        <div class="erp-col">${U.bloc(`Marge ${an} par mois`, `<div class="erp-marge-mois">${U.barres(margeMois.map((x) => Math.max(0, Math.round(x))), D.eurosRond, { cours: an === auj.slice(0, 4) ? moisCours : -1 })}</div>
          <p class="erp-gris erp-petit">Taux et coefficient de marge par mois : ${margeMois.map((x, m) => (caMois[m] ? `${U.MOIS[m]} ${Math.round((x / caMois[m]) * 100)} %${D.coefTxt(caMois[m], caMois[m] - x) ? ` (${D.coefTxt(caMois[m], caMois[m] - x)})` : ''}` : '')).filter(Boolean).join(' · ') || '—'}</p>`, { ico: 'stats', compte: D.eurosRond(margeAn) })}</div></div>`;
    const plusAnciennes = [...impayees].sort((a, b) => (a.echeance > b.echeance ? 1 : -1)).slice(0, 3);
    return { html: `${U.titrePage('⌂', 'Mon tableau de bord', null, U.choixPeriode('accueil', 'annee'))}
      ${blocObjectif}
      ${blocAn}
      <div class="erp-widgets">
        ${widget('✎', 'Propositions commerciales', [['À accepter | à refuser', ouvertes.length, 'prop/liste/ouvert'], ['Expirées', expirees.length, 'prop/liste/ouvert', true], ['À facturer', aFacturerP.length, 'prop/liste/signee']])}
        ${widget('▤', 'Commandes clients', [['Ouvertes', cmdOuv.length, 'cmd/liste/validee'], ['Livrées et à facturer', cmdAFact.length, 'cmd/liste/afacturer', true]])}
        ${widget('€', 'Factures', [['Impayées', impayees.length, 'fact/liste/impayee'], ['En retard', retard.length, 'fact/liste/retard', true]])}
        ${widget('⇩', 'Commandes fournisseurs', [['Brouillons à passer', achOuv.length, 'stocks/alerte'], ['En attente de réception', achAttente.length, 'achat/liste/commande']])}
        ${widget('stock', 'Stock', [['Produits sous le seuil d’alerte', sousAlerte.length, 'stocks/alerte', true]])}
        ${widget('◉', 'Prospection', [['Prospects à contacter', aContacter.length, 'tiers/liste/P']])}
      </div>
      <div class="erp-2col">
        <div class="erp-col">
          ${U.bloc('Les 3 dernières factures clients modifiées', D.miniDocs(db, 'fact', parModif(facts).slice(0, 3)), { droite: U.lien('fact/liste/tous', 'Toutes') })}
          ${U.bloc('Les 3 plus anciennes factures clients impayées', D.miniDocs(db, 'fact', plusAnciennes, { echeance: true, pied: `<tr><td colspan="3"><b>Total des impayés</b> (${impayees.length})</td><td class="nb"><b>${D.euros(totalImp)}</b> TTC</td><td></td></tr>` }), { droite: U.lien('fact/liste/impayee', 'Toutes') })}
          ${U.bloc(`Commandes clients — ${per.lib}`, `<div class="erp-2graph"><div><h4>Nombre de commandes · ${sm.reduce((a, x) => a + x.n, 0)}</h4>${U.barresP(sm.map((x) => x.n), per)}</div><div><h4>Montant total HT · ${D.eurosRond(sm.reduce((a, x) => a + x.mt, 0))}</h4>${U.barresP(sm.map((x) => x.mt), per, U.court)}</div></div>`, { ico: 'stats', droite: U.lien('cmd/stats', 'Statistiques') })}
          ${U.bloc('Les 3 dernières commandes clients modifiées', D.miniDocs(db, 'cmd', parModif(cmds).slice(0, 3)), { droite: U.lien('cmd/liste/tous', 'Toutes') })}
          ${U.bloc('Les 3 dernières propositions commerciales modifiées', D.miniDocs(db, 'prop', parModif(props).slice(0, 3)), { droite: U.lien('prop/liste/tous', 'Toutes') })}
        </div>
        <div class="erp-col">
          ${U.bloc('Statistiques de la base', `<div class="erp-base">${base.map(([l, n, r, i]) => `<button type="button" data-aller="${r}"><span>${U.ico(i)}${esc(l)}</span><b>${n}</b></button>`).join('')}</div>`)}
          ${U.bloc('Clients dont l’encours autorisé est dépassé', U.table([['Client', (t) => esc(t.nom)], ['Encours', (t) => D.euros(D.encours(db, t.id)), 'nb'], ['Autorisé', (t) => D.euros(t.encours_max), 'nb']], encoursDep, { lien: (t) => `tiers/fiche/${t.id}/client`, vide: 'Aucun' }))}
          ${U.bloc('Commandes fournisseurs en attente de réception', D.miniDocs(db, 'achat', parDate(achAttente).slice(0, 5), { vide: 'Aucune commande en attente' }))}
          ${U.bloc(`Factures clients — ${per.lib}`, `<div class="erp-2graph"><div><h4>Nombre de factures · ${fm.reduce((a, x) => a + x.n, 0)}</h4>${U.barresP(fm.map((x) => x.n), per)}</div><div><h4>Montant HT · ${D.eurosRond(fm.reduce((a, x) => a + x.mt, 0))}</h4>${U.barresP(fm.map((x) => x.mt), per, U.court)}</div></div>`, { ico: 'stats' })}
          ${U.bloc(`Ventes par catégorie — ${per.lib}`, U.donut(ventesCat, U.court(ventesCat.reduce((s, x) => s + x.v, 0)), 'HT commandé', { fmt: D.eurosRond }))}
        </div>
      </div>`, apres: brancherObjectif };
  };

  // =====================================================================================================
  // TIERS
  const NATURES = { P: 'prospects', C: 'clients', F: 'fournisseurs' };
  const aNature = (t, n) => (n === 'P' ? t.prospect : n === 'C' ? t.client : n === 'F' ? t.fournisseur : true);
  P.tiers = (v, a) => {
    const [vue, x, y] = a;
    if (vue === 'liste') return listeTiers(v, x || 'tous');
    if (vue === 'nouveau') return formTiers(v, null, x);
    if (vue === 'modifier') return formTiers(v, D.tiers(v.db, x));
    if (vue === 'fiche') return ficheTiers(v, x, y || 'tiers');
    return espaceTiers(v);
  };

  function espaceTiers(v) {
    const db = v.db; const per = U.bornes(U.periode('tiers', 'tout'), db.tiers.map((x) => String(x.cree).slice(0, 4))); const t = db.tiers.filter((x) => per.dans(x.cree));
    const parts = [{ l: 'Prospects', v: t.filter((x) => x.prospect).length, c: U.COUL.c5, r: 'tiers/liste/P' }, { l: 'Clients', v: t.filter((x) => x.client).length, c: U.COUL.c2, r: 'tiers/liste/C' },
      { l: 'Fournisseurs', v: t.filter((x) => x.fournisseur).length, c: U.COUL.c3, r: 'tiers/liste/F' }, { l: 'Autres', v: t.filter((x) => !x.prospect && !x.client && !x.fournisseur).length, c: U.COUL.c4 }];
    return { html: `${U.titrePage('▣', 'Tiers / Contacts', null, U.btn('+ Nouveau tiers', '', 'btn-metal', 'data-aller="tiers/nouveau"'))}${U.choixPeriode('tiers', 'tout')}
      <div class="erp-2col"><div class="erp-col">${U.bloc(`Tiers créés — ${per.lib}`, U.donut(parts, t.length, 'tiers'), { ico: 'stats' })}${U.bloc(`Nouveaux tiers — ${per.lib}`, U.barresP(U.serie(t.map((x) => ({ date: String(x.cree).slice(0, 10), cree: x.cree, lignes: [] })), per).map((x) => x.n), per), { ico: 'stats' })}</div>
      <div class="erp-col">${U.bloc('Les 3 derniers tiers modifiés', U.table([['Nom', (o) => U.qui(o)], ['Nature', (o) => U.nature(o)], ['Ville', (o) => esc(o.ville)], ['Modifié', (o) => D.jour(o.modifie)]], parModif(t).slice(0, 3), { lien: (o) => `tiers/fiche/${o.id}` }), { droite: U.lien('tiers/liste/tous', 'Tous') })}
      ${U.bloc('Les 3 derniers contacts modifiés', U.table([['Contact', (k) => `${esc(k.prenom)} ${esc(k.nom)}`], ['Tiers', (k) => U.qui(D.tiers(db, k.tiers), '', 22)], ['Poste', (k) => esc(k.poste)]], parModif(db.contacts).slice(0, 3), { lien: (k) => `contacts/fiche/${k.id}` }), { droite: U.lien('contacts/liste/tous', 'Tous') })}</div></div>` };
  }

  // Colonnes de la liste des tiers (tableau et cartes). Aussi utilisées par la carte de la messagerie (D.carteTiers).
  function colsTiers(nat) {
    return [
      { t: 'Nom du tiers', v: (t) => U.qui(t, esc(t.alt || ''), 32), txt: (t) => t.nom + ' ' + t.alt },
      nat === 'F' ? { t: 'Code fournisseur', v: (t) => esc(t.code_fourn), txt: (t) => t.code_fourn } : { t: 'Code client', v: (t) => esc(t.code_client || '—'), txt: (t) => t.code_client },
      nat === 'F' ? { t: 'Compte comptable', v: (t) => esc(t.compta_fourn) } : null,
      { t: 'Commercial', v: (t) => esc(t.commercial), txt: (t) => t.commercial },
      { t: 'Code postal', v: (t) => esc(t.cp), txt: (t) => t.cp }, { t: 'Ville', v: (t) => esc(t.ville), txt: (t) => t.ville },
      nat === 'F' ? { t: 'Pays', v: (t) => esc(t.pays || 'France'), txt: (t) => t.pays || 'France' } : null,
      nat === 'F' ? { t: 'TVA à l’achat', v: (t) => `<span title="${esc(D.raisonTvaAchat(t))}">${D.horsFrance(t) ? '0 % · autoliquidation' : '20 %'}</span>`, txt: (t) => (D.horsFrance(t) ? '0 %' : '20 %') } : null,
      nat === 'F' ? null : { t: 'Type', v: (t) => esc(t.type), txt: (t) => t.type },
      { t: 'Téléphone', v: (t) => esc(t.tel), txt: (t) => t.tel },
      nat === 'P' ? { t: 'Potentiel', v: (t) => esc(D.POTENTIELS[t.potentiel] || '—') } : null,
      nat === 'P' ? { t: 'Statut prospection', v: (t) => `<select data-statut="${t.id}" aria-label="Statut de prospection">${D.STATUTS_PROSPECT.map(([id, l]) => `<option value="${id}"${id === t.statut_prospect ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>` } : null,
      { t: 'Nature', v: (t) => U.nature(t) },
      { t: 'État', v: () => '<span class="pastille st-ok">Ouvert</span>' },
    ].filter(Boolean);
  }
  D.carteTiers = (db, t) => (t ? U.carte(colsTiers(t.fournisseur && !t.client ? 'F' : 'tous'), t, '', false) : '');
  function listeTiers(v, nat) {
    const db = v.db;
    const titre = nat === 'P' ? 'Prospects' : nat === 'C' ? 'Clients' : nat === 'F' ? 'Fournisseurs' : 'Tiers';
    const lignes = [...db.tiers].filter((t) => aNature(t, nat)).sort((a, b) => a.nom.localeCompare(b.nom));
    const cols = colsTiers(nat);
    const nouv = nat === 'tous' ? 'tiers/nouveau' : `tiers/nouveau/${nat}`;
    return { html: `${U.titrePage('▣', titre, lignes.length, U.btn('+ Nouveau', '', 'btn-metal', `data-aller="${nouv}"`))}<div data-liste></div>`,
      apres: (el) => {
        U.liste(el.querySelector('[data-liste]'), { cols, lignes, lien: (t) => `tiers/fiche/${t.id}` });
        el.addEventListener('change', (e) => { const s = e.target.closest('[data-statut]'); if (!s) return; const t = D.tiers(db, s.dataset.statut); t.statut_prospect = s.value; D.toucher(t);
          D.evt(db, `Statut de prospection de ${t.nom} : ${D.STATUTS_PROSPECT.find((x) => x[0] === s.value)[1]}`, { tiers: t.id, objet: { type: 'tiers', id: t.id } }); v.sauver(); });
      } };
  }

  function formTiers(v, t, nat) {
    const db = v.db; const neuf = !t;
    t = t || { nom: '', alt: '', prospect: nat === 'P' || !nat, client: nat === 'C', fournisseur: nat === 'F', adresse: '', cp: '', ville: '', pays: 'France', tel: '', portable: '', fax: '', web: '', email: '', pas_mail: false,
      siren: '', siret: '', naf: '', rcs: '', tva_num: '', assujetti: true, type: 'TPE', effectif: '', commercial: D.MOI, statut_prospect: 'jamais', potentiel: 0, niveau: 1, remise: 0, cond: '30 jours', mode: 'Virement', encours_max: 0, tags: [] };
    const titre = neuf ? `Nouveau tiers (${nat === 'P' ? 'prospect' : nat === 'C' ? 'client' : nat === 'F' ? 'fournisseur' : 'prospect, client, fournisseur'})` : `Modifier ${t.nom}`;
    const corps = `
      <h3 class="erp-sous-titre">${U.ico('image')} Logo</h3>
      <div class="erp-logo-choix"><div data-logo-apercu>${U.avatar({ ...t, id: t.id || 'nouveau', nom: t.nom || 'Nouveau' }, 72)}</div>
        <div><p class="erp-gris">Le logo apparaît sur la fiche, dans les listes et à chaque étape (devis, commande, facture) : un lien (URL) ou une image de l’ordinateur.</p>
        <div class="erp-actions gauche">${U.btn(t.logo ? 'Changer le logo' : 'Ajouter un logo', 'logo', 'btn-ligne')}</div></div></div>
      <h3 class="erp-sous-titre">${U.ico('tiers')} Identité</h3>
      ${U.ligne('Nom du tiers', U.inp('nom', t.nom, { req: true }), { req: true })}
      ${U.ligne('Nom alternatif', U.inp('alt', t.alt, { ph: 'Nom commercial, marque…' }))}
      ${U.ligne('Nature', `${U.coche('prospect', t.prospect, 'Prospect')} ${U.coche('client', t.client, 'Client')} ${U.coche('fournisseur', t.fournisseur, 'Fournisseur')}`)}
      ${U.ligne('Code client', `<input value="${esc(t.code_client || 'Attribué automatiquement')}" readonly>`)}
      ${U.ligne('Code fournisseur', `<input value="${esc(t.code_fourn || 'Attribué automatiquement')}" readonly>`)}
      <h3 class="erp-sous-titre">${U.ico('lieu')} Coordonnées</h3>
      ${U.ligne('Adresse', U.area('adresse', t.adresse, 2), { large: true })}
      <div class="erp-2f">${U.ligne('Code postal', U.inp('cp', t.cp))}${U.ligne('Ville', U.inp('ville', t.ville))}</div>
      <div class="erp-2f">${U.ligne('Département', U.inp('departement', t.departement || ''))}${U.ligne('Région', U.inp('region', t.region || ''))}</div>
      ${U.ligne('Pays', U.sel('pays', [...new Set([...D.PAYS, ...(t.pays ? [t.pays] : [])])], t.pays))}
      <div class="erp-2f">${U.ligne('Téléphone', U.inp('tel', t.tel, { type: 'tel' }))}${U.ligne('Tél. portable', U.inp('portable', t.portable, { type: 'tel' }))}</div>
      <div class="erp-2f">${U.ligne('E-mail', U.inp('email', t.email, { type: 'email' }))}${U.ligne('Site web', U.inp('web', t.web))}</div>
      ${U.ligne('Refuser les e-mails de masse', U.sel('pas_mail', [['', 'Non'], ['1', 'Oui']], t.pas_mail ? '1' : ''))}
      <h3 class="erp-sous-titre">${U.ico('note')} Identifiants professionnels</h3>
      <div class="erp-2f">${U.ligne('SIREN', U.inp('siren', t.siren))}${U.ligne('SIRET', U.inp('siret', t.siret))}</div>
      <div class="erp-2f">${U.ligne('NAF-APE', U.inp('naf', t.naf))}${U.ligne('RCS/RM', U.inp('rcs', t.rcs))}</div>
      <div class="erp-2f">${U.ligne('Forme juridique', U.inp('forme_juridique', t.forme_juridique || '', { ph: 'SARL, SAS…' }))}${U.ligne('Capital (€)', U.inp('capital', t.capital || '', { type: 'number', min: 0 }))}</div>
      <div class="erp-2f">${U.ligne('Maison mère', U.inp('maison_mere', t.maison_mere || ''))}${U.ligne('EORI', U.inp('eori', t.eori || ''))}</div>
      <div class="erp-2f">${U.ligne('Assujetti à la TVA', U.sel('assujetti', [['1', 'Oui'], ['', 'Non']], t.assujetti ? '1' : ''))}${U.ligne('Numéro de TVA', U.inp('tva_num', t.tva_num, { ph: 'FR…' }))}</div>
      <div data-suivi-client>
      <h3 class="erp-sous-titre">${U.ico('euro')} Suivi commercial</h3>
      <div class="erp-2f">${U.ligne('Type du tiers', U.sel('type', D.TYPES_TIERS, t.type))}${U.ligne('Effectif', U.sel('effectif', ['', '1-5', '6-10', '11-50', '51-100', '100+'], t.effectif))}</div>
      <div class="erp-2f">${U.ligne('Commercial', U.sel('commercial', D.COMMERCIAUX, t.commercial))}${U.ligne('Tags/catégories', U.inp('tags', (t.tags || []).join(', '), { ph: 'Ex. : chantier, VIP' }))}</div>
      <div class="erp-2f">${U.ligne('Statut de prospection', U.sel('statut_prospect', D.STATUTS_PROSPECT, t.statut_prospect))}${U.ligne('Potentiel', U.sel('potentiel', D.POTENTIELS.map((l, i) => [i, l || '—']), t.potentiel))}</div>
      <div class="erp-2f">${U.ligne('Remise client (%)', U.inp('remise', t.remise, { type: 'number', step: '0.5', min: 0 }), { aide: 'Appliquée sur le prix net ; compte comme une réduction (commission 12 %).' })}</div>
      <div class="erp-2f">${U.ligne('Conditions de règlement', U.sel('cond', D.CONDITIONS, t.cond))}${U.ligne('Mode de règlement', U.sel('mode', D.MODES, t.mode))}</div>
      ${U.ligne('Encours autorisé (€)', U.inp('encours_max', t.encours_max, { type: 'number', min: 0 }))}</div>
      <div data-suivi-fourn>
      <h3 class="erp-sous-titre">${U.ico('camion')} Suivi commercial fournisseur</h3>
      <div class="erp-2f">${U.ligne('Délai de livraison (jours)', U.inp('delai_livraison', t.delai_livraison || '', { type: 'number', min: 0, ph: 'Ex. : 3' }))}${U.ligne('Franco (€ HT)', U.inp('franco', t.franco || '', { type: 'number', min: 0, step: '0.01', ph: 'Ex. : 300' }), { aide: 'Montant de commande à partir duquel le port est offert.' })}</div>
      <div class="erp-2f">${U.ligne('Conditions de règlement', U.sel('cond_fourn', D.CONDITIONS, t.cond_fourn || t.cond))}${U.ligne('Encours autorisé (€)', U.inp('encours_fourn_max', t.encours_fourn_max || '', { type: 'number', min: 0 }), { aide: neuf ? '' : `Encours restant = encours autorisé − factures non payées (${D.euros(D.encoursFourn(db, t.id))} actuellement).` })}</div>
      </div>`;
    return { html: `${U.titrePage('▣', titre)}${U.form('erp-f', corps, `${U.btn(neuf ? 'Créer le tiers' : 'Enregistrer', 'ok', 'btn-metal', 'type="submit"')}${U.btn('Annuler', 'annuler', 'btn-ligne', `data-aller="${neuf ? 'tiers/liste/tous' : 'tiers/fiche/' + t.id}"`)}`)}`,
      apres: (el) => { const form = el.querySelector('#erp-f'); let logo = t.logo || '';
        const majApercu = () => { el.querySelector('[data-logo-apercu]').innerHTML = U.avatar({ ...t, logo, id: t.id || 'nouveau', nom: form.nom.value || t.nom || 'Nouveau' }, 72); };
        el.querySelector('[data-act="logo"]').addEventListener('click', () => U.choisirImage(v, { titre: 'Logo', actuelle: logo, apercu: (x) => U.avatar({ ...t, logo: x, id: t.id || 'nouveau', nom: form.nom.value || t.nom || 'Nouveau' }, 120) }, (x) => { logo = x; majApercu(); }));
        form.nom.addEventListener('input', () => { if (!logo) majApercu(); });
        // Fournisseur seul : uniquement délai de livraison, franco, conditions de règlement, encours (demande du 19 nov. 2026).
        const natures = () => { const cli = form.prospect.checked || form.client.checked; const fo = form.fournisseur.checked;
          el.querySelector('[data-suivi-client]').hidden = fo && !cli; el.querySelector('[data-suivi-fourn]').hidden = !fo; };
        ['prospect', 'client', 'fournisseur'].forEach((n) => form[n].addEventListener('change', natures)); natures();
        form.addEventListener('submit', (e) => {
        e.preventDefault(); const f = U.lire(e.target);
        if (!f.prospect && !f.client && !f.fournisseur) f.prospect = true;
        const o = neuf ? { id: D.id('t'), contacts: [], comptes: [], note_pub: '', note_priv: '', etat: 'ouvert', cree: D.maintenant(), code_client: '', code_fourn: '', compta_client: '', compta_fourn: '' } : t;
        Object.assign(o, { nom: f.nom, alt: f.alt, prospect: f.prospect && !f.client, client: f.client, fournisseur: f.fournisseur, adresse: f.adresse, cp: f.cp, ville: f.ville, pays: f.pays, tel: f.tel, portable: f.portable,
          email: f.email, web: f.web, pas_mail: f.pas_mail === '1', siren: f.siren, siret: f.siret, naf: f.naf, rcs: f.rcs, assujetti: f.assujetti === '1', tva_num: f.tva_num, type: f.type, effectif: f.effectif,
          commercial: f.commercial, tags: f.tags ? f.tags.split(',').map((s) => s.trim()).filter(Boolean) : [], statut_prospect: f.statut_prospect, potentiel: +f.potentiel || 0, niveau: +f.niveau || 1, remise: +f.remise || 0,
          cond: f.cond, mode: f.mode, encours_max: +f.encours_max || 0, logo, delai_livraison: +f.delai_livraison || 0, franco: +f.franco || 0, cond_fourn: f.cond_fourn, encours_fourn_max: +f.encours_fourn_max || 0, forme_juridique: f.forme_juridique, capital: +f.capital || 0, maison_mere: f.maison_mere, eori: f.eori, departement: f.departement, region: f.region });
        if ((o.client || o.prospect) && !o.code_client) { o.code_client = D.prochaineRef(db, 'cu'); o.compta_client = '411' + o.nom.normalize('NFD').replace(/[^A-Za-z]/g, '').slice(0, 5).toUpperCase(); }
        if (o.fournisseur && !o.code_fourn) { o.code_fourn = D.prochaineRef(db, 'su'); o.compta_fourn = '401' + o.nom.normalize('NFD').replace(/[^A-Za-z]/g, '').slice(0, 5).toUpperCase(); }
        D.toucher(o);
        if (neuf) { db.tiers.push(o); D.evt(db, `Tiers ${o.nom} créé`, { tiers: o.id, objet: { type: 'tiers', id: o.id } }); } else D.evt(db, `Tiers ${o.nom} modifié`, { tiers: o.id, objet: { type: 'tiers', id: o.id } });
        v.sauver(); if (neuf) signalerTiers(o); v.notifier(neuf ? `${o.nom} créé.` : 'Modifications enregistrées.'); v.aller(`tiers/fiche/${o.id}`);
      }); } };
  }

  function ficheTiers(v, id, onglet) {
    const db = v.db; const t = D.tiers(db, id);
    if (!t) return { html: `<div class="erp-vide-page"><h1>Tiers introuvable</h1>${U.lien('tiers/liste/tous', 'Retour à la liste')}</div>` };
    const contacts = db.contacts.filter((k) => k.tiers === id);
    const evts = db.evenements.filter((e) => e.tiers === id);
    const onglets = [['tiers', 'Tiers'], ['contacts', 'Contacts/Adresses', contacts.length], (t.client || t.prospect) && ['client', t.client ? 'Client' : 'Prospect'], t.fournisseur && ['fournisseur', 'Fournisseur'],
      (t.client || t.prospect) && ['prix', 'Prix clients', db.prixClients.filter((x) => x.tiers === id).length], ['reglement', 'Modes de règlement'], ['notes', 'Notes', (t.note_pub || t.note_priv) ? 1 : 0], ['evenements', 'Événements/Agenda', evts.length]].filter(Boolean);
    if (!onglets.some((o) => o[0] === onglet)) onglet = 'tiers';
    const nat = t.client ? 'C' : t.prospect ? 'P' : 'F';
    const vois = U.voisins([...db.tiers].filter((x) => aNature(x, nat)).sort((a, b) => a.nom.localeCompare(b.nom)), id, (o) => `tiers/fiche/${o.id}/${onglet}`);
    const tete = U.fiche({ ico: U.avatar(t, 64), logo: !!t.logo, vignetteAct: 'logo-fiche', titre: esc(t.nom), sous: `<p class="erp-gris">${U.ico('lieu')} ${esc([t.adresse, [t.cp, t.ville].filter(Boolean).join(' '), t.pays].filter(Boolean).join(', '))}</p><p class="erp-gris">${t.tel ? `${U.ico('telephone')} ${esc(t.tel)} &nbsp; ` : ''}${t.email ? `${U.ico('email')} ${esc(t.email)}` : ''}</p>`,
      pastilles: `${U.nature(t)} <span class="pastille st-ok">Ouvert</span>`, retour: `tiers/liste/${nat}`, ...vois, onglets, actif: onglet, base: `tiers/fiche/${id}` });
    let corps = '', apres = null;
    const docsDe = (l) => parDate(l.filter((d) => d.tiers === id));
    if (onglet === 'tiers') {
      corps = `<div class="erp-carte erp-2c">${U.infos([['Nature de tiers', U.nature(t)], ['Code client', esc(t.code_client)], t.fournisseur && ['Code fournisseur', esc(t.code_fourn)], ['SIREN', esc(t.siren)], ['SIRET', esc(t.siret)], ['NAF-APE', esc(t.naf)], ['RCS/RM', esc(t.rcs)], ['Assujetti à la TVA', t.assujetti ? 'Oui' : 'Non'], ['Numéro de TVA', esc(t.tva_num)], t.fournisseur && ['TVA à l’achat', esc(D.raisonTvaAchat(t))], t.forme_juridique && ['Forme juridique', esc(t.forme_juridique)], t.capital && ['Capital', D.eurosRond(t.capital)], t.maison_mere && ['Maison mère', esc(t.maison_mere)], t.eori && ['EORI', esc(t.eori)], (t.departement || t.region) && ['Département / région', esc([t.departement, t.region].filter(Boolean).join(' · '))]].filter(Boolean))}
        ${U.infos([['Téléphone', esc(t.tel)], ['Tél. portable', esc(t.portable)], ['Site web', esc(t.web)], ['Tags/catégories', (t.tags || []).map((x) => `<span class="pastille">${esc(x)}</span>`).join(' ')], ['Type du tiers', esc(t.type)], ['Effectif', esc(t.effectif)], ['Refuser les e-mails de masse', t.pas_mail ? 'Oui' : 'Non'], ['Commercial', esc(t.commercial)], ['Créé le', D.jour(t.cree)]])}</div>
        ${U.boutons([t.email ? `<a class="btn petit btn-ligne" href="mailto:${esc(t.email)}">Envoyer un e-mail</a>` : '', U.btn('Modifier', '', 'btn-metal', `data-aller="tiers/modifier/${id}"`), U.btn('Cloner', 'cloner', 'btn-ligne'), U.btn('Supprimer', 'supprimer', 'btn-ligne erp-danger')])}
        <div class="erp-2col"><div class="erp-col">${U.bloc('Contacts', U.table([['Nom', (k) => `${esc(k.prenom)} ${esc(k.nom)}`], ['Poste', (k) => esc(k.poste)], ['Téléphone', (k) => esc(k.portable || k.tel_pro)]], contacts, { lien: (k) => `contacts/fiche/${k.id}`, vide: 'Aucun contact' }))}</div>
        <div class="erp-col">${U.bloc('Les 10 derniers événements', U.derniersEvt(evts), { droite: U.lien(`tiers/fiche/${id}/evenements`, 'Tous') })}</div></div>`;
      apres = (el) => el.addEventListener('click', (e) => {
        const b = e.target.closest('[data-act]'); if (!b) return;
        if (b.dataset.act === 'cloner') { const c = { ...JSON.parse(JSON.stringify(t)), id: D.id('t'), nom: t.nom + ' (copie)', code_client: '', code_fourn: '', cree: D.maintenant() };
          if (c.client || c.prospect) c.code_client = D.prochaineRef(db, 'cu'); if (c.fournisseur) c.code_fourn = D.prochaineRef(db, 'su'); D.toucher(c); db.tiers.push(c); D.evt(db, `Tiers ${c.nom} créé (copie de ${t.nom})`, { tiers: c.id }); v.sauver(); signalerTiers(c); v.aller(`tiers/modifier/${c.id}`); }
        if (b.dataset.act === 'supprimer') {
          const lies = [db.propositions, db.commandes, db.factures, db.achats].reduce((s, l) => s + l.filter((d) => d.tiers === id).length, 0);
          if (lies) { v.fenetre('Suppression impossible', `<p>${esc(t.nom)} a ${lies} document(s) (propositions, commandes, factures…). Un tiers avec des documents ne peut pas être supprimé.</p>`, '<button type="button" class="btn btn-metal" data-fermer>Compris</button>'); return; }
          v.confirmer(`Supprimer ${t.nom} ?`, 'Le tiers et ses contacts seront supprimés. Cette action ne peut pas être annulée.', 'Supprimer', () => {
            db.tiers = db.tiers.filter((x) => x.id !== id); db.contacts = db.contacts.filter((k) => k.tiers !== id); db.prixClients = db.prixClients.filter((x) => x.tiers !== id);
            db.produits.forEach((p) => { if ((p.fournisseurs || []).some((f) => f.tiers === id)) { p.fournisseurs = p.fournisseurs.filter((f) => f.tiers !== id); D.toucher(p); } }); /* ses prix d’achat partent avec lui */ v.sauver(); v.aller(`tiers/liste/${nat}`); });
        }
      });
    } else if (onglet === 'contacts') {
      corps = `${U.boutons([U.btn('+ Nouveau contact', '', 'btn-metal', `data-aller="contacts/nouveau/${id}"`)])}
        ${U.bloc('Contacts/Adresses', U.table([['Nom', (k) => `<b>${esc(k.prenom)} ${esc(k.nom)}</b>${k.defaut ? ' <span class="pastille">Par défaut</span>' : ''}`], ['Poste/fonction', (k) => esc(k.poste)], ['Tél. pro', (k) => esc(k.tel_pro)], ['Portable', (k) => esc(k.portable)], ['E-mail', (k) => esc(k.email)]], contacts, { lien: (k) => `contacts/fiche/${k.id}`, vide: 'Aucun contact' }))}`;
    } else if (onglet === 'client') {
      const props = docsDe(db.propositions), cmds = docsDe(db.commandes), facts = docsDe(db.factures);
      const enc = D.encours(db, id), imp = facts.filter((f) => !f.payee && f.echeance < D.auj()).reduce((s, f) => s + D.ttc(f), 0);
      const compteur = (l, val, rouge, r) => `<button type="button" class="erp-compteur" data-aller="${r}"><span>${esc(l)}</span><b class="${rouge && val ? 'rouge' : ''}">${D.euros(val)}</b></button>`;
      corps = `<div class="erp-carte erp-2c"><div>${U.infos([['Code client', esc(t.code_client)], ['Code comptable client', esc(t.compta_client)], ['Numéro de TVA', esc(t.tva_num)], ['Conditions de règlement', esc(t.cond)], ['Mode de règlement', esc(t.mode)],
          ['Remise relative', t.remise ? `${t.remise} %` : 'Aucune'], ['Encours autorisé', t.encours_max ? D.euros(t.encours_max) : '—'], ['Commercial', esc(t.commercial)],
          t.prospect && ['Statut de prospection', esc((D.STATUTS_PROSPECT.find((x) => x[0] === t.statut_prospect) || [])[1] || '—')], t.prospect && ['Potentiel', esc(D.POTENTIELS[t.potentiel] || '—')]])}
          ${U.boutons([U.btn('Modifier les conditions', '', 'btn-ligne', `data-aller="tiers/modifier/${id}"`), t.prospect ? U.btn('Transformer en client', 'client', 'btn-metal') : ''])}</div>
        <div><div class="erp-compteurs">${compteur('Propositions', props.filter((p) => p.etat === 'ouvert').reduce((s, p) => s + D.ht(p), 0), false, 'prop/liste/ouvert')}${compteur('Commandes', cmds.filter((c) => c.etat !== 'annulee').reduce((s, c) => s + D.ht(c), 0), false, 'cmd/liste/tous')}
          ${compteur('Factures', facts.reduce((s, f) => s + D.ht(f), 0), false, 'fact/liste/tous')}${compteur('Encours total', enc, true, 'encours/liste/tous')}${compteur('Montant impayé', imp, true, 'fact/liste/retard')}</div>
          ${D.blocEncours ? D.blocEncours(db, t) : ''}
          ${U.bloc('Les 3 dernières propositions', D.miniDocs(db, 'prop', props.slice(0, 3), { sansTiers: true }), { compte: props.length })}
          ${U.bloc('Les 3 dernières commandes', D.miniDocs(db, 'cmd', cmds.slice(0, 3), { sansTiers: true }), { compte: cmds.length })}
          ${U.bloc('Les 3 dernières factures', D.miniDocs(db, 'fact', facts.slice(0, 3), { sansTiers: true, echeance: true }), { compte: facts.length })}</div></div>
        ${U.boutons([U.btn('Créer une proposition', '', 'btn-metal', `data-aller="prop/nouveau/${id}"`), U.btn('Créer une commande', '', 'btn-metal', `data-aller="cmd/nouveau/${id}"`)])}`;
      apres = (el) => el.querySelector('[data-act="client"]')?.addEventListener('click', () => { t.prospect = false; t.client = true; t.statut_prospect = 'fait'; D.toucher(t); D.evt(db, `${t.nom} est maintenant client`, { tiers: id }); v.sauver(); v.rendre(); });
    } else if (onglet === 'fournisseur') {
      const ach = docsDe(db.achats); const prods = db.produits.filter((p) => (p.fournisseurs || []).some((x) => x.tiers === id));
      const encU = D.encoursFourn(db, id); const encM = +t.encours_fourn_max || 0;
      corps = `<div class="erp-carte erp-2c">${U.infos([['Code fournisseur', esc(t.code_fourn)], ['Code comptable fournisseur', esc(t.compta_fourn)], ['Délai de livraison', t.delai_livraison ? `${t.delai_livraison} jour${t.delai_livraison > 1 ? 's' : ''}` : '—'], ['Franco', t.franco ? `${D.euros(t.franco)} HT` : '—'], ['Conditions de règlement', esc(t.cond_fourn || t.cond)], ['Encours autorisé', encM ? D.euros(encM) : '—'], ['Factures non payées', D.euros(encU)], encM ? ['Encours restant', `<b class="${encM - encU < 0 ? 'erp-moins' : 'erp-plus'}">${D.euros(encM - encU)}</b>`] : null].filter(Boolean))}
        ${U.infos([['Commandes passées', String(ach.filter((a) => a.etat !== 'brouillon').length)], ['Montant commandé', D.euros(ach.filter((a) => !['brouillon', 'annule', 'refuse'].includes(a.etat)).reduce((s, a) => s + D.ht(a), 0))], ['Produits référencés', String(prods.length)]])}</div>
        ${U.boutons([U.btn('Créer une commande fournisseur', '', 'btn-metal', `data-aller="achat/nouveau/${id}"`)])}
        <div class="erp-2col"><div class="erp-col">${U.bloc('Les dernières commandes fournisseurs', D.miniDocs(db, 'achat', ach.slice(0, 5), { sansTiers: true }), { compte: ach.length })}</div>
        <div class="erp-col">${U.bloc('Produits achetés chez ce fournisseur', U.table([['Image', (p) => U.vignetteProduit(p, 40), 'erp-col-img'], ['Réf.', (p) => esc(p.ref)], ['Libellé', (p) => esc(p.libelle)], ['Prix d’achat HT', (p) => D.euros(p.fournisseurs.find((x) => x.tiers === id).pu), 'nb']], prods, { lien: (p) => `produits/fiche/${p.id}/achat`, vide: 'Aucun produit' }))}</div></div>`;
    } else if (onglet === 'prix') {
      const px = db.prixClients.filter((x) => x.tiers === id);
      corps = `${U.bloc('Prix différents pour ce client', `<p class="erp-gris">Ces prix remplacent le prix net dans les propositions et les commandes de ce client (prix plus bas = réduction).</p>
        ${U.table([['Image', (x) => { const p = D.produit(db, x.produit); return p ? U.vignetteProduit(p, 40) : ''; }, 'erp-col-img'], ['Produit', (x) => { const p = D.produit(db, x.produit); return p ? `<b>${esc(p.ref)}</b> ${esc(p.libelle)}` : '—'; }], ['Prix du niveau', (x) => { const p = D.produit(db, x.produit); return p ? D.euros(p.prix[t.niveau - 1]) : '—'; }, 'nb'], ['Prix client HT', (x) => `<b>${D.euros(x.pu)}</b>`, 'nb'], ['Depuis', (x) => D.jour(x.depuis)], ['', (x) => `<button type="button" class="btn-icone" data-suppr="${x.id}" data-stop title="Supprimer ce prix">✕</button>`]], px, { vide: 'Aucun prix particulier' })}
        <form class="erp-form-ligne" id="erp-px"><select name="produit" required data-source="produits"><option value="">Choisir un produit…</option>${db.produits.slice(0, 150).map((p) => `<option value="${p.id}">${esc(p.ref)} — ${esc(p.libelle)} (${D.euros(p.prix[t.niveau - 1])})</option>`).join('')}</select>
          <input name="pu" type="number" step="0.01" min="0" placeholder="Prix HT" required aria-label="Prix client HT"><button type="submit" class="btn petit btn-metal">Ajouter le prix</button></form>`)}`;
      apres = (el) => {
        el.querySelector('#erp-px').addEventListener('submit', (e) => { e.preventDefault(); const f = U.lire(e.target); db.prixClients = db.prixClients.filter((x) => !(x.tiers === id && x.produit === f.produit));
          db.prixClients.push({ id: D.id('px'), tiers: id, produit: f.produit, pu: +f.pu, depuis: D.auj(), par: D.MOI }); D.evt(db, `Prix client ajouté pour ${D.produit(db, f.produit).ref} : ${D.euros(+f.pu)} HT`, { tiers: id }); v.sauver(); v.rendre(); });
        el.addEventListener('click', (e) => { const b = e.target.closest('[data-suppr]'); if (b) { db.prixClients = db.prixClients.filter((x) => x.id !== b.dataset.suppr); v.sauver(); v.rendre(); } });
      };
    } else if (onglet === 'reglement') {
      const comptes = t.comptes || (t.comptes = []);
      corps = `<div class="erp-carte">${U.infos([['Conditions de règlement', esc(t.cond)], ['Mode de règlement', esc(t.mode)]])}</div>
        ${U.bloc('Comptes bancaires', `${U.table([['Libellé', (c) => esc(c.libelle)], ['IBAN', (c) => esc(c.iban)], ['BIC/SWIFT', (c) => esc(c.bic)], ['Mandat (RUM)', (c) => esc(c.rum || '—')], ['Par défaut', (c) => (c.defaut ? 'Oui' : '')], ['', (c, i) => `<button type="button" class="btn-icone" data-suppr="${esc(c.iban)}" title="Supprimer ce compte">✕</button>`]], comptes, { vide: 'Aucun compte bancaire enregistré' })}
          <form class="erp-form-ligne" id="erp-cb"><input name="libelle" placeholder="Libellé" required aria-label="Libellé"><input name="iban" placeholder="IBAN" required aria-label="IBAN"><input name="bic" placeholder="BIC" aria-label="BIC"><input name="rum" placeholder="RUM (mandat)" aria-label="RUM"><button type="submit" class="btn petit btn-metal">Ajouter</button></form>`)}`;
      apres = (el) => {
        el.querySelector('#erp-cb').addEventListener('submit', (e) => { e.preventDefault(); const f = U.lire(e.target); comptes.push({ libelle: f.libelle, iban: f.iban.toUpperCase(), bic: f.bic.toUpperCase(), rum: f.rum, defaut: !comptes.length }); D.toucher(t); v.sauver(); v.rendre(); });
        el.addEventListener('click', (e) => { const b = e.target.closest('[data-suppr]'); if (b) { t.comptes = comptes.filter((c) => c.iban !== b.dataset.suppr); v.sauver(); v.rendre(); } });
      };
    } else if (onglet === 'notes') {
      corps = `<form class="erp-carte erp-notes" id="erp-notes"><label>Note (publique)<textarea name="note_pub" rows="5">${esc(t.note_pub)}</textarea></label><label>Note (privée)<textarea name="note_priv" rows="8">${esc(t.note_priv)}</textarea></label><div>${U.btn('Enregistrer les notes', 'ok', 'btn-metal', 'type="submit"')}</div></form>`;
      apres = (el) => el.querySelector('#erp-notes').addEventListener('submit', (e) => { e.preventDefault(); const f = U.lire(e.target); t.note_pub = f.note_pub; t.note_priv = f.note_priv; D.toucher(t); v.sauver(); v.notifier('Notes enregistrées.'); v.rendre(); });
    } else if (onglet === 'evenements') {
      corps = `<div class="erp-carte">${U.infos([['Création', `${esc(t.commercial)} — ${D.jour(t.cree)}`], ['Dernière modification', D.jour(t.modifie)]])}</div>
        ${U.bloc('Événements sur ce tiers', `<form class="erp-form-ligne" id="erp-ev"><select name="type" aria-label="Type d’événement">${['Appel', 'Rendez-vous', 'E-mail', 'Visite', 'Note'].map((x) => `<option>${x}</option>`).join('')}</select><input name="titre" placeholder="Titre (ex. : appel pour relance du devis)" required aria-label="Titre"><input name="texte" placeholder="Détail (facultatif)" aria-label="Détail"><button type="submit" class="btn petit btn-metal">Ajouter</button></form>${U.chronologie(evts)}`, { compte: evts.length })}`;
      apres = (el) => el.querySelector('#erp-ev').addEventListener('submit', (e) => { e.preventDefault(); const f = U.lire(e.target); D.evt(db, `${f.type} : ${f.titre}`, { tiers: id, texte: f.texte, type: 'manuel' }); D.toucher(t); v.sauver(); v.rendre(); });
    }
    // Clic sur le logo (toutes les pages de la fiche) : choisir / changer le logo du tiers.
    const apresFiche = (el) => {
      if (apres) apres(el);
      const vg = el.querySelector('[data-act="logo-fiche"]'); if (!vg) return;
      const ouvrir = () => U.choisirImage(v, { titre: `Logo de ${t.nom}`, actuelle: t.logo, apercu: (x) => U.avatar({ ...t, logo: x }, 120) }, (x) => { t.logo = x; D.toucher(t); D.evt(db, `Logo de ${t.nom} ${x ? 'modifié' : 'retiré'}`, { tiers: id }); v.sauver(); v.rendre(); });
      vg.addEventListener('click', ouvrir); vg.addEventListener('keydown', (e) => { if (e.key === 'Enter') ouvrir(); });
    };
    return { html: tete + corps, apres: apresFiche };
  }

  // =====================================================================================================
  // CONTACTS
  P.contacts = (v, a) => {
    const db = v.db; const [vue, x] = a;
    if (vue === 'nouveau' || vue === 'fiche') {
      const k = vue === 'fiche' ? db.contacts.find((c) => c.id === x) : null;
      if (vue === 'fiche' && !k) return { html: `<div class="erp-vide-page"><h1>Contact introuvable</h1>${U.lien('contacts/liste/tous', 'Retour à la liste')}</div>` };
      const c = k || { tiers: x || '', civilite: '', prenom: '', nom: '', poste: '', adresse: '', cp: '', ville: '', tel_pro: '', tel_perso: '', portable: '', email: '', naissance: '', defaut: false };
      const corps = `${U.ligne('Nom / Libellé', U.inp('nom', c.nom, { req: true }), { req: true })}${U.ligne('Prénom', U.inp('prenom', c.prenom))}
        ${U.ligne('Tiers', U.sel('tiers', [...db.tiers].sort((p, q) => p.nom.localeCompare(q.nom)).map((t) => [t.id, t.nom]), c.tiers, { vide: '— Aucun —' }))}
        <div class="erp-2f">${U.ligne('Titre civilité', U.sel('civilite', ['', 'M.', 'Mme'], c.civilite))}${U.ligne('Poste/fonction', U.inp('poste', c.poste))}</div>
        ${U.ligne('Adresse', `${U.area('adresse', c.adresse || '', 2)}<label class="erp-coche"><input type="checkbox" data-remplir> Remplir avec l’adresse du tiers</label>`, { large: true })}
        <div class="erp-2f">${U.ligne('Code postal', U.inp('cp', c.cp || ''))}${U.ligne('Ville', U.inp('ville', c.ville || ''))}</div>
        <div class="erp-2f">${U.ligne('Tél. pro', U.inp('tel_pro', c.tel_pro, { type: 'tel' }))}${U.ligne('Tél. perso', U.inp('tel_perso', c.tel_perso, { type: 'tel' }))}</div>
        <div class="erp-2f">${U.ligne('Tél. portable', U.inp('portable', c.portable, { type: 'tel' }))}${U.ligne('E-mail', U.inp('email', c.email, { type: 'email' }))}</div>
        <div class="erp-2f">${U.ligne('Date de naissance', U.inp('naissance', c.naissance, { type: 'date' }))}${U.ligne('Contact par défaut du tiers', U.sel('defaut', [['', 'Non'], ['1', 'Oui']], c.defaut ? '1' : ''))}</div>`;
      return { html: `${U.titrePage('☺', k ? `${k.prenom} ${k.nom}` : 'Nouveau contact/adresse')}${U.form('erp-f', corps, `${U.btn(k ? 'Enregistrer' : 'Ajouter', 'ok', 'btn-metal', 'type="submit"')}${k ? U.btn('Supprimer', 'suppr', 'btn-ligne erp-danger') : ''}${U.btn('Annuler', '', 'btn-ligne', `data-aller="${c.tiers ? `tiers/fiche/${c.tiers}/contacts` : 'contacts/liste/tous'}"`)}`)}`,
        apres: (el) => {
          const f = el.querySelector('#erp-f');
          f.querySelector('[data-remplir]').addEventListener('change', (e) => { const t = D.tiers(db, f.tiers.value); if (e.target.checked && t) { f.adresse.value = t.adresse; f.cp.value = t.cp; f.ville.value = t.ville; } });
          f.querySelector('[data-act="suppr"]')?.addEventListener('click', () => v.confirmer('Supprimer ce contact ?', 'Cette action ne peut pas être annulée.', 'Supprimer', () => { db.contacts = db.contacts.filter((q) => q.id !== k.id); v.sauver(); v.aller(k.tiers ? `tiers/fiche/${k.tiers}/contacts` : 'contacts/liste/tous'); }));
          f.addEventListener('submit', (e) => { e.preventDefault(); const d = U.lire(f); const o = k || { id: D.id('k'), cree: D.maintenant() };
            Object.assign(o, { nom: d.nom, prenom: d.prenom, tiers: d.tiers, civilite: d.civilite, poste: d.poste, adresse: d.adresse, cp: d.cp, ville: d.ville, tel_pro: d.tel_pro, tel_perso: d.tel_perso, portable: d.portable, email: d.email, naissance: d.naissance, defaut: d.defaut === '1' });
            D.toucher(o); if (!k) { db.contacts.push(o); D.evt(db, `Contact ${o.prenom} ${o.nom} créé`, { tiers: o.tiers || null }); }
            v.sauver(); v.aller(o.tiers ? `tiers/fiche/${o.tiers}/contacts` : 'contacts/liste/tous'); });
        } };
    }
    const nat = x || 'tous';
    const lignes = db.contacts.filter((k) => { const t = D.tiers(db, k.tiers); return nat === 'tous' || (t && aNature(t, nat)); }).sort((p, q) => p.nom.localeCompare(q.nom));
    const cols = [{ t: 'Nom', v: (k) => `<b>${esc(k.nom)}</b> ${esc(k.prenom)}`, txt: (k) => k.nom + ' ' + k.prenom }, { t: 'Poste/fonction', v: (k) => esc(k.poste), txt: (k) => k.poste },
      { t: 'Tiers', v: (k) => U.qui(D.tiers(db, k.tiers), '', 22), txt: (k) => (D.tiers(db, k.tiers) || {}).nom || '' }, { t: 'Tél. pro', v: (k) => esc(k.tel_pro) }, { t: 'Portable', v: (k) => esc(k.portable), txt: (k) => k.portable }, { t: 'E-mail', v: (k) => esc(k.email), txt: (k) => k.email }];
    return { html: `${U.titrePage('☺', `Contacts/Adresses${nat !== 'tous' ? ' — ' + NATURES[nat] : ''}`, lignes.length, U.btn('+ Nouveau contact', '', 'btn-metal', 'data-aller="contacts/nouveau"'))}<div data-liste></div>`,
      apres: (el) => U.liste(el.querySelector('[data-liste]'), { cols, lignes, lien: (k) => `contacts/fiche/${k.id}` }) };
  };

  // =====================================================================================================
  // TAGS / CATÉGORIES
  P.tags = (v, a) => {
    const db = v.db;
    if (a[0] === 'produits') {
      // Arborescence V2 (21 nov. 2026, js/erp-arbo.js) : 14 rayons › sous-catégories › sous-sous-catégories, nombre de produits
      if (D.pageArbo) return D.pageArbo(v); // modifiable (21 nov. 2026, js/erp-arbo.js)
      if (D.ARBO) {
        const nb = (f) => db.produits.filter(f).length;
        const aClasser = nb((p) => !p.souscat);
        const rayon = (r) => { const n = nb((p) => p.categorie === r.id); const nc = nb((p) => p.categorie === r.id && !p.souscat);
          return `<details class="erp-arbo"><summary><span class="erp-arbo-n">${r.n}</span><b>${esc(r.nom)}</b><span class="erp-gris">${r.sous.length} sous-cat.</span><em>${D.nombre(n)} produit${n > 1 ? 's' : ''}</em>${nc ? `<span class="pastille st-att">${D.nombre(nc)} à classer</span>` : ''}<a href="#" data-aller="produits/liste/${r.id}" class="erp-lien">Voir</a></summary>
            <ul>${r.sous.map((s) => { const ns = nb((p) => p.categorie === r.id && p.souscat === s.id);
              return `<li><div class="erp-arbo-s"><b>${esc(s.nom)}</b><em>${D.nombre(ns)}</em></div><div class="erp-arbo-ss">${s.sous.map((x) => { const nx = nb((p) => p.categorie === r.id && p.souscat === s.id && p.soussouscat === x.id); return `<span class="pastille${nx ? ' st-ok' : ''}">${esc(x.nom)}${nx ? ` · ${D.nombre(nx)}` : ''}</span>`; }).join('')}</div></li>`; }).join('')}</ul></details>`; };
        return { html: `${U.titrePage('◈', 'Arborescence du catalogue', D.ARBO.length)}<p class="erp-gris">14 rayons · ${D.ARBO.reduce((s, r) => s + r.sous.length, 0)} sous-catégories · ${D.ARBO.reduce((s, r) => s + r.sous.reduce((a, x) => a + x.sous.length, 0), 0)} sous-sous-catégories (arborescence V2). Le rayon, la sous-catégorie et la sous-sous-catégorie se choisissent sur la fiche produit (« Modifier ») ou par l’import Excel (colonnes « Catégorie (magasin) », « Sous-catégorie », « Sous-sous-catégorie »).${aClasser ? ` <b>${D.nombre(aClasser)} produit(s) encore à classer</b> (sans sous-catégorie).` : ''}</p>
          <div class="erp-arbo-liste">${D.ARBO.map(rayon).join('')}</div>` };
      }
      return { html: `${U.titrePage('◈', 'Tags/catégories des produits', D.CATEGORIES.length)}<p class="erp-gris">Cliquez sur une catégorie pour voir ses produits.</p>
        ${U.bloc('Catégories', U.table([['Catégorie', (c) => `<b>${esc(c[1])}</b>`], ['Produits', (c) => String(db.produits.filter((p) => p.categorie === c[0]).length), 'nb'], ['Fournisseurs', (c) => esc([...new Set(db.produits.filter((p) => p.categorie === c[0]).map((p) => p.marque).filter(Boolean))].join(', '))]], D.CATEGORIES, { lien: (c) => `produits/liste/${c[0]}` }))}` };
    }
    const tags = {}; db.tiers.forEach((t) => (t.tags || []).forEach((x) => { tags[x] = (tags[x] || 0) + 1; }));
    return { html: `${U.titrePage('◈', 'Tags/catégories clients et prospects')}
      <div class="erp-2col"><div class="erp-col">${U.bloc('Par type de tiers', U.table([['Type', (x) => `<b>${esc(x)}</b>`], ['Tiers', (x) => String(db.tiers.filter((t) => t.type === x).length), 'nb']], D.TYPES_TIERS))}</div>
      <div class="erp-col">${U.bloc('Tags libres', U.table([['Tag', (x) => `<span class="pastille">${esc(x[0])}</span>`], ['Tiers', (x) => String(x[1]), 'nb']], Object.entries(tags), { vide: 'Aucun tag : ajoutez-en dans « Modifier » sur la fiche d’un tiers.' }))}</div></div>` };
  };

  // =====================================================================================================
  // RECHERCHE
  P.recherche = (v, a) => {
    const db = v.db; const q = decodeURIComponent(a[0] || ''); const m = q.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const ok = (...s) => s.join(' ').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(m);
    const tiers = db.tiers.filter((t) => ok(t.nom, t.alt, t.code_client, t.code_fourn, t.ville, t.email));
    const contacts = db.contacts.filter((k) => ok(k.nom, k.prenom, k.email));
    const produits = db.produits.filter((p) => ok(p.ref, p.libelle, p.code_barres, p.marque));
    const docs = [['prop', 'Propositions', db.propositions], ['cmd', 'Commandes', db.commandes], ['fact', 'Factures', db.factures], ['achat', 'Commandes fournisseurs', db.achats]]
      .map(([ty, l, liste]) => [ty, l, liste.filter((d) => ok(d.ref, d.ref_client || '', (D.tiers(db, d.tiers) || {}).nom || ''))]);
    const n = tiers.length + contacts.length + produits.length + docs.reduce((s, d) => s + d[2].length, 0);
    return { html: `${U.titrePage('⌕', `Recherche « ${q} »`, n)}
      ${tiers.length ? U.bloc('Tiers', U.table([['Nom', (t) => U.qui(t)], ['Nature', (t) => U.nature(t)], ['Ville', (t) => esc(t.ville)]], tiers.slice(0, 20), { lien: (t) => `tiers/fiche/${t.id}` }), { compte: tiers.length }) : ''}
      ${contacts.length ? U.bloc('Contacts', U.table([['Nom', (k) => `${esc(k.prenom)} ${esc(k.nom)}`], ['Tiers', (k) => esc((D.tiers(db, k.tiers) || {}).nom || '—')]], contacts.slice(0, 20), { lien: (k) => `contacts/fiche/${k.id}` }), { compte: contacts.length }) : ''}
      ${produits.length ? U.bloc('Produits', U.table([['Image', (p) => U.vignetteProduit(p, 40), 'erp-col-img'], ['Réf.', (p) => `<b>${esc(p.ref)}</b>`], ['Libellé', (p) => esc(p.libelle)], ['Prix HT', (p) => D.euros(p.prix[0]), 'nb'], ['Stock', (p) => String(p.stock), 'nb']], produits.slice(0, 20), { lien: (p) => `produits/fiche/${p.id}` }), { compte: produits.length }) : ''}
      ${docs.filter((d) => d[2].length).map(([ty, l, liste]) => U.bloc(l, D.miniDocs(db, ty, parDate(liste).slice(0, 20)), { compte: liste.length })).join('')}
      ${n ? '' : U.vide('Aucun résultat. Essayez un nom, une ville, une référence de produit ou de document.')}` };
  };
})();
