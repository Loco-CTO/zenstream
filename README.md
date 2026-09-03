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

## How it fits together

ZenStream has one Orchestrator backend and two clients:

- [Web client](https://github.com/Loco-CTO/zenstream)
- [Android client](https://github.com/Loco-CTO/zenstream-mobile)
- [Orchestrator](https://github.com/Loco-CTO/zenstream-orchestrator)

## Configuration

For local development, copy `.env.example` to `.env.local`.

- `NEXT_PUBLIC_ZSO_URL`: URL of the Orchestrator. This value is embedded when the web client is built.
- `ZENSTREAM_PORT`: Docker host port. It defaults to `9086`.

For Docker, copy `.env.example` to `.env` and set `NEXT_PUBLIC_ZSO_URL` before building. Do not commit environment files or secrets.

## Development

Start the Orchestrator first. Requires Node.js and pnpm.

```sh
pnpm install
pnpm dev
```

## Deployment

For Docker Compose deployment, copy `.env.example` to `.env`, set `NEXT_PUBLIC_ZSO_URL`, and run:

```sh
docker compose up -d --build
```

The web client is available at `http://localhost:9086` by default. Stop it with `docker compose down`.

## Checks

```sh
pnpm format:check
pnpm lint
pnpm test
pnpm build
```

## Troubleshooting

- If the web client cannot reach the Orchestrator, check `NEXT_PUBLIC_ZSO_URL` and rebuild the Docker image after changing it.
- For browser or CORS errors, configure the Orchestrator's `ZENSTREAM_PUBLIC_WEB_URL` or `CORS_ORIGINS` for the web origin.

## Releases

Tagged web releases are available on [GitHub Releases](https://github.com/Loco-CTO/zenstream/releases).

## License

AGPL-3.0-or-later. See [LICENSE](LICENSE).
