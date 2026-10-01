import type { Loader, State } from '$lib/types';
import { defaultState, sanitizeConfig, updateCodeStore } from '$lib/util/state.svelte';
import { fetchText } from '$lib/util/util';
import { loadGistData } from './gist';
import { loadNoteData } from './notes';

const loaders: Record<string, Loader> = {
  gist: loadGistData,
  note: loadNoteData
};

export const loadDataFromUrl = async (): Promise<void> => {
  const searchParams = new URLSearchParams(window.location.search);
  let state: Partial<State> = defaultState;
  let loaded = false;
  const codeURL: string | undefined = searchParams.get('code') ?? undefined;
  const configURL: string | undefined = searchParams.get('config') ?? undefined;

  let code: string | undefined;
  const config = configURL ? await fetchText(configURL) : defaultState.mermaid;

  if (codeURL) {
    code = await fetchText(codeURL);
    loaded = true;
  }
  if (code) {
    if (!codeURL) {
      throw new Error('Code URL is not defined');
    }
    state = {
      code,
      loader: {
        config: {
          codeURL,
          configURL
        },
        type: 'files'
      },
      mermaid: config
    };
  } else {
    for (const [key, value] of searchParams.entries()) {
      if (key in loaders) {
        try {
          state = await loaders[key](value);
          loaded = true;
          break;
        } catch (error) {
          console.error(error);
          // Say so: a note with no mermaid block or an unreachable gist otherwise looks
          // exactly like a page that ignored the request.
          // Imported here, not at the top: this module is on the startup path, and the toast
          // library is only worth loading once something has actually gone wrong.
          const { notify } = await import('$lib/util/notify');
          notify(
            `Could not load from ${key}: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    }
  }
  if (loaded) {
    state.mermaid = sanitizeConfig(state.mermaid || defaultState.mermaid);
    updateCodeStore({
      ...state,
      updateDiagram: true
    });
  }
};
