package filemanager

import (
	"io"
	"time"
)

type Operation string

const (
	OpList   Operation = "file.list"
	OpRead   Operation = "file.read"
	OpWrite  Operation = "file.write"
	OpDelete Operation = "file.delete"
	OpRename Operation = "file.rename"
	OpMove   Operation = "file.move"
	OpCopy   Operation = "file.copy"
	OpMkdir  Operation = "file.mkdir"
	OpStat   Operation = "file.stat"
)

type Item struct {
	Name     string    `json:"name"`
	Path     string    `json:"path"`
	Type     string    `json:"type"`
	Size     int64     `json:"size"`
	Modified time.Time `json:"modified"`
	Mode     string    `json:"mode,omitempty"`
}

type Directory struct {
	Path   string `json:"path"`
	Parent string `json:"parent"`
	Items  []Item `json:"items"`
}

type StatInfo struct {
	Name          string    `json:"name"`
	Size          int64     `json:"size"`
	MIME          string    `json:"mime,omitempty"`
	Mode          string    `json:"mode"`
	Permissions   string    `json:"permissions"`
	Modified      time.Time `json:"modified"`
	IsDir         bool      `json:"isDir"`
	IsSymlink     bool      `json:"isSymlink,omitempty"`
	SymlinkTarget string    `json:"symlinkTarget,omitempty"`
}

type Progress struct {
	Operation Operation `json:"operation"`
	Path      string    `json:"path"`
	Completed int64     `json:"completed"`
	Total     int64     `json:"total"`
}

type ProgressFunc func(Progress)

type ReadResult struct {
	Reader io.ReadCloser
	Info   *StatInfo
}
