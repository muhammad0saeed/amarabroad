# amarAbroad (working name)

A Bangladesh-first study-abroad finder. Stage 1 is a private web preview running on **sample data**: every university, program, number and date in it is invented.

- Spec: [BRIEF.md](BRIEF.md)
- Plan and decisions: [PLAN.md](PLAN.md)

## Run it

Needs Node.js 20 or newer (built with Node 24).

```bash
npm install
npm run dev
```

Open http://localhost:3000. It forwards to `/en/` or `/bn/`.

### On your phone (same Wi-Fi)

```bash
npm run dev:phone
```

Find your PC's local address (run `ipconfig` and look for the IPv4 address, e.g. `192.168.0.105`), then open `http://192.168.0.105:3000` on the phone.

If the phone can't connect, Windows Firewall is blocking it:

1. In **Settings → Network & internet → Wi-Fi → your network**, set the network profile to **Private** (right for home Wi-Fi).
2. When Windows asks whether Node.js may use the network, allow it on **private** networks only.

## Check it

```bash
npm test          # unit tests (Vitest)
npm run typecheck # TypeScript
npm run lint      # ESLint
npm run build     # static site in /out
```

## Project layout

| Folder | What's in it |
| --- | --- |
| `app/` | Pages. Everything students see lives under `app/[locale]/` (`/en/...`, `/bn/...`) |
| `app/fonts/` | Self-hosted Inter and Noto Sans Bengali (SIL Open Font License) |
| `app/globals.css` | Design tokens: colors (light/dark), radius, type scale |
| `components/` | UI pieces |
| `lib/` | Logic: data access, Fit Score, conversions, storage |
| `messages/` | Every UI string, in `en.json` and `bn.json` |
| `i18n/` | Language routing |
| `tests/` | Unit tests |
| `design/references/` | Visual references |

Deploying to a password-protected Hostever subdomain and adding data are covered at the end of Stage 1.
