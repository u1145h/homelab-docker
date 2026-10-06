package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"
)

var httpClient = &http.Client{
	Timeout: 12 * time.Second,
}

// SearchDuckDuckGo performs a live web search using DuckDuckGo Instant Answers, Wikipedia, and HTML search fallback.
func SearchDuckDuckGo(ctx context.Context, query string, maxResults int) (string, error) {
	if maxResults <= 0 {
		maxResults = 5
	}
	if maxResults > 10 {
		maxResults = 10
	}

	cleanQuery := strings.TrimSpace(query)
	if cleanQuery == "" {
		return "Please provide a search query.", nil
	}

	var findings []string

	// ── 1. DuckDuckGo Instant Answer API (Zero-Click Facts & Summary) ──
	iaURL := fmt.Sprintf("https://api.duckduckgo.com/?q=%s&format=json&no_html=1&skip_disambig=1", url.QueryEscape(cleanQuery))
	reqIA, err := http.NewRequestWithContext(ctx, "GET", iaURL, nil)
	if err == nil {
		reqIA.Header.Set("User-Agent", "KuroAssistant/2.0 (Homelab Live Search)")
		respIA, errDo := httpClient.Do(reqIA)
		if errDo == nil {
			defer respIA.Body.Close()
			if respIA.StatusCode == http.StatusOK {
				var ia struct {
					Heading        string `json:"Heading"`
					AbstractText   string `json:"AbstractText"`
					AbstractSource string `json:"AbstractSource"`
					AbstractURL    string `json:"AbstractURL"`
					Answer         string `json:"Answer"`
					RelatedTopics  []struct {
						Text     string `json:"Text"`
						FirstURL string `json:"FirstURL"`
					} `json:"RelatedTopics"`
				}
				if json.NewDecoder(respIA.Body).Decode(&ia) == nil {
					if ia.Answer != "" {
						findings = append(findings, fmt.Sprintf("Direct Answer: %s", ia.Answer))
					}
					if ia.AbstractText != "" {
						sourceStr := ""
						if ia.AbstractSource != "" && ia.AbstractURL != "" {
							sourceStr = fmt.Sprintf("\nSource: [%s](%s)", ia.AbstractSource, ia.AbstractURL)
						}
						findings = append(findings, fmt.Sprintf("Summary (%s):\n%s%s", ia.Heading, ia.AbstractText, sourceStr))
					}
					if len(ia.RelatedTopics) > 0 && len(findings) < maxResults {
						var related []string
						for idx, rt := range ia.RelatedTopics {
							if idx >= 3 || rt.Text == "" {
								break
							}
							related = append(related, fmt.Sprintf("- %s", rt.Text))
						}
						if len(related) > 0 {
							findings = append(findings, "Key Highlights:\n"+strings.Join(related, "\n"))
						}
					}
				}
			}
		}
	}

	// ── 2. Wikipedia Integration (Encyclopedic facts, people, places, docs) ──
	wikiSummary, wikiErr := FetchWikipediaSummary(ctx, cleanQuery)
	if wikiErr == nil && wikiSummary != "" && !strings.HasPrefix(wikiSummary, "No Wikipedia article") {
		findings = append(findings, wikiSummary)
	}

	// ── 3. DuckDuckGo HTML / Web Search ──
	searchURL := fmt.Sprintf("https://html.duckduckgo.com/html/?q=%s", url.QueryEscape(cleanQuery))
	reqHTML, err := http.NewRequestWithContext(ctx, "GET", searchURL, nil)
	if err == nil {
		reqHTML.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")
		reqHTML.Header.Set("Accept-Language", "en-US,en;q=0.9")
		reqHTML.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")

		respHTML, errDo := httpClient.Do(reqHTML)
		if errDo == nil {
			defer respHTML.Body.Close()
			if respHTML.StatusCode == http.StatusOK {
				bodyBytes, _ := io.ReadAll(io.LimitReader(respHTML.Body, 512*1024))
				htmlContent := string(bodyBytes)

				type SearchResult struct {
					Title   string
					Snippet string
					URL     string
				}
				var webResults []SearchResult
				stripTags := regexp.MustCompile(`<[^>]*>`)

				reResult := regexp.MustCompile(`(?s)<a class="result__url"[^>]*href="([^"]+)"[^>]*>.*?</a>.*?<a class="result__snippet"[^>]*>(.*?)</a>`)
				matches := reResult.FindAllStringSubmatch(htmlContent, maxResults)

				for _, m := range matches {
					rawURL := strings.TrimSpace(m[1])
					if strings.Contains(rawURL, "uddg=") {
						if u, errParse := url.Parse(rawURL); errParse == nil {
							if actualURL := u.Query().Get("uddg"); actualURL != "" {
								rawURL = actualURL
							}
						}
					}
					snippet := strings.TrimSpace(stripTags.ReplaceAllString(m[2], ""))
					snippet = cleanHTMLEntities(snippet)
					if snippet != "" {
						webResults = append(webResults, SearchResult{
							Snippet: snippet,
							URL:     rawURL,
						})
					}
				}

				if len(webResults) == 0 {
					reSnippet := regexp.MustCompile(`(?s)<a class="result__snippet"[^>]*>(.*?)</a>`)
					for _, sm := range reSnippet.FindAllStringSubmatch(htmlContent, maxResults) {
						snip := strings.TrimSpace(stripTags.ReplaceAllString(sm[1], ""))
						snip = cleanHTMLEntities(snip)
						if snip != "" {
							webResults = append(webResults, SearchResult{
								Snippet: snip,
							})
						}
					}
				}

				if len(webResults) > 0 {
					var sb strings.Builder
					sb.WriteString("Web Results:\n")
					for i, r := range webResults {
						sb.WriteString(fmt.Sprintf("%d. %s\n", i+1, r.Snippet))
						if r.URL != "" {
							sb.WriteString(fmt.Sprintf("   Source: %s\n", r.URL))
						}
					}
					findings = append(findings, strings.TrimSpace(sb.String()))
				}
			}
		}
	}

	if len(findings) == 0 {
		return fmt.Sprintf("No live web or encyclopedic results found for query: %q", cleanQuery), nil
	}

	return fmt.Sprintf("Live Internet Search & Reference for %q:\n\n%s", cleanQuery, strings.Join(findings, "\n\n---\n\n")), nil
}

// FetchWikipediaSummary queries Wikipedia's OpenSearch and REST API for a topic summary.
func FetchWikipediaSummary(ctx context.Context, query string) (string, error) {
	cleanQuery := strings.TrimSpace(query)
	// Remove common question fluff for better Wikipedia title resolution
	for _, prefix := range []string{
		"who is the ", "who is ", "who was the ", "who was ",
		"what is the ", "what is ", "what are ", "what was ",
		"tell me about ", "tell me ", "where is ", "how does ",
		"explain ", "search for ", "wikipedia ",
	} {
		if strings.HasPrefix(strings.ToLower(cleanQuery), prefix) {
			cleanQuery = strings.TrimSpace(cleanQuery[len(prefix):])
			break
		}
	}
	cleanQuery = strings.TrimSuffix(cleanQuery, "?")

	// Step 1: Resolve canonical Wikipedia Title using OpenSearch API
	resolvedTitle := cleanQuery
	searchURL := fmt.Sprintf("https://en.wikipedia.org/w/api.php?action=opensearch&search=%s&limit=3&namespace=0&format=json", url.QueryEscape(cleanQuery))
	reqSearch, err := http.NewRequestWithContext(ctx, "GET", searchURL, nil)
	if err == nil {
		reqSearch.Header.Set("User-Agent", "KuroAssistant/2.0 (Homelab Knowledge Search; contact@homelab.local)")
		respSearch, errDo := httpClient.Do(reqSearch)
		if errDo == nil {
			defer respSearch.Body.Close()
			var raw []any
			if json.NewDecoder(respSearch.Body).Decode(&raw) == nil && len(raw) >= 4 {
				if titles, ok := raw[1].([]any); ok && len(titles) > 0 {
					if primaryTitle, ok := titles[0].(string); ok && primaryTitle != "" {
						resolvedTitle = primaryTitle
					}
				}
			}
		}
	}

	// Step 2: Fetch Article Summary
	apiURL := fmt.Sprintf("https://en.wikipedia.org/api/rest_v1/page/summary/%s", url.PathEscape(resolvedTitle))
	reqSummary, err := http.NewRequestWithContext(ctx, "GET", apiURL, nil)
	if err != nil {
		return "", err
	}
	reqSummary.Header.Set("User-Agent", "KuroAssistant/2.0 (Homelab Knowledge Search; contact@homelab.local)")

	respSummary, err := httpClient.Do(reqSummary)
	if err != nil {
		return "", fmt.Errorf("wikipedia request failed: %w", err)
	}
	defer respSummary.Body.Close()

	if respSummary.StatusCode != http.StatusOK {
		return fmt.Sprintf("No Wikipedia article found for %q", query), nil
	}

	var data struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		Extract     string `json:"extract"`
		ContentURLs struct {
			Desktop struct {
				Page string `json:"page"`
			} `json:"desktop"`
		} `json:"content_urls"`
	}

	if err := json.NewDecoder(respSummary.Body).Decode(&data); err != nil {
		return "", err
	}

	if data.Extract == "" {
		return fmt.Sprintf("No summary available on Wikipedia for %q", query), nil
	}

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("📖 **Wikipedia Reference: %s**\n", data.Title))
	if data.Description != "" {
		sb.WriteString(fmt.Sprintf("*%s*\n\n", data.Description))
	} else {
		sb.WriteString("\n")
	}
	sb.WriteString(data.Extract)
	if data.ContentURLs.Desktop.Page != "" {
		sb.WriteString(fmt.Sprintf("\n\nSource: %s", data.ContentURLs.Desktop.Page))
	}

	return sb.String(), nil
}

// FetchAndCleanWebPage fetches a public web page and extracts readable text.
func FetchAndCleanWebPage(ctx context.Context, targetURL string) (string, error) {
	if !strings.HasPrefix(targetURL, "http://") && !strings.HasPrefix(targetURL, "https://") {
		targetURL = "https://" + targetURL
	}

	req, err := http.NewRequestWithContext(ctx, "GET", targetURL, nil)
	if err != nil {
		return "", err
	}

	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")

	resp, err := httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("fetching URL failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Sprintf("HTTP error %d when fetching %s", resp.StatusCode, targetURL), nil
	}

	bodyBytes, err := io.ReadAll(io.LimitReader(resp.Body, 1024*1024)) // Limit to 1MB
	if err != nil {
		return "", err
	}

	html := string(bodyBytes)

	// Remove scripts, styles, head, nav, footer
	reScript := regexp.MustCompile(`(?is)<script.*?</script>`)
	reStyle := regexp.MustCompile(`(?is)<style.*?</style>`)
	reHead := regexp.MustCompile(`(?is)<head.*?</head>`)
	reNav := regexp.MustCompile(`(?is)<nav.*?</nav>`)
	reFooter := regexp.MustCompile(`(?is)<footer.*?</footer>`)
	reTags := regexp.MustCompile(`<[^>]*>`)
	reSpaces := regexp.MustCompile(`[ \t\r\f]+`)
	reNewlines := regexp.MustCompile(`\n{3,}`)

	clean := reScript.ReplaceAllString(html, "")
	clean = reStyle.ReplaceAllString(clean, "")
	clean = reHead.ReplaceAllString(clean, "")
	clean = reNav.ReplaceAllString(clean, "")
	clean = reFooter.ReplaceAllString(clean, "")
	clean = reTags.ReplaceAllString(clean, " ")
	clean = cleanHTMLEntities(clean)
	clean = reSpaces.ReplaceAllString(clean, " ")
	clean = strings.TrimSpace(clean)

	lines := strings.Split(clean, "\n")
	var meaningfulLines []string
	for _, l := range lines {
		t := strings.TrimSpace(l)
		if len(t) > 20 {
			meaningfulLines = append(meaningfulLines, t)
		}
	}

	resultText := strings.Join(meaningfulLines, "\n\n")
	resultText = reNewlines.ReplaceAllString(resultText, "\n\n")

	if len(resultText) > 4000 {
		resultText = resultText[:4000] + "\n...[content truncated for length]"
	}

	if resultText == "" {
		return fmt.Sprintf("Web page at %s returned no readable text content.", targetURL), nil
	}

	return fmt.Sprintf("Content from %s:\n\n%s", targetURL, resultText), nil
}

func cleanHTMLEntities(s string) string {
	s = strings.ReplaceAll(s, "&nbsp;", " ")
	s = strings.ReplaceAll(s, "&amp;", "&")
	s = strings.ReplaceAll(s, "&lt;", "<")
	s = strings.ReplaceAll(s, "&gt;", ">")
	s = strings.ReplaceAll(s, "&quot;", "\"")
	s = strings.ReplaceAll(s, "&#x27;", "'")
	s = strings.ReplaceAll(s, "&#39;", "'")
	s = strings.ReplaceAll(s, "&apos;", "'")
	return s
}
