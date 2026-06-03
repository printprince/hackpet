/**
 * Склонение существительного по числу для русского языка.
 * @param {number} n — число
 * @param {[string, string, string]} forms — [1 «блок», 2 «блока», 5 «блоков»]
 * @returns {string} нужная форма слова
 */
export function pluralizeRu(n, [one, few, many]) {
  const abs = Math.abs(Number(n) || 0) % 100
  const tail = abs % 10
  if (abs > 10 && abs < 20) return many
  if (tail > 1 && tail < 5) return few
  if (tail === 1) return one
  return many
}
