import type { Faro } from "@grafana/faro-web-sdk";

interface Window {
	grafanaFaro?: Faro | null;
	enableGrafanaFaro?: () => void;
}
