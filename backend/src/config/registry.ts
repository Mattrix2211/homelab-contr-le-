// Static registry describing the known HomeLab topology.
// This seeds the Infrastructure/Services views and lets the cockpit reason
// about dependencies (section 40 - System Map) even before every
// integration is live. Runtime status is always layered on top of this by
// the monitoring engine - nothing here is a live value.

export type HostId = "rpi" | "m83" | "m710q";

export interface HostDef {
  id: HostId;
  name: string;
  role: string;
  ip: string;
  kind: "proxmox" | "truenas" | "standalone";
  critical: boolean;
}

export const HOSTS: HostDef[] = [
  {
    id: "rpi",
    name: "Raspberry Pi",
    role: "Domotique critique",
    ip: "192.168.1.152",
    kind: "standalone",
    critical: true,
  },
  {
    id: "m83",
    name: "M83",
    role: "Proxmox VE",
    ip: "192.168.1.23",
    kind: "proxmox",
    critical: true,
  },
  {
    id: "m710q",
    name: "M710q",
    role: "TrueNAS Scale",
    ip: "192.168.1.22",
    kind: "truenas",
    critical: true,
  },
];

export interface ServiceDef {
  id: string;
  name: string;
  category:
    | "domotique"
    | "network"
    | "monitoring"
    | "storage"
    | "media"
    | "platform";
  hostId: HostId;
  // matched against docker container names to bind live status
  containerNames?: string[];
  externalUrlEnvKey?: string;
  critical: boolean;
  dependsOn?: string[]; // other service ids
}

export const SERVICES: ServiceDef[] = [
  { id: "home-assistant", name: "Home Assistant", category: "domotique", hostId: "rpi", critical: true },
  { id: "mosquitto", name: "Mosquitto MQTT", category: "domotique", hostId: "rpi", critical: false, dependsOn: ["home-assistant"] },
  { id: "zigbee2mqtt", name: "Zigbee2MQTT", category: "domotique", hostId: "rpi", critical: false, dependsOn: ["mosquitto"] },
  { id: "matterbridge", name: "Matterbridge", category: "domotique", hostId: "rpi", critical: false, dependsOn: ["home-assistant"] },

  { id: "portainer", name: "Portainer", category: "platform", hostId: "m83", containerNames: ["portainer"], critical: false, dependsOn: ["docker"] },
  { id: "adguard", name: "AdGuard Home", category: "network", hostId: "m83", containerNames: ["adguard", "adguardhome"], critical: true, dependsOn: ["docker"] },
  { id: "npm", name: "Nginx Proxy Manager", category: "network", hostId: "m83", containerNames: ["nginx-proxy-manager", "npm"], critical: true, dependsOn: ["docker"] },
  { id: "frigate", name: "Frigate", category: "media", hostId: "m83", containerNames: ["frigate"], critical: true, dependsOn: ["docker"] },
  { id: "glances", name: "Glances", category: "monitoring", hostId: "m83", containerNames: ["glances"], critical: false, dependsOn: ["docker"] },
  { id: "prometheus", name: "Prometheus", category: "monitoring", hostId: "m83", containerNames: ["prometheus"], critical: true, dependsOn: ["docker"] },
  { id: "grafana", name: "Grafana", category: "monitoring", hostId: "m83", containerNames: ["grafana"], critical: false, dependsOn: ["prometheus"] },
  { id: "uptime-kuma", name: "Uptime Kuma", category: "monitoring", hostId: "m83", containerNames: ["uptime-kuma"], critical: false, dependsOn: ["docker"] },
  { id: "homarr", name: "Homarr", category: "platform", hostId: "m83", containerNames: ["homarr"], critical: false, dependsOn: ["docker"] },
  { id: "cadvisor", name: "cAdvisor", category: "monitoring", hostId: "m83", containerNames: ["cadvisor"], critical: false, dependsOn: ["docker"] },

  { id: "truenas", name: "TrueNAS", category: "storage", hostId: "m710q", critical: true },
];

export const DOCKER_HOST_ID: HostId = "m83"; // LXC 100 - 192.168.1.24
