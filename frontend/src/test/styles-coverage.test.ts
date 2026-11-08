import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Regression guard: commit 4ccccfb emptied global.css and every screen rendered unstyled while the tests stayed green.
const sourceRoot = join(__dirname, '..');
const stylesRoot = join(sourceRoot, 'styles');
const accessRoot = join(sourceRoot, 'features', 'access');

// Minimum number of rules per stylesheet; a truncated or emptied file falls far below these.
const STYLESHEETS: Record<string, number> = { 'global.css': 150, 'kiosk.css': 40, 'ventanilla.css': 40 };

/** Classes that are never matched by a `.class` selector on purpose. Keep this list short. */
const ALLOWED_WITHOUT_RULE = new Set<string>([
  // None today: purely dynamic variants are listed in DYNAMIC_CLASSES and must have a rule.
]);

function readStyles(): Record<string, string> {
  return Object.fromEntries(Object.keys(STYLESHEETS).map((name) => [name, readFileSync(join(stylesRoot, name), 'utf8')]));
}

function listComponentFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return listComponentFiles(path);
    return extname(path) === '.tsx' && !/\.test\.tsx$/.test(path) ? [path] : [];
  });
}

/** Every class token written as a literal in `className="..."` or in the static parts of a template literal. */
function classNamesIn(source: string): string[] {
  const found: string[] = [];
  for (const match of source.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
    const text = match[1] ?? match[2] ?? '';
    // Dynamic suffixes (`name--${state}`) are expanded by the test below, so only complete tokens are collected here.
    for (const token of text.replace(/\$\{[^}]*\}/g, ' ').split(/\s+/)) {
      if (token !== '' && !token.endsWith('--')) found.push(token);
    }
  }
  return found;
}

/** Dynamic variants that the components build at run time; each one must have a rule too. */
const DYNAMIC_CLASSES = [
  'door-card__link--on',
  'door-card__link--off',
  'entries-card__chip--green',
  'entries-card__chip--yellow',
  'entries-card__chip--red',
];

describe('stylesheets', () => {
  const styles = readStyles();

  it.each(Object.entries(STYLESHEETS))('%s is not empty and keeps a sensible number of rules', (name, minimum) => {
    const css = styles[name]!;
    expect(css.trim().length).toBeGreaterThan(0);
    const rules = (css.match(/\{/g) ?? []).length;
    expect(rules).toBeGreaterThanOrEqual(minimum);
  });

  it('defines a selector for every class used by the access screens', () => {
    const allCss = Object.values(styles).join('\n');
    const selectors = new Set([...allCss.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((match) => match[1]!));

    const used = new Set(listComponentFiles(accessRoot).flatMap((file) => classNamesIn(readFileSync(file, 'utf8'))));
    DYNAMIC_CLASSES.forEach((name) => used.add(name));

    const missing = [...used].filter((name) => !selectors.has(name) && !ALLOWED_WITHOUT_RULE.has(name)).sort();
    expect(missing).toEqual([]);
  });
});
