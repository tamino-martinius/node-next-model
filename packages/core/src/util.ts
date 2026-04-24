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

function tokenize(str: string): string[] {
  return str
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/[_\-\s]+/g, ' ')
    .trim()
    .split(' ')
    .filter((s) => s.length > 0)
    .map((s) => s.toLowerCase());
}

export function camelize(str: string): string {
  const parts = tokenize(str);
  if (parts.length === 0) return '';
  return (
    parts[0] +
    parts
      .slice(1)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join('')
  );
}

export function pascalize(str: string): string {
  return tokenize(str)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
}
