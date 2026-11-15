// Bendras pagalbininkas žinutėms į background "API".
export async function call(type, payload) {
  const res = await chrome.runtime.sendMessage({ type, payload });
  if (!res) throw new Error('Nėra atsakymo iš plėtinio');
  if (!res.ok) throw new Error(res.error);
  return res.data;
}
