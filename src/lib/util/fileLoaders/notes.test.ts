import { describe, expect, it } from 'vitest';
import { mermaidBlocks } from './notes';

describe('mermaidBlocks', () => {
  it('finds every mermaid block in order and ignores other fences', () => {
    const md = [
      '# Page',
      '```js',
      'console.log(1)',
      '```',
      '```mermaid',
      'flowchart LR',
      '  A --> B',
      '```',
      'text',
      '~~~mermaid',
      'sequenceDiagram',
      '  A->>B: hi',
      '~~~'
    ].join('\n');
    expect(mermaidBlocks(md)).toEqual(['flowchart LR\n  A --> B', 'sequenceDiagram\n  A->>B: hi']);
  });

  it('needs the same fence to close, so inner ``` survives a ```` block', () => {
    const md = ['````mermaid', 'graph TD', '%% ```', '  X --> Y', '````'].join('\n');
    expect(mermaidBlocks(md)).toEqual(['graph TD\n%% ```\n  X --> Y']);
  });

  it('returns nothing for a page without diagrams', () => {
    expect(mermaidBlocks('just text\n```\nplain\n```')).toEqual([]);
  });
});
