export interface Redirects {
	defaultRedirect: string;
	domains: {
		[domain: string]: Domain;
	};
}

export interface Domain {
	defaultRedirect: string;
	redirects: {
		[path: string]: Redirect;
	};
}

interface Redirect {
	to: string;
	linkTracking?: LinkTracking;
}

interface LinkTracking {
	source?: string;
	medium?: string;
	campaign?: string;
	term?: string;
	content?: string;
}
