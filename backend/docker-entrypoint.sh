#!/bin/sh
# Runs as root (briefly) so it can align the "homelab" user with whatever
# GID the host's docker.sock actually has - that GID varies per host and
# isn't known at image build time - then drops to "homelab" for the actual
# process. Without this, a non-root container user almost never has
# permission to use a docker.sock bind-mounted from the host, since it
# belongs to the host's "docker" group with a GID the image can't predict.
set -e

if [ -S /var/run/docker.sock ]; then
  SOCK_GID="$(stat -c '%g' /var/run/docker.sock)"
  EXISTING_GROUP="$(getent group "$SOCK_GID" | cut -d: -f1 || true)"
  if [ -z "$EXISTING_GROUP" ]; then
    addgroup -g "$SOCK_GID" dockersock
    EXISTING_GROUP=dockersock
  fi
  adduser homelab "$EXISTING_GROUP" >/dev/null 2>&1 || true
fi

exec su-exec homelab "$@"
