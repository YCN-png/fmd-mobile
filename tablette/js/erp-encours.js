// FMD — CRM : encours client (23 nov. 2026, demande : « ajoute un système d'encours client »).
// Encours d'un client = ce qu'il nous doit + ce qu'il s'est engagé à payer :
//   • factures non payées TTC, dont « échues » (échéance dépassée) et « non échues » ;
//   • commandes validées / en préparation / livrées pas encore facturées, TTC.
// Comparé à l'« Encours autorisé » de la fiche client (t.encours_max, 0 = pas de plafond) : jauge verte, orange (≥ 80 %),
// rouge (dépassé). Retard = nombre de jours depuis la plus ancienne échéance dépassée.
// Affiché : fiche client (onglet Client), fiche devis / commande (ligne « Encours du client »), page « Encours clients »
// (Facturation | Paiement). À la validation d'un devis / d'une commande qui ferait dépasser le plafond, ou si le client a des
// factures en retard : alerte dans la confirmation (« Valider quand même »), sans blocage.
(function () {
  'use strict';
  const D = (window.FMDERP = window.FMDERP || {});
  const P = (D.pages = D.pages || {});
  const U = D.ui;
  const esc = U.esc;
  const SEUIL_PROCHE = 0.8;
  const jours = (a, b) => Math.floor((new Date(String(b).slice(0, 10) + 'T12:00:00') - new Date(String(a).slice(0, 10) + 'T12:00:00')) / 864e5);

  D.encoursDetail = (db, tiersId, o = {}) => {
    const t = D.tiers(db, tiersId) || {}; const auj = D.auj();
    const impayees = (db.factures || []).filter((f) => f.tiers === tiersId && !f.payee);
    const echues = impayees.filter((f) => f.echeance && f.echeance < auj);
    const cmds = (db.commandes || []).filter((c) => c.tiers === tiersId && D.commandeNonFacturee(c) && c.id !== o.sauf);
    const echu = D.arrondi(echues.reduce((s, f) => s + D.ttc(f), 0));
    const factures = D.arrondi(impayees.reduce((s, f) => s + D.ttc(f), 0));
    const commandes = D.arrondi(cmds.reduce((s, c) => s + D.ttc(c), 0));
    const total = D.arrondi(factures + commandes); const max = +t.encours_max || 0;
    const retard = echues.length ? Math.max(...echues.map((f) => jours(f.echeance, auj))) : 0;
    const pct = max ? total / max : 0;
    return { total, factures, echu, nonEchu: D.arrondi(factures - echu), commandes, max, dispo: max ? D.arrondi(max - total) : null, pct,
      retard, nbRetard: echues.length, nbFactures: impayees.length, nbCommandes: cmds.length,
      statut: !max ? (echues.length ? 'retard' : 'sans') : total > max ? 'depasse' : pct >= SEUIL_PROCHE ? 'proche' : echues.length ? 'retard' : 'ok' };
  };
  // (remplace l'ancien calcul « factures impayées seulement » : utilisé par l'accueil, l'export, la fiche client)
  D.encours = (db, tiersId) => D.encoursDetail(db, tiersId).total;

  const LIB = { ok: ['ok', 'Dans le plafond'], proche: ['att', 'Proche du plafond'], depasse: ['ko', 'Plafond dépassé'], retard: ['ko', 'Factures en retard'], sans: ['neutre', 'Sans plafond'] };
  D.pastilleEncours = (e) => { const [c, l] = LIB[e.statut] || LIB.sans; return `<span class="pastille st-${c}"><i class="erp-point"></i>${l}</span>`; };
  D.jaugeEncours = (e) => { if (!e.max) return '<span class="erp-gris">Pas d’encours autorisé fixé sur la fiche</span>';
    const p = Math.min(100, Math.round(e.pct * 100)); const c = e.statut === 'depasse' ? 'ko' : e.pct >= SEUIL_PROCHE ? 'att' : 'ok';
    return `<div class="erp-jauge-enc ${c}" role="progressbar" aria-valuenow="${Math.round(e.pct * 100)}" aria-valuemin="0" aria-valuemax="100" title="${Math.round(e.pct * 100)} % du plafond"><i style="width:${p}%"></i></div>`; };

  // Bloc détaillé (onglet Client de la fiche tiers)
  D.blocEncours = (db, t) => { const e = D.encoursDetail(db, t.id);
    return U.bloc('Encours client', `<div class="erp-enc-tete"><b class="erp-enc-total ${e.statut === 'depasse' ? 'erp-moins' : ''}">${D.euros(e.total)}</b><span>${e.max ? `sur ${D.euros(e.max)} autorisés` : 'pas de plafond'}</span>${D.pastilleEncours(e)}</div>
      ${D.jaugeEncours(e)}
      ${U.infos([['Factures non échues', `${D.euros(e.nonEchu)}`], ['Factures échues (en retard)', e.echu ? `<b class="erp-moins">${D.euros(e.echu)}</b> · ${e.nbRetard} facture${e.nbRetard > 1 ? 's' : ''}, jusqu’à ${e.retard} j de retard` : '0,00 €'],
        ['Commandes pas encore facturées', `${D.euros(e.commandes)}${e.nbCommandes ? ` · ${e.nbCommandes} commande${e.nbCommandes > 1 ? 's' : ''}` : ''}`],
        ['Disponible', e.max ? `<b class="${e.dispo < 0 ? 'erp-moins' : 'erp-plus'}">${D.euros(e.dispo)}</b>` : '—']])}
      <p class="erp-gris erp-petit">Encours = factures non payées + commandes validées pas encore facturées (TTC). Le plafond se règle dans « Modifier les conditions » (Encours autorisé).</p>`,
    { droite: U.lien('encours/liste/tous', 'Tous les encours') }); };

  // Ligne « Encours du client » des devis / commandes ; impact du document s'il n'est pas encore compté
  const compteDeja = (type, d) => type === 'cmd' && D.commandeNonFacturee(d);
  const impact = (type, d) => (['brouillon', 'ouvert', 'signee'].includes(d.etat) || (type === 'cmd' && d.etat === 'brouillon') ? D.ttc(d) : 0);
  D.ligneEncoursDoc = (db, type, d) => { const e = D.encoursDetail(db, d.tiers); const plus = compteDeja(type, d) ? 0 : impact(type, d); const apres = D.arrondi(e.total + plus);
    return `${D.euros(e.total)}${e.max ? ` sur ${D.euros(e.max)}` : ''} ${D.pastilleEncours(e)}${plus ? ` · après ce document : <b class="${e.max && apres > e.max ? 'erp-moins' : ''}">${D.euros(apres)}</b>` : ''}${e.nbRetard ? ` · <b class="erp-moins">${e.nbRetard} facture(s) en retard</b>` : ''}`; };
  // Texte d'alerte à la validation (vide si rien à signaler)
  D.alerteEncours = (db, type, d) => { const e = D.encoursDetail(db, d.tiers); const t = D.tiers(db, d.tiers) || {}; const apres = D.arrondi(e.total + (compteDeja(type, d) ? 0 : D.ttc(d))); const l = [];
    if (e.max && apres > e.max) l.push(`<b>Encours autorisé dépassé</b> : ${esc(t.nom || 'ce client')} doit déjà ${D.euros(e.total)} ; avec ce document ${D.euros(apres)} pour ${D.euros(e.max)} autorisés (dépassement de ${D.euros(apres - e.max)}).`);
    if (e.nbRetard) l.push(`<b>${e.nbRetard} facture${e.nbRetard > 1 ? 's' : ''} en retard</b> : ${D.euros(e.echu)} TTC, jusqu’à ${e.retard} jours de retard.`);
    return l.join('<br>'); };

  // ---------- accord de Farid Medegueb au-delà de +5 % (23 nov. 2026) ----------
  // Demande : « dès que l'encours est dépassé de 5 %, une validation par MEDEGUEB Farid doit être soumise ».
  // Devis / commande dont la validation porterait l'encours au-delà de 105 % du plafond :
  //   • validé par Farid lui-même → confirmation « Accorder et valider » ;
  //   • sinon → pas de validation : demande d'accord (d.accord_encours.statut = 'demande') envoyée à Farid dans la Messagerie
  //     (carte du document, lien) ; le document reste en brouillon avec « ⏳ En attente de l'accord » ;
  //   • Farid ouvre le document : « Accorder et valider » ou « Refuser » (motif) → réponse au demandeur dans la Messagerie ;
  //   • accord valable pour le montant accordé : si le document augmente ensuite, nouvel accord nécessaire.
  // Entre 0 et +5 % : alerte simple « Valider quand même » (inchangé).
  D.VALIDEUR_ENCOURS = 'Farid Medegueb';
  D.SEUIL_ACCORD_ENCOURS = 0.05;
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  D.estValideurEncours = () => { const n = norm(D.MOI); const v = norm(D.VALIDEUR_ENCOURS); return n === v || n === v.split(' ').reverse().join(' '); };
  // { niveau: 'ok' | 'alerte' | 'accord', apres, max, depassement (part au-delà du plafond, ex. 0,08 = +8 %), texte }
  D.controleEncours = (db, type, d) => {
    const e = D.encoursDetail(db, d.tiers); const apres = D.arrondi(e.total + (compteDeja(type, d) ? 0 : D.ttc(d)));
    const dep = e.max ? (apres - e.max) / e.max : 0; const texte = D.alerteEncours(db, type, d);
    const niveau = e.max && dep > D.SEUIL_ACCORD_ENCOURS ? 'accord' : texte ? 'alerte' : 'ok';
    const accorde = d.accord_encours && d.accord_encours.statut === 'accorde' && apres <= (+d.accord_encours.montant || 0) + 0.01;
    return { niveau, apres, max: e.max, depassement: dep, texte, accorde };
  };
  const pc = (x) => `${Math.round(x * 1000) / 10} %`.replace('.', ',');
  D.texteAccordEncours = (c) => `Encours après ce document : ${D.euros(c.apres)} pour ${D.euros(c.max)} autorisés, soit ${pc(c.depassement)} de dépassement (au-delà de ${pc(D.SEUIL_ACCORD_ENCOURS)} : accord de ${D.VALIDEUR_ENCOURS} obligatoire).`;
  const M = () => window.FMDMessagerie;
  D.demanderAccordEncours = async (v, db, type, d, c) => {
    d.accord_encours = { statut: 'demande', demande_par: D.MOI, demande_par_id: (window.FMDCompte && window.FMDCompte.id) || '', demande_le: D.maintenant(), montant: c.apres, max: c.max, depassement: c.depassement };
    D.toucher(d); D.evt(db, `Accord d’encours demandé à ${D.VALIDEUR_ENCOURS} pour ${d.ref} (${pc(c.depassement)} au-dessus du plafond)`, { tiers: d.tiers, objet: { type, id: d.id } }); v.sauver();
    const id = M() && M().idParNom ? M().idParNom(D.VALIDEUR_ENCOURS) : null; const t = D.tiers(db, d.tiers) || {};
    const ok = id && await M().envoyerA(id, `🛑 Accord d’encours demandé : ${D.MOI} veut valider ${type === 'cmd' ? 'la commande' : 'le devis'} ${d.ref} pour ${t.nom || 'un client'} (${D.euros(D.ttc(d))} TTC). ${D.texteAccordEncours(c)}`,
      { module: 'crm', route: `${type}/fiche/${d.id}`, libelle: `${type === 'cmd' ? 'Commande' : 'Devis'} ${d.ref}`, controle: true, accord: true });
    v.notifier(ok ? `Demande d’accord envoyée à ${D.VALIDEUR_ENCOURS} : ${d.ref} sera validé(e) quand il l’aura accordé.` : `Demande enregistrée sur ${d.ref}, mais le message à ${D.VALIDEUR_ENCOURS} n’a pas pu partir (Messagerie) : prévenez-le.`);
    v.rendre();
  };
  const repondre = async (d, type, texte) => { const a = d.accord_encours || {}; if (!a.demande_par_id || !M() || !M().envoyerA) return;
    await M().envoyerA(a.demande_par_id, texte, { module: 'crm', route: `${type}/fiche/${d.id}`, libelle: `${type === 'cmd' ? 'Commande' : 'Devis'} ${d.ref}`, reponse: true }); };
  D.accorderEncours = (db, type, d, c) => {
    d.accord_encours = { ...(d.accord_encours || {}), statut: 'accorde', montant: c.apres, max: c.max, depassement: c.depassement, decide_par: D.MOI, decide_le: D.maintenant() };
    D.toucher(d); D.evt(db, `Accord d’encours donné par ${D.MOI} pour ${d.ref} (${D.euros(c.apres)} pour ${D.euros(c.max)} autorisés)`, { tiers: d.tiers, objet: { type, id: d.id } });
    repondre(d, type, `✅ Accord d’encours donné pour ${d.ref} : ${type === 'cmd' ? 'la commande est validée' : 'le devis est validé'}.`); };
  D.refuserEncours = (db, type, d, motif) => {
    d.accord_encours = { ...(d.accord_encours || {}), statut: 'refuse', decide_par: D.MOI, decide_le: D.maintenant(), motif: motif || '' };
    D.toucher(d); D.evt(db, `Accord d’encours refusé par ${D.MOI} pour ${d.ref}${motif ? ` : ${motif}` : ''}`, { tiers: d.tiers, objet: { type, id: d.id } });
    repondre(d, type, `⛔ Accord d’encours refusé pour ${d.ref}${motif ? ` : ${motif}` : ''}. Le document reste en brouillon.`); };
  D.etiquetteAccordEncours = (d) => { const a = d.accord_encours; if (!a) return '';
    if (a.statut === 'demande') return `<span class="pastille st-att">⏳ En attente de l’accord de ${esc(D.VALIDEUR_ENCOURS)}</span> <small class="erp-gris">demandé par ${esc(a.demande_par || '')} le ${D.jour(a.demande_le)}</small>`;
    if (a.statut === 'accorde') return `<span class="pastille st-ok">✓ Encours accordé par ${esc(a.decide_par || '')}</span> <small class="erp-gris">jusqu’à ${D.euros(+a.montant || 0)}</small>`;
    if (a.statut === 'refuse') return `<span class="pastille st-ko">⛔ Encours refusé par ${esc(a.decide_par || '')}</span>${a.motif ? ` <small class="erp-gris">${esc(a.motif)}</small>` : ''}`;
    return ''; };

  // ---------- page « Encours clients » ----------
  P.encours = (v, a) => {
    const db = v.db; const filtre = a[1] || 'tous';
    const lignes = db.tiers.filter((t) => t.client).map((t) => ({ t, e: D.encoursDetail(db, t.id) })).filter((x) => x.e.total > 0 || x.e.max > 0)
      .sort((x, y) => (y.e.statut === 'depasse') - (x.e.statut === 'depasse') || y.e.retard - x.e.retard || y.e.total - x.e.total);
    const cols = [{ t: 'Client', v: (x) => U.qui(x.t, '', 24), txt: (x) => x.t.nom }, { t: 'Encours autorisé', v: (x) => (x.e.max ? D.euros(x.e.max) : '—'), nb: true },
      { t: 'Factures échues', v: (x) => (x.e.echu ? `<b class="erp-moins">${D.euros(x.e.echu)}</b>` : '0,00 €'), nb: true }, { t: 'Non échues', v: (x) => D.euros(x.e.nonEchu), nb: true },
      { t: 'Commandes non facturées', v: (x) => D.euros(x.e.commandes), nb: true }, { t: 'Encours total', v: (x) => `<b>${D.euros(x.e.total)}</b>`, nb: true },
      { t: 'Disponible', v: (x) => (x.e.max ? `<b class="${x.e.dispo < 0 ? 'erp-moins' : 'erp-plus'}">${D.euros(x.e.dispo)}</b>` : '—'), nb: true },
      { t: 'Utilisation', v: (x) => D.jaugeEncours(x.e) }, { t: 'Retard', v: (x) => (x.e.retard ? `<b class="erp-moins">${x.e.retard} j</b>` : '—'), nb: true }, { t: 'État', v: (x) => D.pastilleEncours(x.e) }];
    const tot = (k) => lignes.reduce((s, x) => s + x.e[k], 0);
    const nbDep = lignes.filter((x) => x.e.statut === 'depasse').length; const nbRet = lignes.filter((x) => x.e.nbRetard).length;
    return { html: `${U.titrePage('€', 'Encours clients', lignes.length)}
      <div class="erp-compteurs">${[['Encours total', tot('total'), ''], ['Factures échues', tot('echu'), 'rouge'], ['Commandes non facturées', tot('commandes'), '']].map(([l, n, c]) => `<div class="erp-compteur"><span>${l}</span><b class="${c && n ? c : ''}">${D.euros(n)}</b></div>`).join('')}
        <div class="erp-compteur"><span>Clients au-dessus du plafond</span><b class="${nbDep ? 'rouge' : ''}">${nbDep}</b></div><div class="erp-compteur"><span>Clients en retard de paiement</span><b class="${nbRet ? 'rouge' : ''}">${nbRet}</b></div></div>
      <div data-liste></div>`,
      apres: (el) => U.liste(el.querySelector('[data-liste]'), { cols, lignes, cle: 'encours-clients', lien: (x) => `tiers/fiche/${x.t.id}/client`,
        etats: [['depasse', 'Plafond dépassé'], ['proche', 'Proche du plafond'], ['retard', 'Factures en retard'], ['sans', 'Sans plafond']], etat: filtre === 'tous' ? '' : filtre,
        filtre: (x, e) => (e === 'retard' ? x.e.nbRetard > 0 : e === 'sans' ? !x.e.max : x.e.statut === e), vide: 'Aucun client avec un encours ou un plafond.',
        total: (l) => `<td colspan="5"><b>Total</b></td><td class="nb"><b>${D.euros(l.reduce((s, x) => s + x.e.total, 0))}</b></td><td colspan="4"></td>` }) };
  };
})();
