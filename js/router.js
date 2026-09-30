/* DQM-guide view router: the single owner of the URL hash, of which view is
   visible, of the active nav link, of the page title, of the scroll position,
   and of navigation focus. Every view stays mounted, so its controls keep
   their in-memory state across a switch; only the active view is revealed.

   The URL hash is the source of truth. The view id is the hash up to its first
   separator, so room is left for route parameters after it. A hash that names
   no view — empty, unknown, or a future parameterised route — falls back to
   Find a pairing, and two legacy anchors still address their headings inside
   Rules & guide.

   The router does not own species selections, team data, or planner tabs. A
   view reacts to being revealed by implementing window.DQMApp.viewShown(id),
   which the router calls after the destination is displayed.

   Load after js/planner-ui.js. Exposes window.DQMViews:
     DQMViews.go("pair-finder", { focusId: "result-name" });
*/
(() => {
  "use strict";
  const P = id => document.getElementById(id);
  const TITLE_SUFFIX = "DQM1&2 PS1 breeding reference";
  const DEFAULT_VIEW = "pair-finder";
  const views = [
    { id: "pair-finder", heading: "pair-heading" },
    { id: "offspring-finder", heading: "offspring-heading" },
    { id: "species-index", heading: "species-heading" },
    { id: "team-planner", heading: "planner-heading" },
    { id: "rules-guide", heading: "rules-guide-heading" },
  ];
  // Legacy anchors still address their headings inside Rules & guide.
  const aliases = { "conditional-rules": "rules-guide", "about": "rules-guide" };
  const known = new Set(views.map(view => view.id));
  const navLinks = Array.from(document.querySelectorAll('.nav a[href^="#"]'));
  const skipLink = document.querySelector("a.skip");

  let activeView = null;
  let pendingFocusId = null;

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
    const view = views.find(entry => entry.id === viewId);
    return view ? P(view.heading) : null;
  }
  function reveal(viewId) {
    for (const view of views) {
      const element = P(view.id);
      if (element) element.hidden = view.id !== viewId;
    }
  }
  function markNav(viewId) {
    for (const link of navLinks) {
      const active = viewFor(link.hash) === viewId;
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
      link.classList.toggle("nav-link-active", active);
    }
  }
  // The nav label is the view's title, so one edit renames both.
  function setTitle(viewId) {
    const link = navLinks.find(candidate => viewFor(candidate.hash) === viewId);
    const label = link ? link.textContent.replace(/\s+/g, " ").trim() : viewId;
    document.title = label + " · " + TITLE_SUFFIX;
  }
  // A hash that names an element inside the revealed view keeps the browser's
  // own scroll to that element, so a legacy anchor lands on its heading.
  function fragmentIn(view) {
    const fragment = P(parse(location.hash).id);
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
    const settings = options || {};
    const view = P(viewId);
    if (!view) return;
    reveal(viewId);
    if (window.DQMApp && typeof window.DQMApp.viewShown === "function") window.DQMApp.viewShown(viewId);
    markNav(viewId);
    setTitle(viewId);
    activeView = viewId;
    if (settings.scroll === false) return;
    const heading = headingFor(viewId);
    const requested = settings.focusId ? P(settings.focusId) : null;
    const focusTarget = focusable(requested || heading);
    const scrollTarget = requested || fragmentIn(view) || heading || view;
    if (scrollTarget) scrollTarget.scrollIntoView({ block: "start" });
    if (settings.focus && focusTarget) focusTarget.focus({ preventScroll: true });
  }

  // Cross-view handoff: works for a changed hash and for a destination that is
  // already open, where the URL will not change and nothing else would render.
  function go(viewId, options) {
    if (!known.has(viewId)) return;
    const focusId = (options && options.focusId) || null;
    // A handoff always lands on the bare view id. A parameterised hash for the
    // same view (a shared pairing, say) must not read as "already here", or its
    // parameters would linger after a "Try pair" / "Use as pedigree" jump.
    if (location.hash === "#" + viewId) {
      render(viewId, { focus: true, focusId });
      return;
    }
    pendingFocusId = focusId;
    location.hash = viewId;
  }

  window.addEventListener("hashchange", () => {
    const focusId = pendingFocusId;
    pendingFocusId = null;
    render(viewFor(location.hash), { focus: true, focusId });
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
      // Reveal the destination before the browser follows the anchor, so its
      // own scroll lands on a view that is actually displayed. The hashchange
      // above then owns the scroll and the focus.
      reveal(viewFor(link.hash));
    });
  }

  if (skipLink) {
    skipLink.addEventListener("click", event => {
      // The skip link is an in-page jump, not a navigation: it must reach the
      // view that is currently visible without writing to the URL.
      event.preventDefault();
      render(activeView || DEFAULT_VIEW, { focus: true });
    });
  }

  window.DQMViews = Object.freeze({ go, current: () => activeView, viewFor, parse });

  // On first load the browser owns the position: revealing the only visible
  // view leaves it at the top of the document, and scrolling here would move
  // the starting point for the first Tab away from the skip link.
  render(viewFor(location.hash), { focus: false, scroll: false });
})();
