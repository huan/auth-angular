#!/usr/bin/env bash
set -e

npm run ng:packagr

for folder in ~/chatie/{app,db}/node_modules/auth-angular/; do
  echo "Dist to $folder..."
  cp -Ra dist/* "$folder/"
done

