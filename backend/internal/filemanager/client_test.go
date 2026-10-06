package filemanager

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func newTestFilesystem(t *testing.T) (*osFilesystem, string) {
	t.Helper()
	dir, err := os.MkdirTemp("", "filemanager-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	fs, err := NewOSFilesystem(dir)
	if err != nil {
		os.RemoveAll(dir)
		t.Fatalf("failed to create filesystem: %v", err)
	}
	return fs, dir
}

func cleanup(t *testing.T, dir string) {
	t.Helper()
	os.RemoveAll(dir)
}

func TestClientList(t *testing.T) {
	fs, dir := newTestFilesystem(t)
	defer cleanup(t, dir)

	os.WriteFile(filepath.Join(dir, "a.txt"), []byte("hello"), 0644)
	os.WriteFile(filepath.Join(dir, "b.txt"), []byte("world"), 0644)
	os.MkdirAll(filepath.Join(dir, "sub"), 0755)

	items, err := fs.List(context.Background(), "/")
	if err != nil {
		t.Fatalf("List failed: %v", err)
	}

	if len(items) != 3 {
		t.Fatalf("expected 3 items, got %d", len(items))
	}

	// Directories first
	if items[0].Name != "sub" || items[0].Type != "directory" {
		t.Errorf("expected first item to be directory 'sub', got %s (%s)", items[0].Name, items[0].Type)
	}

	found := make(map[string]bool)
	for _, item := range items {
		found[item.Name] = true
	}
	if !found["a.txt"] || !found["b.txt"] || !found["sub"] {
		t.Errorf("expected all items to be present, got %v", found)
	}
}

func TestClientListEmptyDir(t *testing.T) {
	fs, dir := newTestFilesystem(t)
	defer cleanup(t, dir)

	items, err := fs.List(context.Background(), "/")
	if err != nil {
		t.Fatalf("List failed: %v", err)
	}
	if len(items) != 0 {
		t.Errorf("expected empty list, got %d items", len(items))
	}
}

func TestClientListNonExistent(t *testing.T) {
	fs, dir := newTestFilesystem(t)
	defer cleanup(t, dir)

	_, err := fs.List(context.Background(), "/nonexistent")
	if err == nil {
		t.Fatal("expected error for nonexistent path")
	}
}

func TestClientReadWrite(t *testing.T) {
	fs, dir := newTestFilesystem(t)
	defer cleanup(t, dir)

	content := []byte("hello world")
	err := fs.Write(context.Background(), "/test.txt", bytes.NewReader(content), int64(len(content)))
	if err != nil {
		t.Fatalf("Write failed: %v", err)
	}

	reader, info, err := fs.Read(context.Background(), "/test.txt")
	if err != nil {
		t.Fatalf("Read failed: %v", err)
	}
	defer reader.Close()

	if info.Size != int64(len(content)) {
		t.Errorf("expected size %d, got %d", len(content), info.Size)
	}
	if info.Name != "test.txt" {
		t.Errorf("expected name test.txt, got %s", info.Name)
	}
	if info.IsDir {
		t.Error("expected IsDir to be false")
	}

	data, err := io.ReadAll(reader)
	if err != nil {
		t.Fatalf("ReadAll failed: %v", err)
	}
	if !bytes.Equal(data, content) {
		t.Errorf("expected content %q, got %q", content, data)
	}
}

func TestClientReadDirectory(t *testing.T) {
	fs, dir := newTestFilesystem(t)
	defer cleanup(t, dir)

	_, _, err := fs.Read(context.Background(), "/")
	if err == nil {
		t.Fatal("expected error when reading a directory")
	}
}

func TestClientDeleteFile(t *testing.T) {
	fs, dir := newTestFilesystem(t)
	defer cleanup(t, dir)

	content := []byte("to be deleted")
	fs.Write(context.Background(), "/delete_me.txt", bytes.NewReader(content), int64(len(content)))

	err := fs.Delete(context.Background(), "/delete_me.txt")
	if err != nil {
		t.Fatalf("Delete failed: %v", err)
	}

	_, err = os.Stat(filepath.Join(dir, "delete_me.txt"))
	if !os.IsNotExist(err) {
		t.Error("expected file to be deleted")
	}
}

func TestClientDeleteDirectory(t *testing.T) {
	fs, dir := newTestFilesystem(t)
	defer cleanup(t, dir)

	subdir := filepath.Join(dir, "subdir")
	os.MkdirAll(subdir, 0755)
	os.WriteFile(filepath.Join(subdir, "nested.txt"), []byte("nested"), 0644)

	err := fs.Delete(context.Background(), "/subdir")
	if err != nil {
		t.Fatalf("Delete failed: %v", err)
	}

	_, err = os.Stat(subdir)
	if !os.IsNotExist(err) {
		t.Error("expected directory to be deleted")
	}
}

func TestClientDeleteRoot(t *testing.T) {
	fs, dir := newTestFilesystem(t)
	defer cleanup(t, dir)

	err := fs.Delete(context.Background(), "/")
	if err != ErrRootOperation {
		t.Errorf("expected ErrRootOperation, got %v", err)
	}
}

func TestClientMkdir(t *testing.T) {
	fs, dir := newTestFilesystem(t)
	defer cleanup(t, dir)

	err := fs.Mkdir(context.Background(), "/newdir")
	if err != nil {
		t.Fatalf("Mkdir failed: %v", err)
	}

	if _, err := os.Stat(filepath.Join(dir, "newdir")); os.IsNotExist(err) {
		t.Error("expected directory to exist")
	}
}

func TestClientMkdirNested(t *testing.T) {
	fs, dir := newTestFilesystem(t)
	defer cleanup(t, dir)

	err := fs.Mkdir(context.Background(), "/a/b/c")
	if err != nil {
		t.Fatalf("Mkdir nested failed: %v", err)
	}

	if _, err := os.Stat(filepath.Join(dir, "a", "b", "c")); os.IsNotExist(err) {
		t.Error("expected nested directory to exist")
	}
}

func TestClientRename(t *testing.T) {
	fs, dir := newTestFilesystem(t)
	defer cleanup(t, dir)

	content := []byte("rename me")
	fs.Write(context.Background(), "/old.txt", bytes.NewReader(content), int64(len(content)))

	err := fs.Rename(context.Background(), "/old.txt", "/new.txt")
	if err != nil {
		t.Fatalf("Rename failed: %v", err)
	}

	if _, err := os.Stat(filepath.Join(dir, "old.txt")); !os.IsNotExist(err) {
		t.Error("expected old file to not exist")
	}
	if _, err := os.Stat(filepath.Join(dir, "new.txt")); os.IsNotExist(err) {
		t.Error("expected new file to exist")
	}
}

func TestClientMove(t *testing.T) {
	fs, dir := newTestFilesystem(t)
	defer cleanup(t, dir)

	content := []byte("move me")
	fs.Write(context.Background(), "/source.txt", bytes.NewReader(content), int64(len(content)))

	err := fs.Move(context.Background(), "/source.txt", "/dest.txt", nil)
	if err != nil {
		t.Fatalf("Move failed: %v", err)
	}

	if _, err := os.Stat(filepath.Join(dir, "source.txt")); !os.IsNotExist(err) {
		t.Error("expected source file to not exist after move")
	}
	if _, err := os.Stat(filepath.Join(dir, "dest.txt")); os.IsNotExist(err) {
		t.Error("expected dest file to exist")
	}

	data, _ := os.ReadFile(filepath.Join(dir, "dest.txt"))
	if string(data) != string(content) {
		t.Errorf("expected content %q, got %q", content, data)
	}
}

func TestClientCopyFile(t *testing.T) {
	fs, dir := newTestFilesystem(t)
	defer cleanup(t, dir)

	content := []byte("copy me")
	fs.Write(context.Background(), "/src.txt", bytes.NewReader(content), int64(len(content)))

	err := fs.Copy(context.Background(), "/src.txt", "/dst.txt", nil)
	if err != nil {
		t.Fatalf("Copy failed: %v", err)
	}

	if _, err := os.Stat(filepath.Join(dir, "src.txt")); os.IsNotExist(err) {
		t.Error("expected source file to still exist")
	}
	if _, err := os.Stat(filepath.Join(dir, "dst.txt")); os.IsNotExist(err) {
		t.Error("expected dest file to exist")
	}

	data, _ := os.ReadFile(filepath.Join(dir, "dst.txt"))
	if string(data) != string(content) {
		t.Errorf("expected content %q, got %q", content, data)
	}
}

func TestClientCopyDir(t *testing.T) {
	fs, dir := newTestFilesystem(t)
	defer cleanup(t, dir)

	os.MkdirAll(filepath.Join(dir, "src", "sub"), 0755)
	os.WriteFile(filepath.Join(dir, "src", "a.txt"), []byte("a"), 0644)
	os.WriteFile(filepath.Join(dir, "src", "sub", "b.txt"), []byte("b"), 0644)

	err := fs.Copy(context.Background(), "/src", "/dst", nil)
	if err != nil {
		t.Fatalf("Copy dir failed: %v", err)
	}

	if _, err := os.Stat(filepath.Join(dir, "dst", "a.txt")); os.IsNotExist(err) {
		t.Error("expected copied file to exist")
	}
	if _, err := os.Stat(filepath.Join(dir, "dst", "sub", "b.txt")); os.IsNotExist(err) {
		t.Error("expected nested copied file to exist")
	}
}

func TestClientStatFile(t *testing.T) {
	fs, dir := newTestFilesystem(t)
	defer cleanup(t, dir)

	content := []byte("stat me")
	fs.Write(context.Background(), "/stat.txt", bytes.NewReader(content), int64(len(content)))

	info, err := fs.Stat(context.Background(), "/stat.txt")
	if err != nil {
		t.Fatalf("Stat failed: %v", err)
	}

	if info.Name != "stat.txt" {
		t.Errorf("expected name stat.txt, got %s", info.Name)
	}
	if info.Size != int64(len(content)) {
		t.Errorf("expected size %d, got %d", len(content), info.Size)
	}
	if info.IsDir {
		t.Error("expected IsDir to be false")
	}
	if info.MIME == "" {
		t.Error("expected MIME type to be set")
	}
}

func TestClientStatDir(t *testing.T) {
	fs, dir := newTestFilesystem(t)
	defer cleanup(t, dir)

	info, err := fs.Stat(context.Background(), "/")
	if err != nil {
		t.Fatalf("Stat failed: %v", err)
	}

	if !info.IsDir {
		t.Error("expected IsDir to be true for root")
	}
}

func TestClientStatNonExistent(t *testing.T) {
	fs, dir := newTestFilesystem(t)
	defer cleanup(t, dir)

	_, err := fs.Stat(context.Background(), "/nonexistent")
	if err == nil {
		t.Fatal("expected error for nonexistent path")
	}
}

func TestClientSymlinkEscape(t *testing.T) {
	fs, dir := newTestFilesystem(t)
	defer cleanup(t, dir)

	outsideDir := filepath.Join(dir, "..", "outside")
	if err := os.MkdirAll(outsideDir, 0755); err != nil {
		t.Skipf("cannot create outside dir: %v", err)
	}

	symlinkPath := filepath.Join(dir, "escape")
	if err := os.Symlink(outsideDir, symlinkPath); err != nil {
		t.Skipf("symlink creation failed: %v", err)
	}

	_, err := fs.List(context.Background(), "/escape")
	if err == nil {
		t.Error("expected error for symlink escape")
	}
}

func TestClientPathTraversal(t *testing.T) {
	fs, dir := newTestFilesystem(t)
	defer cleanup(t, dir)

	_, err := fs.List(context.Background(), "/../../../etc/passwd")
	if err != ErrPathTraversal {
		t.Errorf("expected ErrPathTraversal, got %v", err)
	}

	_, err = fs.List(context.Background(), "..")
	if err != ErrPathTraversal {
		t.Errorf("expected ErrPathTraversal for '..', got %v", err)
	}
}

func TestClientUnicodeFilenames(t *testing.T) {
	fs, dir := newTestFilesystem(t)
	defer cleanup(t, dir)

	name := "/日本語.txt"
	content := []byte("unicode")
	err := fs.Write(context.Background(), name, bytes.NewReader(content), int64(len(content)))
	if err != nil {
		t.Fatalf("Write with unicode name failed: %v", err)
	}

	reader, info, err := fs.Read(context.Background(), name)
	if err != nil {
		t.Fatalf("Read with unicode name failed: %v", err)
	}

	if info.Name != "日本語.txt" {
		t.Errorf("expected name 日本語.txt, got %s", info.Name)
	}
	reader.Close()

	err = fs.Delete(context.Background(), name)
	if err != nil {
		t.Fatalf("Delete with unicode name failed: %v", err)
	}
}

func TestClientHiddenFiles(t *testing.T) {
	fs, dir := newTestFilesystem(t)
	defer cleanup(t, dir)

	name := "/.env"
	content := []byte("SECRET=value")
	err := fs.Write(context.Background(), name, bytes.NewReader(content), int64(len(content)))
	if err != nil {
		t.Fatalf("Write hidden file failed: %v", err)
	}

	items, err := fs.List(context.Background(), "/")
	if err != nil {
		t.Fatalf("List failed: %v", err)
	}

	found := false
	for _, item := range items {
		if item.Name == ".env" {
			found = true
			break
		}
	}
	if !found {
		t.Error("expected hidden file to appear in listing")
	}
}

func TestClientFilenamesWithSpaces(t *testing.T) {
	fs, dir := newTestFilesystem(t)
	defer cleanup(t, dir)

	name := "/my file.txt"
	content := []byte("spaces")
	err := fs.Write(context.Background(), name, bytes.NewReader(content), int64(len(content)))
	if err != nil {
		t.Fatalf("Write with spaces failed: %v", err)
	}

	reader, _, err := fs.Read(context.Background(), name)
	if err != nil {
		t.Fatalf("Read with spaces failed: %v", err)
	}
	reader.Close()
}

func TestClientEmptyPath(t *testing.T) {
	fs, dir := newTestFilesystem(t)
	defer cleanup(t, dir)

	_, err := fs.List(context.Background(), "")
	if err != ErrEmptyPath {
		t.Errorf("expected ErrEmptyPath, got %v", err)
	}
}

func TestClientZeroByteFile(t *testing.T) {
	fs, dir := newTestFilesystem(t)
	defer cleanup(t, dir)

	err := fs.Write(context.Background(), "/empty.txt", strings.NewReader(""), 0)
	if err != nil {
		t.Fatalf("Write empty file failed: %v", err)
	}

	reader, info, err := fs.Read(context.Background(), "/empty.txt")
	if err != nil {
		t.Fatalf("Read empty file failed: %v", err)
	}
	defer reader.Close()

	if info.Size != 0 {
		t.Errorf("expected size 0, got %d", info.Size)
	}

	data, _ := io.ReadAll(reader)
	if len(data) != 0 {
		t.Errorf("expected empty content, got %d bytes", len(data))
	}
}

func TestClientLargeFile(t *testing.T) {
	fs, dir := newTestFilesystem(t)
	defer cleanup(t, dir)

	size := 1024 * 1024
	data := make([]byte, size)
	for i := range data {
		data[i] = byte(i % 256)
	}

	err := fs.Write(context.Background(), "/large.bin", bytes.NewReader(data), int64(size))
	if err != nil {
		t.Fatalf("Write large file failed: %v", err)
	}

	reader, info, err := fs.Read(context.Background(), "/large.bin")
	if err != nil {
		t.Fatalf("Read large file failed: %v", err)
	}
	defer reader.Close()

	if info.Size != int64(size) {
		t.Errorf("expected size %d, got %d", size, info.Size)
	}
}

func TestClientConcurrentReads(t *testing.T) {
	fs, dir := newTestFilesystem(t)
	defer cleanup(t, dir)

	content := []byte("concurrent reads")
	fs.Write(context.Background(), "/shared.txt", bytes.NewReader(content), int64(len(content)))

	done := make(chan bool, 10)
	for i := 0; i < 10; i++ {
		go func() {
			reader, _, err := fs.Read(context.Background(), "/shared.txt")
			if err != nil {
				t.Errorf("concurrent read failed: %v", err)
				done <- false
				return
			}
			reader.Close()
			done <- true
		}()
	}

	for i := 0; i < 10; i++ {
		<-done
	}
}

func TestClientProgressCallback(t *testing.T) {
	fs, dir := newTestFilesystem(t)
	defer cleanup(t, dir)

	content := []byte("progress test")
	fs.Write(context.Background(), "/src.txt", bytes.NewReader(content), int64(len(content)))

	called := false
	err := fs.Copy(context.Background(), "/src.txt", "/dst.txt", func(p Progress) {
		called = true
		if p.Completed != int64(len(content)) {
			t.Errorf("expected completed %d, got %d", len(content), p.Completed)
		}
	})

	if err != nil {
		t.Fatalf("Copy with progress failed: %v", err)
	}
	if !called {
		t.Error("expected progress callback to be called")
	}
}

func TestClientCopyCancelled(t *testing.T) {
	fs, dir := newTestFilesystem(t)
	defer cleanup(t, dir)

	content := []byte("important data")
	os.WriteFile(filepath.Join(dir, "src.txt"), content, 0644)

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	err := fs.Copy(ctx, "/src.txt", "/dst.txt", nil)
	if !errors.Is(err, context.Canceled) {
		t.Errorf("expected context.Canceled, got %v", err)
	}

	if _, err := os.Stat(filepath.Join(dir, "src.txt")); os.IsNotExist(err) {
		t.Error("source file was deleted despite cancelled copy")
	}
}

func TestClientMoveCancelledWithRenameFallback(t *testing.T) {
	fs, dir := newTestFilesystem(t)
	defer cleanup(t, dir)

	content := []byte("cross-device test")
	os.WriteFile(filepath.Join(dir, "src.txt"), content, 0644)

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	err := fs.Move(ctx, "/src.txt", "/nonexistent/dst.txt", nil)
	if !errors.Is(err, context.Canceled) {
		t.Errorf("expected context.Canceled, got %v", err)
	}

	data, err := os.ReadFile(filepath.Join(dir, "src.txt"))
	if err != nil {
		t.Fatal("source file was deleted despite failed move")
	}
	if string(data) != string(content) {
		t.Errorf("source file content changed: got %q, want %q", data, content)
	}
}

func TestClientMoveCancelledOnSameDevice(t *testing.T) {
	fs, dir := newTestFilesystem(t)
	defer cleanup(t, dir)

	content := []byte("move me")
	os.WriteFile(filepath.Join(dir, "src.txt"), content, 0644)

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	err := fs.Move(ctx, "/src.txt", "/dst.txt", nil)
	if err != nil {
		t.Fatalf("Move should succeed on same device even with cancelled context: %v", err)
	}

	if _, err := os.Stat(filepath.Join(dir, "src.txt")); !os.IsNotExist(err) {
		t.Error("expected source file to be moved")
	}
	if _, err := os.Stat(filepath.Join(dir, "dst.txt")); os.IsNotExist(err) {
		t.Error("expected dest file to exist")
	}
}

func TestClientCopyDirCancelledDuringRecursion(t *testing.T) {
	fs, dir := newTestFilesystem(t)
	defer cleanup(t, dir)

	for i := 0; i < 5; i++ {
		subdir := fmt.Sprintf("dir%d", i)
		os.MkdirAll(filepath.Join(dir, "src", subdir), 0755)
		os.WriteFile(filepath.Join(dir, "src", subdir, "file.txt"), []byte("data"), 0644)
	}

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	err := fs.Copy(ctx, "/src", "/dst", nil)
	if !errors.Is(err, context.Canceled) {
		t.Errorf("expected context.Canceled for cancelled recursive copy, got %v", err)
	}
}

func TestClientMoveCopyIntoSelfCanonical(t *testing.T) {
	fs, dir := newTestFilesystem(t)
	defer cleanup(t, dir)

	os.MkdirAll(filepath.Join(dir, "a", "b"), 0755)
	os.WriteFile(filepath.Join(dir, "a", "b", "f.txt"), []byte("data"), 0644)

	tests := []struct {
		name    string
		source  string
		target  string
		wantErr error
		op      func(ctx context.Context, src, dst string, p ProgressFunc) error
	}{
		{
			name:    "copy directory into subdirectory",
			source:  "/a",
			target:  "/a/b/c",
			wantErr: ErrCopyIntoSelf,
			op:      fs.Copy,
		},
		{
			name:    "move directory into its subdirectory",
			source:  "/a",
			target:  "/a/b",
			wantErr: ErrMoveIntoSelf,
			op:      fs.Move,
		},
		{
			name:    "rename directory into its subdirectory",
			source:  "/a",
			target:  "/a/b",
			wantErr: ErrMoveIntoSelf,
			op: func(ctx context.Context, src, dst string, _ ProgressFunc) error {
				return fs.Rename(ctx, src, dst)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.op(context.Background(), tt.source, tt.target, nil)
			if !errors.Is(err, tt.wantErr) {
				t.Errorf("expected %v, got %v", tt.wantErr, err)
			}
		})
	}
}
