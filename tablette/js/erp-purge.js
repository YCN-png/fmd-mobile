// FMD — CRM › Outils › Remise à zéro (tests) (21 nov. 2026). Demande : « sur le CRM supprime toutes les commandes, devis,
// factures, il s'agit uniquement de tests » ; choix de l'utilisateur : devis + commandes clients, factures clients, commandes
// fournisseurs, retours fournisseur ; stock de tous les produits remis à 0 (historique des mouvements vidé) ; numérotation
// repartie de 1. Réservé aux administrateurs.
// Sécurité : nombres affichés avant, mot « SUPPRIMER » à taper, SAUVEGARDE COMPLÈTE envoyée en ligne avant toute suppression
// (Supabase Storage donnees-fmd/crm/sauvegardes/avant-remise-a-zero-<date>.json : documents, événements liés, mouvements,
// stocks et emplacements du magasin 3D, livraisons du magasin, compteurs). Sans sauvegarde en ligne réussie : rien n'est supprimé.
// La suppression passe par l'enregistrement normal du CRM (crm.json + table des produits) : tous les PC suivent.
// Gardés : tiers, contacts, produits (fiches, prix, fournisseurs), prix clients, arborescence, compta (comptes, opérations).
(function () {
  'use strict';
  const D = (window.FMDERP = window.FMDERP || {});
  const P = (D.pages = D.pages || {});
  const U = D.ui;
  const esc = U.esc;
  const COLL = [['propositions', 'Devis (propositions commerciales)'], ['commandes', 'Commandes clients'], ['factures', 'Factures clients'], ['achats', 'Commandes fournisseurs'], ['retours', 'Retours fournisseur']];
  const TYPES_DOCS = ['prop', 'cmd', 'fact', 'achat', 'retour', 'litige'];
  const COMPTEURS = ['pr', 'co', 'fa', 'po', 'rf', 'prov'];

  const bilan = (db) => {
    const n = (k) => (Array.isArray(db[k]) ? db[k].length : 0);
    const evts = (db.evenements || []).filter((e) => e.objet && TYPES_DOCS.includes(e.objet.type));
    const avecStock = db.produits.filter((p) => +p.stock || (Array.isArray(p.emplacements3d) && p.emplacements3d.length));
    return { docs: COLL.map(([k, l]) => [k, l, n(k)]), evts: evts.length, mouvements: (db.mouvements || []).length, produitsStock: avecStock.length, unites: db.produits.reduce((s, p) => s + (+p.stock || 0), 0), livraisons: (db.livraisonsMagasin || []).length };
  };

  P.purge = (v) => {
    const db = v.db; const admin = !!(v.ctx && v.ctx.admin);
    if (!admin) return { html: `${U.titrePage('alerte', 'Remise à zéro (tests)')}${U.vide('Réservé aux administrateurs.')}` };
    const b = bilan(db); const total = b.docs.reduce((s, x) => s + x[2], 0);
    const N = window.FMDERPNuage; const enLigne = !!(N && N.actif && N.sauvegarder);
    return { html: `${U.titrePage('alerte', 'Remise à zéro (tests)')}
      <div class="erp-bandeau-ancien"><b>Action définitive pour tous les PC.</b> Elle supprime les documents de test du CRM et remet le stock à zéro. Une sauvegarde complète est d’abord enregistrée en ligne (récupérable par Claude en cas d’erreur).</div>
      ${U.bloc('Ce qui sera supprimé', U.tableau([['', (x) => esc(x[0])], ['Nombre', (x) => `<b>${D.nombre(x[1])}</b>`, 'nb']], [
        ...b.docs.map(([, l, n]) => [l, n]),
        ['Événements liés à ces documents', b.evts], ['Mouvements de stock (historique complet)', b.mouvements],
        [`Stock remis à 0 (produits qui en ont : ${D.nombre(b.produitsStock)})`, b.unites], ['Livraisons du magasin 3D', b.livraisons]]))}
      ${U.bloc('Ce qui est gardé', '<p>Tiers (clients, prospects, fournisseurs), contacts, produits (fiches, photos, prix de vente, prix d’achat fournisseurs), prix clients, arborescence du catalogue, Compta (comptes, opérations, charges). Les numéros des documents repartent de 1 (PR-00000001, CO-00000001, FA-00000001…).</p>')}
      ${!enLigne ? '<p class="erp-moins">Le CRM n’est pas en ligne sur ce PC : la sauvegarde ne peut pas être faite, la remise à zéro est bloquée.</p>' : total + b.unites + b.mouvements === 0 ? U.vide('Rien à supprimer : le CRM est déjà vide de documents et de stock.')
        : U.form('erp-purge', `${U.ligne('Pour confirmer, tapez SUPPRIMER', U.inp('mot', '', { req: true, ph: 'SUPPRIMER' }), { req: true })}`, U.btn('Sauvegarder puis tout supprimer', 'supprimer', 'btn-metal erp-danger', 'type="submit"'))}`,
      apres: (el) => {
        const f = el.querySelector('#erp-purge'); if (!f) return;
        f.addEventListener('submit', async (e) => { e.preventDefault(); if (U.lire(f).mot !== 'SUPPRIMER') { v.notifier('Tapez exactement SUPPRIMER (en majuscules).'); return; }
          const bt = f.querySelector('[type=submit]'); bt.disabled = true;
          const etape = (t) => { bt.textContent = t; };
          const quand = new Date().toISOString().replace(/[:.]/g, '-');
          try {
            // 1. Version à jour du serveur (sinon une version ancienne de ce PC pourrait faire revenir des documents à la fusion)
            etape('Lecture du serveur…'); await N.synchroniser();
            const db0 = v.db; const b0 = bilan(db0);
            // 2. Sauvegarde complète en ligne
            etape('Sauvegarde en ligne…');
            const sauvegarde = { type: 'fmd-crm-avant-remise-a-zero', le: D.maintenant(), par: D.MOI, bilan: b0,
              documents: Object.fromEntries(COLL.map(([k]) => [k, db0[k] || []])), evenements: (db0.evenements || []).filter((x) => x.objet && TYPES_DOCS.includes(x.objet.type)),
              mouvements: db0.mouvements || [], livraisonsMagasin: db0.livraisonsMagasin || [], compteurs: db0.compteurs || {}, epoque: db0.epoque,
              stocks: db0.produits.filter((p) => +p.stock || (Array.isArray(p.emplacements3d) && p.emplacements3d.length)).map((p) => ({ id: p.id, ref: p.ref, stock: p.stock, emplacements3d: p.emplacements3d || null })) };
            await N.sauvegarder(`crm/sauvegardes/avant-remise-a-zero-${quand}.json`, JSON.stringify(sauvegarde));
            // 3. Suppression (nouvelle « époque » : les anciens compteurs ne reviennent pas par la fusion), puis 4. vérification
            const vider = (db) => {
              COLL.forEach(([k]) => { db[k] = []; });
              db.evenements = (db.evenements || []).filter((x) => !(x.objet && TYPES_DOCS.includes(x.objet.type)));
              db.mouvements = []; db.livraisonsMagasin = [];
              db.produits.forEach((p) => { if (+p.stock || (Array.isArray(p.emplacements3d) && p.emplacements3d.length)) { p.stock = 0; if (Array.isArray(p.emplacements3d)) p.emplacements3d = []; D.toucher(p); } });
              db.epoque = `${D.EPOQUE}-raz-${quand}`; D.recalculerCompteurs(db); };
            const reste = (db) => COLL.reduce((n, [k]) => n + ((db[k] || []).length), 0) + (db.mouvements || []).length;
            let essais = 0;
            do { essais += 1; etape(`Suppression…${essais > 1 ? ' (2e passage)' : ''}`); const db = v.db; vider(db);
              if (essais === 1) D.evt(db, `Remise à zéro des documents de test : ${b0.docs.map(([, l, n]) => `${n} ${l.toLowerCase()}`).join(', ')} ; stock remis à 0 (sauvegarde en ligne : avant-remise-a-zero-${quand}.json)`, { type: 'auto' });
              v.sauver(); await N.synchroniser(); } while (reste(v.db) && essais < 3);
            if (reste(v.db)) { bt.disabled = false; etape('Sauvegarder puis tout supprimer'); v.notifier('Des documents sont revenus depuis un autre PC : relancez la remise à zéro (une sauvegarde a été faite).'); v.rendre(); return; }
            v.notifier('Remise à zéro faite : documents de test supprimés, stock à 0, numérotation repartie de 1.'); v.aller('accueil');
          } catch (x) { bt.disabled = false; etape('Sauvegarder puis tout supprimer'); v.notifier('Remise à zéro interrompue : ' + (x.message || x) + ' (rien n’est supprimé si la sauvegarde a échoué).'); }
        });
      } };
  };
})();
