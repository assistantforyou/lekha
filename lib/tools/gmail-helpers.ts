export type Headers = Record<string, string>;

export function headerMap(headers: { name?: string | null; value?: string | null }[] | undefined): Headers {
  const out: Headers = {};
  for (const h of headers ?? []) {
    if (h.name && h.value) out[h.name.toLowerCase()] = h.value;
  }
  return out;
}
