// Best-effort Docker Hub update check (section 39). Only Docker Hub is
// supported - other registries (ghcr.io, lscr.io, private registries) each
// have their own auth scheme, so those images are reported as
// "undetermined" rather than guessed at.

interface ParsedImage {
  isDockerHub: boolean;
  repo: string; // e.g. "library/nginx" or "grafana/grafana"
  tag: string;
}

export function parseImageRef(image: string): ParsedImage {
  const [namePart, tagPart] = image.split(/:(?=[^/]*$)/);
  const tag = tagPart || "latest";
  const segments = namePart.split("/");

  const firstSegmentLooksLikeRegistry = segments.length > 1 && (segments[0].includes(".") || segments[0].includes(":") || segments[0] === "localhost");
  if (firstSegmentLooksLikeRegistry) {
    return { isDockerHub: false, repo: namePart, tag };
  }

  const repo = segments.length === 1 ? `library/${segments[0]}` : namePart;
  return { isDockerHub: true, repo, tag };
}

const tokenCache = new Map<string, { token: string; expiresAt: number }>();

async function getAuthToken(repo: string): Promise<string> {
  const cached = tokenCache.get(repo);
  if (cached && Date.now() < cached.expiresAt) return cached.token;

  const url = `https://auth.docker.io/token?service=registry.docker.io&scope=repository:${repo}:pull`;
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`docker hub auth http ${res.status}`);
  const data = (await res.json()) as { token: string; expires_in?: number };
  tokenCache.set(repo, { token: data.token, expiresAt: Date.now() + (data.expires_in ?? 300) * 1000 });
  return data.token;
}

export async function getRemoteDigest(repo: string, tag: string): Promise<string | null> {
  try {
    const token = await getAuthToken(repo);
    const res = await fetch(`https://registry-1.docker.io/v2/${repo}/manifests/${tag}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: [
          "application/vnd.docker.distribution.manifest.v2+json",
          "application/vnd.docker.distribution.manifest.list.v2+json",
          "application/vnd.oci.image.index.v1+json",
          "application/vnd.oci.image.manifest.v1+json",
        ].join(", "),
      },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    return res.headers.get("docker-content-digest");
  } catch {
    return null;
  }
}
