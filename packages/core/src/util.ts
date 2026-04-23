export function uuid() {
  const dateStr = Date.now().toString(16).padStart(12, '0');
  const randomStr = Math.random().toString(16).slice(2).padStart(12, '0');
  return [
    '2e87c0de',
    dateStr.slice(0, 4),
    dateStr.slice(4, 8),
    dateStr.slice(8, 12),
    randomStr.slice(-12),
  ].join('-');
}

export function clone<T extends object>(obj: T) {
  return structuredClone(obj);
}

export function singularize(word: string): string {
  if (word.endsWith('ies') && word.length > 3) return `${word.slice(0, -3)}y`;
  if (word.endsWith('sses') || word.endsWith('shes') || word.endsWith('ches')) {
    return word.slice(0, -2);
  }
  if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}
