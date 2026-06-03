package store

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"hackpet/backend/validator"
)

const progressFile = "progress.json"

type fileStore struct {
	dir      string
	progress map[string]ModuleProgress
	mu       sync.RWMutex
	attempts []attemptRecord
}

type attemptRecord struct {
	LabID         string
	SubmissionID  string
	Status        string
	RuleResults   []validator.RuleResult
}

func courseCTFProgressKey(courseID string, ctfID string) string {
	id := strings.TrimSpace(ctfID)
	if id != "" {
		return id
	}
	return courseID + "-ctf"
}

func allModulesCompleted(modules []ModuleSummary) bool {
	if len(modules) == 0 {
		return false
	}
	for _, m := range modules {
		if m.Progress != "completed" {
			return false
		}
	}
	return true
}

func NewFileStore(dataDir string) (Store, error) {
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return nil, err
	}
	s := &fileStore{dir: dataDir, attempts: make([]attemptRecord, 0), progress: make(map[string]ModuleProgress)}
	s.loadProgress()
	return s, nil
}

func (s *fileStore) loadProgress() {
	path := filepath.Join(s.dir, progressFile)
	data, err := os.ReadFile(path)
	if err != nil {
		return
	}
	_ = json.Unmarshal(data, &s.progress)
	if s.progress == nil {
		s.progress = make(map[string]ModuleProgress)
	}
}

func (s *fileStore) saveProgress() {
	path := filepath.Join(s.dir, progressFile)
	s.mu.Lock()
	data, _ := json.MarshalIndent(s.progress, "", "  ")
	s.mu.Unlock()
	_ = os.WriteFile(path, data, 0644)
}

func (s *fileStore) loadCourses() (*coursesFile, error) {
	path := filepath.Join(s.dir, "..", "courses.json")
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var cf coursesFile
	if err := json.Unmarshal(data, &cf); err != nil {
		return nil, err
	}
	return &cf, nil
}

func (s *fileStore) ListCourses(userID string) ([]CourseSummary, error) {
	cf, err := s.loadCourses()
	if err != nil {
		return nil, err
	}
	list := make([]CourseSummary, 0, len(cf.Courses))
	for _, c := range cf.Courses {
		status := c.Status
		if status == "" {
			status = "available"
		}
		list = append(list, CourseSummary{
			ID:           c.ID,
			Title:        c.Title,
			Description:  c.Description,
			Status:       status,
			Difficulty:   c.Difficulty,
			TotalMinutes: c.TotalMinutes,
		})
	}
	return list, nil
}

func (s *fileStore) GetCourse(id, userID string) (*Course, error) {
	cf, err := s.loadCourses()
	if err != nil {
		return nil, err
	}
	for _, c := range cf.Courses {
		if c.ID != id {
			continue
		}
		modules := make([]ModuleSummary, 0, len(c.ModuleIDs))
		for _, mid := range c.ModuleIDs {
			m, err := s.GetModule(mid)
			if err != nil {
				continue
			}
			progress := "not_started"
			attemptCount := 0
			lastStep := ""
			s.mu.Lock()
			if p, ok := s.progress[m.ID]; ok {
				attemptCount = p.AttemptCount
				lastStep = p.LastStep
				if p.Completed {
					progress = "completed"
				} else if p.LastStep != "" {
					progress = "in_progress"
				}
			}
			s.mu.Unlock()
			modules = append(modules, ModuleSummary{
				ID:           m.ID,
				Title:        m.Title,
				Summary:      m.Summary,
				Difficulty:   m.Difficulty,
				Minutes:      m.Minutes,
				Topic:        m.Topic,
				Progress:     progress,
				AttemptCount: attemptCount,
				LastStep:     lastStep,
			})
		}
		status := c.Status
		if status == "" {
			status = "available"
		}
		completedModules := allModulesCompleted(modules)

		var courseCTF *CourseCTF
		if c.CTF != nil {
			progressKey := courseCTFProgressKey(c.ID, c.CTF.ID)
			ctfCompleted := false
			s.mu.Lock()
			if p, ok := s.progress[progressKey]; ok {
				ctfCompleted = p.Completed
			}
			s.mu.Unlock()
			courseCTF = &CourseCTF{
				ID:          progressKey,
				Title:       c.CTF.Title,
				Description: c.CTF.Description,
				StandURL:    c.CTF.StandURL,
				Locked:      !completedModules,
				Completed:   ctfCompleted,
			}
		}

		completed := completedModules && (courseCTF == nil || courseCTF.Completed)
		return &Course{
			ID:          c.ID,
			Title:       c.Title,
			Description: c.Description,
			Status:      status,
			Modules:     modules,
			CTF:         courseCTF,
			Completed:   completed,
		}, nil
	}
	return nil, os.ErrNotExist
}

func (s *fileStore) IsCourseCompleted(courseId, userID string) (bool, error) {
	course, err := s.GetCourse(courseId, userID)
	if err != nil {
		return false, err
	}
	if course == nil {
		return false, nil
	}
	return course.Completed, nil
}

func (s *fileStore) VerifyCourseCTFFlag(courseId, flag string) (bool, error) {
	cf, err := s.loadCourses()
	if err != nil {
		return false, err
	}
	for _, c := range cf.Courses {
		if c.ID != courseId {
			continue
		}
		if c.CTF == nil {
			return false, os.ErrNotExist
		}
		expected := strings.TrimSpace(c.CTF.ExpectedFlag)
		return expected != "" && strings.TrimSpace(flag) == expected, nil
	}
	return false, os.ErrNotExist
}

func (s *fileStore) ListModules(userID string) ([]ModuleSummary, error) {
	entries, err := os.ReadDir(s.dir)
	if err != nil {
		return nil, err
	}
	var list []ModuleSummary
	for _, e := range entries {
		if e.IsDir() || filepath.Ext(e.Name()) != ".json" || e.Name() == progressFile {
			continue
		}
		id := e.Name()[:len(e.Name())-5]
		m, err := s.GetModule(id)
		if err != nil {
			continue
		}
		progress := "not_started"
		attemptCount := 0
		lastStep := ""
		s.mu.Lock()
		if p, ok := s.progress[m.ID]; ok {
			attemptCount = p.AttemptCount
			lastStep = p.LastStep
			if p.Completed {
				progress = "completed"
			} else if p.LastStep != "" {
				progress = "in_progress"
			}
		}
		s.mu.Unlock()
		list = append(list, ModuleSummary{
			ID:           m.ID,
			Title:        m.Title,
			Summary:      m.Summary,
			Difficulty:   m.Difficulty,
			Minutes:      m.Minutes,
			Topic:        m.Topic,
			Progress:     progress,
			AttemptCount: attemptCount,
			LastStep:     lastStep,
		})
	}
	return list, nil
}

func (s *fileStore) GetModule(id string) (*Module, error) {
	path := filepath.Join(s.dir, id+".json")
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var m Module
	if err := json.Unmarshal(data, &m); err != nil {
		return nil, err
	}
	return &m, nil
}

func (s *fileStore) GetLab(labId string) (*LabDef, error) {
	entries, err := os.ReadDir(s.dir)
	if err != nil {
		return nil, err
	}
	for _, e := range entries {
		if e.IsDir() || filepath.Ext(e.Name()) != ".json" || e.Name() == progressFile {
			continue
		}
		data, _ := os.ReadFile(filepath.Join(s.dir, e.Name()))
		var m Module
		if json.Unmarshal(data, &m) != nil {
			continue
		}
		if m.Lab.ID == labId {
			lang := m.Lab.Language
			if lang == "" {
				lang = "go"
			}
			return &LabDef{
				ID:                 m.Lab.ID,
				Language:           lang,
				Task:               m.Lab.Task,
				AcceptanceCriteria: m.Lab.AcceptanceCriteria,
				Files:              m.Lab.Files,
				Rules:              m.Lab.Rules,
			}, nil
		}
	}
	return nil, os.ErrNotExist
}

func (s *fileStore) GetModuleWithProgress(id, userID string) (*Module, *ModuleProgress, error) {
	m, err := s.GetModule(id)
	if err != nil {
		return nil, nil, err
	}
	s.mu.Lock()
	p := s.progress[id]
	s.mu.Unlock()
	return m, &p, nil
}

func (s *fileStore) GetModuleIDByLabID(labId string) (string, error) {
	return s.findModuleID(func(m *Module) bool { return m.Lab.ID == labId })
}

func (s *fileStore) GetModuleIDByQuizID(quizId string) (string, error) {
	return s.findModuleID(func(m *Module) bool {
		return m.CheckpointQuiz.ID == quizId || m.FinalQuiz.ID == quizId
	})
}

func (s *fileStore) findModuleID(match func(*Module) bool) (string, error) {
	entries, err := os.ReadDir(s.dir)
	if err != nil {
		return "", err
	}
	for _, e := range entries {
		if e.IsDir() || filepath.Ext(e.Name()) != ".json" || e.Name() == progressFile {
			continue
		}
		id := e.Name()[:len(e.Name())-5]
		m, err := s.GetModule(id)
		if err != nil {
			continue
		}
		if match(m) {
			return id, nil
		}
	}
	return "", os.ErrNotExist
}

func (s *fileStore) GetProgress(moduleId, userID string) (*ModuleProgress, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	p := s.progress[moduleId]
	return &p, nil
}

func (s *fileStore) SetProgress(moduleId, userID string, p ModuleProgress) error {
	s.mu.Lock()
	s.progress[moduleId] = p
	s.mu.Unlock()
	s.saveProgress()
	return nil
}

func (s *fileStore) SaveAttempt(userID, moduleId, labId, submissionId, status string, results []validator.RuleResult) error {
	s.mu.Lock()
	s.attempts = append(s.attempts, attemptRecord{LabID: labId, SubmissionID: submissionId, Status: status, RuleResults: results})
	s.mu.Unlock()
	if moduleId == "" {
		var err error
		moduleId, err = s.GetModuleIDByLabID(labId)
		if err != nil {
			return nil
		}
	}
	s.mu.Lock()
	p := s.progress[moduleId]
	p.AttemptCount++
	if status == "passed" {
		p.LastStep = "summary"
	} else {
		p.LastStep = "results"
	}
	s.progress[moduleId] = p
	s.mu.Unlock()
	s.saveProgress()
	return nil
}

func (s *fileStore) GetLastLabAttempt(userID, moduleId string) (string, []validator.RuleResult, error) {
	return "", nil, nil
}

func (s *fileStore) RecordTelemetry(userID, moduleId, step string, payload map[string]interface{}) error {
	return nil
}

func (s *fileStore) RecordQuizAnswer(userID, quizId, questionId string, answer int, correct bool) error {
	return nil
}

// GetQuizStats для fileStore всегда возвращает нули — агрегированная статистика по квизам в файловом сторе не хранится.
func (s *fileStore) GetQuizStats(userID, quizId string) (correct int, total int, err error) {
	return 0, 0, nil
}
