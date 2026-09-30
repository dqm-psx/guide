/* DQM-guide theme controller.
   The inline bootstrap in index.html makes the pre-paint decision; this file
   owns the picker afterwards. It re-resolves System against matchMedia, keeps
   every button[data-theme-choice] in sync, and persists a manual choice.
   Every storage and matchMedia access is guarded so a hostile environment can
   never break the page. There are no imports and nothing here throws. */
(function (root) {
  "use strict";

  var STORAGE_KEY = "dqm-guide-theme-v1";
  var CHOICES = ["system", "light", "dark"];
  var DARK_QUERY = "(prefers-color-scheme: dark)";

  var currentChoice = "system";
  var resolvedTheme = "light";

  function isChoice(value) {
    return CHOICES.indexOf(value) !== -1;
  }

  function readStored() {
    try {
      return root.localStorage ? root.localStorage.getItem(STORAGE_KEY) : null;
    } catch (error) {
      return null;
    }
  }

  function writeStored(value) {
    try {
      if (root.localStorage) root.localStorage.setItem(STORAGE_KEY, value);
    } catch (error) {
      // A blocked or full storage queue must not stop the theme from applying.
    }
  }

  function readChoice() {
    var stored = readStored();
    return isChoice(stored) ? stored : "system";
  }

  function darkMedia() {
    try {
      return root.matchMedia ? root.matchMedia(DARK_QUERY) : null;
    } catch (error) {
      return null;
    }
  }

  function prefersDark() {
    var media = darkMedia();
    return !!(media && media.matches);
  }

  function resolve(choice) {
    return choice === "dark" || (choice === "system" && prefersDark()) ? "dark" : "light";
  }

  function syncControls() {
    var document = root.document;
    if (!document || typeof document.querySelectorAll !== "function") return;
    document.querySelectorAll("button[data-theme-choice]").forEach(function (button) {
      var pressed = button.dataset.themeChoice === currentChoice;
      button.setAttribute("aria-pressed", String(pressed));
    });
  }

  // apply() re-applies the theme. Pass a choice to set it explicitly; omit it
  // to re-read what is stored (the load path). An explicit choice still wins
  // when storage is unavailable, so a click is never swallowed.
  function apply(choice) {
    currentChoice = isChoice(choice) ? choice : readChoice();
    resolvedTheme = resolve(currentChoice);
    var document = root.document;
    if (document && document.documentElement) {
      document.documentElement.setAttribute("data-theme", resolvedTheme);
      document.documentElement.setAttribute("data-theme-choice", currentChoice);
    }
    syncControls();
  }

  function onPick(choice) {
    if (!isChoice(choice)) return;
    writeStored(choice);
    apply(choice);
  }

  if (root.document && typeof root.document.addEventListener === "function") {
    root.document.addEventListener("click", function (event) {
      var target = event.target;
      var button = target && typeof target.closest === "function"
        ? target.closest("button[data-theme-choice]")
        : null;
      if (!button) return;
      onPick(button.dataset.themeChoice);
    });
  }

  // A system-preference flip only changes the page while System is chosen;
  // a manual Light or Dark choice ignores the operating system.
  var media = darkMedia();
  if (media && typeof media.addEventListener === "function") {
    media.addEventListener("change", function () {
      if (currentChoice === "system") apply("system");
    });
  }

  // The picker may not be parsed yet, so apply once now and once more on
  // DOMContentLoaded (whichever is later) to land the pressed state.
  apply();
  if (root.document && root.document.readyState === "loading") {
    root.document.addEventListener("DOMContentLoaded", function () {
      apply();
    }, { once: true });
  }

  root.DQMTheme = Object.freeze({
    apply: apply,
    choice: function () { return currentChoice; },
    resolved: function () { return resolvedTheme; }
  });
})(globalThis);
