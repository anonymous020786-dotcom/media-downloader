# MediaDL — Kubernetes Deployment

## Prerequisites
- Kubernetes 1.28+ cluster
- `kubectl` and `kustomize` CLI
- NGINX Ingress Controller: `helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx -n ingress-nginx --create-namespace`
- cert-manager for TLS: `helm upgrade --install cert-manager cert-manager/cert-manager -n cert-manager --create-namespace --set installCRDs=true`
- A `ClusterIssuer` named `letsencrypt-prod`

## Quick Start

```bash
# 1. Clone + configure
git clone https://github.com/YOUR_ORG/media-downloader
cd media-downloader

# 2. Create namespace
kubectl apply -f k8s/base/namespace.yaml

# 3. Create secrets from your .env.prod file
kubectl create secret generic mediadl-secrets \
  --from-literal=MYSQL_ROOT_PASSWORD="$(grep MYSQL_ROOT_PASSWORD .env.prod | cut -d= -f2)" \
  --from-literal=MYSQL_PASSWORD="$(grep MYSQL_PASSWORD .env.prod | cut -d= -f2)" \
  --from-literal=SUPABASE_JWT_SECRET="$(grep SUPABASE_JWT_SECRET .env.prod | cut -d= -f2)" \
  --from-literal=SUPABASE_SERVICE_ROLE_KEY="$(grep SUPABASE_SERVICE_ROLE_KEY .env.prod | cut -d= -f2)" \
  --from-literal=NEXT_PUBLIC_SUPABASE_URL="$(grep NEXT_PUBLIC_SUPABASE_URL .env.prod | cut -d= -f2)" \
  --from-literal=NEXT_PUBLIC_SUPABASE_ANON_KEY="$(grep NEXT_PUBLIC_SUPABASE_ANON_KEY .env.prod | cut -d= -f2)" \
  --from-literal=SUPER_ADMIN_EMAIL="$(grep SUPER_ADMIN_EMAIL .env.prod | cut -d= -f2)" \
  --from-literal=TMDB_API_KEY="$(grep TMDB_API_KEY .env.prod | cut -d= -f2)" \
  --from-literal=TMDB_ACCESS_TOKEN="$(grep TMDB_ACCESS_TOKEN .env.prod | cut -d= -f2)" \
  --from-literal=SMTP_USER="$(grep SMTP_USER .env.prod | cut -d= -f2)" \
  --from-literal=SMTP_PASS="$(grep SMTP_PASS .env.prod | cut -d= -f2)" \
  --from-literal=FIREBASE_SERVICE_ACCOUNT_JSON="" \
  --from-literal=FIREBASE_PROJECT_ID="" \
  -n mediadl

# 4. Replace YOUR_DOMAIN in ingress.yaml
sed -i 's/YOUR_DOMAIN/yourdomain.com/g' k8s/base/ingress.yaml k8s/overlays/production/kustomization.yaml

# 5. Deploy to production
kubectl apply -k k8s/overlays/production

# 6. Watch rollout
kubectl rollout status deployment/backend -n mediadl
kubectl rollout status deployment/frontend -n mediadl
```

## Architecture

```
Internet → Ingress (NGINX) → TLS termination
               ↓               ↓
          /socket.io/     /api/*    /
               ↓               ↓    ↓
          backend (HPA 2-8)   frontend (HPA 2-6)
               ↓
     ┌─────────┼──────────┐
  Redis      MySQL       Kafka
  (queue)   (CMS/stats) (events)
               ↓
      python-service (HPA 1-5)
               ↓
          /downloads (PVC)
```

## Scaling

| Service        | Min | Max | Scale trigger          |
|----------------|-----|-----|------------------------|
| backend        | 2   | 8   | CPU > 65%              |
| frontend       | 2   | 6   | CPU > 70%              |
| python-service | 1   | 5   | CPU > 70% or mem > 80% |

## Storage

| PVC             | Size  | Access Mode    |
|-----------------|-------|----------------|
| mysql-pvc       | 10Gi  | ReadWriteOnce  |
| redis-pvc       | 2Gi   | ReadWriteOnce  |
| kafka-pvc       | 10Gi  | ReadWriteOnce  |
| downloads-pvc   | 50Gi  | ReadWriteMany  |

## Useful Commands

```bash
# Check all pods
kubectl get pods -n mediadl

# View backend logs
kubectl logs -n mediadl -l app=backend -f

# Scale backend manually
kubectl scale deployment/backend --replicas=5 -n mediadl

# Rolling restart
kubectl rollout restart deployment/backend -n mediadl

# Update images (production)
kubectl set image deployment/backend backend=ghcr.io/YOUR_ORG/mediadl-backend:v1.2.3 -n mediadl

# Port-forward for debugging
kubectl port-forward -n mediadl svc/backend-service 4000:4000
```
