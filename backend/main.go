package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"

	"hackpet/backend/api"
	"hackpet/backend/config"
	"hackpet/backend/handler"
	"hackpet/backend/pkg/logger"
	"hackpet/backend/repository"
	"hackpet/backend/service"
	"hackpet/backend/store"
)

func main() {
	cfg := config.Load()
	log := logger.New(cfg.Env)
	slog.SetDefault(log)

	dataPath := cfg.DataPath
	if p := os.Getenv("DATA_PATH"); p != "" {
		dataPath = p
	}
	uploadsPath := cfg.UploadsPath
	if p := os.Getenv("UPLOADS_PATH"); p != "" {
		uploadsPath = p
	}
	if !filepath.IsAbs(uploadsPath) {
		abs, err := filepath.Abs(uploadsPath)
		if err == nil {
			uploadsPath = abs
		}
	}
	if err := os.MkdirAll(uploadsPath, 0o755); err != nil {
		log.Error("uploads dir init failed", "path", uploadsPath, "error", err)
		os.Exit(1)
	}

	fileSt, err := store.NewFileStore(dataPath)
	if err != nil {
		log.Error("store init failed", "error", err)
		os.Exit(1)
	}

	var st store.Store = fileSt
	var userStore store.UserStore
	var pgStore *store.PgStore

	if cfg.DBDSN != "" {
		pgStore, err = store.NewPgStore(context.Background(), cfg.DBDSN)
		if err != nil {
			log.Error("postgres init failed", "error", err)
			os.Exit(1)
		}
		defer pgStore.Close()
		userStore = pgStore
		st = &store.CompositeStore{File: fileSt, Pg: pgStore}
	}

	adapter := repository.NewStoreAdapter(st)
	courseSvc := service.NewCourseService(adapter)
	moduleSvc := service.NewModuleService(adapter, adapter)
	progressSvc := service.NewProgressService(adapter, adapter)
	labSvc := service.NewLabService(adapter, adapter)
	var petSvc *service.PetService
	var focusSvc *service.FocusService
	var todoSvc *service.TodoService
	var bestSvc *service.BestPracticeService
	var playSvc *service.PlayService
	if pgStore != nil {
		petSvc = service.NewPetService(pgStore)
		focusSvc = service.NewFocusService(pgStore)
		todoSvc = service.NewTodoService(pgStore)
		bestSvc = service.NewBestPracticeService(pgStore)
		playSvc = service.NewPlayService(pgStore)
	}

	var authH *handler.AuthHandler
	if userStore != nil && cfg.JWTSecret != "" {
		authH = &handler.AuthHandler{Log: log, UserStore: userStore, JWTSecret: cfg.JWTSecret, UploadsDir: uploadsPath}
	}

	courseH := &handler.CourseHandler{Log: log, Course: courseSvc, Progress: progressSvc, UserStore: userStore}
	moduleH := &handler.ModuleHandler{Log: log, Module: moduleSvc, Progress: progressSvc}
	progressH := &handler.ProgressHandler{Log: log, Progress: progressSvc, Pet: petSvc}
	labH := &handler.LabHandler{Log: log, Lab: labSvc}
	var petH *handler.PetHandler
	var focusH *handler.FocusHandler
	var todoH *handler.TodoHandler
	var bestH *handler.BestPracticeHandler
	var playH *handler.PlayHandler
	if petSvc != nil {
		petH = &handler.PetHandler{Log: log, Pet: petSvc}
	}
	if focusSvc != nil {
		focusH = &handler.FocusHandler{Log: log, Focus: focusSvc}
	}
	if todoSvc != nil {
		todoH = &handler.TodoHandler{Log: log, Todo: todoSvc}
	}
	if bestSvc != nil {
		bestH = &handler.BestPracticeHandler{Log: log, Best: bestSvc}
	}
	if playSvc != nil {
		playH = &handler.PlayHandler{Log: log, Play: playSvc}
	}

	r := api.NewRouter(api.RouterConfig{
		Log:        log,
		Auth:       authH,
		Course:     courseH,
		Module:     moduleH,
		Progress:   progressH,
		Lab:        labH,
		Pet:        petH,
		Focus:      focusH,
		Todo:       todoH,
		Best:       bestH,
		Play:       playH,
		UploadsDir: uploadsPath,
	})

	log.Info("listening", "addr", cfg.Addr, "env", cfg.Env, "auth", authH != nil)
	if err := http.ListenAndServe(cfg.Addr, r); err != nil {
		log.Error("server failed", "error", err)
		os.Exit(1)
	}
}
