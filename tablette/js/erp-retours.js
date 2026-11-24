// FMD — CRM / ERP : Retours fournisseur (20 nov. 2026, demande : « dans la gestion de stock, une option Retour : retourner des
// articles au fournisseur ; une fois le retour créé et validé, le stock est déduit »).
// Brouillon (réf. (PROV-RF…)) : on choisit le fournisseur, éventuellement la commande fournisseur d'origine, puis les articles.
// Valider : réf. définitive RFaamm-0001, un mouvement de stock « Retour fournisseur » (−qté) par ligne, au nom de la personne
// connectée. Annuler un retour validé : le stock est remis (+qté), toujours en type « Retour fournisseur ».
// Données : db.retours (dans crm.json, en ligne et fusionné entre les postes comme le reste du CRM).
(function () {
  'use strict';
  const D = (window.FMDERP = window.FMDERP || {});
  const P = (D.pages = D.pages || {});
  const U = D.ui;
  const esc = U.esc;
  const MOTIFS = ['Article défectueux', 'Erreur de livraison', 'Article endommagé au transport', 'Surplus / non vendu', 'Autre'];
  const retours = (db) => (Array.isArray(db.retours) ? db.retours : (db.retours = []));
  const ht = (r) => r.lignes.reduce((s, l) => s + (+l.qte || 0) * (+l.pu || 0), 0);
  const qteTot = (r) => r.lignes.reduce((s, l) => s + (+l.qte || 0), 0);
  const evtR = (db, r, titre) => D.evt(db, titre, { tiers: r.tiers, objet: { type: 'retour', id: r.id } });

  function liste(v, etat) {
    const db = v.db; const lignes = [...retours(db)].sort((a, b) => String(b.cree).localeCompare(String(a.cree)));
    const cols = [{ t: 'Réf.', v: (r) => `<b>${esc(r.ref)}</b>`, txt: (r) => r.ref }, { t: 'Fournisseur', v: (r) => esc((D.tiers(db, r.tiers) || {}).nom || '—'), txt: (r) => (D.tiers(db, r.tiers) || {}).nom || '' },
      { t: 'Date', v: (r) => D.jour(r.date) }, { t: 'Motif', v: (r) => esc(r.motif), txt: (r) => r.motif }, { t: 'Articles', v: (r) => D.nombre(qteTot(r)), nb: true },
      { t: 'Montant HT', v: (r) => D.euros(ht(r)), nb: true }, { t: 'Par', v: (r) => esc(r.auteur || ''), txt: (r) => r.auteur }, { t: 'État', v: (r) => U.pastille('retour', r.etat) }];
    return { html: `${U.titrePage('retour', 'Retours fournisseur', lignes.length, U.btn('+ Nouveau retour', '', 'btn-metal', 'data-aller="retour/nouveau"'))}<div data-liste></div>`,
      apres: (el) => U.liste(el.querySelector('[data-liste]'), { cols, lignes, cle: 'retours', lien: (r) => `retour/fiche/${r.id}`, etats: D.ETATS.retour.map((e) => [e[0], e[3]]), etat: etat && etat !== 'tous' ? etat : '', filtre: (r, e) => r.etat === e, vide: 'Aucun retour fournisseur' }) };
  }

  function nouveau(v) {
    const db = v.db; const fourns = db.tiers.filter((t) => t.fournisseur).sort((a, b) => a.nom.localeCompare(b.nom));
    const cmds = db.achats.filter((a) => a.etat !== 'brouillon' && a.etat !== 'annule').sort((a, b) => String(b.date).localeCompare(String(a.date)));
    return { html: `${U.titrePage('retour', 'Nouveau retour fournisseur')}
      ${U.form('erp-rf', `${U.ligne('Fournisseur', U.sel('tiers', fourns.map((t) => [t.id, t.nom]), '', { req: true, vide: 'Sélectionner un fournisseur' }), { req: true, aide: fourns.length ? '' : 'Aucun fournisseur : créez-le d’abord dans Tiers.' })}
        ${U.ligne('Commande fournisseur d’origine', U.sel('achat', cmds.map((a) => [a.id, `${a.ref} — ${(D.tiers(db, a.tiers) || {}).nom || ''} (${D.jour(a.date)})`]), '', { vide: 'Aucune (facultatif)' }), { aide: 'Si vous la choisissez, ses articles reçus sont ajoutés au retour (quantités modifiables ensuite).' })}
        ${U.ligne('Date', U.inp('date', D.auj(), { type: 'date', req: true }), { req: true })}
        ${U.ligne('Motif du retour', U.sel('motif', MOTIFS, MOTIFS[0]))}
        ${U.ligne('Note', U.inp('note', '', { ph: 'N° d’accord de retour du fournisseur, détail…' }), { large: true })}`,
      `${U.btn('Annuler', '', 'btn-ligne', 'type="button" data-aller="retour/liste/tous"')}${U.btn('Créer le brouillon', 'ok', 'btn-metal', 'type="submit"')}`)}`,
      apres: (el) => {
        const f = el.querySelector('#erp-rf');
        // commande choisie → fournisseur de la commande
        f.querySelector('[name="achat"]').addEventListener('change', (e) => { const a = db.achats.find((x) => x.id === e.target.value); if (a) { const s = f.querySelector('[name="tiers"]'); s.value = a.tiers; s.dispatchEvent(new Event('change')); } });
        U.selectsCherchables(el);
        f.addEventListener('submit', (e) => { e.preventDefault(); const d = U.lire(f); if (!d.tiers) return;
          const a = d.achat ? db.achats.find((x) => x.id === d.achat) : null;
          const lignes = a ? a.lignes.filter((l) => l.produit && (l.recu || 0) > 0).map((l) => ({ produit: l.produit, desc: l.desc || '', ref_fourn: l.ref_fourn || '', qte: l.recu, pu: D.arrondi((+l.pu || 0) * (1 - (+l.remise || 0) / 100)) })) : [];
          const r = { id: D.id('rf'), ref: D.refBrouillon(db, 'retour'), tiers: d.tiers, achat: a ? a.id : '', date: d.date || D.auj(), motif: d.motif, note: d.note || '', etat: 'brouillon', lignes, auteur: D.MOI, cree: D.maintenant() };
          retours(db).push(r); evtR(db, r, `Retour fournisseur ${r.ref} créé (brouillon)`); v.sauver(); v.aller(`retour/fiche/${r.id}`); });
      } };
  }

  function fiche(v, id) {
    const db = v.db; const r = retours(db).find((x) => x.id === id);
    if (!r) return { html: U.vide('Retour introuvable.') };
    const t = D.tiers(db, r.tiers) || {}; const brouillon = r.etat === 'brouillon'; const a = r.achat ? db.achats.find((x) => x.id === r.achat) : null;
    const produits = [...db.produits].sort((x, y) => x.ref.localeCompare(y.ref));
    const manque = r.lignes.filter((l) => { const p = D.produit(db, l.produit); return p && (+l.qte || 0) > (p.stock || 0); });
    const cols = [['Image', (l) => { const p = D.produit(db, l.produit); return p ? U.vignetteProduit(p, 40) : ''; }, 'erp-col-img'], ['Produit', (l) => { const p = D.produit(db, l.produit); return p ? `${U.lienProduit(db, l.produit)} ${esc(p.libelle)}` : esc(l.desc || '—'); }],
      ['Réf. fournisseur', (l) => esc(l.ref_fourn || '')], ['Stock actuel', (l) => { const p = D.produit(db, l.produit); return p ? D.nombre(p.stock || 0) : '—'; }, 'nb'],
      ['Qté retournée', (l, i) => (brouillon ? `<input type="number" min="1" step="1" value="${esc(l.qte)}" data-qte="${i}" class="erp-inline" style="width:80px" aria-label="Quantité retournée">` : `<b>${D.nombre(l.qte)}</b>`), 'nb'],
      ['PU HT', (l) => D.euros(+l.pu || 0), 'nb'], ['Total HT', (l) => D.euros((+l.qte || 0) * (+l.pu || 0)), 'nb'],
      brouillon ? ['', (l, i) => `<button type="button" class="btn-icone" data-suppr-l="${i}" title="Retirer la ligne" aria-label="Retirer la ligne">✕</button>`] : null].filter(Boolean);
    const tableLignes = r.lignes.length ? `<table class="registre erp-table"><thead><tr>${cols.map((c) => `<th class="${c[2] || ''}">${esc(c[0])}</th>`).join('')}</tr></thead><tbody>${r.lignes.map((l, i) => `<tr>${cols.map((c) => `<td class="${c[2] || ''}">${c[1](l, i)}</td>`).join('')}</tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="${cols.length - (brouillon ? 4 : 3)}"><b>Total</b></td><td class="nb"><b>${D.nombre(qteTot(r))}</b></td><td></td><td class="nb"><b>${D.euros(ht(r))}</b></td>${brouillon ? '<td></td>' : ''}</tr></tfoot></table>` : U.vide('Aucun article : ajoutez les articles à retourner ci-dessous.');
    const boutons = brouillon
      ? [U.btn('Valider le retour', 'valider', 'btn-metal', `data-valider${r.lignes.length ? '' : ' disabled title="Ajoutez au moins un article"'}`), U.btn('Supprimer le brouillon', '', 'btn-ligne', 'data-supprimer')]
      : r.etat === 'valide' ? [U.btn('Annuler le retour (remettre en stock)', '', 'btn-ligne', 'data-annuler')] : [];
    return { html: `${U.titrePage('retour', `Retour fournisseur ${r.ref}`, null, U.pastille('retour', r.etat))}
      <div class="erp-carte erp-2c">${U.infos([['Fournisseur', U.lienTiers(db, r.tiers)], ['Commande d’origine', a ? U.lien(`achat/fiche/${a.id}`, esc(a.ref)) : '—'], ['Date', D.jour(r.date)], ['Motif', esc(r.motif)]])}
        ${U.infos([['Créé par', esc(r.auteur || '')], ['Validé par', r.valide_par ? `${esc(r.valide_par)} · ${D.jour(r.valide_le)}` : '—'], ['Annulé par', r.annule_par ? `${esc(r.annule_par)} · ${D.jour(r.annule_le)}` : '—'], ['Note', esc(r.note)]])}</div>
      ${brouillon && manque.length ? `<p class="erp-moins">⚠ ${manque.length} article(s) : quantité retournée supérieure au stock actuel. Le stock passera en négatif à la validation.</p>` : ''}
      ${U.boutons(boutons)}
      ${U.bloc('Articles retournés', tableLignes, { compte: r.lignes.length })}
      ${brouillon ? U.bloc('Ajouter un article', U.form('erp-rf-l', `<div class="erp-2f">${U.ligne('Produit', U.sel('produit', produits.map((p) => [p.id, `${p.ref} — ${p.libelle}`]), '', { req: true, vide: 'Sélectionner un produit' }), { req: true })}${U.ligne('Quantité', U.inp('qte', 1, { type: 'number', min: 1, step: '1', req: true }), { req: true })}</div>
        ${U.ligne('Prix unitaire HT', U.inp('pu', '', { type: 'number', step: '0.01', min: 0, ph: 'Prix d’achat chez ce fournisseur si vide' }))}`, U.btn('Ajouter', 'ok', 'btn-metal', 'type="submit"'))) : ''}
      ${!brouillon && t.nom ? `<p class="erp-gris">Le stock a été ${r.etat === 'annule' ? 'déduit puis remis' : 'déduit'} : voir les mouvements « Retour fournisseur » dans <a href="#" data-aller="mouvements">Mouvements</a>.</p>` : ''}`,
      apres: (el) => {
        const fin = (m) => { D.toucher(r); v.sauver(); if (m) v.notifier(m); v.rendre(); };
        U.selectsCherchables(el);
        const fl = el.querySelector('#erp-rf-l');
        if (fl) fl.addEventListener('submit', (e) => { e.preventDefault(); const d = U.lire(fl); const p = D.produit(db, d.produit); if (!p) return; const q = Math.max(1, Math.round(+d.qte || 1));
          const pa = D.prixAchat(db, r.tiers, p.id); const pu = d.pu !== '' ? +d.pu : D.arrondi((+pa.pu || 0) * (1 - (+pa.remise || 0) / 100));
          const l = r.lignes.find((x) => x.produit === p.id && x.pu === pu); if (l) l.qte += q; else r.lignes.push({ produit: p.id, desc: p.libelle, ref_fourn: pa.ref || '', qte: q, pu });
          fin(); });
        el.querySelectorAll('[data-qte]').forEach((i) => i.addEventListener('change', () => { const q = Math.round(+i.value); if (q > 0) { r.lignes[+i.dataset.qte].qte = q; fin(); } else i.value = r.lignes[+i.dataset.qte].qte; }));
        el.addEventListener('click', (e) => {
          const s = e.target.closest('[data-suppr-l]'); if (s) { r.lignes.splice(+s.dataset.supprL, 1); fin(); return; }
          if (e.target.closest('[data-valider]') && r.lignes.length) {
            v.confirmer(`Valider le retour ${r.ref} ?`, `${D.nombre(qteTot(r))} article(s) renvoyé(s) à ${esc(t.nom || 'ce fournisseur')} (${D.euros(ht(r))} HT). Le stock de chaque article sera déduit.`, 'Valider et déduire le stock', () => {
              const ancien = r.ref; r.ref = D.prochaineRef(db, 'rf', r.date); r.etat = 'valide'; r.valide_par = D.MOI; r.valide_le = D.maintenant();
              r.lignes.forEach((l) => { if (l.produit) D.mouvement(db, l.produit, -(+l.qte || 0), `Retour fournisseur ${r.ref} — ${t.nom || ''}`.trim(), { nature: 'retour', doc: { type: 'retour', id: r.id } }); });
              evtR(db, r, `Retour fournisseur ${r.ref} validé (brouillon ${ancien}) : stock déduit`); fin(`${r.ref} validé : stock déduit.`); });
            return; }
          if (e.target.closest('[data-supprimer]')) {
            v.confirmer(`Supprimer le brouillon ${r.ref} ?`, 'Le stock n’a pas été touché.', 'Supprimer', () => { db.retours = retours(db).filter((x) => x !== r); evtR(db, r, `Retour fournisseur ${r.ref} supprimé (brouillon)`); v.sauver(); v.aller('retour/liste/tous'); });
            return; }
          if (e.target.closest('[data-annuler]')) {
            v.confirmer(`Annuler le retour ${r.ref} ?`, 'Les articles seront remis en stock (les articles ne sont finalement pas partis chez le fournisseur).', 'Annuler et remettre en stock', () => {
              r.etat = 'annule'; r.annule_par = D.MOI; r.annule_le = D.maintenant();
              r.lignes.forEach((l) => { if (l.produit) D.mouvement(db, l.produit, +l.qte || 0, `Annulation du retour fournisseur ${r.ref}`, { nature: 'retour', doc: { type: 'retour', id: r.id } }); });
              evtR(db, r, `Retour fournisseur ${r.ref} annulé : stock remis`); fin(`${r.ref} annulé : stock remis.`); });
          }
        });
      } };
  }

  P.retour = (v, a) => (a[0] === 'nouveau' ? nouveau(v) : a[0] === 'fiche' ? fiche(v, a[1]) : liste(v, a[1]));
})();
