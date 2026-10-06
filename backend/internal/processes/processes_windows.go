package processes

func Collect() (*Info, error) {
	return &Info{Top: []Process{}}, nil
}
