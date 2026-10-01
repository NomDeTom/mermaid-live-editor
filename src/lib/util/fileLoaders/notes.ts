import type { State } from '$lib/types';
import { env } from '$lib/util/env';
import { defaultState } from '$lib/util/state.svelte';

// SilverBullet keeps every page as a Markdown file and serves it raw at
// `<space>/.fs/<page>.md`, on the same origin as this app on the Irate-Box hub. A diagram in
// a note is an ordinary fenced block:
//
//     ```mermaid
//     flowchart LR
//       A --> B
//     ```
//
// `?note=<page>` loads the first such block, `?note=<page>#2` the second, and so on.

const MERMAID_BLOCK = /^(`{3,}|~{3,})\s*mermaid\b[^\n]*\n([\s\S]*?)^\1\s*$/gm;

export interface NotePage {
  name: string;
  lastModified: number;
}

const pageURL = (page: string): string =>
  `${env.notesUrl}/.fs/${page.split('/').map(encodeURIComponent).join('/')}.md`;

/** Every Mermaid block in a Markdown document, in order. */
export const mermaidBlocks = (markdown: string): string[] =>
  [...markdown.matchAll(MERMAID_BLOCK)].map((match) => match[2].replace(/\n$/, ''));

/** Pages in the SilverBullet space, newest first. Hidden files and folders are skipped. */
export const listNotePages = async (): Promise<NotePage[]> => {
  const response = await fetch(`${env.notesUrl}/.fs`);
  if (!response.ok) {
    throw new Error(`notes: ${response.status}`);
  }
  const files = (await response.json()) as { name: string; lastModified: number }[];
  return files
    .filter((f) => f.name.endsWith('.md') && !f.name.split('/').some((p) => p.startsWith('.')))
    .map((f) => ({ name: f.name.slice(0, -3), lastModified: f.lastModified }))
    .sort((a, b) => b.lastModified - a.lastModified);
};

export const loadNoteData = async (note: string): Promise<State> => {
  const [page, index] = note.split('#');
  const response = await fetch(pageURL(page));
  if (!response.ok) {
    throw new Error(`notes: ${page}: ${response.status}`);
  }
  const blocks = mermaidBlocks(await response.text());
  const n = Math.max(1, Number(index) || 1);
  const code = blocks[n - 1];
  if (code === undefined) {
    throw new Error(
      blocks.length
        ? `notes: ${page} has ${blocks.length} mermaid block(s), not ${n}`
        : `notes: ${page} has no mermaid block`
    );
  }
  return {
    ...defaultState,
    code,
    loader: { type: 'files', config: { codeURL: pageURL(page) } }
  };
};
