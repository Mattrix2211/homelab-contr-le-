# MK HomeLab Control Center — Cahier des charges fonctionnel & technique — V1

> Statut : Spécification initiale
> Déploiement : Docker
> Interface : Web responsive, dark-first
> Design : MK Design System v2.0
> Principe : Monitor → Understand → Act

This is the original functional specification this project was built
against. `ARCHITECTURE.md` in this same directory tracks which sections are
implemented in Phase 1 and which are deferred to Phase 2/3.

## 1. Vision

Créer une application web personnelle constituant le centre de contrôle
unique du HomeLab.

L'application ne doit pas être un simple dashboard de monitoring ni chercher
à remplacer Grafana.

Elle doit agréger les informations provenant des différents composants du
HomeLab afin de permettre depuis une interface unique de :

1. Monitorer l'infrastructure.
2. Comprendre rapidement son état.
3. Détecter les anomalies.
4. Investiguer un problème.
5. Administrer les composants.
6. Déclencher des actions.
7. Consulter l'historique des événements et actions.
8. Accéder aux interfaces natives lorsqu'une administration avancée est
   nécessaire.

L'objectif final est de remplacer l'expérience fragmentée :

Homarr + Grafana + Portainer + Proxmox + TrueNAS + Uptime Kuma + différentes
interfaces

par un cockpit cohérent, sans chercher à supprimer ces outils sous-jacents.

## 2. Infrastructure actuelle à prendre en charge

**Raspberry Pi — Domotique critique**: Home Assistant OS. Services
principaux : Home Assistant, Mosquitto MQTT, Zigbee2MQTT, Matterbridge.
Cette machine doit rester indépendante du reste du HomeLab autant que
possible.

**ThinkCentre M83 — Serveur principal**: Proxmox VE — `192.168.1.23`.
Héberge notamment le LXC 100 — Debian / Docker — `192.168.1.24`, qui héberge
Portainer, AdGuard Home, Nginx Proxy Manager, Frigate, Glances, Prometheus,
Grafana, Uptime Kuma, Homarr, cAdvisor.

**Lenovo M710q — NAS**: TrueNAS Scale — `192.168.1.22`. Architecture cible :
pool ZFS, datasets backups/media/homeassistant/frigate, SMB/NFS, snapshots,
sauvegardes. Le cockpit doit être conçu dès maintenant pour gérer ces
fonctions même si certaines ne sont pas encore opérationnelles.

## 3. Architecture générale de l'application

Le cockpit est une application indépendante, elle-même déployée sous
Docker :

```
Browser
   │
   ▼
MK HomeLab Control Center
   ├── Frontend
   ▼
Backend API
   ├── Monitoring Engine
   ├── Action Engine
   ├── Event Engine
   ├── Integration Layer
   └── Database
        ├── Prometheus
        ├── Proxmox
        ├── Docker
        ├── TrueNAS
        ├── Home Assistant
        ├── Uptime Kuma
        └── autres intégrations
```

Le navigateur ne doit jamais communiquer directement avec les API
d'administration sensibles. Toutes les actions passent par le backend.

## 4. Déploiement Docker

`docker compose up -d` doit suffire. Exigences : healthchecks, volumes
persistants, restart policies, réseau Docker dédié, variables
d'environnement, secrets séparés, logs structurés, migrations de DB,
sauvegarde de la configuration, aucune dépendance manuelle sur l'hôte.

## 5. Navigation principale

Sidebar permanente sur desktop, 9 pages : 01 Cockpit, 02 Infrastructure,
03 Services, 04 Storage, 05 Network, 06 Home Assistant, 07 Monitoring,
08 Events, 09 Administration.

## 6–19. Pages et fonctionnalités détaillées

Cockpit (health score, machines, services critiques, alertes, ressources
globales, activité récente) · Infrastructure (vue topology + vue machines)
· Proxmox (node, VM/LXC, actions) · Docker (containers, filtres, actions) ·
Services (abstraction au-dessus des containers) · TrueNAS/Storage (pool,
disques, SMART, snapshots) · Backups (statut 3-2-1) · Réseau (DNS, AdGuard,
WireGuard) · Nginx Proxy Manager (proxies, certificats) · VPN (WireGuard).

See the original conversation/issue this repository was generated from for
the full section-by-section text (sections 6 through 47 cover Home
Assistant, Frigate, Monitoring avancé, Events & Alerts, pop-ups/drawers,
niveaux de confirmation, Command Palette, Quick Actions, recherche
universelle, notifications, authentification, permissions, sécurité des
intégrations, audit log, gestion des erreurs, rafraîchissement, MK Design
System v2.0 tokens/typographie/identité, composants réutilisables,
responsive, sources de données, base de données du cockpit, détection des
mises à jour, System Map, objectifs UX, MVP/Phase 2/Phase 3 scope, hors
périmètre, critères de réussite et le principe directeur
Monitor → Understand → Act).

## 42. MVP — Phase 1 (this repository's scope)

Authentification · Cockpit · hosts · Prometheus · Docker · Proxmox ·
services · métriques essentielles · containers · start/stop/restart · logs
· modales/drawers · alertes · audit log · liens vers interfaces natives ·
MK Design System · Docker Compose.

## 43. Phase 2

TrueNAS · ZFS · SMART · backups · Home Assistant · Frigate avancé ·
AdGuard · réseau · Command Palette · recherche universelle · notifications
améliorées.

## 44. Phase 3

Dependency map intelligente · gestion des mises à jour · détection
d'anomalies · automatisations · davantage de commandes · intégrations
supplémentaires · personnalisation du dashboard · notifications externes ·
historique plus avancé.

## 47. Principe directeur

**MONITOR → UNDERSTAND → ACT**

- Monitor: collecter et synthétiser l'état du HomeLab.
- Understand: transformer les métriques en informations compréhensibles et
  contextualisées.
- Act: permettre d'intervenir immédiatement et en sécurité.

Le résultat attendu n'est ni un dashboard, ni un launcher, ni un clone de
Grafana. C'est le système d'exploitation visuel du HomeLab personnel.
