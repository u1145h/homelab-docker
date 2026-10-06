package processes

type Process struct {
	PID     string  `json:"pid"`
	Command string  `json:"command"`
	User    string  `json:"user"`
	CPU     float64 `json:"cpu"`
	Memory  float64 `json:"memory"`
	Threads int     `json:"threads"`
	Time    string  `json:"time"`
}

type Info struct {
	Top       []Process `json:"top"`
	TopMemory []Process `json:"top_memory"`
}
