/* DQM-guide view router: the single owner of the URL hash, of which view is
   visible, of the active nav link, of the page title, of the scroll position,
   and of navigation focus. Every view stays mounted, so its controls keep
   their in-memory state across a switch; only the active view is revealed.

   The URL hash is the source of truth. The view id is the hash up to its first
   separator, so room is left for route parameters after it. A hash that names
   no view — empty, unknown, or a future parameterised route — falls back to
   the field guide. Legacy guide anchors open the relevant contextual guidance.

   The router does not own species selections, team data, or planner tabs. A
   view reacts to being revealed by implementing window.DQMApp.viewShown(id),
   which the router calls after the destination is displayed.

   Load after js/planner-ui.js. Exposes window.DQMViews:
     DQMViews.go("pair-finder", { focusId: "result-name" });
*/
(() => {
  "use strict";
  const P = id => document.getElementById(id);
  const TITLE_SUFFIX = "DQM1&2 PSX Player Guide";
  const DEFAULT_VIEW = "field-guide";
  const views = [
    { id: "field-guide", heading: "field-heading" },
    { id: "atlas", heading: "atlas-heading" },
    { id: "pair-finder", heading: "pair-heading" },
    { id: "offspring-finder", heading: "offspring-heading" },
    { id: "breeding-tree", heading: "tree-heading" },
    { id: "monster", heading: "monster-heading" },
    { id: "breeding-table", heading: "breeding-table-heading" },
    { id: "species-index", heading: "species-heading" },
    { id: "team-planner", heading: "planner-heading" },
    { id: "sources", heading: "sources-heading" },
  ];
  const aliases = { "rules-guide": "offspring-finder", "conditional-rules": "offspring-finder", "about": "sources" };
  const aliasTargets = { "rules-guide": "offspring-heading", "conditional-rules": "breeding-conditions", "about": "sources-heading" };
  const known = new Set(views.map(view => view.id));
  const navLinks = Array.from(document.querySelectorAll('.nav a[href^="#"]'));
  const skipLink = document.querySelector("a.skip");
  const browse = P("browse-toggle");
  const contents = P("guide-contents");
  const compact = matchMedia("(max-width: 1023px)");
  const frame = contents.closest(".guide-frame");
  function useDisclosure() { return compact.matches || document.querySelector("main").classList.contains("wide-view"); }
  function setMenu(open) {
    const collapsible = useDisclosure();
    frame.classList.toggle("compact-contents", collapsible);
    browse.setAttribute("aria-expanded", String(open));
    contents.hidden = collapsible && !open;
  }
  function closeMenu() { setMenu(false); }
  browse.addEventListener("click", () => setMenu(contents.hidden));
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && useDisclosure() && !contents.hidden) {
      closeMenu();
      browse.focus();
    }
  });
  document.addEventListener("pointerdown", event => {
    if (!contents.hidden && useDisclosure() && !event.target.closest(".guide-navigation")) closeMenu();
  });
  document.querySelector(".guide-navigation").addEventListener("focusout", event => {
    if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) closeMenu();
  });
  compact.addEventListener("change", closeMenu);
  closeMenu();
  P("guide-filters").addEventListener("click", closeMenu);
  let activeView = null;
  let pendingFocusId = null;
  let navigation = 0;
  let renderedPath;
  let renderedHash;
  const currentHash = () => window.DQMEntryHash?.() || location.hash;

  // Only the leading view id is parsed. Whatever follows the first separator
  // is returned as params, so a future route can read it without changing how
  // the view id is found.
  function parse(hash) {
    const raw = String(hash || "").replace(/^#/, "");
    const cut = raw.search(/[?&/]/);
    return {
      id: (cut === -1 ? raw : raw.slice(0, cut)).toLowerCase(),
      params: cut === -1 ? "" : raw.slice(cut),
    };
  }
  function viewFor(hash) {
    const { id } = parse(hash);
    return (known.has(id) ? id : aliases[id]) || DEFAULT_VIEW;
  }
  function headingFor(viewId) {
    if (viewId === "field-guide") return [P("article-title"), P("directory-title"), P("field-heading")].find(el => el && !el.closest("[hidden]"));
    const view = views.find(entry => entry.id === viewId);
    return view ? P(view.heading) : null;
  }
  function reveal(viewId) {
    document.querySelector("main").classList.toggle("wide-view", viewId === "breeding-table");
    for (const view of views) {
      const element = P(view.id);
      if (element) element.hidden = view.id !== viewId;
    }
  }
  function markNav(viewId) {
    const params = new URLSearchParams(parse(currentHash()).params);
    let section = "#" + (viewId === "monster" ? "species-index" : viewId);
    if (viewId === "field-guide") {
      const row = window.DQMField?.entryForNav(params.get("entry"));
      const kind = row?.kind || params.get("kind");
      const game = row?.game || params.get("game");
      if (kind === "story") section = "#field-guide?game=" + (game || "dqm1") + "&kind=story";
      else if (kind === "location") section = "#field-guide?kind=location";
      else if (kind === "tool") section = "#field-guide?kind=item";
      else if (kind && navLinks.some(link => link.hash === "#field-guide?kind=" + kind)) section = "#field-guide?kind=" + kind;
    }
    if (viewId === "atlas") section = "#field-guide?kind=location";
    for (const link of navLinks) {
      const active = link.hash === section;
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
      link.classList.toggle("nav-link-active", active);
    }
  }
  // The nav label is the view's title, so one edit renames both.
  function setTitle(viewId) {
    const link = navLinks.find(candidate => candidate.hash === "#" + viewId);
    const label = link ? link.getAttribute("aria-label") || link.textContent.trim() : (viewId === "sources" ? "Sources & coverage" : viewId);
    document.title = label + " · " + TITLE_SUFFIX;
  }
  // A hash that names an element inside the revealed view keeps the browser's
  // own scroll to that element, so a legacy anchor lands on its heading.
  function fragmentIn(view) {
    const id = parse(location.hash).id;
    const fragment = P(aliasTargets[id] || id);
    return fragment && view.contains(fragment) ? fragment : null;
  }
  // A focus target that is not focusable by default — a result heading, say —
  // is made programmatically focusable, so focusId always means "focus this".
  // tabindex="-1" keeps it out of the tab order.
  function focusable(element) {
    if (element && element.tabIndex < 0 && !element.hasAttribute("tabindex")) element.setAttribute("tabindex", "-1");
    return element;
  }

  // The one renderer: initial load, hashchange, Back, Forward, a repeated nav
  // click, and go() all end up here. The destination is revealed before
  // anything is scrolled or focused, so focus can never land in a hidden view.
  function render(viewId, options) {
    if (viewId === "field-guide") {
      const query = new URLSearchParams(parse(currentHash()).params);
      if (query.get("kind") === "monster" && !query.has("entry")) {
        const search = query.get("q");
        viewId = "species-index";
        history.replaceState(null, "", "#species-index" + (search ? "?q="+encodeURIComponent(search) : ""));
      }
    }
    renderedPath = location.pathname;
    if (!options?.fromSearch) {
      const query = viewId === "field-guide" ? parse(currentHash()).params : "";
      window.DQMGuideShell.syncSearch(new URLSearchParams(query));
    }
    const ticket = ++navigation;
    const status = P("view-load-status");
    if (status) status.remove();
    const waiting = window.DQMAssets.ready(viewId, currentHash());
    if (!waiting) { showView(viewId, options); return; }
    const main = document.querySelector("main");
    main.setAttribute("aria-busy","true");
    waiting.then(() => {
      if (ticket === navigation) showView(viewId, options);
    }, () => {
      if (ticket !== navigation) return;
      main.removeAttribute("aria-busy");
      const notice = document.createElement("div");
      notice.id = "view-load-status";
      notice.className = "panel";
      notice.setAttribute("role","alert");
      notice.textContent = "This section couldn’t load. Reconnect and try again. ";
      const retry = document.createElement("button");
      retry.type = "button";
      retry.textContent = "Reload";
      retry.onclick = () => location.reload();
      notice.append(retry);
      main.prepend(notice);
      if (options?.focus) retry.focus();
    });
  }
  function showView(viewId, options) {
    document.querySelector("main").removeAttribute("aria-busy");
    const settings = options || {};
    const view = P(viewId);
    if (!view) return;
    const previouslyFocused = document.activeElement;
    const atlasDirectory = viewId === 'atlas' && activeView === viewId ? window.DQMAtlas.directoryKey : null;
    const changedRoute = currentHash() !== renderedHash;
    reveal(viewId);
    closeMenu();
    if (window.DQMApp && typeof window.DQMApp.viewShown === "function") window.DQMApp.viewShown(viewId);
    if (viewId === "species-index") {
      const q = new URLSearchParams(parse(currentHash()).params).get("q");
      if (q !== null && q !== P("species-search").value) {
        P("species-search").value = q;
        P("species-search").dispatchEvent(new Event("input",{bubbles:true}));
      }
    }
    markNav(viewId);
    setTitle(viewId);
    if (viewId === "field-guide" || viewId === "atlas") {
      if (viewId === "atlas") P('atlas-places-nav').innerHTML = DQMLocations.navigation(
        new URLSearchParams(parse(currentHash()).params).get('tab') === 'encounters' ? 'encounters' : 'maps',
        value => String(value).replaceAll('&','&amp;'));
      const title = viewId === "atlas" ? window.DQMAtlas.show() : (window.DQMField || window.DQMGuideShell).show();
      if (title) document.title = title + " · " + TITLE_SUFFIX;
    }
    if (viewId === "monster" && window.DQMMonsters) { window.DQMMonsters.renderRoute(); document.title = window.DQMMonsters.title() + " · " + TITLE_SUFFIX; }
    if (viewId === "breeding-tree" && window.DQMBreedingTree) window.DQMBreedingTree.viewShown();
    if (viewId === "team-planner" && new URLSearchParams(parse(location.hash).params).get("import") === "save") {
      P("planner-tab-roster").click();
      if (settings.focus) settings.focusId = "save-import-file";
    }
    if (viewId === "team-planner" && new URLSearchParams(parse(location.hash).params).get("manage") === "teams") {
      settings.focusId = "manage-teams";
    }
    // Browsing another location in the same list should not jump the page to
    // its heading. Filters, pages, view changes and explicit focus still do.
    const keepAtlasPosition = changedRoute && settings.scroll !== true && atlasDirectory != null &&
      atlasDirectory === window.DQMAtlas.directoryKey && !settings.focusId;
    activeView = viewId;
    renderedHash = currentHash();
    window.dispatchEvent(new Event('guide-view-rendered'));
    const stageId = viewId === 'field-guide' && new URLSearchParams(parse(currentHash()).params).get('entry');
    const stage = stageId && P(stageId)?.closest('.walk-stage') ? P(stageId) : null;
    const sectionId = {encounters:'location-encounters',maps:'location-map-browser'}[new URLSearchParams(parse(currentHash()).params).get('section')];
    const locationSection = viewId === 'field-guide' && sectionId ?
      sectionId==='location-map-browser' ? P('gate-map-selected') || P(sectionId) : P(sectionId) : null;
    if (keepAtlasPosition && settings.focus && !previouslyFocused.isConnected) {
      const replacement = previouslyFocused.id && P(previouslyFocused.id);
      focusable(replacement || P('atlas-location'))?.focus({ preventScroll: true });
    }
    if ((settings.scroll === false || keepAtlasPosition) && !stage && !locationSection) return;
    const heading = headingFor(viewId);
    const requested = settings.focusId ? P(settings.focusId) : stage || locationSection;
    const focusTarget = focusable(requested || heading);
    const scrollTarget = requested || fragmentIn(view) || heading || view;
    if (scrollTarget) scrollTarget.scrollIntoView({ block: "start", behavior: "instant" });
    if (settings.focus && focusTarget) focusTarget.focus({ preventScroll: true });
  }

  // Cross-view handoff: works for a changed hash and for a destination that is
  // already open, where the URL will not change and nothing else would render.
  function go(viewId, options) {
    if (!known.has(viewId)) return;
    const focusId = (options && options.focusId) || null;
    const query = new URLSearchParams(options?.params || {}).toString();
    const hash = "#" + viewId + (query ? "?" + query : "");
    // A handoff always lands on the bare view id. A parameterised hash for the
    // same view (a shared pairing, say) must not read as "already here", or its
    // parameters would linger after a "Try pair" / "Use as pedigree" jump.
    if (location.hash === hash) {
      render(viewId, { focus: true, focusId });
      return;
    }
    pendingFocusId = focusId;
    location.hash = hash;
  }

  // Keep the source page in Back history. Later keystrokes edit the same
  // results URL, even while the reference data is still loading.
  function search({push = false, submit = false} = {}) {
    const previous = parse(currentHash());
    const fromGuide = previous.id === DEFAULT_VIEW;
    const prior = new URLSearchParams(fromGuide ? previous.params : "");
    const next = new URLSearchParams();
    for (const [key,id] of [["q","guide-search"],["game","guide-game"],["kind","guide-kind"]]) {
      const value = P(id).value.trim();
      if (value) next.set(key,value);
    }
    const kind = next.get("kind");
    if (kind === "quest" && prior.has("purpose")) next.set("purpose",prior.get("purpose"));
    if (kind === prior.get("kind") && ["skill","mechanic","item","tool"].includes(kind) && prior.has("sort")) {
      next.set("sort",prior.get("sort"));
    }
    const hash = "#field-guide" + (next.size ? "?" + next : "");
    const startSearch = !fromGuide || prior.has("entry") || (!prior.has("q") && next.has("q"));
    if (currentHash() !== hash) {
      if (push || startSearch) history.pushState(null,"",hash);
      else history.replaceState(null,"",hash);
    }
    render(DEFAULT_VIEW,{fromSearch:true,focus:submit,scroll:submit || startSearch});
  }

  function followLocation() {
    const focusId = pendingFocusId;
    pendingFocusId = null;
    render(viewFor(currentHash()), { focus: true, focusId });
  }
  // Back to a published entry can change the path as well as the hash.
  // Browsers only guarantee hashchange for a change within the same path.
  window.addEventListener("popstate", () => {
    if (location.pathname !== renderedPath) followLocation();
  });
  window.addEventListener("hashchange", event => {
    if (new URL(event.oldURL).pathname === new URL(event.newURL).pathname) followLocation();
  });

  for (const link of navLinks) {
    link.addEventListener("click", event => {
      if (link.hash === location.hash) {
        // A repeated click on the current link changes nothing in the URL, so
        // no hashchange follows: reveal, scroll, and focus here.
        event.preventDefault();
        render(viewFor(link.hash), { focus: true });
        return;
      }
      if (viewFor(link.hash) === 'atlas' && event.button === 0 &&
          !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
        pendingFocusId = 'atlas-heading';
      }
      // The hashchange reveals and focuses the tool after its controls are ready.
    });
  }

  if (skipLink) {
    skipLink.addEventListener("click", event => {
      // The skip link is an in-page jump, not a navigation: it must reach the
      // view that is currently visible without writing to the URL.
      event.preventDefault();
      render(activeView || DEFAULT_VIEW, { focus: true, scroll: true });
    });
  }

  document.addEventListener('click', event => {
    const link = event.target.closest('.places-nav a[data-atlas-tab]');
    if (!link || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    go('atlas', {focusId:'atlas-heading', params:new URLSearchParams(parse(link.hash).params)});
  });

  window.DQMViews = Object.freeze({ go, search, current: () => activeView, viewFor, parse });

  // Normal loads leave position and focus to the browser. Old guide fragments
  // no longer name DOM elements, so scroll their replacement help into view
  // explicitly without moving keyboard focus.
  render(viewFor(currentHash()), { focus: false, scroll: Boolean(aliasTargets[parse(currentHash()).id]) });
})();
