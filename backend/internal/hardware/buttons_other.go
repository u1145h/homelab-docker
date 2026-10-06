//go:build !linux

package hardware

func ListenVolumeButtons() <-chan EventType {
	return make(chan EventType, 10)
}
