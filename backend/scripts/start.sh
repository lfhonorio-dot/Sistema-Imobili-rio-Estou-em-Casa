#!/bin/sh
# Mantido só por compatibilidade com configurações antigas do Railway/Nixpacks que
# apontam para scripts/start.sh. A lógica vive em um lugar só: ../start.sh
set -e
cd "$(dirname "$0")/.."
exec sh start.sh
