// FMD — Compta & trésorerie (19 nov. 2026, demande de l'utilisateur : « reprendre le module compta, il doit ressembler à
// Qonto, avec un prévisionnel de trésorerie ; quand je valide la facturation d'une commande fournisseur ça le met
// automatiquement dans la trésorerie, pareil pour les commandes clients et les prospects : un vrai suivi compta » ;
// apparence : « comme Qonto mais avec ma D.A., les dégradés, les lueurs et tout »).
// RIEN À RESSAISIR : tout est lu dans le CRM (base window.FMDERP) à chaque affichage :
//  - RÉEL (dans le solde) : factures clients payées (date de paiement), commandes fournisseurs classées facturées et
//    payées, charges récurrentes passées « prélevées automatiquement », opérations saisies à la main, relevé de banque importé.
//  - PRÉVU : factures clients impayées (échéance), commandes clients validées / en cours / livrées pas encore facturées,
//    propositions signées sans commande, factures fournisseurs non payées (date + conditions du fournisseur), commandes
//    fournisseurs passées pas encore facturées, charges récurrentes à venir, opérations à venir saisies à la main.
//  - POTENTIEL (à part, courbe « si signées ») : propositions ouvertes (prospects et clients).
//  Une échéance dépassée est placée à aujourd'hui (« en retard »).
//  - Rapprochement : une ligne du relevé importé (même sens, même montant à 0,05 € près, 10 jours d'écart au plus) remplace
//    la facture / charge correspondante (jamais comptée deux fois).
// Données propres (db.compta de la base du CRM, enregistrée en ligne par js/erp-nuage.js) : comptes (solde de départ à une
// date), opérations (manuelles et relevé importé), charges récurrentes. Factures et commandes restent celles du CRM ;
// « Encaissée » / « Payée » ici met à jour le CRM (même base).
// Écrans : Accueil, Transactions, Trésorerie (prévisionnel), À encaisser, À payer, Charges récurrentes, Comptes.
// Utilisé par js/app.js : window.FMDCompta.monter(conteneur, ctx) → { detruire() }. Styles : .page-compta (app.css, cp-).
(function () {
  'use strict';

  // Plan de catégories des transactions (23 nov. 2026, liste fournie par l'utilisateur) : [clé, nom, sous-catégories, groupe].
  // Les clés restent stables (enregistrées sur chaque opération : categorie + souscat) ; « ventes » garde les recettes clients.
  const CATS = [['ventes', 'Ventes & encaissements clients', [], 'Recettes'],
    ['achats', '01 – Achats & Marchandises', ['Achats de marchandises destinées à la revente', 'Achats de matières premières', 'Achats de fournitures pour chantiers', 'Achats de consommables', 'Frais de transport sur achats', 'Frais de douane et importation', 'Emballages et conditionnements']],
    ['locaux', '02 – Locaux & Immobilier', ['Loyers commerciaux', 'Charges locatives', 'Électricité', 'Eau', 'Gaz et chauffage', 'Entretien et nettoyage des locaux', 'Travaux et réparations', 'Taxe foncière', 'Dépôt de garantie']],
    ['personnel', '03 – Personnel & Ressources humaines', ['Salaires', 'Cotisations URSSAF', 'Retraite et prévoyance', 'Mutuelle d’entreprise', 'Primes et commissions', 'Indemnités de déplacement', 'Titres-restaurant', 'Formation professionnelle', 'Médecine du travail', 'Recrutement et intérim']],
    ['vehicules', '04 – Véhicules & Déplacements', ['Carburant', 'Recharge électrique', 'Assurance automobile', 'Entretien et réparations', 'Pneumatiques', 'Leasing / LOA / LLD', 'Péages', 'Stationnement', 'Location de véhicules', 'Transport et déplacements professionnels', 'Hébergement professionnel']],
    ['informatique', '05 – Informatique & Télécommunications', ['Téléphonie mobile', 'Internet', 'Logiciels et abonnements SaaS', 'CRM / ERP', 'Hébergement web', 'Nom de domaine', 'Matériel informatique', 'Maintenance informatique', 'Cybersécurité']],
    ['marketing', '06 – Marketing & Communication', ['Publicité Google', 'Publicité réseaux sociaux', 'Impression de flyers et catalogues', 'Enseignes et signalétique', 'Création graphique', 'Site internet / E-commerce', 'Emailing et SMS marketing', 'Objets publicitaires', 'Sponsoring et partenariats', 'Promotions commerciales']],
    ['banque', '07 – Frais bancaires & Financiers', ['Frais de tenue de compte', 'Commissions TPE', 'Frais de virements', 'Frais de prélèvements', 'Intérêts d’emprunts', 'Frais de financement', 'Agios et découverts', 'Frais de change', 'Commissions de paiement en ligne']],
    ['assurances', '08 – Assurances', ['Responsabilité civile professionnelle', 'Assurance multirisque professionnelle', 'Assurance décennale', 'Protection juridique', 'Assurance marchandises / stock', 'Assurance perte d’exploitation', 'Assurance emprunteur']],
    ['admin', '09 – Administratif & Gestion', ['Expert-comptable', 'Commissaire aux comptes', 'Avocat et conseil juridique', 'Frais de création / modification d’entreprise', 'Frais de greffe et INPI', 'Fournitures administratives', 'Affranchissement et courrier', 'Abonnements professionnels', 'Prestations administratives']],
    ['impots', '10 – Impôts & Taxes', ['TVA versée', 'Impôt sur les sociétés', 'CFE', 'CVAE si applicable', 'Taxe sur les salaires', 'Taxes sur les véhicules', 'Autres impôts et contributions']],
    ['materiel', '11 – Matériel & Équipements', ['Outillage professionnel', 'Machines et équipements', 'Mobilier de bureau', 'Rayonnages et stockage', 'Matériel de manutention', 'Équipements de sécurité', 'Équipements de protection individuelle', 'Entretien du matériel', 'Location de matériel']],
    ['logistique', '12 – Logistique & Transport', ['Transporteurs', 'Livraison clients', 'Frais d’expédition', 'Fournitures d’emballage', 'Stockage externe', 'Manutention', 'Retours marchandises', 'Frais logistiques']],
    ['prestataires', '13 – Prestataires & Sous-traitance', ['Sous-traitance chantier', 'Sous-traitance commerciale', 'Prestations informatiques', 'Prestations de nettoyage', 'Prestations techniques', 'Conseil et accompagnement', 'Autres prestataires externes']],
    ['restauration', '14 – Restauration & Réception', ['Repas professionnels', 'Repas clients', 'Réceptions et événements', 'Cadeaux clients', 'Café et boissons pour le personnel', 'Frais de représentation']],
    ['financement', '15 – Financement & Investissements', ['Remboursement du capital d’emprunt', 'Acquisition de véhicules', 'Acquisition de matériel immobilisé', 'Travaux d’aménagement immobilisés', 'Dépôts et cautionnements', 'Crédit-bail – remboursement / redevances']],
    ['divers', '16 – Divers & Exceptionnel', ['Pénalités et amendes', 'Litiges et indemnisations', 'Dons et mécénat', 'Pertes et écarts de caisse', 'Dépenses exceptionnelles', 'Dépenses à identifier']],
    ['transferts', '17 – Transferts internes', ['Virement entre comptes de l’entreprise', 'Transfert vers compte épargne', 'Transfert de caisse'], 'Mouvements de trésorerie'],
    ['dirigeant', '18 – Dirigeant & Associés', ['Apport en compte courant', 'Remboursement de compte courant', 'Rémunération du dirigeant', 'Dividendes'], 'Mouvements de trésorerie'],
    ['regul', '19 – Régularisations & Remboursements', ['Remboursement fournisseur', 'Remboursement d’assurance', 'Remboursement de frais', 'Avoir fournisseur'], 'Mouvements de trésorerie'],
    ['a_regulariser', '20 – Opérations à régulariser', ['Paiement non identifié', 'Doublon bancaire', 'Opération en attente de justificatif'], 'Mouvements de trésorerie']];
  // Anciennes catégories (avant le 23 nov. 2026) → nouvelle catégorie + sous-catégorie (lecture seule : rien n'est réécrit)
  const ANCIENNES = { salaires: ['personnel', 'Salaires'], social: ['personnel', 'Cotisations URSSAF'], loyer: ['locaux', 'Loyers commerciaux'], energie: ['locaux', ''],
    telecom: ['informatique', ''], transport: ['vehicules', ''], autre: ['a_regulariser', ''] };
  // Catégorie (et sous-catégorie) devinée d'après le libellé d'une ligne de relevé : la première règle qui correspond gagne.
  const MOTS = [[/urssaf|pole emploi|france travail/i, 'personnel', 'Cotisations URSSAF'], [/retraite|prevoyance|humanis|malakoff|ag2r/i, 'personnel', 'Retraite et prévoyance'], [/mutuelle/i, 'personnel', 'Mutuelle d’entreprise'],
    [/\btva\b/i, 'impots', 'TVA versée'], [/\bcfe\b/i, 'impots', 'CFE'], [/dgfip|impot|tresor public/i, 'impots', ''],
    [/salaire|paie\b|acompte sal/i, 'personnel', 'Salaires'], [/loyer|\bbail\b|\bsci\b|foncia|nexity/i, 'locaux', 'Loyers commerciaux'],
    [/peage|autoroute|vinci autoroutes|sanef|aprr/i, 'vehicules', 'Péages'], [/parking|stationnement/i, 'vehicules', 'Stationnement'], [/sncf|air france|uber|taxi/i, 'vehicules', 'Transport et déplacements professionnels'],
    [/carburant|essence|gazole|station|esso|shell|\bbp\b|totalenergies station/i, 'vehicules', 'Carburant'],
    [/\bedf\b|engie|total ?energ|enedis/i, 'locaux', 'Électricité'], [/veolia|\beau\b|saur/i, 'locaux', 'Eau'], [/\bgaz\b|grdf/i, 'locaux', 'Gaz et chauffage'],
    [/google ads|adwords/i, 'marketing', 'Publicité Google'], [/facebook|meta platforms|linkedin|instagram|tiktok/i, 'marketing', 'Publicité réseaux sociaux'], [/vistaprint|imprim/i, 'marketing', 'Impression de flyers et catalogues'],
    [/\bovh|ionos|o2switch/i, 'informatique', 'Hébergement web'], [/google|microsoft|adobe|supabase|github|apple\.com|canva|openai|anthropic/i, 'informatique', 'Logiciels et abonnements SaaS'],
    [/orange|\bsfr\b|bouygues|\bfree\b/i, 'informatique', 'Téléphonie mobile'],
    [/assurance|\baxa\b|allianz|maaf|macif|generali|groupama|\bmma\b/i, 'assurances', ''],
    [/agios|decouvert/i, 'banque', 'Agios et découverts'], [/commission.*(cb|tpe|carte)|\btpe\b/i, 'banque', 'Commissions TPE'], [/frais|commission|cotisation|qonto|interets/i, 'banque', ''],
    [/restaurant|brasserie|traiteur/i, 'restauration', 'Repas professionnels']];
  const FREQ = [['mensuel', 'Tous les mois', 1], ['trimestriel', 'Tous les trimestres', 3], ['annuel', 'Tous les ans', 12]];
  const MENU = [['bord', 'Accueil', 'accueil'], ['operations', 'Transactions', 'mouvement'], ['tresorerie', 'Trésorerie', 'stats'], ['encaisser', 'À encaisser', 'facture'],
    ['payer', 'À payer', 'camion'], ['charges', 'Charges récurrentes', 'reappro'], ['depenses', 'Postes de dépenses', 'stats'], ['rapprochement', 'Rapprochement', 'valider'],
    ['comptes', 'Comptes', 'banque'], ['commissions', 'Commissions', 'client'], ['pennylane', 'Pennylane', 'web']]; // Commissions : commerciaux et administrateurs (js/erp-prix.js)
  const SRC = { facture: 'Facture client', achat: 'Facture fournisseur', cmd: 'Commande client', prop: 'Proposition', propo: 'Proposition (potentiel)', commande_f: 'Commande fournisseur',
    recurrente: 'Charge récurrente', manuel: 'Saisie manuelle', releve: 'Relevé de banque' };
  // Couleurs du camembert « Postes de dépenses » (D.A. FMD : rose gold + gris chauds, lisibles sur le fond noir)
  const COUL_CAT = ['#F7DAC5', '#C9987D', '#8C5E4B', '#E2B79D', '#A3735C', '#D9CFC8', '#7D6B60', '#EFB9A0', '#B5A49A', '#6F4A3C', '#F2E6DD', '#9E8576',
    '#DDB3A0', '#5E4438', '#C7B8AE', '#F5C9B0', '#8F7A6E', '#B88A72', '#E8DCD3', '#A06C55', '#4F3A31'];
  const MOTS_VIDES = new Set(['sarl', 'sas', 'sasu', 'eurl', 'les', 'des', 'et', 'de', 'du', 'la', 'le', 'societe', 'ste', 'ets', 'etablissements', 'groupe', 'france', 'sci', 'snc']);

  function monter(conteneur, ctx) {
    const D = window.FMDERP, U = D.ui, esc = U.esc;
    const lireLS = (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
    const ecrireLS = (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignoré */ } };
    let db = D.charger();
    const C = () => { const c = (db.compta = db.compta || {}); ['comptes', 'operations', 'recurrentes', 'factures'].forEach((k) => { c[k] = c[k] || []; }); return c; };
    const sauver = () => D.sauver(db);
    const notifier = (m) => { if (ctx && ctx.notifier) ctx.notifier(m); };
    if (ctx && ctx.moi && ctx.moi.nom) D.MOI = ctx.moi.nom; // personne connectée (commissions, événements)
    let route = lireLS('fmd-compta-route', 'bord'); const histo = [];
    let potentiel = lireLS('fmd-compta-potentiel', '1') === '1';
    let horizon = +lireLS('fmd-compta-horizon', '6') || 6;
    let perDep = lireLS('fmd-compta-depenses', 'annee'); let choixRappro = '';
    // Transactions cochées pour changer leur catégorie en une fois (23 nov. 2026) : ids des opérations (relevé / saisies)
    const choixOps = new Set(); let dernierChoix = '';

    // ---------- dates ----------
    const AUJ = () => D.auj();
    const moisDe = (d) => String(d || '').slice(0, 7);
    const ajoutMois = (iso, n) => { const x = new Date(String(iso).slice(0, 10) + 'T12:00:00'); const j = x.getDate(); x.setDate(1); x.setMonth(x.getMonth() + n); const fin = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate(); x.setDate(Math.min(j, fin)); return D.iso(x); };
    const finMois = (iso) => { const x = new Date(String(iso).slice(0, 10) + 'T12:00:00'); return D.iso(new Date(x.getFullYear(), x.getMonth() + 1, 0)); };
    const ecart = (a, b) => Math.abs((new Date(a + 'T12:00:00') - new Date(b + 'T12:00:00')) / 864e5);
    // échéance selon les conditions de règlement (« 30 jours fin de mois » → +30 j puis fin du mois)
    const echeance = (date, cond) => { const c = String(cond || ''); const n = /60/.test(c) ? 60 : /45/.test(c) ? 45 : /30/.test(c) ? 30 : 0; let d = D.ajout(String(date || AUJ()).slice(0, 10), n); if (/fin de mois/i.test(c)) d = finMois(d); return d; };
    const MOIS_C = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
    const libMois = (m) => { const [a, mm] = m.split('-'); return `${MOIS_C[+mm - 1]} ${String(a).slice(2)}`; };
    const jourLong = (d) => new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    // Catégories : [clé, sous-catégorie] ; les anciennes clés (salaires, loyer, autre…) sont lues dans le nouveau plan
    const catDe = (k) => CATS.find((c) => c[0] === k);
    const canon = (k, sous) => { if (catDe(k)) return [k, sous || '']; const a = ANCIENNES[k]; return a ? [a[0], sous || a[1]] : ['a_regulariser', sous || '']; };
    const nomCat = (k) => catDe(canon(k)[0])[1];
    const nomCourt = (k) => nomCat(k).replace(/^\d+ – /, '');
    const devinerCat = (lib, m) => { const r = MOTS.find(([re]) => re.test(lib || '')); return r ? [r[1], r[2] || ''] : [m > 0 ? 'ventes' : 'a_regulariser', '']; };
    const catOp = (o) => (o.categorie ? canon(o.categorie, o.souscat) : devinerCat(o.libelle, o.montant));
    const optsCat = (val) => { const g = {}; CATS.forEach((c) => { const n = c[3] || 'Dépenses'; (g[n] = g[n] || []).push(c); });
      return ['Recettes', 'Dépenses', 'Mouvements de trésorerie'].map((n) => `<optgroup label="${n}">${g[n].map((c) => `<option value="${c[0]}"${c[0] === val ? ' selected' : ''}>${esc(c[1])}</option>`).join('')}</optgroup>`).join(''); };
    const optsSous = (k, val) => { const l = (catDe(k) || [])[2] || []; return `<option value="">${l.length ? '— Sans sous-catégorie —' : '— Aucune sous-catégorie —'}</option>${l.map((x) => `<option value="${esc(x)}"${x === val ? ' selected' : ''}>${esc(x)}</option>`).join('')}`; };
    // Catégorie + sous-catégorie liées (la liste des sous-catégories suit la catégorie choisie : voir chgCat)
    const champsCat = (k, sous) => { const [c, so] = canon(k, sous); return `<div class="cp-2" data-cat-zone>${champ('Catégorie', `<select name="categorie" data-cat-pere data-sans-recherche>${optsCat(c)}</select>`)}${champ('Sous-catégorie', `<select name="souscat" data-cat-fils data-sans-recherche${((catDe(c) || [])[2] || []).length ? '' : ' disabled'}>${optsSous(c, so)}</select>`)}</div>`; };
    const chgCat = (e) => { const p = e.target.closest && e.target.closest('[data-cat-pere]'); if (!p) return; const z = p.closest('[data-cat-zone]'); const fi = z && z.querySelector('[data-cat-fils]');
      if (fi) { fi.innerHTML = optsSous(p.value, ''); fi.disabled = !((catDe(p.value) || [])[2] || []).length; } };
    conteneur.addEventListener('change', chgCat);
    const tiersDe = (id) => (id && D.tiers(db, id)) || null;

    // ---------- comptes ----------
    const comptes = () => (C().comptes.length ? C().comptes : [{ id: 'principal', nom: 'Compte courant', banque: '', solde: 0, date: '', virtuel: true }]);
    const comptePrincipal = () => comptes()[0];

    // ---------- flux (tout est recalculé à chaque affichage) ----------
    const ttc = (d) => D.arrondi(D.ttc(d));
    function occurrences(r, de, a) { // dates d'une charge récurrente entre de et a (inclus)
      const pas = (FREQ.find((f) => f[0] === r.frequence) || FREQ[0])[2]; const out = []; if (!r.debut) return out;
      let d = r.debut; let n = 0; while (d <= a && n < 400) { if (d >= de && (!r.fin || d <= r.fin)) out.push(d); n++; d = ajoutMois(r.debut, pas * n); }
      return out;
    }
    function flux() {
      const auj = AUJ(); const reels = []; const prevus = []; const potentiels = []; const c = C(); const cp = comptePrincipal().id;
      const fin = ajoutMois(auj, 13);
      const mettre = (l, x) => { if (x.date < auj && l !== reels) { x.retard = x.date; x.date = auj; } l.push(x); };
      // factures clients
      db.factures.forEach((f) => { if (f.importe) return; const t = tiersDe(f.tiers); const base = { montant: ttc(f), tiers: f.tiers, cat: 'ventes', sous: '', ref: f.ref, lib: `${t ? t.nom : 'Client'} · facture ${f.ref}`, doc: { type: 'fact', id: f.id }, compte: cp };
        if (f.payee) reels.push({ ...base, id: 'fa-' + f.id, src: 'facture', date: String(f.paiement || f.echeance || f.date).slice(0, 10) });
        else mettre(prevus, { ...base, id: 'fa-' + f.id, src: 'facture', date: f.echeance || echeance(f.date, f.cond || (t && t.cond)) }); });
      // commandes clients pas encore facturées
      db.commandes.filter((o) => !o.importe && ['validee', 'en_cours', 'livree'].includes(o.etat) && !o.facturee && !(o.liens || []).some((l) => l.type === 'fact')).forEach((o) => { const t = tiersDe(o.tiers);
        mettre(prevus, { id: 'co-' + o.id, src: 'cmd', montant: ttc(o), tiers: o.tiers, cat: 'ventes', ref: o.ref, lib: `${t ? t.nom : 'Client'} · commande ${o.ref}`, doc: { type: 'cmd', id: o.id }, compte: cp, date: echeance(o.livraison || o.date, o.cond || (t && t.cond)) }); });
      // propositions : signées sans commande → prévu ; ouvertes → potentiel
      db.propositions.forEach((p) => { if ((p.liens || []).some((l) => l.type === 'cmd' || l.type === 'fact')) return; const t = tiersDe(p.tiers);
        const x = { id: 'pr-' + p.id, montant: ttc(p), tiers: p.tiers, cat: 'ventes', ref: p.ref, lib: `${t ? t.nom : 'Prospect'} · proposition ${p.ref}${t && t.prospect ? ' (prospect)' : ''}`, doc: { type: 'prop', id: p.id }, compte: cp };
        if (p.etat === 'signee') mettre(prevus, { ...x, src: 'prop', date: echeance(p.date, p.cond || (t && t.cond)) });
        else if (p.etat === 'ouvert') mettre(potentiels, { ...x, src: 'propo', date: echeance(p.fin || p.date, p.cond || (t && t.cond)) }); });
      // commandes fournisseurs
      db.achats.forEach((a) => { const t = tiersDe(a.tiers); const cond = a.cond || (t && (t.cond_fourn || t.cond)); const m = -D.arrondi(+a.facture_ttc || D.ttc(a));
        const base = { id: 'po-' + a.id, montant: m, tiers: a.tiers, cat: 'achats', sous: 'Achats de marchandises destinées à la revente', ref: a.ref, doc: { type: 'achat', id: a.id }, compte: cp };
        if (a.etat === 'facturee') {
          if (a.payee) reels.push({ ...base, src: 'achat', lib: `${t ? t.nom : 'Fournisseur'} · facture ${a.facture_num || a.ref}`, date: String(a.paiement || a.facture_date || a.date).slice(0, 10) });
          else mettre(prevus, { ...base, src: 'achat', lib: `${t ? t.nom : 'Fournisseur'} · facture ${a.facture_num || a.ref}`, date: echeance(a.facture_date || a.date, cond) });
        } else if (['commande', 'ar_recu', 'recue_partiel', 'recue', 'attente_facture'].includes(a.etat)) mettre(prevus, { ...base, src: 'commande_f', lib: `${t ? t.nom : 'Fournisseur'} · commande ${a.ref}`, date: echeance(a.livraison || a.date, cond) }); });
      // charges récurrentes
      c.recurrentes.forEach((r) => { const m = (r.sens === 'entree' ? 1 : -1) * Math.abs(+r.montant || 0); const de = (comptes().find((x) => x.id === r.compte) || comptePrincipal()).date || r.debut;
        occurrences(r, de, fin).forEach((d) => { const x = { id: `rc-${r.id}-${d}`, src: 'recurrente', montant: m, cat: canon(r.categorie, r.souscat)[0], sous: canon(r.categorie, r.souscat)[1], lib: r.libelle, date: d, compte: r.compte || cp, recurrente: r.id };
          if (d <= auj && r.auto !== false) reels.push(x); else if (d > auj) prevus.push(x); }); });
      // factures importées dans la Compta (hors CRM, ex. EDF, loyer) : à payer / à encaisser tant qu'elles ne sont pas réglées
      c.factures.forEach((f) => { const m = (f.sens === 'entree' ? 1 : -1) * Math.abs(+f.montant || 0);
        const base = { id: 'fx-' + f.id, montant: m, tiers: f.tiers || '', cat: canon(f.categorie || (m > 0 ? 'ventes' : 'achats'), f.souscat)[0], sous: canon(f.categorie || (m > 0 ? 'ventes' : 'achats'), f.souscat)[1], ref: f.numero || '', lib: `${f.nom || 'Facture'} · facture ${f.numero || ''}`.trim(), doc: { type: 'ext', id: f.id }, compte: cp, src: m > 0 ? 'facture' : 'achat', ext: true };
        if (f.payee) reels.push({ ...base, date: String(f.paiement || f.date).slice(0, 10) }); else mettre(prevus, { ...base, date: f.echeance || f.date }); });
      // opérations saisies / importées
      const releve = [];
      c.operations.forEach((o) => { const x = { id: 'op-' + o.id, op: o, src: o.source === 'releve' ? 'releve' : 'manuel', montant: +o.montant || 0, cat: catOp(o)[0], sous: catOp(o)[1], lib: o.libelle, date: o.date, compte: o.compte || cp };
        if (o.source === 'releve') { releve.push(x); reels.push(x); } else if (o.date <= auj) reels.push(x); else prevus.push(x); });
      // rapprochement : la ligne du relevé remplace la facture / la charge (pas de double compte)
      const pris = new Set(); const lies = new Set();
      // rattachement validé (Rapprochement) : la transaction porte la facture (op.facture)
      reels.filter((r) => r.op && r.op.facture).forEach((r) => { const k = r.op.facture; pris.add(r.id); lies.add(`${k.type}:${k.id}`);
        const x = reels.find((y) => !y.rapproche && y.doc && y.doc.type === k.type && y.doc.id === k.id && (y.src === 'facture' || y.src === 'achat'));
        if (x) { x.rapproche = r.id; r.lien = x; if (!r.op.categorie) { r.cat = x.cat; r.sous = x.sous; } r.tiers = r.tiers || x.tiers; } else r.lien = { lib: k.lib || `facture ${k.ref || ''}`, ref: k.ref, doc: { type: k.type, id: k.id } }; });
      reels.filter((x) => !x.rapproche && ['facture', 'achat', 'recurrente'].includes(x.src)).forEach((x) => {
        const r = releve.find((y) => !pris.has(y.id) && Math.sign(y.montant) === Math.sign(x.montant) && Math.abs(y.montant - x.montant) <= 0.05 && ecart(y.date, x.date) <= 10);
        if (r) { pris.add(r.id); x.rapproche = r.id; r.lien = x; if (!r.op.categorie) { r.cat = x.cat; r.sous = x.sous; } r.tiers = r.tiers || x.tiers; if (x.doc) lies.add(`${x.doc.type}:${x.doc.id}`); } });
      return { reels: reels.filter((x) => !x.rapproche), prevus, potentiels, lies };
    }
    // solde actuel d'un compte : solde de départ + opérations réelles après la date du solde
    const soldeCompte = (F, cpt) => D.arrondi((+cpt.solde || 0) + F.reels.filter((x) => (x.compte || comptePrincipal().id) === cpt.id && (!cpt.date || x.date > cpt.date)).reduce((s, x) => s + x.montant, 0));
    const soldeTotal = (F) => D.arrondi(comptes().reduce((s, c) => s + soldeCompte(F, c), 0));
    const somme = (l) => D.arrondi(l.reduce((s, x) => s + x.montant, 0));
    // Série mensuelle : 5 mois passés, le mois en cours, puis l'horizon. Solde de fin de mois (réel / prévu / avec potentiel).
    function serie(F, nAvant = 5, nApres = horizon) {
      const auj = AUJ(); const actuel = soldeTotal(F); const out = [];
      for (let i = -nAvant; i <= nApres; i++) { const m = moisDe(ajoutMois(auj.slice(0, 8) + '01', i)); const finM = finMois(m + '-01');
        const re = F.reels.filter((x) => moisDe(x.date) === m), pr = F.prevus.filter((x) => moisDe(x.date) === m), po = F.potentiels.filter((x) => moisDe(x.date) === m);
        const entrees = somme([...re, ...pr].filter((x) => x.montant > 0)), sorties = -somme([...re, ...pr].filter((x) => x.montant < 0));
        let solde; if (finM <= auj) solde = D.arrondi(actuel - somme(F.reels.filter((x) => x.date > finM))); else solde = D.arrondi(actuel + somme(F.prevus.filter((x) => x.date <= finM)));
        const avecPot = D.arrondi(solde + (finM > auj ? somme(F.potentiels.filter((x) => x.date <= finM)) : 0));
        out.push({ m, lib: libMois(m), passe: finM <= auj, encours: m === moisDe(auj), entrees, sorties, solde, avecPot, pot: somme(po) }); }
      return out;
    }

    // ---------- graphiques (SVG) ----------
    const echelle = (v) => (Math.abs(v) >= 1000 ? `${(v / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} k€` : `${Math.round(v)} €`);
    function courbe(s, o = {}) {
      const W = 1000, H = o.h || 260, g = 46, d = 18, h = 26, b = 30; const n = s.length; const vals = s.flatMap((x) => [x.solde, potentiel ? x.avecPot : x.solde]);
      let min = Math.min(0, ...vals), max = Math.max(...vals, 0); if (max - min < 1000) max = min + 1000; const marge = (max - min) * 0.12; max += marge; if (min < 0) min -= marge;
      const X = (i) => g + (i * (W - g - d)) / Math.max(1, n - 1); const Y = (v) => h + ((max - v) * (H - h - b)) / (max - min || 1);
      const iA = s.findIndex((x) => x.encours); const pt = (i, v) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`;
      const reel = s.map((x, i) => (i <= iA ? pt(i, x.solde) : null)).filter(Boolean).join(' ');
      const prev = s.map((x, i) => (i >= iA ? pt(i, x.solde) : null)).filter(Boolean).join(' ');
      const pot = s.map((x, i) => (i > iA ? pt(i, x.avecPot) : i === iA ? pt(i, x.solde) : null)).filter(Boolean).join(' ');
      const aire = `${X(0)},${Y(min)} ${s.map((x, i) => pt(i, x.solde)).join(' ')} ${X(n - 1)},${Y(min)}`;
      const graduations = [0, 1, 2, 3].map((k) => min + ((max - min) * k) / 3);
      return `<svg class="cp-courbe" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Évolution du solde">
        <defs><linearGradient id="cpAire" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F7DAC5" stop-opacity=".38"/><stop offset="1" stop-color="#6F4A3C" stop-opacity="0"/></linearGradient>
          <linearGradient id="cpTrait" x1="0" x2="1"><stop offset="0" stop-color="#F7DAC5"/><stop offset="1" stop-color="#C99A80"/></linearGradient>
          <filter id="cpLueur" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="5" result="f"/><feMerge><feMergeNode in="f"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
        ${graduations.map((v) => `<line x1="${g}" x2="${W - d}" y1="${Y(v)}" y2="${Y(v)}" class="cp-grille"/><text x="${g - 8}" y="${Y(v) + 4}" text-anchor="end" class="cp-axe">${esc(echelle(v))}</text>`).join('')}
        ${min < 0 ? `<line x1="${g}" x2="${W - d}" y1="${Y(0)}" y2="${Y(0)}" class="cp-zero"/>` : ''}
        <polygon points="${aire}" fill="url(#cpAire)"/>
        ${iA >= 0 ? `<line x1="${X(iA)}" x2="${X(iA)}" y1="${h - 8}" y2="${H - b}" class="cp-auj"/><text x="${X(iA)}" y="${h - 12}" text-anchor="middle" class="cp-axe cp-auj-t">Aujourd’hui</text>` : ''}
        ${potentiel ? `<polyline points="${pot}" class="cp-l-pot"/>` : ''}
        <polyline points="${prev}" class="cp-l-prev"/>
        <polyline points="${reel}" class="cp-l-reel" filter="url(#cpLueur)"/>
        ${s.map((x, i) => `<g><circle cx="${X(i)}" cy="${Y(x.solde)}" r="${i === iA ? 6 : 3.5}" class="${i <= iA ? 'cp-pt' : 'cp-pt prev'}"/><title>${esc(x.lib)} : solde ${x.passe ? 'réel' : 'prévu'} ${D.euros(x.solde)}${potentiel && !x.passe ? ` · avec les propositions ouvertes ${D.euros(x.avecPot)}` : ''}</title></g>
          <text x="${X(i)}" y="${H - 8}" text-anchor="middle" class="cp-axe${x.encours ? ' fort' : ''}">${esc(x.lib)}</text>`).join('')}
      </svg>`;
    }
    function barres(s) {
      const max = Math.max(1, ...s.map((x) => Math.max(x.entrees, x.sorties)));
      return `<div class="cp-barres" role="img" aria-label="Entrées et sorties par mois">${s.map((x) => `<div class="cp-bcol${x.passe ? '' : ' prevu'}${x.encours ? ' encours' : ''}" title="${esc(x.lib)} · entrées ${D.euros(x.entrees)} · sorties ${D.euros(x.sorties)}${x.passe ? '' : ' (prévu)'}">
        <div class="cp-bzone"><i class="e" style="height:${(x.entrees / max) * 100}%"></i><i class="s" style="height:${(x.sorties / max) * 100}%"></i></div><span>${esc(x.lib)}</span></div>`).join('')}</div>`;
    }

    // ---------- briques ----------
    const montant = (m, o = {}) => `<b class="cp-mt ${m >= 0 ? 'pos' : 'neg'}${o.prevu ? ' prevu' : ''}">${m >= 0 ? '+' : '−'} ${D.euros(Math.abs(m)).replace('-', '')}</b>`;
    const icone = (x) => { const t = tiersDe(x.tiers); if (t) return U.avatar(t, 38);
      const l = { recurrente: '↻', manuel: '✎', releve: '⇄' }[x.src] || '€'; return `<span class="cp-ico cat-${esc(x.cat || 'a_regulariser')}">${l}</span>`; };
    const coche = (x) => `<span class="cp-op-g"><label class="cp-case" title="Sélectionner (Maj + clic : toute une plage)"><input type="checkbox" data-choix="${esc(x.op.id)}"${choixOps.has(x.op.id) ? ' checked' : ''} aria-label="Sélectionner ${esc(x.lib || 'la transaction')}"></label>${icone(x)}</span>`;
    // Validation (24 nov. 2026, demande : « les transactions doivent être "validées" après les avoir catégorisées pour savoir
    // lesquelles ont déjà été faites ») : seulement les lignes du relevé et les saisies (o.valide = { le, par }) ; les
    // transactions venant du CRM / des charges récurrentes ont une catégorie automatique (rien à valider).
    const boutonValide = (op) => (op.valide ? `<button type="button" class="cp-valide ok" data-valider="${esc(op.id)}" title="Validée le ${D.jour(op.valide.le)}${op.valide.par ? ` par ${esc(op.valide.par)}` : ''} — cliquer pour annuler la validation">✓ Validée</button>`
      : `<button type="button" class="cp-valide" data-valider="${esc(op.id)}" title="Catégorie vérifiée : marquer comme faite">Valider</button>`);
    const aValider = (x) => !!(x.op && !x.op.valide);
    const ligneOp = (x, o = {}) => `<div class="cp-op${o.prevu ? ' prevu' : ''}${o.choix && x.op && choixOps.has(x.op.id) ? ' choisie' : ''}${o.choix && aValider(x) ? ' a-valider' : ''}" ${x.op ? `data-op="${esc(x.op.id)}" tabindex="0" role="button"` : ''}>${o.choix ? (x.op ? coche(x) : `<span class="cp-op-g"><span class="cp-case vide" title="Catégorie automatique (facture ou charge récurrente)"></span>${icone(x)}</span>`) : icone(x)}
      <div class="cp-op-t"><b>${esc(x.lib || '—')}</b><small>${esc(SRC[x.src] || '')}${x.lien ? ` · rapproché : ${esc(x.lien.lib)}` : ''}${x.retard ? ` · <em class="cp-retard">en retard depuis le ${D.jour(x.retard)}</em>` : ''}${o.date ? ` · ${D.jour(x.date)}` : ''}</small></div>
      ${o.prevu ? '' : pastilleLien(x)}<span class="cp-cat" title="${esc(nomCat(x.cat))}${x.sous ? ` › ${esc(x.sous)}` : ''}">${esc(x.sous || nomCourt(x.cat))}</span>${o.choix ? (x.op ? boutonValide(x.op) : '<span class="cp-valide auto" title="Catégorie automatique (facture du CRM ou charge récurrente) : rien à valider">Auto</span>') : ''}${montant(x.montant, o)}</div>`;
    // Transaction rattachée à une facture (20 nov. 2026) : paiement d'une facture du CRM / importée, ou ligne de relevé rapprochée
    const rattachee = (x) => ['facture', 'achat'].includes(x.src) || !!(x.lien && x.lien.doc && ['fact', 'achat', 'ext'].includes(x.lien.doc.type));
    const refLien = (x) => (['facture', 'achat'].includes(x.src) ? x.ref : x.lien && (x.lien.ref || x.lien.lib)) || '';
    const pastilleLien = (x) => (rattachee(x) ? `<span class="cp-lien-f ok" title="Rattachée à la facture">${U.ico('facture')} ${esc(refLien(x))}</span>`
      : x.op ? `<button type="button" class="cp-lien-f non" data-rattacher="${esc(x.op.id)}" title="Choisir la facture de cette transaction">Non rattachée · Rattacher</button>` : '<span class="cp-lien-f non">Non rattachée</span>');
    const parJour = (l, o = {}) => { const g = {}; l.forEach((x) => { (g[x.date] = g[x.date] || []).push(x); });
      return Object.keys(g).sort((a, b) => (o.croissant ? a.localeCompare(b) : b.localeCompare(a))).map((d) => `<section class="cp-jour"><h4>${esc(jourLong(d))}<span>${montant(somme(g[d]), o)}</span></h4>${g[d].map((x) => ligneOp(x, o)).join('')}</section>`).join(''); };
    const carte = (titre, corps, o = {}) => `<section class="cp-carte ${o.cls || ''}">${titre ? `<header><h3>${titre}</h3>${o.droite || ''}</header>` : ''}${corps}</section>`;
    const vide = (t) => `<p class="cp-vide">${esc(t)}</p>`;
    const couleur = (v, cls) => `<span class="${v ? cls : ''}">${D.euros(v)}</span>`;
    const kpi = (lib, val, sous, cls = '') => `<div class="cp-kpi ${cls}"><small>${esc(lib)}</small><b>${val}</b>${sous ? `<span>${sous}</span>` : ''}</div>`;

    // ---------- fenêtre ----------
    function fenetre(titre, corps, pied, apres) {
      fermer(); const f = document.createElement('div'); f.className = 'cp-voile'; f.setAttribute('data-cp-fen', '');
      f.innerHTML = `<div class="cp-fen" role="dialog" aria-modal="true" aria-label="${esc(titre)}"><header><h3>${esc(titre)}</h3><button type="button" class="cp-x" data-fermer aria-label="Fermer">✕</button></header><div class="cp-fen-c">${corps}</div><footer>${pied}</footer></div>`;
      conteneur.appendChild(f); f.addEventListener('click', (e) => { if (e.target === f || e.target.closest('[data-fermer]')) fermer(); });
      if (apres) apres(f); const i = f.querySelector('input, select'); if (i) i.focus();
    }
    function fermer() { conteneur.querySelectorAll('[data-cp-fen]').forEach((x) => x.remove()); }
    const champ = (lib, html, aide) => `<label class="cp-champ"><span>${esc(lib)}</span>${html}${aide ? `<small>${esc(aide)}</small>` : ''}</label>`;
    const inp = (nom, val = '', o = {}) => `<input name="${nom}" type="${o.type || 'text'}" value="${esc(val)}"${o.req ? ' required' : ''}${o.step ? ` step="${o.step}"` : ''}${o.min != null ? ` min="${o.min}"` : ''}${o.ph ? ` placeholder="${esc(o.ph)}"` : ''}>`;
    const sel = (nom, opts, val) => `<select name="${nom}">${opts.map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(val) ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    const lireF = (f) => { const o = {}; new FormData(f).forEach((v, k) => { o[k] = typeof v === 'string' ? v.trim() : v; }); f.querySelectorAll('input[type=checkbox]').forEach((c) => { o[c.name] = c.checked; }); return o; };
    const optsComptes = () => comptes().map((c) => [c.id, c.nom]);

    // ---------- coquille ----------
    conteneur.classList.add('page-compta');
    conteneur.innerHTML = `
      <aside class="cp-cote"><div class="cp-marque"><span class="cp-logo">€</span><div><b>Compta</b><small>Trésorerie FMD</small></div></div>
        <nav data-menu></nav>
        <div class="cp-cote-pied"><button type="button" class="cp-btn plein" data-action="operation">${U.ico('plus')} Nouvelle opération</button><p data-etat></p></div></aside>
      <main class="cp-page" id="cp-page"></main>`;
    const zone = conteneur.querySelector('#cp-page');
    const N = window.FMDERPNuage;
    const etat = conteneur.querySelector('[data-etat]');
    const offEtat = N && N.actif && N.surEtat ? N.surEtat((e) => { etat.textContent = `En ligne · ${e.texte || ''}`; }) : (etat.textContent = 'Enregistré sur ce PC, envoyé en ligne dès que possible.', null);
    const section = (r) => r.split('/')[0];
    // Commissions : visibles des commerciaux (D.COMMERCIAUX ou commercial d'un client) et des administrateurs seulement
    const voitCommissions = () => !!((ctx && ctx.admin) || (D.estCommercial && D.estCommercial(db, D.MOI)));
    function menu() { const s = section(route);
      conteneur.querySelector('[data-menu]').innerHTML = MENU.filter(([r]) => r !== 'commissions' || voitCommissions()).map(([r, l, i]) => `<button type="button" class="cp-menu${s === r ? ' actif' : ''}" data-aller="${r}">${U.ico(i)}<span>${esc(l)}</span></button>`).join(''); }
    function aller(r, memePlace) {
      if (!r) return; db = D.charger();
      if (!memePlace && r !== route) { histo.push(route); if (histo.length > 50) histo.shift(); }
      if (pennyOuvert && section(r) !== 'pennylane') fermerPenny();
      route = r; ecrireLS('fmd-compta-route', r); menu(); fermer();
      const [tete, ...a] = r.split('/'); let res;
      try { res = (PAGES[tete] || PAGES.bord)(a); } catch (e) { console.error(e); res = { html: `<div class="cp-vide-page"><h1>Page indisponible</h1><p>${esc(e.message)}</p></div>` }; }
      const y = memePlace ? zone.scrollTop : 0; zone.innerHTML = `<div class="cp-contenu">${res.html}</div>`; zone.scrollTop = y;
      if (res.apres) { try { res.apres(zone.firstElementChild); } catch (e) { console.error(e); } }
    }
    const rendre = () => aller(route, true);
    const PAGES = {};
    // ===================== PENNYLANE (24 nov. 2026) =====================
    // Demande : « dans la partie compta, ajoute un accès à Pennylane ». Le site officiel app.pennylane.com affiché DANS
    // FMD par le lanceur (vue « compta-pennylane », session à part : connexion gardée sur ce PC, chacun se connecte avec
    // son propre compte Pennylane). Version web / site refusé : bouton « Ouvrir dans le navigateur ».
    const LANCEUR = window.lanceur || null; const URL_PENNY = 'https://app.pennylane.com/';
    let pennyOuvert = false; let pennyObs = null;
    const zonePenny = () => { const z = conteneur.querySelector('#cp-zone-penny'); if (!z || !LANCEUR || !pennyOuvert) return; const b = z.getBoundingClientRect(); LANCEUR.zoneModule({ x: b.left, y: b.top, width: b.width, height: b.height }); };
    function fermerPenny() { pennyOuvert = false; if (pennyObs) { pennyObs.disconnect(); pennyObs = null; } window.removeEventListener('resize', zonePenny); if (LANCEUR) LANCEUR.afficherModule(null); }
    PAGES.pennylane = () => ({
      html: `<div class="cp-penny-barre"><div><h1>Pennylane</h1><p>Votre comptabilité Pennylane, directement dans FMD. Connectez-vous une fois : FMD s’en souvient sur ce PC.</p></div>
          <div class="cp-penny-actions">${LANCEUR ? '<button type="button" class="cp-btn" data-penny="retour" title="Page précédente">‹ Retour</button><button type="button" class="cp-btn" data-penny="recharger">↻ Actualiser</button>' : ''}
            <button type="button" class="cp-btn plein" data-penny="navigateur">Ouvrir dans le navigateur</button></div></div>
        ${LANCEUR ? '<div class="cp-zone-penny" id="cp-zone-penny"><p>Chargement de Pennylane…</p></div>'
          : `<section class="cp-carte"><p class="cp-note">Pennylane s’affiche dans le logiciel FMD (.exe). Ici, ouvrez-le dans un nouvel onglet.</p><p><button type="button" class="cp-btn plein" data-penny="navigateur">Ouvrir Pennylane</button></p></section>`}`,
      apres: (el) => {
        el.addEventListener('click', (e) => { const b = e.target.closest('[data-penny]'); if (!b) return;
          if (b.dataset.penny === 'navigateur') window.open(URL_PENNY, '_blank');
          else if (b.dataset.penny === 'retour' && LANCEUR && LANCEUR.retourModule) LANCEUR.retourModule();
          else if (b.dataset.penny === 'recharger' && LANCEUR) LANCEUR.rechargerModule(); });
        if (!LANCEUR) return;
        pennyOuvert = true;
        Promise.resolve(LANCEUR.afficherModule('compta-pennylane')).then((r) => { if (r && r.ok === false) notifier('Pennylane ne s’ouvre pas dans FMD : ' + (r.erreur || '') + ' Utilisez « Ouvrir dans le navigateur ».'); zonePenny(); });
        const z = el.querySelector('#cp-zone-penny'); if (pennyObs) pennyObs.disconnect(); pennyObs = new ResizeObserver(zonePenny); pennyObs.observe(z); window.addEventListener('resize', zonePenny); zonePenny();
      },
    });
    // Commissions des commerciaux (23 nov. 2026, js/erp-prix.js : D.pageCommissions)
    PAGES.commissions = (a) => { if (!D.pageCommissions || !voitCommissions()) return { html: `${titre('Commissions')}${vide('Réservé aux commerciaux et aux administrateurs.')}` };
      const r = D.pageCommissions({ db, titre, carte, vide, admin: !!(ctx && ctx.admin) }, a); return { html: r.html, apres: r.apres ? (el) => r.apres(el, aller) : null }; };
    const titre = (t, sous, droite = '') => `<div class="cp-titre"><div><h1>${esc(t)}</h1>${sous ? `<p>${sous}</p>` : ''}</div><div class="cp-titre-d">${droite}</div></div>`;

    // ===================== ACCUEIL =====================
    PAGES.bord = () => {
      const F = flux(); const auj = AUJ(); const s = serie(F); const total = soldeTotal(F);
      const dans = (j) => D.arrondi(total + somme(F.prevus.filter((x) => x.date <= D.ajout(auj, j))));
      const mois = moisDe(auj); const reM = F.reels.filter((x) => moisDe(x.date) === mois);
      const aEnc = F.prevus.filter((x) => x.montant > 0 && ['facture'].includes(x.src)); const aPay = F.prevus.filter((x) => x.montant < 0 && x.src === 'achat');
      const proch = F.prevus.filter((x) => x.date <= D.ajout(auj, 30)).sort((a, b) => a.date.localeCompare(b.date));
      const derniers = [...F.reels].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
      const j30 = dans(30), j90 = dans(90);
      return { html: `${titre('Accueil', `Bonjour · ${esc(jourLong(auj))}`, `<button type="button" class="cp-btn" data-aller="tresorerie">${U.ico('stats')} Prévisionnel</button>`)}
        <div class="cp-hero">
          <div class="cp-solde"><small>Solde total</small><b class="cp-gros">${D.euros(total)}</b>
            <div class="cp-comptes">${comptes().map((c) => `<span class="cp-puce">${esc(c.nom)} · <b>${D.euros(soldeCompte(F, c))}</b></span>`).join('')}</div>
            ${comptes()[0].virtuel || !comptes()[0].date ? `<p class="cp-astuce">Renseignez le solde de votre compte en banque à une date (Comptes) : FMD calcule ensuite le solde avec les paiements.</p>` : ''}</div>
          <div class="cp-hero-kpis">${kpi('Dans 30 jours (prévu)', D.euros(j30), `${j30 - total >= 0 ? '▲' : '▼'} ${D.euros(Math.abs(j30 - total))}`, j30 < 0 ? 'ko' : '')}${kpi('Dans 90 jours (prévu)', D.euros(j90), `${j90 - total >= 0 ? '▲' : '▼'} ${D.euros(Math.abs(j90 - total))}`, j90 < 0 ? 'ko' : '')}
            ${kpi('Entrées ce mois', couleur(somme(reM.filter((x) => x.montant > 0)), 'pos'))}${kpi('Sorties ce mois', couleur(-somme(reM.filter((x) => x.montant < 0)), 'neg'))}</div></div>
        ${carte('Trésorerie', `${courbe(s)}<div class="cp-legende"><span class="l-reel">Réel</span><span class="l-prev">Prévu</span>${potentiel ? '<span class="l-pot">Avec les propositions ouvertes</span>' : ''}</div>${barres(s)}`, { cls: 'cp-large', droite: `<label class="cp-bascule"><input type="checkbox" data-potentiel${potentiel ? ' checked' : ''}><span>Propositions ouvertes</span></label>` })}
        <div class="cp-grille3">
          ${carte('À encaisser', `<b class="cp-moyen pos">${D.euros(somme(aEnc))}</b><p>${aEnc.length} facture${aEnc.length > 1 ? 's' : ''} client${aEnc.filter((x) => x.retard).length ? ` · <em class="cp-retard">${aEnc.filter((x) => x.retard).length} en retard</em>` : ''}</p><button type="button" class="cp-lien" data-aller="encaisser">Voir le détail →</button>`)}
          ${carte('À payer', `<b class="cp-moyen neg">${D.euros(-somme(aPay))}</b><p>${aPay.length} facture${aPay.length > 1 ? 's' : ''} fournisseur${aPay.filter((x) => x.retard).length ? ` · <em class="cp-retard">${aPay.filter((x) => x.retard).length} en retard</em>` : ''}</p><button type="button" class="cp-lien" data-aller="payer">Voir le détail →</button>`)}
          ${carte('Potentiel', `<b class="cp-moyen">${D.euros(somme(F.potentiels))}</b><p>${F.potentiels.length} proposition${F.potentiels.length > 1 ? 's' : ''} ouverte${F.potentiels.length > 1 ? 's' : ''} (pas dans le solde prévu)</p><button type="button" class="cp-lien" data-aller="encaisser">Voir le détail →</button>`)}
        </div>
        <div class="cp-grille2">
          ${carte('Prochaines échéances (30 jours)', proch.length ? parJour(proch.slice(0, 12), { prevu: true, croissant: true }) : vide('Rien de prévu dans les 30 prochains jours.'), { droite: '<button type="button" class="cp-lien" data-aller="tresorerie">Tout le prévisionnel →</button>' })}
          ${carte('Dernières transactions', derniers.length ? parJour(derniers) : vide('Aucune transaction : les factures payées du CRM et le relevé importé apparaîtront ici.'), { droite: '<button type="button" class="cp-lien" data-aller="operations">Toutes →</button>' })}
        </div>`,
      apres: brancherCommun };
    };
    // Valider une transaction : la catégorie (devinée ou choisie) est figée ; « à régulariser » = à catégoriser d'abord
    function validerOp(o) { const [c, so] = catOp(o); if (c === 'a_regulariser') return false; o.categorie = c; o.souscat = so; o.valide = { le: D.maintenant(), par: D.MOI }; D.toucher(o); return true; }
    function basculerValide(o) { if (!o) return;
      if (o.valide) { delete o.valide; D.toucher(o); sauver(); notifier('Validation annulée : la transaction repasse « à valider ».'); rendre(); return; }
      if (!validerOp(o)) { notifier('Catégorisez d’abord cette transaction (elle est « à régulariser »), puis validez-la.'); return; }
      sauver(); notifier('Transaction validée.'); rendre(); }
    function brancherCommun(el) {
      const p = el.querySelector('[data-potentiel]'); if (p) p.addEventListener('change', () => { potentiel = p.checked; ecrireLS('fmd-compta-potentiel', potentiel ? '1' : '0'); rendre(); });
      el.addEventListener('click', (e) => { if (e.target.closest('.cp-case')) return;
        const va = e.target.closest('[data-valider]'); if (va) { e.stopPropagation(); basculerValide(C().operations.find((x) => x.id === va.dataset.valider)); return; } const ra = e.target.closest('[data-rattacher]'); if (ra) { e.stopPropagation(); rattacherOp(C().operations.find((x) => x.id === ra.dataset.rattacher)); return; }
        const o = e.target.closest('[data-op]'); if (o) formOperation(C().operations.find((x) => x.id === o.dataset.op)); });
    }

    // ===================== TRANSACTIONS =====================
    let filtreOps = { q: '', sens: 'tous', periode: 'tout', src: 'tous', lien: 'tous', valid: 'tous' };
    PAGES.operations = () => {
      const F = flux(); const auj = AUJ(); const f = filtreOps;
      const debut = { mois: auj.slice(0, 8) + '01', trimestre: ajoutMois(auj, -3), annee: auj.slice(0, 4) + '-01-01', tout: '0000' }[f.periode];
      const n = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      const l = F.reels.filter((x) => x.date >= debut && (f.sens === 'tous' || (f.sens === 'entrees' ? x.montant > 0 : x.montant < 0)) && (f.src === 'tous' || x.src === f.src) && (f.lien === 'tous' || (f.lien === 'non' ? !rattachee(x) : rattachee(x))) && (!f.valid || f.valid === 'tous' || (f.valid === 'non' ? aValider(x) : !aValider(x)))
        && (!f.q || n(`${x.lib} ${nomCat(x.cat)} ${x.sous || ''} ${(tiersDe(x.tiers) || {}).nom || ''} ${x.ref || ''}`).includes(n(f.q))));
      const puce = (k, v, lib) => `<button type="button" class="cp-filtre${f[k] === v ? ' actif' : ''}" data-f="${k}" data-v="${v}">${esc(lib)}</button>`;
      // Sélection multiple : seules les lignes du relevé et les saisies portent leur propre catégorie
      const existe = new Set(C().operations.map((o) => o.id)); [...choixOps].forEach((id) => { if (!existe.has(id)) choixOps.delete(id); });
      const ids = l.filter((x) => x.op).map((x) => x.op.id); const nV = ids.filter((id) => choixOps.has(id)).length; const nS = choixOps.size;
      const pl = (n, m) => `${n} ${m}${n > 1 ? 's' : ''}`;
      const barreChoix = ids.length ? `<div class="cp-choix-b${nS ? ' actif' : ''}"><label class="cp-coche-tous"><input type="checkbox" data-choix-tous${nV && nV === ids.length ? ' checked' : ''}><span>${nS ? `<b>${pl(nS, 'transaction')} sélectionnée${nS > 1 ? 's' : ''}</b>${nS > nV ? ` <small>(dont ${nS - nV} masquée${nS - nV > 1 ? 's' : ''} par les filtres)</small>` : ''}` : `Tout sélectionner (${ids.length})`}</span></label>
        ${nS ? `<div class="cp-choix-a"><span class="cp-choix-cats" data-cat-zone><select data-choix-cat data-cat-pere data-sans-recherche aria-label="Nouvelle catégorie"><option value="">Catégorie…</option>${optsCat('')}</select><select data-choix-sous data-cat-fils data-sans-recherche aria-label="Sous-catégorie" disabled><option value="">Sous-catégorie…</option></select></span><button type="button" class="cp-btn" data-choix-ok>Appliquer</button><button type="button" class="cp-btn plein" data-choix-valider title="Applique la catégorie choisie (s’il y en a une) puis valide">✓ Valider</button><button type="button" class="cp-btn" data-choix-vider>Désélectionner</button></div>`
          : '<small class="cp-choix-aide">Cochez des transactions pour changer leur catégorie et les valider en une fois (Maj + clic : toute une plage).</small>'}</div>` : '';
      return { html: `${titre('Transactions', 'Tout ce qui est réellement entré ou sorti : factures payées, relevé de banque, saisies.', `<button type="button" class="cp-btn" data-aller="comptes">${U.ico('mouvement')} Importer un relevé</button><button type="button" class="cp-btn plein" data-action="operation">${U.ico('plus')} Opération</button>`)}
        <div class="cp-barre-f"><input type="search" class="cp-cherche" placeholder="Rechercher (libellé, client, fournisseur, catégorie…)" value="${esc(f.q)}" data-q>
          <div class="cp-filtres">${puce('sens', 'tous', 'Tout')}${puce('sens', 'entrees', 'Entrées')}${puce('sens', 'sorties', 'Sorties')}</div>
          <div class="cp-filtres">${puce('periode', 'mois', 'Ce mois')}${puce('periode', 'trimestre', '3 mois')}${puce('periode', 'annee', 'Cette année')}${puce('periode', 'tout', 'Tout')}</div>
          <div class="cp-filtres">${puce('src', 'tous', 'Toutes sources')}${puce('src', 'facture', 'Factures clients')}${puce('src', 'achat', 'Fournisseurs')}${puce('src', 'releve', 'Relevé')}${puce('src', 'manuel', 'Manuelles')}${puce('src', 'recurrente', 'Récurrentes')}</div>
          <div class="cp-filtres">${puce('valid', 'tous', 'Validées ou non')}${puce('valid', 'non', `À valider (${F.reels.filter(aValider).length})`)}${puce('valid', 'oui', 'Validées')}</div>
          <div class="cp-filtres">${puce('lien', 'tous', 'Rattachées ou non')}${puce('lien', 'non', `Non rattachées à une facture (${F.reels.filter((x) => !rattachee(x)).length})`)}${puce('lien', 'oui', 'Rattachées')}</div></div>
        <div class="cp-totaux">${kpi('Entrées', couleur(somme(l.filter((x) => x.montant > 0)), 'pos'))}${kpi('Sorties', couleur(-somme(l.filter((x) => x.montant < 0)), 'neg'))}${kpi('Solde de la période', D.euros(somme(l)))}${kpi('Transactions', String(l.length))}${kpi('À valider', String(l.filter(aValider).length), l.some(aValider) ? '<button type="button" class="cp-lien" data-f="valid" data-v="non">Voir →</button>' : 'tout est fait', l.some(aValider) ? '' : 'ok')}</div>
        ${barreChoix}
        ${carte('', l.length ? parJour(l, { choix: true }) : vide('Aucune transaction pour ces filtres.'), { cls: 'cp-liste' })}`,
      apres: (el) => { brancherCommun(el);
        const tous = el.querySelector('[data-choix-tous]'); if (tous) { tous.indeterminate = nV > 0 && nV < ids.length;
          tous.addEventListener('change', () => { ids.forEach((id) => (tous.checked ? choixOps.add(id) : choixOps.delete(id))); rendre(); }); }
        const ordre = [...el.querySelectorAll('[data-choix]')].map((c) => c.dataset.choix);
        el.querySelectorAll('[data-choix]').forEach((c) => c.addEventListener('click', (e) => { const id = c.dataset.choix;
          const a = ordre.indexOf(dernierChoix), b = ordre.indexOf(id);
          if (e.shiftKey && a >= 0 && b >= 0) ordre.slice(Math.min(a, b), Math.max(a, b) + 1).forEach((k) => (c.checked ? choixOps.add(k) : choixOps.delete(k)));
          else if (c.checked) choixOps.add(id); else choixOps.delete(id);
          dernierChoix = id; rendre(); }));
        const vider = el.querySelector('[data-choix-vider]'); if (vider) vider.addEventListener('click', () => { choixOps.clear(); rendre(); });
        const ok = el.querySelector('[data-choix-ok]'); if (ok) ok.addEventListener('click', () => { const cat = el.querySelector('[data-choix-cat]').value;
          if (!cat) { notifier('Choisissez d’abord la catégorie.'); el.querySelector('[data-choix-cat]').focus(); return; }
          const sous = el.querySelector('[data-choix-sous]').value || '';
          const ops = C().operations.filter((o) => choixOps.has(o.id)); ops.forEach((o) => { o.categorie = cat; o.souscat = sous; D.toucher(o); });
          sauver(); choixOps.clear(); notifier(`Catégorie « ${nomCourt(cat)}${sous ? ` › ${sous}` : ''} » appliquée à ${pl(ops.length, 'transaction')}.`); rendre(); });
        const va = el.querySelector('[data-choix-valider]'); if (va) va.addEventListener('click', () => { const cat = el.querySelector('[data-choix-cat]').value; const sous = el.querySelector('[data-choix-sous]').value || '';
          const ops = C().operations.filter((o) => choixOps.has(o.id)); let n = 0, refus = 0;
          ops.forEach((o) => { if (cat) { o.categorie = cat; o.souscat = sous; } if (validerOp(o)) n++; else { refus++; D.toucher(o); } });
          sauver(); choixOps.clear(); notifier(`${pl(n, 'transaction')} validée${n > 1 ? 's' : ''}${refus ? ` · ${refus} non validée${refus > 1 ? 's' : ''} (encore « à régulariser » : choisissez une catégorie)` : ''}.`); rendre(); });
        const q = el.querySelector('[data-q]'); q.addEventListener('input', () => { filtreOps.q = q.value; clearTimeout(q._t); q._t = setTimeout(() => { rendre(); const z = zone.querySelector('[data-q]'); if (z) { z.focus(); z.setSelectionRange(z.value.length, z.value.length); } }, 250); });
        el.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => { filtreOps[b.dataset.f] = b.dataset.v; rendre(); })); } };
    };

    // ===================== TRÉSORERIE (prévisionnel) =====================
    PAGES.tresorerie = () => {
      const F = flux(); const s = serie(F, 2, horizon); const futurs = s.filter((x) => !x.passe || x.encours);
      // 3 lignes seulement (20 nov. 2026) : entrées (factures clients, commandes et propositions signées à facturer), factures et
      // commandes fournisseurs, et tout le reste des dépenses = « Frais de fonctionnement » (charges récurrentes, opérations…)
      const fourn = (x) => x.src === 'achat' || x.src === 'commande_f';
      const groupes = [['Solde des factures clients', (x) => x.montant > 0], ['Factures fournisseurs', (x) => x.montant < 0 && fourn(x)], ['Frais de fonctionnement', (x) => x.montant < 0 && !fourn(x)]];
      const cellule = (m, f) => { const v = somme(F.prevus.filter((x) => moisDe(x.date) === m.m && f(x))); return `<td class="nb ${v > 0 ? 'pos' : v < 0 ? 'neg' : 'zero'}">${v ? D.euros(v) : '—'}</td>`; };
      const prochains = [...F.prevus, ...(potentiel ? F.potentiels : [])].sort((a, b) => a.date.localeCompare(b.date));
      const hz = (n, l) => `<button type="button" class="cp-filtre${horizon === n ? ' actif' : ''}" data-horizon="${n}">${l}</button>`;
      return { html: `${titre('Trésorerie', 'Prévisionnel calculé tout seul avec le CRM : factures, commandes clients et fournisseurs, propositions, charges récurrentes.', `<div class="cp-filtres">${hz(3, '3 mois')}${hz(6, '6 mois')}${hz(12, '12 mois')}</div>`)}
        <div class="cp-totaux">${kpi('Solde aujourd’hui', D.euros(soldeTotal(F)))}${kpi(`Solde prévu fin ${futurs[futurs.length - 1].lib}`, D.euros(futurs[futurs.length - 1].solde), '', futurs[futurs.length - 1].solde < 0 ? 'ko' : '')}
          ${kpi('Point le plus bas', D.euros(Math.min(...futurs.map((x) => x.solde))), esc(futurs.reduce((m, x) => (x.solde < m.solde ? x : m), futurs[0]).lib), Math.min(...futurs.map((x) => x.solde)) < 0 ? 'ko' : '')}
          ${kpi('Potentiel (propositions ouvertes)', D.euros(somme(F.potentiels)), `${F.potentiels.length} proposition(s)`)}</div>
        ${carte('Solde prévu', `${courbe(s, { h: 300 })}<div class="cp-legende"><span class="l-reel">Réel</span><span class="l-prev">Prévu</span>${potentiel ? '<span class="l-pot">Avec les propositions ouvertes</span>' : ''}</div>`, { cls: 'cp-large', droite: `<label class="cp-bascule"><input type="checkbox" data-potentiel${potentiel ? ' checked' : ''}><span>Propositions ouvertes</span></label>` })}
        ${carte('Tableau mois par mois', `<div class="cp-table-d"><table class="cp-table"><thead><tr><th></th>${futurs.map((m) => `<th class="nb">${esc(m.lib)}</th>`).join('')}</tr></thead><tbody>
          <tr class="fort"><td>Solde début</td>${futurs.map((m, i) => `<td class="nb">${D.euros(i ? futurs[i - 1].solde : soldeTotal(F))}</td>`).join('')}</tr>
          ${groupes.map(([l, f]) => `<tr><td>${esc(l)}</td>${futurs.map((m) => cellule(m, f)).join('')}</tr>`).join('')}
          <tr class="fort"><td>Solde fin (prévu)</td>${futurs.map((m) => `<td class="nb ${m.solde < 0 ? 'neg' : ''}">${D.euros(m.solde)}</td>`).join('')}</tr>
          ${potentiel ? `<tr class="pot"><td>+ propositions ouvertes</td>${futurs.map((m) => `<td class="nb">${m.pot ? D.euros(m.pot) : '—'}</td>`).join('')}</tr><tr class="pot"><td>Solde si signées</td>${futurs.map((m) => `<td class="nb">${D.euros(m.avecPot)}</td>`).join('')}</tr>` : ''}
          </tbody></table></div><p class="cp-note">« Solde des factures clients » : factures à encaisser + commandes et propositions signées pas encore facturées. « Factures fournisseurs » : factures et commandes fournisseurs. « Frais de fonctionnement » : toutes les autres dépenses (charges récurrentes, opérations prévues…).</p><p class="cp-note">Le mois en cours ne compte que ce qui reste à venir (le réel est déjà dans le solde). Une échéance dépassée est comptée aujourd’hui.</p>`)}
        ${carte('Tout ce qui est prévu', prochains.length ? parJour(prochains.map((x) => (x.src === 'propo' ? { ...x } : x)), { prevu: true, croissant: true }) : vide('Rien de prévu.'))}`,
      apres: (el) => { brancherCommun(el); el.querySelectorAll('[data-horizon]').forEach((b) => b.addEventListener('click', () => { horizon = +b.dataset.horizon; ecrireLS('fmd-compta-horizon', String(horizon)); rendre(); })); } };
    };

    // ===================== À ENCAISSER / À PAYER =====================
    PAGES.encaisser = () => {
      const F = flux(); const fa = F.prevus.filter((x) => x.src === 'facture').sort((a, b) => a.date.localeCompare(b.date));
      const co = F.prevus.filter((x) => x.src === 'cmd' || x.src === 'prop'); const po = F.potentiels;
      const ligne = (x, bouton) => `<div class="cp-op prevu">${icone(x)}<div class="cp-op-t"><b>${esc(x.lib)}</b><small>échéance ${D.jour(x.retard || x.date)}${x.retard ? ' · <em class="cp-retard">en retard</em>' : ''}</small></div>${montant(x.montant, { prevu: true })}${bouton || ''}</div>`;
      return { html: `${titre('À encaisser', 'Ce que les clients doivent à FMD, et ce qui va arriver.')}
        <div class="cp-totaux">${kpi('Factures à encaisser', `<span class="pos">${D.euros(somme(fa))}</span>`, `${fa.length} facture(s)`)}${kpi('Dont en retard', `<span class="neg">${D.euros(somme(fa.filter((x) => x.retard)))}</span>`, `${fa.filter((x) => x.retard).length} facture(s)`, fa.some((x) => x.retard) ? 'ko' : '')}
          ${kpi('Commandes à facturer', D.euros(somme(co)), `${co.length}`)}${kpi('Propositions ouvertes', D.euros(somme(po)), `${po.length} (potentiel)`)}</div>
        ${carte('Factures clients impayées', fa.length ? fa.map((x) => ligne(x, x.doc.type !== 'fact' ? '<button type="button" class="cp-btn petit" data-aller="rapprochement">Rapprocher</button>' : `<button type="button" class="cp-btn petit" data-encaisser="${x.doc.id}">Encaissée</button>`)).join('') : vide('Aucune facture impayée.'))}
        ${carte('Commandes clients et propositions signées (pas encore facturées)', co.length ? co.map((x) => ligne(x)).join('') : vide('Aucune.'))}
        ${carte('Propositions ouvertes (potentiel, hors solde prévu)', po.length ? po.map((x) => ligne(x)).join('') : vide('Aucune proposition ouverte.'))}`,
      apres: (el) => { brancherCommun(el); el.addEventListener('click', (e) => { const b = e.target.closest('[data-encaisser]'); if (!b) return; const f = db.factures.find((x) => x.id === b.dataset.encaisser); if (!f) return;
        fenetre(`Facture ${f.ref} encaissée`, `<form id="cp-enc">${champ('Date du paiement', inp('date', D.auj(), { type: 'date', req: true }))}${champ('Mode de règlement', sel('mode', D.MODES.map((m) => [m, m]), f.mode || 'Virement'))}<p class="cp-note">Montant : <b>${D.euros(D.ttc(f))}</b> TTC. La facture passe « Payée » dans le CRM.</p></form>`,
          '<button type="button" class="cp-btn" data-fermer>Annuler</button><button type="submit" form="cp-enc" class="cp-btn plein">Enregistrer</button>', (fe) => fe.querySelector('#cp-enc').addEventListener('submit', (ev) => { ev.preventDefault(); const c = lireF(ev.target);
            f.payee = true; f.paiement = c.date; f.mode = c.mode; D.toucher(f); D.evt(db, `Facture ${f.ref} passée à payée (${c.mode}, depuis la Compta)`, { tiers: f.tiers, objet: { type: 'fact', id: f.id } }); sauver(); fermer(); notifier('Paiement enregistré.'); rendre(); })); }); } };
    };
    PAGES.payer = () => {
      const F = flux(); const fa = F.prevus.filter((x) => x.src === 'achat').sort((a, b) => a.date.localeCompare(b.date)); const co = F.prevus.filter((x) => x.src === 'commande_f');
      const rc = F.prevus.filter((x) => x.src === 'recurrente' && x.montant < 0 && x.date <= D.ajout(AUJ(), 31));
      const ligne = (x, bouton) => `<div class="cp-op prevu">${icone(x)}<div class="cp-op-t"><b>${esc(x.lib)}</b><small>échéance ${D.jour(x.retard || x.date)}${x.retard ? ' · <em class="cp-retard">en retard</em>' : ''}</small></div>${montant(x.montant, { prevu: true })}${bouton || ''}</div>`;
      return { html: `${titre('À payer', 'Factures fournisseurs, commandes en cours et charges des 30 prochains jours.', `<button type="button" class="cp-btn plein" data-aller="importer">${U.ico('plus')} Importer des factures</button>`)}
        <div class="cp-totaux">${kpi('Factures fournisseurs à payer', `<span class="neg">${D.euros(-somme(fa))}</span>`, `${fa.length} facture(s)`)}${kpi('Dont en retard', `<span class="neg">${D.euros(-somme(fa.filter((x) => x.retard)))}</span>`, '', fa.some((x) => x.retard) ? 'ko' : '')}
          ${kpi('Commandes fournisseurs en cours', D.euros(-somme(co)), `${co.length}`)}${kpi('Charges des 30 jours', D.euros(-somme(rc)), `${rc.length}`)}</div>
        ${carte('Factures fournisseurs non payées', fa.length ? fa.map((x) => ligne(x, x.doc.type !== 'achat' ? `${x.doc.type === 'ext' && (C().factures.find((f) => f.id === x.doc.id) || {}).piece ? `<button type="button" class="cp-btn petit" data-piece-ext="${esc(x.doc.id)}" title="Voir la facture">📎</button>` : ''}<button type="button" class="cp-btn petit" data-aller="rapprochement">Rapprocher</button>` : `${(db.achats.find((o) => o.id === x.doc.id) || {}).facture_piece ? `<button type="button" class="cp-btn petit" data-piece-achat="${x.doc.id}" title="Voir la facture jointe à la commande">📎 Facture</button> ` : ''}<button type="button" class="cp-btn petit" data-payer="${x.doc.id}">Payée</button>`)).join('') : vide('Aucune facture fournisseur à payer.'))}
        ${carte('Commandes fournisseurs passées (pas encore facturées)', co.length ? co.map((x) => ligne(x)).join('') : vide('Aucune.'))}
        ${carte('Charges récurrentes des 30 prochains jours', rc.length ? rc.map((x) => ligne(x)).join('') : vide('Aucune charge prévue.'), { droite: '<button type="button" class="cp-lien" data-aller="charges">Gérer →</button>' })}`,
      apres: (el) => { brancherCommun(el); el.addEventListener('click', (e) => { const b = e.target.closest('[data-payer]'); if (!b) return; const a = db.achats.find((x) => x.id === b.dataset.payer); if (!a) return;
        fenetre(`Facture fournisseur de ${a.ref} payée`, `<form id="cp-pay">${champ('Date du paiement', inp('date', D.auj(), { type: 'date', req: true }))}<p class="cp-note">Montant : <b>${D.euros(+a.facture_ttc || D.ttc(a))}</b> TTC. La commande fournisseur passe « Facture payée » dans le CRM.</p></form>`,
          '<button type="button" class="cp-btn" data-fermer>Annuler</button><button type="submit" form="cp-pay" class="cp-btn plein">Enregistrer</button>', (fe) => fe.querySelector('#cp-pay').addEventListener('submit', (ev) => { ev.preventDefault(); const c = lireF(ev.target);
            a.payee = true; a.paiement = c.date; D.toucher(a); D.evt(db, `Facture fournisseur de ${a.ref} payée (depuis la Compta)`, { tiers: a.tiers, objet: { type: 'achat', id: a.id } }); sauver(); fermer(); notifier('Paiement enregistré.'); rendre(); })); }); } };
    };

    // ===================== IMPORTER DES FACTURES FOURNISSEURS (24 nov. 2026) =====================
    // « À payer » → « Importer des factures » : PDF lus tout seuls (js/compta-factures.js : fournisseur, n°, dates,
    // HT / TVA / TTC), photos et PDF scannés à remplir, listes Excel / CSV. Aperçu modifiable ; enregistrées dans
    // db.compta.factures (sens « sortie », à payer) avec la facture jointe en ligne (D.envoyerPiece). Fournisseur choisi
    // à la main = retenu pour la prochaine fois (db.compta.reconnus : SIRET / n° de TVA / nom → tiers du CRM).
    let imp = null; // { lignes, erreurs }
    const nz = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '');
    const reconnus = () => (C().reconnus = C().reconnus || {});
    const doublonDe = (x) => { const n = nz(x.numero); if (!n) return '';
      if (C().factures.some((f) => f.sens !== 'entree' && nz(f.numero) === n && ((x.tiers && f.tiers === x.tiers) || (x.nom && nz(f.nom) === nz(x.nom))))) return 'déjà importée';
      if (x.tiers && db.achats.some((a) => a.tiers === x.tiers && nz(a.facture_num) === n)) return 'déjà jointe à une commande fournisseur du CRM';
      return ''; };
    const catDefaut = (x) => { const avant = x.tiers && [...C().factures].reverse().find((f) => f.tiers === x.tiers && f.categorie); if (avant) return [avant.categorie, avant.souscat || ''];
      const g = devinerCat(x.nom, -1); if (g[0] !== 'a_regulariser') return g; const t = tiersDe(x.tiers); return t && t.fournisseur ? ['achats', 'Achats de marchandises destinées à la revente'] : ['achats', '']; };
    const ajouterLignes = (l) => { l.forEach((x) => { if (x.erreur) { imp.erreurs.push(x); return; } const dbl = doublonDe(x); const [c, s] = catDefaut(x); imp.lignes.push({ ...x, categorie: c, souscat: s, doublon: dbl, ok: !dbl }); }); };
    PAGES.importer = () => {
      if (!imp) imp = { lignes: [], erreurs: [] };
      const fourn = db.tiers.filter((t) => t.fournisseur || t.client).sort((a, b) => (b.fournisseur ? 1 : 0) - (a.fournisseur ? 1 : 0) || a.nom.localeCompare(b.nom)).map((t) => [t.id, t.nom + (t.fournisseur ? '' : ' (client)')]);
      const val = (n) => (n == null || n === '' ? '' : String(n));
      const carteL = (x, i) => `<div class="cp-imp${x.ok ? '' : ' off'}" data-r="${i}">
          <header><label class="cp-case" title="Importer cette facture"><input type="checkbox" data-imp-ok${x.ok ? ' checked' : ''}></label><b>${esc(x.fichier)}</b>
            ${x.source === 'pdf' && !x.notes.length ? '<span class="cp-imp-note ok">lue automatiquement</span>' : ''}${x.notes.map((n) => `<span class="cp-imp-note">${esc(n)}</span>`).join('')}${x.doublon ? `<span class="cp-imp-note ko">${esc(x.doublon)}</span>` : ''}
            <button type="button" class="cp-lien" data-imp-retirer title="Retirer de la liste">✕</button></header>
          <div class="cp-imp-g">${champ('Fournisseur du CRM', sel('tiers', [['', '— aucun (nom ci-contre) —'], ...fourn], x.tiers))}${champ('Nom sur la facture', inp('nom', x.nom))}
            ${champ('N° de facture', inp('numero', x.numero))}${champ('Date de la facture', inp('date', x.date, { type: 'date' }))}${champ('Échéance', inp('echeance', x.echeance, { type: 'date' }), 'Vide = date de la facture.')}
            ${champ('Montant HT', inp('ht', val(x.ht), { type: 'number', step: '0.01' }))}${champ('TVA', inp('tva', val(x.tva), { type: 'number', step: '0.01' }))}${champ('Montant TTC à payer', inp('ttc', val(x.ttc), { type: 'number', step: '0.01' }))}</div>
          ${champsCat(x.categorie, x.souscat)}</div>`;
      const choisies = imp.lignes.filter((x) => x.ok);
      return { html: `${titre('Importer des factures fournisseurs', 'Déposez les factures PDF : fournisseur, n°, dates et montants sont lus tout seuls. Vérifiez puis enregistrez : elles passent dans « À payer » avec la facture jointe.', '<button type="button" class="cp-btn" data-aller="payer">← À payer</button>')}
        <label class="cp-depot" data-imp-depot><input type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.csv,.txt" data-imp-fichiers hidden>
          <b>${U.ico('plus')} Choisir ou glisser les factures ici</b><span>PDF (lus automatiquement) · photos (à remplir) · liste Excel / CSV (une ligne par facture : fournisseur, n°, date, échéance, HT, TVA, TTC)</span><em data-imp-progres></em></label>
        ${imp.erreurs.length ? carte('Fichiers non lus', `<ul class="cp-imp-err">${imp.erreurs.map((x) => `<li><b>${esc(x.fichier)}</b> : ${esc(x.erreur)}</li>`).join('')}</ul>`) : ''}
        ${imp.lignes.length ? carte(`Factures trouvées (${imp.lignes.length})`, `${imp.lignes.map(carteL).join('')}
          <div class="cp-imp-pied"><span>${choisies.length} facture(s) cochée(s) · <b>${D.euros(choisies.reduce((s, x) => s + (Math.abs(+x.ttc) || 0), 0))}</b> TTC</span>
            <button type="button" class="cp-btn" data-imp-vider>Tout effacer</button><button type="button" class="cp-btn plein" data-imp-enregistrer${choisies.length ? '' : ' disabled'}>Enregistrer ${choisies.length} facture(s) à payer</button></div>`) : ''}`,
      apres: (el) => {
        const inp0 = el.querySelector('[data-imp-fichiers]'); const prog = el.querySelector('[data-imp-progres]'); const depot = el.querySelector('[data-imp-depot]');
        const lireTout = async (files) => { files = [...files]; if (!files.length) return; if (!window.FMDFacturesFourn) { notifier('Lecteur de factures indisponible.'); return; }
          depot.classList.add('lecture');
          const l = await window.FMDFacturesFourn.lire(files, db, reconnus(), (i, n, nom) => { prog.textContent = `Lecture ${i} / ${n} : ${nom}…`; });
          ajouterLignes(l); const ok = l.filter((x) => !x.erreur).length; notifier(`${ok} facture(s) trouvée(s)${l.length - ok ? `, ${l.length - ok} fichier(s) non lu(s)` : ''}. Vérifiez avant d’enregistrer.`); rendre(); };
        inp0.addEventListener('change', () => lireTout(inp0.files));
        depot.addEventListener('dragover', (e) => { e.preventDefault(); depot.classList.add('survol'); });
        depot.addEventListener('dragleave', () => depot.classList.remove('survol'));
        depot.addEventListener('drop', (e) => { e.preventDefault(); depot.classList.remove('survol'); lireTout(e.dataTransfer.files); });
        // les modifications restent dans la liste (si on ajoute d'autres fichiers ensuite)
        el.addEventListener('change', (e) => { const c = e.target.closest('[data-r]'); if (!c) return; const x = imp.lignes[+c.dataset.r]; if (!x) return; const n = e.target.name;
          if (e.target.matches('[data-imp-ok]')) { x.ok = e.target.checked; rendre(); return; }
          if (!n) return; const v = e.target.value;
          if (['ht', 'tva', 'ttc'].includes(n)) x[n] = v === '' ? null : +v; else x[n] = v;
          if (n === 'tiers') { const t = tiersDe(v); if (t) x.nom = t.nom; const [ca, so] = catDefaut(x); x.categorie = ca; x.souscat = so; x.doublon = doublonDe(x); rendre(); }
          if (n === 'numero' || n === 'nom') x.doublon = doublonDe(x);
          if (n === 'categorie') x.souscat = ''; });
        el.addEventListener('click', async (e) => {
          const r = e.target.closest('[data-imp-retirer]'); if (r) { imp.lignes.splice(+r.closest('[data-r]').dataset.r, 1); rendre(); return; }
          if (e.target.closest('[data-imp-vider]')) { imp = null; rendre(); return; }
          const b = e.target.closest('[data-imp-enregistrer]'); if (!b) return;
          const l = imp.lignes.filter((x) => x.ok);
          const manque = l.filter((x) => !(Math.abs(+x.ttc) > 0) || !x.date || (!x.tiers && !x.nom));
          if (manque.length) { notifier(`${manque.length} facture(s) incomplète(s) : il faut le fournisseur, la date et le montant TTC (${manque.map((x) => x.fichier).slice(0, 3).join(', ')}).`); return; }
          b.disabled = true; let sansPiece = 0; let i = 0;
          for (const x of l) {
            i++; b.textContent = `Envoi ${i} / ${l.length}…`;
            const f = { id: D.id('fx'), sens: 'sortie', tiers: x.tiers || '', nom: x.nom || (tiersDe(x.tiers) || {}).nom || '', numero: x.numero || '', montant: Math.abs(+x.ttc), ht: x.ht == null ? null : +x.ht, tva: x.tva == null ? null : +x.tva,
              date: x.date, echeance: x.echeance || x.date, categorie: x.categorie, souscat: x.souscat || '', payee: false, paiement: '', source: 'import', fichier: x.fichier, cree: D.maintenant() };
            if (x.file && D.envoyerPiece) { try { f.piece = await D.envoyerPiece(x.file, `compta/factures/${f.id}`); } catch (er) { sansPiece++; } }
            if (x.tiers) { if (x.cle) reconnus()[x.cle] = x.tiers; if (x.nom) reconnus()['nom:' + nz(x.nom)] = x.tiers; }
            D.toucher(f); C().factures.push(f);
          }
          sauver(); imp = null;
          notifier(`${l.length} facture(s) fournisseur ajoutée(s) à « À payer »${sansPiece ? ` (${sansPiece} sans pièce jointe : envoi impossible)` : ''}.`); aller('payer');
        });
      } };
    };

    // ===================== POSTES DE DÉPENSES (camembert) =====================
    PAGES.depenses = () => {
      const F = flux(); const auj = AUJ();
      const debut = { mois: auj.slice(0, 8) + '01', trimestre: ajoutMois(auj, -3), annee: auj.slice(0, 4) + '-01-01', tout: '0000' }[perDep] || '0000';
      const l = F.reels.filter((x) => x.montant < 0 && x.date >= debut && x.date <= auj);
      const m = new Map(); l.forEach((x) => { const k = x.cat || 'a_regulariser'; const o = m.get(k) || { k, l: nomCat(k), v: 0, n: 0 }; o.v += -x.montant; o.n++; m.set(k, o); });
      const parts = [...m.values()].map((p) => ({ ...p, v: D.arrondi(p.v) })).sort((a, b) => b.v - a.v); const tot = D.arrondi(parts.reduce((s, p) => s + p.v, 0));
      parts.forEach((p, i) => { p.c = COUL_CAT[i % COUL_CAT.length]; p.pc = tot ? (p.v * 100) / tot : 0; });
      const pc = (v) => `${v.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`;
      const R = 118, cx = 130, cy = 130; let ang = -Math.PI / 2;
      const pt = (a, r = R) => `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
      const parts2 = parts.filter((p) => p.v > 0);
      const svg = parts2.length === 1 ? `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${parts2[0].c}"><title>${esc(parts2[0].l)} : ${D.euros(parts2[0].v)} (100 %)</title></circle><text x="${cx}" y="${cy + 5}" class="cp-cam-t">100 %</text>`
        : parts2.map((p) => { const a = (p.v / tot) * Math.PI * 2; const a2 = ang + a; const mil = ang + a / 2;
          const s = `<path d="M${cx},${cy} L${pt(ang)} A${R},${R} 0 ${a > Math.PI ? 1 : 0} 1 ${pt(a2)} Z" fill="${p.c}"><title>${esc(p.l)} : ${D.euros(p.v)} (${pc(p.pc)})</title></path>${p.pc >= 6 ? `<text x="${pt(mil, R * 0.64).split(',')[0]}" y="${+pt(mil, R * 0.64).split(',')[1] + 4}" class="cp-cam-t">${Math.round(p.pc)} %</text>` : ''}`;
          ang = a2; return s; }).join('');
      const puce = (v, lib) => `<button type="button" class="cp-filtre${perDep === v ? ' actif' : ''}" data-perdep="${v}">${esc(lib)}</button>`;
      return { html: `${titre('Postes de dépenses', 'Répartition de toutes les dépenses réelles (factures fournisseurs payées, relevé, charges, saisies) par catégorie.', `<div class="cp-filtres">${puce('mois', 'Ce mois')}${puce('trimestre', '3 mois')}${puce('annee', 'Cette année')}${puce('tout', 'Tout')}</div>`)}
        <div class="cp-totaux">${kpi('Total des dépenses', `<span class="neg">${D.euros(tot)}</span>`, `${l.length} transaction${l.length > 1 ? 's' : ''}`)}${kpi('Premier poste', parts[0] ? esc(parts[0].l) : '—', parts[0] ? `${D.euros(parts[0].v)} · ${pc(parts[0].pc)}` : '')}${kpi('Catégories', String(parts.length))}</div>
        ${carte('Répartition par catégorie', parts.length ? `<div class="cp-cam"><svg viewBox="0 0 260 260" role="img" aria-label="Camembert des dépenses par catégorie">${svg}</svg>
          <table class="cp-table cp-cam-l"><thead><tr><th>Catégorie</th><th class="nb">Montant</th><th class="nb">Part</th><th class="nb">Transactions</th></tr></thead><tbody>
          ${parts.map((p) => `<tr><td><i class="cp-cam-p" style="background:${p.c}"></i>${esc(p.l)}</td><td class="nb">${D.euros(p.v)}</td><td class="nb"><b>${pc(p.pc)}</b></td><td class="nb">${p.n}</td></tr>`).join('')}
          </tbody><tfoot><tr class="fort"><td>Total</td><td class="nb">${D.euros(tot)}</td><td class="nb">100 %</td><td class="nb">${l.length}</td></tr></tfoot></table></div>
          <p class="cp-note">La catégorie d’une transaction se change en cliquant dessus dans « Transactions » (ou pour plusieurs à la fois en les cochant).</p>` : vide('Aucune dépense sur cette période.'), { cls: 'cp-large' })}`,
        apres: (el) => { brancherCommun(el); el.querySelectorAll('[data-perdep]').forEach((b) => b.addEventListener('click', () => { perDep = b.dataset.perdep; ecrireLS('fmd-compta-depenses', perDep); rendre(); })); } };
    };

    // ===================== RAPPROCHEMENT FACTURES ↔ TRANSACTIONS =====================
    // On choisit (ou importe) une facture ; FMD propose les transactions qui lui ressemblent (montant, date, nom du client ou
    // du fournisseur, n° de facture dans le libellé). Valider : la transaction est rattachée à la facture, la facture est payée.
    const normR = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    function facturesARapprocher(F) {
      const out = []; const pris = F.lies;
      db.factures.forEach((f) => { if (f.importe || pris.has('fact:' + f.id)) return; const t = tiersDe(f.tiers); out.push({ type: 'fact', id: f.id, ref: f.ref, nom: t ? t.nom : '', tiers: f.tiers, date: f.date, echeance: f.echeance || f.date, montant: ttc(f), payee: !!f.payee, doc: f, quoi: 'Facture client' }); });
      db.achats.filter((a) => a.etat === 'facturee').forEach((a) => { if (pris.has('achat:' + a.id)) return; const t = tiersDe(a.tiers); out.push({ type: 'achat', id: a.id, ref: a.facture_num || a.ref, nom: t ? t.nom : '', tiers: a.tiers, date: a.facture_date || a.date, echeance: a.facture_date || a.date, montant: -D.arrondi(+a.facture_ttc || D.ttc(a)), payee: !!a.payee, doc: a, quoi: 'Facture fournisseur' }); });
      C().factures.forEach((f) => { if (pris.has('ext:' + f.id)) return; const m = (f.sens === 'entree' ? 1 : -1) * Math.abs(+f.montant || 0); const t = tiersDe(f.tiers);
        out.push({ type: 'ext', id: f.id, ref: f.numero || '', nom: (t && t.nom) || f.nom || '', tiers: f.tiers, date: f.date, echeance: f.echeance || f.date, montant: m, payee: !!f.payee, doc: f, quoi: m > 0 ? 'Facture client importée' : 'Facture fournisseur importée' }); });
      return out;
    }
    function ressemblance(inv, x) {
      const a = Math.abs(inv.montant), b = Math.abs(x.montant), dm = Math.abs(a - b); const r = [];
      const sm = dm <= 0.05 ? 50 : Math.max(0, 50 - (dm / Math.max(a, 1)) * 250); if (dm <= 0.05) r.push('même montant'); else if (sm > 0) r.push(`montant proche (écart ${D.euros(dm)})`);
      const j = Math.round(Math.min(ecart(x.date, String(inv.date).slice(0, 10)), ecart(x.date, String(inv.echeance).slice(0, 10)))); const sd = Math.max(0, 25 - (j * 25) / 60); if (sd > 0) r.push(j ? `${j} jour${j > 1 ? 's' : ''} d’écart` : 'même date');
      const lib = normR(`${x.lib} ${(x.op && x.op.note) || ''}`); const mots = normR(inv.nom).split(/[^a-z0-9]+/).filter((m) => m.length >= 3 && !MOTS_VIDES.has(m));
      const vus = mots.filter((m) => lib.includes(m)); const sn = mots.length ? (25 * vus.length) / mots.length : 0; if (vus.length) r.push(`nom « ${vus.join(' ')} » dans le libellé`);
      const sr = inv.ref && normR(inv.ref).length >= 4 && lib.replace(/[^a-z0-9]/g, '').includes(normR(inv.ref).replace(/[^a-z0-9]/g, '')) ? 25 : 0; if (sr) r.push('n° de facture dans le libellé');
      return { score: Math.min(100, Math.round(sm + sd + sn + sr)), raisons: r };
    }
    const transactionsLibres = (F, signe) => F.reels.filter((x) => x.op && !rattachee(x) && Math.sign(x.montant) === signe);
    function validerRappro(inv, op) {
      op.facture = { type: inv.type, id: inv.id, ref: inv.ref, lib: `${inv.nom || 'Facture'} · facture ${inv.ref}` }; if (!op.categorie || ['autre', 'a_regulariser'].includes(op.categorie)) { op.categorie = inv.montant > 0 ? 'ventes' : (inv.doc.categorie || 'achats'); op.souscat = inv.montant > 0 ? '' : (inv.doc.souscat || ''); } D.toucher(op);
      const etaitPayee = inv.payee;
      if (!etaitPayee) { inv.doc.payee = true; inv.doc.paiement = op.date; D.toucher(inv.doc); }
      D.evt(db, `${inv.quoi} ${inv.ref} rapprochée avec la transaction « ${op.libelle} » du ${D.jour(op.date)}${etaitPayee ? '' : ' : passée à payée'}`, inv.type === 'ext' ? { tiers: inv.tiers || undefined } : { tiers: inv.tiers, objet: { type: inv.type, id: inv.id } });
      sauver(); fermer(); notifier(`Rapprochement validé : ${inv.ref} ${etaitPayee ? 'rattachée' : 'rattachée et payée'}.`); rendre();
    }
    const ligneSugg = (inv, x, s) => `<div class="cp-op cp-sugg">${icone(x)}<div class="cp-op-t"><b>${esc(x.lib || '—')}</b><small>${D.jour(x.date)} · ${esc(SRC[x.src] || '')}${s.raisons.length ? ` · ${esc(s.raisons.join(', '))}` : ''}</small></div>
      <span class="cp-score" style="--s:${s.score}%"><i></i>${s.score} %</span>${montant(x.montant)}<button type="button" class="cp-btn petit plein" data-valider="${esc(inv.type)}:${esc(inv.id)}|${esc(x.op.id)}">Valider</button></div>`;
    PAGES.rapprochement = () => {
      const F = flux(); const fs = facturesARapprocher(F); const imp = fs.filter((x) => !x.payee).sort((a, b) => String(a.echeance).localeCompare(String(b.echeance)));
      const payees = fs.filter((x) => x.payee).sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 40);
      const inv = fs.find((x) => `${x.type}:${x.id}` === choixRappro);
      const carteInv = (x) => `<button type="button" class="cp-op cp-inv${inv === x ? ' actif' : ''}" data-inv="${esc(x.type)}:${esc(x.id)}">${x.tiers && tiersDe(x.tiers) ? U.avatar(tiersDe(x.tiers), 34) : '<span class="cp-ico">€</span>'}<div class="cp-op-t"><b>${esc(x.nom || '—')} · ${esc(x.ref)}</b><small>${esc(x.quoi)} · ${D.jour(x.date)}${x.payee ? ' · payée, sans transaction' : ` · échéance ${D.jour(x.echeance)}`}</small></div>${montant(x.montant, { prevu: !x.payee })}</button>`;
      let droite = vide('Choisissez une facture à gauche, ou importez-en une : les transactions qui lui ressemblent s’affichent ici.');
      if (inv) { const l = transactionsLibres(F, Math.sign(inv.montant)).map((x) => ({ x, s: ressemblance(inv, x) })).sort((a, b) => b.s.score - a.s.score);
        const bonnes = l.filter((y) => y.s.score >= 30).slice(0, 8); const autres = l.filter((y) => !bonnes.includes(y)).slice(0, 30);
        droite = `<div class="cp-inv-det"><b>${esc(inv.quoi)} ${esc(inv.ref)}</b><span>${esc(inv.nom || '')} · du ${D.jour(inv.date)} · ${D.euros(Math.abs(inv.montant))} TTC${inv.payee ? ' · déjà payée' : ''}</span></div>
          <h4 class="cp-sous">Transactions qui ressemblent (${bonnes.length})</h4>${bonnes.length ? bonnes.map((y) => ligneSugg(inv, y.x, y.s)).join('') : vide('Aucune transaction ne ressemble assez à cette facture (importez le relevé de banque dans « Comptes », ou saisissez l’opération).')}
          ${autres.length ? `<details class="cp-details"><summary>Autres transactions non rattachées (${autres.length})</summary>${autres.map((y) => ligneSugg(inv, y.x, y.s)).join('')}</details>` : ''}`; }
      return { html: `${titre('Rapprochement', 'Une facture ↔ sa transaction : FMD propose les transactions qui ressemblent (montant, date, nom). Après validation, la transaction est rattachée et la facture payée.', `<button type="button" class="cp-btn plein" data-importer-f>${U.ico('plus')} Importer une facture</button>`)}
        <div class="cp-totaux">${kpi('Factures non payées', String(imp.length), D.euros(imp.reduce((s, x) => s + Math.abs(x.montant), 0)))}${kpi('Transactions non rattachées', String(F.reels.filter((x) => !rattachee(x)).length), '<button type="button" class="cp-lien" data-voir-non>Voir la liste →</button>')}${kpi('Factures importées', String(C().factures.length))}</div>
        <div class="cp-grille2 cp-rappro"><div>${carte('Factures non payées', imp.length ? imp.map(carteInv).join('') : vide('Aucune facture non payée.'))}
          ${payees.length ? carte('Payées sans transaction rattachée', payees.map(carteInv).join(''), { cls: 'cp-discret' }) : ''}</div>
          <div>${carte(inv ? 'Transactions proposées' : 'Transactions proposées', droite)}</div></div>`,
      apres: (el) => { brancherCommun(el);
        el.addEventListener('click', (e) => { const b = e.target.closest('[data-inv]'); if (b) { choixRappro = b.dataset.inv; rendre(); return; }
          const v = e.target.closest('[data-valider]'); if (v) { const [k, opId] = v.dataset.valider.split('|'); const i = fs.find((x) => `${x.type}:${x.id}` === k); const op = C().operations.find((o) => o.id === opId); if (i && op) validerRappro(i, op); return; }
          if (e.target.closest('[data-importer-f]')) formFactureImportee();
          if (e.target.closest('[data-voir-non]')) { filtreOps = { ...filtreOps, lien: 'non', periode: 'tout' }; aller('operations'); } }); } };
    };
    // Rattacher depuis une transaction : factures qui lui ressemblent
    function rattacherOp(op) { if (!op) return;
      const F = flux(); const x = F.reels.find((y) => y.op === op) || { op, lib: op.libelle, date: op.date, montant: +op.montant || 0, src: 'manuel' };
      const l = facturesARapprocher(F).filter((i) => Math.sign(i.montant) === Math.sign(x.montant)).map((i) => ({ i, s: ressemblance(i, x) })).sort((a, b) => b.s.score - a.s.score).slice(0, 12);
      fenetre(`Rattacher « ${esc(op.libelle)} »`, `<p class="cp-note">${D.jour(op.date)} · ${D.euros(op.montant)} — factures ${x.montant > 0 ? 'clients' : 'fournisseurs'} qui ressemblent le plus :</p>
        ${l.length ? l.map(({ i, s }) => `<div class="cp-op cp-sugg"><span class="cp-ico">€</span><div class="cp-op-t"><b>${esc(i.nom || '—')} · ${esc(i.ref)}</b><small>${esc(i.quoi)} · ${D.jour(i.date)}${i.payee ? ' · déjà payée' : ''}${s.raisons.length ? ` · ${esc(s.raisons.join(', '))}` : ''}</small></div><span class="cp-score" style="--s:${s.score}%"><i></i>${s.score} %</span>${montant(i.montant)}<button type="button" class="cp-btn petit plein" data-choix="${esc(i.type)}:${esc(i.id)}">Rattacher</button></div>`).join('') : vide('Aucune facture sans transaction. Importez la facture dans « Rapprochement ».')}`,
        '<button type="button" class="cp-btn" data-fermer>Fermer</button>', (fe) => fe.addEventListener('click', (e) => { const b = e.target.closest('[data-choix]'); if (!b) return; const r = l.find((y) => `${y.i.type}:${y.i.id}` === b.dataset.choix); if (r) validerRappro(r.i, op); }));
    }
    // Importer une facture (hors CRM) : saisie des informations de la facture reçue / émise
    function formFactureImportee() {
      const tiers = db.tiers.filter((t) => t.client || t.fournisseur || t.prospect).sort((a, b) => a.nom.localeCompare(b.nom)).map((t) => [t.id, t.nom]);
      fenetre('Importer une facture', `<form id="cp-fx" class="cp-form">
        ${champ('Type', sel('sens', [['sortie', 'Facture fournisseur (à payer)'], ['entree', 'Facture client (à encaisser)']], 'sortie'))}${champsCat('achats', '')}
        <div class="cp-2">${champ('Client / fournisseur du CRM', sel('tiers', [['', '— aucun (saisir le nom) —'], ...tiers], ''), 'Facultatif.')}${champ('Nom sur la facture', inp('nom', '', { ph: 'Ex. : EDF, Orange, SCI du Quai' }))}</div>
        <div class="cp-2">${champ('N° de facture', inp('numero', '', { req: true }))}${champ('Montant TTC (€)', inp('montant', '', { type: 'number', step: '0.01', min: 0, req: true }))}</div>
        <div class="cp-2">${champ('Date de la facture', inp('date', D.auj(), { type: 'date', req: true }))}${champ('Échéance', inp('echeance', '', { type: 'date' }), 'Vide = date de la facture.')}</div></form>`,
        '<button type="button" class="cp-btn" data-fermer>Annuler</button><button type="submit" form="cp-fx" class="cp-btn plein">Importer et chercher la transaction</button>', (fe) => {
          fe.querySelector('#cp-fx').addEventListener('submit', (e) => { e.preventDefault(); const c = lireF(e.target); const t = tiersDe(c.tiers);
            if (!t && !c.nom) { notifier('Choisissez un client / fournisseur ou écrivez le nom.'); return; }
            const f = { id: D.id('fx'), sens: c.sens, tiers: c.tiers || '', nom: c.nom || (t ? t.nom : ''), numero: c.numero, montant: Math.abs(+c.montant || 0), date: c.date, echeance: c.echeance || c.date, categorie: c.categorie, souscat: c.souscat || '', payee: false, paiement: '', cree: D.maintenant() };
            D.toucher(f); C().factures.push(f); sauver(); fermer(); choixRappro = `ext:${f.id}`; notifier(`Facture ${f.numero} importée.`); aller('rapprochement'); }); });
    }

    // ===================== CHARGES RÉCURRENTES =====================
    PAGES.charges = () => {
      const l = C().recurrentes; const parMois = (r) => Math.abs(+r.montant || 0) / ((FREQ.find((f) => f[0] === r.frequence) || FREQ[0])[2]);
      const sorties = l.filter((r) => r.sens !== 'entree' && (!r.fin || r.fin >= AUJ())); const total = sorties.reduce((s, r) => s + parMois(r), 0);
      const prochaine = (r) => occurrences(r, D.ajout(AUJ(), 1), ajoutMois(AUJ(), 13))[0];
      return { html: `${titre('Charges récurrentes', 'Loyer, salaires, URSSAF, abonnements… : comptées dans le prévisionnel, et dans le solde à leur date si « prélevée automatiquement ».', `<button type="button" class="cp-btn plein" data-action="recurrente">${U.ico('plus')} Charge récurrente</button>`)}
        <div class="cp-totaux">${kpi('Charges fixes par mois', `<span class="neg">${D.euros(total)}</span>`)}${kpi('Par an', D.euros(total * 12))}${kpi('Charges', String(sorties.length))}</div>
        ${carte('', l.length ? l.map((r) => `<div class="cp-op" data-rec="${esc(r.id)}" tabindex="0" role="button"><span class="cp-ico cat-${esc(canon(r.categorie)[0])}">↻</span><div class="cp-op-t"><b>${esc(r.libelle)}</b><small>${esc((FREQ.find((f) => f[0] === r.frequence) || FREQ[0])[1])} · ${esc(nomCat(r.categorie))}${prochaine(r) ? ` · prochaine le ${D.jour(prochaine(r))}` : ' · terminée'}${r.auto === false ? ' · à pointer' : ' · prélevée automatiquement'}</small></div>${montant((r.sens === 'entree' ? 1 : -1) * Math.abs(+r.montant || 0))}</div>`).join('') : vide('Aucune charge récurrente : ajoutez le loyer, les salaires, l’URSSAF, les abonnements… pour un prévisionnel juste.'), { cls: 'cp-liste' })}`,
      apres: (el) => { brancherCommun(el); el.addEventListener('click', (e) => { const r = e.target.closest('[data-rec]'); if (r) formRecurrente(C().recurrentes.find((x) => x.id === r.dataset.rec)); }); } };
    };
    function formRecurrente(r) {
      const neuf = !r; r = r || { libelle: '', montant: '', sens: 'sortie', frequence: 'mensuel', debut: D.auj(), fin: '', categorie: 'locaux', souscat: 'Loyers commerciaux', auto: true, compte: comptePrincipal().id };
      fenetre(neuf ? 'Nouvelle charge récurrente' : 'Modifier la charge récurrente', `<form id="cp-rec" class="cp-form">
        ${champ('Libellé', inp('libelle', r.libelle, { req: true, ph: 'Ex. : Loyer entrepôt, Salaires, URSSAF, Abonnement Orange' }))}
        <div class="cp-2">${champ('Montant (€ TTC)', inp('montant', r.montant ? Math.abs(r.montant) : '', { type: 'number', step: '0.01', min: 0, req: true }))}${champ('Sens', sel('sens', [['sortie', 'Sortie (dépense)'], ['entree', 'Entrée (recette)']], r.sens))}</div>
        ${champ('Fréquence', sel('frequence', FREQ.map((f) => [f[0], f[1]]), r.frequence))}${champsCat(r.categorie, r.souscat)}
        <div class="cp-2">${champ('Première échéance', inp('debut', r.debut, { type: 'date', req: true }))}${champ('Dernière échéance (facultatif)', inp('fin', r.fin, { type: 'date' }))}</div>
        <div class="cp-2">${champ('Compte', sel('compte', optsComptes(), r.compte))}<label class="cp-champ cp-coche"><input type="checkbox" name="auto"${r.auto !== false ? ' checked' : ''}><span>Prélevée automatiquement (comptée dans le solde à sa date)</span></label></div></form>`,
        `${neuf ? '' : '<button type="button" class="cp-btn danger" data-suppr>Supprimer</button>'}<button type="button" class="cp-btn" data-fermer>Annuler</button><button type="submit" form="cp-rec" class="cp-btn plein">Enregistrer</button>`, (fe) => {
          fe.querySelector('#cp-rec').addEventListener('submit', (e) => { e.preventDefault(); const c = lireF(e.target); const o = neuf ? { id: D.id('rc'), cree: D.maintenant() } : r;
            Object.assign(o, { libelle: c.libelle, montant: Math.abs(+c.montant || 0), sens: c.sens, frequence: c.frequence, categorie: c.categorie, souscat: c.souscat || '', debut: c.debut, fin: c.fin, compte: c.compte, auto: c.auto });
            D.toucher(o); if (neuf) C().recurrentes.push(o); sauver(); fermer(); notifier('Charge récurrente enregistrée.'); rendre(); });
          const s = fe.querySelector('[data-suppr]'); if (s) s.addEventListener('click', () => { if (!confirm(`Supprimer « ${r.libelle} » ?`)) return; C().recurrentes = C().recurrentes.filter((x) => x !== r); sauver(); fermer(); notifier('Charge supprimée.'); rendre(); }); });
    }

    // ===================== OPÉRATION MANUELLE =====================
    function formOperation(o) {
      const neuf = !o; o = o || { date: D.auj(), libelle: '', montant: '', categorie: 'a_regulariser', compte: comptePrincipal().id, note: '', source: 'manuel' };
      const releve = o.source === 'releve';
      fenetre(neuf ? 'Nouvelle opération' : releve ? 'Ligne du relevé' : 'Modifier l’opération', `<form id="cp-op" class="cp-form">
        ${champ('Libellé', inp('libelle', o.libelle, { req: true, ph: 'Ex. : Achat fournitures, Remboursement, Apport' }))}
        <div class="cp-2">${champ('Date', inp('date', o.date, { type: 'date', req: true }), 'Une date à venir = opération prévue (dans le prévisionnel).')}${champ('Montant (€)', inp('montant', o.montant !== '' ? Math.abs(o.montant) : '', { type: 'number', step: '0.01', min: 0, req: true }))}</div>
        ${champ('Sens', sel('sens', [['sortie', 'Sortie (dépense)'], ['entree', 'Entrée (recette)']], +o.montant > 0 ? 'entree' : 'sortie'))}${champsCat(...catOp(o))}
        <div class="cp-2">${champ('Compte', sel('compte', optsComptes(), o.compte))}${champ('Note', inp('note', o.note || ''))}</div>${releve ? '<p class="cp-note">Ligne importée depuis le relevé de la banque.</p>' : ''}</form>`,
        `${neuf ? '' : '<button type="button" class="cp-btn danger" data-suppr>Supprimer</button>'}<button type="button" class="cp-btn" data-fermer>Annuler</button><button type="submit" form="cp-op" class="cp-btn plein">Enregistrer</button>`, (fe) => {
          fe.querySelector('#cp-op').addEventListener('submit', (e) => { e.preventDefault(); const c = lireF(e.target); const x = neuf ? { id: D.id('op'), source: 'manuel', cree: D.maintenant() } : o;
            Object.assign(x, { libelle: c.libelle, date: c.date, montant: (c.sens === 'entree' ? 1 : -1) * Math.abs(+c.montant || 0), categorie: c.categorie, souscat: c.souscat || '', compte: c.compte, note: c.note });
            D.toucher(x); if (neuf) C().operations.push(x); sauver(); fermer(); notifier('Opération enregistrée.'); rendre(); });
          const s = fe.querySelector('[data-suppr]'); if (s) s.addEventListener('click', () => { if (!confirm(`Supprimer « ${o.libelle} » ?`)) return; C().operations = C().operations.filter((x) => x !== o); sauver(); fermer(); notifier('Opération supprimée.'); rendre(); }); });
    }

    // ===================== COMPTES + IMPORT DU RELEVÉ =====================
    PAGES.comptes = () => {
      const F = flux(); const l = comptes();
      return { html: `${titre('Comptes', 'Le solde de chaque compte à une date ; ensuite FMD ajoute les paiements, le relevé importé et les opérations.', `<button type="button" class="cp-btn plein" data-action="compte">${U.ico('plus')} Compte</button>`)}
        <div class="cp-cartes-comptes">${l.map((c) => { const nb = C().operations.filter((o) => o.source === 'releve' && (o.compte || comptePrincipal().id) === c.id).length;
          return `<article class="cp-compte"><div class="cp-compte-t"><span class="cp-logo petit">€</span><div><b>${esc(c.nom)}</b><small>${esc(c.banque || 'Banque non renseignée')}${c.iban ? ' · ' + esc(String(c.iban).replace(/\s/g, '').replace(/^(.{4}).*(.{4})$/, '$1 •••• $2')) : ''}</small></div></div>
            <b class="cp-gros moyen">${D.euros(soldeCompte(F, c))}</b><p>${c.date ? `Solde de départ ${D.euros(+c.solde || 0)} le ${D.jour(c.date)}` : 'Solde de départ pas encore renseigné'} · ${nb} ligne${nb > 1 ? 's' : ''} de relevé</p>
            <footer><button type="button" class="cp-btn" data-compte="${esc(c.id)}">Modifier le solde</button><label class="cp-btn plein">Importer un relevé<input type="file" accept=".csv,.txt,.xlsx,.xls" data-releve="${esc(c.id)}" hidden></label></footer></article>`; }).join('')}</div>
        ${carte('Importer le relevé de la banque', `<p>Sur le site de votre banque (ou de Qonto), téléchargez les opérations en <b>CSV</b> ou <b>Excel</b>, puis « Importer un relevé » sur le compte. FMD reconnaît les colonnes Date, Libellé, Montant (ou Débit / Crédit), ignore les lignes déjà importées, devine la catégorie, et <b>rapproche</b> chaque paiement de sa facture (même montant, 10 jours d’écart au plus) pour ne jamais la compter deux fois.</p>`)}`,
      apres: (el) => { brancherCommun(el);
        el.addEventListener('click', (e) => { const b = e.target.closest('[data-compte]'); if (b) formCompte(C().comptes.find((x) => x.id === b.dataset.compte) || comptes().find((x) => x.id === b.dataset.compte)); });
        el.querySelectorAll('[data-releve]').forEach((i) => i.addEventListener('change', () => { const f = i.files[0]; i.value = ''; if (f) importerReleve(f, i.dataset.releve); })); } };
    };
    function formCompte(c) {
      const neuf = !c || c.virtuel; const base = c || {};
      fenetre(neuf && !c ? 'Nouveau compte' : `Compte : ${base.nom}`, `<form id="cp-cpt" class="cp-form">
        <div class="cp-2">${champ('Nom du compte', inp('nom', base.nom || '', { req: true, ph: 'Ex. : Compte courant Crédit Agricole' }))}${champ('Banque', inp('banque', base.banque || '', { ph: 'Ex. : Qonto, CIC…' }))}</div>
        ${champ('IBAN (facultatif)', inp('iban', base.iban || '', { ph: 'FR76 …' }))}
        <div class="cp-2">${champ('Solde du compte (€)', inp('solde', base.solde ?? '', { type: 'number', step: '0.01', req: true }), 'Lisez-le sur votre application bancaire.')}${champ('À la date du', inp('date', base.date || D.auj(), { type: 'date', req: true }), 'Tout ce qui est payé après cette date s’ajoute au solde.')}</div></form>`,
        `${c && !c.virtuel && C().comptes.length > 1 ? '<button type="button" class="cp-btn danger" data-suppr>Supprimer</button>' : ''}<button type="button" class="cp-btn" data-fermer>Annuler</button><button type="submit" form="cp-cpt" class="cp-btn plein">Enregistrer</button>`, (fe) => {
          fe.querySelector('#cp-cpt').addEventListener('submit', (e) => { e.preventDefault(); const v = lireF(e.target);
            let o = c && !c.virtuel ? c : null; if (!o) { o = { id: c && c.virtuel ? 'principal' : D.id('cpt'), cree: D.maintenant() }; C().comptes.push(o); }
            Object.assign(o, { nom: v.nom, banque: v.banque, iban: v.iban, solde: +v.solde || 0, date: v.date }); D.toucher(o); sauver(); fermer(); notifier('Compte enregistré.'); rendre(); });
          const s = fe.querySelector('[data-suppr]'); if (s) s.addEventListener('click', () => { if (!confirm(`Supprimer le compte « ${c.nom} » ? Ses lignes de relevé importées sont aussi retirées.`)) return;
            C().comptes = C().comptes.filter((x) => x !== c); C().operations = C().operations.filter((o) => o.compte !== c.id); sauver(); fermer(); notifier('Compte supprimé.'); rendre(); }); });
    }
    // Lecture d'un relevé : CSV / Excel (lecteurs de js/erp-echange.js) → lignes { date, libelle, montant }.
    const normT = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
    const lireDate = (v) => { if (typeof v === 'number' && v > 20000 && v < 80000) return D.iso(new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 864e5));
      const s = String(v || '').trim(); let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
      m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/.exec(s); if (m) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; return ''; };
    const lireMontant = (v) => { if (typeof v === 'number') return v; let s = String(v || '').trim(); if (!s || !/\d/.test(s)) return null; const neg = /^-|^\(|-$/.test(s); s = s.replace(/[^\d,.]/g, '');
      if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.'); else s = s.replace(/,/g, ''); const n = +s; return Number.isFinite(n) ? (neg ? -n : n) : null; };
    async function importerReleve(fichier, compteId) {
      try {
        if (!D.echange || !D.echange.lireFichier) throw new Error('Lecteur de fichiers indisponible.');
        const tables = await D.echange.lireFichier(fichier); const t = tables.find((x) => x.lignes.length > 1); if (!t) throw new Error('Le fichier est vide.');
        let iT = -1; let col = null;
        t.lignes.slice(0, 15).some((l, i) => { const h = l.map(normT); const f = (re) => h.findIndex((x) => re.test(x));
          const c = { date: f(/^(date( de| d)?( l)?( operation| comptable| valeur| de la valeur| du reglement)?|settlement date|value date|date)( utc)?$|^date/), lib: f(/libelle|label|description|intitule|contrepartie|counterparty|beneficiaire|tiers|motif|nom/),
            mt: f(/^(montant|amount|total amount|montant total|montant ttc|montant eur|montant \(eur\))|^montant|amount/), deb: f(/^debit|debit$/), cre: f(/^credit|credit$/), sens: f(/^(sens|side|type)$/) };
          if (c.date >= 0 && c.lib >= 0 && (c.mt >= 0 || (c.deb >= 0 && c.cre >= 0) || c.deb >= 0)) { iT = i; col = c; return true; } return false; });
        if (iT < 0) throw new Error('Colonnes Date, Libellé et Montant (ou Débit / Crédit) introuvables dans le fichier.');
        const lignes = t.lignes.slice(iT + 1).map((l) => { const date = lireDate(l[col.date]); let m = null;
          if (col.mt >= 0) { m = lireMontant(l[col.mt]); if (m != null && col.sens >= 0 && /debit|sortie|out/i.test(String(l[col.sens] || '')) && m > 0) m = -m; }
          if (m == null && col.deb >= 0) { const d = lireMontant(l[col.deb]); const c = col.cre >= 0 ? lireMontant(l[col.cre]) : null; m = (c ? Math.abs(c) : 0) - (d ? Math.abs(d) : 0); if (!d && !c) m = null; }
          return { date, libelle: String(l[col.lib] ?? '').trim(), montant: m == null ? null : D.arrondi(m) }; }).filter((x) => x.date && x.montant != null && x.montant !== 0);
        if (!lignes.length) throw new Error('Aucune opération lisible dans le fichier.');
        const cle = (o) => `${o.date}|${o.montant}|${normT(o.libelle)}`; const deja = new Set(C().operations.filter((o) => o.source === 'releve').map(cle));
        const nouvelles = lignes.filter((x) => !deja.has(cle(x)));
        fenetre('Importer le relevé', `<p><b>${lignes.length}</b> opération${lignes.length > 1 ? 's' : ''} lue${lignes.length > 1 ? 's' : ''} dans « ${esc(fichier.name)} » (du ${D.jour(lignes.reduce((a, x) => (x.date < a ? x.date : a), lignes[0].date))} au ${D.jour(lignes.reduce((a, x) => (x.date > a ? x.date : a), lignes[0].date))}) ·
          <b>${nouvelles.length}</b> nouvelle${nouvelles.length > 1 ? 's' : ''}${lignes.length - nouvelles.length ? ` · ${lignes.length - nouvelles.length} déjà importée(s), ignorée(s)` : ''}.</p>
          <div class="cp-apercu">${nouvelles.slice(0, 8).map((x) => `<div class="cp-op"><span class="cp-ico cat-${devinerCat(x.libelle, x.montant)[0]}">⇄</span><div class="cp-op-t"><b>${esc(x.libelle)}</b><small>${D.jour(x.date)} · ${esc(nomCat(devinerCat(x.libelle, x.montant)))}</small></div>${montant(x.montant)}</div>`).join('')}${nouvelles.length > 8 ? `<p class="cp-note">… et ${nouvelles.length - 8} autre(s)</p>` : ''}</div>`,
          `<button type="button" class="cp-btn" data-fermer>Annuler</button><button type="button" class="cp-btn plein" data-ok${nouvelles.length ? '' : ' disabled'}>Importer ${nouvelles.length} opération${nouvelles.length > 1 ? 's' : ''}</button>`, (fe) => fe.querySelector('[data-ok]').addEventListener('click', () => {
            nouvelles.forEach((x) => C().operations.push({ id: D.id('op'), source: 'releve', date: x.date, libelle: x.libelle, montant: x.montant, categorie: devinerCat(x.libelle, x.montant)[0], souscat: devinerCat(x.libelle, x.montant)[1], compte: compteId === 'principal' && !C().comptes.length ? 'principal' : compteId, cree: D.maintenant(), modifie: D.maintenant() }));
            sauver(); fermer(); notifier(`${nouvelles.length} opération(s) importée(s).`); aller('operations'); }));
      } catch (e) { console.error(e); fenetre('Relevé non lu', `<p>${esc(e.message)}</p>`, '<button type="button" class="cp-btn plein" data-fermer>Compris</button>'); }
    }

    // ---------- actions communes ----------
    const clic = (e) => {
      const a = e.target.closest('[data-aller]'); if (a && conteneur.contains(a)) { e.preventDefault(); aller(a.dataset.aller); return; }
      // Facture fournisseur jointe à la commande (21 nov. 2026, js/erp-achat-suivi.js)
      const px = e.target.closest('[data-piece-ext]'); if (px) { const f = C().factures.find((x) => x.id === px.dataset.pieceExt); if (f && f.piece && D.ouvrirPiece) D.ouvrirPiece({ fenetre, notifier }, f.piece); return; }
      const pa = e.target.closest('[data-piece-achat]'); if (pa) { const o = D.charger().achats.find((x) => x.id === pa.dataset.pieceAchat); if (o && D.ouvrirPiece) D.ouvrirPiece({ fenetre, notifier }, o.facture_piece); return; }
      const ac = e.target.closest('[data-action]'); if (!ac) return;
      if (ac.dataset.action === 'operation') formOperation(); else if (ac.dataset.action === 'recurrente') formRecurrente(); else if (ac.dataset.action === 'compte') formCompte(null);
    };
    conteneur.addEventListener('click', clic);
    const touche = (e) => { if (e.key === 'Escape') fermer(); if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role=button][data-op], [role=button][data-rec]')) { e.preventDefault(); e.target.click(); } };
    conteneur.addEventListener('keydown', touche);
    const offMaj = N && N.surMaj ? N.surMaj(() => { if (!conteneur.querySelector('[data-cp-fen]') && !(document.activeElement && conteneur.contains(document.activeElement) && document.activeElement.matches('input, select, textarea'))) rendre(); }) : null;

    aller(route, true);
    return {
      detruire() { if (pennyOuvert) fermerPenny(); conteneur.removeEventListener('click', clic); conteneur.removeEventListener('keydown', touche); conteneur.removeEventListener('change', chgCat); if (offMaj) offMaj(); if (typeof offEtat === 'function') offEtat(); conteneur.classList.remove('page-compta'); conteneur.innerHTML = ''; },
      aller, flux: () => flux(), // essais
    };
  }

  window.FMDCompta = { monter };
})();
