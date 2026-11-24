// FMD — CRM / ERP (refonte du 10 nov. 2026, sur le modèle du logiciel Dolibarr de FMD, captures dans
// « ECO SYSTEME FMD\CRM »). Ce fichier : structure des données + règles métier.
// 18 nov. 2026 : plus AUCUNE donnée fictive (demande de l'utilisateur). Le CRM démarre vide ; les fiches de l'ancienne
// démo (identifiants p1, t1, k1, pr0, co0, fa0, po0… : lettres + chiffres seulement) sont retirées à chaque chargement
// (D.retirerDemo). Les vraies fiches ont des identifiants D.id() (lettres + horodatage en base 36), jamais touchées.
// Enregistrement en ligne : js/erp-nuage.js (cache de ce PC : localStorage « fmd-crm-demo-v3 », nom gardé).
// Utilisé par js/erp-ui.js, erp-tiers.js, erp-catalogue.js, erp-commerce.js et js/crm.js (window.FMDERP).
(function () {
  'use strict';

  const D = (window.FMDERP = window.FMDERP || {});
  const CLE = 'fmd-crm-demo-v3';
  D.TVA = 20;
  D.MOI = 'Farid MEDEGUEB';
  D.COMMERCIAUX = ['Farid MEDEGUEB', 'Benoît CRASNIER'];
  // Niveaux de prix (comme Dolibarr : chaque client a un niveau, chaque produit a un prix par niveau).
  // Niveaux de prix supprimés (23 nov. 2026, choix de l'utilisateur) : un seul prix, le prix net (p.prix[0]). Voir js/erp-prix.js.
  D.NIVEAUX = ['Prix net'];
  D.CATEGORIES = [['visserie', 'Visserie & fixation'], ['outillage', 'Outillage'], ['quincaillerie', 'Quincaillerie & serrurerie'],
    ['collage', 'Collage & étanchéité'], ['electricite', 'Électricité & climatisation'], ['masquage', 'Peinture & masquage'], ['vetements', 'Vêtements de travail']];
  D.TYPES_TIERS = ['TPE', 'PME/PMI', 'Grand compte', 'Particulier', 'Administration'];
  D.STATUTS_PROSPECT = [['jamais', 'Jamais contacté'], ['a_contacter', 'À contacter'], ['en_cours', 'Contact en cours'], ['fait', 'Contact réalisé'], ['ne_pas', 'Ne pas contacter']];
  D.POTENTIELS = ['', 'Faible', 'Moyen', 'Fort'];
  D.CONDITIONS = ['À réception', '30 jours', '30 jours fin de mois', '45 jours fin de mois', '60 jours'];
  D.MODES = ['Virement', 'Chèque', 'Carte bancaire', 'Prélèvement', 'Espèces'];
  D.EXPEDITIONS = ['Retrait au comptoir', 'Livraison FMD', 'Transporteur', 'Coursier'];
  D.ORIGINES = ['Comptoir', 'Téléphone', 'E-mail', 'Site internet', 'Visite commerciale', 'Salon'];
  // Un seul endroit de stock (21 nov. 2026, demande : « supprime les différents entrepôts, tout le stock va au même endroit »).
  D.ENTREPOTS = ['Magasin'];
  // États des documents : [id, libellé long, couleur, libellé court]. Couleurs : neutre, att, info, ok, ko.
  D.ETATS = {
    prop: [['brouillon', 'Brouillon', 'neutre', 'Brouillon'], ['ouvert', 'Ouvert', 'att', 'Ouvert'], ['signee', 'Signée (à facturer)', 'ok', 'Signée'],
      ['non_signee', 'Non signée (fermée)', 'ko', 'Non signée'], ['facturee', 'Facturée', 'info', 'Facturée']],
    cmd: [['brouillon', 'Brouillon', 'neutre', 'Brouillon'], ['validee', 'Validée', 'att', 'Validée'], ['en_cours', 'En cours', 'info', 'En cours'],
      ['livree', 'Livrée', 'ok', 'Livrée'], ['facturee', 'Facturée', 'info', 'Facturée'], ['annulee', 'Annulée', 'ko', 'Annulée']],
    // Commandes fournisseurs (19 nov. 2026, demande : même visuel que les chantiers de FM'RENOV) : Commande envoyée → AR reçu →
    // Commande reçue → Attente de facture → Classée facturée. Anciens « Validé » / « Approuvé » : repassés en brouillon (D.migrerAchats).
    achat: [['brouillon', 'Brouillon', 'neutre', 'Brouillon'], ['commande', 'Commande envoyée', 'info', 'Envoyée'], ['ar_recu', 'AR reçu (confirmation)', 'info', 'AR reçu'],
      ['recue_partiel', 'Reçue partiellement', 'att', 'Reçue en partie'], ['recue', 'Commande reçue', 'att', 'Reçue'], ['attente_facture', 'Attente de facture', 'att', 'Attente facture'],
      ['facturee', 'Classée facturée', 'ok', 'Facturée'], ['annule', 'Annulé', 'ko', 'Annulé'], ['refuse', 'Refusé', 'ko', 'Refusé']],
    fact: [['impayee', 'Impayée', 'att', 'Impayée'], ['retard', 'En retard', 'ko', 'En retard'], ['payee', 'Payée', 'ok', 'Payée']],
    // Retours fournisseur (20 nov. 2026) : brouillon → validé (stock déduit) ; annulé après validation = stock remis.
    retour: [['brouillon', 'Brouillon', 'neutre', 'Brouillon'], ['valide', 'Validé (stock déduit)', 'ok', 'Validé'], ['annule', 'Annulé', 'ko', 'Annulé']],
  };
  D.ETAPES_ACHAT = ['Commande envoyée', 'AR reçu', 'Commande reçue', 'Attente de facture', 'Classée facturée'];
  // nombre d'étapes faites (0 = brouillon … 5 = classée facturée)
  D.etapeAchat = (d) => ({ commande: 1, ar_recu: 2, recue_partiel: 2, recue: 3, attente_facture: 4, facturee: 5 })[d.etat] || 0;
  // Encours fournisseur (19 nov. 2026) : factures fournisseur non payées = commandes « Classée facturée » pas encore payées.
  D.encoursFourn = (db, tiersId) => D.arrondi(db.achats.filter((a) => a.tiers === tiersId && a.etat === 'facturee' && !a.payee).reduce((s, a) => s + (+a.facture_ttc || D.ttc(a)), 0));
  D.migrerAchats = (db) => { let ch = false; (db.achats || []).forEach((a) => { if (a.etat === 'valide' || a.etat === 'approuve') { a.etat = 'brouillon'; D.toucher(a); ch = true; } }); return ch; };
  D.etat = (type, id) => D.ETATS[type].find((e) => e[0] === id) || D.ETATS[type][0];

  // ---------- outils ----------
  const fmtE = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
  const fmtR = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  const fmtN = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
  D.euros = (n) => fmtE.format(n || 0);
  D.eurosRond = (n) => fmtR.format(n || 0);
  D.nombre = (n) => fmtN.format(n || 0);
  // Coefficient de marge (23 nov. 2026) = prix de vente HT ÷ prix de revient HT (ex. coef. 1,60 : vendu 1,60 € pour 1 € de revient).
  // Sans prix de revient : pas de coefficient (null / texte vide).
  D.coefMarge = (vente, revient) => (+revient > 0 ? (+vente || 0) / +revient : null);
  D.coefTxt = (vente, revient) => { const c = D.coefMarge(vente, revient); return c == null ? '' : `coef. ${c.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; };
  // « 120,00 € · 37 % · coef. 1,60 » : marge en €, taux de marge (sur le prix de vente) et coefficient
  D.margeTxt = (vente, revient) => { const m = (+vente || 0) - (+revient || 0); const c = D.coefTxt(vente, revient);
    return `${D.euros(m)}${+vente ? ` · ${Math.round((m / +vente) * 100)} %` : ''}${c ? ` · ${c}` : ''}`; };
  D.iso = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
  D.auj = () => D.iso(new Date());
  D.ajout = (d, n) => { const x = new Date(String(d).length === 10 ? d + 'T12:00:00' : d); x.setDate(x.getDate() + n); return D.iso(x); };
  D.jour = (d) => (d ? new Date(String(d).length === 10 ? d + 'T12:00:00' : d).toLocaleDateString('fr-FR') : '—');
  D.heure = (d) => (d && String(d).length > 10 ? new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '');
  D.maintenant = () => new Date().toISOString();
  D.id = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  D.arrondi = (n) => Math.round(n * 100) / 100;

  // ---------- montants ----------
  D.htLigne = (l) => D.arrondi(l.qte * l.pu * (1 - (l.remise || 0) / 100));
  D.ht = (doc) => D.arrondi(doc.lignes.reduce((s, l) => s + D.htLigne(l), 0));
  // Ventes comptées dans le CA, la marge, le top et les statistiques produits (24 nov. 2026) : commandes clients
  // + factures importées sans commande (import de l'historique, erp-historique.js) + avoirs (en négatif : un avoir baisse
  // le CA et la marge). Les factures « normales » viennent d'une commande : déjà comptées par elle.
  D.ventes = (db) => [...(db.commandes || []), ...(db.factures || []).filter((f) => f.avoir || (f.importe && !f.cmd_importee)).map((f) => ({ ...f, etat: 'livree', facturee: true, vente_facture: true }))];
  D.tva = (doc) => D.arrondi(doc.lignes.reduce((s, l) => s + D.htLigne(l) * (l.tva ?? D.TVA) / 100, 0));
  D.ttc = (doc) => D.arrondi(D.ht(doc) + D.tva(doc));
  // Prix de revient (19 nov. 2026, signalé : « j'ai rajouté un prix d'achat et la marge ne s'est pas recalculée ») :
  // PMP s'il est connu (> 0), sinon le meilleur prix d'achat net des fournisseurs (onglet « Prix d'achat » du produit).
  D.prixRevient = (p) => { if (!p) return 0; if (+p.pmp > 0) return +p.pmp;
    const f = (p.fournisseurs || []).map((x) => (+x.pu || 0) * (1 - (+x.remise || 0) / 100)).filter((x) => x > 0);
    return f.length ? D.arrondi(Math.min(...f)) : 0; };
  // Prix d'achat d'une ligne de document : celui écrit sur la ligne (colonne « P. achat »), sinon celui du produit (à jour).
  D.paLigne = (db, l) => (l.pa != null && l.pa !== '' ? +l.pa : D.prixRevient(l.produit && D.produit(db, l.produit)));
  D.cout = (db, doc) => D.arrondi(doc.lignes.reduce((s, l) => s + D.paLigne(db, l) * (+l.qte || 0), 0));
  // Commande client : « Facturée » dès qu'une facture a été créée depuis elle (20 nov. 2026) ; d.etat garde la livraison
  // (validée / en cours / livrée) pour le stock et le bouton « Classer livrée ».
  D.etatCommande = (c) => (c.facturee && c.etat !== 'brouillon' && c.etat !== 'annulee' ? 'facturee' : c.etat);
  // Commandes à facturer (facturation de fin de mois) : validées, en cours ou livrées, sans facture
  D.commandeNonFacturee = (c) => ['validee', 'en_cours', 'livree'].includes(c.etat) && !c.facturee && !(c.liens || []).some((l) => l.type === 'fact');
  D.etatFacture = (f) => (f.payee ? 'payee' : (f.echeance < D.auj() ? 'retard' : 'impayee'));

  // ---------- accès ----------
  D.tiers = (db, id) => db.tiers.find((t) => t.id === id);
  D.produit = (db, id) => db.produits.find((p) => p.id === id);
  D.nature = (t) => (t.client ? 'C' : t.prospect ? 'P' : '') + (t.fournisseur ? 'F' : '');
  // ---------- Site web (js/site.js) : rayon du site et variantes (10 nov. 2026) ----------
  // Chaque produit du CRM peut être publié sur le site (p.web_publie, oui par défaut) dans un rayon choisi (p.web_rayon ;
  // vide = automatique selon la catégorie). Les références qui ont le même « modèle » (p.modele) forment UNE page sur le
  // site, avec le choix de la couleur (p.couleur) et de la taille (p.taille) : chaque variante garde sa propre référence,
  // son prix et son stock.
  D.RAYONS_SITE = [['outillage', 'Outillage & atelier'], ['visserie', 'Visserie'], ['quincaillerie', 'Quincaillerie & fixations'], ['electricite', 'Électricité'],
    ['sanitaire', 'Sanitaire, chauffage & climatisation'], ['peinture', 'Peinture, collage & étanchéité'], ['vetements', 'Vêtements de travail'], ['automobile', 'Automobile'], ['metiers', 'Métiers']];
  D.TAILLES = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL', 'Unique'];
  const estClim = (p) => /climatisation|soufflage|aldes/i.test(`${p.libelle} ${p.marque}`);
  D.rayonSite = (p) => {
    if (p.web_rayon && D.RAYONS_SITE.some((r) => r[0] === p.web_rayon)) return p.web_rayon;
    return { outillage: 'outillage', visserie: 'visserie', quincaillerie: 'quincaillerie', collage: 'peinture', masquage: 'peinture', vetements: 'vetements' }[p.categorie]
      || (p.categorie === 'electricite' ? (estClim(p) ? 'sanitaire' : 'electricite') : 'outillage');
  };
  D.nomRayon = (id) => (D.RAYONS_SITE.find((r) => r[0] === id) || [id, id])[1];
  D.surLeSite = (p) => p.en_vente !== false && p.web_publie !== false;
  D.cleModele = (p) => (p.modele_id ? 'id:' + p.modele_id : p.modele && p.modele.trim() ? 'm:' + p.modele.trim().toLowerCase() : 'p:' + p.id);
  D.variantes = (db, p) => (p.modele_id || (p.modele && p.modele.trim()) ? db.produits.filter((x) => D.cleModele(x) === D.cleModele(p)) : [p]);

  // ---------- Produits à variantes (11 nov. 2026) ----------
  // Un « modèle » (db.modeles) = l'article commun (ex. « T-shirt Print Payper ») : fournisseur, catégorie, description, TVA,
  // prix par défaut, site web, image par défaut et image par couleur. Chaque variante (couleur × taille) est un VRAI produit
  // de db.produits (p.modele_id) avec sa référence, son code EAN, son prix d'achat, son prix de vente et son stock : devis,
  // commandes, stock et réappro fonctionnent sans rien changer. Écran : js/erp-modeles.js.
  D.modele = (db, id) => (db.modeles || []).find((m) => m.id === id);
  // Référence affichée d'un produit à variantes : « Début des références », sinon le début commun des réf. de ses variantes.
  D.refModele = (db, m) => { if (m.ref_base) return m.ref_base; const refs = db.produits.filter((p) => p.modele_id === m.id).map((p) => p.ref); if (!refs.length) return '';
    let c = refs[0]; refs.forEach((x) => { while (c && !x.startsWith(c)) c = c.slice(0, -1); }); return c.replace(/[-_. ]+$/, ''); };
  // TVA : p.tva = taux à la VENTE, p.tva_achat = taux à l'ACHAT (11 nov. 2026 ; absent = même taux qu'à la vente).
  D.tvaAchat = (p) => (p && p.tva_achat != null && p.tva_achat !== '' ? +p.tva_achat : p ? p.tva : D.TVA);
  // Règle de TVA de FMD (20 nov. 2026, demande : « à la vente la TVA est forcément de 20 % ; on est en autoliquidation :
  // fournisseur français → 20 % à l'achat, fournisseur hors France → 0 % ») : le taux ne se choisit plus, il est appliqué.
  // Hors France = pays renseigné autre que la France, ou numéro de TVA intracommunautaire d'un autre pays (BE…, DE…).
  D.PAYS = ['France', 'Belgique', 'Luxembourg', 'Allemagne', 'Pays-Bas', 'Italie', 'Espagne', 'Portugal', 'Suisse', 'Royaume-Uni', 'Irlande', 'Autriche', 'Pologne', 'République tchèque', 'Danemark', 'Suède', 'Finlande', 'Chine', 'Turquie', 'États-Unis', 'Autre pays'];
  D.horsFrance = (t) => { if (!t) return false;
    const num = String(t.tva_num || '').replace(/[\s.-]/g, '').toUpperCase();
    if (/^[A-Z]{2}\d/.test(num) && !num.startsWith('FR')) return true;
    const p = String(t.pays || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    return !!p && !/^(france|fr|fra|france metropolitaine)$/.test(p); };
  D.TEXTE_TVA = '20 % à la vente · à l’achat : 20 % si le fournisseur est français, 0 % hors France (autoliquidation)';
  D.tvaAchatFourn = (t) => (D.horsFrance(t) ? 0 : D.TVA);
  D.raisonTvaAchat = (t) => (D.horsFrance(t) ? `0 % — fournisseur hors France (${t.pays && !/^fr/i.test(t.pays) ? t.pays : 'n° TVA ' + t.tva_num}) : autoliquidation` : '20 % — fournisseur français');
  // Taux d'un document : achat → selon le fournisseur ; vente (proposition, commande, facture) → 20 %.
  D.tauxDoc = (db, type, d) => (type === 'achat' ? D.tvaAchatFourn(D.tiers(db, d && d.tiers)) : D.TVA);
  // Remet les bons taux partout (chargement, fusion avec le serveur, ouverture d'une fiche). Les factures déjà émises
  // (documents légaux) ne sont pas modifiées. Renvoie true si la base a changé.
  D.appliquerTva = (db) => { let ch = false;
    const fixer = (d, x) => { let m = false; (d.lignes || []).forEach((l) => { if (+l.tva !== x) { l.tva = x; m = true; } }); if (m) { D.toucher(d); ch = true; } };
    (db.propositions || []).forEach((d) => fixer(d, D.TVA));
    (db.commandes || []).forEach((d) => fixer(d, D.TVA));
    (db.achats || []).forEach((d) => fixer(d, D.tauxDoc(db, 'achat', d)));
    (db.produits || []).forEach((p) => { if (p.tva !== D.TVA) { p.tva = D.TVA; ch = true; } });
    (db.modeles || []).forEach((m) => { if (m.tva !== D.TVA) { m.tva = D.TVA; ch = true; } });
    return ch; };
  // Caractéristiques des variantes (11 nov. 2026) : Couleur et Taille + autres au choix du produit à variantes (m.axes, ex.
  // Diamètre, Longueur, Empreinte, Matériau, Quantité par boîte) ; valeurs des autres dans p.attributs { axe: valeur }.
  D.axesModele = (m) => ['Couleur', 'Taille', ...((m && m.axes) || [])];
  D.valeurAxe = (p, axe) => String((axe === 'Couleur' ? p.couleur : axe === 'Taille' ? p.taille : (p.attributs || {})[axe]) || '').trim();
  D.libelleVariante = (m, p) => { const ax = m.axes || [];
    // vis : « Diamètre Longueur » s'écrit « 4 × 16 »
    const dl = ax.includes('Diamètre') && ax.includes('Longueur') && D.valeurAxe(p, 'Diamètre') && D.valeurAxe(p, 'Longueur');
    const vals = ax.filter((a) => !(dl && a === 'Longueur')).map((a) => (dl && a === 'Diamètre' ? `${D.valeurAxe(p, 'Diamètre')} × ${D.valeurAxe(p, 'Longueur')}` : D.valeurAxe(p, a)));
    return [m.nom, p.couleur, p.taille, ...vals].map((t) => String(t || '').trim()).filter(Boolean).join(' '); };
  // Logos de certification / normes (CE, ETA, NF…) : bibliothèque commune db.certifs [{ id, nom, image }], cochés sur les
  // produits (p.certifs = [ids]) et les produits à variantes (recopiés sur leurs variantes).
  D.certifsDe = (db, x) => ((x && x.certifs) || []).map((id) => (db.certifs || []).find((c) => c.id === id)).filter(Boolean);
  // Photos d'un produit pour la galerie du site : sa photo, celle du produit à variantes, puis les photos supplémentaires.
  D.galerieProduit = (db, p) => { const m = p.modele_id && D.modele(db, p.modele_id);
    return [...new Set([p.image, m && D.imageVariante(m, p), m && m.image, ...((p.galerie && p.galerie.length ? p.galerie : (m && m.galerie)) || [])].filter((x) => typeof x === 'string' && x))]; };
  // Recopie sur les variantes ce qui est commun au modèle (appelé à chaque enregistrement du modèle ou des variantes).
  // ids (facultatif) : seulement ces variantes (ex. celles qu'on vient de créer). Une variante avec sa propre photo
  // (p.image_perso) la garde.
  D.imageVariante = (m, p) => ((m.images || {})[String(p.couleur || '').trim()] || m.image || '');
  D.appliquerModele = (db, m, ids) => {
    db.produits.filter((p) => p.modele_id === m.id && (!ids || ids.includes(p.id))).forEach((p) => {
      Object.assign(p, { modele: m.nom, marque: m.marque, categorie: m.categorie, souscat: m.souscat || '', soussouscat: m.soussouscat || '', description: m.description, tva: m.tva, tva_achat: m.tva_achat ?? m.tva, en_vente: m.en_vente !== false, en_achat: m.en_achat !== false,
        web_publie: m.web_publie !== false, web_rayon: m.web_rayon || '', libelle: D.libelleVariante(m, p), image: p.image_perso ? p.image : D.imageVariante(m, p),
        certifs: [...(m.certifs || [])], galerie: [...(m.galerie || [])] });
      D.toucher(p);
    });
  };
  // Anciennes variantes (0.4.36–0.4.37 : même « nom de modèle » saisi sur chaque produit) → un modèle de db.modeles.
  const migrerModeles = (db) => {
    db.modeles = db.modeles || [];
    const groupes = {};
    db.produits.filter((p) => !p.modele_id && p.modele && p.modele.trim()).forEach((p) => { const k = p.modele.trim().toLowerCase(); (groupes[k] = groupes[k] || []).push(p); });
    Object.values(groupes).forEach((l) => { const p0 = l[0];
      const m = { id: D.id('m'), nom: p0.modele.trim(), ref_base: '', marque: p0.marque || '', categorie: p0.categorie, description: p0.description || '', tva: p0.tva ?? 20,
        pv: (p0.prix || [0])[0], pa: p0.pmp || 0, en_vente: p0.en_vente !== false, en_achat: p0.en_achat !== false, web_publie: p0.web_publie !== false, web_rayon: p0.web_rayon || '', image: '', images: {}, cree: p0.cree || D.maintenant() };
      l.forEach((p) => { p.modele_id = m.id; if (p.image && p.couleur && !m.images[p.couleur]) m.images[p.couleur] = p.image; });
      db.modeles.push(m); });
    return db;
  };
  // Ordre des tailles : XS < S < M… puis nombres (38, 40…) puis le reste.
  D.ordreTaille = (t) => { const i = D.TAILLES.indexOf(String(t || '').toUpperCase()); if (i >= 0) return i; const n = parseFloat(t); return Number.isFinite(n) ? 100 + n : 1000; };
  // Couleurs courantes → pastille de couleur sur le site (sinon pastille neutre avec le nom).
  D.COULEURS = { blanc: '#ffffff', noir: '#111111', gris: '#8a8a8a', 'gris chiné': '#9d9d9d', anthracite: '#3b3f44', rouge: '#c62828', bordeaux: '#6d1a2a', rose: '#f2a7c1', orange: '#f57c00',
    jaune: '#fbc02d', 'jaune fluo': '#e4f322', vert: '#2e7d32', kaki: '#6b6b3a', 'vert bouteille': '#1f4d32', bleu: '#1e63c6', marine: '#1b2a4a', 'bleu marine': '#1b2a4a', 'bleu royal': '#2343a8',
    ciel: '#8cc6ee', 'bleu ciel': '#8cc6ee', turquoise: '#1fb5ad', violet: '#6a3d9a', marron: '#6d4c41', chocolat: '#4e342e', beige: '#d9c7a5', sable: '#d8c39a', camel: '#b98a4b', ecru: '#efe6d2', 'écru': '#efe6d2' };
  D.teinte = (nom) => D.COULEURS[String(nom || '').trim().toLowerCase()] || '';
  D.categorie = (id) =>(D.CATEGORIES.find((c) => c[0] === id) || [id, id || '—'])[1];
  D.encours = (db, tiersId) => D.arrondi(db.factures.filter((f) => f.tiers === tiersId && !f.payee).reduce((s, f) => s + D.ttc(f), 0));

  // ---------- prix automatique (devis, commandes) ----------
  // 1) prix client négocié s'il existe ; 2) sinon prix du niveau du client ; + remise client (%) mise en « Réduc. ».
  // Brouillons toujours à jour (19 nov. 2026, demande : « quand je crée / modifie quelque chose, tout doit être synchro,
  // dans la limite de la logique ») : dans un devis / une commande / une facture en BROUILLON, chaque ligne de produit
  // reprend le libellé actuel du produit, et son prix automatique (niveau de prix, prix client, remise du client) s'il
  // n'a pas été changé à la main (« prix modifié »). Commande fournisseur en brouillon : libellé seulement.
  // Documents validés : rien ne bouge (ce qui a été envoyé au client reste tel quel). Renvoie true si quelque chose a changé.
  D.actualiserBrouillon = (db, type, d) => {
    if (!d || d.etat !== 'brouillon') return false; let ch = false;
    (d.lignes || []).forEach((l) => { const p = l.produit && D.produit(db, l.produit); if (!p) return;
      const nom = p.libelle || [p.modele, p.couleur, p.taille].filter(Boolean).join(' ') || p.ref; if (nom && l.desc !== nom) { l.desc = nom; ch = true; }
      if (type !== 'achat' && l.auto && l.auto !== 'prix modifié') { const px = D.prixPour(db, d.tiers, p.id); const t = db.tiers.find((x) => x.id === d.tiers) || {};
        const auto = px.source === 'client' ? 'prix client' : px.source === 'promo' ? 'prix promo' : 'prix net';
        if (Math.abs((+l.pu || 0) - px.pu) >= 0.005 || (+l.remise || 0) !== (+px.remise || 0) || l.auto !== auto) { l.pu = px.pu; l.remise = px.remise || 0; l.auto = auto; ch = true; } } });
    if (ch) D.toucher(d); return ch; };
  D.prixPour = (db, tiersId, produitId) => {
    const p = D.produit(db, produitId); const t = D.tiers(db, tiersId);
    if (!p) return { pu: 0, remise: 0, detail: '' };
    const remise = (t && t.remise) || 0;
    const spec = db.prixClients.find((x) => x.tiers === tiersId && x.produit === produitId);
    // 23 nov. 2026 : prix net (plus de niveaux) ; prix promo en cours → proposé tel quel (sans remise client) ; prix négocié pour ce client sinon.
    if (spec) return { pu: spec.pu, remise, source: 'client', detail: `Prix négocié pour ce client (prix net : ${D.euros(p.prix[0])})${remise ? ` · remise client ${remise} %` : ''}` };
    if (D.promoActive && D.promoActive(p)) return { pu: +p.prix_promo, remise: 0, source: 'promo', detail: `Prix promo (prix net : ${D.euros(p.prix[0])})` };
    return { pu: p.prix[0], remise, source: 'net', detail: `Prix net${remise ? ` · remise client ${remise} %` : ''}` };
  };
  // Condition client d'un produit (19 nov. 2026, demande : « sur chaque produit je veux savoir si on a mis une condition au
  // client, avec le prix qu'on lui a donné et le prix de base juste à côté »). Prix de base = prix de vente public (niveau 1).
  // type : 'client' (prix négocié pour ce client), 'niveau' (niveau de prix 2 à 4), 'remise' (remise client seule), null.
  D.conditionClient = (db, tiersId, produitId) => {
    const p = D.produit(db, produitId); const t = D.tiers(db, tiersId); if (!p || !t) return null;
    const base = +(p.prix || [])[0] || 0; const px = D.prixPour(db, tiersId, produitId); const remise = +px.remise || 0;
    const net = D.arrondi(px.pu * (1 - remise / 100)); const n = 1;
    const type = px.source === 'client' ? 'client' : px.source === 'promo' ? 'promo' : remise ? 'remise' : null;
    const spec = db.prixClients.find((x) => x.tiers === tiersId && x.produit === produitId);
    return { type, base, pu: px.pu, remise, net, ecart: base ? Math.round(((net - base) / base) * 100) : 0, niveau: n, depuis: spec && spec.depuis };
  };
  D.dernierPrix = (db, tiersId, produitId) => {
    const docs = [...db.factures, ...db.commandes].filter((d) => d.tiers === tiersId).sort((a, b) => (b.date > a.date ? 1 : -1));
    for (const d of docs) { const l = d.lignes.find((x) => x.produit === produitId); if (l) return { pu: l.pu, remise: l.remise || 0, date: d.date, ref: d.ref }; }
    return null;
  };
  // Prix d'achat d'un produit chez un fournisseur (ou PMP).
  D.prixAchat = (db, fournId, produitId) => {
    const p = D.produit(db, produitId); if (!p) return { pu: 0, ref: '' };
    const f = (p.fournisseurs || []).find((x) => x.tiers === fournId);
    return f ? { pu: f.pu, ref: f.ref, remise: f.remise || 0 } : { pu: p.pmp, ref: '', remise: 0 };
  };

  // ---------- références ----------
  const aamm = (d) => { const x = new Date(String(d || D.auj()).slice(0, 10) + 'T12:00:00'); return String(x.getFullYear()).slice(2) + String(x.getMonth() + 1).padStart(2, '0'); };
  D.prochaineRef = (db, type, date) => {
    const c = db.compteurs; c[type] = (c[type] || 0) + 1; const n = c[type];
    if (type === 'cu') return `CU${aamm(date)}-${String(n).padStart(5, '0')}`;
    if (type === 'su') return `SU${aamm(date)}-${String(n).padStart(5, '0')}`;
    if (type === 'pr') return `PR-${String(n).padStart(8, '0')}`;
    if (type === 'co') return `CO-${String(n).padStart(8, '0')}`;
    if (type === 'fa') return `FA-${String(n).padStart(8, '0')}`;
    if (type === 'av') return `AV-${String(n).padStart(8, '0')}`; // avoir client (23 nov. 2026)
    if (type === 'po') return `PO${aamm(date)}-${String(n).padStart(4, '0')}`;
    if (type === 'rf') return `RF${aamm(date)}-${String(n).padStart(4, '0')}`;
    return `(PROV${n})`; // brouillon
  };
  // Brouillon : la référence dit de quel document il s'agit (19 nov. 2026, demande : « distinguer proposition commerciale
  // et commande ») → (PROV-PR3) proposition, (PROV-CO3) commande client, (PROV-PO3) commande fournisseur. Même compteur
  // « prov » qu'avant (aucun numéro réutilisé) ; remplacée par PR-… / CO-… / PO… à la validation.
  const PREFIXE_BROUILLON = { prop: 'PR', propositions: 'PR', cmd: 'CO', commandes: 'CO', achat: 'PO', achats: 'PO', retour: 'RF', retours: 'RF' };
  D.refBrouillon = (db, type) => { const r = D.prochaineRef(db, 'prov'); const p = PREFIXE_BROUILLON[type]; return p ? r.replace('(PROV', `(PROV-${p}`) : r; };
  // Anciens brouillons « (PROV12) » : renommés une fois selon leur type (même numéro). Renvoie true si la base a changé.
  // Prospect → client (19 nov. 2026, demande : « quand un prospect fait sa première commande il devient client et sort des
  // prospects ; enlever des prospects ceux qui sont déjà clients »). Un tiers n'est JAMAIS prospect et client à la fois.
  D.devenirClient = (db, tiersId) => { const t = D.tiers(db, tiersId); if (!t || t.client) return false;
    t.client = true; t.prospect = false; t.statut_prospect = 'fait';
    if (!t.code_client) { t.code_client = D.prochaineRef(db, 'cu'); t.compta_client = t.compta_client || '411' + String(t.nom || '').normalize('NFD').replace(/[^A-Za-z]/g, '').slice(0, 5).toUpperCase(); }
    D.toucher(t); D.evt(db, `${t.nom} est maintenant client (première commande)`, { tiers: t.id }); return true; };
  // Remise en ordre (à chaque chargement et synchronisation) : client + prospect → client seulement ; prospect qui a déjà
  // une commande (validée, en cours, livrée), une facture ou une proposition signée → client. Renvoie true si la base a changé.
  D.natureClients = (db) => { let ch = false; if (!db || !Array.isArray(db.tiers)) return false;
    const achete = new Set([...(db.commandes || []).filter((c) => ['validee', 'en_cours', 'livree'].includes(c.etat)), ...(db.factures || []), ...(db.propositions || []).filter((p) => ['signee', 'facturee'].includes(p.etat))].map((d) => d.tiers));
    db.tiers.forEach((t) => { if (t.client && t.prospect) { t.prospect = false; D.toucher(t); ch = true; } else if (t.prospect && achete.has(t.id)) ch = D.devenirClient(db, t.id) || ch; });
    return ch; };
  D.typerBrouillons = (db) => { let ch = false;
    ['propositions', 'commandes', 'achats'].forEach((k) => (db[k] || []).forEach((d) => { const m = /^\(PROV(\d+)\)$/.exec(d.ref || ''); if (m) { d.ref = `(PROV-${PREFIXE_BROUILLON[k]}${m[1]})`; ch = true; } }));
    return ch; };

  // ---------- journal (événements) ----------
  D.evt = (db, titre, o = {}) => {
    db.evenements.unshift({ id: D.id('ev'), d: o.d || D.maintenant(), par: o.par || D.MOI, tiers: o.tiers || null, objet: o.objet || null, titre, texte: o.texte || '', type: o.type || 'auto' });
    if (db.evenements.length > 600) db.evenements.length = 600;
  };
  D.toucher = (o) => { o.modifie = D.maintenant(); };
  // Toute nouvelle référence doit avoir un fournisseur (des Tiers) avec un prix d'achat (21 nov. 2026) : formulaire, variantes,
  // copie, import Excel, magasin 3D. Sert aussi au filtre des commandes fournisseurs.
  D.aFournisseur = (p) => (p && p.fournisseurs || []).some((f) => f && f.tiers && +f.pu > 0);

  // ---------- stock ----------
  // Nature d'un mouvement (20 nov. 2026, demande : « différencier les mouvements manuels, les entrées dues à une commande,
  // les retours au fournisseur, l'inventaire, et le nom de la personne ») : enregistrée dans m.nature ; pour les anciens
  // mouvements (et ceux du magasin 3D), déduite du motif. [id, libellé, couleur de pastille]
  D.NATURES_MVT = [['manuel', 'Manuel', 'neutre'], ['commande', 'Commande fournisseur', 'ok'], ['livraison', 'Commande client', 'info'],
    ['retour', 'Retour fournisseur', 'ko'], ['inventaire', 'Inventaire', 'att'], ['initial', 'Stock initial', 'neutre'], ['avoir', 'Retour client (avoir)', 'ok']];
  D.natureMouvement = (m) => {
    if (m && m.nature) return m.nature;
    const t = String((m && m.motif) || '');
    if (/retour fournisseur/i.test(t)) return 'retour';
    if (/retour client|avoir AV-/i.test(t)) return 'avoir';
    if (/inventaire/i.test(t)) return 'inventaire';
    if (/commande fournisseur|^réception/i.test(t)) return 'commande';
    if (/livraison (commande|client)/i.test(t)) return 'livraison';
    if (/stock initial|création de la fiche/i.test(t)) return 'initial';
    return 'manuel';
  };
  D.pastilleMouvement = (m) => { const n = D.natureMouvement(m); const x = D.NATURES_MVT.find((y) => y[0] === n) || D.NATURES_MVT[0];
    return `<span class="pastille st-${x[2]}"><i class="erp-point"></i>${x[1]}</span>`; };
  D.mouvement = (db, produitId, qte, motif, o = {}) => {
    const p = D.produit(db, produitId); if (!p) return;
    p.stock = D.arrondi((p.stock || 0) + qte); D.toucher(p);
    db.mouvements.unshift({ id: D.id('mv'), d: o.d || D.maintenant(), produit: produitId, entrepot: 'Magasin', qte, motif, nature: o.nature || D.natureMouvement({ motif }), par: o.par || D.MOI, ...(o.doc ? { doc: o.doc } : {}) });
    if (db.mouvements.length > 500) db.mouvements.length = 500;
  };

  // ---------- base vide et retrait de l'ancienne démo (18 nov. 2026) ----------
  const EPOQUE = 'reel-2026-11-18'; // numérotation repartie de zéro après le retrait de la démo (voir erp-nuage.js, compteurs)
  const vide = () => ({ version: 3, cree: D.maintenant(), epoque: EPOQUE, compteurs: {}, tiers: [], contacts: [], produits: [], prixClients: [], propositions: [], commandes: [], factures: [], achats: [], retours: [], evenements: [], mouvements: [], modeles: [] });
  const DEMO = { produits: /^p\d+$/, tiers: /^t\d+$/, contacts: /^k\d+$/, propositions: /^pr\d+$/, commandes: /^co\d+$/, factures: /^fa\d+$/, achats: /^po\d+$/ };
  const numFin = (ref) => { const m = /(\d+)\)?$/.exec(String(ref || '')); return m ? +m[1] : 0; };
  // Compteurs de références : repartent du plus grand numéro encore utilisé (jamais deux fois le même numéro).
  D.EPOQUE = EPOQUE;
  D.recalculerCompteurs = (db) => {
    const c = {}; const max = (k, v) => { if (v > (c[k] || 0)) c[k] = v; };
    (db.tiers || []).forEach((t) => { if (t.code_client) max('cu', numFin(t.code_client)); if (t.code_fourn) max('su', numFin(t.code_fourn)); });
    [['propositions', 'pr'], ['commandes', 'co'], ['factures', 'fa'], ['achats', 'po'], ['retours', 'rf']].forEach(([k, t]) => (db[k] || []).forEach((d) => { if (!d.ref_perso) max(/^\(PROV/.test(d.ref || '') ? 'prov' : t, numFin(d.ref)); })); // réf. tapée à la main : hors compteur
    db.compteurs = c; return c;
  };
  // Retire les fiches de la démo et tout ce qui s'y rattache. Renvoie true si la base a changé.
  D.retirerDemo = (db) => {
    if (!db || typeof db !== 'object') return false;
    const ids = new Set(); let retire = false;
    Object.entries(DEMO).forEach(([k, re]) => {
      if (!Array.isArray(db[k])) { db[k] = []; return; }
      const garde = db[k].filter((x) => { const demo = !!x && re.test(String(x.id)); if (demo) ids.add(String(x.id)); return !demo; });
      if (garde.length !== db[k].length) { retire = true; db[k] = garde; }
    });
    const lie = (v) => v != null && ids.has(String(v));
    const filtrer = (k, f) => { if (!Array.isArray(db[k])) { db[k] = []; return; } const n = db[k].length; db[k] = db[k].filter(f); if (db[k].length !== n) retire = true; };
    filtrer('prixClients', (x) => !lie(x.tiers) && !lie(x.produit));
    filtrer('mouvements', (x) => !lie(x.produit));
    filtrer('evenements', (x) => !lie(x.tiers) && !(x.objet && lie(x.objet.id)));
    if (ids.size) {
      db.contacts = db.contacts.filter((x) => !lie(x.tiers));
      db.produits.forEach((p) => { if (Array.isArray(p.fournisseurs)) p.fournisseurs = p.fournisseurs.filter((f) => !lie(f.tiers)); });
      ['propositions', 'commandes', 'factures', 'achats'].forEach((k) => db[k].forEach((d) => { if (Array.isArray(d.liens)) d.liens = d.liens.filter((l) => !lie(l.id)); }));
    }
    // Époque : EPOQUE, ou EPOQUE + « -raz-<date> » après une remise à zéro des documents de test (js/erp-purge.js, 21 nov. 2026) :
    // la fusion entre postes ne garde que les compteurs de la même époque → les anciens numéros ne reviennent pas.
    if (retire || !String(db.epoque || '').startsWith(EPOQUE)) {
      D.recalculerCompteurs(db); db.epoque = EPOQUE; retire = true;
    }
    return retire;
  };
  // Heure de création des documents sans heure (vue « Jour » des graphiques) : 8 h – 18 h, toujours la même.
  const ajouterHeures = (db) => { [db.propositions, db.commandes, db.factures, db.achats].forEach((l) => (l || []).forEach((d) => {
    if (String(d.cree || '').length === 10) { const h = [...String(d.ref || d.id)].reduce((x, c) => x + c.charCodeAt(0), 0); d.cree = `${d.cree}T${String(8 + (h % 11)).padStart(2, '0')}:${String((h * 7) % 60).padStart(2, '0')}:00`; } })); return db; };
  D.charger = () => {
    try { const s = localStorage.getItem(CLE); if (s) { const db = JSON.parse(s); if (db && db.version === 3) { const r = D.retirerDemo(db) | D.typerBrouillons(db) | D.natureClients(db) | D.migrerAchats(db); migrerModeles(ajouterHeures(db)); if (D.appliquerTva(db)) D.sauver(db); if (r) D.sauver(db); return db; } } } catch { /* stockage indisponible */ }
    const db = vide(); D.sauver(db); return db;
  };
  D.sauver = (db) => { try { localStorage.setItem(CLE, JSON.stringify(db)); } catch { /* stockage plein : reste en mémoire */ } };
  D.vide = vide;
})();
