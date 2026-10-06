package terminal

func NewManager() Manager {
	return &manager{}
}

type manager struct{}

func (m *manager) Create(shell string, rows, cols uint16) (PTY, error) {
	inst, err := newPTY(shell, rows, cols)
	if err != nil {
		return nil, err
	}
	return inst, nil
}
