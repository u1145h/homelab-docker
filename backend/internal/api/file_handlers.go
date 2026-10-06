package api

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/ullashroy/poco-server/backend/internal/auth"
	"github.com/ullashroy/poco-server/backend/internal/filemanager"
)

func ListFilesHandler(fs *filemanager.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		actor := auth.CurrentUser(r.Context())
		path := r.URL.Query().Get("path")
		if path == "" {
			path = "/"
		}
		dir, err := fs.List(r.Context(), actor.Username, path)
		if err != nil {
			handleFileError(w, err)
			return
		}
		JSON(w, http.StatusOK, dir)
	}
}

func ReadFileHandler(fs *filemanager.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		actor := auth.CurrentUser(r.Context())
		path := r.URL.Query().Get("path")
		if path == "" {
			Error(w, http.StatusBadRequest, errors.New("missing path"))
			return
		}

		reader, info, err := fs.Read(r.Context(), actor.Username, path)
		if err != nil {
			handleFileError(w, err)
			return
		}
		defer reader.Close()

		name := filepath.Base(info.Name)
		w.Header().Set("Content-Type", info.MIME)

		// osFilesystem returns *os.File which implements io.ReadSeeker, enabling
		// zero-copy streaming via ServeContent. If a future filesystem client
		// returns a non-seekable reader, we fall back to buffering in memory.
		if seeker, ok := reader.(io.ReadSeeker); ok {
			http.ServeContent(w, r, name, info.Modified, seeker)
		} else {
			data, err := io.ReadAll(reader)
			if err != nil {
				Error(w, http.StatusInternalServerError, err)
				return
			}
			http.ServeContent(w, r, name, info.Modified, bytes.NewReader(data))
		}
	}
}

func WriteFileHandler(fs *filemanager.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req filemanager.WriteRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			Error(w, http.StatusBadRequest, err)
			return
		}
		if req.Path == "" {
			Error(w, http.StatusBadRequest, errors.New("missing path"))
			return
		}

		actor := auth.CurrentUser(r.Context())
		reader := strings.NewReader(req.Content)
		if err := fs.Write(r.Context(), actor.Username, req.Path, reader, int64(len(req.Content))); err != nil {
			handleFileError(w, err)
			return
		}

		JSON(w, http.StatusOK, map[string]bool{"success": true})
	}
}

func UploadFileHandler(fs *filemanager.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if err := r.ParseMultipartForm(10 << 20); err != nil {
			Error(w, http.StatusBadRequest, err)
			return
		}

		path := r.FormValue("path")
		if path == "" {
			Error(w, http.StatusBadRequest, errors.New("missing path"))
			return
		}

		file, header, err := r.FormFile("file")
		if err != nil {
			Error(w, http.StatusBadRequest, err)
			return
		}
		defer file.Close()

		if strings.HasSuffix(path, "/") {
			path = filepath.Join(path, header.Filename)
		}

		actor := auth.CurrentUser(r.Context())
		if err := fs.Write(r.Context(), actor.Username, path, file, header.Size); err != nil {
			handleFileError(w, err)
			return
		}

		JSON(w, http.StatusOK, map[string]any{
			"success": true,
			"path":    path,
			"size":    header.Size,
		})
	}
}

func DownloadHandler(fs *filemanager.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		actor := auth.CurrentUser(r.Context())
		path := r.URL.Query().Get("path")
		if path == "" {
			Error(w, http.StatusBadRequest, errors.New("missing path"))
			return
		}

		reader, info, err := fs.Read(r.Context(), actor.Username, path)
		if err != nil {
			handleFileError(w, err)
			return
		}
		defer reader.Close()

		name := filepath.Base(info.Name)
		w.Header().Set("Content-Disposition", "attachment; filename=\""+name+"\"")
		w.Header().Set("Content-Type", info.MIME)

		// Same streaming pattern as ReadFileHandler: zero-copy via ServeContent
		// when reader implements io.ReadSeeker, buffered fallback otherwise.
		if seeker, ok := reader.(io.ReadSeeker); ok {
			http.ServeContent(w, r, name, info.Modified, seeker)
		} else {
			data, err := io.ReadAll(reader)
			if err != nil {
				Error(w, http.StatusInternalServerError, err)
				return
			}
			http.ServeContent(w, r, name, info.Modified, bytes.NewReader(data))
		}
	}
}

func MkdirHandler(fs *filemanager.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req filemanager.MkdirRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			Error(w, http.StatusBadRequest, err)
			return
		}
		if req.Path == "" {
			Error(w, http.StatusBadRequest, errors.New("missing path"))
			return
		}

		actor := auth.CurrentUser(r.Context())
		if err := fs.Mkdir(r.Context(), actor.Username, req.Path); err != nil {
			handleFileError(w, err)
			return
		}

		JSON(w, http.StatusOK, map[string]bool{"success": true})
	}
}

func DeleteFileHandler(fs *filemanager.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req filemanager.DeleteRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			Error(w, http.StatusBadRequest, err)
			return
		}
		if req.Path == "" {
			Error(w, http.StatusBadRequest, errors.New("missing path"))
			return
		}

		actor := auth.CurrentUser(r.Context())
		permanent := r.URL.Query().Get("permanent") == "true"

		var err error
		if permanent {
			err = fs.Delete(r.Context(), actor.Username, req.Path)
		} else {
			err = fs.SoftDelete(r.Context(), actor.Username, req.Path)
		}

		if err != nil {
			handleFileError(w, err)
			return
		}

		JSON(w, http.StatusOK, map[string]bool{"success": true})
	}
}

func ListTrashHandler(fs *filemanager.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		actor := auth.CurrentUser(r.Context())
		items, err := fs.ListTrash(r.Context(), actor.Username)
		if err != nil {
			handleFileError(w, err)
			return
		}
		JSON(w, http.StatusOK, map[string]any{"items": items})
	}
}

func RestoreTrashHandler(fs *filemanager.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			ID string `json:"id"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			Error(w, http.StatusBadRequest, err)
			return
		}
		if req.ID == "" {
			Error(w, http.StatusBadRequest, errors.New("missing id"))
			return
		}

		actor := auth.CurrentUser(r.Context())
		if err := fs.RestoreTrashItem(r.Context(), actor.Username, req.ID); err != nil {
			handleFileError(w, err)
			return
		}
		JSON(w, http.StatusOK, map[string]bool{"success": true})
	}
}

func DeleteTrashItemHandler(fs *filemanager.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			ID string `json:"id"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			Error(w, http.StatusBadRequest, err)
			return
		}
		if req.ID == "" {
			Error(w, http.StatusBadRequest, errors.New("missing id"))
			return
		}

		actor := auth.CurrentUser(r.Context())
		if err := fs.DeleteTrashItem(r.Context(), actor.Username, req.ID); err != nil {
			handleFileError(w, err)
			return
		}
		JSON(w, http.StatusOK, map[string]bool{"success": true})
	}
}

func EmptyTrashHandler(fs *filemanager.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		actor := auth.CurrentUser(r.Context())
		if err := fs.EmptyTrash(r.Context(), actor.Username); err != nil {
			handleFileError(w, err)
			return
		}
		JSON(w, http.StatusOK, map[string]bool{"success": true})
	}
}

func RenameFileHandler(fs *filemanager.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req filemanager.RenameRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			Error(w, http.StatusBadRequest, err)
			return
		}
		if req.Source == "" || req.Target == "" {
			Error(w, http.StatusBadRequest, errors.New("source and target are required"))
			return
		}

		actor := auth.CurrentUser(r.Context())
		if err := fs.Rename(r.Context(), actor.Username, req.Source, req.Target); err != nil {
			handleFileError(w, err)
			return
		}

		JSON(w, http.StatusOK, map[string]bool{"success": true})
	}
}

func MoveFileHandler(fs *filemanager.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req filemanager.MoveRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			Error(w, http.StatusBadRequest, err)
			return
		}
		if req.Source == "" || req.Target == "" {
			Error(w, http.StatusBadRequest, errors.New("source and target are required"))
			return
		}

		actor := auth.CurrentUser(r.Context())
		if err := fs.Move(r.Context(), actor.Username, req.Source, req.Target, nil); err != nil {
			handleFileError(w, err)
			return
		}

		JSON(w, http.StatusOK, map[string]bool{"success": true})
	}
}

func CopyFileHandler(fs *filemanager.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req filemanager.CopyRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			Error(w, http.StatusBadRequest, err)
			return
		}
		if req.Source == "" || req.Target == "" {
			Error(w, http.StatusBadRequest, errors.New("source and target are required"))
			return
		}

		actor := auth.CurrentUser(r.Context())
		if err := fs.Copy(r.Context(), actor.Username, req.Source, req.Target, nil); err != nil {
			handleFileError(w, err)
			return
		}

		JSON(w, http.StatusOK, map[string]bool{"success": true})
	}
}

func StatFileHandler(fs *filemanager.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		actor := auth.CurrentUser(r.Context())
		path := r.URL.Query().Get("path")
		if path == "" {
			Error(w, http.StatusBadRequest, errors.New("missing path"))
			return
		}

		info, err := fs.Stat(r.Context(), actor.Username, path)
		if err != nil {
			handleFileError(w, err)
			return
		}

		JSON(w, http.StatusOK, info)
	}
}

func handleFileError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, filemanager.ErrPermissionDenied):
		Error(w, http.StatusForbidden, err)
	case errors.Is(err, filemanager.ErrNotFound):
		Error(w, http.StatusNotFound, err)
	case errors.Is(err, filemanager.ErrAlreadyExists):
		Error(w, http.StatusConflict, err)
	case errors.Is(err, filemanager.ErrInvalidPath),
		errors.Is(err, filemanager.ErrEmptyPath),
		errors.Is(err, filemanager.ErrPathTraversal),
		errors.Is(err, filemanager.ErrRootOperation),
		errors.Is(err, filemanager.ErrCopyIntoSelf),
		errors.Is(err, filemanager.ErrMoveIntoSelf),
		errors.Is(err, filemanager.ErrIsDirectory):
		Error(w, http.StatusBadRequest, err)
	default:
		Error(w, http.StatusInternalServerError, err)
	}
}
