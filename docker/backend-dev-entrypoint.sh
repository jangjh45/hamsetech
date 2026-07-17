#!/bin/sh
set -e

# Gradle's --continuous relies on native file-system watching, which Docker
# Desktop does not reliably forward for Windows bind-mounted volumes -- its
# up-to-date checks then never notice source changes either (confirmed: even
# plain `gradlew classes` kept reporting UP-TO-DATE after real edits). So we
# detect changes ourselves with `find -newer` (a plain stat check, which does
# see fresh mtimes correctly) and only then force a real recompile with
# --rerun-tasks. Recompiling unconditionally every cycle was tried first and
# made DevTools restart-and-crash in a loop even with no edits, since a full
# --rerun-tasks rewrite touches every class file on the classpath DevTools
# watches every single cycle.
MARKER=/tmp/.last-compile-marker
touch "$MARKER"

(
  while true; do
    sleep 3
    if [ -n "$(find src build.gradle settings.gradle -newer "$MARKER" -type f 2>/dev/null | head -1)" ]; then
      touch "$MARKER"
      ./gradlew classes --rerun-tasks -q --console=plain || true
    fi
  done
) &

exec ./gradlew bootRun -Pspring.profiles.active=dev
