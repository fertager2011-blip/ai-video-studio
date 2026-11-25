# AI Video Studio API — deployment checklist (VPS)

This deployment scaffold is prepared, but it is **not deployed**. A VPS, domain name, and provider account are still required. Do not rent a GPU for this stage.

## What this stack runs
- FastAPI API container
- Caddy reverse proxy with automatic HTTPS certificates
- Persistent Docker volume for uploaded videos and SQLite database
- HTTP health check for the API container

## Before deployment
1. Choose a VPS provider and a basic Linux VPS (2 vCPU / 2–4 GB RAM is a reasonable starting point for upload-only testing; no GPU needed).
2. Buy or configure a domain and create an A record pointing to the VPS IP.
3. Open inbound ports 80 and 443 in the provider firewall. SSH should be restricted.
4. Install Docker Engine and the Compose plugin on the VPS.
5. Copy the `backend` directory to the server.
6. Copy `.env.example` to `.env` and fill in:
   - `DOMAIN`: the DNS name for the API (e.g. api.example.com)
   - `ACME_EMAIL`: email for HTTPS certificate registration
   - `AIVS_API_TOKEN`: a long random secret; never commit or expose it in the PWA
   - `AIVS_ALLOWED_ORIGINS`: exact PWA origin, currently `https://fertager2011-blip.github.io`
7. Start the stack from this directory: `docker compose up -d --build`
8. Confirm container status: `docker compose ps`
9. Test the health endpoint in a browser: `https://DOMAIN/health`. Expected JSON contains `ok: true`.
10. Review disk capacity and upload retention. Uploaded originals are persistent and currently have no automatic deletion policy.

## Security and cost notes
- Do not publish `.env` or the API token in GitHub or frontend code.
- The API has token-protected project endpoints; `/health` is intentionally public and returns service status only.
- Only ports 80/443 are published by Compose. API port 8000 is internal to the Docker network.
- Use persistent storage and backups before storing valuable footage.
- Uploads are not processed yet; this is intake/storage only.
- Stop/remove services only after understanding persistent volume implications. Docker volumes hold uploaded video and database.
- The 500 MB limit is enforced by the API. Caddy also caps request bodies at 500 MB.

## Environment file
Use the updated `.env.example` as a template. Do not put real values in the tracked template.
