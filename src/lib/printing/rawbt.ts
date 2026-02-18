const isAndroid = () => /Android/i.test(window.navigator.userAgent);

const toBase64Utf8 = (value: string) => {
  const encoded = encodeURIComponent(value).replace(/%([0-9A-F]{2})/g, (_, p1: string) =>
    String.fromCharCode(Number.parseInt(p1, 16))
  );
  return window.btoa(encoded);
};

export async function printRawBT(ticketText: string): Promise<void> {
  if (typeof window === 'undefined') {
    throw new Error('RawBT solo está disponible en el navegador.');
  }
  if (!isAndroid()) {
    throw new Error('La impresión RawBT requiere Android.');
  }

  const trimmed = ticketText.trim();
  if (!trimmed) {
    throw new Error('El ticket está vacío.');
  }

  const payload = toBase64Utf8(`${trimmed}\n`);
  const deeplink = `rawbt:base64,${payload}`;

  window.location.href = deeplink;

  await new Promise((resolve) => {
    window.setTimeout(resolve, 300);
  });
}
