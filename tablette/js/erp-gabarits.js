// FMD — CRM : GABARITS des produits à variantes (11 nov. 2026).
// Demande : « quand je crée un produit à variantes, le logiciel a différents moyens de remplir selon la catégorie : vêtements =
// couleurs × tailles, vis = dimensions (diamètre, longueur…) ; les vis à bois et les vis à placo n'ont pas les mêmes dimensions ;
// je choisis le type et ça me met automatiquement toutes les dimensions, couleurs, revêtements… ».
// Chaque gabarit donne : la catégorie, les caractéristiques (axes), les valeurs proposées, et pour les vis la liste des
// dimensions qui EXISTENT (diamètre → longueurs) ; l'empreinte se déduit du diamètre selon le système choisi (Pozidriv, Torx…).
// Gammes relevées sur les catalogues fabricants / distributeurs (Legallais, Knauf, Richter, Spax, HECO, Acton…, ISO 15480) :
// gammes COURANTES, à ajuster selon le fournisseur (on coche seulement ce qu'on vend).
(function () {
  'use strict';
  const D = (window.FMDERP = window.FMDERP || {});

  const COULEURS_TEXTILE = ['Noir', 'Blanc', 'Gris', 'Gris chiné', 'Anthracite', 'Bleu marine', 'Bleu roi', 'Rouge', 'Orange', 'Jaune', 'Vert', 'Kaki', 'Beige', 'Marron'];
  const CONDITIONNEMENT = ['100', '200', '500', '1000'];
  const FINITIONS_BOIS = ['Acier zingué blanc', 'Acier zingué jaune', 'Acier zingué noir', 'Inox A2', 'Inox A4'];
  // longueurs « métriques » courantes
  const LM = (min, max) => [6, 8, 10, 12, 16, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 90, 100, 110, 120, 130, 140, 150, 160, 180, 200].filter((l) => l >= min && l <= max);

  D.GABARITS = [
    // ---------- Vêtements & EPI ----------
    { id: 'vetements', groupe: 'Vêtements & EPI', nom: 'Vêtements (T-shirt, sweat, veste, pantalon…)', categorie: 'vetements',
      axes: ['Couleur', 'Taille'], valeurs: { Couleur: COULEURS_TEXTILE, Taille: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL'] } },
    { id: 'pantalon-taille', groupe: 'Vêtements & EPI', nom: 'Pantalon (tailles 36 à 56)', categorie: 'vetements',
      axes: ['Couleur', 'Taille'], valeurs: { Couleur: COULEURS_TEXTILE, Taille: ['36', '38', '40', '42', '44', '46', '48', '50', '52', '54', '56'] } },
    { id: 'chaussures', groupe: 'Vêtements & EPI', nom: 'Chaussures de sécurité', categorie: 'vetements',
      axes: ['Couleur', 'Pointure', 'Norme'], valeurs: { Couleur: ['Noir', 'Marron', 'Gris', 'Bleu marine'], Pointure: ['35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48'], Norme: ['S1P', 'S3', 'S3 SRC', 'S1P SRC'] } },
    { id: 'gants', groupe: 'Vêtements & EPI', nom: 'Gants de protection', categorie: 'vetements',
      axes: ['Taille'], valeurs: { Taille: ['6', '7', '8', '9', '10', '11'] } },

    // ---------- Visserie ----------
    { id: 'vis-bois', groupe: 'Visserie', nom: 'Vis à bois / aggloméré tête fraisée', categorie: 'visserie',
      axes: ['Diamètre', 'Longueur', 'Empreinte', 'Finition', 'Quantité par boîte'],
      dimensions: { '3': [12, 16, 20, 25, 30, 35, 40], '3.5': [12, 16, 20, 25, 30, 35, 40, 45, 50], '4': [16, 20, 25, 30, 35, 40, 45, 50, 60, 70],
        '4.5': [20, 25, 30, 35, 40, 45, 50, 60, 70, 80], '5': [25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 120], '6': [40, 50, 60, 70, 80, 90, 100, 120, 140, 160, 180, 200] },
      empreintes: { Pozidriv: { '3': 'PZ1', '3.5': 'PZ2', '4': 'PZ2', '4.5': 'PZ2', '5': 'PZ2', '6': 'PZ3' }, Torx: { '3': 'T10', '3.5': 'T15', '4': 'T20', '4.5': 'T20', '5': 'T25', '6': 'T30' } },
      valeurs: { Finition: FINITIONS_BOIS, 'Quantité par boîte': CONDITIONNEMENT } },
    { id: 'vis-placo', groupe: 'Visserie', nom: 'Vis plaque de plâtre (TTPC, tête trompette)', categorie: 'visserie',
      axes: ['Diamètre', 'Longueur', 'Pointe', 'Empreinte', 'Finition', 'Quantité par boîte'],
      dimensions: { '3.5': [25, 35, 45, 55], '3.9': [25, 35, 45, 55], '4.2': [70, 80, 90] },
      empreintes: { Phillips: { '3.5': 'PH2', '3.9': 'PH2', '4.2': 'PH2' } },
      valeurs: { Pointe: ['Aiguille (rail ≤ 0,7 mm)', 'Foret (rail ≤ 2,2 mm)'], Finition: ['Phosphatée noire', 'Zinguée'], 'Quantité par boîte': ['200', '500', '1000', '4000'] } },
    { id: 'vis-autoperceuse', groupe: 'Visserie', nom: 'Vis autoperceuse tête hexagonale (ISO 15480 / ex-DIN 7504 K)', categorie: 'visserie',
      axes: ['Diamètre', 'Longueur', 'Empreinte', 'Rondelle', 'Finition', 'Quantité par boîte'],
      dimensions: { '4.2': [13, 16, 19, 22, 25, 32, 38], '4.8': [16, 19, 22, 25, 32, 38, 45, 50], '5.5': [19, 22, 25, 32, 38, 50, 60, 70], '6.3': [19, 22, 25, 32, 38, 50, 60, 70, 80, 100] },
      empreintes: { Hexagonale: { '4.2': 'Hex 7', '4.8': 'Hex 8', '5.5': 'Hex 8', '6.3': 'Hex 10' } },
      valeurs: { Rondelle: ['Sans', 'Rondelle EPDM'], Finition: ['Acier zingué', 'Inox A2'], 'Quantité par boîte': ['100', '250', '500', '1000'] } },
    { id: 'vis-terrasse', groupe: 'Visserie', nom: 'Vis terrasse (tête fraisée réduite)', categorie: 'visserie',
      axes: ['Diamètre', 'Longueur', 'Empreinte', 'Finition', 'Quantité par boîte'],
      dimensions: { '5': [40, 50, 60, 70], '6': [60, 70, 80] },
      empreintes: { Torx: { '5': 'T25', '6': 'T30' } },
      valeurs: { Finition: ['Inox A2', 'Inox A4', 'Acier C1 traité'], 'Quantité par boîte': ['100', '200', '500', '1000'] } },
    { id: 'vis-charpente', groupe: 'Visserie', nom: 'Vis de charpente / construction tête large', categorie: 'visserie',
      axes: ['Diamètre', 'Longueur', 'Empreinte', 'Finition', 'Quantité par boîte'],
      dimensions: { '6': [60, 80, 100, 120, 140, 160, 180, 200, 220, 240, 260, 280, 300], '8': [80, 100, 120, 140, 160, 180, 200, 220, 240, 260, 280, 300, 350, 400], '10': [100, 120, 140, 160, 180, 200, 240, 280, 300, 350, 400, 450, 500] },
      empreintes: { Torx: { '6': 'T30', '8': 'T40', '10': 'T50' } },
      valeurs: { Finition: ['Acier zingué jaune', 'Acier zingué blanc', 'Inox A2'], 'Quantité par boîte': ['25', '50', '100'] } },
    { id: 'vis-beton', groupe: 'Visserie', nom: 'Vis béton (tête hexagonale ou fraisée)', categorie: 'visserie',
      axes: ['Diamètre', 'Longueur', 'Tête', 'Finition', 'Quantité par boîte'],
      dimensions: { '6': [40, 50, 60, 80, 100], '7.5': [40, 50, 60, 70, 80, 100, 120, 150, 180, 200], '10': [60, 80, 100, 120, 150, 200] },
      valeurs: { Tête: ['Hexagonale', 'Fraisée Torx'], Finition: ['Acier zingué', 'Inox A4'], 'Quantité par boîte': ['50', '100', '200'] } },
    { id: 'vis-metaux', groupe: 'Visserie', nom: 'Vis à métaux tête hexagonale (ISO 4017, filetage total)', categorie: 'visserie',
      axes: ['Diamètre', 'Longueur', 'Classe / matière', 'Quantité par boîte'],
      dimensions: { M4: LM(8, 40), M5: LM(10, 50), M6: LM(10, 80), M8: LM(16, 100), M10: LM(20, 120), M12: LM(25, 150), M14: LM(30, 150), M16: LM(30, 200) },
      valeurs: { 'Classe / matière': ['Acier 8.8 zingué', 'Acier 10.9 brut', 'Inox A2', 'Inox A4'], 'Quantité par boîte': ['25', '50', '100', '200'] } },
  ];

  D.gabarit = (id) => D.GABARITS.find((g) => g.id === id) || null;
  // Valeur affichée d'un diamètre : « 3.5 » → « 3,5 » (les filetages métriques « M8 » restent tels quels).
  D.diametreTxt = (d) => String(d).replace('.', ',');
})();
