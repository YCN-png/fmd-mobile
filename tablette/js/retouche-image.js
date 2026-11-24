// FMD — Retouche d'image commune à tout le logiciel (17 nov. 2026, demande de l'utilisateur : « sur tout le logiciel,
// quand il y a une image, je veux pouvoir la modifier »).
// window.FMDRetouche.ouvrir(src, { titre, format }) → Promise<dataURL | null> (null = annulé).
// Agrandir / réduire (curseur, molette, − +), déplacer en glissant, recadrer (libre, carré, 4:3, 3:4, 16:9, 3:2),
// pivoter, miroir, luminosité / contraste / saturation, fond blanc ou transparent quand l'image est réduite.
// Utilisé par : coquille (CRM js/erp-ui.js, FM'PAREBRISE js/parebrise.js, magasin js/stock.js) et FM'STUDIO
// (modules/studio/js/editeurs/champs.js, chargé par « Ouvrir fmd studio.html »). Styles injectés ici (D.A. FMD).
(function () {
  'use strict';
  if (window.FMDRetouche) return;

  const FORMATS = [['libre', 'Libre', 0], ['carre', 'Carré', 1], ['43', '4:3', 4 / 3], ['34', '3:4', 3 / 4], ['169', '16:9', 16 / 9], ['32', '3:2', 3 / 2]];
  const CSS = `
.fr-voile{position:fixed;inset:0;z-index:2147483000;background:rgba(8,8,8,.62);backdrop-filter:blur(6px);display:grid;place-items:center;font-family:Montserrat,system-ui,sans-serif}
.fr-boite{width:min(980px,96vw);max-height:94vh;display:grid;grid-template-columns:minmax(0,1fr) 270px;grid-template-rows:auto minmax(0,1fr) auto;background:#121010;color:#f6eee9;border-radius:22px;overflow:hidden;
  border:1px solid rgba(247,218,197,.16);box-shadow:0 30px 80px -20px rgba(0,0,0,.8),0 0 60px -20px rgba(233,191,166,.45)}
.fr-tete{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid rgba(247,218,197,.12)}
.fr-tete b{font-size:15px}.fr-tete small{color:#a8968b;font-size:12px}
.fr-scene{position:relative;min-height:380px;background:repeating-conic-gradient(#1c1817 0 25%,#151211 0 50%) 0 0/22px 22px;cursor:grab;touch-action:none}
.fr-scene.glisse{cursor:grabbing}.fr-scene canvas{position:absolute;inset:0;width:100%;height:100%}
.fr-cote{padding:14px 16px;overflow:auto;border-left:1px solid rgba(247,218,197,.12);display:flex;flex-direction:column;gap:14px}
.fr-cote h4{margin:0 0 6px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#c9a08a}
.fr-ligne{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.fr-btn{border:1px solid rgba(247,218,197,.22);background:rgba(255,255,255,.04);color:#f6eee9;border-radius:99px;padding:6px 11px;font:600 12px Montserrat,system-ui,sans-serif;cursor:pointer}
.fr-btn:hover{border-color:#E9BFA6}.fr-btn.actif{background:linear-gradient(135deg,#F7DAC5,#C08A6E);color:#0b0908;border-color:transparent}
.fr-btn:focus-visible,.fr-curseur:focus-visible{outline:2px solid #E9BFA6;outline-offset:2px}
.fr-reg{display:grid;grid-template-columns:1fr auto;gap:2px 8px;font-size:12px;align-items:center}.fr-reg span{color:#a8968b}.fr-reg output{font-variant-numeric:tabular-nums}
.fr-curseur{grid-column:1/-1;width:100%;accent-color:#E9BFA6}
.fr-pied{grid-column:1/-1;display:flex;gap:10px;justify-content:flex-end;align-items:center;padding:12px 18px;border-top:1px solid rgba(247,218,197,.12)}
.fr-pied .fr-info{margin-right:auto;font-size:12px;color:#a8968b}
.fr-ok{background:linear-gradient(135deg,#F7DAC5,#6F4A3C);color:#0b0908;border:0;padding:9px 18px;font-weight:700}
.fr-erreur{position:absolute;inset:0;display:grid;place-items:center;text-align:center;padding:30px;color:#f6c1b8;font-size:14px}
@media (max-width:760px){.fr-boite{grid-template-columns:1fr}.fr-cote{border-left:0;border-top:1px solid rgba(247,218,197,.12);max-height:38vh}}`;

  function styles() { if (document.getElementById('fr-styles')) return; const s = document.createElement('style'); s.id = 'fr-styles'; s.textContent = CSS; document.head.appendChild(s); }
  // Image en ligne (lien https) : téléchargée par le logiciel (window.lanceur.imageEnDonnees), sinon le site peut la bloquer
  // pour la retouche (protection « CORS ») ; repli : chargement direct.
  const chargerSrc = async (src) => { if (/^https?:/i.test(src) && window.lanceur && window.lanceur.imageEnDonnees) { try { const d = await window.lanceur.imageEnDonnees(src); if (d) return d; } catch { /* repli */ } } return src; };
  const charger0 = (src) => new Promise((ok, ko) => { const im = new Image(); if (/^https?:/i.test(src)) im.crossOrigin = 'anonymous'; im.onload = () => ok(im); im.onerror = () => ko(new Error('Image illisible')); im.src = src; });

  function ouvrir(src, o = {}) {
    styles();
    return new Promise((fin) => {
      const v = document.createElement('div'); v.className = 'fr-voile' + (o.complet ? '' : ' fr-simple'); /* 23/11 : version simple par défaut (outil complet retiré le 17/11) */ v.setAttribute('role', 'dialog'); v.setAttribute('aria-modal', 'true'); v.setAttribute('aria-label', 'Modifier l’image');
      v.innerHTML = `<div class="fr-boite">
        <div class="fr-tete"><div><b>${(o.titre || 'Modifier l’image').replace(/</g, '&lt;')}</b><br><small>Glissez pour déplacer · molette pour agrandir / réduire</small></div><button type="button" class="fr-btn" data-fr="annuler" aria-label="Fermer">✕</button></div>
        <div class="fr-scene" data-fr-scene><canvas></canvas></div>
        <div class="fr-cote">
          <div><h4>Taille</h4><div class="fr-reg"><span>Agrandir / réduire</span><output data-fr-o="zoom">100 %</output><input class="fr-curseur" type="range" min="30" max="500" value="100" data-fr-r="zoom" aria-label="Agrandir ou réduire"></div>
            <div class="fr-ligne" style="margin-top:6px"><button type="button" class="fr-btn" data-fr="moins">−</button><button type="button" class="fr-btn" data-fr="plus">+</button><button type="button" class="fr-btn" data-fr="ajuster">Ajuster au cadre</button><button type="button" class="fr-btn" data-fr="centrer" title="Recentre et agrandit l’objet au milieu du cadre">◎ Centrer le sujet</button></div></div>
          <div><h4>Recadrer</h4><div class="fr-ligne">${FORMATS.map(([k, l]) => `<button type="button" class="fr-btn" data-fr-format="${k}">${l}</button>`).join('')}</div></div>
          <div><h4>Orientation</h4><div class="fr-ligne"><button type="button" class="fr-btn" data-fr="gauche" title="Pivoter à gauche">↺ 90°</button><button type="button" class="fr-btn" data-fr="droite" title="Pivoter à droite">↻ 90°</button><button type="button" class="fr-btn" data-fr="miroir">⇋ Miroir</button></div></div>
          <div><h4>Réglages</h4>
            ${[['lum', 'Luminosité'], ['con', 'Contraste'], ['sat', 'Couleurs']].map(([k, l]) => `<div class="fr-reg"><span>${l}</span><output data-fr-o="${k}">100 %</output><input class="fr-curseur" type="range" min="40" max="180" value="100" data-fr-r="${k}" aria-label="${l}"></div>`).join('')}</div>
          <div><h4>Fond (image réduite)</h4><div class="fr-ligne"><button type="button" class="fr-btn" data-fr-fond="transparent">Transparent</button><button type="button" class="fr-btn" data-fr-fond="blanc">Blanc</button><button type="button" class="fr-btn" data-fr-fond="noir">Noir</button></div></div>
          <button type="button" class="fr-btn" data-fr="reset">Tout réinitialiser</button>
        </div>
        <div class="fr-pied"><span class="fr-info" data-fr-info></span><button type="button" class="fr-btn" data-fr="annuler">Annuler</button><button type="button" class="fr-btn fr-ok" data-fr="valider">Valider</button></div></div>`;
      document.body.appendChild(v);
      const scene = v.querySelector('[data-fr-scene]'), cv = scene.querySelector('canvas'), cx = cv.getContext('2d');
      const info = v.querySelector('[data-fr-info]');
      const base = { zoom: 1, ox: 0, oy: 0, rot: 0, miroir: false, lum: 100, con: 100, sat: 100, format: o.format || 'libre', fond: /^data:image\/jpe?g/i.test(src) ? 'blanc' : 'transparent' };
      let e = { ...base }, img = null, cadre = null;
      const fermer = (r) => { document.removeEventListener('keydown', clavier, true); window.removeEventListener('resize', dessiner); v.remove(); fin(r); };
      const dims = () => { const q = e.rot % 180 !== 0; return { w: q ? img.naturalHeight : img.naturalWidth, h: q ? img.naturalWidth : img.naturalHeight }; };
      const ratio = () => { const f = FORMATS.find((x) => x[0] === e.format); if (f && f[2]) return f[2]; const d = dims(); return d.w / d.h; };
      function calculer() {
        const W = scene.clientWidth, H = scene.clientHeight, r = ratio(), m = 34;
        let bw = W - 2 * m, bh = bw / r; if (bh > H - 2 * m) { bh = H - 2 * m; bw = bh * r; }
        const d = dims(); const echelle = Math.max(bw / d.w, bh / d.h) * e.zoom;
        cadre = { x: (W - bw) / 2, y: (H - bh) / 2, w: bw, h: bh, echelle, W, H };
      }
      function peindre(c, k, x0, y0) { // dessine l'image (transformée) avec le facteur k, cadre à (x0, y0)
        c.save(); c.filter = `brightness(${e.lum}%) contrast(${e.con}%) saturate(${e.sat}%)`;
        c.translate(x0 + (cadre.w / 2 + e.ox) * k, y0 + (cadre.h / 2 + e.oy) * k); c.rotate((e.rot * Math.PI) / 180); if (e.miroir) c.scale(-1, 1);
        const s = cadre.echelle * k; c.drawImage(img, (-img.naturalWidth * s) / 2, (-img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s); c.restore();
      }
      function dessiner() {
        if (!img) return; const dpr = window.devicePixelRatio || 1; calculer();
        cv.width = Math.round(cadre.W * dpr); cv.height = Math.round(cadre.H * dpr); cx.setTransform(dpr, 0, 0, dpr, 0, 0); cx.clearRect(0, 0, cadre.W, cadre.H);
        if (e.fond !== 'transparent') { cx.fillStyle = e.fond === 'noir' ? '#000' : '#fff'; cx.fillRect(cadre.x, cadre.y, cadre.w, cadre.h); }
        peindre(cx, 1, cadre.x, cadre.y);
        cx.fillStyle = 'rgba(8,8,8,.62)'; cx.beginPath(); cx.rect(0, 0, cadre.W, cadre.H); cx.rect(cadre.x, cadre.y, cadre.w, cadre.h); cx.fill('evenodd');
        cx.strokeStyle = '#E9BFA6'; cx.lineWidth = 2; cx.strokeRect(cadre.x, cadre.y, cadre.w, cadre.h);
        cx.strokeStyle = 'rgba(247,218,197,.35)'; cx.lineWidth = 1; cx.beginPath();
        for (let i = 1; i < 3; i++) { cx.moveTo(cadre.x + (cadre.w * i) / 3, cadre.y); cx.lineTo(cadre.x + (cadre.w * i) / 3, cadre.y + cadre.h); cx.moveTo(cadre.x, cadre.y + (cadre.h * i) / 3); cx.lineTo(cadre.x + cadre.w, cadre.y + (cadre.h * i) / 3); } cx.stroke();
        const t = taille(); info.textContent = `Résultat : ${t.w} × ${t.h} px`;
        v.querySelector('[data-fr-r="zoom"]').value = Math.round(e.zoom * 100); v.querySelector('[data-fr-o="zoom"]').textContent = Math.round(e.zoom * 100) + ' %';
        ['lum', 'con', 'sat'].forEach((k) => { v.querySelector(`[data-fr-r="${k}"]`).value = e[k]; v.querySelector(`[data-fr-o="${k}"]`).textContent = e[k] + ' %'; });
        v.querySelectorAll('[data-fr-format]').forEach((b) => { const a = b.dataset.frFormat === e.format; b.classList.toggle('actif', a); b.setAttribute('aria-pressed', a); });
        v.querySelectorAll('[data-fr-fond]').forEach((b) => { const a = b.dataset.frFond === e.fond; b.classList.toggle('actif', a); b.setAttribute('aria-pressed', a); });
        v.querySelector('[data-fr="miroir"]').classList.toggle('actif', e.miroir);
      }
      // Taille du résultat : la résolution d'origine dans le cadre, limitée à 1800 px de large/haut
      const taille = () => { const px = cadre.w / cadre.echelle; let w = Math.max(60, Math.round(px)), h = Math.round(w / (cadre.w / cadre.h)); const k = Math.min(1, 1800 / Math.max(w, h)); return { w: Math.round(w * k), h: Math.max(1, Math.round(h * k)) }; };
      function exporter() {
        const t = taille(); const c = document.createElement('canvas'); c.width = t.w; c.height = t.h; const x = c.getContext('2d');
        const jpeg = e.fond !== 'transparent' && /^data:image\/jpe?g/i.test(src);
        if (e.fond !== 'transparent') { x.fillStyle = e.fond === 'noir' ? '#000' : '#fff'; x.fillRect(0, 0, t.w, t.h); }
        peindre(x, t.w / cadre.w, 0, 0);
        return jpeg ? c.toDataURL('image/jpeg', .9) : c.toDataURL('image/png');
      }
      // « Centrer le sujet » (23 nov. 2026) : repère l'objet (pixels ni transparents ni blancs), le met au milieu du cadre
      // et l'agrandit à 88 % du cadre. L'utilisateur peut ensuite ajuster puis « Valider ».
      function centrerSujet() {
        const L = 500, k = Math.min(1, L / Math.max(img.naturalWidth, img.naturalHeight)); const w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
        const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.drawImage(img, 0, 0, w, h);
        let d; try { d = x.getImageData(0, 0, w, h).data; } catch { info.textContent = 'Image en ligne protégée : centrage impossible.'; return; }
        let x0 = w, y0 = h, x1 = -1, y1 = -1;
        for (let y = 0; y < h; y++) for (let i = 0; i < w; i++) { const p = (y * w + i) * 4; if (d[p + 3] > 16 && !(d[p] > 238 && d[p + 1] > 238 && d[p + 2] > 238)) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
        if (x1 < 0) { info.textContent = 'Aucun objet repéré (image vide ou toute blanche).'; return; }
        let dx = ((x0 + x1 + 1) / 2 - w / 2) / k, dy = ((y0 + y1 + 1) / 2 - h / 2) / k; let sw = (x1 - x0 + 1) / k, sh = (y1 - y0 + 1) / k;
        if (e.miroir) dx = -dx; const a = (e.rot * Math.PI) / 180; const rx = dx * Math.cos(a) - dy * Math.sin(a), ry = dx * Math.sin(a) + dy * Math.cos(a); if (e.rot % 180) [sw, sh] = [sh, sw];
        e.zoom = 1; calculer(); const s0 = cadre.echelle; const s = 0.88 * Math.min(cadre.w / sw, cadre.h / sh);
        e.zoom = Math.min(5, Math.max(.3, s / s0)); calculer(); e.ox = -rx * cadre.echelle; e.oy = -ry * cadre.echelle;
        if (e.zoom < 1 && e.fond === 'transparent' && /^data:image\/jpe?g/i.test(src)) e.fond = 'blanc';
        dessiner(); info.textContent = 'Sujet centré : ajustez si besoin, puis Valider.';
      }
      const zoomer = (z) => { e.zoom = Math.min(5, Math.max(.3, z)); dessiner(); };
      // glisser pour déplacer
      let prise = null;
      scene.addEventListener('pointerdown', (ev) => { prise = { x: ev.clientX, y: ev.clientY, ox: e.ox, oy: e.oy }; scene.setPointerCapture(ev.pointerId); scene.classList.add('glisse'); });
      scene.addEventListener('pointermove', (ev) => { if (!prise) return; e.ox = prise.ox + ev.clientX - prise.x; e.oy = prise.oy + ev.clientY - prise.y; dessiner(); });
      const lacher = () => { prise = null; scene.classList.remove('glisse'); }; scene.addEventListener('pointerup', lacher); scene.addEventListener('pointercancel', lacher);
      scene.addEventListener('wheel', (ev) => { ev.preventDefault(); zoomer(e.zoom * (ev.deltaY < 0 ? 1.08 : 1 / 1.08)); }, { passive: false });
      v.addEventListener('input', (ev) => { const r = ev.target.dataset.frR; if (!r) return; if (r === 'zoom') e.zoom = ev.target.value / 100; else e[r] = +ev.target.value; dessiner(); });
      v.addEventListener('click', (ev) => {
        if (ev.target === v) { fermer(null); return; }
        const b = ev.target.closest('[data-fr],[data-fr-format],[data-fr-fond]'); if (!b) return;
        if (b.dataset.frFormat) { e.format = b.dataset.frFormat; e.ox = e.oy = 0; dessiner(); return; }
        if (b.dataset.frFond) { e.fond = b.dataset.frFond; dessiner(); return; }
        const a = b.dataset.fr;
        if (a === 'annuler') fermer(null);
        else if (a === 'valider') { try { fermer(exporter()); } catch { info.textContent = 'Image en ligne protégée : téléchargez-la puis importez-la pour la modifier.'; } }
        else if (a === 'plus') zoomer(e.zoom * 1.15); else if (a === 'moins') zoomer(e.zoom / 1.15);
        else if (a === 'ajuster') { e.zoom = 1; e.ox = e.oy = 0; dessiner(); }
        else if (a === 'centrer') centrerSujet();
        else if (a === 'gauche' || a === 'droite') { e.rot = (e.rot + (a === 'droite' ? 90 : 270)) % 360; e.ox = e.oy = 0; dessiner(); }
        else if (a === 'miroir') { e.miroir = !e.miroir; dessiner(); }
        else if (a === 'reset') { e = { ...base }; dessiner(); }
      });
      function clavier(ev) { if (ev.key === 'Escape') { ev.stopPropagation(); fermer(null); } else if (ev.key === 'Enter' && !/INPUT|BUTTON/.test(ev.target.tagName)) { ev.preventDefault(); v.querySelector('[data-fr="valider"]').click(); } }
      document.addEventListener('keydown', clavier, true); window.addEventListener('resize', dessiner);
      chargerSrc(src).then((s) => { src = s; return charger0(s); }).then((im) => { img = im; dessiner(); if (o.centrer) centrerSujet(); v.querySelector('[data-fr="valider"]').focus(); })
        .catch(() => { scene.innerHTML = '<div class="fr-erreur">Cette image ne peut pas être modifiée ici (image en ligne protégée ou fichier illisible).<br>Téléchargez-la puis importez-la depuis l’ordinateur.</div>'; v.querySelector('[data-fr="valider"]').disabled = true; });
    });
  }

  window.FMDRetouche = { ouvrir };
})();
