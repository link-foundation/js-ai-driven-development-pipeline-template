---
'@link-foundation/example-package-name': patch
---

Harden the `publish-dockerhub` buildx boot against transient Docker Hub registry outages. A new reusable `setup-buildx-resilient` composite action pre-pulls the pinned `moby/buildkit` image with retries and a `mirror.gcr.io` pull-through fallback, then boots buildx with the driver image pinned to the locally cached copy so a `registry-1.docker.io` blip no longer fails the publish job (issue #75).
