// ==UserScript==
// @name         GitHub Hide Skipped Jobs Steps
// @author       Chris Carini
// @namespace    chriscarini.com
// @version      0.0.1
// @description  Find skipped steps in GitHub Actions and hide them.
// @match        https://github.com/*/*/actions/runs/*
// @icon         data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAyNCIgaGVpZ2h0PSIxMDI0IiB2aWV3Qm94PSIwIDAgMTAyNCAxMDI0IiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgo8cGF0aCBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGNsaXAtcnVsZT0iZXZlbm9kZCIgZD0iTTggMEMzLjU4IDAgMCAzLjU4IDAgOEMwIDExLjU0IDIuMjkgMTQuNTMgNS40NyAxNS41OUM1Ljg3IDE1LjY2IDYuMDIgMTUuNDIgNi4wMiAxNS4yMUM2LjAyIDE1LjAyIDYuMDEgMTQuMzkgNi4wMSAxMy43MkM0IDE0LjA5IDMuNDggMTMuMjMgMy4zMiAxMi43OEMzLjIzIDEyLjU1IDIuODQgMTEuODQgMi41IDExLjY1QzIuMjIgMTEuNSAxLjgyIDExLjEzIDIuNDkgMTEuMTJDMy4xMiAxMS4xMSAzLjU3IDExLjcgMy43MiAxMS45NEM0LjQ0IDEzLjE1IDUuNTkgMTIuODEgNi4wNSAxMi42QzYuMTIgMTIuMDggNi4zMyAxMS43MyA2LjU2IDExLjUzQzQuNzggMTEuMzMgMi45MiAxMC42NCAyLjkyIDcuNThDMi45MiA2LjcxIDMuMjMgNS45OSAzLjc0IDUuNDNDMy42NiA1LjIzIDMuMzggNC40MSAzLjgyIDMuMzFDMy44MiAzLjMxIDQuNDkgMy4xIDYuMDIgNC4xM0M2LjY2IDMuOTUgNy4zNCAzLjg2IDguMDIgMy44NkM4LjcgMy44NiA5LjM4IDMuOTUgMTAuMDIgNC4xM0MxMS41NSAzLjA5IDEyLjIyIDMuMzEgMTIuMjIgMy4zMUMxMi42NiA0LjQxIDEyLjM4IDUuMjMgMTIuMyA1LjQzQzEyLjgxIDUuOTkgMTMuMTIgNi43IDEzLjEyIDcuNThDMTMuMTIgMTAuNjUgMTEuMjUgMTEuMzMgOS40NyAxMS41M0M5Ljc2IDExLjc4IDEwLjAxIDEyLjI2IDEwLjAxIDEzLjAxQzEwLjAxIDE0LjA4IDEwIDE0Ljk0IDEwIDE1LjIxQzEwIDE1LjQyIDEwLjE1IDE1LjY3IDEwLjU1IDE1LjU5QzEzLjcxIDE0LjUzIDE2IDExLjUzIDE2IDhDMTYgMy41OCAxMi40MiAwIDggMFoiIHRyYW5zZm9ybT0ic2NhbGUoNjQpIiBmaWxsPSIjMUIxRjIzIi8+Cjwvc3ZnPgo=
// @license      https://github.com/ChrisCarini/github-hide-skipped-jobs-steps-userscript/blob/main/LICENSE
// @updateURL    https://github.com/ChrisCarini/github-hide-skipped-jobs-steps-userscript/raw/main/GitHub-Hide-Skipped-Jobs-Steps.user.js
// @downloadURL  https://github.com/ChrisCarini/github-hide-skipped-jobs-steps-userscript/raw/main/GitHub-Hide-Skipped-Jobs-Steps.user.js
// ==/UserScript==

const STORAGE_KEY_SHOULD_SHOW_SKIPPED_JOBS = 'github-hide-skipped-jobs-steps-should-show-skipped-jobs';
const DEBUG = false;

function debug(msg) {
  if (DEBUG) {
    console.log(msg);
  }
}

function getElements() {
  return document.querySelectorAll('.WorkflowRunLogsScroll > .js-socket-channel > check-step[data-conclusion="skipped"]');
}

function updateSkippedJobs() {
  let areVisibleSkippedJobs = thereAreVisibleSkippedJobs();
  let settingMarkedShouldShowSkippedJobs = Boolean(window.localStorage.getItem(STORAGE_KEY_SHOULD_SHOW_SKIPPED_JOBS) === 'true');

  debug(`show-skipped-jobs: ${settingMarkedShouldShowSkippedJobs}, and 'skipped jobs' ARE visible: ${areVisibleSkippedJobs}`);

  if (settingMarkedShouldShowSkippedJobs === areVisibleSkippedJobs) {
    debug("SKIP: Skipping updating 'skipped jobs'.");
    return false;
  }

  debug("CHANGE: Updating 'skipped jobs'.")
  let result = settingMarkedShouldShowSkippedJobs ? showSkippedJobs() : hideSkippedJobs();
  debug("CHANGE: Updated 'skipped jobs'.")
  return result;
}

function showSkippedJobs() {
  debug("Showing 'skipped jobs'.");
  return modifySkippedJobs(false);
}

function hideSkippedJobs() {
  debug("Hiding 'skipped jobs'.");
  return modifySkippedJobs(true);
}

function modifySkippedJobs(hidden) {
  let elements = getElements();

  if (elements.length === 0) {
    debug("No skipped steps found.")
    return true;
  }
  elements.forEach((node) => node.hidden = hidden);
  updateCogOptionsState();
  return false;
}

function createCogElement(addAfterElement, text, shouldShowOption, storageSetting) {
  const newElement = document.createElement("a");
  newElement.id = `github-hide-skipped-jobs-steps-cog-setting-${text}`;
  newElement.href = "";
  newElement.style = addAfterElement.style;
  newElement.classList = addAfterElement.classList;
  newElement.innerHTML = `${text[0].toUpperCase() + text.substring(1).toLowerCase()} Skipped Jobs`;
  newElement.hidden = !shouldShowOption;

  newElement.addEventListener('click', () => {
    debug(`============== ${text.toUpperCase()} CLICKED! Processing...... ==============`);
    let storageSetting = shouldShowOption;
    debug(`Setting STORAGE_KEY_SHOULD_SHOW_SKIPPED_JOBS to: ${storageSetting}`);
    window.localStorage.setItem(STORAGE_KEY_SHOULD_SHOW_SKIPPED_JOBS, storageSetting);
    init();
    debug(`============== ${text.toUpperCase()} CLICKED! DONE Processing. ==============`);
  });

  addAfterElement.parentElement.append(newElement);

  return newElement;
}

function thereAreVisibleSkippedJobs() {
  let elements = getElements();
  return Boolean(elements.length > 0 && elements[0].checkVisibility());
}

function addCogOptions() {
  const a = document.getElementById(`github-hide-skipped-jobs-steps-cog-setting-show`);
  const b = document.getElementById(`github-hide-skipped-jobs-steps-cog-setting-hide`);
  if (a != null || b != null) {
    debug("SKIP: Cog elements already exist.");
    return;
  }

  const addAfterElement = [...document.querySelectorAll("div.CheckRun-search > details > details-menu > a")].pop();
  const showSkippedEle = createCogElement(addAfterElement, "show", true);
  const hideSkippedEle = createCogElement(showSkippedEle, "hide", false);
  debug("CHANGE: Cog elements added.");
}

function updateCogOptionsState() {
  const showButton = document.getElementById(`github-hide-skipped-jobs-steps-cog-setting-show`);
  const hideButton = document.getElementById(`github-hide-skipped-jobs-steps-cog-setting-hide`);
  if (showButton == null && hideButton == null) {
    debug("SKIP: Cog elements do not exist to update.");
    return;
  }

  if (showButton.hidden === thereAreVisibleSkippedJobs() && hideButton.hidden === !thereAreVisibleSkippedJobs()) {
    debug("SKIP: Cog elements are already in the correct state.");
    return;
  }

  if (!thereAreVisibleSkippedJobs()) {
    debug("Show the 'show' button when there are NO visible skipped jobs.")
  } else {
    debug("Show the 'hide' button when there *ARE** visible skipped jobs.")
  }
  showButton.hidden = thereAreVisibleSkippedJobs();
  hideButton.hidden = !thereAreVisibleSkippedJobs();
  debug("CHANGE: Cog elements updated.");
}

function init() {
  'use strict';

  debug('################################## USER SCRIPT STARTING ##################################');
  // Initially, we want to hide the skipped jobs.
  // window.localStorage.setItem(STORAGE_KEY_SHOULD_SHOW_SKIPPED_JOBS, false);
  hideSkippedJobs();

  new MutationObserver((mutationList, observer) => {
    debug('------------ application-main MUTATIONS FOUND. STARTING!!! ------------');
    addCogOptions();
    updateCogOptionsState();
    updateSkippedJobs()
    debug('------------ application-main MUTATIONS FOUND. COMPLETED!! ------------');
  }).observe(document.querySelector("div.application-main"), {attributes: true, childList: true, subtree: true})

  let keepCalling = true; // Flag to control the repeated calls
  const timeoutId = setTimeout(() => {
    keepCalling = false;
    debug("Flag set to false, stopping the interval");
  }, 10000);

  function startInterval() {
    const intervalId = setInterval(() => {
      if (keepCalling) {
        keepCalling = updateSkippedJobs();
      } else {
        debug("Clearing interval and timeout");
        clearInterval(intervalId);
        clearTimeout(timeoutId)
      }
    }, 500);
  }

  startInterval();
}

init();