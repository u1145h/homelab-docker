package baikal

import (
	"bytes"
	"crypto/md5"
	"crypto/rand"
	"encoding/hex"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"sort"
	"strings"
	"time"
)

// BaikalConfig represents configuration settings for connecting to a Baïkal server
type BaikalConfig struct {
	URL              string `json:"url"`
	Username         string `json:"username"`
	Password         string `json:"password"`
	DefaultCalendar  string `json:"default_calendar"`
	ReminderCalendar string `json:"reminder_calendar"`
	AddressBook      string `json:"addressbook"`
}

// DiscoveredResource represents a calendar or address book discovered from Baïkal
type DiscoveredResource struct {
	Name        string `json:"name"`
	DisplayName string `json:"display_name"`
	Href        string `json:"href"`
	Type        string `json:"type"` // "calendar" | "addressbook"
}

// DiscoveryResult returns discovery outcome and found resources
type DiscoveryResult struct {
	Success      bool                 `json:"success"`
	Error        string               `json:"error,omitempty"`
	Calendars    []DiscoveredResource `json:"calendars"`
	AddressBooks []DiscoveredResource `json:"addressbooks"`
}

// CalendarEvent represents a scheduled calendar event
type CalendarEvent struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	Description string    `json:"description,omitempty"`
	Location    string    `json:"location,omitempty"`
	StartTime   time.Time `json:"start_time"`
	EndTime     time.Time `json:"end_time"`
	IsAllDay    bool      `json:"is_all_day"`
	Calendar    string    `json:"calendar,omitempty"`
	URL         string    `json:"url,omitempty"`
	RRule       string    `json:"rrule,omitempty"`
}

// CalendarReminder represents a task or reminder (VTODO)
type CalendarReminder struct {
	ID          string     `json:"id"`
	Title       string     `json:"title"`
	Description string     `json:"description,omitempty"`
	DueDate     *time.Time `json:"due_date,omitempty"`
	Priority    int        `json:"priority,omitempty"` // 1 (high), 5 (med), 9 (low)
	Completed   bool       `json:"completed"`
	Calendar    string     `json:"calendar,omitempty"`
	URL         string     `json:"url,omitempty"`
}

// ContactItem represents a contact entry (VCARD)
type ContactItem struct {
	ID           string   `json:"id"`
	FullName     string   `json:"full_name"`
	PhoneNumbers []string `json:"phone_numbers"`
	Emails       []string `json:"emails"`
	Organization string   `json:"organization,omitempty"`
	Notes        string   `json:"notes,omitempty"`
}

// NormalizeDavURL normalizes input URLs to valid Baïkal dav.php base endpoint
func NormalizeDavURL(rawURL string) string {
	u := strings.TrimSpace(rawURL)
	if u == "" {
		return "http://127.0.0.1:3001/dav.php"
	}
	if !strings.HasPrefix(u, "http://") && !strings.HasPrefix(u, "https://") {
		u = "http://" + u
	}
	u = strings.TrimRight(u, "/")
	// If the user pasted a subpath like /calendars/... or /addressbooks/...
	if idx := strings.Index(u, "/calendars"); idx != -1 {
		u = u[:idx]
	}
	if idx := strings.Index(u, "/addressbooks"); idx != -1 {
		u = u[:idx]
	}
	if !strings.Contains(u, "/dav.php") && !strings.Contains(u, "/cal.php") && !strings.Contains(u, "/card.php") {
		u = u + "/dav.php"
	}
	return u
}

// buildCalendarItemURL constructs a clean CalDAV URL for an item in a calendar
func buildCalendarItemURL(baseURL, username, calendarName, itemID string) string {
	normBase := NormalizeDavURL(baseURL)
	cleanCal := strings.TrimSpace(calendarName)
	cleanCal = strings.Trim(cleanCal, "/")
	if strings.Contains(cleanCal, "calendars/") {
		parts := strings.Split(cleanCal, "calendars/")
		cleanCal = parts[len(parts)-1]
		if strings.Contains(cleanCal, "/") {
			parts2 := strings.Split(cleanCal, "/")
			cleanCal = parts2[len(parts2)-1]
		}
	}
	if !strings.HasSuffix(itemID, ".ics") {
		itemID = itemID + ".ics"
	}
	return fmt.Sprintf("%s/calendars/%s/%s/%s", normBase, url.PathEscape(username), url.PathEscape(cleanCal), itemID)
}

// md5Hex computes MD5 checksum string
func md5Hex(data string) string {
	h := md5.Sum([]byte(data))
	return hex.EncodeToString(h[:])
}

// parseDigestHeader extracts challenge parameters from WWW-Authenticate
func parseDigestHeader(header string) map[string]string {
	params := make(map[string]string)
	if !strings.HasPrefix(strings.ToLower(header), "digest ") {
		return params
	}
	raw := strings.TrimSpace(header[7:])
	// Match key="quoted_value" or key=unquoted_value
	re := regexp.MustCompile(`([a-zA-Z0-9_-]+)=(?:"([^"]*)"|([^,\s]+))`)
	matches := re.FindAllStringSubmatch(raw, -1)
	for _, m := range matches {
		if len(m) >= 4 {
			val := m[2]
			if val == "" {
				val = m[3]
			}
			params[strings.ToLower(m[1])] = val
		}
	}
	return params
}

// computeDigestAuth creates an RFC 7616 / RFC 2617 Authorization header value
func computeDigestAuth(username, password, method, uri string, params map[string]string) string {
	realm := params["realm"]
	nonce := params["nonce"]
	qop := params["qop"]
	opaque := params["opaque"]

	ha1 := md5Hex(fmt.Sprintf("%s:%s:%s", username, realm, password))
	ha2 := md5Hex(fmt.Sprintf("%s:%s", method, uri))

	if strings.Contains(qop, "auth") {
		nc := "00000001"
		b := make([]byte, 8)
		_, _ = rand.Read(b)
		cnonce := hex.EncodeToString(b)

		response := md5Hex(fmt.Sprintf("%s:%s:%s:%s:auth:%s", ha1, nonce, nc, cnonce, ha2))
		authHdr := fmt.Sprintf(`Digest username="%s", realm="%s", nonce="%s", uri="%s", qop=auth, nc=%s, cnonce="%s", response="%s"`,
			username, realm, nonce, uri, nc, cnonce, response)
		if opaque != "" {
			authHdr += fmt.Sprintf(`, opaque="%s"`, opaque)
		}
		return authHdr
	}

	response := md5Hex(fmt.Sprintf("%s:%s:%s", ha1, nonce, ha2))
	authHdr := fmt.Sprintf(`Digest username="%s", realm="%s", nonce="%s", uri="%s", response="%s"`,
		username, realm, nonce, uri, response)
	if opaque != "" {
		authHdr += fmt.Sprintf(`, opaque="%s"`, opaque)
	}
	return authHdr
}

// doDavRequest executes an HTTP request with automatic Basic Auth and Digest Auth fallback
func doDavRequest(client *http.Client, method, targetURL, username, password string, bodyBytes []byte, headers map[string]string) (*http.Response, error) {
	parsed, err := url.Parse(targetURL)
	if err != nil {
		return nil, err
	}
	reqURI := parsed.RequestURI()
	if reqURI == "" {
		reqURI = "/"
	}

	// 1. Initial attempt with Basic Auth
	var bodyReader io.Reader
	if len(bodyBytes) > 0 {
		bodyReader = bytes.NewReader(bodyBytes)
	}
	req, err := http.NewRequest(method, targetURL, bodyReader)
	if err != nil {
		return nil, err
	}
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	if username != "" || password != "" {
		req.SetBasicAuth(username, password)
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}

	// 2. If 401 Unauthorized with Digest challenge, compute Digest Auth and retry
	if resp.StatusCode == http.StatusUnauthorized {
		authHdr := resp.Header.Get("WWW-Authenticate")
		if strings.Contains(strings.ToLower(authHdr), "digest ") {
			resp.Body.Close()
			params := parseDigestHeader(authHdr)
			digestValue := computeDigestAuth(username, password, method, reqURI, params)

			var retryBody io.Reader
			if len(bodyBytes) > 0 {
				retryBody = bytes.NewReader(bodyBytes)
			}
			req2, err := http.NewRequest(method, targetURL, retryBody)
			if err != nil {
				return nil, err
			}
			for k, v := range headers {
				req2.Header.Set(k, v)
			}
			req2.Header.Set("Authorization", digestValue)
			return client.Do(req2)
		}
	}

	return resp, nil
}

// XML structures for PROPFIND response parsing
type multistatus struct {
	XMLName   xml.Name   `xml:"multistatus"`
	Responses []response `xml:"response"`
}

type response struct {
	Href     string     `xml:"href"`
	Propstat []propstat `xml:"propstat"`
}

type propstat struct {
	Prop   prop   `xml:"prop"`
	Status string `xml:"status"`
}

type prop struct {
	DisplayName  string       `xml:"displayname"`
	Resourcetype resourcetype `xml:"resourcetype"`
}

type resourcetype struct {
	Calendar    *xml.Name `xml:"calendar"`
	Addressbook *xml.Name `xml:"addressbook"`
	Collection  *xml.Name `xml:"collection"`
}

// Discover queries Baïkal to find all available calendars and address books
func Discover(config BaikalConfig) (DiscoveryResult, error) {
	result := DiscoveryResult{
		Calendars:    []DiscoveredResource{},
		AddressBooks: []DiscoveredResource{},
	}

	baseURL := NormalizeDavURL(config.URL)
	client := &http.Client{Timeout: 10 * time.Second}

	// 1. Discover Calendars
	calURL := fmt.Sprintf("%s/calendars/%s/", baseURL, url.PathEscape(config.Username))
	propfindXML := `<?xml version="1.0" encoding="utf-8" ?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:displayname />
    <d:resourcetype />
  </d:prop>
</d:propfind>`

	headers := map[string]string{
		"Depth":        "1",
		"Content-Type": "application/xml; charset=utf-8",
	}

	resp, err := doDavRequest(client, "PROPFIND", calURL, config.Username, config.Password, []byte(propfindXML), headers)
	if err != nil {
		errStr := err.Error()
		if strings.Contains(errStr, "connection refused") {
			result.Error = fmt.Sprintf("Cannot connect to Baïkal at %s: Connection refused. Verify Baïkal container is running.", config.URL)
		} else {
			result.Error = fmt.Sprintf("Connection error to %s: %v", config.URL, err)
		}
		return result, nil
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		result.Error = fmt.Sprintf("Authentication failed for user '%s'. Please verify your Baïkal username and password.", config.Username)
		return result, nil
	}

	if resp.StatusCode == http.StatusOK || resp.StatusCode == 207 {
		bodyBytes, _ := io.ReadAll(resp.Body)
		var ms multistatus
		if err := xml.Unmarshal(bodyBytes, &ms); err == nil {
			for _, r := range ms.Responses {
				hrefTrimmed := strings.TrimRight(r.Href, "/")
				segments := strings.Split(hrefTrimmed, "/")
				lastSeg := segments[len(segments)-1]

				if lastSeg == config.Username || lastSeg == "calendars" || lastSeg == "" {
					continue
				}

				name := lastSeg
				disp := ""
				for _, ps := range r.Propstat {
					if strings.Contains(ps.Status, "200") && ps.Prop.DisplayName != "" {
						disp = ps.Prop.DisplayName
						break
					}
				}
				if disp == "" {
					disp = strings.Title(strings.ReplaceAll(name, "-", " "))
				}

				result.Calendars = append(result.Calendars, DiscoveredResource{
					Name:        name,
					DisplayName: disp,
					Href:        r.Href,
					Type:        "calendar",
				})
			}
		}
	}

	// 2. Discover Address Books
	cardURL := fmt.Sprintf("%s/addressbooks/%s/", baseURL, url.PathEscape(config.Username))
	if respCard, err := doDavRequest(client, "PROPFIND", cardURL, config.Username, config.Password, []byte(propfindXML), headers); err == nil {
		defer respCard.Body.Close()
		if respCard.StatusCode == http.StatusOK || respCard.StatusCode == 207 {
			bodyBytes, _ := io.ReadAll(respCard.Body)
			var ms multistatus
			if err := xml.Unmarshal(bodyBytes, &ms); err == nil {
				for _, r := range ms.Responses {
					hrefTrimmed := strings.TrimRight(r.Href, "/")
					segments := strings.Split(hrefTrimmed, "/")
					lastSeg := segments[len(segments)-1]
					if lastSeg == config.Username || lastSeg == "addressbooks" || lastSeg == "" {
						continue
					}
					disp := ""
					for _, ps := range r.Propstat {
						if strings.Contains(ps.Status, "200") && ps.Prop.DisplayName != "" {
							disp = ps.Prop.DisplayName
							break
						}
					}
					if disp == "" {
						disp = strings.Title(strings.ReplaceAll(lastSeg, "-", " "))
					}
					result.AddressBooks = append(result.AddressBooks, DiscoveredResource{
						Name:        lastSeg,
						DisplayName: disp,
						Href:        r.Href,
						Type:        "addressbook",
					})
				}
			}
		}
	}

	// Fallback standard defaults if discovery succeeded but empty lists returned
	if len(result.Calendars) == 0 {
		result.Calendars = append(result.Calendars,
			DiscoveredResource{Name: "default", DisplayName: "Default Calendar (default)", Type: "calendar"},
			DiscoveredResource{Name: "reminders", DisplayName: "Reminders & Tasks (reminders)", Type: "calendar"},
			DiscoveredResource{Name: "personal", DisplayName: "Personal (personal)", Type: "calendar"},
		)
	}
	if len(result.AddressBooks) == 0 {
		result.AddressBooks = append(result.AddressBooks,
			DiscoveredResource{Name: "default", DisplayName: "Contacts Directory (default)", Type: "addressbook"},
		)
	}

	result.Success = true
	return result, nil
}

// buildResourceURL turns a relative href into a full URL
func buildResourceURL(baseURLStr, href string) string {
	if strings.HasPrefix(href, "http://") || strings.HasPrefix(href, "https://") {
		return href
	}
	parsedBase, err := url.Parse(NormalizeDavURL(baseURLStr))
	if err != nil {
		return href
	}
	if !strings.HasPrefix(href, "/") {
		href = "/" + href
	}
	return fmt.Sprintf("%s://%s%s", parsedBase.Scheme, parsedBase.Host, href)
}

// ResolveCalendarURI resolves a calendar name or display name to the exact Baïkal CalDAV collection URI slug.
func ResolveCalendarURI(config BaikalConfig, calendarNameOrDisplayName, preferredType string) (string, error) {
	raw := strings.TrimSpace(calendarNameOrDisplayName)
	raw = strings.Trim(raw, "/")
	if strings.Contains(raw, "calendars/") {
		parts := strings.Split(raw, "calendars/")
		raw = parts[len(parts)-1]
		if strings.Contains(raw, "/") {
			parts2 := strings.Split(raw, "/")
			raw = parts2[len(parts2)-1]
		}
	}

	disc, err := Discover(config)
	if err == nil && len(disc.Calendars) > 0 {
		rawLower := strings.ToLower(raw)

		// 1. Direct match by Name or DisplayName if provided
		if raw != "" {
			for _, cal := range disc.Calendars {
				if strings.EqualFold(cal.Name, raw) || strings.EqualFold(cal.DisplayName, raw) {
					return cal.Name, nil
				}
			}
			// Fuzzy substring match
			for _, cal := range disc.Calendars {
				if strings.Contains(strings.ToLower(cal.Name), rawLower) || strings.Contains(strings.ToLower(cal.DisplayName), rawLower) {
					return cal.Name, nil
				}
			}
		}

		// 2. If looking for a reminder / to-do calendar:
		if preferredType == "reminder" || preferredType == "todo" || rawLower == "todo" || rawLower == "tasks" || rawLower == "reminders" {
			if config.ReminderCalendar != "" {
				for _, cal := range disc.Calendars {
					if strings.EqualFold(cal.Name, config.ReminderCalendar) || strings.EqualFold(cal.DisplayName, config.ReminderCalendar) {
						return cal.Name, nil
					}
				}
			}
			// Search for calendar with 'todo', 'task', or 'reminder' in name/display
			for _, cal := range disc.Calendars {
				n := strings.ToLower(cal.Name)
				d := strings.ToLower(cal.DisplayName)
				if strings.Contains(n, "todo") || strings.Contains(d, "todo") ||
					strings.Contains(n, "task") || strings.Contains(d, "task") ||
					strings.Contains(n, "remind") || strings.Contains(d, "remind") {
					return cal.Name, nil
				}
			}
		}

		// 3. If looking for an event calendar or default:
		if config.DefaultCalendar != "" {
			for _, cal := range disc.Calendars {
				if strings.EqualFold(cal.Name, config.DefaultCalendar) || strings.EqualFold(cal.DisplayName, config.DefaultCalendar) {
					return cal.Name, nil
				}
			}
		}

		// 4. Default to first discovered calendar
		return disc.Calendars[0].Name, nil
	}

	// Discovery fallback when server is unreachable or discovery is empty
	if raw != "" {
		return raw, nil
	}
	if preferredType == "reminder" && config.ReminderCalendar != "" {
		return config.ReminderCalendar, nil
	}
	if config.DefaultCalendar != "" {
		return config.DefaultCalendar, nil
	}
	return "default", nil
}

// ListEvents queries calendar events for a specific calendar
func ListEvents(config BaikalConfig, calendarName string, start, end time.Time) ([]CalendarEvent, error) {
	calURI, _ := ResolveCalendarURI(config, calendarName, "event")
	if calURI == "" {
		calURI = "default"
	}

	baseURL := NormalizeDavURL(config.URL)
	targetURL := fmt.Sprintf("%s/calendars/%s/%s/", baseURL, url.PathEscape(config.Username), url.PathEscape(calURI))

	client := &http.Client{Timeout: 12 * time.Second}
	headers := map[string]string{"Depth": "1"}

	resp, err := doDavRequest(client, "PROPFIND", targetURL, config.Username, config.Password, nil, headers)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var events []CalendarEvent
	if resp.StatusCode == http.StatusOK || resp.StatusCode == 207 {
		bodyBytes, _ := io.ReadAll(resp.Body)
		bodyStr := string(bodyBytes)

		// Case-insensitive regex for href tags from any DAV namespace prefix
		hrefRe := regexp.MustCompile(`(?i)<(?:[a-zA-Z0-9_-]+:)?href>([^<]+)</(?:[a-zA-Z0-9_-]+:)?href>`)
		matches := hrefRe.FindAllStringSubmatch(bodyStr, -1)
		for _, m := range matches {
			if len(m) > 1 && strings.HasSuffix(strings.ToLower(m[1]), ".ics") {
				icsURL := buildResourceURL(config.URL, m[1])
				if evResp, err := doDavRequest(client, "GET", icsURL, config.Username, config.Password, nil, nil); err == nil && evResp.StatusCode == http.StatusOK {
					icsBytes, _ := io.ReadAll(evResp.Body)
					evResp.Body.Close()
					if ev := parseICalEvent(string(icsBytes)); ev != nil {
						ev.Calendar = calURI
						ev.URL = icsURL
						events = append(events, *ev)
					}
				}
			}
		}
	}

	return ExpandEventInstances(events, start, end), nil
}

// ListReminders queries active tasks and to-dos (VTODO) from a calendar
func ListReminders(config BaikalConfig, calendarName string) ([]CalendarReminder, error) {
	calURI, _ := ResolveCalendarURI(config, calendarName, "reminder")
	if calURI == "" {
		calURI = "default"
	}

	baseURL := NormalizeDavURL(config.URL)
	targetURL := fmt.Sprintf("%s/calendars/%s/%s/", baseURL, url.PathEscape(config.Username), url.PathEscape(calURI))

	client := &http.Client{Timeout: 12 * time.Second}
	headers := map[string]string{"Depth": "1"}

	resp, err := doDavRequest(client, "PROPFIND", targetURL, config.Username, config.Password, nil, headers)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var reminders []CalendarReminder
	if resp.StatusCode == http.StatusOK || resp.StatusCode == 207 {
		bodyBytes, _ := io.ReadAll(resp.Body)
		bodyStr := string(bodyBytes)

		hrefRe := regexp.MustCompile(`(?i)<(?:[a-zA-Z0-9_-]+:)?href>([^<]+)</(?:[a-zA-Z0-9_-]+:)?href>`)
		matches := hrefRe.FindAllStringSubmatch(bodyStr, -1)
		for _, m := range matches {
			if len(m) > 1 && strings.HasSuffix(strings.ToLower(m[1]), ".ics") {
				icsURL := buildResourceURL(config.URL, m[1])
				if evResp, err := doDavRequest(client, "GET", icsURL, config.Username, config.Password, nil, nil); err == nil && evResp.StatusCode == http.StatusOK {
					icsBytes, _ := io.ReadAll(evResp.Body)
					evResp.Body.Close()
					if rem := parseICalReminder(string(icsBytes)); rem != nil {
						rem.Calendar = calURI
						rem.URL = icsURL
						reminders = append(reminders, *rem)
					}
				}
			}
		}
	}

	// Sort reminders: incomplete first, then by due date
	sort.Slice(reminders, func(i, j int) bool {
		if reminders[i].Completed != reminders[j].Completed {
			return !reminders[i].Completed
		}
		if reminders[i].DueDate != nil && reminders[j].DueDate != nil {
			return reminders[i].DueDate.Before(*reminders[j].DueDate)
		}
		return reminders[i].DueDate != nil
	})

	return reminders, nil
}

// ListAllReminders queries all user calendars on Baïkal and aggregates all active VTODOs
func ListAllReminders(config BaikalConfig) ([]CalendarReminder, error) {
	disc, err := Discover(config)
	if err != nil || len(disc.Calendars) == 0 {
		return ListReminders(config, config.ReminderCalendar)
	}

	var allReminders []CalendarReminder
	seenUIDs := make(map[string]bool)

	for _, cal := range disc.Calendars {
		rems, err := ListReminders(config, cal.Name)
		if err != nil {
			continue
		}
		disp := cal.DisplayName
		if disp == "" {
			disp = strings.Title(strings.ReplaceAll(cal.Name, "-", " "))
		}
		for _, r := range rems {
			if !seenUIDs[r.ID] {
				seenUIDs[r.ID] = true
				if r.Calendar == "" || r.Calendar == cal.Name {
					r.Calendar = disp
				}
				allReminders = append(allReminders, r)
			}
		}
	}

	if len(allReminders) == 0 {
		return ListReminders(config, config.ReminderCalendar)
	}

	sort.Slice(allReminders, func(i, j int) bool {
		if allReminders[i].Completed != allReminders[j].Completed {
			return !allReminders[i].Completed
		}
		if allReminders[i].DueDate != nil && allReminders[j].DueDate != nil {
			return allReminders[i].DueDate.Before(*allReminders[j].DueDate)
		}
		return allReminders[i].DueDate != nil
	})

	return allReminders, nil
}

// ListAllEvents discovers all user calendars on Baïkal and aggregates events across all of them
func ListAllEvents(config BaikalConfig, start, end time.Time) ([]CalendarEvent, error) {
	disc, err := Discover(config)
	if err != nil || len(disc.Calendars) == 0 {
		return ListEvents(config, config.DefaultCalendar, start, end)
	}

	reminderCal := strings.ToLower(strings.TrimSpace(config.ReminderCalendar))
	if reminderCal == "" {
		reminderCal = "reminders"
	}

	var allEvents []CalendarEvent
	seenUIDs := make(map[string]bool)

	for _, cal := range disc.Calendars {
		calNameLower := strings.ToLower(cal.Name)
		// Skip designated reminder/task calendar to avoid mixing VTODOs
		if calNameLower == reminderCal || calNameLower == "todo" || calNameLower == "reminders" || calNameLower == "tasks" {
			continue
		}

		events, err := ListEvents(config, cal.Name, start, end)
		if err != nil {
			continue
		}

		disp := cal.DisplayName
		if disp == "" {
			disp = strings.Title(strings.ReplaceAll(cal.Name, "-", " "))
		}

		for _, ev := range events {
			if !seenUIDs[ev.ID] {
				seenUIDs[ev.ID] = true
				if ev.Calendar == "" || ev.Calendar == cal.Name {
					ev.Calendar = disp
				}
				allEvents = append(allEvents, ev)
			}
		}
	}

	if len(allEvents) == 0 {
		// Fallback to default calendar if no multi-cal events found
		return ListEvents(config, config.DefaultCalendar, start, end)
	}

	sort.Slice(allEvents, func(i, j int) bool {
		return allEvents[i].StartTime.Before(allEvents[j].StartTime)
	})

	return allEvents, nil
}

// CreateEvent uploads a new VEVENT to Baïkal
func CreateEvent(config BaikalConfig, calendarName string, ev CalendarEvent) error {
	calURI, err := ResolveCalendarURI(config, calendarName, "event")
	if err != nil || calURI == "" {
		calURI = config.DefaultCalendar
		if calURI == "" {
			calURI = "default"
		}
	}

	uid := ev.ID
	if uid == "" {
		b := make([]byte, 8)
		_, _ = rand.Read(b)
		uid = fmt.Sprintf("kuro-ev-%s-%d", hex.EncodeToString(b), time.Now().Unix())
	}

	eventURL := buildCalendarItemURL(config.URL, config.Username, calURI, uid)

	var dtStartStr, dtEndStr string
	if ev.IsAllDay {
		dtStartStr = fmt.Sprintf("DTSTART;VALUE=DATE:%s", ev.StartTime.Format("20060102"))
		dtEndStr = fmt.Sprintf("DTEND;VALUE=DATE:%s", ev.EndTime.Format("20060102"))
	} else {
		dtStartStr = fmt.Sprintf("DTSTART:%s", ev.StartTime.UTC().Format("20060102T150405Z"))
		dtEndStr = fmt.Sprintf("DTEND:%s", ev.EndTime.UTC().Format("20060102T150405Z"))
	}

	rruleLine := ""
	if ev.RRule != "" {
		cleanRule := strings.TrimPrefix(ev.RRule, "RRULE:")
		rruleLine = fmt.Sprintf("RRULE:%s\n", cleanRule)
	}

	icsPayload := fmt.Sprintf(`BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Kuro HomeLab AI Assistant//EN
CALSCALE:GREGORIAN
BEGIN:VEVENT
UID:%s
DTSTAMP:%s
%s
%s
%sSUMMARY:%s
DESCRIPTION:%s
LOCATION:%s
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`,
		uid,
		time.Now().UTC().Format("20060102T150405Z"),
		dtStartStr,
		dtEndStr,
		rruleLine,
		sanitizeICS(ev.Title),
		sanitizeICS(ev.Description),
		sanitizeICS(ev.Location),
	)

	client := &http.Client{Timeout: 10 * time.Second}
	headers := map[string]string{"Content-Type": "text/calendar; charset=utf-8"}

	resp, err := doDavRequest(client, "PUT", eventURL, config.Username, config.Password, []byte(icsPayload), headers)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusNoContent {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("Baïkal returned HTTP %d: %s", resp.StatusCode, string(body))
	}
	return nil
}

// CreateReminder adds a VTODO to the designated reminder calendar
func CreateReminder(config BaikalConfig, rem CalendarReminder) error {
	calURI, err := ResolveCalendarURI(config, rem.Calendar, "reminder")
	if err != nil || calURI == "" {
		calURI = config.ReminderCalendar
		if calURI == "" {
			calURI = "default"
		}
	}

	uid := rem.ID
	if uid == "" {
		b := make([]byte, 8)
		_, _ = rand.Read(b)
		uid = fmt.Sprintf("kuro-task-%s-%d", hex.EncodeToString(b), time.Now().Unix())
	}

	targetURL := buildCalendarItemURL(config.URL, config.Username, calURI, uid)

	dueStr := ""
	dtStartStr := ""
	if rem.DueDate != nil {
		dueStr = fmt.Sprintf("DUE:%s\n", rem.DueDate.UTC().Format("20060102T150405Z"))
		dtStartStr = fmt.Sprintf("DTSTART:%s\n", rem.DueDate.UTC().Format("20060102T150405Z"))
	} else {
		nowUTC := time.Now().UTC()
		dtStartStr = fmt.Sprintf("DTSTART:%s\n", nowUTC.Format("20060102T150405Z"))
	}

	prio := rem.Priority
	if prio <= 0 {
		prio = 5
	}

	icsPayload := fmt.Sprintf(`BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Kuro HomeLab AI Assistant//EN
CALSCALE:GREGORIAN
BEGIN:VTODO
UID:%s
DTSTAMP:%s
CREATED:%s
%s%sSUMMARY:%s
DESCRIPTION:%s
PRIORITY:%d
STATUS:NEEDS-ACTION
END:VTODO
END:VCALENDAR`,
		uid,
		time.Now().UTC().Format("20060102T150405Z"),
		time.Now().UTC().Format("20060102T150405Z"),
		dtStartStr,
		dueStr,
		sanitizeICS(rem.Title),
		sanitizeICS(rem.Description),
		prio,
	)

	client := &http.Client{Timeout: 10 * time.Second}
	headers := map[string]string{"Content-Type": "text/calendar; charset=utf-8"}

	resp, err := doDavRequest(client, "PUT", targetURL, config.Username, config.Password, []byte(icsPayload), headers)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusNoContent {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("Baïkal returned HTTP %d: %s", resp.StatusCode, string(body))
	}

	return nil
}

// DeleteEvent removes a VEVENT from Baïkal
func DeleteEvent(config BaikalConfig, calendarName string, eventID string) error {
	calURI, _ := ResolveCalendarURI(config, calendarName, "event")
	if calURI == "" {
		calURI = config.DefaultCalendar
		if calURI == "" {
			calURI = "default"
		}
	}

	targetURL := buildCalendarItemURL(config.URL, config.Username, calURI, eventID)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := doDavRequest(client, "DELETE", targetURL, config.Username, config.Password, nil, nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent && resp.StatusCode != http.StatusNotFound {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("Baïkal returned HTTP %d on delete: %s", resp.StatusCode, string(body))
	}
	return nil
}

// DeleteReminder removes a VTODO from the designated reminder calendar
func DeleteReminder(config BaikalConfig, reminderID string) error {
	calURI, _ := ResolveCalendarURI(config, config.ReminderCalendar, "reminder")
	if calURI == "" {
		calURI = "default"
	}
	return DeleteEvent(config, calURI, reminderID)
}

// FindEventByTitle searches for a recent/upcoming event matching a title query
func FindEventByTitle(config BaikalConfig, calendarName string, titleQuery string) (*CalendarEvent, error) {
	now := time.Now()
	events, err := ListEvents(config, calendarName, now.AddDate(0, 0, -3), now.AddDate(0, 0, 30))
	if err != nil {
		return nil, err
	}
	q := strings.ToLower(strings.TrimSpace(titleQuery))
	for _, ev := range events {
		if strings.Contains(strings.ToLower(ev.Title), q) {
			return &ev, nil
		}
	}
	return nil, nil
}

// ListContacts retrieves contacts from the CardDAV address book
func ListContacts(config BaikalConfig) ([]ContactItem, error) {
	abName := config.AddressBook
	if abName == "" {
		abName = "default"
	}

	baseURL := NormalizeDavURL(config.URL)
	targetURL := fmt.Sprintf("%s/addressbooks/%s/%s/", baseURL, url.PathEscape(config.Username), url.PathEscape(abName))

	client := &http.Client{Timeout: 12 * time.Second}
	headers := map[string]string{"Depth": "1"}

	resp, err := doDavRequest(client, "PROPFIND", targetURL, config.Username, config.Password, nil, headers)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var contacts []ContactItem
	if resp.StatusCode == http.StatusOK || resp.StatusCode == 207 {
		bodyBytes, _ := io.ReadAll(resp.Body)
		bodyStr := string(bodyBytes)

		hrefRe := regexp.MustCompile(`(?i)<(?:[a-zA-Z0-9_-]+:)?href>([^<]+)</(?:[a-zA-Z0-9_-]+:)?href>`)
		matches := hrefRe.FindAllStringSubmatch(bodyStr, -1)
		for _, m := range matches {
			if len(m) > 1 && strings.HasSuffix(strings.ToLower(m[1]), ".vcf") {
				vcfURL := buildResourceURL(config.URL, m[1])
				if cResp, err := doDavRequest(client, "GET", vcfURL, config.Username, config.Password, nil, nil); err == nil && cResp.StatusCode == http.StatusOK {
					vcfBytes, _ := io.ReadAll(cResp.Body)
					cResp.Body.Close()
					if c := parseVCard(string(vcfBytes)); c != nil {
						contacts = append(contacts, *c)
					}
				}
			}
		}
	}
	return contacts, nil
}

// MatchPhoneNumber looks up a normalized phone number in contacts
func MatchPhoneNumber(contacts []ContactItem, phone string) *ContactItem {
	norm := normalizePhone(phone)
	if norm == "" {
		return nil
	}
	for _, c := range contacts {
		for _, p := range c.PhoneNumbers {
			if normalizePhone(p) == norm || strings.HasSuffix(normalizePhone(p), norm) || strings.HasSuffix(norm, normalizePhone(p)) {
				return &c
			}
		}
	}
	return nil
}

// Helpers
func sanitizeICS(s string) string {
	s = strings.ReplaceAll(s, "\n", "\\n")
	s = strings.ReplaceAll(s, "\r", "")
	return s
}

func normalizePhone(s string) string {
	re := regexp.MustCompile(`[^0-9]`)
	cleaned := re.ReplaceAllString(s, "")
	if len(cleaned) > 10 {
		return cleaned[len(cleaned)-10:]
	}
	return cleaned
}

func parseICalDateTime(line string) (time.Time, bool, error) {
	parts := strings.SplitN(line, ":", 2)
	if len(parts) < 2 {
		return time.Time{}, false, fmt.Errorf("invalid ical line")
	}
	tag := parts[0]
	val := strings.TrimSpace(parts[1])
	isAllDay := strings.Contains(tag, "VALUE=DATE") || len(val) == 8

	formats := []string{
		"20060102T150405Z",
		"20060102T150405",
		"20060102",
		"2006-01-02T15:04:05Z",
		"2006-01-02T15:04:05",
		"2006-01-02",
	}

	for _, f := range formats {
		if t, err := time.ParseInLocation(f, val, time.Local); err == nil {
			if strings.HasSuffix(val, "Z") {
				t = t.Local()
			}
			return t, isAllDay, nil
		}
	}

	return time.Time{}, false, fmt.Errorf("could not parse datetime %s", val)
}

func parseICalEvent(ics string) *CalendarEvent {
	lines := strings.Split(ics, "\n")
	var ev CalendarEvent
	isEvent := false
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "BEGIN:VEVENT") {
			isEvent = true
		} else if strings.HasPrefix(line, "UID:") {
			ev.ID = strings.TrimPrefix(line, "UID:")
		} else if strings.HasPrefix(line, "SUMMARY:") {
			ev.Title = strings.TrimPrefix(line, "SUMMARY:")
		} else if strings.HasPrefix(line, "DESCRIPTION:") {
			ev.Description = strings.TrimPrefix(line, "DESCRIPTION:")
		} else if strings.HasPrefix(line, "LOCATION:") {
			ev.Location = strings.TrimPrefix(line, "LOCATION:")
		} else if strings.HasPrefix(line, "RRULE:") {
			ev.RRule = strings.TrimPrefix(line, "RRULE:")
		} else if strings.HasPrefix(line, "DTSTART") {
			if t, allDay, err := parseICalDateTime(line); err == nil {
				ev.StartTime = t
				ev.IsAllDay = allDay
			}
		} else if strings.HasPrefix(line, "DTEND") {
			if t, _, err := parseICalDateTime(line); err == nil {
				ev.EndTime = t
			}
		}
	}
	if !isEvent && ev.Title == "" {
		return nil
	}
	if ev.EndTime.IsZero() && !ev.StartTime.IsZero() {
		if ev.IsAllDay {
			ev.EndTime = ev.StartTime.Add(24 * time.Hour)
		} else {
			ev.EndTime = ev.StartTime.Add(1 * time.Hour)
		}
	}
	return &ev
}

func parseICalReminder(ics string) *CalendarReminder {
	lines := strings.Split(ics, "\n")
	var rem CalendarReminder
	isTodo := false
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "BEGIN:VTODO") {
			isTodo = true
		} else if strings.HasPrefix(line, "UID:") {
			rem.ID = strings.TrimPrefix(line, "UID:")
		} else if strings.HasPrefix(line, "SUMMARY:") {
			rem.Title = strings.TrimPrefix(line, "SUMMARY:")
		} else if strings.HasPrefix(line, "DESCRIPTION:") {
			rem.Description = strings.TrimPrefix(line, "DESCRIPTION:")
		} else if strings.HasPrefix(line, "STATUS:") {
			status := strings.ToUpper(strings.TrimPrefix(line, "STATUS:"))
			if strings.Contains(status, "COMPLETED") {
				rem.Completed = true
			}
		} else if strings.HasPrefix(line, "PRIORITY:") {
			var p int
			if _, err := fmt.Sscanf(strings.TrimPrefix(line, "PRIORITY:"), "%d", &p); err == nil {
				rem.Priority = p
			}
		} else if strings.HasPrefix(line, "DUE") || strings.HasPrefix(line, "DTSTART") {
			if t, _, err := parseICalDateTime(line); err == nil {
				rem.DueDate = &t
			}
		}
	}
	if !isTodo && rem.Title == "" {
		return nil
	}
	return &rem
}

// ExpandEventInstances expands recurring events and filters within range [rangeStart, rangeEnd]
func ExpandEventInstances(events []CalendarEvent, rangeStart, rangeEnd time.Time) []CalendarEvent {
	var result []CalendarEvent
	for _, ev := range events {
		if ev.StartTime.IsZero() {
			continue
		}

		if ev.RRule != "" {
			upperRule := strings.ToUpper(ev.RRule)
			if strings.Contains(upperRule, "FREQ=YEARLY") {
				for yr := rangeStart.Year() - 1; yr <= rangeEnd.Year()+1; yr++ {
					instStart := time.Date(yr, ev.StartTime.Month(), ev.StartTime.Day(), ev.StartTime.Hour(), ev.StartTime.Minute(), ev.StartTime.Second(), 0, ev.StartTime.Location())
					duration := ev.EndTime.Sub(ev.StartTime)
					if duration <= 0 {
						duration = 1 * time.Hour
					}
					instEnd := instStart.Add(duration)

					if (instStart.Equal(rangeStart) || instStart.After(rangeStart)) && (instStart.Equal(rangeEnd) || instStart.Before(rangeEnd)) {
						inst := ev
						inst.StartTime = instStart
						inst.EndTime = instEnd
						result = append(result, inst)
					}
				}
				continue
			} else if strings.Contains(upperRule, "FREQ=MONTHLY") {
				for cur := rangeStart; !cur.After(rangeEnd); cur = cur.AddDate(0, 1, 0) {
					instStart := time.Date(cur.Year(), cur.Month(), ev.StartTime.Day(), ev.StartTime.Hour(), ev.StartTime.Minute(), ev.StartTime.Second(), 0, ev.StartTime.Location())
					duration := ev.EndTime.Sub(ev.StartTime)
					if duration <= 0 {
						duration = 1 * time.Hour
					}
					instEnd := instStart.Add(duration)
					if (instStart.Equal(rangeStart) || instStart.After(rangeStart)) && (instStart.Equal(rangeEnd) || instStart.Before(rangeEnd)) {
						inst := ev
						inst.StartTime = instStart
						inst.EndTime = instEnd
						result = append(result, inst)
					}
				}
				continue
			}
		}

		// Non-recurring event
		if (ev.StartTime.Equal(rangeStart) || ev.StartTime.After(rangeStart)) && (ev.StartTime.Equal(rangeEnd) || ev.StartTime.Before(rangeEnd)) {
			result = append(result, ev)
		} else if ev.IsAllDay {
			evDayStart := time.Date(ev.StartTime.Year(), ev.StartTime.Month(), ev.StartTime.Day(), 0, 0, 0, 0, ev.StartTime.Location())
			evDayEnd := time.Date(ev.EndTime.Year(), ev.EndTime.Month(), ev.EndTime.Day(), 23, 59, 59, 0, ev.EndTime.Location())
			if !evDayEnd.Before(rangeStart) && !evDayStart.After(rangeEnd) {
				result = append(result, ev)
			}
		}
	}

	sort.Slice(result, func(i, j int) bool {
		return result[i].StartTime.Before(result[j].StartTime)
	})

	return result
}

func parseVCard(vcf string) *ContactItem {
	lines := strings.Split(vcf, "\n")
	var c ContactItem
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "FN:") {
			c.FullName = strings.TrimPrefix(line, "FN:")
		} else if strings.Contains(line, "TEL") {
			parts := strings.Split(line, ":")
			if len(parts) > 1 {
				c.PhoneNumbers = append(c.PhoneNumbers, strings.TrimSpace(parts[1]))
			}
		} else if strings.Contains(line, "EMAIL") {
			parts := strings.Split(line, ":")
			if len(parts) > 1 {
				c.Emails = append(c.Emails, strings.TrimSpace(parts[1]))
			}
		} else if strings.HasPrefix(line, "ORG:") {
			c.Organization = strings.TrimPrefix(line, "ORG:")
		} else if strings.HasPrefix(line, "NOTE:") {
			c.Notes = strings.TrimPrefix(line, "NOTE:")
		}
	}
	if c.FullName == "" && len(c.PhoneNumbers) == 0 {
		return nil
	}
	return &c
}
