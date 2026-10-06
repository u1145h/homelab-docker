//go:build linux

package hardware

import (
	"log"
	"os"
	"strings"

	evdev "github.com/gvalkov/golang-evdev"
)

func ListenVolumeButtons() <-chan EventType {
	ch := make(chan EventType, 10)

	go func() {
		files, err := os.ReadDir("/dev/input")
		if err != nil {
			log.Printf("[hardware] cannot read /dev/input: %v", err)
			return
		}

		openedCount := 0
		for _, f := range files {
			if !strings.HasPrefix(f.Name(), "event") {
				continue
			}
			path := "/dev/input/" + f.Name()
			dev, err := evdev.Open(path)
			if err != nil {
				continue
			}
			openedCount++

			go func(d *evdev.InputDevice) {
				defer func() { _ = d.File.Close() }()
				for {
					events, err := d.Read()
					if err != nil {
						return
					}
					for _, ev := range events {
						if ev.Type != evdev.EV_KEY {
							continue
						}
						if ev.Value == 1 { // Key Press down
							if ev.Code == 115 || ev.Code == evdev.KEY_VOLUMEUP {
								ch <- EventVolumeUp
							} else if ev.Code == 114 || ev.Code == evdev.KEY_VOLUMEDOWN {
								ch <- EventVolumeDown
							}
						}
					}
				}
			}(dev)
		}

		if openedCount == 0 {
			log.Printf("[hardware] WARNING: Could not open any /dev/input/event* devices. Ensure poco-tui runs with sudo or user is in 'input' group.")
		}
	}()

	return ch
}
