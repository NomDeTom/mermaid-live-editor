export const env = {
  analyticsUrl: import.meta.env.MERMAID_ANALYTICS_URL ?? '',
  docsUrl: import.meta.env.MERMAID_DOCS_URL ?? 'https://mermaid.js.org',
  domain: import.meta.env.MERMAID_DOMAIN ?? '',
  // 'true': exported SVGs reference this build's own copy of Font Awesome, not cdnjs
  fontAwesomeLocal: import.meta.env.MERMAID_FONT_AWESOME_LOCAL === 'true',
  // GitHub-compatible gist API. A local service speaking the same API can stand in.
  gistApiUrl: import.meta.env.MERMAID_GIST_API_URL || 'https://api.github.com',
  hidePrivacyPolicy: import.meta.env.MERMAID_HIDE_PRIVACY_POLICY === 'true',
  hubReturnScript: import.meta.env.MERMAID_HUB_RETURN_SCRIPT ?? '',
  isEnabledMermaidChartLinks: import.meta.env.MERMAID_IS_ENABLED_MERMAID_CHART_LINKS === 'true',
  krokiRendererUrl: import.meta.env.MERMAID_KROKI_RENDERER_URL ?? '',
  // A SilverBullet space on the same origin (e.g. '/notes' on the Irate-Box hub). Empty: off.
  notesUrl: import.meta.env.MERMAID_NOTES_URL ?? '',
  privacyPolicyUrl: import.meta.env.MERMAID_PRIVACY_POLICY_URL ?? '',
  rendererUrl: import.meta.env.MERMAID_RENDERER_URL ?? ''
} as const;

export const MCBaseURL = env.isEnabledMermaidChartLinks
  ? 'https://mermaid.ai' // 'http://localhost:5174'
  : 'https://example.com';
