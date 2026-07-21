# PAINT STUDIO OKINAWA

Site vitrine (japonais, EN prêt) de **PAINT STUDIO OKINAWA** — atelier de peinture sur figurine à Naha, Okinawa (那覇市松尾).

Site statique immersif : hero vidéo scrub, viewer 3D d'une figurine (Three.js), animation de figurines au scroll (GSAP), interlude vidéo scrubbé, carte Google Maps, réservation via Instagram DM.

## Lancer en local
```bash
python3 serve.py 5599   # http://localhost:5599
```

## Structure
- `index.html` / `style.css` / `script.js` — le site.
- `privacy.html` / `tokusho.html` / `contact.html` — pages légales (à compléter : nom du responsable, tarifs, politique d'annulation).
- `assets/` — vidéos, figurines détourées, modèle 3D (OBJ + texture), GSAP & Three.js vendorisés.

## À compléter (mentions légales)
Voir les champs surlignés dans `tokusho.html` et `contact.html`.
