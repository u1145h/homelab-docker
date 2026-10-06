package filemanager

import (
	"context"
	"os"
	"path/filepath"
	"strings"
)

func (fs *osFilesystem) Stat(ctx context.Context, path string) (*StatInfo, error) {
	resolved, err := fs.resolve(ctx, path)
	if err != nil {
		return nil, err
	}

	info, err := os.Lstat(resolved)
	if err != nil {
		return nil, err
	}

	return toStatInfo(info, resolved), nil
}

func toStatInfo(info os.FileInfo, resolved string) *StatInfo {
	st := &StatInfo{
		Name:        info.Name(),
		Size:        info.Size(),
		Mode:        info.Mode().String(),
		Permissions: info.Mode().Perm().String(),
		Modified:    info.ModTime(),
		IsDir:       info.IsDir(),
	}

	if info.Mode()&os.ModeSymlink != 0 {
		st.IsSymlink = true
		if target, err := os.Readlink(resolved); err == nil {
			st.SymlinkTarget = target
		}
	}

	st.MIME = detectMIME(info.Name())

	return st
}

func detectMIME(name string) string {
	ext := strings.ToLower(filepath.Ext(name))
	switch ext {
	case ".txt", ".md":
		return "text/plain"
	case ".json":
		return "application/json"
	case ".xml", ".html", ".htm":
		return "text/html"
	case ".css":
		return "text/css"
	case ".js", ".mjs":
		return "application/javascript"
	case ".ts":
		return "application/typescript"
	case ".go":
		return "text/x-go"
	case ".py":
		return "text/x-python"
	case ".sh", ".bash", ".zsh":
		return "text/x-shellscript"
	case ".yaml", ".yml":
		return "application/yaml"
	case ".toml":
		return "application/toml"
	case ".env", ".ini", ".cfg", ".conf":
		return "text/plain"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".png":
		return "image/png"
	case ".gif":
		return "image/gif"
	case ".svg", ".svgz":
		return "image/svg+xml"
	case ".webp":
		return "image/webp"
	case ".ico":
		return "image/x-icon"
	case ".pdf":
		return "application/pdf"
	case ".zip":
		return "application/zip"
	case ".tar":
		return "application/x-tar"
	case ".gz":
		return "application/gzip"
	case ".bz2":
		return "application/x-bzip2"
	case ".xz":
		return "application/x-xz"
	case ".7z":
		return "application/x-7z-compressed"
	case ".rar":
		return "application/vnd.rar"
	case ".mp3":
		return "audio/mpeg"
	case ".wav":
		return "audio/wav"
	case ".mp4":
		return "video/mp4"
	case ".webm":
		return "video/webm"
	case ".avi":
		return "video/x-msvideo"
	case ".mov":
		return "video/quicktime"
	case ".csv":
		return "text/csv"
	case ".log":
		return "text/plain"
	case ".lock":
		return "application/json"
	default:
		return "application/octet-stream"
	}
}
