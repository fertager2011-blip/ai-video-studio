# AI Video Studio API — initial backend

This is the first server foundation. It provides:
- health check at `GET /health`;
- token-protected project listing and details;
- token-protected multipart video upload;
- SQLite project metadata and source-file storage;
- configurable upload size, CORS origin, token and persistent data directory.

## Important current limitations

This API does **not** analyze, segment, edit, render or export videos. It only receives and stores source videos and project metadata. Do not describe a project as being processed until the processing pipeline is implemented.

## Deployment requirements

Deploy this directory as a Docker web service on a host that supports:
- persistent disk storage mounted at `/app/data`;
- HTTPS;
- environment variables from `.env.example`;
- a long random `AIVS_API_TOKEN` secret.

Set `AIVS_ALLOWED_ORIGINS` to the exact HTTPS origin hosting the PWA. Do not commit a real token to GitHub and do not put it into public frontend source code.

After deployment, verify `https://YOUR_API_HOST/health`. The PWA has not yet been connected to this API.

## Local run

From this directory:

```bash
python -m venv .venv
# Windows: .venv\\Scripts\\activate
# Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
# Set AIVS_API_TOKEN and other environment variables before starting.
uvicorn main:app --host 127.0.0.1 --port 8000
```

API documentation is available at `/docs` while the service is running.


## Deployment scaffold
See `DEPLOYMENT.md` for the prepared Docker Compose + Caddy HTTPS deployment steps. This scaffold is not deployed yet and does not enable AI processing.
