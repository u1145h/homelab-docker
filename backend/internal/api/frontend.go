package api

import (
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

type spaHandler struct {
	dist string
	fs   http.Handler
}

func NewFrontendHandler() http.Handler {

	exe, err := os.Executable()
	if err != nil {
		log.Fatal(err)
	}

	exeDir := filepath.Dir(exe)
	cwd, _ := os.Getwd()

	candidates := []string{
		filepath.Join(filepath.Dir(exeDir), "frontend", "dist"),
		filepath.Join(exeDir, "frontend", "dist"),
		filepath.Join(exeDir, "dist"),
		"/app/frontend/dist",
	}
	if envDist := os.Getenv("FRONTEND_DIST_DIR"); envDist != "" {
		candidates = append([]string{envDist}, candidates...)
	}
	if cwd != "" {
		candidates = append(candidates,
			filepath.Join(cwd, "frontend", "dist"),
			filepath.Join(cwd, "dist"),
		)
	}

	var dist string
	for _, cand := range candidates {
		if _, err := os.Stat(filepath.Join(cand, "index.html")); err == nil {
			dist = cand
			break
		}
	}

	if dist == "" {
		dist = candidates[0]
	}

	log.Printf("Serving dashboard from: %s", dist)

	return &spaHandler{
		dist: dist,
		fs:   http.FileServer(http.Dir(dist)),
	}
}

func (h *spaHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {

	// React Router fallback
	if r.URL.Path == "/" {
		http.ServeFile(w, r, filepath.Join(h.dist, "index.html"))
		return
	}

	path := filepath.Join(h.dist, strings.TrimPrefix(filepath.Clean(r.URL.Path), "/"))

	if info, err := os.Stat(path); err == nil && !info.IsDir() {
		h.fs.ServeHTTP(w, r)
		return
	}

	http.ServeFile(w, r, filepath.Join(h.dist, "index.html"))
}
