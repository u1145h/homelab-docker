package filemanager

type ListRequest struct {
	Path string `json:"path"`
}

type ReadRequest struct {
	Path string `json:"path"`
}

type WriteRequest struct {
	Path    string `json:"path"`
	Content string `json:"content,omitempty"`
}

type DeleteRequest struct {
	Path string `json:"path"`
}

type RenameRequest struct {
	Source string `json:"source"`
	Target string `json:"target"`
}

type MoveRequest struct {
	Source string `json:"source"`
	Target string `json:"target"`
}

type CopyRequest struct {
	Source string `json:"source"`
	Target string `json:"target"`
}

type MkdirRequest struct {
	Path string `json:"path"`
}

type StatRequest struct {
	Path string `json:"path"`
}
