// FMD — CRM : corbeille « Récemment supprimés » (24 nov. 2026, demande de l'utilisateur : « une corbeille pour que quand je
// supprime on puisse restaurer ou supprimer définitivement, comme sur Photos d'Apple »).
// D.jeter(db, cle, doc) : retire le document de db[cle] et des liens des autres documents, le range dans db.corbeille
// (gardé 30 jours, puis effacé). Page « corbeille » (Outils › Récemment supprimés) : Restaurer, Supprimer définitivement, Tout vider.
// Données : db.corbeille = [{ id, cle, doc, liens: [{ cle, id, lien }], le, par }] (base du CRM, en ligne via erp-nuage.js).
(function () {
  'use strict';
  const D = window.FMDERP; if (!D) return;
  const P = (D.pages = D.pages || {});
  const JOURS = 30;
  const NOMS = { propositions: 'Proposition', commandes: 'Commande client', factures: 'Facture', achats: 'Commande fournisseur' };
  const corb = (db) => (db.corbeille = db.corbeille || []);
  const reste = (x) => Math.max(0, JOURS - Math.floor((Date.now() - new Date(x.le)) / 864e5));
  const purger = (db) => { const l = corb(db); const n = l.length; db.corbeille = l.filter((x) => reste(x) > 0); return n !== db.corbeille.length; };

  D.jeter = (db, cle, doc) => {
    db[cle] = (db[cle] || []).filter((x) => x.id !== doc.id);
    const liens = [];
    Object.keys(NOMS).forEach((k) => (db[k] || []).forEach((x) => { if (!Array.isArray(x.liens)) return;
      x.liens.filter((l) => l.id === doc.id).forEach((l) => liens.push({ cle: k, id: x.id, lien: l }));
      if (x.liens.some((l) => l.id === doc.id)) { x.liens = x.liens.filter((l) => l.id !== doc.id); D.toucher(x); } }));
    corb(db).push({ id: 'cb-' + doc.id, cle, doc, liens, le: new Date().toISOString(), par: D.MOI || '' });
    purger(db);
  };
  const restaurer = (db, x) => {
    if (!(db[x.cle] || []).some((y) => y.id === x.doc.id)) { (db[x.cle] = db[x.cle] || []).push(x.doc); D.toucher(x.doc); }
    (x.liens || []).forEach((l) => { const d = (db[l.cle] || []).find((y) => y.id === l.id); if (d) { d.liens = d.liens || []; if (!d.liens.some((y) => y.id === x.doc.id)) { d.liens.push(l.lien); D.toucher(d); } } });
    db.corbeille = corb(db).filter((y) => y !== x);
  };

  P.corbeille = (v) => {
    const db = v.db; const U = D.ui, esc = D.ui.esc; if (purger(db)) v.sauver();
    const l = corb(db).slice().sort((a, b) => String(b.le).localeCompare(String(a.le)));
    const ligne = (x) => { const d = x.doc; const t = d.tiers && D.tiers(db, d.tiers);
      return `<tr><td><b>${esc(NOMS[x.cle] || x.cle)} ${esc(d.ref || '')}</b><div class="erp-gris">${esc(t ? t.nom : '')}</div></td>
        <td>${D.jour(String(x.le).slice(0, 10))}${x.par ? `<div class="erp-gris">par ${esc(x.par)}</div>` : ''}</td>
        <td class="nb">${D.euros(D.ttc ? D.arrondi(D.ttc(d)) : 0)}</td><td>${reste(x)} j</td>
        <td class="nb"><button type="button" class="btn btn-ligne petit" data-cb-rest="${esc(x.id)}">↺ Restaurer</button> <button type="button" class="btn btn-ligne petit erp-danger" data-cb-sup="${esc(x.id)}">Supprimer définitivement</button></td></tr>`; };
    return { html: `<div class="erp-titre-page"><h1>Récemment supprimés <span class="erp-compte">${l.length}</span></h1>
        ${l.length ? '<button type="button" class="btn btn-ligne erp-danger" data-cb-vider>Tout supprimer définitivement</button>' : ''}</div>
      <p class="erp-gris">Les documents supprimés restent ici ${JOURS} jours, puis sont effacés pour de bon. « Restaurer » les remet à leur place, avec leurs liens.</p>
      ${l.length ? `<table class="registre erp-table"><thead><tr><th>Document</th><th>Supprimé le</th><th class="nb">Montant TTC</th><th>Reste</th><th></th></tr></thead><tbody>${l.map(ligne).join('')}</tbody></table>`
        : '<div class="erp-vide-page"><p class="erp-gris">La corbeille est vide.</p></div>'}`,
    apres: (el) => {
      const trouve = (id) => corb(db).find((x) => x.id === id);
      el.querySelectorAll('[data-cb-rest]').forEach((b) => b.addEventListener('click', () => { const x = trouve(b.dataset.cbRest); if (!x) return;
        restaurer(db, x); v.sauver(); v.aller(`${{ propositions: 'prop', commandes: 'cmd', factures: 'fact', achats: 'achat' }[x.cle]}/fiche/${x.doc.id}`); }));
      el.querySelectorAll('[data-cb-sup]').forEach((b) => b.addEventListener('click', () => { const x = trouve(b.dataset.cbSup); if (!x) return;
        v.confirmer(`Supprimer définitivement ${esc(x.doc.ref || '')} ?`, 'Il ne pourra plus être restauré.', 'Supprimer définitivement', () => { db.corbeille = corb(db).filter((y) => y !== x); v.sauver(); v.aller('corbeille'); }); }));
      const vd = el.querySelector('[data-cb-vider]'); if (vd) vd.addEventListener('click', () => v.confirmer('Vider la corbeille ?', `${corb(db).length} document(s) seront supprimés pour de bon. Ils ne pourront plus être restaurés.`, 'Tout supprimer', () => { db.corbeille = []; v.sauver(); v.aller('corbeille'); }));
    } };
  };
})();
