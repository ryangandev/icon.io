#!/usr/bin/env node
// Builds Daily Word's two word lists in shared/ from their sources.
//
//   node tools/daily-word-words/build.mjs --enable enable1.txt --scowl scowl-2020.12.07/final [--new-answers]
//
// Sources, downloaded by hand (they are not kept in the repository):
// - ENABLE, public domain: https://github.com/dolph/dictionary (enable1.txt).
// - SCOWL 2020.12.07, (c) Kevin Atkinson and others, under a permissive
//   licence (kept in shared/daily-word-answers.ts):
//   https://downloads.sourceforge.net/wordlist/scowl-2020.12.07.tar.gz, whose
//   `final/` folder is the --scowl argument.
//
// shared/daily-word-guesses.ts is generated output: every five-letter ENABLE
// word, plus every answer. It is written on every run.
//
// shared/daily-word-answers.ts is the calendar of daily words, in puzzle order,
// so it is written only once, with --new-answers; afterwards it is data, and a
// later run only checks that every answer is still a valid guess. Changing its
// order would change the word of every day to come (docs/games/daily-word.md).
//
// Needs a Node that runs TypeScript (23.6 or later), for shared/seed.ts.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { seededRandom } from '../../shared/seed.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const answersFile = join(root, 'shared', 'daily-word-answers.ts');
const guessesFile = join(root, 'shared', 'daily-word-guesses.ts');

const { values } = parseArgs({
  options: {
    enable: { type: 'string' },
    scowl: { type: 'string' },
    'new-answers': { type: 'boolean', default: false },
  },
});
if (!values.enable || (values['new-answers'] && !values.scowl)) {
  console.error(
    'Usage: build.mjs --enable enable1.txt [--scowl scowl/final --new-answers]',
  );
  process.exit(2);
}

const FIVE = /^[a-z]{5}$/;
const enable = new Set(
  readFileSync(values.enable, 'utf8')
    .split(/\r?\n/)
    .map((word) => word.trim()),
);

/** SCOWL's common words: sizes 10 to 35, American and shared spellings. */
const SCOWL_LISTS = ['english-words', 'american-words'].flatMap((list) =>
  [10, 20, 35].map((size) => `${list}.${size}`),
);

/** Singular words that look like a plural or a past tense of a shorter word. */
const NOT_INFLECTED = new Set([
  'chaos',
  'genus',
  'kudos',
  'breed',
  'greed',
  'tweed',
]);

/**
 * Common words that make a poor answer: slurs and crude or sexual words, odd
 * comparatives and participles, plurals SCOWL lists as words, and rarities.
 * They stay valid guesses.
 */
const NOT_ANSWERS = new Set(
  `abler apter aping awing barer baser bawdy bitch bluer booby booty buxom
  cacti chink coyer cuing dimer direr edger eking enema fagot feces fiche gayer
  genii gimme haler harem horny huger icier infix kinky lamer laxer liker lynch
  maria muter nappy nuder oases octal pansy penis peter prick pussy queer radii
  rawer rifer ruing sager semen shyer sissy sizer slier sorer spank sperm spunk
  unman unsay unset urine uteri viler weest whore wryer`.split(/\s+/),
);

/** BOATS for BOAT, BOXES for BOX, BAKED for BAKE, CRIED for CRY. */
const isInflected = (word) => {
  if (NOT_INFLECTED.has(word)) return false;
  if (word.endsWith('s') && !word.endsWith('ss')) {
    if (enable.has(word.slice(0, -1))) return true;
    if (word.endsWith('es') && enable.has(word.slice(0, -2))) return true;
    if (word.endsWith('ies') && enable.has(`${word.slice(0, -3)}y`))
      return true;
  }
  if (word.endsWith('ed')) {
    if (enable.has(word.slice(0, -2)) || enable.has(word.slice(0, -1)))
      return true;
    if (word[2] === word[1] && enable.has(word.slice(0, 2))) return true;
    if (word.endsWith('ied') && enable.has(`${word.slice(0, -3)}y`))
      return true;
  }
  return false;
};

const newAnswers = () => {
  const common = new Set();
  for (const list of SCOWL_LISTS) {
    for (const line of readFileSync(join(values.scowl, list), 'latin1').split(
      /\r?\n/,
    )) {
      const word = line.trim();
      if (FIVE.test(word) && enable.has(word)) common.add(word);
    }
  }
  const answers = [...common]
    .filter((word) => !isInflected(word) && !NOT_ANSWERS.has(word))
    .toSorted();
  // A fixed shuffle, so the calendar is not alphabetical.
  const random = seededRandom(20261005);
  for (let i = answers.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [answers[i], answers[j]] = [answers[j], answers[i]];
  }
  return answers;
};

/** Ten words to a line, so a diff of the list stays readable. */
const wordLines = (words) => {
  const lines = [];
  for (let i = 0; i < words.length; i += 10)
    lines.push(words.slice(i, i + 10).join(' '));
  return lines.join('\n');
};

const SCOWL_NOTICE = `Copyright 2000-2018 by Kevin Atkinson

  Permission to use, copy, modify, distribute and sell these word
  lists, the associated scripts, the output created from the scripts,
  and its documentation for any purpose is hereby granted without fee,
  provided that the above copyright notice appears in all copies and
  that both that copyright notice and this permission notice appear in
  supporting documentation. Kevin Atkinson makes no representations
  about the suitability of this array for any purpose. It is provided
  "as is" without express or implied warranty.`;

let answers;
if (values['new-answers']) {
  answers = newAnswers();
  writeFileSync(
    answersFile,
    `/**
 * Daily Word's answers, in puzzle order: puzzle n is entry n - 1, and the list
 * starts again after the last. This is the calendar of daily words, so it is
 * data rather than generated output: never reorder or remove an entry, or every
 * day after it changes. A word found unfit is replaced in place by another
 * (docs/games/daily-word.md#word-lists).
 *
 * Made once by tools/daily-word-words/build.mjs: the five-letter words of SCOWL
 * 2020.12.07 up to size 35 (http://wordlist.aspell.net/) that are also in
 * ENABLE, without plurals, past tenses and a short list of words unfit to be an
 * answer, in a fixed shuffle. SCOWL's notice, which its licence asks to keep:
 *
${SCOWL_NOTICE.split('\n')
  .map((line) => ` * ${line}`.trimEnd())
  .join('\n')}
 *
 * SCOWL is built in part from the Moby Words II lists and from ENABLE, both
 * placed in the public domain, and from other sources listed in its Copyright
 * file under similar terms.
 */
export const ANSWERS: readonly string[] = \`
${wordLines(answers)}
\`
  .trim()
  .split(/\\s+/);
`,
  );
} else {
  if (!existsSync(answersFile)) {
    console.error('No answer list yet: run with --scowl and --new-answers.');
    process.exit(2);
  }
  const source = readFileSync(answersFile, 'utf8');
  answers = source
    .slice(source.indexOf('`') + 1, source.lastIndexOf('`'))
    .trim()
    .split(/\s+/);
}

const guesses = new Set([...enable].filter((word) => FIVE.test(word)));
const unlisted = answers.filter((word) => !guesses.has(word));
if (unlisted.length > 0)
  console.warn(
    `Answers not in ENABLE, added as guesses: ${unlisted.join(' ')}`,
  );
for (const word of answers) guesses.add(word);

writeFileSync(
  guessesFile,
  `/**
 * Every word Daily Word accepts as a guess. Generated by
 * tools/daily-word-words/build.mjs; do not edit by hand.
 *
 * The five-letter words of ENABLE, the Enhanced North American Benchmark
 * Lexicon (https://github.com/dolph/dictionary), which is in the public domain,
 * plus every answer in daily-word-answers.ts.
 */
export const GUESSES: readonly string[] = \`
${wordLines([...guesses].toSorted())}
\`
  .trim()
  .split(/\\s+/);
`,
);

console.log(`${answers.length} answers, ${guesses.size} valid guesses.`);
