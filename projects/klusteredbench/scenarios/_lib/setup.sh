# Healthy baseline: the Klustered quotes app (v1) backed by Postgres, exposed
# on NodePort 30000. Every scenario starts from this unless it ships its own
# setup.sh. The script proves the app is green before returning so a failing
# verify after `break` is attributable to the break alone.
set -euo pipefail

kubectl apply -f - <<'YAML'
apiVersion: v1
kind: ConfigMap
metadata:
  name: postgresql
data:
  init.sh: |
    #!/bin/bash
    set -e
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
        CREATE TABLE IF NOT EXISTS quotes (
            quote VARCHAR ( 5000 ) UNIQUE NOT NULL,
            author VARCHAR ( 500 ) NOT NULL,
            link VARCHAR ( 512 ) NOT NULL
        );
        INSERT INTO quotes (quote, author, link)
        VALUES
            ('May your bag be bountiful and your success be great. p.s. you''re v smart and hot', 'Stephen Augustus', 'https://twitter.com/stephenaugustus/status/1372193744078958595'),
            ('Fight for your limits and sure enough their yours', 'Duffie''s Mom', 'https://twitter.com/mauilion/status/1373485025585340418'),
            ('Productivity does not determine your value. You have value in just being you.', 'Katy Farmer', 'https://twitter.com/TheKaterTot/status/1370511659677089794');
    EOSQL
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: database
spec:
  replicas: 1
  strategy:
    type: Recreate
  selector:
    matchLabels:
      app: postgresql
  template:
    metadata:
      labels:
        app: postgresql
    spec:
      volumes:
      - name: init
        configMap:
          name: postgresql
      containers:
      - name: postgresql
        image: postgres:16
        volumeMounts:
        - mountPath: /docker-entrypoint-initdb.d
          name: init
        env:
        - name: POSTGRES_USER
          value: postgres
        - name: POSTGRES_DB
          value: klustered
        - name: POSTGRES_PASSWORD
          value: postgresql123
        ports:
        - containerPort: 5432
        readinessProbe:
          exec:
            command: ["/bin/sh", "-c", "exec pg_isready -U postgres -h 127.0.0.1 -p 5432"]
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: postgres
spec:
  selector:
    app: postgresql
  ports:
  - port: 5432
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: klustered
spec:
  replicas: 1
  strategy:
    type: Recreate
  selector:
    matchLabels:
      app: klustered
  template:
    metadata:
      labels:
        app: klustered
    spec:
      containers:
      - name: klustered
        image: ghcr.io/rawkode-academy/klustered:v1
        ports:
        - containerPort: 666
        resources:
          limits:
            memory: "128Mi"
            cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: klustered
spec:
  type: NodePort
  ports:
  - port: 666
    nodePort: 30000
  selector:
    app: klustered
YAML

kubectl rollout status deployment/database --timeout=300s
kubectl rollout status deployment/klustered --timeout=300s
kb_wait 120 kb_app_ok
echo "baseline is green"
