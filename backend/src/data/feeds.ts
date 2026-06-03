// Catalog of FREE public RSS/Atom feeds — no API key, no rate-limited API.
// Three layers, generated programmatically to reach 1000+ sources:
//   1) CURATED  — hand-picked premium named feeds (BBC, Verge, ESPN…)
//   2) TOPICS   — Google News RSS search feeds (one per topic keyword)
//   3) REGIONS  — Google News section editions per country
//   4) REDDIT   — every subreddit exposes /.rss
// Plus on-the-fly topic search (/api/news?topic=...) = effectively infinite.

export interface Feed { name: string; url: string }
export interface FeedCategory { category: string; slug: string; feeds: Feed[] }

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
export const gnewsSearch = (q: string, country = 'US', lang = 'en') =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=${lang}-${country}&gl=${country}&ceid=${country}:${lang}`
const gnewsTopic = (topic: string, country: string, lang: string) =>
  `https://news.google.com/rss/headlines/section/topic/${topic}?hl=${lang}-${country}&gl=${country}&ceid=${country}:${lang}`
const reddit = (sub: string) => `https://www.reddit.com/r/${sub}/.rss`

// ── Layer 1: curated premium feeds ────────────────────────────────────────────
const CURATED: FeedCategory[] = [
  { category: 'Top / World', slug: 'world', feeds: [
    { name: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
    { name: 'The Guardian World', url: 'https://www.theguardian.com/world/rss' },
    { name: 'NYT World', url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml' },
    { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
    { name: 'NPR News', url: 'https://feeds.npr.org/1001/rss.xml' },
    { name: 'Google News Top', url: gnewsSearch('world news') },
  ]},
  { category: 'Technology', slug: 'technology', feeds: [
    { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml' },
    { name: 'TechCrunch', url: 'https://techcrunch.com/feed/' },
    { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index' },
    { name: 'Wired', url: 'https://www.wired.com/feed/rss' },
    { name: 'Engadget', url: 'https://www.engadget.com/rss.xml' },
    { name: 'Hacker News', url: 'https://hnrss.org/frontpage' },
  ]},
  { category: 'Business', slug: 'business', feeds: [
    { name: 'BBC Business', url: 'https://feeds.bbci.co.uk/news/business/rss.xml' },
    { name: 'NYT Business', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml' },
    { name: 'CNBC', url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114' },
    { name: 'Forbes', url: 'https://www.forbes.com/business/feed/' },
  ]},
  { category: 'Science', slug: 'science', feeds: [
    { name: 'BBC Science', url: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml' },
    { name: 'Scientific American', url: 'http://rss.sciam.com/ScientificAmerican-Global' },
    { name: 'New Scientist', url: 'https://www.newscientist.com/feed/home/' },
    { name: 'Phys.org', url: 'https://phys.org/rss-feed/' },
  ]},
  { category: 'Sports', slug: 'sports', feeds: [
    { name: 'BBC Sport', url: 'https://feeds.bbci.co.uk/sport/rss.xml' },
    { name: 'ESPN', url: 'https://www.espn.com/espn/rss/news' },
    { name: 'Guardian Sport', url: 'https://www.theguardian.com/sport/rss' },
  ]},
  { category: 'Entertainment', slug: 'entertainment', feeds: [
    { name: 'Variety', url: 'https://variety.com/feed/' },
    { name: 'Hollywood Reporter', url: 'https://www.hollywoodreporter.com/feed/' },
    { name: 'Deadline', url: 'https://deadline.com/feed/' },
  ]},
  { category: 'Gaming', slug: 'gaming', feeds: [
    { name: 'IGN', url: 'https://feeds.ign.com/ign/games-all' },
    { name: 'Polygon', url: 'https://www.polygon.com/rss/index.xml' },
    { name: 'Eurogamer', url: 'https://www.eurogamer.net/feed' },
  ]},
]

// ── Layer 2: Google News topic searches (one category each) ───────────────────
const TOPICS = [
  'Artificial Intelligence','Machine Learning','ChatGPT','OpenAI','Robotics','Quantum Computing','Cybersecurity',
  'Data Privacy','Cryptocurrency','Bitcoin','Ethereum','Blockchain','NFTs','Fintech','Stock Market','Economy',
  'Inflation','Interest Rates','Real Estate','Startups','Venture Capital','Electric Vehicles','Tesla','SpaceX',
  'NASA','Astronomy','Mars','Climate Change','Renewable Energy','Solar Power','Wind Energy','Nuclear Energy',
  'Biotechnology','Genetics','Vaccines','Mental Health','Nutrition','Fitness','Cancer Research','Pandemic',
  'Smartphones','iPhone','Android','Samsung','Google','Apple','Microsoft','Amazon','Meta','Nvidia','Intel','AMD',
  'Video Games','PlayStation','Xbox','Nintendo','Esports','Streaming','Netflix','Disney','HBO','Hollywood',
  'Box Office','Music Industry','Concerts','Grammys','Oscars','Football','Premier League','NBA','NFL','MLB','NHL',
  'Formula 1','Tennis','Golf','Olympics','World Cup','Cricket','UFC','Boxing','Politics','Elections','Geopolitics',
  'Diplomacy','Immigration','Supreme Court','Congress','Defense','Military','Cyberwar','Terrorism','Human Rights',
  'Education','Universities','Student Loans','Travel','Aviation','Airlines','Tourism','Hotels','Food','Restaurants',
  'Recipes','Wine','Coffee','Fashion','Luxury','Retail','E-commerce','Supply Chain','Manufacturing','Automotive',
  'Self-Driving Cars','Drones','5G','Internet of Things','Cloud Computing','Semiconductors','Programming','Web Development',
  'Open Source','Linux','Cybercrime','Hacking','Ransomware','Social Media','Misinformation','Journalism','Books',
  'Literature','Art','Museums','Architecture','Design','Photography','Theatre','Comics','Anime','Manga','K-pop',
  'Celebrity','Royals','Weather','Natural Disasters','Earthquakes','Wildfires','Oceans','Wildlife','Conservation',
  'Agriculture','Energy Prices','Oil','Gas','Mining','Gold','Banking','Insurance','Taxes','Jobs','Remote Work',
  'Labor Unions','Gig Economy','Housing','Healthcare Policy','Drug Policy','Space Tourism','Satellites','Telescopes',
  'Physics','Chemistry','Mathematics','Neuroscience','Psychology','Archaeology','History','Philosophy','Religion',
  'Law','Crime','Justice','Privacy Law','Antitrust','Mergers','IPO','Earnings','Recession','Trade War','Tariffs',
  'Renewables','Battery Technology','Hydrogen','Carbon Capture','Biodiversity','Pollution','Recycling','Water',
]
const TOPIC_CATS: FeedCategory[] = TOPICS.map((t) => ({
  category: t, slug: `t-${slugify(t)}`, feeds: [{ name: `Google News: ${t}`, url: gnewsSearch(t) }],
}))

// ── Layer 3: Google News regional editions (country × section) ────────────────
const COUNTRIES: { c: string; l: string; name: string }[] = [
  { c: 'US', l: 'en', name: 'United States' }, { c: 'GB', l: 'en', name: 'United Kingdom' },
  { c: 'CA', l: 'en', name: 'Canada' }, { c: 'AU', l: 'en', name: 'Australia' }, { c: 'IN', l: 'en', name: 'India' },
  { c: 'IE', l: 'en', name: 'Ireland' }, { c: 'ZA', l: 'en', name: 'South Africa' }, { c: 'NG', l: 'en', name: 'Nigeria' },
  { c: 'FR', l: 'fr', name: 'France' }, { c: 'DE', l: 'de', name: 'Germany' }, { c: 'ES', l: 'es', name: 'Spain' },
  { c: 'IT', l: 'it', name: 'Italy' }, { c: 'BR', l: 'pt', name: 'Brazil' }, { c: 'MX', l: 'es', name: 'Mexico' },
  { c: 'JP', l: 'ja', name: 'Japan' }, { c: 'KR', l: 'ko', name: 'South Korea' }, { c: 'CN', l: 'zh', name: 'China' },
  { c: 'RU', l: 'ru', name: 'Russia' }, { c: 'NL', l: 'nl', name: 'Netherlands' }, { c: 'SE', l: 'sv', name: 'Sweden' },
  { c: 'PL', l: 'pl', name: 'Poland' }, { c: 'TR', l: 'tr', name: 'Turkey' }, { c: 'SA', l: 'ar', name: 'Saudi Arabia' },
  { c: 'AE', l: 'ar', name: 'UAE' }, { c: 'EG', l: 'ar', name: 'Egypt' }, { c: 'ID', l: 'id', name: 'Indonesia' },
  { c: 'PK', l: 'en', name: 'Pakistan' }, { c: 'BD', l: 'bn', name: 'Bangladesh' }, { c: 'PH', l: 'en', name: 'Philippines' },
  { c: 'SG', l: 'en', name: 'Singapore' }, { c: 'AR', l: 'es', name: 'Argentina' }, { c: 'CL', l: 'es', name: 'Chile' },
  { c: 'CO', l: 'es', name: 'Colombia' }, { c: 'PT', l: 'pt', name: 'Portugal' }, { c: 'GR', l: 'el', name: 'Greece' },
  { c: 'IL', l: 'he', name: 'Israel' }, { c: 'TH', l: 'th', name: 'Thailand' }, { c: 'VN', l: 'vi', name: 'Vietnam' },
  { c: 'MY', l: 'en', name: 'Malaysia' }, { c: 'KE', l: 'en', name: 'Kenya' },
]
const GSECTIONS = ['WORLD', 'NATION', 'BUSINESS', 'TECHNOLOGY', 'ENTERTAINMENT', 'SPORTS', 'SCIENCE', 'HEALTH']
const REGION_CATS: FeedCategory[] = COUNTRIES.flatMap((co) =>
  GSECTIONS.map((sec) => ({
    category: `${co.name} · ${sec[0] + sec.slice(1).toLowerCase()}`,
    slug: `r-${co.c.toLowerCase()}-${sec.toLowerCase()}`,
    feeds: [{ name: `Google News ${co.name} (${sec.toLowerCase()})`, url: gnewsTopic(sec, co.c, co.l) }],
  })))

// ── Layer 4: Reddit communities (each subreddit = a source) ───────────────────
const SUBREDDITS = [
  'worldnews','news','technology','science','space','Futurology','gadgets','programming','webdev','MachineLearning',
  'artificial','cybersecurity','privacy','CryptoCurrency','Bitcoin','ethereum','wallstreetbets','investing','stocks',
  'economics','business','Entrepreneur','startups','personalfinance','movies','television','Music','gaming','pcgaming',
  'PS5','XboxSeriesX','NintendoSwitch','anime','books','sports','soccer','nba','nfl','baseball','formula1','tennis',
  'space','askscience','EverythingScience','Physics','chemistry','biology','medicine','psychology','history',
  'geopolitics','politics','europe','unitedkingdom','india','canada','australia','worldpolitics','environment',
  'climate','energy','electricvehicles','teslamotors','apple','android','google','microsoft','linux','sysadmin',
  'datascience','learnprogramming','coding','design','photography','art','architecture','food','Cooking','travel',
  'cars','motorcycles','aviation','space','nasa','UpliftingNews','TrueReddit','InternationalNews','nottheonion',
]
const REDDIT_CATS: FeedCategory[] = SUBREDDITS.map((s) => ({
  category: `r/${s}`, slug: `reddit-${slugify(s)}`, feeds: [{ name: `r/${s}`, url: reddit(s) }],
}))

// ── Layer 5: topic × country (Google News search, reliable & non-blockable) ───
// Multiplies coverage to 1000+ working sources without depending on blockable hosts.
const TOP_TOPICS = [
  'Technology','Artificial Intelligence','Business','Economy','Sports','Football','Politics','Elections',
  'Health','Science','Entertainment','Movies','Music','Gaming','Travel','Finance','Cryptocurrency',
  'Climate','Education','Startups','Cybersecurity','Stock Market','Automotive','Energy',
]
const REGIONAL_TOPIC_CATS: FeedCategory[] = COUNTRIES.flatMap((co) =>
  TOP_TOPICS.map((t) => ({
    category: `${t} · ${co.name}`,
    slug: `rt-${co.c.toLowerCase()}-${slugify(t)}`,
    feeds: [{ name: `Google News ${t} (${co.name})`, url: gnewsSearch(t, co.c, co.l) }],
  })))

export const FEED_CATALOG: FeedCategory[] = [...CURATED, ...TOPIC_CATS, ...REGION_CATS, ...REGIONAL_TOPIC_CATS, ...REDDIT_CATS]

export const ALL_FEEDS = FEED_CATALOG.flatMap((c) => c.feeds.map((f) => ({ category: c.category, slug: c.slug, name: f.name, url: f.url })))
export const FEED_COUNT = ALL_FEEDS.length
export const CATEGORY_COUNT = FEED_CATALOG.length
// A small "featured" set used for the All / homepage view (don't fetch 1000 feeds!)
export const FEATURED_SLUGS = ['world', 'technology', 'business', 'science', 'sports', 'entertainment']
