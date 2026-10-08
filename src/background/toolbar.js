import { labelOf } from "../shared/profile.js";

const SIZES = [16, 32, 48, 128];
// Absolute URLs: relative paths resolve against this script (src/background/), not the extension root.
const icons = (variant) =>
  Object.fromEntries(SIZES.map((n) => [n, chrome.runtime.getURL(`icons/${variant}-${n}.png`)]));

const COLOR = { live: "#2ee6c0", fault: "#ff5d73", ink: "#04110d" };

/**
 * Reflect the connection in the toolbar: icon, badge, tooltip.
 * @param {import("../shared/profile.js").Profile | null} profile  Connected profile, if any.
 * @param {string | null} fault
 */
export async function render(profile, fault) {
  const view = fault
    ? { icon: "off", badge: "!", color: COLOR.fault, title: `KiloProxy: ${fault}` }
    : profile
      ? { icon: "on", badge: "ON", color: COLOR.live, title: `KiloProxy: ${labelOf(profile)}` }
      : { icon: "off", badge: "", color: COLOR.live, title: "KiloProxy: direct" };

  await Promise.all([
    chrome.action.setIcon({ path: icons(view.icon) }),
    chrome.action.setBadgeText({ text: view.badge }),
    chrome.action.setBadgeBackgroundColor({ color: view.color }),
    chrome.action.setBadgeTextColor?.({ color: COLOR.ink }),
    chrome.action.setTitle({ title: view.title }),
  ]);
}
