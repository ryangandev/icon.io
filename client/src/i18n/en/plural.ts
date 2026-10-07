/** "1 round", "2 rounds". */
export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six'];

/** "Four", for the start of a sentence; past six, the number. */
export function countWord(count: number): string {
  return WORDS[count] ?? String(count);
}
