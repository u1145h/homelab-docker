package main

import (
	"context"
	"log"
	"net/http"
	"os/signal"
	"syscall"

	"github.com/ullashroy/poco-server/backend/internal/app"
)

func main() {
	ctx, cancel := signal.NotifyContext(
		context.Background(),
		syscall.SIGINT,
		syscall.SIGTERM,
	)
	defer cancel()

	app := app.New()

	app.Start(ctx)

	log.Println("poco-serverd listening on 0.0.0.0:9876")

	log.Fatal(
		http.ListenAndServe(
			"0.0.0.0:9876",
			app.Router,
		),
	)
}
