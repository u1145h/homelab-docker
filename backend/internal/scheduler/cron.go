package scheduler

import (
	"strconv"
	"strings"
	"time"
)

func nextCronTime(expr string, after time.Time) time.Time {
	parts := strings.Fields(expr)
	if len(parts) != 5 {
		return after.Add(time.Minute)
	}

	minField := parts[0]
	hourField := parts[1]
	domField := parts[2]
	monField := parts[3]
	dowField := parts[4]

	t := after.Truncate(time.Minute).Add(time.Minute)

	for i := 0; i < 525600; i++ {
		if matchCronField(monField, 1, 12, int(t.Month())) &&
			matchCronField(domField, 1, 31, t.Day()) &&
			matchCronField(dowField, 0, 6, int(t.Weekday())) &&
			matchCronField(hourField, 0, 23, t.Hour()) &&
			matchCronField(minField, 0, 59, t.Minute()) {
			return t
		}
		t = t.Add(time.Minute)
	}
	return after.Add(time.Hour)
}

func matchCronField(field string, min, max, val int) bool {
	if field == "*" {
		return true
	}

	for _, part := range strings.Split(field, ",") {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}

		if strings.HasPrefix(part, "*/") {
			step, err := strconv.Atoi(part[2:])
			if err != nil || step <= 0 {
				continue
			}
			if val%step == 0 {
				return true
			}
			continue
		}

		if strings.Contains(part, "-") {
			rangeParts := strings.SplitN(part, "-", 2)
			lo, err1 := strconv.Atoi(strings.TrimSpace(rangeParts[0]))
			hi, err2 := strconv.Atoi(strings.TrimSpace(rangeParts[1]))
			if err1 == nil && err2 == nil && val >= lo && val <= hi {
				return true
			}
			continue
		}

		n, err := strconv.Atoi(part)
		if err == nil && n == val {
			return true
		}
	}

	return false
}
