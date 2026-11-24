// FMD — CRM : prix net, remises autorisées, prix promo, accord de Farid, commissions des commerciaux (23 nov. 2026).
// Demande : « Sur les prix de vente : indiquer un prix net, le % de remise max à l'unité, pouvoir ajouter une remise plus
// importante sur du quantitatif ; au-delà une demande doit être faite et validée par Farid. Dans la Compta, une partie
// commission uniquement pour les commerciaux : prix net 16 %, 12 % dès qu'une réduction est appliquée, 10 % pour un prix
// promo, 0 % dès que c'est une remise au-delà de celle autorisée (validée par Farid) ». Choix de l'utilisateur : commission sur
// le montant HT vendu, due à la facture émise, au commercial du client (fiche client) ; niveaux de prix supprimés.
// Produit : p.prix[0] = prix net HT ; p.remise_max (% à l'unité, vide = D.REMISE_MAX_DEFAUT) ; p.remises_qte = [{ qte, remise }]
// (remise max dès qte unités) ; p.prix_promo + p.promo_du / p.promo_au (dates facultatives).
// Ligne de devis / commande / facture : type de prix figé à la validation (l.prix_net, l.type_prix, l.remise_eff,
// l.remise_autorisee) : 'net' | 'reduction' | 'promo' | 'hors' (remise au-delà de l'autorisé) | 'libre' (ligne sans produit).
(function () {
  'use strict';
  const D = (window.FMDERP = window.FMDERP || {});
  const U = D.ui;
  const esc = U.esc;
  D.REMISE_MAX_DEFAUT = 40; // % à l'unité quand la fiche produit ne dit rien (23 nov. 2026 : 40 %, demande de l'utilisateur)
  D.TAUX_COMMISSION = { net: 16, reduction: 12, promo: 10, hors: 0, libre: 0 };
  const LIB = { net: ['ok', 'Prix net'], reduction: ['info', 'Réduction'], promo: ['att', 'Prix promo'], hors: ['ko', 'Remise hors limite'], libre: ['neutre', 'Ligne libre'] };
  const pc = (x) => `${D.nombre(Math.round(x * 10) / 10)} %`;

  D.prixNet = (p) => +((p && p.prix) || [])[0] || 0;
  D.promoActive = (p, date) => { const j = String(date || D.auj()).slice(0, 10);
    return !!(p && +p.prix_promo > 0 && (!p.promo_du || p.promo_du <= j) && (!p.promo_au || p.promo_au >= j)); };
  D.remiseMaxUnite = (p) => (p && p.remise_max !== undefined && p.remise_max !== null && p.remise_max !== '' ? +p.remise_max : D.REMISE_MAX_DEFAUT);
  D.remiseAutorisee = (p, qte) => (p && p.remises_qte || []).filter((x) => +qte >= +x.qte && +x.qte > 0).reduce((m, x) => Math.max(m, +x.remise || 0), D.remiseMaxUnite(p));

  // Classement d'une ligne. date = date du document (prix promo). Données figées sur la ligne si elle en a.
  D.typePrixLigne = (db, l, date) => {
    if (!l || !l.produit) return { type: 'libre', remise: 0, autorise: 0 };
    const p = D.produit(db, l.produit);
    const net = l.prix_net != null ? +l.prix_net : D.prixNet(p);
    const eff = (+l.pu || 0) * (1 - (+l.remise || 0) / 100);
    const autorise = l.remise_autorisee != null ? +l.remise_autorisee : D.remiseAutorisee(p, l.qte);
    if (l.type_prix && l.prix_net != null) return { type: l.type_prix, remise: +l.remise_eff || 0, autorise, net, eff };
    if (!net) return { type: 'net', remise: 0, autorise, net, eff };
    const promo = p && D.promoActive(p, date) ? +p.prix_promo : 0;
    if (promo && eff >= promo - 0.005 && eff < net - 0.005) return { type: 'promo', remise: (1 - eff / net) * 100, autorise, net, eff };
    if (eff >= net - 0.005) return { type: 'net', remise: 0, autorise, net, eff };
    const remise = (1 - eff / net) * 100; const base = promo && promo < net ? (1 - eff / promo) * 100 : remise;
    return { type: base <= autorise + 0.05 ? 'reduction' : 'hors', remise, autorise, net, eff };
  };
  D.pastilleTypePrix = (db, l, date) => { const x = D.typePrixLigne(db, l, date); const [c, t] = LIB[x.type] || LIB.libre;
    const titre = x.type === 'libre' ? 'Ligne sans produit' : `Prix net ${D.euros(x.net)} · vendu ${D.euros(x.eff)} · remise ${pc(x.remise)} (autorisée : ${pc(x.autorise)})`;
    return `<span class="pastille st-${c} erp-type-prix" title="${esc(titre)}">${t}${x.type === 'reduction' || x.type === 'hors' ? ` −${pc(x.remise)}` : ''}</span>`; };
  // Fige le type de prix des lignes (validation d'un devis / d'une commande, création d'une facture).
  D.figerPrix = (db, d) => { (d.lignes || []).forEach((l) => { if (!l.produit || l.type_prix) return; const x = D.typePrixLigne(db, l, d.date);
    l.prix_net = D.arrondi(x.net); l.type_prix = x.type; l.remise_eff = D.arrondi(x.remise); l.remise_autorisee = x.autorise; }); };

  // ---------- remises hors limite : accord de Farid Medegueb ----------
  const signature = (hors) => hors.map((h) => `${h.l.produit}:${h.l.qte}:${D.arrondi(h.x.eff)}`).sort().join('|');
  D.controleRemises = (db, type, d) => {
    const hors = (d.lignes || []).map((l) => ({ l, x: D.typePrixLigne(db, l, d.date) })).filter((h) => h.x.type === 'hors');
    const sig = signature(hors); const a = d.accord_remise;
    return { hors, signature: sig, accorde: !!(hors.length && a && a.statut === 'accorde' && a.signature === sig) };
  };
  D.texteRemises = (db, r) => r.hors.map((h) => { const p = D.produit(db, h.l.produit) || {}; return `${p.ref || h.l.desc} × ${D.nombre(h.l.qte)} : remise ${pc(h.x.remise)} pour ${pc(h.x.autorise)} autorisés`; }).join(' ; ');
  const M = () => window.FMDMessagerie;
  const libDoc = (type, d) => `${type === 'cmd' ? 'Commande' : type === 'fact' ? 'Facture' : 'Devis'} ${d.ref}`;
  // Demande d'accord unique (remise et/ou encours) → Farid, dans la Messagerie ; le document reste en brouillon.
  D.demanderAccordFarid = async (v, db, type, d, o) => {
    const base = { statut: 'demande', demande_par: D.MOI, demande_par_id: (window.FMDCompte && window.FMDCompte.id) || '', demande_le: D.maintenant() };
    const raisons = [];
    if (o.rem) { d.accord_remise = { ...base, signature: o.rem.signature }; raisons.push(`remise au-delà de l’autorisé (${D.texteRemises(db, o.rem)})`); }
    if (o.enc) { d.accord_encours = { ...base, montant: o.enc.apres, max: o.enc.max, depassement: o.enc.depassement }; raisons.push(D.texteAccordEncours(o.enc)); }
    D.toucher(d); D.evt(db, `Accord demandé à ${D.VALIDEUR_ENCOURS} pour ${d.ref} : ${raisons.join(' · ')}`, { tiers: d.tiers, objet: { type, id: d.id } }); v.sauver();
    const id = M() && M().idParNom ? M().idParNom(D.VALIDEUR_ENCOURS) : null; const t = D.tiers(db, d.tiers) || {};
    const ok = id && await M().envoyerA(id, `🛑 Accord demandé : ${D.MOI} veut valider ${libDoc(type, d).toLowerCase()} pour ${t.nom || 'un client'} (${D.euros(D.ttc(d))} TTC). ${raisons.map((x) => '• ' + x).join(' ')}`,
      { module: 'crm', route: `${type}/fiche/${d.id}`, libelle: libDoc(type, d), controle: true, accord: true });
    v.notifier(ok ? `Demande d’accord envoyée à ${D.VALIDEUR_ENCOURS} : ${d.ref} sera validé(e) quand il l’aura accordé.` : `Demande enregistrée sur ${d.ref}, mais le message à ${D.VALIDEUR_ENCOURS} n’a pas pu partir (Messagerie) : prévenez-le.`);
    v.rendre();
  };
  const repondre = async (d, type, texte) => { const a = d.accord_remise || d.accord_encours || {}; const id = a.demande_par_id; if (!id || !M() || !M().envoyerA) return;
    await M().envoyerA(id, texte, { module: 'crm', route: `${type}/fiche/${d.id}`, libelle: libDoc(type, d), reponse: true }); };
  D.accorderFarid = (db, type, d, o) => { const dec = { statut: 'accorde', decide_par: D.MOI, decide_le: D.maintenant() };
    if (o.rem) d.accord_remise = { ...(d.accord_remise || {}), ...dec, signature: o.rem.signature };
    if (o.enc) d.accord_encours = { ...(d.accord_encours || {}), ...dec, montant: o.enc.apres, max: o.enc.max, depassement: o.enc.depassement };
    D.toucher(d); D.evt(db, `Accord donné par ${D.MOI} pour ${d.ref}${o.rem ? ' (remise hors limite : commission 0 % sur ces lignes)' : ''}${o.enc ? ` (encours ${D.euros(o.enc.apres)} pour ${D.euros(o.enc.max)})` : ''}`, { tiers: d.tiers, objet: { type, id: d.id } });
    repondre(d, type, `✅ Accord donné pour ${d.ref} : ${type === 'cmd' ? 'la commande est validée' : 'le devis est validé'}.`); };
  D.refuserFarid = (db, type, d, motif) => { const dec = { statut: 'refuse', decide_par: D.MOI, decide_le: D.maintenant(), motif: motif || '' };
    if (d.accord_remise && d.accord_remise.statut === 'demande') d.accord_remise = { ...d.accord_remise, ...dec };
    if (d.accord_encours && d.accord_encours.statut === 'demande') d.accord_encours = { ...d.accord_encours, ...dec };
    D.toucher(d); D.evt(db, `Accord refusé par ${D.MOI} pour ${d.ref}${motif ? ` : ${motif}` : ''}`, { tiers: d.tiers, objet: { type, id: d.id } });
    repondre(d, type, `⛔ Accord refusé pour ${d.ref}${motif ? ` : ${motif}` : ''}. Le document reste en brouillon.`); };
  D.accordEnAttente = (d) => !!((d.accord_remise && d.accord_remise.statut === 'demande') || (d.accord_encours && d.accord_encours.statut === 'demande'));
  D.etiquetteAccordRemise = (d) => { const a = d.accord_remise; if (!a) return '';
    if (a.statut === 'demande') return `<span class="pastille st-att">⏳ Remise : en attente de l’accord de ${esc(D.VALIDEUR_ENCOURS)}</span>`;
    if (a.statut === 'accorde') return `<span class="pastille st-ok">✓ Remise accordée par ${esc(a.decide_par || '')}</span>`;
    if (a.statut === 'refuse') return `<span class="pastille st-ko">⛔ Remise refusée par ${esc(a.decide_par || '')}</span>${a.motif ? ` <small class="erp-gris">${esc(a.motif)}</small>` : ''}`;
    return ''; };

  // ---------- commissions des commerciaux ----------
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  D.commissionsFacture = (db, f) => { const t = D.tiers(db, f.tiers) || {};
    return (f.lignes || []).map((l) => { const x = D.typePrixLigne(db, l, f.date); const ht = D.arrondi(D.htLigne(l)); const taux = D.TAUX_COMMISSION[x.type] ?? 0;
      return { f, l, type: x.type, ht, taux, montant: D.arrondi(ht * taux / 100), commercial: t.commercial || '' }; }); };
  D.lignesCommissions = (db) => (db.factures || []).filter((f) => !f.importe).flatMap((f) => D.commissionsFacture(db, f));
  D.estCommercial = (db, nom) => { const n = norm(nom); return (D.COMMERCIAUX || []).some((c) => norm(c) === n) || (db.tiers || []).some((t) => t.client && norm(t.commercial) === n); };

  // Page « Commissions » de la Compta. h = { db, titre, carte, vide, admin }
  D.pageCommissions = (h, a) => {
    const db = h.db; const moi = D.MOI;
    if (!h.admin && !D.estCommercial(db, moi)) return { html: `${h.titre('Commissions', 'Réservé aux commerciaux.')}${h.vide('Votre compte n’est pas commercial.')}` };
    const toutes = D.lignesCommissions(db).filter((x) => x.commercial);
    const commerciaux = [...new Set(toutes.map((x) => x.commercial))].sort((x, y) => x.localeCompare(y, 'fr'));
    const qui = h.admin ? (a[0] ? decodeURIComponent(a[0]) : '') : moi;
    const mois = a[1] || (h.admin ? '' : '') || '';
    const lignes = toutes.filter((x) => (!qui || norm(x.commercial) === norm(qui)) && (!mois || String(x.f.date).slice(0, 7) === mois));
    const somme = (f) => D.arrondi(lignes.filter(f).reduce((s, x) => s + x.montant, 0));
    const ca = (f) => D.arrondi(lignes.filter(f).reduce((s, x) => s + x.ht, 0));
    const moisDispo = [...new Set(toutes.map((x) => String(x.f.date).slice(0, 7)))].sort().reverse();
    const parType = Object.keys(D.TAUX_COMMISSION).map((k) => ({ k, ca: ca((x) => x.type === k), com: somme((x) => x.type === k) })).filter((x) => x.ca);
    const parFacture = Object.values(lignes.reduce((m, x) => { const k = x.f.id; (m[k] = m[k] || { f: x.f, ht: 0, com: 0, commercial: x.commercial }); m[k].ht += x.ht; m[k].com += x.montant; return m; }, {}))
      .sort((x, y) => String(y.f.date).localeCompare(String(x.f.date)));
    const filtres = `<div class="cp-filtres">${h.admin ? `<select data-com-qui aria-label="Commercial"><option value="">Tous les commerciaux</option>${commerciaux.map((c) => `<option value="${esc(c)}"${norm(c) === norm(qui) ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select>` : `<b>${esc(moi)}</b>`}
      <select data-com-mois aria-label="Mois"><option value="">Toute la période</option>${moisDispo.map((m) => `<option value="${m}"${m === mois ? ' selected' : ''}>${new Date(m + '-15').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</option>`).join('')}</select></div>`;
    return { html: `${h.titre('Commissions', 'Sur le montant HT des factures émises, au commercial du client : prix net 16 %, réduction autorisée 12 %, prix promo 10 %, remise hors limite (accordée par Farid) 0 %.', filtres)}
      <div class="cp-com-grille">${h.carte('Commission', `<b class="cp-gros">${D.euros(somme(() => true))}</b><p>sur ${D.euros(ca(() => true))} HT facturés</p>`)}
        ${parType.map((x) => h.carte(`${(LIB[x.k] || LIB.libre)[1]} · ${D.TAUX_COMMISSION[x.k]} %`, `<b class="cp-moyen">${D.euros(x.com)}</b><p>sur ${D.euros(x.ca)} HT</p>`)).join('')}</div>
      ${h.carte('Détail par facture', parFacture.length ? `<table class="cp-table"><thead><tr><th>Facture</th><th>Date</th><th>Client</th>${h.admin && !qui ? '<th>Commercial</th>' : ''}<th class="nb">HT</th><th class="nb">Commission</th></tr></thead><tbody>
        ${parFacture.map((x) => `<tr><td><b>${esc(x.f.ref)}</b></td><td>${D.jour(x.f.date)}</td><td>${esc((D.tiers(db, x.f.tiers) || {}).nom || '')}</td>${h.admin && !qui ? `<td>${esc(x.commercial)}</td>` : ''}<td class="nb">${D.euros(x.ht)}</td><td class="nb"><b>${D.euros(x.com)}</b></td></tr>`).join('')}</tbody></table>` : h.vide('Aucune facture sur cette période.'))}
      ${h.carte('Détail par ligne', lignes.length ? `<table class="cp-table"><thead><tr><th>Facture</th><th>Produit</th><th>Type de prix</th><th class="nb">HT</th><th class="nb">Taux</th><th class="nb">Commission</th></tr></thead><tbody>
        ${lignes.map((x) => `<tr><td>${esc(x.f.ref)}</td><td>${esc(x.l.desc || '')}</td><td>${D.pastilleTypePrix(db, x.l, x.f.date)}</td><td class="nb">${D.euros(x.ht)}</td><td class="nb">${x.taux} %</td><td class="nb">${D.euros(x.montant)}</td></tr>`).join('')}</tbody></table>` : h.vide('Aucune ligne.'))}`,
      apres: (el, aller) => {
        const q = el.querySelector('[data-com-qui]'); const m = el.querySelector('[data-com-mois]');
        const go = () => aller(`commissions/${encodeURIComponent(q ? q.value : '')}/${m.value}`);
        if (q) q.addEventListener('change', go); m.addEventListener('change', go);
      } };
  };
})();
