#!/usr/bin/env sh
for f in /migrations/*/up.sql
do
  psql --username academy --password academy -f $f
done
