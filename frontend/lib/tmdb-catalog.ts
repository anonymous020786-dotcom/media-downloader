// Complete catalog of TMDB v3 READ (GET) endpoints. Drives the API Explorer so
// every endpoint is a real, callable UI surface. Path templates use {param}
// placeholders that the Explorer turns into form inputs; `query` lists optional
// query-string params. `render` hints how to display the response.
export type RenderKind = 'media' | 'people' | 'images' | 'videos' | 'cast' | 'json'

export interface Param { name: string; required?: boolean; placeholder?: string; default?: string }
export interface Endpoint {
  id: string
  name: string
  path: string                 // e.g. /movie/{movie_id}/credits
  pathParams?: Param[]
  query?: Param[]
  render?: RenderKind
  desc?: string
}
export interface EndpointGroup { category: string; endpoints: Endpoint[] }

const PAGE: Param = { name: 'page', placeholder: '1', default: '1' }
const LANG: Param = { name: 'language', placeholder: 'en-US' }

export const TMDB_CATALOG: EndpointGroup[] = [
  { category: 'Trending', endpoints: [
    { id: 'trending', name: 'Trending', path: '/trending/{media_type}/{time_window}',
      pathParams: [{ name: 'media_type', default: 'all', placeholder: 'all|movie|tv|person' }, { name: 'time_window', default: 'week', placeholder: 'day|week' }],
      query: [LANG], render: 'media' },
  ]},
  { category: 'Search', endpoints: [
    { id: 'search-multi',     name: 'Search Multi',      path: '/search/multi',      query: [{ name: 'query', required: true }, PAGE, { name: 'include_adult', default: 'false' }, LANG], render: 'media' },
    { id: 'search-movie',     name: 'Search Movies',     path: '/search/movie',      query: [{ name: 'query', required: true }, PAGE, { name: 'year' }, { name: 'primary_release_year' }, LANG], render: 'media' },
    { id: 'search-tv',        name: 'Search TV',         path: '/search/tv',         query: [{ name: 'query', required: true }, PAGE, { name: 'first_air_date_year' }, LANG], render: 'media' },
    { id: 'search-person',    name: 'Search People',     path: '/search/person',     query: [{ name: 'query', required: true }, PAGE, LANG], render: 'people' },
    { id: 'search-collection',name: 'Search Collections',path: '/search/collection', query: [{ name: 'query', required: true }, PAGE, LANG], render: 'json' },
    { id: 'search-company',   name: 'Search Companies',  path: '/search/company',    query: [{ name: 'query', required: true }, PAGE], render: 'json' },
    { id: 'search-keyword',   name: 'Search Keywords',   path: '/search/keyword',    query: [{ name: 'query', required: true }, PAGE], render: 'json' },
  ]},
  { category: 'Discover', endpoints: [
    { id: 'discover-movie', name: 'Discover Movies', path: '/discover/movie',
      query: [{ name: 'sort_by', default: 'popularity.desc' }, { name: 'with_genres' }, { name: 'year' }, { name: 'primary_release_year' }, { name: 'vote_average.gte' }, { name: 'with_original_language' }, { name: 'with_watch_providers' }, { name: 'watch_region' }, PAGE, LANG], render: 'media' },
    { id: 'discover-tv', name: 'Discover TV', path: '/discover/tv',
      query: [{ name: 'sort_by', default: 'popularity.desc' }, { name: 'with_genres' }, { name: 'first_air_date_year' }, { name: 'vote_average.gte' }, { name: 'with_original_language' }, PAGE, LANG], render: 'media' },
  ]},
  { category: 'Movie Lists', endpoints: [
    { id: 'movie-now-playing', name: 'Now Playing', path: '/movie/now_playing', query: [PAGE, { name: 'region' }, LANG], render: 'media' },
    { id: 'movie-popular',     name: 'Popular',     path: '/movie/popular',     query: [PAGE, { name: 'region' }, LANG], render: 'media' },
    { id: 'movie-top-rated',   name: 'Top Rated',   path: '/movie/top_rated',   query: [PAGE, { name: 'region' }, LANG], render: 'media' },
    { id: 'movie-upcoming',    name: 'Upcoming',    path: '/movie/upcoming',    query: [PAGE, { name: 'region' }, LANG], render: 'media' },
    { id: 'movie-latest',      name: 'Latest',      path: '/movie/latest',      query: [LANG], render: 'json' },
  ]},
  { category: 'Movies', endpoints: [
    { id: 'movie-details',        name: 'Details',           path: '/movie/{movie_id}',                  pathParams: [{ name: 'movie_id', default: '550' }], query: [LANG, { name: 'append_to_response' }], render: 'json' },
    { id: 'movie-alt-titles',     name: 'Alternative Titles',path: '/movie/{movie_id}/alternative_titles',pathParams: [{ name: 'movie_id', default: '550' }], query: [{ name: 'country' }], render: 'json' },
    { id: 'movie-changes',        name: 'Changes',           path: '/movie/{movie_id}/changes',          pathParams: [{ name: 'movie_id', default: '550' }], query: [{ name: 'start_date' }, { name: 'end_date' }, PAGE], render: 'json' },
    { id: 'movie-credits',        name: 'Credits',           path: '/movie/{movie_id}/credits',          pathParams: [{ name: 'movie_id', default: '550' }], query: [LANG], render: 'cast' },
    { id: 'movie-external-ids',   name: 'External IDs',      path: '/movie/{movie_id}/external_ids',     pathParams: [{ name: 'movie_id', default: '550' }], render: 'json' },
    { id: 'movie-images',         name: 'Images',            path: '/movie/{movie_id}/images',           pathParams: [{ name: 'movie_id', default: '550' }], query: [{ name: 'include_image_language' }], render: 'images' },
    { id: 'movie-keywords',       name: 'Keywords',          path: '/movie/{movie_id}/keywords',         pathParams: [{ name: 'movie_id', default: '550' }], render: 'json' },
    { id: 'movie-lists',          name: 'Lists',             path: '/movie/{movie_id}/lists',            pathParams: [{ name: 'movie_id', default: '550' }], query: [PAGE, LANG], render: 'json' },
    { id: 'movie-recommendations',name: 'Recommendations',   path: '/movie/{movie_id}/recommendations',  pathParams: [{ name: 'movie_id', default: '550' }], query: [PAGE, LANG], render: 'media' },
    { id: 'movie-release-dates',  name: 'Release Dates',     path: '/movie/{movie_id}/release_dates',    pathParams: [{ name: 'movie_id', default: '550' }], render: 'json' },
    { id: 'movie-reviews',        name: 'Reviews',           path: '/movie/{movie_id}/reviews',          pathParams: [{ name: 'movie_id', default: '550' }], query: [PAGE, LANG], render: 'json' },
    { id: 'movie-similar',        name: 'Similar',           path: '/movie/{movie_id}/similar',          pathParams: [{ name: 'movie_id', default: '550' }], query: [PAGE, LANG], render: 'media' },
    { id: 'movie-translations',   name: 'Translations',      path: '/movie/{movie_id}/translations',     pathParams: [{ name: 'movie_id', default: '550' }], render: 'json' },
    { id: 'movie-videos',         name: 'Videos',            path: '/movie/{movie_id}/videos',           pathParams: [{ name: 'movie_id', default: '550' }], query: [LANG], render: 'videos' },
    { id: 'movie-watch-providers',name: 'Watch Providers',   path: '/movie/{movie_id}/watch/providers',  pathParams: [{ name: 'movie_id', default: '550' }], render: 'json' },
  ]},
  { category: 'TV Lists', endpoints: [
    { id: 'tv-airing-today', name: 'Airing Today', path: '/tv/airing_today', query: [PAGE, LANG], render: 'media' },
    { id: 'tv-on-the-air',   name: 'On The Air',   path: '/tv/on_the_air',   query: [PAGE, LANG], render: 'media' },
    { id: 'tv-popular',      name: 'Popular',      path: '/tv/popular',      query: [PAGE, LANG], render: 'media' },
    { id: 'tv-top-rated',    name: 'Top Rated',    path: '/tv/top_rated',    query: [PAGE, LANG], render: 'media' },
    { id: 'tv-latest',       name: 'Latest',       path: '/tv/latest',       query: [LANG], render: 'json' },
  ]},
  { category: 'TV Series', endpoints: [
    { id: 'tv-details',          name: 'Details',            path: '/tv/{tv_id}',                   pathParams: [{ name: 'tv_id', default: '1399' }], query: [LANG, { name: 'append_to_response' }], render: 'json' },
    { id: 'tv-aggregate-credits',name: 'Aggregate Credits',  path: '/tv/{tv_id}/aggregate_credits', pathParams: [{ name: 'tv_id', default: '1399' }], query: [LANG], render: 'cast' },
    { id: 'tv-alt-titles',       name: 'Alternative Titles', path: '/tv/{tv_id}/alternative_titles',pathParams: [{ name: 'tv_id', default: '1399' }], render: 'json' },
    { id: 'tv-changes',          name: 'Changes',            path: '/tv/{tv_id}/changes',           pathParams: [{ name: 'tv_id', default: '1399' }], query: [{ name: 'start_date' }, { name: 'end_date' }, PAGE], render: 'json' },
    { id: 'tv-content-ratings',  name: 'Content Ratings',    path: '/tv/{tv_id}/content_ratings',   pathParams: [{ name: 'tv_id', default: '1399' }], render: 'json' },
    { id: 'tv-credits',          name: 'Credits',            path: '/tv/{tv_id}/credits',           pathParams: [{ name: 'tv_id', default: '1399' }], query: [LANG], render: 'cast' },
    { id: 'tv-episode-groups',   name: 'Episode Groups',     path: '/tv/{tv_id}/episode_groups',    pathParams: [{ name: 'tv_id', default: '1399' }], render: 'json' },
    { id: 'tv-external-ids',     name: 'External IDs',       path: '/tv/{tv_id}/external_ids',      pathParams: [{ name: 'tv_id', default: '1399' }], render: 'json' },
    { id: 'tv-images',           name: 'Images',             path: '/tv/{tv_id}/images',            pathParams: [{ name: 'tv_id', default: '1399' }], render: 'images' },
    { id: 'tv-keywords',         name: 'Keywords',           path: '/tv/{tv_id}/keywords',          pathParams: [{ name: 'tv_id', default: '1399' }], render: 'json' },
    { id: 'tv-recommendations',  name: 'Recommendations',    path: '/tv/{tv_id}/recommendations',   pathParams: [{ name: 'tv_id', default: '1399' }], query: [PAGE, LANG], render: 'media' },
    { id: 'tv-reviews',          name: 'Reviews',            path: '/tv/{tv_id}/reviews',           pathParams: [{ name: 'tv_id', default: '1399' }], query: [PAGE, LANG], render: 'json' },
    { id: 'tv-screened',         name: 'Screened Theatrically',path: '/tv/{tv_id}/screened_theatrically',pathParams: [{ name: 'tv_id', default: '1399' }], render: 'json' },
    { id: 'tv-similar',          name: 'Similar',            path: '/tv/{tv_id}/similar',           pathParams: [{ name: 'tv_id', default: '1399' }], query: [PAGE, LANG], render: 'media' },
    { id: 'tv-translations',     name: 'Translations',       path: '/tv/{tv_id}/translations',      pathParams: [{ name: 'tv_id', default: '1399' }], render: 'json' },
    { id: 'tv-videos',           name: 'Videos',             path: '/tv/{tv_id}/videos',            pathParams: [{ name: 'tv_id', default: '1399' }], query: [LANG], render: 'videos' },
    { id: 'tv-watch-providers',  name: 'Watch Providers',    path: '/tv/{tv_id}/watch/providers',   pathParams: [{ name: 'tv_id', default: '1399' }], render: 'json' },
  ]},
  { category: 'TV Seasons', endpoints: [
    { id: 'season-details',      name: 'Details',       path: '/tv/{tv_id}/season/{season_number}',                pathParams: [{ name: 'tv_id', default: '1399' }, { name: 'season_number', default: '1' }], query: [LANG, { name: 'append_to_response' }], render: 'json' },
    { id: 'season-aggregate',    name: 'Aggregate Credits',path: '/tv/{tv_id}/season/{season_number}/aggregate_credits', pathParams: [{ name: 'tv_id', default: '1399' }, { name: 'season_number', default: '1' }], render: 'cast' },
    { id: 'season-changes',      name: 'Changes',       path: '/tv/season/{season_id}/changes',                    pathParams: [{ name: 'season_id', default: '3624' }], render: 'json' },
    { id: 'season-credits',      name: 'Credits',       path: '/tv/{tv_id}/season/{season_number}/credits',        pathParams: [{ name: 'tv_id', default: '1399' }, { name: 'season_number', default: '1' }], render: 'cast' },
    { id: 'season-external-ids', name: 'External IDs',  path: '/tv/{tv_id}/season/{season_number}/external_ids',   pathParams: [{ name: 'tv_id', default: '1399' }, { name: 'season_number', default: '1' }], render: 'json' },
    { id: 'season-images',       name: 'Images',        path: '/tv/{tv_id}/season/{season_number}/images',         pathParams: [{ name: 'tv_id', default: '1399' }, { name: 'season_number', default: '1' }], render: 'images' },
    { id: 'season-videos',       name: 'Videos',        path: '/tv/{tv_id}/season/{season_number}/videos',         pathParams: [{ name: 'tv_id', default: '1399' }, { name: 'season_number', default: '1' }], render: 'videos' },
    { id: 'season-watch',        name: 'Watch Providers',path: '/tv/{tv_id}/season/{season_number}/watch/providers',pathParams: [{ name: 'tv_id', default: '1399' }, { name: 'season_number', default: '1' }], render: 'json' },
  ]},
  { category: 'TV Episodes', endpoints: [
    { id: 'episode-details',     name: 'Details',      path: '/tv/{tv_id}/season/{season_number}/episode/{episode_number}',             pathParams: [{ name: 'tv_id', default: '1399' }, { name: 'season_number', default: '1' }, { name: 'episode_number', default: '1' }], query: [LANG, { name: 'append_to_response' }], render: 'json' },
    { id: 'episode-credits',     name: 'Credits',      path: '/tv/{tv_id}/season/{season_number}/episode/{episode_number}/credits',     pathParams: [{ name: 'tv_id', default: '1399' }, { name: 'season_number', default: '1' }, { name: 'episode_number', default: '1' }], render: 'cast' },
    { id: 'episode-external-ids',name: 'External IDs', path: '/tv/{tv_id}/season/{season_number}/episode/{episode_number}/external_ids',pathParams: [{ name: 'tv_id', default: '1399' }, { name: 'season_number', default: '1' }, { name: 'episode_number', default: '1' }], render: 'json' },
    { id: 'episode-images',      name: 'Images',       path: '/tv/{tv_id}/season/{season_number}/episode/{episode_number}/images',      pathParams: [{ name: 'tv_id', default: '1399' }, { name: 'season_number', default: '1' }, { name: 'episode_number', default: '1' }], render: 'images' },
    { id: 'episode-videos',      name: 'Videos',       path: '/tv/{tv_id}/season/{season_number}/episode/{episode_number}/videos',      pathParams: [{ name: 'tv_id', default: '1399' }, { name: 'season_number', default: '1' }, { name: 'episode_number', default: '1' }], render: 'videos' },
    { id: 'episode-translations',name: 'Translations', path: '/tv/{tv_id}/season/{season_number}/episode/{episode_number}/translations',pathParams: [{ name: 'tv_id', default: '1399' }, { name: 'season_number', default: '1' }, { name: 'episode_number', default: '1' }], render: 'json' },
  ]},
  { category: 'TV Episode Groups', endpoints: [
    { id: 'episode-group', name: 'Details', path: '/tv/episode_group/{id}', pathParams: [{ name: 'id', placeholder: 'episode group id' }], render: 'json' },
  ]},
  { category: 'People Lists', endpoints: [
    { id: 'person-popular', name: 'Popular People', path: '/person/popular', query: [PAGE, LANG], render: 'people' },
    { id: 'person-latest',  name: 'Latest Person',  path: '/person/latest',  query: [LANG], render: 'json' },
  ]},
  { category: 'People', endpoints: [
    { id: 'person-details',         name: 'Details',         path: '/person/{person_id}',                pathParams: [{ name: 'person_id', default: '287' }], query: [LANG, { name: 'append_to_response' }], render: 'json' },
    { id: 'person-changes',         name: 'Changes',         path: '/person/{person_id}/changes',        pathParams: [{ name: 'person_id', default: '287' }], render: 'json' },
    { id: 'person-combined-credits',name: 'Combined Credits',path: '/person/{person_id}/combined_credits',pathParams: [{ name: 'person_id', default: '287' }], query: [LANG], render: 'media' },
    { id: 'person-external-ids',    name: 'External IDs',    path: '/person/{person_id}/external_ids',   pathParams: [{ name: 'person_id', default: '287' }], render: 'json' },
    { id: 'person-images',          name: 'Images',          path: '/person/{person_id}/images',         pathParams: [{ name: 'person_id', default: '287' }], render: 'images' },
    { id: 'person-movie-credits',   name: 'Movie Credits',   path: '/person/{person_id}/movie_credits', pathParams: [{ name: 'person_id', default: '287' }], query: [LANG], render: 'media' },
    { id: 'person-tv-credits',      name: 'TV Credits',      path: '/person/{person_id}/tv_credits',    pathParams: [{ name: 'person_id', default: '287' }], query: [LANG], render: 'media' },
    { id: 'person-tagged-images',   name: 'Tagged Images',   path: '/person/{person_id}/tagged_images', pathParams: [{ name: 'person_id', default: '287' }], query: [PAGE], render: 'json' },
    { id: 'person-translations',    name: 'Translations',    path: '/person/{person_id}/translations',  pathParams: [{ name: 'person_id', default: '287' }], render: 'json' },
  ]},
  { category: 'Collections', endpoints: [
    { id: 'collection-details',     name: 'Details',      path: '/collection/{collection_id}',             pathParams: [{ name: 'collection_id', default: '10' }], query: [LANG], render: 'json' },
    { id: 'collection-images',      name: 'Images',       path: '/collection/{collection_id}/images',      pathParams: [{ name: 'collection_id', default: '10' }], render: 'images' },
    { id: 'collection-translations',name: 'Translations', path: '/collection/{collection_id}/translations',pathParams: [{ name: 'collection_id', default: '10' }], render: 'json' },
  ]},
  { category: 'Companies', endpoints: [
    { id: 'company-details',   name: 'Details',          path: '/company/{company_id}',                 pathParams: [{ name: 'company_id', default: '1' }], render: 'json' },
    { id: 'company-alt-names', name: 'Alternative Names',path: '/company/{company_id}/alternative_names',pathParams: [{ name: 'company_id', default: '1' }], render: 'json' },
    { id: 'company-images',    name: 'Images',           path: '/company/{company_id}/images',          pathParams: [{ name: 'company_id', default: '1' }], render: 'images' },
  ]},
  { category: 'Networks', endpoints: [
    { id: 'network-details',   name: 'Details',          path: '/network/{network_id}',                 pathParams: [{ name: 'network_id', default: '213' }], render: 'json' },
    { id: 'network-alt-names', name: 'Alternative Names',path: '/network/{network_id}/alternative_names',pathParams: [{ name: 'network_id', default: '213' }], render: 'json' },
    { id: 'network-images',    name: 'Images',           path: '/network/{network_id}/images',          pathParams: [{ name: 'network_id', default: '213' }], render: 'images' },
  ]},
  { category: 'Keywords', endpoints: [
    { id: 'keyword-details', name: 'Details',         path: '/keyword/{keyword_id}',        pathParams: [{ name: 'keyword_id', default: '3417' }], render: 'json' },
    { id: 'keyword-movies',  name: 'Keyword Movies',  path: '/keyword/{keyword_id}/movies', pathParams: [{ name: 'keyword_id', default: '3417' }], query: [PAGE, LANG], render: 'media' },
  ]},
  { category: 'Genres', endpoints: [
    { id: 'genre-movie', name: 'Movie Genres', path: '/genre/movie/list', query: [LANG], render: 'json' },
    { id: 'genre-tv',    name: 'TV Genres',    path: '/genre/tv/list',    query: [LANG], render: 'json' },
  ]},
  { category: 'Credits', endpoints: [
    { id: 'credit-details', name: 'Credit Details', path: '/credit/{credit_id}', pathParams: [{ name: 'credit_id', placeholder: 'credit id' }], render: 'json' },
  ]},
  { category: 'Reviews', endpoints: [
    { id: 'review-details', name: 'Review Details', path: '/review/{review_id}', pathParams: [{ name: 'review_id', placeholder: 'review id' }], render: 'json' },
  ]},
  { category: 'Lists', endpoints: [
    { id: 'list-details',     name: 'List Details',      path: '/list/{list_id}',                  pathParams: [{ name: 'list_id', placeholder: 'list id' }], query: [LANG, PAGE], render: 'json' },
    { id: 'list-item-status', name: 'List Item Status',  path: '/list/{list_id}/item_status',      pathParams: [{ name: 'list_id', placeholder: 'list id' }], query: [{ name: 'movie_id', required: true }], render: 'json' },
  ]},
  { category: 'Find', endpoints: [
    { id: 'find', name: 'Find by External ID', path: '/find/{external_id}', pathParams: [{ name: 'external_id', default: 'tt0111161', placeholder: 'imdb/tvdb id' }], query: [{ name: 'external_source', default: 'imdb_id' }, LANG], render: 'media' },
  ]},
  { category: 'Certifications', endpoints: [
    { id: 'cert-movie', name: 'Movie Certifications', path: '/certification/movie/list', render: 'json' },
    { id: 'cert-tv',    name: 'TV Certifications',    path: '/certification/tv/list',    render: 'json' },
  ]},
  { category: 'Watch Providers', endpoints: [
    { id: 'wp-regions', name: 'Available Regions',     path: '/watch/providers/regions', query: [LANG], render: 'json' },
    { id: 'wp-movie',   name: 'Movie Providers',       path: '/watch/providers/movie',   query: [LANG, { name: 'watch_region' }], render: 'json' },
    { id: 'wp-tv',      name: 'TV Providers',          path: '/watch/providers/tv',      query: [LANG, { name: 'watch_region' }], render: 'json' },
  ]},
  { category: 'Changes', endpoints: [
    { id: 'changes-movie',  name: 'Movie Change List',  path: '/movie/changes',  query: [{ name: 'start_date' }, { name: 'end_date' }, PAGE], render: 'json' },
    { id: 'changes-tv',     name: 'TV Change List',     path: '/tv/changes',     query: [{ name: 'start_date' }, { name: 'end_date' }, PAGE], render: 'json' },
    { id: 'changes-person', name: 'Person Change List', path: '/person/changes', query: [{ name: 'start_date' }, { name: 'end_date' }, PAGE], render: 'json' },
  ]},
  { category: 'Configuration', endpoints: [
    { id: 'config-api',       name: 'API Configuration',   path: '/configuration',                     render: 'json' },
    { id: 'config-countries', name: 'Countries',           path: '/configuration/countries',           query: [LANG], render: 'json' },
    { id: 'config-jobs',      name: 'Jobs',                path: '/configuration/jobs',                render: 'json' },
    { id: 'config-languages', name: 'Languages',           path: '/configuration/languages',           render: 'json' },
    { id: 'config-translations',name: 'Primary Translations',path: '/configuration/primary_translations',render: 'json' },
    { id: 'config-timezones', name: 'Timezones',           path: '/configuration/timezones',           render: 'json' },
  ]},
]

export const ALL_ENDPOINTS: Endpoint[] = TMDB_CATALOG.flatMap((g) => g.endpoints)
export const ENDPOINT_COUNT = ALL_ENDPOINTS.length
