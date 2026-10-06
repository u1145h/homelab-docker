package storage

import (
	"unsafe"

	"golang.org/x/sys/windows"
)

var (
	modkernel32          = windows.NewLazySystemDLL("kernel32.dll")
	procGetDriveTypeW    = modkernel32.NewProc("GetDriveTypeW")
	procGetDiskFreeSpace = modkernel32.NewProc("GetDiskFreeSpaceExW")
)

func Collect() (*Info, error) {
	var summary Summary
	var capacityMix []CapacityMix
	var mounts []Mount
	var blockDevices []BlockDevice

	for _, letter := range "CDEFGHIJKLMNOPQRSTUVWXYZ" {
		driveRoot := string(letter) + ":\\"
		ptr, err := windows.UTF16PtrFromString(driveRoot)
		if err != nil {
			continue
		}

		dt, _, _ := procGetDriveTypeW.Call(uintptr(unsafe.Pointer(ptr)))
		// 2 = DRIVE_REMOVABLE (USB / MicroSD), 3 = DRIVE_FIXED, 4 = DRIVE_REMOTE
		if dt != 2 && dt != 3 && dt != 4 {
			continue
		}

		var freeBytesAvailable, totalNumberOfBytes, totalNumberOfFreeBytes uint64
		ret, _, _ := procGetDiskFreeSpace.Call(
			uintptr(unsafe.Pointer(ptr)),
			uintptr(unsafe.Pointer(&freeBytesAvailable)),
			uintptr(unsafe.Pointer(&totalNumberOfBytes)),
			uintptr(unsafe.Pointer(&totalNumberOfFreeBytes)),
		)
		if ret == 0 || totalNumberOfBytes == 0 {
			continue
		}

		usedBytes := totalNumberOfBytes - totalNumberOfFreeBytes
		usagePct := (float64(usedBytes) / float64(totalNumberOfBytes)) * 100

		driveTypeLabel := "Fixed Disk"
		mountType := "user"
		if dt == 2 {
			driveTypeLabel = "External / Removable"
			mountType = "external"
		} else if letter == 'C' {
			driveTypeLabel = "System Disk"
			mountType = "root"
		}

		summary.TotalCapacity += totalNumberOfBytes
		summary.Used += usedBytes
		summary.Free += totalNumberOfFreeBytes
		summary.PhysicalVolumes++

		color := "var(--kuro-color-accent)"
		if letter == 'C' {
			color = "var(--kuro-color-warning)"
		}

		capacityMix = append(capacityMix, CapacityMix{
			Name:  string(letter) + ": - " + driveTypeLabel,
			Total: totalNumberOfBytes,
			Used:  usedBytes,
			Color: color,
		})

		mounts = append(mounts, Mount{
			Device:       string(letter) + ":",
			Mount:        driveRoot,
			Filesystem:   "NTFS/FAT",
			Total:        totalNumberOfBytes,
			Used:         usedBytes,
			Available:    totalNumberOfFreeBytes,
			UsagePercent: usagePct,
			ReadOnly:     false,
			Type:         mountType,
		})

		blockDevices = append(blockDevices, BlockDevice{
			Device: string(letter) + ":",
			Model:  driveTypeLabel + " (" + string(letter) + ":)",
			Size:   totalNumberOfBytes,
			Temp:   "N/A",
			Read:   0,
			Write:  0,
			Health: "healthy",
		})
	}

	var usagePct float64
	if summary.TotalCapacity > 0 {
		usagePct = (float64(summary.Used) / float64(summary.TotalCapacity)) * 100
	} else if len(mounts) > 0 && mounts[0].Total > 0 {
		usagePct = mounts[0].UsagePercent
	}

	return &Info{
		Total:           summary.TotalCapacity,
		Used:            summary.Used,
		Free:            summary.Free,
		Available:       summary.Free,
		UsagePercent:    usagePct,
		Percentage:      usagePct,
		Summary:         summary,
		CapacityMix:     capacityMix,
		IOThroughput:    IOThroughput{},
		Mounts:          mounts,
		BlockDevices:    blockDevices,
		FilesystemCache: FilesystemCache{},
	}, nil
}
