#!/usr/bin/env bash
set -euo pipefail

apt-get update
apt-get install -y curl wget gnupg software-properties-common build-essential jq

pip install --upgrade pip uv ruff mypy

curl -sSL https://raw.githubusercontent.com/sigstore/cosign/main/install.sh | COSIGN_INSTALL_DIR=/usr/local/bin sh

curl -L -o /usr/local/bin/opa https://openpolicyagent.org/downloads/latest/opa_linux_amd64
chmod +x /usr/local/bin/opa

curl -L -o /usr/local/bin/otelcol https://github.com/open-telemetry/opentelemetry-collector-releases/releases/latest/download/otelcol_linux_amd64
chmod +x /usr/local/bin/otelcol
