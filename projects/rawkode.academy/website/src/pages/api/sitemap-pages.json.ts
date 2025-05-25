import type { APIRoute } from 'astro';

interface SitemapUrl {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: string;
}

interface NavigationItem {
  id: string;
  title: string;
  description?: string;
  href: string;
  category: string;
  keywords?: string[];
}

function parseXmlToUrls(xmlContent: string): SitemapUrl[] {
  const urls: SitemapUrl[] = [];
  const urlMatches = xmlContent.match(/<url>.*?<\/url>/gs);
  
  if (!urlMatches) return urls;
  
  urlMatches.forEach(urlBlock => {
    const locMatch = urlBlock.match(/<loc>(.*?)<\/loc>/);
    const lastmodMatch = urlBlock.match(/<lastmod>(.*?)<\/lastmod>/);
    const changefreqMatch = urlBlock.match(/<changefreq>(.*?)<\/changefreq>/);
    const priorityMatch = urlBlock.match(/<priority>(.*?)<\/priority>/);
    
    if (locMatch && locMatch[1]) {
      const url: SitemapUrl = {
        loc: locMatch[1]
      };
      
      if (lastmodMatch?.[1]) url.lastmod = lastmodMatch[1];
      if (changefreqMatch?.[1]) url.changefreq = changefreqMatch[1];
      if (priorityMatch?.[1]) url.priority = priorityMatch[1];
      
      urls.push(url);
    }
  });
  
  return urls;
}

function createNavigationItem(url: SitemapUrl, baseUrl: string): NavigationItem {
  const path = url.loc.replace(baseUrl, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const segments = normalizedPath.split('/').filter(Boolean);
  
  // Generate title from URL path
  let title = segments[segments.length - 1] || 'Home';
  if (title) {
    title = title.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }
  
  // Determine category based on path structure
  let category = 'Pages';
  if (segments.length > 0) {
    const firstSegment = segments[0];
    switch (firstSegment) {
      case 'watch':
        category = 'Videos';
        if (segments.length === 1) title = 'All Videos';
        break;
      case 'read':
        category = 'Articles';
        if (segments.length === 1) title = 'All Articles';
        break;
      case 'technology':
        category = 'Technology';
        if (segments.length === 1) title = 'All Technologies';
        break;
      case 'series':
        category = 'Series';
        if (segments.length === 1) title = 'All Series';
        break;
      case 'organizations':
        category = 'Organizations';
        break;
      case 'adrs':
        category = 'Documentation';
        if (segments.length === 1) title = 'Architecture Decisions';
        break;
      case 'community-day':
        category = 'Community';
        title = 'Community Day';
        break;
      case 'maintainers':
        category = 'Community';
        break;
      case 'about':
        category = 'About';
        break;
      case 'search':
        category = 'Tools';
        break;
      default:
        category = 'Pages';
    }
  }
  
  // Generate description based on category and title
  let description = '';
  switch (category) {
    case 'Videos':
      description = segments.length > 1 ? 'Watch this video' : 'Browse all videos';
      break;
    case 'Articles':
      description = segments.length > 1 ? 'Read this article' : 'Browse all articles';
      break;
    case 'Technology':
      description = segments.length > 1 ? `Learn about ${title}` : 'Browse technologies';
      break;
    case 'Series':
      description = segments.length > 1 ? `Watch ${title} series` : 'Browse video series';
      break;
    case 'Organizations':
      description = segments.length > 1 ? `Learn about ${title}` : 'Partner organizations';
      break;
    case 'Documentation':
      description = 'Technical documentation';
      break;
    case 'Community':
      description = 'Community information';
      break;
    case 'About':
      description = 'About Rawkode Academy';
      break;
    case 'Tools':
      description = 'Search and discovery tools';
      break;
    default:
      description = `Navigate to ${title}`;
  }
  
  // Create keywords for better search
  const keywords = [
    ...segments,
    title.toLowerCase(),
    category.toLowerCase()
  ];
  
  return {
    id: normalizedPath || 'home',
    title,
    description,
    href: normalizedPath || '/',
    category,
    keywords
  };
}

export const GET: APIRoute = async ({ site }) => {
  try {
    const baseUrl = site?.toString() || 'https://rawkode.academy';
    const sitemapUrl = `${baseUrl}/sitemap-0.xml`;
    
    const response = await fetch(sitemapUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch sitemap: ${response.status}`);
    }
    
    const xmlContent = await response.text();
    const urls = parseXmlToUrls(xmlContent);
    
    const navigationItems: NavigationItem[] = urls
      .map(url => createNavigationItem(url, baseUrl))
      .filter(item => {
        // Filter out API routes and other unwanted paths
        return !item.href.includes('/api/') && 
               !item.href.includes('robots.txt') &&
               !item.href.includes('sitemap');
      })
      .sort((a, b) => {
        // Sort by category first, then by title
        if (a.category !== b.category) {
          return a.category.localeCompare(b.category);
        }
        return a.title.localeCompare(b.title);
      });
    
    return new Response(JSON.stringify(navigationItems), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
      }
    });
  } catch (error) {
    console.error('Error generating navigation items:', error);
    
    return new Response(JSON.stringify({ error: 'Failed to generate navigation items' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
};