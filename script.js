/* ============================================================
   PAINT STUDIO OKINAWA — interactions
   Moteur hérité de RYUHAKU (loader, reveal, nav, dots, scrub hero,
   i18n) + parade de figurines au scroll (GSAP / ScrollTrigger).
   ============================================================ */
(function () {
  "use strict";

  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  if (!location.hash) window.scrollTo(0, 0);

  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const video       = $("#heroVideo");
  const hero        = $("#hero");
  const heroMedia   = $("#heroMedia");
  const heroContent = $("#heroContent");
  const heroCue     = $("#heroCue");

  /* ---------- Loader ---------- */
  const fill = $("#loaderFill");
  let prog = 0, revealed = false;
  const progTimer = setInterval(() => {
    prog = Math.min(prog + Math.random() * 14, 92);
    fill.style.width = prog + "%";
  }, 170);

  let userScrolled = false;
  ["wheel", "touchstart", "keydown"].forEach((ev) =>
    window.addEventListener(ev, () => (userScrolled = true), { passive: true, once: true })
  );

  function reveal() {
    if (revealed) return; revealed = true;
    clearInterval(progTimer);
    fill.style.width = "100%";
    setTimeout(() => {
      document.body.classList.remove("loading");
      document.body.classList.add("loaded");
      if (!location.hash && !userScrolled) window.scrollTo(0, 0);
      $(".hero__title").classList.add("in");
      needsUpdate = true;
    }, 320);
  }
  try { video.load(); } catch (e) {}
  if (video.readyState >= 3) reveal();
  video.addEventListener("canplaythrough", reveal, { once: true });
  window.addEventListener("load", reveal);
  setTimeout(reveal, 4200); // garde-fou

  /* Hero : lecture uniquement à l'écran */
  if (!reduceMotion) {
    new IntersectionObserver((e) => {
      if (e[0].isIntersecting) video.play().catch(() => {});
      else video.pause();
    }, { threshold: 0 }).observe(hero);
  }
  /* ---------- Interlude ciné : la vidéo boutique avance au scroll ---------- */
  const cine      = $("#cine");
  const cineVideo = $("#cineVideo");
  const cineQuote = $("#cineQuote");
  let cineDur = 0, cineTarget = 0, cineCur = 0;
  const setCineDur = () => (cineDur = cineVideo.duration || 0);
  if (cineVideo.readyState >= 1) setCineDur();
  cineVideo.addEventListener("loadedmetadata", setCineDur);

  if (reduceMotion) {
    /* accessibilité : pas de scrub, simple lecture en boucle */
    cine.classList.add("cine--flat");
    cineVideo.loop = true;
    cineVideo.play().catch(() => {});
  }

  /* Sur mobile, une vidéo jamais lue ne peint pas ses frames lors d'un
     seek : on la lance une fois en muet puis on la met en pause. */
  let cinePrimed = false;
  function primeCine() {
    if (cinePrimed || reduceMotion) return;
    cinePrimed = true;
    cineVideo.muted = true;
    const pr = cineVideo.play();
    if (pr && pr.then) pr.then(() => cineVideo.pause()).catch(() => { cinePrimed = false; });
    else cineVideo.pause();
  }
  if (matchMedia("(pointer: coarse)").matches) {
    if (cineVideo.readyState >= 2) primeCine();
    cineVideo.addEventListener("loadeddata", primeCine, { once: true });
    window.addEventListener("touchstart", primeCine, { once: true, passive: true });
  }

  /* ---------- Boucle de rendu (hero scrub + section active) ---------- */
  let needsUpdate = true, activeId = "";
  const darkSections = new Set(["atelier"]); // sections à fond sombre → dots blancs
  const navLinks = $$(".nav__links a[data-link]");
  const dots     = $$(".dot");
  const dotsEl   = $("#dots");
  const nav      = $("#nav");
  const sections = ["hero", "about", "fig3d", "parade", "experience", "atelier", "info"]
    .map((id) => ({ id, el: document.getElementById(id) }))
    .filter((s) => s.el);

  function setActive(id) {
    if (id === activeId) return;
    activeId = id;
    navLinks.forEach((a) => a.classList.toggle("active", a.dataset.link === id));
    const dark = darkSections.has(id);
    dots.forEach((d) => {
      d.classList.toggle("on", d.dataset.dot === id);
      d.classList.toggle("on-dark", dark);
    });
  }

  function updateScene() {
    const vh = window.innerHeight;
    const hRect = hero.getBoundingClientRect();
    const hScroll = hero.offsetHeight - vh;
    const p = clamp(-hRect.top / hScroll, 0, 1);

    if (!reduceMotion) {
      heroMedia.style.transform = "scale(" + (1.06 + p * 0.12).toFixed(4) + ")";
      heroContent.style.transform = "translateY(" + (p * -60).toFixed(1) + "px)";
      heroContent.style.opacity = clamp(1 - (p - 0.55) / 0.3, 0, 1).toFixed(3);
      heroCue.style.opacity = clamp(1 - p / 0.12, 0, 1).toFixed(3);
    }
    nav.classList.toggle("nav--scrolled", -hRect.top > vh * 0.85);
    dotsEl.classList.toggle("show", -hRect.top > vh * 0.5);

    /* Interlude ciné : progression du scroll → cible de scrub + citation */
    if (!reduceMotion) {
      const cRect = cine.getBoundingClientRect();
      if (cRect.top < vh && cRect.bottom > 0) {
        const cp = clamp(-cRect.top / (cine.offsetHeight - vh), 0, 1);
        if (cineDur) cineTarget = cp * (cineDur - 0.6);
        const q = clamp(1 - Math.abs(cp - 0.55) / 0.32, 0, 1);
        cineQuote.style.opacity = q.toFixed(3);
        cineQuote.style.transform =
          "translate(-50%,-50%) translateY(" + ((0.55 - cp) * 30).toFixed(1) + "px)";
      }
    }

    /* Parade : progression du scroll → cible de la timeline GSAP */
    if (!reduceMotion && paradeTl) {
      const pRect = paradeEl.getBoundingClientRect();
      if (pRect.top < vh && pRect.bottom > 0) {
        paradeTarget = clamp(-pRect.top / (paradeEl.offsetHeight - vh), 0, 1);
      }
    }

    const mid = vh / 2;
    for (const s of sections) {
      const r = s.el.getBoundingClientRect();
      if (r.top <= mid && r.bottom >= mid) { setActive(s.id); break; }
    }
  }
  function frame() {
    if (needsUpdate) { updateScene(); needsUpdate = false; }
    /* Lissage du scrub de l'interlude (lerp) */
    if (!reduceMotion && cineDur) {
      cineCur += (cineTarget - cineCur) * 0.12;
      if (cineVideo.readyState >= 2 && Math.abs(cineTarget - cineCur) > 0.003) {
        try { cineVideo.currentTime = cineCur; } catch (e) {}
      }
    }
    /* Lissage de la parade (lerp → timeline GSAP) */
    if (!reduceMotion && paradeTl) {
      paradeCur += (paradeTarget - paradeCur) * 0.14;
      if (Math.abs(paradeTarget - paradeCur) > 0.0004) paradeTl.progress(paradeCur);
    }
    requestAnimationFrame(frame);
  }
  window.addEventListener("scroll", () => (needsUpdate = true), { passive: true });
  window.addEventListener("resize", () => (needsUpdate = true));
  requestAnimationFrame(frame);

  /* ---------- Révélations ---------- */
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    }),
    { threshold: 0.16, rootMargin: "0px 0px -7% 0px" }
  );
  $$("[data-reveal]").forEach((el) => io.observe(el));

  /* ---------- Navigation ---------- */
  const burger = $("#navBurger");
  const navMenu = $("#navLinks");
  burger.addEventListener("click", () => {
    const open = navMenu.classList.toggle("open");
    burger.classList.toggle("open", open);
    burger.setAttribute("aria-expanded", open);
  });
  $$(".nav__links a").forEach((a) =>
    a.addEventListener("click", () => {
      navMenu.classList.remove("open");
      burger.classList.remove("open");
      burger.setAttribute("aria-expanded", false);
    })
  );
  dots.forEach((d) =>
    d.addEventListener("click", () => {
      const t = document.getElementById(d.dataset.dot);
      if (t) t.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
    })
  );

  /* ---------- Carte Google Maps : chargement différé ----------
     On n'injecte la src de l'iframe que lorsque la section « info »
     approche du viewport. Cela évite qu'au chargement initial l'iframe
     prenne le focus et fasse défiler la page jusqu'en bas. */
  (function deferMap() {
    const map = $("#infoMap");
    const frame = map && $("iframe", map);
    if (!frame || !frame.dataset.src) return;
    const load = () => { if (!frame.src) frame.src = frame.dataset.src; };
    new IntersectionObserver((e, obs) => {
      if (e[0].isIntersecting) { load(); obs.disconnect(); }
    }, { rootMargin: "500px 0px" }).observe(map);
    /* Filet de sécurité : dès la première interaction de défilement, on
       charge la carte (le saut ne peut se produire qu'avant tout scroll). */
    window.addEventListener("scroll", load, { once: true, passive: true });
    window.addEventListener("touchstart", load, { once: true, passive: true });
  })();

  /* ---------- i18n JA / EN ---------- */
  const i18nEls = $$("[data-ja]");
  const langBtn = $("#langToggle");
  function setLang(lang) {
    document.documentElement.lang = lang;
    i18nEls.forEach((el) => {
      const v = el.dataset[lang];
      if (v == null) return;
      if (v.indexOf("<br>") !== -1) el.innerHTML = v;
      else el.textContent = v;
    });
    $$(".lang__opt").forEach((o) => o.classList.toggle("is-on", o.dataset.lang === lang));
    try { localStorage.setItem("ps-lang", lang); } catch (e) {}
  }
  langBtn.addEventListener("click", () => {
    setLang(document.documentElement.lang === "ja" ? "en" : "ja");
  });
  // langue par défaut : japonais (choix client) ; on respecte un choix mémorisé
  let saved = null;
  try { saved = localStorage.getItem("ps-lang"); } catch (e) {}
  if (saved === "en") setLang("en");

  /* ============================================================
     PARADE — GSAP piloté par le scroll (sticky CSS, sans pin JS)
     Deux figurines : l'une entre par la droite, l'autre par la
     gauche. Elles se CROISENT au centre puis s'immobilisent — une à
     gauche, une à droite — en révélant le texte central au passage,
     comme si elles ouvraient un rideau.
     La section est sticky en CSS ; la timeline GSAP (en pause) est
     avancée via tl.progress() dans la boucle rAF → aucune mesure
     fragile, même mécanique fiable que le hero et l'interlude ciné.
     ============================================================ */
  const paradeEl = $("#parade");
  let paradeTl = null, paradeTarget = 0, paradeCur = 0;

  function initParade() {
    if (typeof gsap === "undefined") return;
    const pin = $("#paradePin");
    if (!pin) return;

    // masque de reflet = la silhouette de chaque image (le sheen épouse la figurine)
    $$(".fig__inner", pin).forEach((inner) => {
      const src = $("img", inner).getAttribute("src");
      inner.style.setProperty("--fig-mask", `url("${src}") center/contain no-repeat`);
    });

    const left    = $('.fig--anchor[data-fig="left"]', pin);   // entre par la DROITE, finit à gauche
    const right   = $('.fig--anchor[data-fig="right"]', pin);  // entre par la GAUCHE, finit à droite
    const caption = $("#paradeCaption");

    const OFF     = 58;   // hors écran (vw depuis le centre)
    const anchorX = 32;   // position finale gauche/droite (vw depuis le centre)
    const CLOSED  = "inset(0 50% 0 50%)";  // texte masqué (fente centrale)
    const OPEN    = "inset(0 0% 0 0%)";    // texte révélé

    // Réduction de mouvement : composition finale, statique et lisible
    if (reduceMotion) {
      gsap.set(left,  { x: -anchorX + "vw", opacity: 1 });
      gsap.set(right, { x:  anchorX + "vw", opacity: 1 });
      gsap.set(caption, { opacity: 1, clipPath: OPEN, webkitClipPath: OPEN });
      return;
    }

    // États initiaux : chacune hors champ, de son côté d'entrée
    gsap.set(left,  { opacity: 1, x:  OFF + "vw", yPercent: 0, scale: .92 });
    gsap.set(right, { opacity: 1, x: -OFF + "vw", yPercent: 0, scale: .92 });
    gsap.set(caption, { opacity: 1, clipPath: CLOSED, webkitClipPath: CLOSED });

    // Flottement continu (indépendant du scroll)
    $$(".fig__inner", pin).forEach((inner, i) => {
      gsap.to(inner, {
        y: "+=14", duration: 2.6 + i * 0.5, ease: "sine.inOut",
        repeat: -1, yoyo: true, delay: i * 0.3,
      });
    });

    const tl = gsap.timeline({ paused: true });

    // Phase A — traversée : elles partent chacune de leur côté, se croisent
    // au centre (léger décalage vertical pour éviter tout chevauchement),
    // et vont s'ancrer du côté opposé.
    tl.to(left,  { x: -anchorX + "vw", scale: 1, ease: "power1.inOut", duration: 2 }, 0)
      .to(right, { x:  anchorX + "vw", scale: 1, ease: "power1.inOut", duration: 2 }, 0)
      // au moment du croisement, l'une passe légèrement plus haut, l'autre plus bas
      .to(left,  { yPercent: -9, ease: "sine.inOut", duration: 1 }, 0.3)
      .to(right, { yPercent:  9, ease: "sine.inOut", duration: 1 }, 0.3)
      .to(left,  { yPercent: 0, ease: "sine.inOut", duration: 0.7 }, 1.3)
      .to(right, { yPercent: 0, ease: "sine.inOut", duration: 0.7 }, 1.3);

    // Phase B — le texte se révèle du centre vers l'extérieur, dans le
    // sillage des figurines qui s'écartent (« elles ouvrent le rideau »)
    tl.to(caption, { clipPath: OPEN, webkitClipPath: OPEN, ease: "power2.out", duration: 1.1 }, 0.95);

    // Maintien de la composition finale
    tl.to({}, { duration: 1 });

    paradeTl = tl;
  }

  if (document.readyState === "complete") initParade();
  else window.addEventListener("load", initParade);

  /* ============================================================
     FIGURINE 3D — Three.js (OBJ + texture), hérité du moteur RYUHAKU
     Auto-rotation douce + rotation liée au scroll + drag libre.
     ============================================================ */
  (function initFig3d() {
    const canvas  = $("#figCanvas");
    const stage   = $("#figStage");
    const section = $("#fig3d");
    const loading = $("#figLoading");
    if (!canvas || !stage || typeof THREE === "undefined" || !THREE.OBJLoader) {
      if (loading) loading.classList.add("hide");
      return;
    }

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x000000, 0);

    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);

    /* Éclairage studio clair : clé chaude + rebonds turquoise/corail */
    scene.add(new THREE.HemisphereLight(0xffffff, 0xe8ddc8, 0.75));
    const key = new THREE.DirectionalLight(0xfff4e4, 1.9);
    key.position.set(3, 5, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.5; key.shadow.camera.far = 20;
    key.shadow.camera.left = -3; key.shadow.camera.right = 3;
    key.shadow.camera.top = 3;  key.shadow.camera.bottom = -3;
    key.shadow.bias = -0.0005; key.shadow.radius = 4;
    scene.add(key);
    const fillL = new THREE.DirectionalLight(0x9fe4dc, 0.7);
    fillL.position.set(-4, 2, -1); scene.add(fillL);
    const rim = new THREE.DirectionalLight(0xffd3bd, 0.85);
    rim.position.set(-1, 3, -5); scene.add(rim);

    /* Sol invisible → ombre de contact portée */
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.ShadowMaterial({ opacity: 0.24 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.07;
    controls.enablePan = false;
    controls.autoRotate = !reduceMotion; controls.autoRotateSpeed = 1.1;
    controls.minPolarAngle = 0.6; controls.maxPolarAngle = 1.5;

    let model = null, visible = false, targetRot = 0, curRot = 0;
    const baseRotY = -0.4;

    const tex = new THREE.TextureLoader().load("assets/model/texture.jpg");
    tex.encoding = THREE.sRGBEncoding;

    /* Chargement différé : on ne télécharge/parse le modèle que lorsque la
       section approche du viewport (économise le chargement initial). */
    let loadStarted = false;
    function loadModel() {
      if (loadStarted) return;
      loadStarted = true;
      new THREE.OBJLoader().load(
      "assets/model/fig.obj",
      (obj) => {
        /* peinture brillante : rugosité basse */
        const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.34, metalness: 0.04 });
        obj.traverse((c) => {
          if (c.isMesh) {
            c.geometry.computeVertexNormals();
            c.material = mat;
            c.castShadow = true;
          }
        });
        /* Normalisation échelle + position (base posée sur le sol) */
        let box = new THREE.Box3().setFromObject(obj);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        obj.scale.setScalar(1.7 / maxDim);
        box = new THREE.Box3().setFromObject(obj);
        const center = box.getCenter(new THREE.Vector3());
        obj.position.x -= center.x;
        obj.position.z -= center.z;
        obj.position.y -= box.min.y;
        model = obj; scene.add(obj);
        /* Cadrage caméra */
        box = new THREE.Box3().setFromObject(obj);
        const sph = box.getBoundingSphere(new THREE.Sphere());
        const vFOV = camera.fov * Math.PI / 180;
        const hFOV = 2 * Math.atan(Math.tan(vFOV / 2) * camera.aspect);
        const dist = Math.max(sph.radius / Math.sin(vFOV / 2), sph.radius / Math.sin(hFOV / 2)) * 1.1;
        const elev = 18 * Math.PI / 180;
        camera.position.set(0, sph.center.y + Math.sin(elev) * dist, Math.cos(elev) * dist);
        controls.target.set(0, sph.center.y, 0);
        controls.minDistance = dist * 0.6;
        controls.maxDistance = dist * 1.7;
        controls.update();

        if (loading) loading.classList.add("hide");
      },
      undefined,
      (err) => { console.warn("Modèle 3D : échec du chargement", err); if (loading) loading.classList.add("hide"); }
      );
    }

    function resize() {
      const w = stage.clientWidth || 640, h = stage.clientHeight || 480;
      camera.aspect = w / h; camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    }
    resize();
    if (window.ResizeObserver) new ResizeObserver(resize).observe(stage);
    else window.addEventListener("resize", resize);

    /* Démarre le chargement quand la section approche (800px avant) */
    new IntersectionObserver((e, obs) => {
      if (e[0].isIntersecting) { loadModel(); obs.disconnect(); }
    }, { rootMargin: "800px 0px" }).observe(section);

    new IntersectionObserver((e) => { visible = e[0].isIntersecting; }, { threshold: 0.01 })
      .observe(section);

    /* Rendu uniquement lorsque la section est visible (économie hors-champ) */
    function animate() {
      requestAnimationFrame(animate);
      if (!visible || !model) return;
      if (!reduceMotion) {
        const r = section.getBoundingClientRect();
        const p = clamp((window.innerHeight - r.top) / (window.innerHeight + r.height), 0, 1);
        targetRot = p * Math.PI * 1.2;
        curRot += (targetRot - curRot) * 0.08;
      }
      model.rotation.y = baseRotY + curRot;
      controls.update();
      renderer.render(scene, camera);
    }
    requestAnimationFrame(animate);
  })();
})();
