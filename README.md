<div align="center">
  <a href="./public/icon.png">
    <img src="./public/icon.png" alt="Logo" width="120" height="120">
  </a>
  <h3 align="center">ZenStream Web</h3>
  <p align="center">
    A web client for <a href="https://github.com/Loco-CTO/zenstream">ZenStream</a>.
    <br />
    <br />
    <a href="https://github.com/Loco-CTO/zenstream/issues">Submit Issues</a>
    ·
    <a href="https://github.com/Loco-CTO/zenstream/releases">Releases</a>
  </p>
</div>

<div align="center">

[![GitHub Forks](https://img.shields.io/github/forks/Loco-CTO/zenstream.svg?style=for-the-badge)](https://github.com/Loco-CTO/zenstream)
[![GitHub Stars](https://img.shields.io/github/stars/Loco-CTO/zenstream.svg?style=for-the-badge)](https://github.com/Loco-CTO/zenstream)
[![License](https://img.shields.io/github/license/Loco-CTO/zenstream.svg?style=for-the-badge)](https://github.com/Loco-CTO/zenstream/blob/main/LICENSE)
[![Github Watchers](https://img.shields.io/github/watchers/Loco-CTO/zenstream.svg?style=for-the-badge)](https://github.com/Loco-CTO/zenstream)

</div>

## Configuration

Copy `.env.example` to `.env.local` for development and set `NEXT_PUBLIC_ZSO_URL` to the Orchestrator URL. For Docker, copy `.env.example` to `.env`; `ZENSTREAM_PORT` controls the host port and defaults to `9086`.

## Development

Requires Node.js and pnpm.

```sh
pnpm install
pnpm dev
```

## Deployment

For Docker Compose deployment, set `NEXT_PUBLIC_ZSO_URL` in `.env` and run:

```sh
docker compose up -d --build
```

The web client is available at `http://localhost:9086` by default.

## License

AGPL-3.0-or-later. See [LICENSE](LICENSE).
