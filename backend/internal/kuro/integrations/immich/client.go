package immich

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

// ImmichConfig holds connection settings for the Immich server
type ImmichConfig struct {
	URL    string `json:"url"`
	APIKey string `json:"api_key"`
}

// ImmichAsset represents an asset (image/video) stored on Immich
type ImmichAsset struct {
	ID             string    `json:"id"`
	DeviceAssetID  string    `json:"deviceAssetId,omitempty"`
	OwnerID        string    `json:"ownerId,omitempty"`
	Type           string    `json:"type"` // "IMAGE" | "VIDEO"
	OriginalFileName string  `json:"originalFileName"`
	TakenAt        time.Time `json:"fileCreatedAt"`
	City           string    `json:"city,omitempty"`
	State          string    `json:"state,omitempty"`
	Country        string    `json:"country,omitempty"`
	Description    string    `json:"description,omitempty"`
	IsFavorite     bool      `json:"isFavorite"`
	Duration       string    `json:"duration,omitempty"`
	Width          int       `json:"width,omitempty"`
	Height         int       `json:"height,omitempty"`
	LivePhotoVideoID string  `json:"livePhotoVideoId,omitempty"`
}

// ImmichAlbum represents a photo album in Immich
type ImmichAlbum struct {
	ID                    string `json:"id"`
	AlbumName             string `json:"albumName"`
	Description           string `json:"description,omitempty"`
	AssetCount            int    `json:"assetCount"`
	AlbumThumbnailAssetID string `json:"albumThumbnailAssetId,omitempty"`
	CreatedAt             string `json:"createdAt,omitempty"`
	UpdatedAt             string `json:"updatedAt,omitempty"`
}

// ImmichPerson represents a recognized or named person in Immich
type ImmichPerson struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	BirthDate     string `json:"birthDate,omitempty"`
	ThumbnailPath string `json:"thumbnailPath,omitempty"`
	IsHidden      bool   `json:"isHidden"`
}

// SearchPhotoFilter holds parameters for searching photos
type SearchPhotoFilter struct {
	Query      string `json:"query,omitempty"`
	Year       int    `json:"year,omitempty"`
	Month      int    `json:"month,omitempty"`
	Day        int    `json:"day,omitempty"`
	Date       string `json:"date,omitempty"` // YYYY-MM-DD
	Location   string `json:"location,omitempty"`
	City       string `json:"city,omitempty"`
	State      string `json:"state,omitempty"`
	Country    string `json:"country,omitempty"`
	IsFavorite *bool  `json:"is_favorite,omitempty"`
	Type       string `json:"type,omitempty"` // "IMAGE" | "VIDEO"
	Limit      int    `json:"limit,omitempty"`
}

// ServerVersion represents Immich version info
type ServerVersion struct {
	Major int `json:"major"`
	Minor int `json:"minor"`
	Patch int `json:"patch"`
}

func (v ServerVersion) String() string {
	return fmt.Sprintf("v%d.%d.%d", v.Major, v.Minor, v.Patch)
}

// NormalizeURL cleans up base Immich URL
func NormalizeURL(rawURL string) string {
	u := strings.TrimSpace(rawURL)
	if u == "" {
		return "http://127.0.0.1:2283"
	}
	if !strings.HasPrefix(u, "http://") && !strings.HasPrefix(u, "https://") {
		u = "http://" + u
	}
	u = strings.TrimRight(u, "/")
	if strings.HasSuffix(u, "/api") {
		u = strings.TrimSuffix(u, "/api")
	}
	return u
}

func newRequest(method, endpoint string, config ImmichConfig, body io.Reader) (*http.Request, error) {
	baseURL := NormalizeURL(config.URL)
	targetURL := fmt.Sprintf("%s%s", baseURL, endpoint)

	req, err := http.NewRequest(method, targetURL, body)
	if err != nil {
		return nil, err
	}
	if config.APIKey != "" {
		req.Header.Set("x-api-key", config.APIKey)
	}
	req.Header.Set("Accept", "application/json")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	return req, nil
}

// ValidateConnection checks if Immich is reachable and validates the API key
func ValidateConnection(config ImmichConfig) (string, error) {
	client := &http.Client{Timeout: 8 * time.Second}

	req, err := newRequest("GET", "/api/server/version", config, nil)
	if err != nil {
		return "", err
	}

	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("connection error: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return "", fmt.Errorf("invalid or unauthorized API key")
	}
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("server returned HTTP %d", resp.StatusCode)
	}

	var version ServerVersion
	if err := json.NewDecoder(resp.Body).Decode(&version); err == nil && version.Major > 0 {
		return version.String(), nil
	}
	return "Connected", nil
}

// SearchPhotos queries Immich assets by date, location, or smart semantic search
func SearchPhotos(config ImmichConfig, filter SearchPhotoFilter) ([]ImmichAsset, error) {
	client := &http.Client{Timeout: 15 * time.Second}

	limit := filter.Limit
	if limit <= 0 {
		limit = 20
	}
	if limit > 50 {
		limit = 50
	}

	qRaw := strings.TrimSpace(filter.Query)
	qLower := strings.ToLower(qRaw)
	// Clean query from generic assistant wrappers
	qClean := strings.TrimSpace(strings.ReplaceAll(strings.ReplaceAll(qLower, "from immich", ""), "in immich", ""))
	qClean = strings.TrimSpace(strings.ReplaceAll(qClean, "from my gallery", ""))
	qClean = strings.TrimSpace(strings.ReplaceAll(qClean, "in my gallery", ""))
	qClean = strings.TrimSpace(strings.ReplaceAll(qClean, "immich", ""))

	isRecentIntent := qClean == "" || qClean == "recent" || qClean == "latest" || qClean == "newest" ||
		qClean == "gallery" || qClean == "photos" || qClean == "my photos" || qClean == "my gallery" ||
		qClean == "last" || qClean == "all" || qClean == "recent photos" || qClean == "latest photos"

	// 1. If explicit recent/latest query with no date or location filters, directly retrieve newest assets
	if isRecentIntent && filter.Year == 0 && filter.Date == "" && filter.City == "" && filter.Country == "" && filter.Location == "" {
		return GetRecentAssets(config, limit)
	}

	// 2. If semantic visual query is provided (e.g., "sunset", "dog", "food", "beach"), use Smart Search (/api/search/smart)
	if qClean != "" && !isRecentIntent {
		smartURL := fmt.Sprintf("/api/search/smart?query=%s&size=%d", url.QueryEscape(qClean), 50)
		req, err := newRequest("GET", smartURL, config, nil)
		if err == nil {
			if resp, err := client.Do(req); err == nil && resp.StatusCode == http.StatusOK {
				defer resp.Body.Close()
				var smartResult struct {
					Assets struct {
						Items []rawAssetItem `json:"items"`
					} `json:"assets"`
				}
				if json.NewDecoder(resp.Body).Decode(&smartResult) == nil {
					parsed := parseRawAssets(smartResult.Assets.Items)
					// If temporal/spatial filters were also combined with visual query (e.g., "sunset from 2024 in Tokyo")
					if filter.Year > 0 || filter.Date != "" || filter.City != "" || filter.Country != "" || filter.Location != "" {
						var matched []ImmichAsset
						for _, a := range parsed {
							if filter.Year > 0 && a.TakenAt.Year() != filter.Year {
								continue
							}
							if filter.Date != "" && a.TakenAt.Format("2006-01-02") != filter.Date {
								continue
							}
							if filter.City != "" && !strings.Contains(strings.ToLower(a.City), strings.ToLower(filter.City)) {
								continue
							}
							if filter.Country != "" && !strings.Contains(strings.ToLower(a.Country), strings.ToLower(filter.Country)) {
								continue
							}
							if filter.Location != "" && !strings.Contains(strings.ToLower(a.City), strings.ToLower(filter.Location)) && !strings.Contains(strings.ToLower(a.Country), strings.ToLower(filter.Location)) {
								continue
							}
							matched = append(matched, a)
						}
						parsed = matched
					}
					if len(parsed) > limit {
						parsed = parsed[:limit]
					}
					return parsed, nil
				}
			}
		}
	}

	// 3. Otherwise query Metadata Search endpoint (/api/search/metadata)
	reqBody := map[string]any{
		"size": limit,
		"type": "IMAGE",
	}

	if filter.IsFavorite != nil {
		reqBody["isFavorite"] = *filter.IsFavorite
	}

	// Location filters
	if filter.City != "" {
		reqBody["city"] = filter.City
	} else if filter.Location != "" {
		reqBody["city"] = filter.Location
	}
	if filter.State != "" {
		reqBody["state"] = filter.State
	}
	if filter.Country != "" {
		reqBody["country"] = filter.Country
	}

	// Date filters
	if filter.Date != "" {
		if t, err := time.Parse("2006-01-02", filter.Date); err == nil {
			reqBody["takenAfter"] = t.UTC().Format(time.RFC3339)
			reqBody["takenBefore"] = t.Add(24 * time.Hour).UTC().Format(time.RFC3339)
		}
	} else if filter.Year > 0 {
		if filter.Month > 0 {
			if filter.Day > 0 {
				start := time.Date(filter.Year, time.Month(filter.Month), filter.Day, 0, 0, 0, 0, time.UTC)
				reqBody["takenAfter"] = start.Format(time.RFC3339)
				reqBody["takenBefore"] = start.Add(24 * time.Hour).Format(time.RFC3339)
			} else {
				start := time.Date(filter.Year, time.Month(filter.Month), 1, 0, 0, 0, 0, time.UTC)
				end := start.AddDate(0, 1, 0)
				reqBody["takenAfter"] = start.Format(time.RFC3339)
				reqBody["takenBefore"] = end.Format(time.RFC3339)
			}
		} else {
			start := time.Date(filter.Year, 1, 1, 0, 0, 0, 0, time.UTC)
			end := time.Date(filter.Year+1, 1, 1, 0, 0, 0, 0, time.UTC)
			reqBody["takenAfter"] = start.Format(time.RFC3339)
			reqBody["takenBefore"] = end.Format(time.RFC3339)
		}
	}

	bodyBytes, _ := json.Marshal(reqBody)
	req, err := newRequest("POST", "/api/search/metadata", config, bytes.NewReader(bodyBytes))
	if err == nil {
		if resp, err := client.Do(req); err == nil {
			defer resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				var metaResult struct {
					Assets struct {
						Items []rawAssetItem `json:"items"`
					} `json:"assets"`
				}
				if json.NewDecoder(resp.Body).Decode(&metaResult) == nil {
					parsed := parseRawAssets(metaResult.Assets.Items)
					// Strict validation: double check that returned items actually belong to the filtered date/year/month/day
					if filter.Year > 0 || filter.Month > 0 || filter.Day > 0 || filter.Date != "" {
						var validated []ImmichAsset
						for _, a := range parsed {
							if filter.Year > 0 && a.TakenAt.Year() != filter.Year {
								continue
							}
							if filter.Month > 0 && int(a.TakenAt.Month()) != filter.Month {
								continue
							}
							if filter.Day > 0 && a.TakenAt.Day() != filter.Day {
								continue
							}
							if filter.Date != "" && a.TakenAt.Format("2006-01-02") != filter.Date {
								continue
							}
							validated = append(validated, a)
						}
						parsed = validated
					}
					if len(parsed) > limit {
						parsed = parsed[:limit]
					}
					return parsed, nil
				}
			}
		}
	}

	// 4. Return clean empty result if 0 photos matched criteria (No silent unfiltered fallback)
	return []ImmichAsset{}, nil
}

type rawAssetItem struct {
	ID               string `json:"id"`
	DeviceAssetID    string `json:"deviceAssetId"`
	OwnerID          string `json:"ownerId"`
	Type             string `json:"type"`
	OriginalFileName string `json:"originalFileName"`
	FileCreatedAt    string `json:"fileCreatedAt"`
	LocalDateTime    string `json:"localDateTime"`
	IsFavorite       bool   `json:"isFavorite"`
	Duration         string `json:"duration"`
	ExifInfo         *struct {
		City             string `json:"city"`
		State            string `json:"state"`
		Country          string `json:"country"`
		Description      string `json:"description"`
		DateTimeOriginal string `json:"dateTimeOriginal"`
		ExifImageWidth   int    `json:"exifImageWidth"`
		ExifImageHeight  int    `json:"exifImageHeight"`
	} `json:"exifInfo,omitempty"`
}

func parseRawAssets(raw []rawAssetItem) []ImmichAsset {
	var assets []ImmichAsset
	for _, item := range raw {
		var t time.Time
		if item.ExifInfo != nil && item.ExifInfo.DateTimeOriginal != "" {
			t, _ = time.Parse(time.RFC3339, item.ExifInfo.DateTimeOriginal)
			if t.IsZero() {
				t, _ = time.Parse("2006-01-02T15:04:05.000Z", item.ExifInfo.DateTimeOriginal)
			}
			if t.IsZero() {
				t, _ = time.Parse("2006-01-02 15:04:05", item.ExifInfo.DateTimeOriginal)
			}
		}
		if t.IsZero() && item.LocalDateTime != "" {
			t, _ = time.Parse(time.RFC3339, item.LocalDateTime)
			if t.IsZero() {
				t, _ = time.Parse("2006-01-02T15:04:05.000Z", item.LocalDateTime)
			}
			if t.IsZero() {
				t, _ = time.Parse("2006-01-02T15:04:05", item.LocalDateTime)
			}
		}
		if t.IsZero() && item.FileCreatedAt != "" {
			t, _ = time.Parse(time.RFC3339, item.FileCreatedAt)
			if t.IsZero() {
				t, _ = time.Parse("2006-01-02T15:04:05.000Z", item.FileCreatedAt)
			}
		}

		a := ImmichAsset{
			ID:               item.ID,
			DeviceAssetID:    item.DeviceAssetID,
			OwnerID:          item.OwnerID,
			Type:             item.Type,
			OriginalFileName: item.OriginalFileName,
			TakenAt:          t,
			IsFavorite:       item.IsFavorite,
			Duration:         item.Duration,
		}
		if item.ExifInfo != nil {
			a.City = item.ExifInfo.City
			a.State = item.ExifInfo.State
			a.Country = item.ExifInfo.Country
			a.Description = item.ExifInfo.Description
			a.Width = item.ExifInfo.ExifImageWidth
			a.Height = item.ExifInfo.ExifImageHeight
		}
		assets = append(assets, a)
	}
	return assets
}

// SearchAlbums queries albums and matches against query string
func SearchAlbums(config ImmichConfig, query string) ([]ImmichAlbum, error) {
	client := &http.Client{Timeout: 10 * time.Second}

	req, err := newRequest("GET", "/api/albums", config, nil)
	if err != nil {
		return nil, err
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Immich API returned HTTP %d", resp.StatusCode)
	}

	var rawAlbums []struct {
		ID                    string `json:"id"`
		AlbumName             string `json:"albumName"`
		Description           string `json:"description"`
		AssetCount            int    `json:"assetCount"`
		AlbumThumbnailAssetID string `json:"albumThumbnailAssetId"`
		CreatedAt             string `json:"createdAt"`
		UpdatedAt             string `json:"updatedAt"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&rawAlbums); err != nil {
		return nil, err
	}

	q := strings.ToLower(strings.TrimSpace(query))
	var albums []ImmichAlbum
	for _, a := range rawAlbums {
		if q == "" || strings.Contains(strings.ToLower(a.AlbumName), q) || strings.Contains(strings.ToLower(a.Description), q) {
			albums = append(albums, ImmichAlbum{
				ID:                    a.ID,
				AlbumName:             a.AlbumName,
				Description:           a.Description,
				AssetCount:            a.AssetCount,
				AlbumThumbnailAssetID: a.AlbumThumbnailAssetID,
				CreatedAt:             a.CreatedAt,
				UpdatedAt:             a.UpdatedAt,
			})
		}
	}
	return albums, nil
}

// SearchPeople queries named or recognized people in Immich
func SearchPeople(config ImmichConfig, nameQuery string) ([]ImmichPerson, error) {
	client := &http.Client{Timeout: 10 * time.Second}

	req, err := newRequest("GET", "/api/people?withHidden=false", config, nil)
	if err != nil {
		return nil, err
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Immich API returned HTTP %d", resp.StatusCode)
	}

	var result struct {
		People []struct {
			ID            string `json:"id"`
			Name          string `json:"name"`
			BirthDate     string `json:"birthDate"`
			ThumbnailPath string `json:"thumbnailPath"`
			IsHidden      bool   `json:"isHidden"`
		} `json:"people"`
	}

	// Try unmarshaling both structure formats (array or { people: [] })
	bodyBytes, _ := io.ReadAll(resp.Body)
	_ = json.Unmarshal(bodyBytes, &result)
	if len(result.People) == 0 {
		var rawList []struct {
			ID            string `json:"id"`
			Name          string `json:"name"`
			BirthDate     string `json:"birthDate"`
			ThumbnailPath string `json:"thumbnailPath"`
			IsHidden      bool   `json:"isHidden"`
		}
		if json.Unmarshal(bodyBytes, &rawList) == nil {
			for _, p := range rawList {
				result.People = append(result.People, p)
			}
		}
	}

	q := strings.ToLower(strings.TrimSpace(nameQuery))
	var people []ImmichPerson
	for _, p := range result.People {
		if q == "" || strings.Contains(strings.ToLower(p.Name), q) {
			people = append(people, ImmichPerson{
				ID:            p.ID,
				Name:          p.Name,
				BirthDate:     p.BirthDate,
				ThumbnailPath: p.ThumbnailPath,
				IsHidden:      p.IsHidden,
			})
		}
	}
	return people, nil
}

// GetPersonAssets retrieves assets tagged with a specific person
func GetPersonAssets(config ImmichConfig, personID string, limit int) ([]ImmichAsset, error) {
	client := &http.Client{Timeout: 12 * time.Second}
	if limit <= 0 {
		limit = 12
	}

	reqBody := map[string]any{
		"personIds": []string{personID},
		"size":      limit,
		"type":      "IMAGE",
	}
	bodyBytes, _ := json.Marshal(reqBody)
	req, err := newRequest("POST", "/api/search/metadata", config, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, err
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Immich returned HTTP %d", resp.StatusCode)
	}

	var metaResult struct {
		Assets struct {
			Items []rawAssetItem `json:"items"`
		} `json:"assets"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&metaResult); err == nil && len(metaResult.Assets.Items) > 0 {
		return parseRawAssets(metaResult.Assets.Items), nil
	}
	return nil, nil
}

// GetAssetThumbnailStream fetches and returns the thumbnail stream from Immich with endpoint fallbacks
func GetAssetThumbnailStream(config ImmichConfig, assetID, size string) (io.ReadCloser, string, error) {
	client := &http.Client{Timeout: 15 * time.Second}

	if size == "" {
		size = "preview"
	}

	// Try standard Immich thumbnail endpoints
	endpoints := []string{
		fmt.Sprintf("/api/asset/thumbnail/%s?size=%s", url.PathEscape(assetID), url.QueryEscape(size)),
		fmt.Sprintf("/api/assets/%s/thumbnail?size=%s", url.PathEscape(assetID), url.QueryEscape(size)),
		fmt.Sprintf("/api/asset/file/%s", url.PathEscape(assetID)),
		fmt.Sprintf("/api/assets/%s/original", url.PathEscape(assetID)),
	}

	var lastErr error
	for _, ep := range endpoints {
		req, err := newRequest("GET", ep, config, nil)
		if err != nil {
			lastErr = err
			continue
		}
		resp, err := client.Do(req)
		if err != nil {
			lastErr = err
			continue
		}
		if resp.StatusCode == http.StatusOK {
			cType := resp.Header.Get("Content-Type")
			if cType == "" {
				cType = "image/jpeg"
			}
			return resp.Body, cType, nil
		}
		resp.Body.Close()
		lastErr = fmt.Errorf("HTTP %d on %s", resp.StatusCode, ep)
	}

	return nil, "", fmt.Errorf("failed to fetch thumbnail: %v", lastErr)
}

// GetRecentAssets fetches newest assets in reverse chronological order
func GetRecentAssets(config ImmichConfig, limit int) ([]ImmichAsset, error) {
	if limit <= 0 {
		limit = 20
	}
	client := &http.Client{Timeout: 12 * time.Second}

	// 1. Try POST /api/search/metadata with type: IMAGE
	reqBody := map[string]any{
		"size": limit,
		"type": "IMAGE",
	}
	bodyBytes, _ := json.Marshal(reqBody)
	if req, err := newRequest("POST", "/api/search/metadata", config, bytes.NewReader(bodyBytes)); err == nil {
		if resp, err := client.Do(req); err == nil {
			defer resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				var metaResult struct {
					Assets struct {
						Items []rawAssetItem `json:"items"`
					} `json:"assets"`
				}
				if json.NewDecoder(resp.Body).Decode(&metaResult) == nil && len(metaResult.Assets.Items) > 0 {
					return parseRawAssets(metaResult.Assets.Items), nil
				}
			}
		}
	}

	// 2. Try GET /api/asset?take=limit or /api/assets?take=limit
	for _, ep := range []string{fmt.Sprintf("/api/asset?take=%d", limit), fmt.Sprintf("/api/assets?take=%d", limit)} {
		if req, err := newRequest("GET", ep, config, nil); err == nil {
			if resp, err := client.Do(req); err == nil {
				defer resp.Body.Close()
				if resp.StatusCode == http.StatusOK {
					var rawItems []rawAssetItem
					if err := json.NewDecoder(resp.Body).Decode(&rawItems); err == nil && len(rawItems) > 0 {
						return parseRawAssets(rawItems), nil
					}
				}
			}
		}
	}

	return []ImmichAsset{}, nil
}

// ParseDateFilter extracts year, month, day, date, or semantic query from natural language query
func ParseDateFilter(rawQuery string) SearchPhotoFilter {
	filter := SearchPhotoFilter{}
	q := strings.TrimSpace(rawQuery)
	qLower := strings.ToLower(q)

	// Clean out generic filler prefixes
	for _, p := range []string{
		"show me photos from ", "show me photos of ", "show me photos in ", "show me photos ",
		"show photos from ", "show photos of ", "show photos in ", "show photos ",
		"photos from ", "photos of ", "photos in ", "photos ",
		"pictures from ", "pictures of ", "pictures in ", "pictures ",
		"images from ", "images of ", "images in ", "images ",
		"find photos from ", "find photos of ", "find photos in ", "find photos ",
		"get photos from ", "get photos of ", "get photos in ", "get photos ",
	} {
		if strings.HasPrefix(qLower, p) {
			qLower = strings.TrimSpace(qLower[len(p):])
			break
		}
	}

	monthMap := map[string]int{
		"january": 1, "jan": 1,
		"february": 2, "feb": 2,
		"march": 3, "mar": 3,
		"april": 4, "apr": 4,
		"may": 5,
		"june": 6, "jun": 6,
		"july": 7, "jul": 7,
		"august": 8, "aug": 8,
		"september": 9, "sep": 9, "sept": 9,
		"october": 10, "oct": 10,
		"november": 11, "nov": 11,
		"december": 12, "dec": 12,
	}

	words := strings.Fields(qLower)
	var remainingWords []string

	for _, w := range words {
		wClean := strings.Trim(w, ",.?!;:\"'")
		// Check for month name
		if mVal, ok := monthMap[wClean]; ok && filter.Month == 0 {
			filter.Month = mVal
			continue
		}
		// Check 4-digit year (e.g. 1990..2040)
		if len(wClean) == 4 {
			if yr, err := strconv.Atoi(wClean); err == nil && yr >= 1990 && yr <= 2040 && filter.Year == 0 {
				filter.Year = yr
				continue
			}
		}
		// Check day of month (e.g. 1st, 2nd, 3rd, 15th, 1..31)
		dayClean := strings.TrimSuffix(strings.TrimSuffix(strings.TrimSuffix(strings.TrimSuffix(wClean, "st"), "nd"), "rd"), "th")
		if dVal, err := strconv.Atoi(dayClean); err == nil && dVal >= 1 && dVal <= 31 && filter.Day == 0 {
			filter.Day = dVal
			continue
		}
		// Ignore prepositions like "from", "in", "of", "on", "during", "at"
		if wClean == "from" || wClean == "in" || wClean == "of" || wClean == "on" || wClean == "during" || wClean == "at" {
			continue
		}
		remainingWords = append(remainingWords, wClean)
	}

	filter.Query = strings.TrimSpace(strings.Join(remainingWords, " "))
	return filter
}
