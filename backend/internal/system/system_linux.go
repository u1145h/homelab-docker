package system

import (
	"bufio"
	"os"
	"runtime"
	"strconv"
	"strings"
	"time"

	"golang.org/x/sys/unix"
)

func Collect() (*Info, error) {
	host, _ := os.Hostname()

	var uts unix.Utsname
	if err := unix.Uname(&uts); err != nil {
		return nil, err
	}

	uptime, _ := readUptime()
	loadavg, _ := readLoadAvg()

	return &Info{
		Hostname: host,
		Kernel:   charsToString(uts.Release[:]),
		OS:       "linux",
		Arch:     "arm64",
		Go:       runtime.Version(),
		Uptime:   uptime,
		BootTime: time.Now().Add(-time.Duration(uptime) * time.Second),
		LoadAvg:  loadavg,
	}, nil
}

func readLoadAvg() ([]float64, error) {
	f, err := os.Open(ProcPath("loadavg"))
	if err != nil {
		return []float64{0, 0, 0}, err
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	if !scanner.Scan() {
		return []float64{0, 0, 0}, nil
	}

	fields := strings.Fields(scanner.Text())
	if len(fields) < 3 {
		return []float64{0, 0, 0}, nil
	}

	l1, _ := strconv.ParseFloat(fields[0], 64)
	l5, _ := strconv.ParseFloat(fields[1], 64)
	l15, _ := strconv.ParseFloat(fields[2], 64)

	return []float64{l1, l5, l15}, nil
}

func readUptime() (uint64, error) {
	f, err := os.Open(ProcPath("uptime"))
	if err != nil {
		return 0, err
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	scanner.Scan()

	fields := strings.Fields(scanner.Text())

	u, err := strconv.ParseFloat(fields[0], 64)
	if err != nil {
		return 0, err
	}

	return uint64(u), nil
}

func charsToString(c []byte) string {
	n := 0
	for ; n < len(c); n++ {
		if c[n] == 0 {
			break
		}
	}
	return string(c[:n])
}
