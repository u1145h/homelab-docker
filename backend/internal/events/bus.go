package events

type Bus interface {
	Publish(Event)
	Subscribe() <-chan Event
	Unsubscribe(<-chan Event)
}
