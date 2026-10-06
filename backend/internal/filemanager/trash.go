package filemanager

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

type TrashItem struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	OriginalPath string    `json:"originalPath"`
	TrashedAt    time.Time `json:"trashedAt"`
	Size         int64     `json:"size"`
	Type         string    `json:"type"` // "file" or "directory"
}

type trashMetadata struct {
	Items map[string]TrashItem `json:"items"`
}

var trashMu sync.Mutex

func getTrashDir(root string) string {
	return filepath.Join(root, ".trash")
}

func getMetadataPath(root string) string {
	return filepath.Join(getTrashDir(root), "metadata.json")
}

func readTrashMetadata(root string) (trashMetadata, error) {
	metaPath := getMetadataPath(root)
	data, err := os.ReadFile(metaPath)
	if err != nil {
		if os.IsNotExist(err) {
			return trashMetadata{Items: make(map[string]TrashItem)}, nil
		}
		return trashMetadata{Items: make(map[string]TrashItem)}, err
	}
	var meta trashMetadata
	if err := json.Unmarshal(data, &meta); err != nil {
		return trashMetadata{Items: make(map[string]TrashItem)}, nil
	}
	if meta.Items == nil {
		meta.Items = make(map[string]TrashItem)
	}
	return meta, nil
}

func saveTrashMetadata(root string, meta trashMetadata) error {
	trashDir := getTrashDir(root)
	if err := os.MkdirAll(trashDir, 0755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(meta, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(getMetadataPath(root), data, 0644)
}

func (s *Service) SoftDelete(ctx context.Context, actor, path string) error {
	if err := ValidatePath(path); err != nil {
		return err
	}
	if err := s.authorize(ctx, actor, OpDelete); err != nil {
		return err
	}

	trashMu.Lock()
	defer trashMu.Unlock()

	osFs, ok := s.fs.(*osFilesystem)
	if !ok {
		return mapClientError(s.Delete(ctx, actor, path))
	}

	absRoot, _ := filepath.Abs(osFs.root)
	resolved, err := Resolve(absRoot, path)
	if err != nil {
		return mapClientError(err)
	}
	if resolved == absRoot {
		return ErrRootOperation
	}

	info, err := os.Stat(resolved)
	if err != nil {
		return mapClientError(err)
	}

	trashDir := getTrashDir(absRoot)
	if err := os.MkdirAll(trashDir, 0755); err != nil {
		return mapClientError(err)
	}

	trashID := fmt.Sprintf("%d_%s", time.Now().UnixNano(), filepath.Base(resolved))
	trashVirtualPath := fmt.Sprintf("/.trash/%s", trashID)

	// Move file/folder into .trash using filesystem Move helper (handles cross-device & permissions)
	if err := osFs.Move(ctx, path, trashVirtualPath, nil); err != nil {
		return mapClientError(err)
	}

	itemType := "file"
	if info.IsDir() {
		itemType = "directory"
	}

	meta, _ := readTrashMetadata(absRoot)
	meta.Items[trashID] = TrashItem{
		ID:           trashID,
		Name:         filepath.Base(resolved),
		OriginalPath: path,
		TrashedAt:    time.Now(),
		Size:         info.Size(),
		Type:         itemType,
	}
	_ = saveTrashMetadata(absRoot, meta)

	return nil
}

func (s *Service) ListTrash(ctx context.Context, actor string) ([]TrashItem, error) {
	if err := s.authorize(ctx, actor, OpList); err != nil {
		return nil, err
	}

	trashMu.Lock()
	defer trashMu.Unlock()

	osFs, ok := s.fs.(*osFilesystem)
	if !ok {
		return []TrashItem{}, nil
	}

	absRoot, _ := filepath.Abs(osFs.root)
	meta, err := readTrashMetadata(absRoot)
	if err != nil {
		return []TrashItem{}, nil
	}

	list := make([]TrashItem, 0, len(meta.Items))
	for _, item := range meta.Items {
		list = append(list, item)
	}
	return list, nil
}

func (s *Service) RestoreTrashItem(ctx context.Context, actor, trashID string) error {
	if err := s.authorize(ctx, actor, OpWrite); err != nil {
		return err
	}

	trashMu.Lock()
	defer trashMu.Unlock()

	osFs, ok := s.fs.(*osFilesystem)
	if !ok {
		return ErrNotFound
	}

	absRoot, _ := filepath.Abs(osFs.root)
	meta, err := readTrashMetadata(absRoot)
	if err != nil {
		return mapClientError(err)
	}

	item, exists := meta.Items[trashID]
	if !exists {
		return ErrNotFound
	}

	trashVirtualPath := fmt.Sprintf("/.trash/%s", trashID)

	// Move item from .trash back to originalPath
	if err := osFs.Move(ctx, trashVirtualPath, item.OriginalPath, nil); err != nil {
		return mapClientError(err)
	}

	delete(meta.Items, trashID)
	_ = saveTrashMetadata(absRoot, meta)

	return nil
}

func (s *Service) DeleteTrashItem(ctx context.Context, actor, trashID string) error {
	if err := s.authorize(ctx, actor, OpDelete); err != nil {
		return err
	}

	trashMu.Lock()
	defer trashMu.Unlock()

	osFs, ok := s.fs.(*osFilesystem)
	if !ok {
		return ErrNotFound
	}

	absRoot, _ := filepath.Abs(osFs.root)
	meta, err := readTrashMetadata(absRoot)
	if err != nil {
		return mapClientError(err)
	}

	_, exists := meta.Items[trashID]
	if !exists {
		return ErrNotFound
	}

	trashVirtualPath := fmt.Sprintf("/.trash/%s", trashID)
	if err := osFs.Delete(ctx, trashVirtualPath); err != nil {
		// Fallback raw remove
		trashedFile := filepath.Join(getTrashDir(absRoot), trashID)
		_ = os.RemoveAll(trashedFile)
	}

	delete(meta.Items, trashID)
	_ = saveTrashMetadata(absRoot, meta)

	return nil
}

func (s *Service) EmptyTrash(ctx context.Context, actor string) error {
	if err := s.authorize(ctx, actor, OpDelete); err != nil {
		return err
	}

	trashMu.Lock()
	defer trashMu.Unlock()

	osFs, ok := s.fs.(*osFilesystem)
	if !ok {
		return nil
	}

	absRoot, _ := filepath.Abs(osFs.root)
	trashDir := getTrashDir(absRoot)

	_ = os.RemoveAll(trashDir)
	_ = os.MkdirAll(trashDir, 0755)
	_ = saveTrashMetadata(absRoot, trashMetadata{Items: make(map[string]TrashItem)})

	return nil
}
