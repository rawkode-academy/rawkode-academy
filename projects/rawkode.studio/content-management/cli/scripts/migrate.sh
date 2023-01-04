#!/usr/bin/env sh
for f in /migrations/*/up.sql
do
  psql --username academy --password academy --dbname academy -f $f
done
