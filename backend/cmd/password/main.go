package main

import (
	"fmt"
	"log"
	"os"

	"github.com/ullashroy/poco-server/backend/internal/auth"
)

func main() {

	if len(os.Args) != 2 {
		log.Fatal("usage: go run ./cmd/password <password>")
	}

	hash, err := auth.HashPassword(os.Args[1])
	if err != nil {
		log.Fatal(err)
	}

	fmt.Println(hash)
}
