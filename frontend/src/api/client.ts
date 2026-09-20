let csrfToken: string | null = null;

export function setCsrfToken(token: string | null) {
  csrfToken = token;
}

// Backend error codes -> French messages for toasts/forms. Unknown codes are
// shown as-is so a new backend error is never hidden.
const ERROR_MESSAGES: Record<string, string> = {
  unauthenticated: "Session expirée, reconnectez-vous",
  invalid_credentials: "E-mail ou mot de passe incorrect",
  invalid_input: "Données invalides",
  insufficient_role: "Droits insuffisants pour cette action",
  csrf_token_invalid: "Session invalide, rechargez la page",
  not_found: "Élément introuvable",
  unknown_action: "Action inconnue",
  email_already_exists: "Cet e-mail est déjà utilisé",
  cannot_delete_self: "Vous ne pouvez pas supprimer votre propre compte",
  cannot_delete_last_admin: "Impossible de supprimer le dernier administrateur",
  cannot_demote_last_admin: "Impossible de rétrograder le dernier administrateur",
  backup_not_found: "Sauvegarde introuvable",
  trigger_url_not_allowed: "Cette URL de déclenchement n’est pas autorisée",
  invalid_guest_target: "Cible de VM/LXC invalide",
  missing_target_ref: "Référence de la cible manquante",
  missing_trigger_url: "URL de déclenchement manquante",
  docker_unavailable: "Docker n’est pas disponible",
  proxmox_unavailable: "Proxmox n’est pas configuré",
  truenas_unavailable: "TrueNAS n’est pas configuré",
  adguard_unavailable: "AdGuard n’est pas configuré",
  home_assistant_unavailable: "Home Assistant n’est pas configuré",
  too_many_requests: "Trop de tentatives, réessayez plus tard",
};

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method) && csrfToken) {
    headers.set("x-csrf-token", csrfToken);
  }

  const res = await fetch(`/api${path}`, {
    ...init,
    method,
    headers,
    credentials: "include",
  });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      message = ERROR_MESSAGES[body.error] ?? body.error ?? message;
    } catch {
      // ignore parse failure
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
