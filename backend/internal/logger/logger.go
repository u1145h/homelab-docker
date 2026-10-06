package logger

import (
	"io"
	"log/slog"
	"os"
)

var Log = slog.New(slog.NewTextHandler(os.Stdout, nil))

func Init(debug bool) {
	level := slog.LevelInfo

	if debug {
		level = slog.LevelDebug
	}

	Log = slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
		Level: level,
	}))
}

func Debug(msg string, args ...any) {
	Log.Debug(msg, args...)
}

func Info(msg string, args ...any) {
	Log.Info(msg, args...)
}

func Warn(msg string, args ...any) {
	Log.Warn(msg, args...)
}

func Error(msg string, args ...any) {
	Log.Error(msg, args...)
}

func SetOutput(w io.Writer) {
	Log = slog.New(slog.NewTextHandler(w, nil))
}
