const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isValidUUID(str: string): boolean {
  return UUID_RE.test(str)
}

/**
 * PostgREST `.or()` filtresine interpolasyon yapılacak kullanıcı girdisini
 * temizler. `,()*%\` karakterleri filter syntax'ini bozabildiğinden atılır,
 * uzunluk sınırlanır. Sonuç boş olabilir — çağıran kontrol etmeli.
 */
export function sanitizeOrFilter(raw: string, maxLength = 100): string {
  return raw.replace(/[,()*%\\]/g, '').slice(0, maxLength)
}
