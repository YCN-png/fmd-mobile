// FMD — module « Agent AI » (10 nov. 2026) : les employés IA de FMD.
// Pour l'instant : la page du module avec ses 3 agents, tous « Bientôt » (demande de l'utilisateur : « ajoute juste le
// module, on verra pour le fonctionnement plus tard »). Rien n'est envoyé nulle part, aucune IA n'est branchée.
// Prochaine étape prévue : l'Assistant AI (bulle de discussion en bas à droite, répond à partir des données du logiciel
// grâce à des outils : prix pour un client, stock, documents…) via l'API Claude, clé collée par l'utilisateur.
// Utilisé par js/app.js : window.FMDAgentAI.monter(conteneur, ctx) → { detruire() }.
(function () {
  'use strict';

  const AGENTS = [
    { id: 'assistant', nom: 'Assistant AI', ico: 'M4 5h16v11H8l-4 4zM8 9h8M8 12h5', etat: 'Prochaine étape',
      txt: 'Le bras droit du commercial : il répond à toutes les questions sur le logiciel, à partir des vraies données de FMD.',
      points: ['« Quel prix pour la VIS-SPX-4X40 chez ce client ? » : prix négocié, niveau de prix, remise', 'Stock, devis, commandes, factures et impayés d’un client', 'Bulle de discussion en bas à droite, présente partout dans FMD', 'Liens directs vers les fiches et les documents'] },
    { id: 'prospecteur', nom: 'Prospecteur AI', ico: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01', etat: 'Bientôt',
      txt: 'Il repère qui contacter et prépare les messages, pour que la prospection ne s’arrête jamais.',
      points: ['Nouvelles entreprises de FM’RADAR et prospects du CRM', 'Qui relancer, quand, et pourquoi', 'E-mails et courriers personnalisés, prêts à envoyer'] },
    { id: 'monteur', nom: 'Monteur AI', ico: 'M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z', etat: 'Bientôt',
      txt: 'Son rôle exact reste à définir ensemble.',
      points: ['Pistes : montage vidéo pour les réseaux, aide aux monteurs-installateurs, ou montage automatique des devis'] },
  ];
  const svg = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;

  function monter(conteneur, ctx) {
    const { esc } = ctx;
    conteneur.classList.add('page-agentai');
    conteneur.innerHTML = `<div class="agentai">
      <header class="agentai-tete">
        <div class="agentai-logo">${svg('M12 3v3M12 18v3M3 12h3M18 12h3M6.3 6.3l2.1 2.1M15.6 15.6l2.1 2.1M6.3 17.7l2.1-2.1M15.6 8.4l2.1-2.1M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z')}</div>
        <div><h1>Agent AI</h1><p>Les employés IA de FMD : ils aident l’équipe au quotidien, à partir des données du logiciel.</p></div>
      </header>
      <div class="agentai-grille">${AGENTS.map((a) => `
        <article class="agentai-carte${a.id === 'assistant' ? ' prochain' : ''}" aria-disabled="true">
          <div class="agentai-carte-tete"><span class="agentai-ico">${svg(a.ico)}</span><h2>${esc(a.nom)}</h2><span class="pastille">${esc(a.etat)}</span></div>
          <p>${esc(a.txt)}</p>
          <ul>${a.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
        </article>`).join('')}</div>
      <p class="agentai-note">Les agents ne sont pas encore branchés : aucune donnée n’est envoyée. Le fonctionnement (IA utilisée, coût, clé) sera décidé avant la mise en service.</p>
    </div>`;
    return { detruire() { conteneur.classList.remove('page-agentai'); conteneur.innerHTML = ''; } };
  }

  window.FMDAgentAI = { monter };
})();
