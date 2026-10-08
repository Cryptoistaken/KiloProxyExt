const SVG = "http://www.w3.org/2000/svg";

/** `querySelector` that throws on a miss, so a typo fails loudly. */
export function $(selector, root = document) {
  const element = root.querySelector(selector);
  if (!element) throw new Error(`Missing element: ${selector}`);
  return element;
}

/** An inline icon from the sprite in index.html. */
export function icon(name) {
  const svg = document.createElementNS(SVG, "svg");
  const use = document.createElementNS(SVG, "use");
  svg.setAttribute("class", "icon");
  use.setAttribute("href", `#${name}`);
  svg.append(use);
  return svg;
}
