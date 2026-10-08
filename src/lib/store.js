// Persistent state shared by popup and background.
//   profiles: [{ id, name, scheme, host, port, user, pass }]
//   activeId: id of the connected profile, or null for direct.
const DEFAULTS = { profiles: [], activeId: null };

export async function load() {
  return { ...DEFAULTS, ...(await chrome.storage.local.get(Object.keys(DEFAULTS))) };
}
export const save = (patch) => chrome.storage.local.set(patch);
export const newId = () => crypto.randomUUID();
