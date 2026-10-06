package system

import (
	"bytes"
	"os/exec"
	"runtime"
	"time"
)

// ExecuteReboot triggers an OS level reboot after a 2-second grace period.
func ExecuteReboot(password string) error {
	var cmd *exec.Cmd

	if runtime.GOOS == "windows" {
		cmd = exec.Command("shutdown", "/r", "/t", "2", "/f")
	} else {
		// On Linux:
		// If password is provided, pipe it into sudo -S systemctl reboot or sudo -S shutdown -r now
		if password != "" {
			cmd = exec.Command("sudo", "-S", "systemctl", "reboot")
			var stdin bytes.Buffer
			stdin.WriteString(password + "\n")
			cmd.Stdin = &stdin
		} else {
			if _, err := exec.LookPath("systemctl"); err == nil {
				cmd = exec.Command("systemctl", "reboot")
			} else {
				cmd = exec.Command("shutdown", "-r", "now")
			}
		}
	}

	// Run command asynchronously after a 2-second grace period so HTTP response completes cleanly
	go func() {
		time.Sleep(2 * time.Second)
		err := cmd.Run()
		if err != nil && runtime.GOOS != "windows" {
			// Secondary fallback
			fallbackCmd := exec.Command("sudo", "-S", "shutdown", "-r", "now")
			if password != "" {
				var stdin bytes.Buffer
				stdin.WriteString(password + "\n")
				fallbackCmd.Stdin = &stdin
			}
			_ = fallbackCmd.Run()
		}
	}()

	return nil
}

// VerifyRootOrSudoPassword checks if the provided password is valid for sudo/root operations on Linux.
func VerifyRootOrSudoPassword(password string) bool {
	if runtime.GOOS == "windows" {
		return false
	}

	cmd := exec.Command("sudo", "-S", "-v")
	var stdin bytes.Buffer
	stdin.WriteString(password + "\n")
	cmd.Stdin = &stdin

	err := cmd.Run()
	return err == nil
}
