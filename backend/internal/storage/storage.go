package storage

type Mount struct {
	Device       string  `json:"device"`
	Mount        string  `json:"mount"`
	Filesystem   string  `json:"filesystem"`
	Total        uint64  `json:"total"`
	Used         uint64  `json:"used"`
	Available    uint64  `json:"available"`
	UsagePercent float64 `json:"usage_percent"`
	ReadOnly     bool    `json:"read_only"`
	Type         string  `json:"type"` // e.g. "root", "boot", "virtual", "user"
}

type Summary struct {
	TotalCapacity   uint64 `json:"total_capacity"`
	Used            uint64 `json:"used"`
	Free            uint64 `json:"free"`
	PhysicalVolumes int    `json:"physical_volumes"`
}

type BlockDevice struct {
	Device string `json:"device"`
	Model  string `json:"model"`
	Size   uint64 `json:"size"`
	Temp   string `json:"temp"`
	Read   uint64 `json:"read"`
	Write  uint64 `json:"write"`
	Health string `json:"health"`
}

type IOThroughput struct {
	ReadMBps   float64 `json:"read_mbps"`
	WriteMBps  float64 `json:"write_mbps"`
	IOPS       uint64  `json:"iops"`
	QueueDepth float64 `json:"queue_depth"`
	Await      float64 `json:"await"`
}

type FilesystemCache struct {
	Cached    uint64 `json:"cached"`
	Buffers   uint64 `json:"buffers"`
	Dirty     uint64 `json:"dirty"`
	HitRatio  string `json:"hit_ratio"`
	SwapUsed  uint64 `json:"swap_used"`
	SwapTotal uint64 `json:"swap_total"`
	Inodes    string `json:"inodes"`
	Scheduler string `json:"scheduler"`
}

type CapacityMix struct {
	Name  string `json:"name"`
	Total uint64 `json:"total"`
	Used  uint64 `json:"used"`
	Color string `json:"color"`
}

type Info struct {
	Total           uint64          `json:"total"`
	Used            uint64          `json:"used"`
	Free            uint64          `json:"free"`
	Available       uint64          `json:"available"`
	UsagePercent    float64         `json:"usage_percent"`
	Percentage      float64         `json:"percentage"`
	Summary         Summary         `json:"summary"`
	CapacityMix     []CapacityMix   `json:"capacity_mix"`
	IOThroughput    IOThroughput    `json:"io_throughput"`
	Mounts          []Mount         `json:"mounts"`
	BlockDevices    []BlockDevice   `json:"block_devices"`
	FilesystemCache FilesystemCache `json:"filesystem_cache"`
}
