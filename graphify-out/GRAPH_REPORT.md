# Graph Report - .  (2026-04-17)

## Corpus Check
- Corpus is ~38,517 words - fits in a single context window. You may not need a graph.

## Summary
- 91 nodes · 122 edges · 20 communities detected
- Extraction: 89% EXTRACTED · 11% INFERRED · 0% AMBIGUOUS · INFERRED: 13 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_autoFixStructure()|autoFixStructure()]]
- [[_COMMUNITY_syncAndDeploy()|syncAndDeploy()]]
- [[_COMMUNITY_search.js|search.js]]
- [[_COMMUNITY_fetchNewsContext()|fetchNewsContext()]]
- [[_COMMUNITY_getNestedHtmlFiles()|getNestedHtmlFiles()]]
- [[_COMMUNITY_sources.js|sources.js]]
- [[_COMMUNITY_buildHeroImageHtml()|buildHeroImageHtml()]]
- [[_COMMUNITY_callGroq()|callGroq()]]
- [[_COMMUNITY_daily-post.js|daily-post.js]]
- [[_COMMUNITY_getHtmlFiles()|getHtmlFiles()]]
- [[_COMMUNITY_extract()|extract()]]
- [[_COMMUNITY_generateSitemap()|generateSitemap()]]
- [[_COMMUNITY_getHtmlFiles()|getHtmlFiles()]]
- [[_COMMUNITY_getFiles()|getFiles()]]
- [[_COMMUNITY_getHtmlFiles()|getHtmlFiles()]]
- [[_COMMUNITY_getHtmlFiles()|getHtmlFiles()]]
- [[_COMMUNITY_getHtmlFiles()|getHtmlFiles()]]
- [[_COMMUNITY_getAllHtmlFiles()|getAllHtmlFiles()]]
- [[_COMMUNITY_inject-hero.js|inject-hero.js]]
- [[_COMMUNITY_config.js|config.js]]

## God Nodes (most connected - your core abstractions)
1. `run()` - 12 edges
2. `callGroq()` - 8 edges
3. `handler()` - 5 edges
4. `run()` - 5 edges
5. `publishDraft()` - 5 edges
6. `fetchLatestNews()` - 5 edges
7. `firstFactCheck()` - 4 edges
8. `callGroq()` - 4 edges
9. `processBlog()` - 4 edges
10. `getGroundedSources()` - 4 edges

## Surprising Connections (you probably didn't know these)
- `run()` --calls--> `fetchLatestNews()`  [INFERRED]
  scripts\generate-blog.js → scripts\lib\sources.js
- `run()` --calls--> `getGroundedSources()`  [INFERRED]
  scripts\generate-blog.js → scripts\lib\sources.js
- `syncAndDeploy()` --calls--> `publishAllDrafts()`  [INFERRED]
  scripts\publish.js → scripts\lib\publisher.js
- `syncBlogIndex()` --calls--> `getFiles()`  [INFERRED]
  scripts\lib\utils.js → scan-blog.js
- `run()` --calls--> `processBlog()`  [INFERRED]
  scripts\autolink.js → scripts\lib\linker-engine.js

## Communities

### Community 0 - "autoFixStructure()"
Cohesion: 0.24
Nodes (14): autoFixStructure(), loadHistory(), run(), assembleDraftContent(), callGroq(), dataSanitizer(), discoverKeywords(), draftProfessionalBlog() (+6 more)

### Community 1 - "syncAndDeploy()"
Cohesion: 0.25
Nodes (3): syncAndDeploy(), getFiles(), syncBlogIndex()

### Community 2 - "search.js"
Cohesion: 0.57
Nodes (6): buildEnhancedOffers(), fetchAllCoinGeckoData(), fetchWithTimeout(), getCurrentSlot(), getNextSlotTime(), handler()

### Community 3 - "fetchNewsContext()"
Cohesion: 0.52
Nodes (6): fetchNewsContext(), fetchPerformanceData(), fetchUpcomingProjects(), formatTableRows(), formatUpcoming(), run()

### Community 4 - "getNestedHtmlFiles()"
Cohesion: 0.43
Nodes (5): getNestedHtmlFiles(), run(), callGroq(), isValidUrl(), processBlog()

### Community 5 - "sources.js"
Cohesion: 0.57
Nodes (6): fetchLatestNews(), fetchProtocolDetails(), fetchTrendingCoins(), getGroundedSources(), readCache(), writeCache()

### Community 6 - "buildHeroImageHtml()"
Cohesion: 0.6
Nodes (5): buildHeroImageHtml(), computePaths(), parseDraft(), publishAllDrafts(), publishDraft()

### Community 7 - "callGroq()"
Cohesion: 0.7
Nodes (4): callGroq(), factCheck(), generateDraft(), polishArticle()

### Community 8 - "daily-post.js"
Cohesion: 1.0
Nodes (3): getCurrentSlot(), getNextSlotTime(), handler()

### Community 9 - "getHtmlFiles()"
Cohesion: 0.67
Nodes (0): 

### Community 10 - "extract()"
Cohesion: 0.67
Nodes (0): 

### Community 11 - "generateSitemap()"
Cohesion: 1.0
Nodes (2): generateSitemap(), getHtmlFilesRecursive()

### Community 12 - "getHtmlFiles()"
Cohesion: 1.0
Nodes (0): 

### Community 13 - "getFiles()"
Cohesion: 1.0
Nodes (0): 

### Community 14 - "getHtmlFiles()"
Cohesion: 1.0
Nodes (0): 

### Community 15 - "getHtmlFiles()"
Cohesion: 1.0
Nodes (0): 

### Community 16 - "getHtmlFiles()"
Cohesion: 1.0
Nodes (0): 

### Community 17 - "getAllHtmlFiles()"
Cohesion: 1.0
Nodes (0): 

### Community 18 - "inject-hero.js"
Cohesion: 1.0
Nodes (0): 

### Community 19 - "config.js"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **Thin community `getHtmlFiles()`** (2 nodes): `getHtmlFiles()`, `find-missing-images.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `getFiles()`** (2 nodes): `getFiles()`, `fix-blog.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `getHtmlFiles()`** (2 nodes): `getHtmlFiles()`, `fix-internal-links.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `getHtmlFiles()`** (2 nodes): `getHtmlFiles()`, `manual-linker-2.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `getHtmlFiles()`** (2 nodes): `getHtmlFiles()`, `manual-linker.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `getAllHtmlFiles()`** (2 nodes): `getAllHtmlFiles()`, `patch-headers.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `inject-hero.js`** (1 nodes): `inject-hero.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `config.js`** (1 nodes): `config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `run()` connect `autoFixStructure()` to `sources.js`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Why does `fetchLatestNews()` connect `sources.js` to `autoFixStructure()`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Why does `syncAndDeploy()` connect `syncAndDeploy()` to `buildHeroImageHtml()`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **Are the 9 inferred relationships involving `run()` (e.g. with `fetchLatestNews()` and `discoverKeywords()`) actually correct?**
  _`run()` has 9 INFERRED edges - model-reasoned connections that need verification._