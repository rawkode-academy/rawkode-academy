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

export interface Redirect {
  to: string;
  linkTracking?: LinkTracking;
}

export interface LinkTracking {
  source?: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
}
