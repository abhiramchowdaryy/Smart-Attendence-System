# Installed Skills — Provenance

A lean, non-overlapping set of vendored skills tuned for this project's stack
(Next.js 15 · React 19 · TypeScript · Tailwind · shadcn/ui · Supabase · face-api).

| Skill | Source | Purpose |
|---|---|---|
| `next-best-practices` | laguagu/claude-code-nextjs-skills | App Router / RSC correctness |
| `react-best-practices` | laguagu/claude-code-nextjs-skills | React 19 performance |
| `cache-components` | laguagu/claude-code-nextjs-skills | Next.js caching / PPR |
| `nextjs-shadcn` | laguagu/claude-code-nextjs-skills | Build shadcn UIs |
| `shadcn` | laguagu/claude-code-nextjs-skills | Manage shadcn components |
| `supabase-postgres-best-practices` | laguagu/claude-code-nextjs-skills | Supabase / Postgres |
| `chrome-devtools` | laguagu/claude-code-nextjs-skills | Live browser debugging (camera / face-api) |
| `web-design-guidelines` | laguagu/claude-code-nextjs-skills | UI + accessibility review |
| `skill-creator` | laguagu/claude-code-nextjs-skills | Author / maintain skills |
| `ui-ux-design-pro` | saifyxpro/ui-ux-design-pro-skill | Premium UI/UX design + audit |
| `ui-animation` | mblode/agent-skills | Motion (framer-motion / gsap) |

Sources (pinned commits):
- laguagu/claude-code-nextjs-skills @ `685528272621c81514c1d7df947db7062ab14422` (MIT)
- saifyxpro/ui-ux-design-pro-skill @ `7c98f97767f00dee333635c59c42e9db229f6a1f`
- mblode/agent-skills @ `0d720d0c8185f86115b0808a1f011776bcf9f3de`

Notes:
- `ui-ux-pro-max` is enabled separately at the **account level**
  ([nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill))
  and is the primary design-generation skill — not vendored here.
- Trimmed from an earlier 48-skill set: removed AI-SDK/chatbot/vector-search,
  hetzner, openai-agents, SEO, PR-workflow, scaffolding, and duplicate
  design/audit skills that overlapped with the above or the account-level skill.
- These are agent instruction sets, not runtime dependencies. Review before relying on them.
