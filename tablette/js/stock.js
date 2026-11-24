// FMD — module « Stock & Magasin » (VERSION DÉMO, 7 nov. 2026).
// • Magasin en 3D (three.js r147, app/vendor/three.min.js + three-orbit.js, chargés seulement à l'ouverture du module ;
//   rendu « à la demande » : rien ne tourne quand on ne touche pas la vue) : rayons, étagères (niveaux) et cases,
//   produits posés à leur place exacte, clic sur un rayon = son contenu, clic sur un produit = sa fiche.
// • Produits (fiche CRM) : référence, marque, catégorie, code-barres, fournisseur, prix, seuil d'alerte, numéros de lot /
//   série, et un ou plusieurs emplacements (rayon · niveau · case · quantité). Choix de l'emplacement sur le plan 3D.
// • Livraisons en route : fournisseurs → FMD (« Réceptionner » ajoute au stock) et FMD → clients (« Livrée » retire),
//   transporteur + numéro de suivi (lien de suivi), étapes Préparation → Expédiée → En route → Livrée.
// • Mouvements : historique des entrées / sorties / ajustements.
// Données : tables Supabase stock_produits / stock_mouvements / stock_livraisons (supabase/stock.sql). TANT QUE CE SQL
// N'EST PAS EXÉCUTÉ, le module tourne en MODE DÉMO : données d'essai gardées sur ce PC (localStorage), rien en ligne,
// aucun autre module touché.
// Plan : d'après le plan 2D du magasin (3 quai Félix Faure) fourni le 7 nov. 2026. ECHELLE = mètres par pixel du plan
// (estimée d'après la vue satellite : ≈ 18 × 26 m) — à corriger avec les vraies mesures.
// Plan modifiable dans FMD (8 nov. 2026) : bouton « Modifier le magasin », catalogue TYPES_RAYON, glisser-déposer ;
// enregistré dans stock_plan (base) ou localStorage (démo). PLAN_DEFAUT = plan d'origine.
// Utilisé par js/app.js : window.FMDStock.monter(conteneur, { sb, moi: { id, nom }, admin, notifier, esc }).
(function () {
  'use strict';

  // ---------- Plan du magasin (coordonnées en pixels du plan 2D) ----------
  const ECHELLE = 0.015;
  const X0 = 75, Y0 = 150, X1 = 1245, Y1 = 1915;
  const LARG = (X1 - X0) * ECHELLE, PROF = (Y1 - Y0) * ECHELLE;
  const mx = (px) => (px - X0) * ECHELLE - LARG / 2;
  const mz = (py) => (py - Y0) * ECHELLE - PROF / 2;

  const CATEGORIES = [
    ['fixation', 'Fixation & quincaillerie', '#e8806d'],
    ['outillage', 'Outillage & atelier', '#e0b45c'],
    ['consommables', 'Consommables', '#86c39f'],
    ['technique', 'Technique bâtiment', '#7fa7d9'],
    ['epi', 'Protection (EPI)', '#d6dd52'],
    ['mobilite', 'Mobilité', '#b89ad9'],
  ];
  const cat = (k) => CATEGORIES.find((c) => c[0] === k) || ['autre', 'Autre', '#C9987D'];

  const ZONES = { vente: 'Surface de vente', stock: 'Stockage arrière', reception: 'Zone réception', reserve: 'Réserve' };
  // Catalogue des types de rayons (dimensions proposées quand on en ajoute un ; tout reste modifiable).
  // unNiveau : un seul plan de pose (table, comptoir, palette). pas : largeur conseillée d'une case (m).
  const TYPES_RAYON = {
    gondole: { nom: 'Gondole (étagères + fond)', icone: '▤', long: 2, prof: 0.6, haut: 1.8, niveaux: 5, pas: 0.33, desc: 'Le rayon classique du magasin.' },
    tete: { nom: 'Tête de gondole', icone: '▣', long: 1, prof: 0.6, haut: 1.6, niveaux: 4, pas: 0.33, desc: 'Bout de rayon, pour les promotions.' },
    mural: { nom: 'Rayon mural', icone: '▥', long: 2, prof: 0.5, haut: 2.4, niveaux: 6, pas: 0.33, desc: 'Contre un mur, plus haut.' },
    portant: { nom: 'Portant à vêtements', icone: '⌒', long: 1.5, prof: 0.55, haut: 1.6, niveaux: 1, pas: 0.25, desc: 'Barre à cintres (EPI, vêtements de travail).' },
    vitrine: { nom: 'Vitrine', icone: '◫', long: 1.2, prof: 0.5, haut: 1.9, niveaux: 4, pas: 0.3, desc: 'Étagères en verre, objets de valeur.' },
    bacs: { nom: 'Bacs vrac', icone: '▦', long: 1.5, prof: 0.6, haut: 1.6, niveaux: 4, pas: 0.25, desc: 'Bacs inclinés, visserie au détail.' },
    ilot: { nom: 'Table / îlot', icone: '▭', long: 1.6, prof: 0.9, haut: 0.9, niveaux: 1, unNiveau: true, pas: 0.4, desc: 'Table de présentation.' },
    palette: { nom: 'Palette au sol', icone: '▱', long: 1.2, prof: 0.8, haut: 1.2, niveaux: 1, unNiveau: true, pas: 0.6, desc: 'Marchandise en volume posée au sol.' },
    rack: { nom: 'Rack de stockage', icone: '☰', long: 2.7, prof: 1.1, haut: 3, niveaux: 4, pas: 0.45, desc: 'Rayonnage lourd de réserve.' },
    comptoir: { nom: 'Comptoir / caisse', icone: '▬', long: 2.4, prof: 0.6, haut: 1.05, niveaux: 1, unNiveau: true, pas: 0.4, desc: 'Comptoir de vente.' },
  };
  const typeRayon = (t) => TYPES_RAYON[t] || TYPES_RAYON.gondole;

  // Plan d'origine (d'après le plan 2D), converti en mètres. Un rayon = { id, nom, zone, type, x, z (centre, m),
  // rot (degrés ; 0 = on se tient côté sud), long, prof, haut (m), niveaux, cases (par niveau) }.
  // Le plan modifié dans FMD est enregistré (démo : sur ce PC ; base : table stock_plan).
  // face = côté où l'on se tient pour prendre les produits (n, s, e, o)
  const R = (id, nom, zone, x, y, w, h, face, type = 'gondole', niveaux = 5, haut = 1.8) => {
    const ns = face === 'n' || face === 's';
    const long = +((ns ? w : h) * ECHELLE).toFixed(2), prof = +((ns ? h : w) * ECHELLE).toFixed(2);
    return { id, nom, zone, type, x: +mx(x + w / 2).toFixed(2), z: +mz(y + h / 2).toFixed(2), rot: { s: 0, n: 180, e: 90, o: -90 }[face], long, prof, haut, niveaux, cases: Math.max(1, Math.round(long / 0.33)) };
  };
  const PLAN_DEFAUT = [
    R('A1', 'Gondole de l’entrée', 'vente', 418, 282, 184, 100, 's'),
    R('B1', 'Sous la cuisine — gauche', 'vente', 203, 392, 97, 95, 's'),
    R('B2', 'Sous la cuisine — droite', 'vente', 310, 392, 99, 95, 's'),
    R('C1', 'Gondole centrale — nord 1', 'vente', 203, 568, 63, 62, 'n'),
    R('C2', 'Gondole centrale — nord 2', 'vente', 275, 568, 133, 62, 'n'),
    R('C3', 'Gondole centrale — nord 3', 'vente', 417, 568, 85, 62, 'n'),
    R('C4', 'Gondole centrale — nord 4', 'vente', 511, 568, 69, 62, 'n'),
    R('C5', 'Gondole centrale — nord 5', 'vente', 589, 568, 75, 62, 'n'),
    R('C6', 'Gondole centrale — sud 1', 'vente', 203, 638, 133, 75, 's'),
    R('C7', 'Gondole centrale — sud 2', 'vente', 344, 638, 158, 75, 's'),
    R('C8', 'Gondole centrale — sud 3', 'vente', 511, 638, 153, 75, 's'),
    R('D1', 'Mur de droite 1', 'vente', 953, 158, 85, 164, 'o', 'mural', 6, 2.4),
    R('D2', 'Mur de droite 2', 'vente', 953, 330, 85, 163, 'o', 'mural', 6, 2.4),
    R('D3', 'Mur de droite 3', 'vente', 953, 502, 85, 233, 'o', 'mural', 6, 2.4),
    R('D4', 'Mur de droite 4', 'vente', 953, 743, 85, 275, 'o', 'mural', 6, 2.4),
    R('E1', 'Retour en L — montant', 'vente', 822, 843, 42, 112, 'o', 'gondole', 5, 1.6),
    R('E2', 'Retour en L — bas', 'vente', 822, 963, 123, 55, 'n', 'gondole', 5, 1.6),
    R('F1', 'Le long du comptoir 1', 'vente', 83, 999, 77, 93, 'n'),
    R('F2', 'Le long du comptoir 2', 'vente', 170, 999, 75, 93, 'n'),
    R('F3', 'Le long du comptoir 3', 'vente', 255, 999, 93, 93, 'n'),
    R('F4', 'Le long du comptoir 4', 'vente', 357, 999, 69, 93, 'n'),
    R('F5', 'Le long du comptoir 5', 'vente', 435, 999, 132, 93, 'n'),
    R('T1', 'Table centrale', 'vente', 400, 813, 198, 124, 's', 'ilot', 1, 0.9),
    R('T2', 'Table de droite', 'vente', 942, 1120, 108, 238, 'o', 'ilot', 1, 0.9),
    R('K1', 'Comptoir (caisse)', 'vente', 577, 1092, 166, 28, 's', 'comptoir', 1, 1.05),
    R('S1', 'Rack arrière 1', 'stock', 1150, 170, 80, 270, 'o', 'rack', 4, 3),
    R('S2', 'Rack arrière 2', 'stock', 1150, 450, 80, 270, 'o', 'rack', 4, 3),
    R('S3', 'Rack arrière 3', 'stock', 1150, 730, 80, 280, 'o', 'rack', 4, 3),
    R('P1', 'Rack réception 1', 'reception', 1150, 1420, 80, 220, 'o', 'rack', 4, 3),
    R('P2', 'Rack réception 2', 'reception', 1150, 1660, 80, 220, 'o', 'rack', 4, 3),
    R('R1', 'Réserve — étagère haute', 'reserve', 95, 1570, 420, 55, 's', 'rack', 4, 2.5),
    R('R2', 'Réserve — étagère basse', 'reserve', 95, 1842, 420, 55, 'n', 'rack', 4, 2.5),
  ];

  const borne = (v, a, b, d) => { const n = Number(v); return Number.isFinite(n) ? Math.min(b, Math.max(a, n)) : d; };
  function normaliserRayon(r) {
    const t = typeRayon(r.type);
    const n = {
      id: String(r.id || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 8) || 'X1', nom: String(r.nom || '').slice(0, 80),
      zone: ZONES[r.zone] ? r.zone : 'vente', type: TYPES_RAYON[r.type] ? r.type : 'gondole',
      x: +borne(r.x, -LARG / 2, LARG / 2, 0).toFixed(2), z: +borne(r.z, -PROF / 2, PROF / 2, 0).toFixed(2),
      rot: ((Math.round(borne(r.rot, -720, 720, 0)) % 360) + 360) % 360,
      long: borne(r.long, 0.2, 30, t.long), prof: borne(r.prof, 0.2, 5, t.prof), haut: borne(r.haut, 0.3, 6, t.haut),
      niveaux: t.unNiveau ? 1 : Math.round(borne(r.niveaux, 1, 12, t.niveaux)), cases: Math.round(borne(r.cases, 1, 80, 1)),
    };
    if (n.rot > 180) n.rot -= 360;
    return n;
  }
  const copiePlan = (plan) => plan.map((r) => normaliserRayon(r));
  let RAYONS = copiePlan(PLAN_DEFAUT);
  const rayon = (id) => RAYONS.find((r) => r.id === id) || null;
  const longueur = (r) => r.long;
  const profondeur = (r) => r.prof;
  const nbCases = (r) => Math.max(1, Number(r.cases) || 1);
  // [x1, y1, x2, y2, hauteur, extérieur]
  const MURS = [
    [75, 150, 690, 150, 3.2, 1], [860, 150, 1245, 150, 3.2, 1], [1245, 150, 1245, 1915, 3.2, 1], [1245, 1915, 75, 1915, 3.2, 1], [75, 1915, 75, 150, 3.2, 1],
    [410, 150, 410, 382, 2.6], [75, 382, 410, 382, 2.6],
    [75, 1272, 433, 1272, 2.6], [433, 1272, 433, 1555, 2.6],
    [75, 1555, 712, 1555, 2.6], [712, 1555, 712, 1795, 2.6], [712, 1885, 712, 1915, 2.6],
  ];
  // [x, y, w, h, nom, couleur]
  const SOLS = [
    [75, 150, 335, 232, 'Cuisine', '#b9a48f'],
    [75, 1272, 358, 283, 'Bureau', '#8e94e0'],
    [75, 1555, 637, 360, 'Réserve', '#9a8f86'],
    [1046, 150, 199, 875, 'Stockage arrière', '#c9987d'],
    [760, 1380, 485, 535, 'Zone réception', '#7f9c8a'],
    [690, 150, 170, 70, 'Entrée', '#F7DAC5'],
  ];

  const TRANSPORTEURS = [
    ['Colissimo', 'https://www.laposte.fr/outils/suivre-vos-envois?code='],
    ['Chronopost', 'https://www.chronopost.fr/tracking-no-cms/suivi-page?listeNumerosLT='],
    ['DHL', 'https://www.dhl.com/fr-fr/home/suivi.html?tracking-id='],
    ['UPS', 'https://www.ups.com/track?tracknum='],
    ['DPD', 'https://trace.dpd.fr/fr/trace/'],
    ['GLS', 'https://gls-group.com/FR/fr/suivi-colis?match='],
    ['FedEx / TNT', 'https://www.fedex.com/fedextrack/?trknbr='],
    ['DB Schenker', ''], ['Geodis', ''], ['Kuehne + Nagel', ''], ['Livraison FMD', ''], ['Autre', ''],
  ];
  const lienSuivi = (l) => { const t = TRANSPORTEURS.find((x) => x[0] === l.transporteur); return t && t[1] && l.numero_suivi ? t[1] + encodeURIComponent(l.numero_suivi) : ''; };
  const ETAPES = [['preparation', 'Préparation'], ['expediee', 'Expédiée'], ['en_route', 'En route'], ['livree', 'Livrée']];
  const STATUTS = Object.fromEntries([...ETAPES, ['incident', 'Incident']]);

  // ---------- Petits outils ----------
  const pad = (n) => String(n).padStart(2, '0');
  const jourISO = (n = 0) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const total = (p) => (p.emplacements || []).reduce((s, e) => s + (Number(e.qte) || 0), 0);
  const etatStock = (p) => { const t = total(p); return t <= 0 ? 'rupture' : (p.seuil_alerte && t <= p.seuil_alerte ? 'bas' : 'ok'); };
  const libEmpl = (e) => (e.rayon ? `${e.rayon} · niv. ${e.niveau} · case ${e.case}` : 'À ranger (pas encore placé)');
  const dateFr = (d) => (d ? new Date(d.length === 10 ? d + 'T12:00:00' : d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : '—');
  const dateHeure = (d) => (d ? new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—');
  const nombre = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v));
  const prix = (v) => (v == null || v === '' ? '—' : Number(v).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }));
  // Photo d'un produit : petite image JPEG gardée dans la fiche (data URL), seulement si c'en est bien une
  // Photo : image chargée (data URL réduite) ou lien https://… (11 nov. 2026 : « soit un lien, soit charger l'image »).
  const photoValide = (v) => (typeof v === 'string' && ((/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v) && v.length <= 400000) || (/^https:\/\/[^\s"'<>]+$/i.test(v) && v.length <= 1000)) ? v : null);
  function reduirePhoto(fichier, max = 520) {
    return new Promise((ok, ko) => {
      if (!fichier || !/^image\//.test(fichier.type)) return ko(new Error('Ce fichier n’est pas une image.'));
      const url = URL.createObjectURL(fichier);
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
        const g = c.getContext('2d');
        g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height); // fond blanc (images transparentes)
        g.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        ok(c.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => { URL.revokeObjectURL(url); ko(new Error('Image illisible.')); };
      img.src = url;
    });
  }

  // ---------- Données de démonstration (d'après les photos des rayons) ----------
  function demoInitiale() {
    const P = (id, nom, marque, categorie, reference, emplacements, seuil, extra = {}) => ({ id, nom, marque, categorie, reference, emplacements, seuil_alerte: seuil, unite: 'boîte', ean: '', fournisseur: marque, numeros_suivi: '', notes: '', created_at: new Date().toISOString(), ...extra });
    const E = (rayon, niveau, kase, qte) => ({ rayon, niveau, case: kase, qte });
    const produits = [
      P('d1', 'Vis agglo TOPIX-plus 4,0 × 40 (boîte de 200)', 'HECO', 'fixation', 'HEC-40040', [E('C2', 4, 1, 48), E('S1', 2, 2, 120)], 20, { numeros_suivi: 'Lot 2026-0912' }),
      P('d2', 'Vis agglo TOPIX-plus 5,0 × 80 (boîte de 100)', 'HECO', 'fixation', 'HEC-50080', [E('C2', 3, 2, 36)], 10),
      P('d3', 'Vis agglo TOPIX-plus 6,0 × 120 (boîte de 50)', 'HECO', 'fixation', 'HEC-60120', [E('C2', 1, 3, 22)], 8),
      P('d4', 'Chevilles nylon UPA 8 (boîte de 100)', 'Upat', 'fixation', 'UPT-UPA8', [E('C3', 5, 1, 30)], 10),
      P('d5', 'Chevilles DuoPower 8 × 40 (boîte de 100)', 'fischer', 'fixation', 'FIS-DP840', [E('C3', 4, 2, 9)], 12),
      P('d6', 'Goujons d’ancrage M8 × 75 (boîte de 50)', 'Upat', 'fixation', 'UPT-M875', [E('C3', 2, 1, 12)], 5),
      P('d7', 'Rouleau peinture façade 180 mm', 'Kapriol', 'consommables', 'KAP-R180', [E('F2', 3, 1, 40)], 10, { unite: 'pièce' }),
      P('d8', 'Pinceau plat 50 mm', 'Kapriol', 'consommables', 'KAP-P50', [E('F2', 4, 2, 25)], 10, { unite: 'pièce' }),
      P('d9', 'Balai cantonnier coco 60 cm', 'Kapriol', 'outillage', 'KAP-BC60', [E('F1', 2, 1, 8)], 3, { unite: 'pièce' }),
      P('d10', 'Pelle à main acier', 'Kapriol', 'outillage', 'KAP-PEL', [E('F1', 1, 2, 6)], 2, { unite: 'pièce' }),
      P('d11', 'Rabot plaquiste', 'EDMA', 'outillage', 'EDM-RAB', [E('D2', 4, 2, 9)], 3, { unite: 'pièce' }),
      P('d12', 'Cisaille aviation coupe droite', 'EDMA', 'outillage', 'EDM-CIS', [E('D2', 5, 3, 14)], 4, { unite: 'pièce' }),
      P('d13', 'Couteau à enduire inox 20 cm', 'EDMA', 'outillage', 'EDM-CE20', [E('D2', 3, 1, 4)], 5, { unite: 'pièce' }),
      P('d14', 'Niveau à bulle 120 cm', 'EDMA', 'outillage', 'EDM-NIV120', [E('D3', 3, 4, 7)], 2, { unite: 'pièce' }),
      P('d15', 'Sweat blanc col rond (T. L)', 'Payper', 'epi', 'PAY-SW-L', [E('E2', 3, 1, 12)], 4, { unite: 'pièce' }),
      P('d16', 'Polo noir (T. L)', 'Payper', 'epi', 'PAY-PO-L', [E('E2', 4, 2, 20)], 6, { unite: 'pièce' }),
      P('d17', 'Chaussures de sécurité S3 (T. 42)', 'Kapriol', 'epi', 'KAP-CHS42', [E('E1', 1, 1, 6)], 2, { unite: 'paire', numeros_suivi: 'Série CHS-42-0001 à 0006' }),
      P('d18', 'Gilet haute visibilité jaune', 'Kapriol', 'epi', 'KAP-GHV', [E('E1', 2, 2, 30)], 10, { unite: 'pièce' }),
      P('d19', 'Ruban adhésif PVC orange 48 mm × 30 m', 'Gripeur', 'consommables', 'GRI-PVC48', [E('D4', 3, 2, 60)], 15, { unite: 'rouleau' }),
      P('d20', 'Liaison frigorifique 1/4 – 3/8 (15 m)', 'FMD', 'technique', 'CLI-LF1438', [E('S2', 2, 1, 10), E('T2', 1, 2, 2)], 3, { unite: 'couronne' }),
    ];
    const L = (id, sens, tiers, numero_commande, transporteur, numero_suivi, statut, date_prevue, lignes, extra = {}) => ({ id, sens, tiers, numero_commande, transporteur, numero_suivi, statut, date_prevue, lignes, adresse: '', notes: '', stock_applique: statut === 'livree', created_at: new Date().toISOString(), ...extra });
    const livraisons = [
      L('l1', 'entrante', 'HECO (fournisseur)', 'CMD-2026-0142', 'DB Schenker', 'SCH-7781-2245', 'en_route', jourISO(1), [{ produit: 'd1', nom: produits[0].nom, qte: 24 }, { produit: 'd2', nom: produits[1].nom, qte: 12 }]),
      L('l2', 'entrante', 'Kapriol (fournisseur)', 'CMD-2026-0145', 'Geodis', 'GEO-55410-FR', 'expediee', jourISO(3), [{ produit: 'd7', nom: produits[6].nom, qte: 20 }, { produit: 'd18', nom: produits[17].nom, qte: 15 }]),
      L('l3', 'sortante', 'Client démo — Menuiserie du Lac', 'BL-2026-0381', 'Livraison FMD', '', 'en_route', jourISO(0), [{ produit: 'd5', nom: produits[4].nom, qte: 3 }], { adresse: 'Angers (exemple)' }),
      L('l4', 'entrante', 'EDMA (fournisseur)', 'CMD-2026-0131', 'DHL', 'JD0146000012345678', 'livree', jourISO(-2), [{ produit: 'd13', nom: produits[12].nom, qte: 6 }], { date_livree: new Date(Date.now() - 2 * 864e5).toISOString() }),
    ];
    const mouvements = [
      { id: 'm1', produit: 'd13', produit_nom: produits[12].nom, type: 'entree', quantite: 6, emplacement: 'D2 · niv. 3 · case 1', motif: 'Réception CMD-2026-0131', auteur_nom: 'Démo', created_at: new Date(Date.now() - 2 * 864e5).toISOString() },
      { id: 'm2', produit: 'd5', produit_nom: produits[4].nom, type: 'sortie', quantite: -3, emplacement: 'C3 · niv. 4 · case 2', motif: 'Vente comptoir', auteur_nom: 'Démo', created_at: new Date(Date.now() - 864e5).toISOString() },
    ];
    return { stock_produits: produits, stock_livraisons: livraisons, stock_mouvements: mouvements };
  }

  // ---------- Mode « CRM » (16/11/2026) : le magasin 3D lit et écrit la base du CRM (articles, stock, mouvements, en ligne) ----------
  // Un article du magasin = un produit du CRM (même id). Quantité totale = stock du CRM ; sa répartition dans les rayons =
  // p.emplacements3d ; ce qui n'est rangé nulle part apparaît « À ranger ». Livraisons et plan : db.livraisonsMagasin,
  // db.planMagasin. Les mouvements du magasin s'ajoutent aux mouvements du CRM.
  const CAT_VERS_3D = { visserie: 'fixation', quincaillerie: 'fixation', outillage: 'outillage', collage: 'consommables', masquage: 'consommables', electricite: 'technique', vetements: 'epi',
    accessoires: 'outillage', atelier: 'outillage', automobile: 'mobilite', climatisation: 'technique', construction: 'consommables', plomberie: 'technique', genie_climatique: 'technique', electroportatif: 'outillage' }; // arborescence V2 (21 nov. 2026)
  const CAT_VERS_CRM = { fixation: 'visserie', outillage: 'outillage', consommables: 'collage', technique: 'electricite', epi: 'vetements', mobilite: 'outillage' };
  function donneesCRM(erp) {
    const D = erp.D;
    const db = () => { const b = erp.db; b.livraisonsMagasin = b.livraisonsMagasin || []; return b; };
    const nb = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
    const ranges = (p) => (p.emplacements3d || []).filter((e) => e && e.rayon).map((e) => ({ rayon: e.rayon, niveau: nb(e.niveau) || 1, case: nb(e.case) || 1, qte: nb(e.qte) }));
    // emplacements vus par le magasin : rangés + « à ranger » pour que le total = stock du CRM
    const emplacements = (p) => {
      const l = ranges(p); const st = Math.max(0, nb(p.stock)); let somme = l.reduce((t, e) => t + e.qte, 0);
      for (let i = l.length - 1; somme > st && i >= 0; i--) { const enlever = Math.min(l[i].qte, somme - st); l[i].qte -= enlever; somme -= enlever; }
      if (st > somme) l.push({ rayon: '', niveau: 1, case: 1, qte: D.arrondi(st - somme) });
      return l.filter((e) => e.qte > 0 || e.rayon);
    };
    const vers3D = (p) => ({ id: p.id, nom: p.libelle, reference: p.ref, marque: p.marque || '', categorie: CAT_VERS_3D[p.categorie] || 'autre', ean: p.code_barres || '',
      fournisseur: p.marque || '', unite: p.unite || 'pièce', prix_achat: nb(p.pmp), prix_vente: nb((p.prix || [])[0]), seuil_alerte: nb(p.alerte), numeros_suivi: p.numeros_suivi || '',
      notes: p.note || '', image: p.image || null, emplacements: emplacements(p), created_at: p.cree, updated_at: p.modifie });
    const total = (l) => (l || []).reduce((t, e) => t + nb(e.qte), 0);
    const appliquer = (p, c) => {
      if ('nom' in c && c.nom) p.libelle = String(c.nom).trim();
      if ('reference' in c && c.reference) p.ref = String(c.reference).trim();
      if ('marque' in c) p.marque = c.marque || '';
      if ('categorie' in c && c.categorie && CAT_VERS_3D[p.categorie] !== c.categorie) p.categorie = CAT_VERS_CRM[c.categorie] || p.categorie;
      if ('ean' in c) p.code_barres = c.ean || '';
      if ('unite' in c) p.unite = c.unite || '';
      if ('prix_achat' in c && c.prix_achat != null) p.pmp = nb(c.prix_achat);
      if ('prix_vente' in c && c.prix_vente != null && nb(c.prix_vente) !== nb((p.prix || [])[0])) { const pu = nb(c.prix_vente); p.prix = [pu, D.arrondi(pu * .92), D.arrondi(pu * .88), D.arrondi(pu * .82)]; (p.historique = p.historique || []).push({ d: D.maintenant(), niveau: 1, pu, par: D.MOI }); }
      if ('seuil_alerte' in c) p.alerte = nb(c.seuil_alerte);
      if ('numeros_suivi' in c) p.numeros_suivi = c.numeros_suivi || '';
      if ('notes' in c) p.note = c.notes || '';
      if ('image' in c && c.image) p.image = c.image;
      if ('emplacements' in c) { p.emplacements3d = (c.emplacements || []).filter((e) => e.rayon).map((e) => ({ rayon: e.rayon, niveau: nb(e.niveau) || 1, case: nb(e.case) || 1, qte: nb(e.qte) })); p.stock = D.arrondi(total(c.emplacements)); }
      D.toucher(p);
    };
    const enDocuments = (b, id) => [b.propositions, b.commandes, b.factures, b.achats].some((l) => (l || []).some((d) => (d.lignes || []).some((x) => x.produit === id)));
    return {
      mode: 'crm',
      async init() {
        // une seule fois : le plan déjà dessiné dans la démo du magasin (sur ce PC) passe dans la base du CRM
        const b = db();
        if (!b.planMagasin) { try { const ancien = JSON.parse(localStorage.getItem('fmd-stock-demo') || 'null'); if (ancien && Array.isArray(ancien.stock_plan)) { b.planMagasin = ancien.stock_plan; erp.sauver(); } } catch { /* rien */ } }
        // une seule fois : chaque article jamais rangé est posé dans un rayon de sa famille (comme la démo d'origine), pour que le
        // magasin 3D montre tout le catalogue ; ensuite on le déplace librement (fiche → emplacements).
        if (!b.magasinRange) {
          const plan = Array.isArray(b.planMagasin) && b.planMagasin.length ? b.planMagasin : PLAN_DEFAUT;
          const PREF = { fixation: ['C2', 'C3', 'C4', 'C5'], outillage: ['D2', 'D3', 'F1', 'C6'], consommables: ['F2', 'D4', 'C7'], technique: ['S2', 'C8', 'D1'], epi: ['E1', 'E2'], mobilite: ['F3'] };
          const ronde = {};
          for (const p of b.produits) {
            if (Array.isArray(p.emplacements3d)) continue;
            const fam = CAT_VERS_3D[p.categorie] || 'outillage';
            const liste = (PREF[fam] || []).map((id) => plan.find((x) => x.id === id)).filter(Boolean); const choixR = liste.length ? liste : plan.filter((x) => x.zone === 'vente');
            if (!choixR.length || !(nb(p.stock) > 0)) { p.emplacements3d = []; continue; }
            const n = ronde[fam] = (ronde[fam] || 0) + 1, r = choixR[(n - 1) % choixR.length];
            const niv = Math.max(1, Number(r.niveaux) || 1), cases = Math.max(1, Number(r.cases) || 1), k = Math.floor((n - 1) / choixR.length);
            p.emplacements3d = [{ rayon: r.id, niveau: niv - (k % niv), case: 1 + (Math.floor(k / niv) % cases), qte: nb(p.stock) }];
          }
          b.magasinRange = true; erp.sauver();
        }
        return 'crm';
      },
      reinitialiserDemo() {},
      async liste(table) {
        const b = db();
        if (table === 'stock_produits') return b.produits.map(vers3D);
        if (table === 'stock_livraisons') return JSON.parse(JSON.stringify(b.livraisonsMagasin));
        if (table === 'stock_mouvements') return (b.mouvements || []).slice(0, 300).map((m) => { const p = D.produit(b, m.produit);
          return { id: m.id, produit: m.produit, produit_nom: m.produit_nom || (p ? p.libelle : ''), type: m.type || (m.qte > 0 ? 'entree' : 'sortie'), quantite: m.qte, emplacement: m.emplacement || m.entrepot || null, motif: m.motif || null, auteur_nom: m.par || '', created_at: m.d }; });
        return [];
      },
      async ajouter(table, ligne) {
        const b = db();
        if (table === 'stock_produits') {
          let ref = String(ligne.reference || '').trim();
          if (!ref) { let n = b.produits.length + 1; do { ref = 'MAG-' + String(n++).padStart(4, '0'); } while (b.produits.some((x) => x.ref === ref)); }
          if (b.produits.some((x) => x.ref.toLowerCase() === ref.toLowerCase())) throw new Error('La référence « ' + ref + ' » existe déjà dans le catalogue.');
          // 21 nov. 2026 : fournisseur (un fournisseur des Tiers du CRM) et prix d'achat obligatoires pour toute nouvelle référence
          const nomF = String(ligne.fournisseur || '').trim().toLowerCase(); const fourn = nomF && b.tiers.find((t) => t.fournisseur && String(t.nom || '').trim().toLowerCase() === nomF);
          if (!fourn) throw new Error('Fournisseur obligatoire : tapez le nom exact d’un fournisseur enregistré dans le CRM (Tiers).');
          if (!(nb(ligne.prix_achat) > 0)) throw new Error('Prix d’achat obligatoire.');
          const p = { id: D.id('p'), ref, libelle: String(ligne.nom || '').trim(), marque: '', categorie: 'outillage', code_barres: '', en_vente: true, en_achat: true, description: '', url: '', image: '', entrepot: 'Showroom', poids: 0, alerte: 0, optimal: 0,
            prix: [0, 0, 0, 0], prix_min: 0, tva: 20, pmp: 0, stock: 0, note: '', cpt_vente: '707100', cpt_achat: '607100', fournisseurs: [], historique: [], cree: D.maintenant() };
          appliquer(p, { ...ligne, reference: ref });
          p.fournisseurs = [{ tiers: fourn.id, ref: '', qte_min: 1, pu: nb(ligne.prix_achat), remise: 0, delai: 0, depuis: D.auj() }];
          b.produits.push(p); D.evt(b, 'Produit ' + p.ref + ' créé depuis le magasin 3D', { objet: { type: 'produit', id: p.id } }); erp.sauver();
          return vers3D(p);
        }
        if (table === 'stock_mouvements') {
          // le stock a déjà été mis à jour par la modification de la fiche : on ne garde que la trace
          const l = { id: D.id('mv'), d: D.maintenant(), produit: ligne.produit, produit_nom: ligne.produit_nom, type: ligne.type, qte: nb(ligne.quantite), entrepot: 'Magasin', emplacement: ligne.emplacement || '', motif: ligne.motif || 'Magasin 3D', par: ligne.auteur_nom || D.MOI };
          b.mouvements = b.mouvements || []; b.mouvements.unshift(l); if (b.mouvements.length > 500) b.mouvements.length = 500; erp.sauver();
          return { ...ligne, id: l.id, created_at: l.d };
        }
        if (table === 'stock_livraisons') { const l = { id: D.id('lv'), created_at: D.maintenant(), ...ligne }; b.livraisonsMagasin.unshift(l); erp.sauver(); return JSON.parse(JSON.stringify(l)); }
        throw new Error('Table inconnue : ' + table);
      },
      async modifier(table, cle, champs) {
        const b = db();
        if (table === 'stock_produits') { const p = D.produit(b, cle); if (!p) throw new Error('Article introuvable dans le catalogue.'); appliquer(p, champs); erp.sauver(); return vers3D(p); }
        if (table === 'stock_livraisons') { const l = b.livraisonsMagasin.find((x) => x.id === cle); if (!l) throw new Error('Livraison introuvable.'); Object.assign(l, champs, { updated_at: D.maintenant() }); erp.sauver(); return JSON.parse(JSON.stringify(l)); }
        throw new Error('Table inconnue : ' + table);
      },
      async supprimer(table, cle) {
        const b = db();
        if (table === 'stock_produits') {
          if (enDocuments(b, cle)) throw new Error('cet article est utilisé dans des devis, commandes ou factures du CRM : passez-le plutôt « Hors vente » dans le CRM.');
          b.produits = b.produits.filter((x) => x.id !== cle); b.prixClients = (b.prixClients || []).filter((x) => x.produit !== cle); erp.sauver(); return;
        }
        if (table === 'stock_livraisons') { b.livraisonsMagasin = b.livraisonsMagasin.filter((x) => x.id !== cle); erp.sauver(); return; }
      },
      async lirePlan() { return db().planMagasin || null; },
      async ecrirePlan(rayons) { db().planMagasin = rayons; erp.sauver(); },
    };
  }

  // ---------- Accès aux données : base Supabase si les tables existent, sinon démo locale ----------
  function creerDonnees(sb, erp) {
    if (erp && erp.D && erp.db) return donneesCRM(erp);
    const CLE = 'fmd-stock-demo';
    let mode = null;
    let demo = null;
    const sauver = () => { try { localStorage.setItem(CLE, JSON.stringify(demo)); } catch { /* ignoré */ } };
    const id = () => 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    return {
      get mode() { return mode; },
      async init() {
        let r;
        try { r = await sb.from('stock_produits').select('id').limit(1); } catch (e) { r = { error: e }; }
        if (r && !r.error) { mode = 'base'; return mode; }
        mode = 'demo';
        try { demo = JSON.parse(localStorage.getItem(CLE) || 'null'); } catch { demo = null; }
        if (!demo || !demo.stock_produits) { demo = demoInitiale(); sauver(); }
        return mode;
      },
      reinitialiserDemo() { demo = demoInitiale(); sauver(); },
      async liste(table) {
        if (mode === 'demo') return JSON.parse(JSON.stringify(demo[table] || []));
        const { data, error } = await sb.from(table).select('*').order('created_at', { ascending: false }).limit(table === 'stock_mouvements' ? 300 : 5000);
        if (error) throw error;
        return data || [];
      },
      async ajouter(table, ligne) {
        if (mode === 'demo') { const l = { id: id(), created_at: new Date().toISOString(), ...ligne }; demo[table].unshift(l); sauver(); return l; }
        const { data, error } = await sb.from(table).insert(ligne).select().maybeSingle();
        if (error) throw error;
        return data;
      },
      async modifier(table, cle, champs) {
        if (mode === 'demo') { const l = demo[table].find((x) => x.id === cle); if (l) Object.assign(l, champs, { updated_at: new Date().toISOString() }); sauver(); return l; }
        const { data, error } = await sb.from(table).update(champs).eq('id', cle).select().maybeSingle();
        if (error) throw error;
        if (!data) throw new Error('Modification refusée par la base (droits).');
        return data;
      },
      // Plan du magasin (rayons placés et réglés dans FMD) : null = plan d'origine
      async lirePlan() {
        if (mode === 'demo') return demo.stock_plan || null;
        const { data, error } = await sb.from('stock_plan').select('rayons').eq('id', 'magasin').maybeSingle();
        if (error || !data) return null; // table absente ou plan jamais enregistré → plan d'origine
        return data.rayons;
      },
      async ecrirePlan(rayons) {
        if (mode === 'demo') { demo.stock_plan = rayons; sauver(); return; }
        const { data, error } = await sb.from('stock_plan').upsert({ id: 'magasin', rayons }).select('id').maybeSingle();
        if (error) throw error;
        if (!data) throw new Error('Enregistrement refusé par la base (réservé aux administrateurs).');
      },
      async supprimer(table, cle) {
        if (mode === 'demo') { demo[table] = demo[table].filter((x) => x.id !== cle); sauver(); return; }
        const { error } = await sb.from(table).delete().eq('id', cle);
        if (error) throw error;
      },
    };
  }

  // ---------- Chargement de three.js (une seule fois, seulement quand le module s'ouvre) ----------
  let promesseThree = null;
  function chargerThree() {
    if (window.THREE && window.THREE.OrbitControls) return Promise.resolve();
    if (promesseThree) return promesseThree;
    const script = (src) => new Promise((ok, ko) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => ko(new Error('Chargement impossible : ' + src)); document.head.appendChild(s); });
    promesseThree = script('vendor/three.min.js').then(() => script('vendor/three-orbit.js'));
    promesseThree.catch(() => { promesseThree = null; });
    return promesseThree;
  }

  // ---------- Vue 3D ----------
  function creerVue3D(el, rappels) {
    const THREE = window.THREE;
    const clair = document.documentElement.dataset.theme === 'clair';
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputEncoding = THREE.sRGBEncoding;
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(clair ? '#ece7e2' : '#141211');
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 400);
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.maxPolarAngle = Math.PI / 2.08;
    controls.minDistance = 2.5;
    controls.maxDistance = 70;
    controls.screenSpacePanning = false;

    // Lumière douce de boutique (pas d'ombres calculées : trop lourd ; ombres « peintes » sous les meubles)
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8f867e, 0.48));
    const soleil = new THREE.DirectionalLight(0xffffff, 0.62);
    soleil.position.set(14, 26, 18);
    const contre = new THREE.DirectionalLight(0xfff1e8, 0.16);
    contre.position.set(-12, 18, -16);
    scene.add(soleil, contre);

    const aJeter = [];
    const geo = (g) => { aJeter.push(g); return g; };
    const mats = new Map();
    const mat = (couleur, opts = {}) => {
      const cle = couleur + JSON.stringify(opts);
      if (!mats.has(cle)) { const m = new THREE.MeshLambertMaterial({ color: couleur, ...opts }); mats.set(cle, m); aJeter.push(m); }
      return mats.get(cle);
    };
    const CUBE = geo(new THREE.BoxGeometry(1, 1, 1));
    const boite = (lx, ly, lz, couleur, opts) => { const m = new THREE.Mesh(CUBE, mat(couleur, opts)); m.scale.set(lx, ly, lz); return m; };

    // Texte dessiné sur une texture (étiquettes des rayons et des zones)
    function texture(texte, { taille = 64, couleur = '#ffffff', fond = null, largeur = 512, hauteur = 128 } = {}) {
      const c = document.createElement('canvas');
      c.width = largeur; c.height = hauteur;
      const g = c.getContext('2d');
      if (fond) { g.fillStyle = fond; const r = hauteur / 2; g.beginPath(); g.moveTo(r, 0); g.arcTo(largeur, 0, largeur, hauteur, r); g.arcTo(largeur, hauteur, 0, hauteur, r); g.arcTo(0, hauteur, 0, 0, r); g.arcTo(0, 0, largeur, 0, r); g.fill(); }
      g.fillStyle = couleur; g.font = `700 ${taille}px Montserrat, "Segoe UI", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(texte, largeur / 2, hauteur / 2 + 2);
      const t = new THREE.CanvasTexture(c);
      t.encoding = THREE.sRGBEncoding;
      t.anisotropy = 4;
      aJeter.push(t);
      return t;
    }

    // ---- Style « boutique moderne » : blanc, noir, touches rose gold ----
    const BLANC = '#ffffff', NOIR = '#1c1b1a', RG = '#C9987D', RG_CLAIR = '#EAC2A9', GRIS = '#d9d5d0';
    const VERRE = { transparent: true, opacity: 0.35, depthWrite: false };
    // Ombre douce au sol : une seule petite texture posée sous chaque meuble (bien plus léger que de vraies ombres)
    const texOmbre = (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const g = c.getContext('2d');
      const d = g.createRadialGradient(64, 64, 6, 64, 64, 64);
      d.addColorStop(0, 'rgba(0,0,0,0.5)'); d.addColorStop(0.6, 'rgba(0,0,0,0.2)'); d.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = d; g.fillRect(0, 0, 128, 128);
      const t = new THREE.CanvasTexture(c);
      aJeter.push(t);
      return t;
    })();
    const MAT_OMBRE = new THREE.MeshBasicMaterial({ map: texOmbre, transparent: true, depthWrite: false, opacity: 0.7 });
    aJeter.push(MAT_OMBRE);
    const PLAN1 = geo(new THREE.PlaneGeometry(1, 1));
    const ombre = (lx, lz, y = 0.014) => { const o = new THREE.Mesh(PLAN1, MAT_OMBRE); o.rotation.x = -Math.PI / 2; o.scale.set(lx, lz, 1); o.position.y = y; o.renderOrder = 1; return o; };

    // Sol, zones, murs
    const sol = new THREE.Mesh(geo(new THREE.PlaneGeometry(LARG, PROF)), mat('#e8e3de'));
    sol.rotation.x = -Math.PI / 2;
    scene.add(sol);
    const TEINTES = { Cuisine: '#e2dbd3', Bureau: '#dfdde6', 'Réserve': '#ded8d2', 'Stockage arrière': '#ecdccf', 'Zone réception': '#d9e3dc', 'Entrée': '#EAC2A9' };
    for (const [x, y, w, h, nom, couleur] of SOLS) {
      const z = new THREE.Mesh(geo(new THREE.PlaneGeometry(w * ECHELLE, h * ECHELLE)), mat(TEINTES[nom] || couleur));
      z.rotation.x = -Math.PI / 2;
      z.position.set(mx(x + w / 2), 0.005, mz(y + h / 2));
      scene.add(z);
      const t = texture(nom.toUpperCase(), { taille: 54, couleur: '#a08a7c' });
      const lw = Math.min(w * ECHELLE * 0.9, 4.2);
      const p = new THREE.Mesh(geo(new THREE.PlaneGeometry(lw, lw / 4)), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
      aJeter.push(p.material);
      p.rotation.x = -Math.PI / 2;
      if (h > w * 1.6) p.rotation.z = Math.PI / 2;
      p.position.set(mx(x + w / 2), 0.012, mz(y + h / 2));
      scene.add(p);
    }
    const murs = []; // masqués en vue de face d'un rayon (ils voilaient la vue)
    for (const [x1, y1, x2, y2, haut, ext] of MURS) {
      const lx = Math.max(Math.abs(x2 - x1) * ECHELLE, 0.15), lz = Math.max(Math.abs(y2 - y1) * ECHELLE, 0.15);
      const m = boite(lx, haut, lz, '#ffffff', ext ? { transparent: true, opacity: 0.45, depthWrite: false } : {});
      m.position.set(mx((x1 + x2) / 2), haut / 2, mz((y1 + y2) / 2));
      const chapeau = boite(lx + 0.01, 0.05, lz + 0.01, NOIR); // liseré noir en haut des murs
      chapeau.position.set(m.position.x, haut, m.position.z);
      scene.add(m, chapeau);
      murs.push(m, chapeau);
    }

    // Extérieur : trottoirs, route et arbres devant l'entrée (côté nord du plan)
    const AVANT = mz(Y0);                 // façade de l'entrée
    const ROUTE_Z = AVANT - 8;            // milieu de la route (3 m de trottoir/parking + 5 m)
    const PORTE_X = mx(775);              // milieu de la porte d'entrée
    const exterieur = new THREE.Mesh(geo(new THREE.PlaneGeometry(160, 120)), mat('#d6d0ca'));
    exterieur.rotation.x = -Math.PI / 2;
    exterieur.position.set(0, -0.02, ROUTE_Z + 30);
    scene.add(exterieur);
    const trottoir = boite(140, 0.12, 4, '#f6f4f1');
    trottoir.position.set(0, 0.06, AVANT - 2.2);
    const enFace = boite(140, 0.12, 3, '#f1eee9');
    enFace.position.set(0, 0.06, ROUTE_Z - 6);
    const route = boite(140, 0.04, 9, '#38383b');
    route.position.set(0, 0.02, ROUTE_Z);
    scene.add(trottoir, enFace, route);
    for (let x = -68; x <= 68; x += 4) { const t = boite(2, 0.02, 0.18, '#ffffff'); t.position.set(x, 0.05, ROUTE_Z); scene.add(t); }
    for (const dz of [-4.3, 4.3]) { const b = boite(140, 0.02, 0.15, '#ffffff'); b.position.set(0, 0.05, ROUTE_Z + dz); scene.add(b); }
    const quai = texture('LIVRAISONS', { taille: 60, couleur: RG });
    const marque = new THREE.Mesh(geo(new THREE.PlaneGeometry(4.4, 1.1)), new THREE.MeshBasicMaterial({ map: quai, transparent: true, depthWrite: false }));
    aJeter.push(marque.material);
    marque.rotation.x = -Math.PI / 2;
    marque.position.set(PORTE_X, 0.13, AVANT - 2.2);
    scene.add(marque);
    const BOULE = geo(new THREE.SphereGeometry(1, 14, 10));
    const arbre = (x, z, t = 1) => {
      const a = new THREE.Group();
      const tronc = boite(0.16, 1.1 * t, 0.16, '#8d7b6d'); tronc.position.y = 0.55 * t;
      const houppe = new THREE.Mesh(BOULE, mat('#a9c6a3')); houppe.scale.set(0.85 * t, 1 * t, 0.85 * t); houppe.position.y = 1.75 * t;
      a.add(tronc, houppe, ombre(2.2 * t, 2.2 * t, 0.01));
      a.position.set(x, 0.12, z);
      scene.add(a);
    };
    for (const x of [-26, -18, -10, 14, 22, 30]) if (Math.abs(x - PORTE_X) > 4) arbre(x, AVANT - 3.5, x % 4 ? 0.9 : 1.05);
    for (const x of [-30, -20, -6, 6, 18, 28]) arbre(x, ROUTE_Z - 6.2, 1);

    // Rayons : un « constructeur » par type ; un rayon est reconstruit seul quand on le modifie.
    const cliquables = [];
    const estVisible = (o) => { for (let x = o; x; x = x.parent) if (!x.visible) return false; return true; };
    const groupes = new Map();
    let etiqOn = true;
    let masques = new Set(), glisseRayon = null; // (vue de face / édition : voir plus bas)
    const hauteurNiveau = (r, k) => {
      if (r.type === 'palette') return 0.15;
      if (r.type === 'ilot' || r.type === 'comptoir') return r.haut;
      if (r.type === 'portant') return r.haut * (k / r.niveaux);         // barre n° k
      return r.niveaux === 1 ? 0.12 : 0.12 + (k - 1) * ((r.haut - 0.3) / (r.niveaux - 1));
    };
    const espaceNiveau = (r) => (r.niveaux === 1 ? 0.35 : (r.haut - 0.3) / (r.niveaux - 1));
    const adosse = (r) => ['gondole', 'tete', 'mural', 'vitrine'].includes(r.type); // produits rangés contre le fond
    function construireRayon(r) {
      const L = r.long, P = r.prof, H = r.haut, t = r.type;
      const g = new THREE.Group();
      g.position.set(r.x, 0, r.z);
      g.rotation.y = r.rot * Math.PI / 180;
      g.userData = { rayon: r.id };
      const ajouter = (m, x, y, z, ud) => { m.position.set(x, y, z); m.userData = { rayon: r.id, ...ud }; g.add(m); cliquables.push(m); return m; };
      const deco = (m, x, y, z) => { m.position.set(x, y, z); g.add(m); return m; };
      g.add(ombre(L + 0.8, P + 0.8));
      if (t === 'gondole' || t === 'tete' || t === 'mural') {
        ajouter(boite(L, 0.1, P, NOIR), 0, 0.05, 0);                                        // socle noir
        ajouter(boite(L, H, 0.04, t === 'mural' ? NOIR : BLANC), 0, H / 2, -P / 2 + 0.02);    // fond
        for (const sx of [-1, 1]) deco(boite(0.035, H, 0.06, NOIR), sx * (L / 2 - 0.018), H / 2, -P / 2 + 0.05);
        for (let k = 1; k <= r.niveaux; k++) {
          const pr = k === 1 ? P : Math.max(0.28, P * (0.95 - (k - 1) * 0.08)), y = hauteurNiveau(r, k);
          ajouter(boite(L - 0.02, 0.03, pr, BLANC), 0, y, -P / 2 + pr / 2, { niveau: k });
          ajouter(boite(L - 0.02, 0.035, 0.015, RG), 0, y + 0.004, -P / 2 + pr, { niveau: k }); // bandeau prix
        }
        if (t === 'tete') deco(boite(L, 0.26, 0.05, RG), 0, H + 0.15, -P / 2 + 0.03);           // fronton
      } else if (t === 'vitrine') {
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) ajouter(boite(0.04, H, 0.04, NOIR), sx * (L / 2 - 0.02), H / 2, sz * (P / 2 - 0.02));
        ajouter(boite(L, 0.12, P, NOIR), 0, 0.06, 0);
        deco(boite(L, 0.04, P, NOIR), 0, H, 0);
        ajouter(boite(L - 0.06, H - 0.16, 0.012, BLANC), 0, H / 2 + 0.04, -P / 2 + 0.02);
        for (let k = 1; k <= r.niveaux; k++) ajouter(boite(L - 0.06, 0.012, P - 0.06, '#dceaf0', VERRE), 0, hauteurNiveau(r, k), 0, { niveau: k });
        deco(boite(L - 0.06, H - 0.16, 0.01, '#dceaf0', VERRE), 0, H / 2 + 0.04, P / 2 - 0.02);  // vitre avant
      } else if (t === 'bacs') {
        for (const sx of [-1, 1]) ajouter(boite(0.04, H, P, NOIR), sx * (L / 2 - 0.02), H / 2, 0);
        ajouter(boite(L, H, 0.03, BLANC), 0, H / 2, -P / 2 + 0.015);
        const n = nbCases(r), lc = (L - 0.08) / n;
        for (let k = 1; k <= r.niveaux; k++) {
          for (let c = 0; c < n; c++) {
            const bac = ajouter(boite(lc * 0.92, 0.16, P * 0.85, c % 2 ? RG_CLAIR : BLANC), -L / 2 + 0.04 + (c + 0.5) * lc, hauteurNiveau(r, k) + 0.08, 0.02, { niveau: k });
            bac.rotation.x = 0.12;
          }
        }
      } else if (t === 'portant') {
        for (const sx of [-1, 1]) {
          ajouter(boite(0.04, H, 0.04, NOIR), sx * (L / 2 - 0.02), H / 2, 0);
          ajouter(boite(0.05, 0.03, P, NOIR), sx * (L / 2 - 0.02), 0.015, 0);
        }
        for (let k = 1; k <= r.niveaux; k++) ajouter(boite(L, 0.035, 0.035, RG), 0, hauteurNiveau(r, k), 0, { niveau: k });
      } else if (t === 'ilot') {
        ajouter(boite(L - 0.14, H - 0.05, P - 0.14, NOIR), 0, (H - 0.05) / 2, 0);
        ajouter(boite(L, 0.05, P, BLANC), 0, H - 0.025, 0, { niveau: 1 });
      } else if (t === 'comptoir') {
        ajouter(boite(L, H - 0.04, P, NOIR), 0, (H - 0.04) / 2, 0);
        ajouter(boite(L + 0.06, 0.04, P + 0.1, RG), 0, H - 0.02, 0, { niveau: 1 });
        deco(boite(L * 0.7, 0.05, 0.01, RG), 0, H * 0.55, P / 2 + 0.006);
      } else if (t === 'palette') {
        ajouter(boite(L, 0.15, P, '#dcc6a8'), 0, 0.075, 0, { niveau: 1 });
      } else { // rack
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) ajouter(boite(0.07, H, 0.07, NOIR), sx * (L / 2 - 0.035), H / 2, sz * (P / 2 - 0.035));
        for (let k = 1; k <= r.niveaux; k++) {
          const y = hauteurNiveau(r, k);
          ajouter(boite(L, 0.035, P - 0.04, GRIS), 0, y, 0, { niveau: k });
          for (const sz of [-1, 1]) ajouter(boite(L, 0.09, 0.05, RG), 0, y - 0.05, sz * (P / 2 - 0.03), { niveau: k });
        }
      }
      // Étiquette (numéro du rayon)
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture(r.id, { taille: 70, couleur: '#ffffff', fond: NOIR, largeur: 192, hauteur: 96 }), depthTest: false }));
      s.scale.set(0.5, 0.25, 1);
      s.position.set(0, H + 0.35, 0);
      s.renderOrder = 5;
      s.userData = { etiquette: true };
      s.visible = etiqOn;
      g.add(s);
      scene.add(g);
      groupes.set(r.id, { g, r, L, P });
    }
    function retirerRayon(id) {
      const G = groupes.get(id);
      if (!G) return;
      scene.remove(G.g);
      G.g.children.forEach((m) => {
        const i = cliquables.indexOf(m);
        if (i >= 0) cliquables.splice(i, 1);
        if (m.isSprite) { m.material.map.dispose(); m.material.dispose(); }
      });
      groupes.delete(id);
    }
    RAYONS.forEach(construireRayon);

    // Produits posés sur les étagères (pendus sur les portants, empilés sur les palettes)
    const coucheProduits = new THREE.Group();
    scene.add(coucheProduits);
    let derniersProduits = [];
    function majProduits(produits) {
      derniersProduits = produits;
      scene.updateMatrixWorld(true); // positions des rayons à jour avant de poser les produits
      if (survole && survole.type === 'produit') survoler(null);
      for (const m of [...coucheProduits.children]) { coucheProduits.remove(m); cliquables.splice(cliquables.indexOf(m), 1); }
      for (const p of produits) {
        (p.emplacements || []).forEach((e) => {
          const G = groupes.get(e.rayon);
          if (!G) return;
          const { r, L, P } = G;
          const n = nbCases(r), lc = L / n;
          const k = Math.min(Math.max(1, Number(e.niveau) || 1), r.niveaux);
          const c = Math.min(Math.max(1, Number(e.case) || 1), n);
          let larg = lc * 0.9, h, prof, y, z = 0;
          if (r.type === 'portant') {          // vêtement pendu sous la barre
            h = Math.min(0.75, (r.haut / r.niveaux) * 0.55); prof = P * 0.8; larg = Math.min(lc * 0.5, 0.12);
            y = hauteurNiveau(r, k) - 0.05 - h / 2;
          } else if (r.type === 'palette') {   // pile de cartons
            h = Math.max(0.2, r.haut - 0.2); prof = P * 0.9; larg = lc * 0.95; y = 0.16 + h / 2;
          } else {
            h = r.type === 'ilot' || r.type === 'comptoir' ? 0.25 : Math.min(0.3, espaceNiveau(r) * 0.7);
            prof = Math.min(P * 0.8, 0.6);
            y = hauteurNiveau(r, k) + 0.02 + h / 2;
            if (adosse(r)) z = -P / 2 + 0.05 + prof / 2;
          }
          const etat = etatStock(p);
          const m = boite(larg, h, prof, cat(p.categorie)[2], etat === 'ok' ? {} : { emissive: etat === 'rupture' ? '#5a0d06' : '#3a1508' });
          m.position.copy(G.g.localToWorld(new THREE.Vector3(-L / 2 + (c - 0.5) * lc, y, z)));
          m.rotation.y = G.g.rotation.y;
          m.visible = !masques.has(r.id) && !(glisseRayon && glisseRayon.id === r.id);
          m.userData = { produit: p.id, rayon: r.id, niveau: k, nom: p.nom, qte: e.qte, unite: p.unite || '', alerte: etat !== 'ok' };
          coucheProduits.add(m);
          cliquables.push(m);
        });
      }
      if (focus) { appliquerMasque(); majQte(); } // vue de face : étiquettes de quantité refaites (stock en direct)
      rendre();
    }

    // Sélection (boîte rose gold autour du rayon) et repère (épingle rose gold au-dessus d'un produit)
    const selection = new THREE.Mesh(CUBE, new THREE.MeshBasicMaterial({ color: RG, transparent: true, opacity: 0.22, depthWrite: false }));
    aJeter.push(selection.material);
    selection.visible = false;
    scene.add(selection);
    const repere = new THREE.Group();
    const matEpingle = new THREE.MeshBasicMaterial({ color: RG });
    aJeter.push(matEpingle);
    const pointe = new THREE.Mesh(geo(new THREE.ConeGeometry(0.11, 0.3, 16)), matEpingle);
    pointe.rotation.x = Math.PI; pointe.position.y = -0.05;
    const tete = new THREE.Mesh(BOULE, matEpingle); tete.scale.setScalar(0.15); tete.position.y = 0.17;
    repere.add(pointe, tete);
    repere.visible = false;
    scene.add(repere);
    let selId = null;
    function selectionner(id) {
      const G = groupes.get(id);
      selId = G ? id : null;
      if (id !== focus) sortirFace(!id); // désélection : la caméra revient où elle était
      selection.visible = Boolean(G);
      if (G) { selection.position.set(G.g.position.x, G.r.haut / 2 + 0.05, G.g.position.z); selection.rotation.y = G.g.rotation.y; selection.scale.set(G.L + 0.16, G.r.haut + 0.25, G.P + 0.16); }
      rendre();
    }
    function montrerProduit(idProduit) {
      const m = coucheProduits.children.find((x) => x.userData.produit === idProduit);
      repere.visible = Boolean(m);
      if (m) { repere.position.set(m.position.x, m.position.y + 0.55, m.position.z); cadrer(m.userData.rayon); }
      rendre();
    }

    // Camions de livraison animés sur la route (une livraison « expédiée » ou « en route » = un camion).
    // Fournisseur → FMD : arrive, se gare devant l'entrée, puis repart. FMD → client : part de l'entrée vers le client.
    const COULEURS_TRANSP = { DHL: '#ffcc00', UPS: '#5a3b1e', Chronopost: '#1f4e9c', Colissimo: '#f3c300', DPD: '#dc0032', GLS: '#173d8f',
      'FedEx / TNT': '#4d148c', Geodis: '#0a5aa4', 'DB Schenker': '#d9d9d9', 'Kuehne + Nagel': '#003d7c', 'Livraison FMD': '#C9987D' };
    const coucheCamions = new THREE.Group();
    scene.add(coucheCamions);
    let camions = [];
    const ROUE = geo(new THREE.CylinderGeometry(0.45, 0.45, 0.32, 14));
    function fabriquerCamion(l) {
      const g = new THREE.Group();
      const cabine = COULEURS_TRANSP[l.transporteur] || '#8a8f96';
      const ud = { livraison: l.id };
      const piece = (m, x, y, z) => { m.position.set(x, y, z); m.userData = ud; g.add(m); cliquables.push(m); return m; };
      piece(boite(5, 2.5, 2.4, '#f2efeb'), -0.9, 1.85, 0);                         // caisse
      piece(boite(5.02, 0.28, 2.42, l.sens === 'entrante' ? '#86c39f' : '#C9987D'), -0.9, 1.15, 0); // bande (vert = arrive, rose = part)
      piece(boite(1.8, 2.1, 2.3, cabine), 2.5, 1.55, 0);                            // cabine
      piece(boite(0.06, 0.8, 2.0, '#1d2833'), 3.42, 2.0, 0);                        // pare-brise
      for (const x of [-2.6, -0.9, 2.5]) for (const z of [-1.1, 1.1]) {
        const r = new THREE.Mesh(ROUE, mat('#151515'));
        r.rotation.x = Math.PI / 2; r.position.set(x, 0.45, z); g.add(r);
      }
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture(`${l.sens === 'entrante' ? '↓' : '↑'} ${l.transporteur || 'Livraison'} · ${l.numero_commande || l.tiers || ''}`, { taille: 34, couleur: '#0b0908', fond: l.sens === 'entrante' ? '#bfe3cd' : '#EAC2A9', largeur: 640, hauteur: 80 }), depthTest: false }));
      aJeter.push(s.material);
      s.scale.set(5.2, 0.65, 1); s.position.set(0, 4.0, 0); s.renderOrder = 6;
      g.add(s);
      // Halo rose gold au sol + contour, visibles seulement quand la souris survole le camion
      const halo = new THREE.Group();
      const sol = new THREE.Mesh(HALO_SOL, HALO_MAT);
      sol.rotation.x = -Math.PI / 2; sol.position.set(0.35, 0.04, 0); sol.renderOrder = 2;
      const contour = new THREE.LineSegments(HALO_CONTOUR, HALO_LIGNE);
      contour.position.set(0.35, 1.7, 0);
      halo.add(sol, contour);
      halo.visible = false;
      g.add(halo);
      g.userData.halo = halo;
      return g;
    }
    const HALO_SOL = geo(new THREE.PlaneGeometry(8.4, 3.6));
    const HALO_MAT = new THREE.MeshBasicMaterial({ color: '#EAC2A9', transparent: true, opacity: 0.55, depthWrite: false });
    const HALO_CONTOUR = geo(new THREE.EdgesGeometry(new THREE.BoxGeometry(8.0, 3.5, 3.0)));
    const HALO_LIGNE = new THREE.LineBasicMaterial({ color: '#F7DAC5' });
    aJeter.push(HALO_MAT, HALO_LIGNE);

    // Survol à la souris (l'essentiel : camions, rayons, produits) :
    //  camion → grossit + contour et halo rose gold ; rayon → contour rose gold + numéro agrandi ;
    //  produit → la boîte grossit. Bulle avec le nom (rayon, produit), curseur « main ».
    const contourRayon = new THREE.LineSegments(geo(new THREE.EdgesGeometry(CUBE)), HALO_LIGNE);
    contourRayon.visible = false;
    const voile = new THREE.Mesh(CUBE, new THREE.MeshBasicMaterial({ color: '#F7DAC5', transparent: true, opacity: 0.16, depthWrite: false }));
    aJeter.push(voile.material);
    contourRayon.add(voile); // même place et même taille que le contour
    scene.add(contourRayon);
    const bulle = document.createElement('div');
    bulle.className = 'stk-bulle';
    bulle.hidden = true;
    el.appendChild(bulle);
    let survole = null, dernierPointeur = null, dernierEcran = null;
    function appliquer(s, oui) {
      if (s.type === 'camion') { s.c.g.scale.setScalar(oui ? 1.18 : 1); s.c.g.userData.halo.visible = oui; }
      else if (s.type === 'produit') {
        if (oui) { s.m.userData.echelle = s.m.scale.clone(); s.m.scale.multiplyScalar(1.25); }
        else if (s.m.userData.echelle) s.m.scale.copy(s.m.userData.echelle);
      } else if (s.type === 'rayon') {
        const G = s.G;
        contourRayon.visible = oui;
        if (oui) { contourRayon.position.set(G.g.position.x, G.r.haut / 2 + 0.05, G.g.position.z); contourRayon.rotation.y = G.g.rotation.y; contourRayon.scale.set(G.L + 0.12, G.r.haut + 0.2, G.P + 0.12); }
        const et = G.g.children.find((x) => x.userData.etiquette);
        if (et) et.scale.set(oui ? 0.8 : 0.5, oui ? 0.4 : 0.25, 1);
      }
    }
    function survoler(s) {
      if ((s && s.cle) !== (survole && survole.cle)) {
        if (survole) appliquer(survole, false);
        survole = s;
        if (s) appliquer(s, true);
        renderer.domElement.style.cursor = s ? (edition && s.type !== 'camion' ? 'move' : 'pointer') : '';
        rendre();
      }
      if (survole && survole.texte && dernierEcran) {
        const b = el.getBoundingClientRect();
        bulle.textContent = survole.texte;
        bulle.style.left = `${Math.min(dernierEcran[0] - b.left + 14, b.width - 220)}px`;
        bulle.style.top = `${dernierEcran[1] - b.top + 16}px`;
        bulle.hidden = false;
      } else bulle.hidden = true;
    }
    function verifierSurvol() {
      if (!dernierPointeur) return survoler(null);
      ray.setFromCamera(dernierPointeur, camera);
      const hit = ray.intersectObjects(cliquables, false).find((h) => estVisible(h.object));
      const u = hit ? hit.object.userData : null;
      if (!u) return survoler(null);
      if (u.livraison) { const c = camions.find((x) => x.l.id === u.livraison); return survoler(c ? { type: 'camion', cle: 'l' + c.l.id, c } : null); }
      if (u.produit) {
        return survoler({ type: 'produit', cle: 'p' + hit.object.id, m: hit.object,
          texte: `${u.nom || 'Produit'}${u.qte != null && u.qte !== '' ? ` · ${u.qte}${u.unite ? ' ' + u.unite : ''}` : ''} — ${u.rayon}, niveau ${u.niveau}` });
      }
      const G = groupes.get(u.rayon);
      return survoler(G ? { type: 'rayon', cle: 'r' + G.r.id, G, texte: `${G.r.id} — ${G.r.nom}` } : null);
    }
    function majCamions(livraisons) {
      survoler(null);
      for (const c of camions) { coucheCamions.remove(c.g); c.g.children.forEach((m) => { const i = cliquables.indexOf(m); if (i >= 0) cliquables.splice(i, 1); }); }
      camions = livraisons.filter((l) => ['expediee', 'en_route'].includes(l.statut)).map((l, i) => {
        const g = fabriquerCamion(l);
        coucheCamions.add(g);
        return { g, l, decalage: i * 6.5 };
      });
      placerCamions(performance.now() / 1000);
      lancer();
    }
    const doux = (u) => 1 - Math.pow(1 - u, 3);
    function placerCamions(t) {
      for (const c of camions) {
        const entrante = c.l.sens === 'entrante';
        const T = entrante ? 18 : 15;
        const u = ((t + c.decalage) % T + T) % T;
        let x;
        if (entrante) x = u < 9 ? -60 + (PORTE_X + 60) * doux(u / 9) : u < 13 ? PORTE_X : PORTE_X + 70 * ((u - 13) / 5) ** 2;
        else x = u < 3 ? PORTE_X : PORTE_X - 75 * ((u - 3) / 12) ** 1.6;
        c.g.position.set(x, 0, ROUTE_Z + (entrante ? 2.1 : -2.1));
        c.g.rotation.y = entrante ? 0 : Math.PI;
        c.g.visible = x > -62 && x < 62;
      }
    }
    // Boucle d'animation : seulement s'il y a des camions, ~30 images/s, en pause si demandé.
    let anime = true, boucleId = 0, derniere = 0;
    function boucle(now) {
      boucleId = 0;
      if (!anime || !camions.length) return;
      boucleId = requestAnimationFrame(boucle);
      if (now - derniere < 33) return;
      derniere = now;
      placerCamions(now / 1000);
      if (dernierPointeur) verifierSurvol(); // le camion bouge sous la souris
      renderer.render(scene, camera);
    }
    function lancer() { if (anime && camions.length && !boucleId) boucleId = requestAnimationFrame(boucle); else rendre(); }
    function animation(oui) { anime = oui; if (!oui && boucleId) { cancelAnimationFrame(boucleId); boucleId = 0; } lancer(); }
    function suivreCamion(id) {
      const c = camions.find((x) => x.l.id === id);
      controls.target.set(c ? c.g.position.x : PORTE_X, 1.5, ROUTE_Z);
      camera.position.set((c ? c.g.position.x : PORTE_X) + 10, 9, ROUTE_Z - 14);
      controls.update(); rendre();
    }

    // Caméra
    function vue(nom) {
      sortirFace();
      cancelAnimationFrame(glisse); glisse = 0;
      if (nom === 'dessus') { camera.position.set(0, 46, -2.99); controls.target.set(0, 0, -3); }
      else if (nom === 'route') { camera.position.set(PORTE_X + 14, 8, ROUTE_Z - 13); controls.target.set(PORTE_X - 4, 1, AVANT); }
      else { camera.position.set(LARG * 0.3, 21, PROF * 0.62); controls.target.set(0, 0, -4); }
      controls.update(); rendre();
    }
    // Vue de face d'un rayon : la caméra glisse jusqu'à hauteur d'yeux, bien en face ; les rayons qui gênent sont
    // masqués ; chaque produit du rayon porte une étiquette « quantité restante + nom » (refaite à chaque changement
    // de stock, donc en direct quand un autre PC modifie).
    let focus = null, glisse = 0;
    const coucheQte = new THREE.Group();
    scene.add(coucheQte);
    const avantDe = (G) => new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), G.g.rotation.y);
    function etiquetteQte(qte, unite, nom, alerte) {
      const c = document.createElement('canvas');
      c.width = 256; c.height = 150;
      const g = c.getContext('2d');
      g.fillStyle = 'rgba(11,9,8,0.9)'; g.strokeStyle = alerte ? '#e8806d' : '#C9987D'; g.lineWidth = 6;
      g.beginPath(); g.roundRect ? g.roundRect(4, 4, 248, 142, 22) : g.rect(4, 4, 248, 142); g.fill(); g.stroke();
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = alerte ? '#ff9a85' : '#F7DAC5'; g.font = '800 66px Montserrat, "Segoe UI", sans-serif';
      g.fillText(String(qte ?? 0), 128, 58);
      g.fillStyle = '#ffffff'; g.font = '600 22px Montserrat, "Segoe UI", sans-serif';
      let n = `${unite ? unite + ' · ' : ''}${nom || ''}`;
      while (n.length > 4 && g.measureText(n).width > 232) n = n.slice(0, -2);
      if (n !== `${unite ? unite + ' · ' : ''}${nom || ''}`) n = n.trim() + '…';
      g.fillText(n, 128, 118);
      const t = new THREE.CanvasTexture(c);
      t.encoding = THREE.sRGBEncoding;
      return t;
    }
    function viderQte() { for (const s of [...coucheQte.children]) { coucheQte.remove(s); s.material.map.dispose(); s.material.dispose(); } }
    function majQte() {
      viderQte();
      const G = focus && groupes.get(focus);
      if (!G) return;
      const avant = avantDe(G);
      for (const m of coucheProduits.children) {
        const u = m.userData;
        if (u.rayon !== focus) continue;
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: etiquetteQte(u.qte, u.unite, u.nom, u.alerte), depthTest: false }));
        const l = Math.min(0.3, Math.max(0.2, (u.echelle || m.scale).x));
        s.scale.set(l, l * 150 / 256, 1);
        s.position.copy(m.position).addScaledVector(avant, (u.echelle || m.scale).z / 2 + 0.03);
        s.renderOrder = 7;
        coucheQte.add(s);
      }
    }
    function appliquerMasque() {
      groupes.forEach((H, id) => {
        H.g.visible = !masques.has(id);
        // en vue de face, seuls les numéros du rayon regardé restent affichés
        H.g.children.forEach((c) => { if (c.userData.etiquette) c.visible = focus ? id === focus : etiqOn; });
      });
      for (const m of coucheProduits.children) m.visible = !masques.has(m.userData.rayon);
      murs.forEach((m) => { m.visible = !focus; });
      coucheCamions.visible = !focus; // leurs étiquettes passaient à travers les murs
    }
    let avantFace = null; // où était la caméra avant la vue de face (pour y revenir)
    function sortirFace(revenir) {
      if (!focus) return;
      if (revenir && avantFace) glisser(avantFace.pos, avantFace.cible);
      avantFace = null;
      focus = null; masques = new Set();
      appliquerMasque(); viderQte();
      selection.material.opacity = 0.22;
      rendre();
    }
    function glisser(pos, cible) {
      cancelAnimationFrame(glisse);
      const p0 = camera.position.clone(), c0 = controls.target.clone(), t0 = performance.now();
      const pas = (now) => {
        const u = Math.min(1, (now - t0) / 700), e = doux(u);
        camera.position.lerpVectors(p0, pos, e); controls.target.lerpVectors(c0, cible, e);
        controls.update(); renderer.render(scene, camera);
        glisse = u < 1 ? requestAnimationFrame(pas) : 0;
      };
      glisse = requestAnimationFrame(pas);
    }
    function cadrer(id) {
      const G = groupes.get(id);
      if (!G) return;
      G.g.updateMatrixWorld(true);
      const avant = avantDe(G);
      const vfov = camera.fov * Math.PI / 180, hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
      const d = Math.max(2.6, 1.12 * Math.max((G.L / 2 + 0.5) / Math.tan(hfov / 2), (G.r.haut / 2 + 0.55) / Math.tan(vfov / 2)));
      const devant = new THREE.Vector3(G.g.position.x, 0, G.g.position.z).addScaledVector(avant, G.P / 2);
      const cible = devant.clone().setY(G.r.haut * 0.5);
      const pos = devant.clone().addScaledVector(avant, d).setY(G.r.haut * 0.5 + 0.25);
      // Rayons entre la caméra et ce rayon : masqués le temps de la vue de face
      const garde = avantFace || { pos: camera.position.clone(), cible: controls.target.clone() };
      sortirFace();
      avantFace = garde;
      focus = id;
      const inv = new THREE.Matrix4().copy(G.g.matrixWorld).invert();
      groupes.forEach((H, autre) => {
        if (autre === id) return;
        const c = H.g.position.clone().applyMatrix4(inv), demi = Math.max(H.L, H.P) / 2;
        if (Math.abs(c.x) < G.L / 2 + demi + 0.6 && c.z + demi > G.P / 2 + 0.05 && c.z - demi < G.P / 2 + d + 0.5) masques.add(autre);
      });
      appliquerMasque();
      selection.material.opacity = 0.07;
      majQte();
      glisser(pos, cible);
    }
    function etiquettes(visibles) { etiqOn = visibles; appliquerMasque(); rendre(); }

    // Rendu à la demande (rien ne tourne en continu)
    let demande = 0;
    function rendre() { if (demande || boucleId) return; demande = requestAnimationFrame(() => { demande = 0; renderer.render(scene, camera); }); }
    controls.addEventListener('change', rendre);
    controls.addEventListener('start', () => { if (glisse) { cancelAnimationFrame(glisse); glisse = 0; } }); // la main reprend la caméra
    const taille = () => {
      const w = el.clientWidth || 600, h = el.clientHeight || 400;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%';
      camera.aspect = w / h; camera.updateProjectionMatrix(); rendre();
    };
    const ro = new ResizeObserver(taille);
    ro.observe(el);
    taille();
    vue('perspective');

    // Clic (sans glisser) : produit, ou rayon + niveau + case
    const ray = new THREE.Raycaster();
    let depart = null;
    const pointeur = (ev) => { const b = renderer.domElement.getBoundingClientRect(); return new THREE.Vector2(((ev.clientX - b.left) / b.width) * 2 - 1, -((ev.clientY - b.top) / b.height) * 2 + 1); };
    const surBas = (ev) => { depart = [ev.clientX, ev.clientY]; };
    const surHaut = (ev) => {
      if (glisseRayon) {
        const gr = glisseRayon;
        glisseRayon = null;
        controls.enabled = true;
        if (gr.bouge) { depart = null; majProduits(derniersProduits); if (rappels.deplace) rappels.deplace(gr.id, gr.G.r.x, gr.G.r.z); return; }
      }
      if (!depart || Math.hypot(ev.clientX - depart[0], ev.clientY - depart[1]) > 5) { depart = null; return; }
      depart = null;
      ray.setFromCamera(pointeur(ev), camera);
      const hit = ray.intersectObjects(cliquables, false).find((h) => estVisible(h.object));
      if (!hit) return rappels.vide && rappels.vide();
      const u = hit.object.userData;
      if (u.livraison) return rappels.clic({ livraison: u.livraison });
      const G = groupes.get(u.rayon);
      let kase = 1;
      if (G) { const loc = G.g.worldToLocal(hit.point.clone()); kase = Math.min(nbCases(G.r), Math.max(1, Math.floor((loc.x + G.L / 2) / (G.L / nbCases(G.r))) + 1)); }
      rappels.clic({ produit: u.produit || null, rayon: u.rayon, niveau: u.niveau || null, case: kase });
    };
    let survolDemande = 0;
    const surBouge = (ev) => {
      if (glisseRayon) { deplacer(ev); return; }
      if (ev.buttons) { if (survole) { dernierPointeur = null; survoler(null); } return; } // on fait tourner la vue : pas de survol
      dernierPointeur = pointeur(ev);
      dernierEcran = [ev.clientX, ev.clientY];
      if (!survolDemande) survolDemande = requestAnimationFrame(() => { survolDemande = 0; verifierSurvol(); });
    };
    const surSortie = () => { dernierPointeur = null; survoler(null); };
    // Mode édition du plan : glisser un rayon pour le déplacer (aimanté tous les 5 cm) ; un simple clic le sélectionne.
    let edition = false;
    const solPlan = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const pointSol = (ev) => { ray.setFromCamera(pointeur(ev), camera); const v = new THREE.Vector3(); return ray.ray.intersectPlane(solPlan, v) ? v : null; };
    const aimant = (v, lim) => Math.round(Math.min(lim, Math.max(-lim, v)) / 0.05) * 0.05;
    const surBasEdition = (ev) => { // phase de capture : passe avant la rotation de la caméra
      if (!edition || ev.button !== 0) return;
      ray.setFromCamera(pointeur(ev), camera);
      const hit = ray.intersectObjects(cliquables, false).find((h) => estVisible(h.object) && h.object.userData.rayon);
      const G = hit && groupes.get(hit.object.userData.rayon);
      const p = G && pointSol(ev);
      if (!p) return;
      controls.enabled = false;
      glisseRayon = { id: G.r.id, G, dx: G.g.position.x - p.x, dz: G.g.position.z - p.z, x0: ev.clientX, y0: ev.clientY, bouge: false };
    };
    function deplacer(ev) {
      const gr = glisseRayon, p = pointSol(ev);
      if (!p) return;
      if (!gr.bouge) {
        if (Math.hypot(ev.clientX - gr.x0, ev.clientY - gr.y0) < 5) return;
        gr.bouge = true;
        survoler(null);
        for (const m of coucheProduits.children) if (m.userData.rayon === gr.id) m.visible = false;
      }
      const r = gr.G.r;
      r.x = +aimant(p.x + gr.dx, LARG / 2).toFixed(2);
      r.z = +aimant(p.z + gr.dz, PROF / 2).toFixed(2);
      gr.G.g.position.set(r.x, 0, r.z);
      if (selId === r.id) { selection.position.x = r.x; selection.position.z = r.z; }
      if (rappels.bouge) rappels.bouge(r);
      rendre();
    }
    renderer.domElement.addEventListener('pointerdown', surBasEdition, true);
    renderer.domElement.addEventListener('pointerdown', surBas);
    renderer.domElement.addEventListener('pointerup', surHaut);
    renderer.domElement.addEventListener('pointermove', surBouge);
    renderer.domElement.addEventListener('pointerleave', surSortie);

    return {
      majProduits, majCamions, animation, suivreCamion, selectionner, montrerProduit, vue, cadrer, etiquettes, rendre,
      // Édition du plan
      majRayon(r) { survoler(null); retirerRayon(r.id); construireRayon(r); majProduits(derniersProduits); if (selId === r.id) selectionner(r.id); },
      majPlan() {
        survoler(null); sortirFace();
        [...groupes.keys()].forEach(retirerRayon);
        RAYONS.forEach(construireRayon);
        majProduits(derniersProduits);
        selectionner(selId && groupes.has(selId) ? selId : null);
      },
      edition(oui) { edition = oui; if (oui) sortirFace(true); survoler(null); rendre(); },
      centreVue() { return { x: controls.target.x, z: controls.target.z }; },
      detruire() {
        ro.disconnect();
        anime = false;
        if (boucleId) cancelAnimationFrame(boucleId);
        if (demande) cancelAnimationFrame(demande);
        renderer.domElement.removeEventListener('pointerdown', surBasEdition, true);
        renderer.domElement.removeEventListener('pointerdown', surBas);
        renderer.domElement.removeEventListener('pointerup', surHaut);
        renderer.domElement.removeEventListener('pointermove', surBouge);
        renderer.domElement.removeEventListener('pointerleave', surSortie);
        if (survolDemande) cancelAnimationFrame(survolDemande);
        if (glisse) cancelAnimationFrame(glisse);
        viderQte();
        controls.dispose();
        aJeter.forEach((x) => x.dispose && x.dispose());
        renderer.dispose();
        renderer.forceContextLoss();
        renderer.domElement.remove();
      },
    };
  }

  // ---------- Module ----------
  function monter(conteneur, ctx) {
    const { sb, moi, admin, notifier, esc } = ctx;
    const donnees = creerDonnees(sb, ctx.erp);
    const lire = (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
    const ecrire = (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignoré */ } };
    let onglet = ['magasin', 'produits', 'livraisons', 'mouvements'].includes(lire('fmd-stock-onglet')) ? lire('fmd-stock-onglet') : 'magasin';
    let produits = [], livraisons = [], mouvements = [];
    let vue3d = null, etiquettesVisibles = true, animationOn = lire('fmd-stock-anim', '1') !== '0';
    let selRayon = null, selProduit = null, selLivraison = null;
    let recherche = '', filtreCat = '', filtreAlerte = false, filtreSens = '';
    let choix = null; // { brouillon, index } : choix d'un emplacement sur le plan pour la fiche produit
    let edition = false, planAvant = null, selEdit = null, planSig = ''; // mode « Modifier le magasin »
    let canal = null, detruit = false, minuterie = 0;
    conteneur.classList.add('page-stock');
    const fenetre = document.getElementById('fenetre');
    const $ = (s) => conteneur.querySelector(s);
    const prod = (id) => produits.find((p) => p.id === id) || null;
    const peutSupprimer = () => admin || donnees.mode === 'demo' || donnees.mode === 'crm';
    const peutModifierPlan = () => admin || donnees.mode === 'demo' || donnees.mode === 'crm';
    const virgule = (v) => String(+Number(v).toFixed(2)).replace('.', ',');

    async function charger() {
      try {
        [produits, livraisons, mouvements] = await Promise.all(['stock_produits', 'stock_livraisons', 'stock_mouvements'].map((t) => donnees.liste(t)));
      } catch (e) { notifier('Stock : lecture impossible (' + (e.message || e) + ').'); }
      produits.sort((a, b) => String(a.nom).localeCompare(String(b.nom), 'fr'));
      mouvements.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
      let changePlan = false;
      if (!edition) {
        let plan = null;
        try { plan = await donnees.lirePlan(); } catch { plan = null; }
        RAYONS = copiePlan(Array.isArray(plan) && plan.length ? plan : PLAN_DEFAUT);
        const sig = JSON.stringify(RAYONS);
        changePlan = planSig !== '' && sig !== planSig;
        planSig = sig;
      }
      return changePlan;
    }

    async function mouvement(p, type, quantite, emplacement, motif) {
      if (!quantite) return;
      try { await donnees.ajouter('stock_mouvements', { produit: p.id, produit_nom: p.nom, type, quantite, emplacement: emplacement || null, motif: motif || null, auteur_nom: moi.nom }); } catch (e) { notifier('Mouvement non enregistré : ' + (e.message || e)); }
    }

    // ---------- Dessin général ----------
    function stats() {
      const alertes = produits.filter((p) => etatStock(p) !== 'ok').length;
      const enRoute = livraisons.filter((l) => ['expediee', 'en_route'].includes(l.statut)).length;
      const unites = produits.reduce((s, p) => s + total(p), 0);
      return `${produits.length} références · ${unites.toLocaleString('fr-FR')} unités · <span class="${alertes ? 'texte-danger' : ''}">${alertes} alerte${alertes > 1 ? 's' : ''} de stock</span> · ${enRoute} livraison${enRoute > 1 ? 's' : ''} en route`;
    }
    function dessiner() {
      if (detruit) return;
      fermerVitrine();
      fermer3D();
      const enRoute = livraisons.filter((l) => ['expediee', 'en_route'].includes(l.statut)).length;
      conteneur.innerHTML = `
        <header class="entete stk-entete">
          <div class="ag-titre"><h2 style="font-size:20px;margin:0">Stock & Magasin ${donnees.mode === 'crm' ? '<span class="pastille">Relié au CRM</span>' : '<span class="pastille">Démo</span>'}</h2>
            <span class="discret" id="stk-stats">${stats()}</span></div>
          <div class="onglets onglets-param" style="margin:0">
            ${[['magasin', 'Magasin 3D'], ['produits', 'Produits'], ['livraisons', 'Livraisons'], ['mouvements', 'Mouvements']].map(([k, t]) => `<button type="button" data-onglet="${k}" class="${onglet === k ? 'actif' : ''}">${t}${k === 'livraisons' && enRoute ? ` <span class="compteur">${enRoute}</span>` : ''}</button>`).join('')}
          </div>
        </header>
        ${donnees.mode === 'crm' ? '<div class="stk-bandeau">Mêmes articles et même stock que le CRM (Catalogue › Produits), enregistrés en ligne : une quantité changée ici change le stock du CRM, et inversement. Les quantités pas encore placées dans un rayon apparaissent « À ranger ».</div>' : ''}
        ${donnees.mode === 'demo' ? `<div class="stk-bandeau">Mode démo : données d’essai enregistrées sur ce PC uniquement (rien en ligne, aucun autre module touché).
          <button type="button" class="btn btn-ligne petit" id="stk-reinit">Remettre la démo à zéro</button></div>` : ''}
        <div class="stk-corps stk-${onglet}" id="stk-corps"></div>`;
      conteneur.querySelectorAll('[data-onglet]').forEach((b) => b.addEventListener('click', () => {
        if (edition) { if (planAvant !== JSON.stringify(RAYONS) && !window.confirm('Quitter le mode édition sans enregistrer le plan du magasin ?')) return; quitterEdition(false); }
        onglet = b.dataset.onglet; ecrire('fmd-stock-onglet', onglet); if (onglet !== 'magasin') choix = null; dessiner();
      }));
      const reinit = $('#stk-reinit');
      if (reinit) reinit.addEventListener('click', async () => { if (!window.confirm('Remettre les données de démonstration à leur état de départ ?')) return; if (edition) quitterEdition(false); donnees.reinitialiserDemo(); planSig = ''; await charger(); selRayon = null; dessiner(); notifier('Démo remise à zéro.'); });
      ({ magasin: dessinerMagasin, produits: dessinerProduits, livraisons: dessinerLivraisons, mouvements: dessinerMouvements })[onglet]();
    }

    // ---------- Onglet Magasin 3D ----------
    function fermer3D() { if (vue3d) { vue3d.detruire(); vue3d = null; } }
    function dessinerMagasin() {
      const corps = $('#stk-corps');
      corps.innerHTML = `
        <div class="stk-scene" id="stk-scene">
          <div class="stk-outils" id="stk-outils"></div>
          ${choix ? `<div class="stk-choix">Cliquez sur l’étagère où se trouve « ${esc(choix.brouillon.nom || 'le produit')} » <button type="button" class="btn btn-ligne petit" id="stk-choix-annuler">Annuler</button></div>` : ''}
          <div class="stk-legende">${CATEGORIES.map(([, n, c]) => `<span><i style="background:${c}"></i>${esc(n)}</span>`).join('')}<span><i class="alerte"></i>Stock bas</span></div>
          <div class="stk-aide discret">Glisser : tourner · Clic droit : déplacer · Molette : zoom · Clic : voir un rayon ou un produit</div>
          <div class="stk-chargement" id="stk-charg">Chargement du magasin en 3D…</div>
        </div>
        <aside class="stk-panneau carte" id="stk-panneau"></aside>`;
      dessinerOutils();
      const ann = $('#stk-choix-annuler');
      if (ann) ann.addEventListener('click', () => { const c = choix; choix = null; ouvrirFiche(c.brouillon); dessiner(); });
      dessinerPanneau();
      const sceneEl = $('#stk-scene');
      chargerThree().then(() => {
        if (detruit || !sceneEl.isConnected || vue3d) return;
        try {
          vue3d = creerVue3D(sceneEl, {
            clic: surClic3D,
            bouge: (r) => { if (edition && selEdit === r.id) { const fx = $('#re-x'), fz = $('#re-z'); if (fx) fx.value = r.x; if (fz) fz.value = r.z; } },
            deplace: (id, x, z) => { const r = rayon(id); if (r) { r.x = x; r.z = z; } if (edition) { selEdit = id; vue3d.selectionner(id); dessinerPanneau(); } },
            vide: () => { fermerVitrine(); if (edition) { selEdit = null; vue3d.selectionner(null); dessinerPanneau(); return; } if (!choix) { selRayon = null; selProduit = null; selLivraison = null; vue3d.selectionner(null); vue3d.montrerProduit(null); dessinerPanneau(); } } });
        } catch (e) {
          sceneEl.querySelector('#stk-charg').textContent = 'La 3D n’est pas disponible sur ce PC (' + (e.message || e) + '). Les onglets Produits, Livraisons et Mouvements fonctionnent.';
          return;
        }
        sceneEl.querySelector('#stk-charg').remove();
        vue3d.majProduits(produits);
        vue3d.animation(animationOn);
        vue3d.majCamions(livraisons);
        vue3d.etiquettes(etiquettesVisibles);
        if (edition) { vue3d.edition(true); if (selEdit) vue3d.selectionner(selEdit); }
        if (selRayon) { vue3d.selectionner(selRayon); vue3d.cadrer(selRayon); }
        if (selProduit) vue3d.montrerProduit(selProduit);
      }).catch((e) => { const c = $('#stk-charg'); if (c) c.textContent = 'La 3D n’a pas pu être chargée : ' + (e.message || e); });
    }

    // Barre d'outils de la vue 3D (normale, ou mode « Modifier le magasin »)
    function dessinerOutils() {
      const zone = $('#stk-outils');
      if (!zone) return;
      const b = (attr, texte, titre = '', classe = 'btn-ligne') => `<button type="button" class="btn ${classe} petit" ${attr} ${titre ? `title="${titre}"` : ''}>${texte}</button>`;
      zone.innerHTML = [
        b('data-vue="perspective"', 'Vue 3D'), b('data-vue="dessus"', 'Vue de dessus'),
        edition ? '' : b('data-vue="route"', 'Vue route'),
        b('id="stk-etiq"', `${etiquettesVisibles ? 'Masquer' : 'Afficher'} les numéros`),
        edition ? '' : b('id="stk-anim"', animationOn ? '⏸ Camions' : '▶ Camions', 'Mettre en pause l’animation des camions (PC lent)'),
        edition ? b('id="stk-plan-ok"', '✓ Enregistrer le plan', '', 'btn-metal') + b('id="stk-plan-annuler"', 'Annuler')
          : peutModifierPlan() ? b('id="stk-plan-edit"', '✎ Modifier le magasin', 'Ajouter, déplacer et régler les rayons', 'btn-metal') : '',
      ].join('');
      zone.querySelectorAll('[data-vue]').forEach((x) => x.addEventListener('click', () => vue3d && vue3d.vue(x.dataset.vue)));
      zone.querySelector('#stk-etiq').addEventListener('click', (ev) => { etiquettesVisibles = !etiquettesVisibles; ev.target.textContent = `${etiquettesVisibles ? 'Masquer' : 'Afficher'} les numéros`; if (vue3d) vue3d.etiquettes(etiquettesVisibles); });
      const anim = zone.querySelector('#stk-anim');
      if (anim) anim.addEventListener('click', (ev) => { animationOn = !animationOn; ecrire('fmd-stock-anim', animationOn ? '1' : '0'); ev.target.textContent = animationOn ? '⏸ Camions' : '▶ Camions'; if (vue3d) vue3d.animation(animationOn); });
      const ed = zone.querySelector('#stk-plan-edit');
      if (ed) ed.addEventListener('click', () => entrerEdition());
      const ok = zone.querySelector('#stk-plan-ok');
      if (ok) ok.addEventListener('click', enregistrerPlan);
      const an = zone.querySelector('#stk-plan-annuler');
      if (an) an.addEventListener('click', () => { if (planAvant !== JSON.stringify(RAYONS) && !window.confirm('Annuler toutes les modifications du plan ?')) return; quitterEdition(false); });
      const scene = $('#stk-scene');
      let aide = $('#stk-edit-aide');
      if (edition && scene && !aide) { aide = document.createElement('div'); aide.id = 'stk-edit-aide'; aide.className = 'stk-choix'; aide.textContent = 'Mode édition : glissez un meuble pour le déplacer · cliquez dessus pour le régler'; scene.appendChild(aide); }
      if (!edition && aide) aide.remove();
    }

    // ---------- Mode « Modifier le magasin » ----------
    function entrerEdition(id = null) {
      fermerVitrine();
      edition = true; planAvant = JSON.stringify(RAYONS); selEdit = id;
      selRayon = null; selProduit = null; selLivraison = null; choix = null;
      if (vue3d) { vue3d.montrerProduit(null); vue3d.edition(true); vue3d.selectionner(id); if (!id) vue3d.vue('dessus'); }
      dessinerOutils(); dessinerPanneau();
    }
    function quitterEdition(garder) {
      if (!garder) { RAYONS = copiePlan(JSON.parse(planAvant)); if (vue3d) vue3d.majPlan(); }
      edition = false; planAvant = null; selEdit = null;
      if (vue3d) { vue3d.edition(false); vue3d.selectionner(null); }
      dessinerOutils(); dessinerPanneau();
    }
    async function enregistrerPlan() {
      const ids = RAYONS.map((r) => r.id);
      if (new Set(ids).size !== ids.length) return notifier('Deux meubles ont le même code : corrigez-le avant d’enregistrer.');
      try {
        await donnees.ecrirePlan(RAYONS);
        planSig = JSON.stringify(RAYONS);
        notifier(donnees.mode === 'demo' ? 'Plan du magasin enregistré (démo : sur ce PC).' : 'Plan du magasin enregistré pour tout le monde.');
        quitterEdition(true);
      } catch (e) { notifier('Plan non enregistré : ' + (e.message || e)); }
    }
    const produitsDans = (id) => produits.filter((p) => (p.emplacements || []).some((e) => e.rayon === id)).length;
    function nouveauCode(prefixe) { let i = 1; while (rayon(prefixe + i)) i++; return prefixe + i; }
    const PREFIXES = { gondole: 'G', tete: 'H', mural: 'M', portant: 'V', vitrine: 'W', bacs: 'BV', ilot: 'T', palette: 'PL', rack: 'S', comptoir: 'K' };
    function ajouterRayon(type) {
      const t = typeRayon(type), c = vue3d ? vue3d.centreVue() : { x: 0, z: 0 };
      const id = nouveauCode(PREFIXES[type] || 'X');
      const r = normaliserRayon({ id, nom: `${t.nom} ${id.replace(/^\D+/, '')}`, zone: 'vente', type, x: c.x, z: c.z, rot: 0, long: t.long, prof: t.prof, haut: t.haut, niveaux: t.niveaux, cases: Math.max(1, Math.round(t.long / t.pas)) });
      RAYONS.push(r);
      selEdit = r.id;
      if (vue3d) { vue3d.majRayon(r); vue3d.selectionner(r.id); }
      dessinerPanneau();
      notifier(`${t.nom} ajouté(e) au centre de la vue : glissez-le à sa place.`);
    }
    function panneauEdition(pan) {
      const r = rayon(selEdit);
      const dim = (t) => `${virgule(t.long)} × ${virgule(t.prof)} m`;
      if (!r) {
        pan.innerHTML = `
          <h2>Modifier le magasin</h2>
          <p class="discret" style="margin:6px 0 14px">Ajoutez un meuble, puis glissez-le à sa place dans la 3D. Cliquez sur un meuble pour régler ses dimensions et son rangement.</p>
          <div class="groupe-titre">Ajouter un meuble</div>
          <div class="stk-catalogue">${Object.entries(TYPES_RAYON).map(([k, t]) => `<button type="button" class="stk-type" data-ajout="${k}">
            <span class="stk-type-ico">${t.icone}</span><span class="stk-ligne-texte"><b>${esc(t.nom)}</b><span class="discret">${esc(t.desc)} · ${dim(t)}</span></span><span class="stk-type-plus">+</span></button>`).join('')}</div>
          <div class="groupe-titre" style="margin-top:16px">Meubles du magasin (${RAYONS.length})</div>
          ${Object.entries(ZONES).map(([z, nom]) => { const rs = RAYONS.filter((x) => x.zone === z); return rs.length ? `<div class="stk-zone"><b>${esc(nom)}</b>
            <div class="stk-puces">${rs.map((x) => `<button type="button" class="pastille" data-edit="${esc(x.id)}" title="${esc(x.nom)}">${esc(x.id)}</button>`).join('')}</div></div>` : ''; }).join('')}
          <button type="button" class="btn btn-ligne petit" id="re-defaut" style="margin-top:14px">Revenir au plan d’origine</button>`;
        pan.querySelectorAll('[data-ajout]').forEach((x) => x.addEventListener('click', () => ajouterRayon(x.dataset.ajout)));
        pan.querySelectorAll('[data-edit]').forEach((x) => x.addEventListener('click', () => { selEdit = x.dataset.edit; if (vue3d) vue3d.selectionner(selEdit); dessinerPanneau(); }));
        pan.querySelector('#re-defaut').addEventListener('click', () => {
          const orphelins = [...new Set(produits.flatMap((p) => (p.emplacements || []).map((e) => e.rayon)))].filter((id) => !PLAN_DEFAUT.some((x) => x.id === id));
          if (orphelins.length) return notifier(`Impossible : des produits sont rangés dans ${orphelins.join(', ')}, qui n’existe(nt) pas dans le plan d’origine.`);
          if (!window.confirm('Remettre tous les rayons comme dans le plan d’origine ? (Il faudra encore cliquer sur « Enregistrer le plan ».)')) return;
          RAYONS = copiePlan(PLAN_DEFAUT); selEdit = null;
          if (vue3d) vue3d.majPlan();
          dessinerPanneau();
        });
        return;
      }
      const t = typeRayon(r.type), n = produitsDans(r.id);
      const depasse = produits.reduce((s2, p) => s2 + (p.emplacements || []).filter((e) => e.rayon === r.id && (Number(e.niveau) > r.niveaux || Number(e.case) > r.cases)).length, 0);
      const nb = (k, lib, min, max, pas, attrs = '') => `<div class="champ"><label>${lib}</label><input type="number" data-r="${k}" min="${min}" max="${max}" step="${pas}" value="${r[k]}" ${attrs}></div>`;
      pan.innerHTML = `
        <div class="titre-carte" style="margin-bottom:8px"><div><span class="pastille">${t.icone} ${esc(t.nom)}</span>
          <h2 style="margin-top:8px">${esc(r.id)} — ${esc(r.nom || 'Sans nom')}</h2>
          <span class="discret">${n} produit${n > 1 ? 's' : ''} rangé${n > 1 ? 's' : ''} ici · ${r.niveaux * r.cases} emplacement${r.niveaux * r.cases > 1 ? 's' : ''}</span></div>
          <button type="button" class="btn-icone" id="re-fermer" title="Fermer">✕</button></div>
        <div class="stk-form" style="grid-template-columns:90px 1fr">
          <div class="champ"><label>Code</label><input data-r="id" value="${esc(r.id)}" maxlength="8" ${n ? 'disabled title="Des produits sont rangés ici : code non modifiable"' : ''}></div>
          <div class="champ"><label>Nom</label><input data-r="nom" value="${esc(r.nom)}" maxlength="80"></div></div>
        <div class="stk-form">
          <div class="champ"><label>Type de meuble</label><select data-r="type">${Object.entries(TYPES_RAYON).map(([k, x]) => `<option value="${k}" ${k === r.type ? 'selected' : ''}>${esc(x.nom)}</option>`).join('')}</select></div>
          <div class="champ"><label>Zone</label><select data-r="zone">${Object.entries(ZONES).map(([k, x]) => `<option value="${k}" ${k === r.zone ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></div></div>
        <div class="groupe-titre">Dimensions (en mètres)</div>
        <div class="stk-form trois">${nb('long', 'Longueur', 0.2, 30, 0.05)}${nb('prof', 'Profondeur', 0.2, 5, 0.05)}${nb('haut', 'Hauteur', 0.3, 6, 0.05)}</div>
        <div class="groupe-titre">Rangement</div>
        <div class="stk-form">${nb('niveaux', r.type === 'portant' ? 'Barres' : 'Niveaux (étagères)', 1, 12, 1, t.unNiveau ? 'disabled' : '')}${nb('cases', r.type === 'portant' ? 'Places par barre' : 'Produits par niveau', 1, 80, 1)}</div>
        <button type="button" class="btn btn-ligne petit" id="re-auto">Produits par niveau selon la longueur : ${Math.max(1, Math.round(r.long / t.pas))}</button>
        ${depasse ? `<p class="texte-danger" style="font-size:12px;margin:10px 0 0">⚠ ${depasse} emplacement${depasse > 1 ? 's' : ''} de produit dépasse${depasse > 1 ? 'nt' : ''} ce meuble : affiché${depasse > 1 ? 's' : ''} sur le dernier niveau / la dernière place. Pensez à les déplacer.</p>` : ''}
        <div class="groupe-titre" style="margin-top:14px">Position et orientation</div>
        <div class="stk-form trois">${nb('x', 'Gauche ↔ droite', -LARG / 2, LARG / 2, 0.05, 'id="re-x"')}${nb('z', 'Avant ↔ fond', -PROF / 2, PROF / 2, 0.05, 'id="re-z"')}${nb('rot', 'Rotation (°)', -180, 180, 15, 'id="re-rot"')}</div>
        <div class="actions-maj"><button type="button" class="btn btn-ligne petit" data-tourne="-90">↺ 90°</button><button type="button" class="btn btn-ligne petit" data-tourne="90">↻ 90°</button><button type="button" class="btn btn-ligne petit" data-tourne="180">Demi-tour</button></div>
        <p class="discret" style="font-size:12px;margin-top:8px">Astuce : glissez le meuble dans la 3D pour le déplacer (il s’aimante tous les 5 cm).</p>
        <div class="actions-maj" style="margin-top:16px;border-top:1px solid var(--ligne);padding-top:14px">
          <button type="button" class="btn btn-ligne petit" id="re-dupliquer">Dupliquer</button>
          <button type="button" class="btn btn-ligne petit texte-danger" id="re-suppr" ${n ? 'disabled title="Des produits sont rangés ici : déplacez-les d’abord"' : ''}>Supprimer</button>
          <button type="button" class="btn btn-ligne petit" id="re-fini">Terminé</button></div>`;
      let attente = 0;
      const reconstruire = () => { cancelAnimationFrame(attente); attente = requestAnimationFrame(() => { if (vue3d) vue3d.majRayon(r); }); };
      pan.querySelectorAll('input[data-r]').forEach((c) => c.addEventListener('input', () => {
        const k = c.dataset.r;
        if (k === 'nom') { r.nom = c.value; return; }
        if (k === 'id' || c.value === '' || !Number.isFinite(Number(c.value))) return;
        r[k] = Number(c.value);
        Object.assign(r, normaliserRayon(r));
        reconstruire();
      }));
      pan.querySelectorAll('input[data-r]').forEach((c) => c.addEventListener('change', () => {
        const k = c.dataset.r;
        if (k === 'id') {
          const nv = normaliserRayon({ ...r, id: c.value }).id;
          if (nv !== r.id && rayon(nv)) { notifier(`Le code ${nv} existe déjà.`); c.value = r.id; return; }
          r.id = nv; selEdit = nv;
          if (vue3d) { vue3d.majPlan(); vue3d.selectionner(nv); }
        }
        dessinerPanneau();
      }));
      pan.querySelectorAll('select[data-r]').forEach((c) => c.addEventListener('change', () => {
        r[c.dataset.r] = c.value;
        if (c.dataset.r === 'type') { const nt = typeRayon(c.value); Object.assign(r, { haut: nt.haut, niveaux: nt.niveaux, cases: Math.max(1, Math.round(r.long / nt.pas)) }); }
        Object.assign(r, normaliserRayon(r));
        if (vue3d) vue3d.majRayon(r);
        dessinerPanneau();
      }));
      pan.querySelectorAll('[data-tourne]').forEach((x) => x.addEventListener('click', () => {
        Object.assign(r, normaliserRayon({ ...r, rot: r.rot + Number(x.dataset.tourne) }));
        pan.querySelector('#re-rot').value = r.rot;
        if (vue3d) vue3d.majRayon(r);
      }));
      pan.querySelector('#re-auto').addEventListener('click', () => { r.cases = Math.max(1, Math.round(r.long / t.pas)); if (vue3d) vue3d.majRayon(r); dessinerPanneau(); });
      pan.querySelector('#re-fermer').addEventListener('click', () => { selEdit = null; if (vue3d) vue3d.selectionner(null); dessinerPanneau(); });
      pan.querySelector('#re-fini').addEventListener('click', () => { selEdit = null; if (vue3d) vue3d.selectionner(null); dessinerPanneau(); });
      pan.querySelector('#re-dupliquer').addEventListener('click', () => {
        const copie = normaliserRayon({ ...r, id: nouveauCode(r.id.replace(/\d+$/, '') || 'X'), nom: r.nom + ' (copie)', x: r.x + 0.5, z: r.z + 0.5 });
        RAYONS.push(copie); selEdit = copie.id;
        if (vue3d) { vue3d.majRayon(copie); vue3d.selectionner(copie.id); }
        dessinerPanneau();
      });
      pan.querySelector('#re-suppr').addEventListener('click', () => {
        if (produitsDans(r.id)) return;
        if (!window.confirm(`Supprimer le meuble ${r.id} — ${r.nom} ? (Il faudra encore cliquer sur « Enregistrer le plan ».)`)) return;
        RAYONS = RAYONS.filter((x) => x !== r); selEdit = null;
        if (vue3d) vue3d.majPlan();
        dessinerPanneau();
      });
    }

    function surClic3D({ produit, rayon: idRayon, niveau, case: kase, livraison }) {
      if (edition) {
        if (livraison) return;
        selEdit = idRayon;
        vue3d.selectionner(idRayon);
        dessinerPanneau();
        return;
      }
      if (livraison) {
        if (choix) return notifier('Cliquez sur une étagère, pas sur un camion.');
        selLivraison = livraison; selRayon = null; selProduit = null;
        vue3d.selectionner(null); vue3d.montrerProduit(null);
        dessinerPanneau();
        return;
      }
      if (choix) {
        const c = choix;
        choix = null;
        const e = c.brouillon.emplacements[c.index] || { qte: 0 };
        c.brouillon.emplacements[c.index] = { rayon: idRayon, niveau: niveau || 1, case: kase, qte: e.qte || 0 };
        notifier(`Emplacement choisi : ${libEmpl(c.brouillon.emplacements[c.index])}`);
        dessiner();
        ouvrirFiche(c.brouillon);
        return;
      }
      selLivraison = null;
      if (produit) { selProduit = produit; selRayon = idRayon; vue3d.selectionner(idRayon); vue3d.montrerProduit(produit); dessinerPanneau(); ouvrirVitrine(idRayon, produit); return; }
      selProduit = null; selRayon = idRayon;
      vue3d.selectionner(idRayon); vue3d.montrerProduit(null); vue3d.cadrer(idRayon);
      dessinerPanneau();
      ouvrirVitrine(idRayon);
    }

    // ---------- Fenêtre transparente d'un rayon : tous ses articles, avec photo et informations ----------
    let vitrine = null; // { id, produit } : rayon affiché
    const surTouche = (ev) => { if (ev.key === 'Escape' && vitrine) fermerVitrine(); };
    function fermerVitrine() {
      vitrine = null;
      document.removeEventListener('keydown', surTouche);
      const v = $('#stk-vitrine');
      if (v) v.remove();
    }
    function ouvrirVitrine(id, produit = null) {
      if (!rayon(id) || !$('#stk-scene')) return;
      vitrine = { id, produit };
      document.removeEventListener('keydown', surTouche);
      document.addEventListener('keydown', surTouche);
      dessinerVitrine();
    }
    function vignette(p) {
      const img = photoValide(p.image);
      if (img) return `<img src="${esc(img)}" alt="" loading="lazy">`;
      const c = cat(p.categorie)[2];
      const lettres = String(p.marque || p.nom || '?').replace(/[^A-Za-zÀ-ÿ0-9]/g, '').slice(0, 3).toUpperCase() || '?';
      return `<span class="stk-vignette-vide" style="--c:${c}"><b>${esc(lettres)}</b><small>Pas de photo</small></span>`;
    }
    function dessinerVitrine() {
      const scene = $('#stk-scene');
      const r = vitrine && rayon(vitrine.id);
      if (!scene || !r) return fermerVitrine();
      let el = $('#stk-vitrine');
      const defil = el ? el.scrollTop : 0;
      if (!el) { el = document.createElement('div'); el.id = 'stk-vitrine'; el.className = 'stk-vitrine'; scene.appendChild(el); }
      const t = typeRayon(r.type);
      const ici = produits.flatMap((p) => (p.emplacements || []).map((e, i) => ({ p, e, i }))).filter((x) => x.e.rayon === r.id);
      const unites = ici.reduce((n, x) => n + (Number(x.e.qte) || 0), 0);
      const alertes = new Set(ici.filter((x) => etatStock(x.p) !== 'ok').map((x) => x.p.id)).size;
      const ETAT = { ok: 'En stock', bas: 'Stock bas', rupture: 'Rupture' };
      const ligneInfo = (lib, val) => (val == null || val === '' ? '' : `<div><span>${lib}</span><b>${val}</b></div>`);
      const carte = ({ p, e, i }) => {
        const etat = etatStock(p);
        const c = cat(p.categorie);
        return `<article class="stk-carte-produit ${vitrine.produit === p.id ? 'actif' : ''}" data-carte="${esc(p.id)}">
          <div class="stk-carte-img">${vignette(p)}<span class="stk-carte-etat ${etat}">${ETAT[etat]}</span><span class="stk-carte-place">${r.type === 'portant' ? 'Barre' : 'Niv.'} ${esc(e.niveau)} · place ${esc(e.case)}</span></div>
          <div class="stk-carte-corps">
            <span class="stk-carte-cat"><i style="background:${c[2]}"></i>${esc(c[1])}</span>
            <h3>${esc(p.nom)}</h3>
            <span class="discret">${esc([p.marque, p.reference].filter(Boolean).join(' · ') || '—')}</span>
            <div class="stk-carte-qte"><b>${Number(e.qte) || 0}</b><span>${esc(p.unite || 'unité')} ici<br><span class="discret">${total(p)} au total</span></span>
              <span class="stk-carte-pm"><button type="button" class="btn-icone" data-moins-e="${esc(p.id)}" data-i="${i}" title="Retirer 1 ici">−</button><button type="button" class="btn-icone" data-plus-e="${esc(p.id)}" data-i="${i}" title="Ajouter 1 ici">+</button></span></div>
            <div class="stk-carte-infos">
              ${ligneInfo('Autres places', (p.emplacements || []).filter((x, j) => j !== i).map((x) => esc(libEmpl(x)) + ' (' + (Number(x.qte) || 0) + ')').join('<br>'))}
              ${ligneInfo('Code-barres', esc(p.ean || ''))}
              ${ligneInfo('Fournisseur', esc(p.fournisseur || ''))}
              ${p.prix_achat != null && p.prix_achat !== '' ? ligneInfo('Prix d’achat HT', prix(p.prix_achat)) : ''}
              ${p.prix_vente != null && p.prix_vente !== '' ? ligneInfo('Prix de vente HT', prix(p.prix_vente)) : ''}
              ${ligneInfo('Seuil d’alerte', p.seuil_alerte ? esc(p.seuil_alerte) : '')}
              ${ligneInfo('N° de suivi', esc(p.numeros_suivi || ''))}
              ${ligneInfo('Notes', esc(p.notes || ''))}
            </div>
            <div class="actions-maj stk-carte-actions">
              <button type="button" class="btn btn-ligne petit" data-fiche="${esc(p.id)}">Fiche complète</button>
              <button type="button" class="btn btn-ligne petit" data-voir3d="${esc(p.id)}">Voir en 3D</button></div>
          </div></article>`;
      };
      const vides = [];
      for (let k = r.niveaux; k >= 1; k--) if (!ici.some((x) => Math.min(Number(x.e.niveau) || 1, r.niveaux) === k)) vides.push(k);
      el.innerHTML = `
        <div class="stk-vitrine-tete">
          <div><span class="pastille">${esc(ZONES[r.zone])}</span> <span class="pastille">${t.icone} ${esc(t.nom)}</span>
            <h2>${esc(r.id)} — ${esc(r.nom)}</h2>
            <span class="discret">${ici.length} article${ici.length > 1 ? 's' : ''} · ${unites.toLocaleString('fr-FR')} unité${unites > 1 ? 's' : ''}${alertes ? ` · <span class="texte-danger">${alertes} en alerte</span>` : ''} · ${r.niveaux} niveau${r.niveaux > 1 ? 'x' : ''} × ${nbCases(r)} places · ${virgule(r.long)} × ${virgule(r.prof)} × ${virgule(r.haut)} m</span></div>
          <div class="actions-maj">
            <button type="button" class="btn btn-metal petit" id="sv-placer">+ Placer un produit ici</button>
            ${peutModifierPlan() ? '<button type="button" class="btn btn-ligne petit" id="sv-modifier">✎ Modifier ce meuble</button>' : ''}
            <button type="button" class="btn-icone" id="sv-fermer" title="Fermer (Échap)">✕</button></div></div>
        ${ici.length ? `<div class="stk-grille-produits">${[...ici].sort((x, y) => (Number(y.e.niveau) - Number(x.e.niveau)) || (Number(x.e.case) - Number(y.e.case))).map(carte).join('')}</div>` : '<p class="discret stk-vitrine-vide">Aucun article rangé ici pour l’instant.</p>'}
        ${vides.length && ici.length ? `<p class="discret stk-vitrine-vide" style="margin-top:12px">${r.type === 'portant' ? 'Barres' : 'Niveaux'} vides : ${vides.join(', ')}</p>` : ''}`;
      el.scrollTop = defil;
      el.addEventListener('click', (ev) => { if (ev.target === el) fermerVitrine(); });
      el.querySelector('#sv-fermer').addEventListener('click', fermerVitrine);
      el.querySelector('#sv-placer').addEventListener('click', () => placerIci(r));
      const mod = el.querySelector('#sv-modifier');
      if (mod) mod.addEventListener('click', () => { fermerVitrine(); entrerEdition(r.id); });
      el.querySelectorAll('[data-fiche]').forEach((x) => x.addEventListener('click', () => ouvrirFiche(prod(x.dataset.fiche))));
      el.querySelectorAll('[data-voir3d]').forEach((x) => x.addEventListener('click', () => { const id = x.dataset.voir3d; fermerVitrine(); selProduit = id; if (vue3d) vue3d.montrerProduit(id); dessinerPanneau(); }));
      el.querySelectorAll('[data-plus-e],[data-moins-e]').forEach((x) => x.addEventListener('click', () => ajusterRapide(prod(x.dataset.plusE || x.dataset.moinsE), x.dataset.plusE ? 1 : -1, Number(x.dataset.i))));
      if (vitrine.produit && !defil) { const c = el.querySelector(`[data-carte="${CSS.escape(vitrine.produit)}"]`); if (c) c.scrollIntoView({ block: 'center' }); }
    }

    function dessinerPanneau() {
      const pan = $('#stk-panneau');
      if (!pan) return;
      if (edition) return panneauEdition(pan);
      const liv = selLivraison && livraisons.find((l) => l.id === selLivraison);
      if (liv) return panneauLivraison(pan, liv);
      const r = rayon(selRayon);
      const surRoute = livraisons.filter((l) => ['expediee', 'en_route'].includes(l.statut));
      if (!r) {
        const q = recherche.trim().toLowerCase();
        const res = q ? produits.filter((p) => [p.nom, p.reference, p.marque, p.ean].join(' ').toLowerCase().includes(q)).slice(0, 30) : [];
        pan.innerHTML = `
          <h2>Trouver un produit</h2>
          <div class="ajout-rapide" style="margin-top:12px"><input id="stk-cherche" placeholder="Nom, référence, marque, code-barres…" value="${esc(recherche)}"></div>
          ${q ? (res.length ? res.map(ligneProduitPanneau).join('') : '<p class="vide">Aucun produit trouvé.</p>')
            : `<p class="discret" style="margin-bottom:12px">Ou cliquez sur un rayon dans la vue 3D pour voir ce qu’il contient.</p>
               <div class="stk-zone"><b>Sur la route (${surRoute.length})</b>
                 ${surRoute.length ? surRoute.map((l) => `<button type="button" class="stk-ligne" data-liv="${esc(l.id)}">
                   <span class="stk-sens ${l.sens === 'entrante' ? 'entrante' : 'sortante'} mini">${l.sens === 'entrante' ? '↓' : '↑'}</span>
                   <span class="stk-ligne-texte"><b>${esc(l.tiers || '—')}</b><span class="discret">${esc([l.transporteur, l.numero_commande].filter(Boolean).join(' · '))} · ${esc(STATUTS[l.statut])}, prévue ${dateFr(l.date_prevue)}</span></span></button>`).join('')
                   : '<span class="discret">Aucun camion en route.</span>'}</div>
               ${Object.entries(ZONES).map(([z, nom]) => { const rs = RAYONS.filter((x) => x.zone === z); const n = produits.filter((p) => (p.emplacements || []).some((e) => rs.some((x) => x.id === e.rayon))).length;
                 return `<div class="stk-zone"><b>${esc(nom)}</b><span class="discret">${rs.length} emplacement${rs.length > 1 ? 's' : ''} · ${n} produit${n > 1 ? 's' : ''}</span>
                   <div class="stk-puces">${rs.map((x) => `<button type="button" class="pastille" data-rayon="${x.id}" title="${esc(x.nom)}">${x.id}</button>`).join('')}</div></div>`; }).join('')}`}
          <button type="button" class="btn btn-metal" id="stk-nouveau" style="width:100%;margin-top:14px">+ Nouveau produit</button>`;
        const champ = pan.querySelector('#stk-cherche');
        champ.addEventListener('input', () => { recherche = champ.value; const pos = champ.selectionStart; dessinerPanneau(); const c = $('#stk-cherche'); c.focus(); c.setSelectionRange(pos, pos); });
      } else {
        const ici = produits.flatMap((p) => (p.emplacements || []).map((e, i) => ({ p, e, i }))).filter((x) => x.e.rayon === r.id);
        const niveaux = [];
        for (let k = r.niveaux; k >= 1; k--) niveaux.push(k);
        pan.innerHTML = `
          <div class="titre-carte" style="margin-bottom:8px"><div><span class="pastille">${esc(ZONES[r.zone])}</span><h2 style="margin-top:8px">${esc(r.id)} — ${esc(r.nom)}</h2>
            <span class="discret">${esc(typeRayon(r.type).nom)} · ${r.niveaux} niveau${r.niveaux > 1 ? 'x' : ''} · ${nbCases(r)} places par niveau · ${virgule(r.long)} × ${virgule(r.prof)} × ${virgule(r.haut)} m</span></div>
            <button type="button" class="btn-icone" id="stk-fermer-rayon" title="Fermer">✕</button></div>
          ${niveaux.map((k) => { const l = ici.filter((x) => Number(x.e.niveau) === k).sort((a, b) => a.e.case - b.e.case);
            return `<div class="stk-niveau"><div class="groupe-titre">Niveau ${k}${k === 1 && r.niveaux > 1 ? ' (bas)' : k === r.niveaux && r.niveaux > 1 ? ' (haut)' : ''}</div>
              ${l.length ? l.map((x) => ligneProduitPanneau(x.p, x.e)).join('') : '<div class="discret groupe-vide" style="padding-left:2px">Vide</div>'}</div>`; }).join('')}
          <button type="button" class="btn btn-ligne petit" id="stk-voir-vitrine" style="width:100%;margin-top:14px">▦ Voir les articles en grand (photos, infos)</button>
          <button type="button" class="btn btn-metal" id="stk-placer" style="width:100%;margin-top:8px">+ Placer un produit ici</button>
          ${peutModifierPlan() ? '<button type="button" class="btn btn-ligne petit" id="stk-modif-rayon" style="width:100%;margin-top:8px">✎ Modifier ce meuble (dimensions, place…)</button>' : ''}`;
        pan.querySelector('#stk-fermer-rayon').addEventListener('click', () => { fermerVitrine(); selRayon = null; selProduit = null; if (vue3d) { vue3d.selectionner(null); vue3d.montrerProduit(null); } dessinerPanneau(); });
        pan.querySelector('#stk-placer').addEventListener('click', () => placerIci(r));
        const vt = pan.querySelector('#stk-voir-vitrine');
        if (vt) vt.addEventListener('click', () => ouvrirVitrine(r.id));
        const mr = pan.querySelector('#stk-modif-rayon');
        if (mr) mr.addEventListener('click', () => entrerEdition(r.id));
      }
      pan.querySelectorAll('[data-rayon]').forEach((b) => b.addEventListener('click', () => { selRayon = b.dataset.rayon; selProduit = null; if (vue3d) { vue3d.selectionner(selRayon); vue3d.cadrer(selRayon); vue3d.montrerProduit(null); } dessinerPanneau(); ouvrirVitrine(selRayon); }));
      pan.querySelectorAll('[data-produit]').forEach((b) => b.addEventListener('click', () => {
        const p = prod(b.dataset.produit);
        if (!p) return;
        if (b.dataset.voir && (p.emplacements || []).length) {
          selProduit = p.id; selRayon = p.emplacements[0].rayon;
          if (vue3d) { vue3d.selectionner(selRayon); vue3d.montrerProduit(p.id); }
          dessinerPanneau();
        } else ouvrirFiche(p);
      }));
      pan.querySelectorAll('[data-liv]').forEach((b) => b.addEventListener('click', () => { selLivraison = b.dataset.liv; if (vue3d) vue3d.suivreCamion(selLivraison); dessinerPanneau(); }));
      const nv = pan.querySelector('#stk-nouveau');
      if (nv) nv.addEventListener('click', () => ouvrirFiche(null));
    }

    // Panneau d'une livraison (clic sur un camion, ou dans la liste « Sur la route »)
    function panneauLivraison(pan, l) {
      const entrante = l.sens === 'entrante';
      const lien = lienSuivi(l);
      const retard = l.statut !== 'livree' && l.date_prevue && l.date_prevue < jourISO(0);
      pan.innerHTML = `
        <div class="titre-carte" style="margin-bottom:8px"><div><span class="pastille">${entrante ? '↓ Fournisseur → FMD' : '↑ FMD → client'}</span>
          <h2 style="margin-top:8px">${esc(l.tiers || '—')}</h2><span class="discret">${esc(l.numero_commande || '')}</span></div>
          <button type="button" class="btn-icone" id="stk-fermer-liv" title="Fermer">✕</button></div>
        <div class="stk-route" style="margin:6px 0 14px">${ETAPES.map(([k, t], i) => { const idx = ETAPES.findIndex((e) => e[0] === l.statut); return `<span class="${i <= idx ? 'fait' : ''} ${i === idx ? 'ici' : ''}">${t}</span>`; }).join('')}</div>
        <div class="apropos-ligne"><b>Transporteur</b><span class="discret">${esc(l.transporteur || '—')}${l.numero_suivi ? ' · n° ' + esc(l.numero_suivi) : ''}</span>
          ${lien ? `<a href="${esc(lien)}" target="_blank" rel="noopener" class="stk-lien">Suivre le colis ↗</a>` : ''}</div>
        <div class="apropos-ligne"><b>${l.statut === 'livree' ? 'Livrée le' : 'Arrivée prévue'}</b><span class="${retard ? 'texte-danger' : 'discret'}">${l.statut === 'livree' ? dateFr(l.date_livree) : dateFr(l.date_prevue)}${retard ? ' · en retard' : ''}</span></div>
        <div class="apropos-ligne"><b>Articles</b>${(l.lignes || []).map((x) => `<span class="discret">${Number(x.qte) || 0} × ${esc(x.nom || (prod(x.produit) || {}).nom || 'article')}</span>`).join('') || '<span class="discret">Aucun</span>'}</div>
        ${l.notes ? `<div class="apropos-ligne"><b>Notes</b><span class="discret">${esc(l.notes)}</span></div>` : ''}
        <div class="actions-maj" style="margin-top:16px">
          ${l.statut !== 'livree' ? `<button type="button" class="btn btn-metal petit" id="stk-liv-fin">${entrante ? 'Réceptionner' : 'Marquer livrée'}</button>` : ''}
          <button type="button" class="btn btn-ligne petit" id="stk-liv-ouvrir">Ouvrir la fiche</button></div>`;
      pan.querySelector('#stk-fermer-liv').addEventListener('click', () => { selLivraison = null; dessinerPanneau(); });
      pan.querySelector('#stk-liv-ouvrir').addEventListener('click', () => ficheLivraison(l));
      const fin = pan.querySelector('#stk-liv-fin');
      if (fin) fin.addEventListener('click', async () => { await changerStatut(l, 'livree'); });
    }

    function ligneProduitPanneau(p, e) {
      const etat = etatStock(p);
      const qte = e ? Number(e.qte) || 0 : total(p);
      return `<button type="button" class="stk-ligne ${selProduit === p.id ? 'actif' : ''}" data-produit="${esc(p.id)}" ${e ? '' : 'data-voir="1"'}>
        <i style="background:${cat(p.categorie)[2]}"></i>
        <span class="stk-ligne-texte"><b>${esc(p.nom)}</b><span class="discret">${esc([p.marque, p.reference].filter(Boolean).join(' · '))}${e ? ` · case ${esc(e.case)}` : (p.emplacements || []).length ? ' · ' + esc(p.emplacements.map((x) => x.rayon).join(', ')) : ' · non placé'}</span></span>
        <span class="stk-qte ${etat}">${qte}</span></button>`;
    }

    function placerIci(r) {
      const choixProduit = produits.map((p) => `<option value="${esc(p.id)}">${esc(p.nom)}${p.reference ? ' — ' + esc(p.reference) : ''}</option>`).join('');
      fenetre.innerHTML = `<div class="boite boite-fiche"><h2 id="fenetre-titre">Placer un produit en ${esc(r.id)}</h2>
        <p class="discret" style="margin:4px 0 18px">${esc(r.nom)}</p>
        <div class="champ"><label>Produit</label><select id="pl-produit"><option value="">— Nouveau produit —</option>${choixProduit}</select></div>
        <div class="tache-quand"><div class="champ"><label>Niveau</label><select id="pl-niveau">${optionsNiveaux(r, 1)}</select></div>
          <div class="champ"><label>Case</label><select id="pl-case">${optionsCases(r, 1)}</select></div>
          <div class="champ"><label>Quantité</label><input id="pl-qte" type="number" min="0" value="1"></div></div>
        <div class="actions-maj" style="justify-content:flex-end"><button type="button" class="btn btn-ligne" id="pl-annuler">Annuler</button><button type="button" class="btn btn-metal" id="pl-ok">Placer</button></div></div>`;
      fenetre.hidden = false;
      const f = (s) => fenetre.querySelector(s);
      f('#pl-annuler').addEventListener('click', fermerFenetre);
      f('#pl-ok').addEventListener('click', async () => {
        const e = { rayon: r.id, niveau: Number(f('#pl-niveau').value), case: Number(f('#pl-case').value), qte: Math.max(0, Number(f('#pl-qte').value) || 0) };
        const p = prod(f('#pl-produit').value);
        if (!p) { fermerFenetre(); ouvrirFiche({ nom: '', categorie: 'fixation', unite: 'pièce', emplacements: [e] }); return; }
        const emplacements = [...(p.emplacements || []), e];
        try {
          await donnees.modifier('stock_produits', p.id, { emplacements });
          await mouvement(p, 'entree', e.qte, libEmpl(e), 'Placé en rayon');
        } catch (err) { return notifier('Enregistrement refusé : ' + (err.message || err)); }
        fermerFenetre();
        notifier(`${p.nom} placé en ${libEmpl(e)}.`);
        await relire();
      });
    }

    // ---------- Onglet Produits ----------
    function dessinerProduits() {
      const corps = $('#stk-corps');
      const q = recherche.trim().toLowerCase();
      const liste = produits.filter((p) => (!q || [p.nom, p.reference, p.marque, p.ean, p.fournisseur, p.numeros_suivi].join(' ').toLowerCase().includes(q))
        && (!filtreCat || p.categorie === filtreCat) && (!filtreAlerte || etatStock(p) !== 'ok'));
      corps.innerHTML = `
        <div class="contenu-page" style="max-width:none">
          <div class="taches-outils">
            <div class="ajout-rapide" style="margin:0;flex:1;min-width:260px"><input id="stk-cherche" placeholder="Rechercher : nom, référence, marque, code-barres, n° de lot…" value="${esc(recherche)}"></div>
            <select id="stk-cat" class="stk-select"><option value="">Toutes les catégories</option>${CATEGORIES.map(([k, n]) => `<option value="${k}" ${filtreCat === k ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>
            <label class="case" style="margin:0"><input type="checkbox" id="stk-alerte" ${filtreAlerte ? 'checked' : ''}> Stock bas seulement</label>
            <button type="button" class="btn btn-metal" id="stk-nouveau">+ Nouveau produit</button>
          </div>
          <section class="carte" style="padding:8px 8px 4px"><div class="tableau-defile"><table class="registre stk-table">
            <thead><tr><th>Produit</th><th>Catégorie</th><th>Emplacement(s)</th><th style="text-align:right">Stock</th><th>Seuil</th><th>Suivi</th><th></th></tr></thead>
            <tbody>${liste.length ? liste.map((p) => { const etat = etatStock(p); return `
              <tr data-ligne="${esc(p.id)}" class="cliquable">
                <td><b>${esc(p.nom)}</b><div class="discret">${esc([p.marque, p.reference, p.ean].filter(Boolean).join(' · '))}</div></td>
                <td><span class="stk-cat"><i style="background:${cat(p.categorie)[2]}"></i>${esc(cat(p.categorie)[1])}</span></td>
                <td>${(p.emplacements || []).length ? p.emplacements.map((e) => `<button type="button" class="pastille stk-empl" data-voir="${esc(p.id)}" title="Voir sur le plan 3D">${esc(libEmpl(e))} · ${Number(e.qte) || 0}</button>`).join(' ') : '<span class="discret">Non placé</span>'}</td>
                <td style="text-align:right"><span class="stk-qte ${etat}">${total(p)}</span> <span class="discret">${esc(p.unite || '')}</span></td>
                <td class="discret">${p.seuil_alerte || '—'}</td>
                <td class="discret">${esc(p.numeros_suivi || '—')}</td>
                <td style="white-space:nowrap"><button type="button" class="btn btn-ligne petit" data-moins="${esc(p.id)}" title="Retirer 1 (vente, casse…)">−1</button> <button type="button" class="btn btn-ligne petit" data-plus="${esc(p.id)}" title="Ajouter 1">+1</button></td>
              </tr>`; }).join('') : '<tr><td colspan="7"><p class="vide">Aucun produit.</p></td></tr>'}</tbody></table></div></section>
        </div>`;
      const champ = $('#stk-cherche');
      champ.addEventListener('input', () => { recherche = champ.value; const pos = champ.selectionStart; dessinerProduits(); const c = $('#stk-cherche'); c.focus(); c.setSelectionRange(pos, pos); });
      $('#stk-cat').addEventListener('change', (ev) => { filtreCat = ev.target.value; dessinerProduits(); });
      $('#stk-alerte').addEventListener('change', (ev) => { filtreAlerte = ev.target.checked; dessinerProduits(); });
      $('#stk-nouveau').addEventListener('click', () => ouvrirFiche(null));
      corps.querySelectorAll('[data-ligne]').forEach((tr) => tr.addEventListener('click', (ev) => { if (ev.target.closest('button')) return; ouvrirFiche(prod(tr.dataset.ligne)); }));
      corps.querySelectorAll('[data-voir]').forEach((b) => b.addEventListener('click', () => voirSurPlan(b.dataset.voir)));
      corps.querySelectorAll('[data-plus],[data-moins]').forEach((b) => b.addEventListener('click', () => ajusterRapide(prod(b.dataset.plus || b.dataset.moins), b.dataset.plus ? 1 : -1)));
    }

    function voirSurPlan(id) {
      const p = prod(id);
      if (!p || !(p.emplacements || []).length) return;
      selProduit = p.id; selRayon = p.emplacements[0].rayon; recherche = '';
      onglet = 'magasin'; ecrire('fmd-stock-onglet', onglet);
      dessiner();
    }

    async function ajusterRapide(p, sens, index = null) {
      if (!p) return;
      const emplacements = (p.emplacements || []).map((e) => ({ ...e }));
      let e = sens > 0 ? emplacements[0] : emplacements.find((x) => (Number(x.qte) || 0) > 0);
      if (index != null) e = emplacements[index];
      if (e && sens < 0 && (Number(e.qte) || 0) <= 0) return notifier('Plus de stock à cet endroit.');
      if (!e) return notifier(sens > 0 ? 'Placez d’abord le produit dans un rayon (fiche produit).' : 'Plus de stock pour ce produit.');
      e.qte = (Number(e.qte) || 0) + sens;
      try {
        await donnees.modifier('stock_produits', p.id, { emplacements });
        await mouvement(p, sens > 0 ? 'entree' : 'sortie', sens, libEmpl(e), sens > 0 ? 'Ajout rapide' : 'Retrait rapide (vente, casse…)');
      } catch (err) { return notifier('Enregistrement refusé : ' + (err.message || err)); }
      await relire();
    }

    // ---------- Fiche produit ----------
    const optionsRayons = (sel) => Object.entries(ZONES).map(([z, nom]) => `<optgroup label="${esc(nom)}">${RAYONS.filter((r) => r.zone === z).map((r) => `<option value="${r.id}" ${sel === r.id ? 'selected' : ''}>${r.id} — ${esc(r.nom)}</option>`).join('')}</optgroup>`).join('');
    const optionsNiveaux = (r, sel) => Array.from({ length: r.niveaux }, (_, i) => i + 1).map((k) => `<option value="${k}" ${Number(sel) === k ? 'selected' : ''}>${k}${k === 1 && r.niveaux > 1 ? ' (bas)' : k === r.niveaux && r.niveaux > 1 ? ' (haut)' : ''}</option>`).join('');
    const optionsCases = (r, sel) => Array.from({ length: nbCases(r) }, (_, i) => i + 1).map((k) => `<option value="${k}" ${Number(sel) === k ? 'selected' : ''}>${k}</option>`).join('');

    function ouvrirFiche(p) {
      const nouveau = !p || !p.id;
      const b = JSON.parse(JSON.stringify(p || { nom: '', categorie: 'fixation', unite: 'pièce', emplacements: [] }));
      b.emplacements = b.emplacements || [];
      const v = (k) => esc(b[k] ?? '');
      fenetre.innerHTML = `<div class="boite boite-fiche stk-fiche"><h2 id="fenetre-titre">${nouveau ? 'Nouveau produit' : esc(b.nom)}</h2>
        <p class="discret" style="margin:4px 0 18px">${nouveau ? 'Fiche produit : informations, numéros de suivi et emplacements dans le magasin.' : `Stock total : <b>${total(b)}</b> ${esc(b.unite || '')}`}</p>
        <div class="stk-photo-zone">
          <div class="stk-photo" id="fp-photo"></div>
          <div><b style="font-size:13px">Photo du produit</b>
            <p class="discret" style="font-size:12px;margin:4px 0 10px">Collez le lien de l’image (https://…), ou chargez une image de l’ordinateur (ou Ctrl + V ici). Elle est réduite automatiquement.</p>
            <input type="url" id="fp-photo-url" placeholder="Lien de l’image : https://…" style="width:100%;margin-bottom:8px" value="${esc(/^https:/i.test(b.image || '') ? b.image : '')}">
            <div class="actions-maj"><button type="button" class="btn btn-ligne petit" id="fp-photo-choisir">Charger une image</button>
              <button type="button" class="btn btn-ligne petit" id="fp-photo-modifier">✎ Modifier</button>
              <button type="button" class="btn btn-ligne petit" id="fp-photo-retirer">Retirer</button></div>
            <input type="file" accept="image/png,image/jpeg,image/webp" id="fp-photo-fichier" hidden></div></div>
        <div class="champ"><label>Nom du produit *</label><input data-c="nom" value="${v('nom')}" maxlength="200"></div>
        <div class="deux-champs">
          <div class="champ"><label>Référence</label><input data-c="reference" value="${v('reference')}"></div>
          <div class="champ"><label>Marque</label><input data-c="marque" value="${v('marque')}"></div>
          <div class="champ"><label>Catégorie</label><select data-c="categorie">${CATEGORIES.map(([k, n]) => `<option value="${k}" ${b.categorie === k ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></div>
          <div class="champ"><label>Code-barres (EAN)</label><input data-c="ean" value="${v('ean')}"></div>
          <div class="champ"><label>Fournisseur</label><input data-c="fournisseur" value="${v('fournisseur')}"></div>
          <div class="champ"><label>Unité</label><input data-c="unite" value="${v('unite')}" placeholder="pièce, boîte, rouleau…"></div>
          <div class="champ"><label>Prix d’achat HT (€)</label><input data-c="prix_achat" type="number" step="0.01" min="0" value="${v('prix_achat')}"></div>
          <div class="champ"><label>Prix de vente HT (€)</label><input data-c="prix_vente" type="number" step="0.01" min="0" value="${v('prix_vente')}"></div>
          <div class="champ"><label>Seuil d’alerte (stock bas)</label><input data-c="seuil_alerte" type="number" min="0" value="${v('seuil_alerte')}"></div>
        </div>
        <div class="champ"><label>Numéros de suivi (lots, séries, n° de commande…)</label><textarea data-c="numeros_suivi" rows="2">${v('numeros_suivi')}</textarea></div>
        <div class="champ"><label>Notes</label><textarea data-c="notes" rows="2">${v('notes')}</textarea></div>
        <div class="groupe-titre" style="margin-top:6px">Emplacements dans le magasin</div>
        <div id="fp-empl"></div>
        <button type="button" class="btn btn-ligne petit" id="fp-ajout-empl">+ Ajouter un emplacement</button>
        <p class="message erreur" id="fp-erreur" hidden style="margin-top:14px"></p>
        <div class="actions-maj" style="justify-content:space-between;margin-top:18px">
          <span>${!nouveau && peutSupprimer() ? '<button type="button" class="btn btn-ligne" id="fp-suppr">Supprimer</button>' : ''}</span>
          <span class="actions-maj"><button type="button" class="btn btn-ligne" id="fp-annuler">Annuler</button><button type="button" class="btn btn-metal" id="fp-ok">Enregistrer</button></span></div></div>`;
      fenetre.hidden = false;
      const f = (s) => fenetre.querySelector(s);
      const lireChamps = () => fenetre.querySelectorAll('[data-c]').forEach((c) => { b[c.dataset.c] = c.value; });
      const majPhoto = () => { lireChamps(); f('#fp-photo').innerHTML = vignette(b); f('#fp-photo-retirer').hidden = !photoValide(b.image); f('#fp-photo-modifier').hidden = !photoValide(b.image) || !window.FMDRetouche; };
      const prendrePhoto = async (fichier) => { try { b.image = await reduirePhoto(fichier); majPhoto(); } catch (e) { notifier(e.message || String(e)); } };
      majPhoto();
      f('#fp-photo-choisir').addEventListener('click', () => f('#fp-photo-fichier').click());
      f('#fp-photo').addEventListener('click', () => { if (!f('#fp-photo-modifier').hidden) f('#fp-photo-modifier').click(); });
      f('#fp-photo-modifier').addEventListener('click', async () => { if (!window.FMDRetouche || !photoValide(b.image)) return; const p = await window.FMDRetouche.ouvrir(b.image, { titre: 'Photo du produit' }); if (p) { b.image = p; f('#fp-photo-url').value = ''; majPhoto(); } });
      f('#fp-photo-fichier').addEventListener('change', (ev) => { if (ev.target.files[0]) prendrePhoto(ev.target.files[0]); });
      f('#fp-photo-retirer').addEventListener('click', () => { b.image = null; f('#fp-photo-url').value = ''; majPhoto(); });
      f('#fp-photo-url').addEventListener('change', (ev) => { const u = ev.target.value.trim(); if (!u) return; if (!photoValide(u)) { notifier('Le lien doit commencer par https://'); return; } b.image = u; majPhoto(); });
      f('.stk-fiche').addEventListener('paste', (ev) => {
        const it = [...(ev.clipboardData ? ev.clipboardData.items : [])].find((x) => x.kind === 'file' && /^image\//.test(x.type));
        if (it) { ev.preventDefault(); prendrePhoto(it.getAsFile()); }
      });
      function dessinerEmpl() {
        f('#fp-empl').innerHTML = b.emplacements.length ? b.emplacements.map((e, i) => { const r = rayon(e.rayon) || RAYONS[0]; return `
          <div class="stk-empl-ligne" data-i="${i}">
            <select data-e="rayon">${optionsRayons(r.id)}</select>
            <select data-e="niveau" title="Niveau (1 = bas)">${optionsNiveaux(r, e.niveau)}</select>
            <select data-e="case" title="Case (de gauche à droite)">${optionsCases(r, e.case)}</select>
            <input data-e="qte" type="number" min="0" value="${Number(e.qte) || 0}" title="Quantité à cet endroit">
            <button type="button" class="btn btn-ligne petit" data-plan="${i}" title="Choisir en cliquant sur le plan 3D">Sur le plan</button>
            <button type="button" class="btn-icone" data-retirer="${i}" title="Retirer cet emplacement">✕</button>
          </div>`; }).join('') : '<p class="discret" style="margin-bottom:10px">Pas encore placé dans le magasin.</p>';
        fenetre.querySelectorAll('.stk-empl-ligne').forEach((ligne) => {
          const i = Number(ligne.dataset.i);
          ligne.querySelectorAll('[data-e]').forEach((c) => c.addEventListener('change', () => {
            const e = b.emplacements[i];
            if (c.dataset.e === 'rayon') { e.rayon = c.value; const r = rayon(c.value); e.niveau = Math.min(Number(e.niveau) || 1, r.niveaux); e.case = Math.min(Number(e.case) || 1, nbCases(r)); dessinerEmpl(); }
            else e[c.dataset.e] = Math.max(0, Number(c.value) || 0);
          }));
        });
        fenetre.querySelectorAll('[data-retirer]').forEach((x) => x.addEventListener('click', () => { b.emplacements.splice(Number(x.dataset.retirer), 1); dessinerEmpl(); }));
        fenetre.querySelectorAll('[data-plan]').forEach((x) => x.addEventListener('click', () => {
          lireChamps();
          choix = { brouillon: b, index: Number(x.dataset.plan) };
          fermerFenetre();
          onglet = 'magasin'; ecrire('fmd-stock-onglet', onglet);
          dessiner();
        }));
      }
      dessinerEmpl();
      f('#fp-ajout-empl').addEventListener('click', () => { b.emplacements.push({ rayon: selRayon || 'C2', niveau: 1, case: 1, qte: 0 }); dessinerEmpl(); });
      f('#fp-annuler').addEventListener('click', fermerFenetre);
      const suppr = f('#fp-suppr');
      if (suppr) suppr.addEventListener('click', async () => {
        if (!window.confirm(`Supprimer définitivement la fiche « ${b.nom} » ? (L’historique des mouvements est gardé.)`)) return;
        try { await donnees.supprimer('stock_produits', b.id); } catch (e) { return notifier('Suppression refusée : ' + (e.message || e)); }
        fermerFenetre(); selProduit = null; notifier('Produit supprimé.'); await relire();
      });
      f('#fp-ok').addEventListener('click', async () => {
        lireChamps();
        const err = f('#fp-erreur');
        if (!String(b.nom || '').trim()) { err.textContent = 'Le nom du produit est obligatoire.'; err.hidden = false; return; }
        const ligne = {
          nom: b.nom.trim(), reference: b.reference || null, marque: b.marque || null, categorie: b.categorie, ean: b.ean || null,
          fournisseur: b.fournisseur || null, unite: b.unite || null, prix_achat: nombre(b.prix_achat), prix_vente: nombre(b.prix_vente),
          seuil_alerte: nombre(b.seuil_alerte) || 0, numeros_suivi: b.numeros_suivi || null, notes: b.notes || null, image: photoValide(b.image),
          emplacements: b.emplacements.map((e) => ({ rayon: e.rayon, niveau: Number(e.niveau) || 1, case: Number(e.case) || 1, qte: Number(e.qte) || 0 })),
        };
        const avant = nouveau ? 0 : total(prod(b.id) || { emplacements: [] });
        const apres = total(ligne);
        f('#fp-ok').disabled = true;
        try {
          const enr = nouveau ? await donnees.ajouter('stock_produits', ligne) : await donnees.modifier('stock_produits', b.id, ligne);
          if (apres !== avant) await mouvement(enr, nouveau ? 'entree' : 'ajustement', apres - avant, ligne.emplacements[0] ? libEmpl(ligne.emplacements[0]) : null, nouveau ? 'Création de la fiche' : 'Modification de la fiche (inventaire)');
          fermerFenetre();
          notifier(nouveau ? 'Produit ajouté.' : 'Fiche enregistrée.');
          if (onglet === 'magasin' && ligne.emplacements[0]) { selProduit = enr.id; selRayon = ligne.emplacements[0].rayon; }
          await relire();
        } catch (e) { err.textContent = 'Enregistrement refusé : ' + (e.message || e); err.hidden = false; f('#fp-ok').disabled = false; }
      });
    }

    function fermerFenetre() { fenetre.hidden = true; fenetre.innerHTML = ''; }

    // ---------- Onglet Livraisons ----------
    function dessinerLivraisons() {
      const corps = $('#stk-corps');
      const filtre = (l) => !filtreSens || l.sens === filtreSens;
      const route = livraisons.filter((l) => filtre(l) && ['expediee', 'en_route', 'incident'].includes(l.statut));
      const prep = livraisons.filter((l) => filtre(l) && l.statut === 'preparation');
      const finies = livraisons.filter((l) => filtre(l) && l.statut === 'livree' && (!l.date_livree || Date.now() - new Date(l.date_livree) < 30 * 864e5));
      const tri = (a, b) => String(a.date_prevue || '9').localeCompare(String(b.date_prevue || '9'));
      corps.innerHTML = `
        <div class="contenu-page" style="max-width:1100px">
          <div class="taches-outils">
            <div class="onglets onglets-param" style="margin:0">
              ${[['', 'Toutes'], ['entrante', '↓ À recevoir (fournisseurs)'], ['sortante', '↑ À livrer (clients)']].map(([k, t]) => `<button type="button" data-sens="${k}" class="${filtreSens === k ? 'actif' : ''}">${t}</button>`).join('')}
            </div>
            <button type="button" class="btn btn-metal" id="stk-nouvelle">+ Nouvelle livraison</button>
          </div>
          <div><div class="groupe-titre">Sur la route (${route.length})</div>${route.length ? route.sort(tri).map(carteLivraison).join('') : '<p class="vide">Aucune livraison en route.</p>'}</div>
          <div><div class="groupe-titre">En préparation (${prep.length})</div>${prep.length ? prep.sort(tri).map(carteLivraison).join('') : '<p class="discret">Aucune.</p>'}</div>
          <div class="groupe-taches faites"><div class="groupe-titre">Livrées — 30 derniers jours (${finies.length})</div>${finies.map(carteLivraison).join('') || '<p class="discret">Aucune.</p>'}</div>
        </div>`;
      corps.querySelectorAll('[data-sens]').forEach((b) => b.addEventListener('click', () => { filtreSens = b.dataset.sens; dessinerLivraisons(); }));
      $('#stk-nouvelle').addEventListener('click', () => ficheLivraison(null));
      corps.querySelectorAll('[data-livraison]').forEach((b) => b.addEventListener('click', () => ficheLivraison(livraisons.find((l) => l.id === b.dataset.livraison))));
      corps.querySelectorAll('[data-statut]').forEach((s) => s.addEventListener('change', () => changerStatut(livraisons.find((l) => l.id === s.dataset.statut), s.value)));
      corps.querySelectorAll('[data-terminer]').forEach((b) => b.addEventListener('click', () => changerStatut(livraisons.find((l) => l.id === b.dataset.terminer), 'livree')));
    }

    function carteLivraison(l) {
      const entrante = l.sens === 'entrante';
      const idx = ETAPES.findIndex((e) => e[0] === l.statut);
      const retard = l.statut !== 'livree' && l.date_prevue && l.date_prevue < jourISO(0);
      const lien = lienSuivi(l);
      const lignes = l.lignes || [];
      return `<div class="carte stk-livraison ${l.statut}">
        <div class="stk-liv-tete">
          <span class="stk-sens ${entrante ? 'entrante' : 'sortante'}" title="${entrante ? 'Fournisseur → FMD' : 'FMD → client'}">${entrante ? '↓' : '↑'}</span>
          <div style="flex:1;min-width:0"><b>${esc(l.tiers || '—')}</b> <span class="discret">${esc(l.numero_commande || '')}</span>
            <div class="discret">${esc(l.transporteur || 'Transporteur ?')}${l.numero_suivi ? ' · n° de suivi ' + esc(l.numero_suivi) : ''}${lien ? ` · <a href="${esc(lien)}" target="_blank" rel="noopener">Suivre le colis ↗</a>` : ''}</div></div>
          <div style="text-align:right"><div class="${retard ? 'texte-danger' : ''}">${l.statut === 'livree' ? 'Livrée le ' + dateFr(l.date_livree) : 'Prévue ' + dateFr(l.date_prevue)}${retard ? ' · en retard' : ''}</div>
            <select class="stk-select petit" data-statut="${esc(l.id)}">${Object.entries(STATUTS).map(([k, t]) => `<option value="${k}" ${l.statut === k ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
        </div>
        <div class="stk-route">${ETAPES.map(([k, t], i) => `<span class="${i <= idx ? 'fait' : ''} ${i === idx ? 'ici' : ''}">${t}</span>`).join('')}</div>
        <div class="stk-liv-pied"><span class="discret">${lignes.length ? lignes.map((x) => `${Number(x.qte) || 0} × ${esc(x.nom || (prod(x.produit) || {}).nom || 'article')}`).join(' · ') : 'Aucun article'}</span>
          <span class="actions-maj">${l.statut !== 'livree' ? `<button type="button" class="btn btn-metal petit" data-terminer="${esc(l.id)}">${entrante ? 'Réceptionner' : 'Marquer livrée'}</button>` : ''}
          <button type="button" class="btn btn-ligne petit" data-livraison="${esc(l.id)}">Ouvrir</button></span></div>
      </div>`;
    }

    // Livrée : réception = ajout au stock (fournisseur), livraison client = retrait du stock. Une seule fois (stock_applique).
    async function changerStatut(l, statut) {
      if (!l || l.statut === statut) return;
      const champs = { statut };
      if (statut === 'livree') {
        champs.date_livree = new Date().toISOString();
        const lignes = (l.lignes || []).filter((x) => prod(x.produit) && Number(x.qte));
        if (!l.stock_applique && lignes.length) {
          const entrante = l.sens === 'entrante';
          const texte = lignes.map((x) => `${entrante ? '+' : '−'}${x.qte} × ${prod(x.produit).nom}`).join('\n');
          if (!window.confirm(`${entrante ? 'Réception' : 'Livraison client'} ${l.numero_commande || ''} : mettre le stock à jour ?\n\n${texte}`)) { dessiner(); return; }
          try {
            for (const x of lignes) {
              const p = prod(x.produit);
              const emplacements = (p.emplacements || []).map((e) => ({ ...e }));
              let reste = Number(x.qte);
              if (entrante) {
                if (!emplacements.length) emplacements.push({ rayon: 'P1', niveau: 1, case: 1, qte: 0 });
                emplacements[0].qte = (Number(emplacements[0].qte) || 0) + reste;
              } else {
                for (const e of emplacements) { const pris = Math.min(reste, Number(e.qte) || 0); e.qte = (Number(e.qte) || 0) - pris; reste -= pris; if (!reste) break; }
              }
              await donnees.modifier('stock_produits', p.id, { emplacements });
              await mouvement(p, entrante ? 'entree' : 'sortie', entrante ? Number(x.qte) : -(Number(x.qte) - reste), libEmpl(emplacements[0]), `${entrante ? 'Réception' : 'Livraison client'} ${l.numero_commande || ''} — ${l.tiers || ''}`.trim());
              if (reste > 0) notifier(`Attention : il manquait ${reste} × ${p.nom} en stock.`);
            }
            champs.stock_applique = true;
          } catch (e) { notifier('Mise à jour du stock refusée : ' + (e.message || e)); return relire(); }
        }
      }
      try { await donnees.modifier('stock_livraisons', l.id, champs); } catch (e) { notifier('Enregistrement refusé : ' + (e.message || e)); }
      notifier(`Livraison ${l.numero_commande || ''} : ${STATUTS[statut]}.`);
      await relire();
    }

    function ficheLivraison(l) {
      const nouveau = !l;
      const b = JSON.parse(JSON.stringify(l || { sens: 'entrante', statut: 'preparation', transporteur: 'Colissimo', date_prevue: jourISO(2), lignes: [] }));
      const v = (k) => esc(b[k] ?? '');
      const optProduits = (sel) => `<option value="">— Article hors catalogue —</option>${produits.map((p) => `<option value="${esc(p.id)}" ${sel === p.id ? 'selected' : ''}>${esc(p.nom)}</option>`).join('')}`;
      fenetre.innerHTML = `<div class="boite boite-fiche stk-fiche"><h2 id="fenetre-titre">${nouveau ? 'Nouvelle livraison' : 'Livraison ' + v('numero_commande')}</h2>
        <p class="discret" style="margin:4px 0 18px">Commande fournisseur à recevoir, ou commande client à livrer.</p>
        <div class="deux-champs">
          <div class="champ"><label>Sens</label><select data-c="sens"><option value="entrante" ${b.sens === 'entrante' ? 'selected' : ''}>↓ Fournisseur → FMD</option><option value="sortante" ${b.sens === 'sortante' ? 'selected' : ''}>↑ FMD → client</option></select></div>
          <div class="champ"><label>Fournisseur / client *</label><input data-c="tiers" value="${v('tiers')}"></div>
          <div class="champ"><label>N° de commande / BL</label><input data-c="numero_commande" value="${v('numero_commande')}"></div>
          <div class="champ"><label>Statut</label><select data-c="statut" ${b.statut === 'livree' ? 'disabled' : ''}>${Object.entries(STATUTS).map(([k, t]) => `<option value="${k}" ${b.statut === k ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
          <div class="champ"><label>Transporteur</label><select data-c="transporteur">${TRANSPORTEURS.map(([t]) => `<option ${b.transporteur === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></div>
          <div class="champ"><label>N° de suivi</label><input data-c="numero_suivi" value="${v('numero_suivi')}"></div>
          <div class="champ"><label>Date prévue</label><input data-c="date_prevue" type="date" value="${v('date_prevue')}"></div>
          <div class="champ"><label>Adresse (livraison client)</label><input data-c="adresse" value="${v('adresse')}"></div>
        </div>
        <div class="groupe-titre">Articles</div>
        <div id="fl-lignes"></div>
        <button type="button" class="btn btn-ligne petit" id="fl-ajout">+ Ajouter un article</button>
        <div class="champ" style="margin-top:14px"><label>Notes</label><textarea data-c="notes" rows="2">${v('notes')}</textarea></div>
        <p class="message erreur" id="fl-erreur" hidden></p>
        <div class="actions-maj" style="justify-content:space-between;margin-top:18px">
          <span>${!nouveau && peutSupprimer() ? '<button type="button" class="btn btn-ligne" id="fl-suppr">Supprimer</button>' : ''}</span>
          <span class="actions-maj"><button type="button" class="btn btn-ligne" id="fl-annuler">Annuler</button><button type="button" class="btn btn-metal" id="fl-ok">Enregistrer</button></span></div></div>`;
      fenetre.hidden = false;
      const f = (s) => fenetre.querySelector(s);
      function dessinerLignes() {
        f('#fl-lignes').innerHTML = b.lignes.map((x, i) => `<div class="stk-empl-ligne stk-art" data-i="${i}">
          <select data-l="produit">${optProduits(x.produit)}</select>
          <input data-l="nom" value="${esc(x.produit ? '' : x.nom || '')}" placeholder="Désignation" ${x.produit ? 'hidden' : ''}>
          <input data-l="qte" type="number" min="1" value="${Number(x.qte) || 1}">
          <button type="button" class="btn-icone" data-retirer="${i}">✕</button></div>`).join('') || '<p class="discret" style="margin-bottom:10px">Aucun article.</p>';
        fenetre.querySelectorAll('.stk-art').forEach((ligne) => ligne.querySelectorAll('[data-l]').forEach((c) => c.addEventListener('change', () => {
          const x = b.lignes[Number(ligne.dataset.i)];
          if (c.dataset.l === 'produit') { x.produit = c.value || null; x.nom = c.value ? prod(c.value).nom : ''; dessinerLignes(); }
          else x[c.dataset.l] = c.dataset.l === 'qte' ? Math.max(1, Number(c.value) || 1) : c.value;
        })));
        fenetre.querySelectorAll('[data-retirer]').forEach((x) => x.addEventListener('click', () => { b.lignes.splice(Number(x.dataset.retirer), 1); dessinerLignes(); }));
      }
      dessinerLignes();
      f('#fl-ajout').addEventListener('click', () => { b.lignes.push({ produit: null, nom: '', qte: 1 }); dessinerLignes(); });
      f('#fl-annuler').addEventListener('click', fermerFenetre);
      const suppr = f('#fl-suppr');
      if (suppr) suppr.addEventListener('click', async () => {
        if (!window.confirm('Supprimer cette livraison ? (Le stock déjà mis à jour n’est pas modifié.)')) return;
        try { await donnees.supprimer('stock_livraisons', b.id); } catch (e) { return notifier('Suppression refusée : ' + (e.message || e)); }
        fermerFenetre(); await relire();
      });
      f('#fl-ok').addEventListener('click', async () => {
        fenetre.querySelectorAll('[data-c]').forEach((c) => { if (!c.disabled) b[c.dataset.c] = c.value; });
        const err = f('#fl-erreur');
        if (!String(b.tiers || '').trim()) { err.textContent = 'Indiquez le fournisseur ou le client.'; err.hidden = false; return; }
        const statutVoulu = b.statut;
        const ligne = { sens: b.sens, tiers: b.tiers.trim(), numero_commande: b.numero_commande || null, transporteur: b.transporteur || null,
          numero_suivi: b.numero_suivi || null, date_prevue: b.date_prevue || null, adresse: b.adresse || null, notes: b.notes || null,
          lignes: b.lignes.filter((x) => x.produit || String(x.nom || '').trim()).map((x) => ({ produit: x.produit || null, nom: x.produit ? prod(x.produit).nom : x.nom, qte: Number(x.qte) || 1 })) };
        // « Livrée » passe par changerStatut (mise à jour du stock) : on enregistre d'abord le reste.
        if (statutVoulu !== 'livree' || (l && l.statut === 'livree')) ligne.statut = statutVoulu;
        else if (nouveau) ligne.statut = 'en_route';
        try {
          const enr = nouveau ? await donnees.ajouter('stock_livraisons', { ...ligne, stock_applique: false }) : await donnees.modifier('stock_livraisons', b.id, ligne);
          fermerFenetre();
          await relire();
          if (statutVoulu === 'livree' && enr.statut !== 'livree') await changerStatut(livraisons.find((x) => x.id === enr.id) || enr, 'livree');
          else notifier(nouveau ? 'Livraison ajoutée.' : 'Livraison enregistrée.');
        } catch (e) { err.textContent = 'Enregistrement refusé : ' + (e.message || e); err.hidden = false; }
      });
    }

    // ---------- Onglet Mouvements ----------
    function dessinerMouvements() {
      const TYPES = { entree: 'Entrée', sortie: 'Sortie', ajustement: 'Ajustement', transfert: 'Transfert' };
      $('#stk-corps').innerHTML = `
        <div class="contenu-page" style="max-width:none">
          <section class="carte" style="padding:8px 8px 4px"><div class="tableau-defile"><table class="registre">
            <thead><tr><th>Date</th><th>Produit</th><th>Type</th><th style="text-align:right">Quantité</th><th>Emplacement</th><th>Motif</th><th>Par</th></tr></thead>
            <tbody>${mouvements.length ? mouvements.slice(0, 300).map((m) => `<tr>
              <td class="discret" style="white-space:nowrap">${dateHeure(m.created_at)}</td><td><b>${esc(m.produit_nom || '—')}</b></td>
              <td>${TYPES[m.type] || esc(m.type)}</td><td style="text-align:right" class="${m.quantite < 0 ? 'texte-danger' : 'statut ok'}"><b>${m.quantite > 0 ? '+' : ''}${m.quantite}</b></td>
              <td class="discret">${esc(m.emplacement || '—')}</td><td class="discret">${esc(m.motif || '')}</td><td class="discret">${esc(m.auteur_nom || '')}</td></tr>`).join('')
              : '<tr><td colspan="7"><p class="vide">Aucun mouvement pour l’instant.</p></td></tr>'}</tbody></table></div></section>
        </div>`;
    }

    // ---------- Relecture (après une modification, ou en direct depuis un autre PC) ----------
    async function relire() {
      const changePlan = await charger();
      if (detruit) return;
      if (onglet === 'magasin' && vue3d && !choix) {
        if (changePlan) vue3d.majPlan();
        vue3d.majProduits(produits);
        vue3d.majCamions(livraisons);
        if (selProduit) vue3d.montrerProduit(selProduit);
        dessinerPanneau();
        if (vitrine) dessinerVitrine();
        const s = $('#stk-stats');
        if (s) s.innerHTML = stats(); // l'entête est mise à jour sans recréer la 3D
      } else dessiner();
    }

    let offCRM = null;
    function ecouter() {
      if (donnees.mode === 'crm') { if (window.FMDERPNuage && window.FMDERPNuage.surMaj) offCRM = window.FMDERPNuage.surMaj(() => setTimeout(() => { if (!detruit && fenetre.hidden) relire(); }, 50)); return; }
      if (donnees.mode !== 'base') return;
      const plusTard = () => { clearTimeout(minuterie); minuterie = setTimeout(() => { if (fenetre.hidden) relire(); }, 400); };
      canal = sb.channel('stock-direct');
      ['stock_produits', 'stock_livraisons', 'stock_mouvements', 'stock_plan'].forEach((t) => canal.on('postgres_changes', { event: '*', schema: 'public', table: t }, plusTard));
      canal.subscribe();
    }

    conteneur.innerHTML = '<div class="centre"><div class="discret">Ouverture du stock…</div></div>';
    donnees.init().then(charger).then(() => { if (detruit) return; dessiner(); ecouter(); });

    return {
      detruire() {
        detruit = true;
        fermerVitrine();
        clearTimeout(minuterie);
        fermer3D();
        if (canal) sb.removeChannel(canal);
        if (offCRM) offCRM();
        if (!fenetre.hidden && fenetre.querySelector('.stk-fiche, #pl-ok')) fermerFenetre();
        conteneur.classList.remove('page-stock');
      },
    };
  }

  window.FMDStock = { monter };
})();
