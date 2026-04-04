package store

import "hackpet/backend/validator"

// CompositeStore — каталог из fileStore, прогресс из file (при userID == "") или pg (при userID != "").
type CompositeStore struct {
	File Store
	Pg   *PgStore
}

func (c *CompositeStore) ListCourses(userID string) ([]CourseSummary, error) {
	list, err := c.File.ListCourses(userID)
	if err != nil {
		return nil, err
	}
	return list, nil
}

func (c *CompositeStore) GetCourse(id, userID string) (*Course, error) {
	course, err := c.File.GetCourse(id, userID)
	if err != nil || course == nil {
		return course, err
	}
	if userID == "" || c.Pg == nil {
		return course, nil
	}
	for i := range course.Modules {
		// Сначала чистим file-store значения, чтобы не было "моков" для нового пользователя.
		course.Modules[i].Progress = "not_started"
		course.Modules[i].AttemptCount = 0
		course.Modules[i].LastStep = ""

		prog, err := c.Pg.GetProgress(userID, course.Modules[i].ID)
		if err != nil || prog == nil {
			continue
		}
		course.Modules[i].AttemptCount = prog.AttemptCount
		course.Modules[i].LastStep = prog.LastStep
		if prog.Completed {
			course.Modules[i].Progress = "completed"
		} else if prog.LastStep != "" {
			course.Modules[i].Progress = "in_progress"
		}
	}

	// Пересчитываем CTF.Locked и Completed по прогрессу модулей из PG (file store считал без userID).
	if course.CTF != nil {
		completedModules := allModulesCompleted(course.Modules)
		course.CTF.Locked = !completedModules
		ctfProg, _ := c.Pg.GetProgress(userID, course.CTF.ID)
		if ctfProg != nil {
			course.CTF.Completed = ctfProg.Completed
		}
	}
	course.Completed = (course.CTF == nil || course.CTF.Completed) && allModulesCompleted(course.Modules)

	return course, nil
}

func (c *CompositeStore) IsCourseCompleted(courseId, userID string) (bool, error) {
	if userID != "" && c.Pg != nil {
		course, err := c.GetCourse(courseId, userID)
		if err != nil {
			return false, err
		}
		if course == nil {
			return false, nil
		}
		return course.Completed, nil
	}
	return c.File.IsCourseCompleted(courseId, userID)
}

func (c *CompositeStore) VerifyCourseCTFFlag(courseId, flag string) (bool, error) {
	return c.File.VerifyCourseCTFFlag(courseId, flag)
}

func (c *CompositeStore) ListModules(userID string) ([]ModuleSummary, error) {
	list, err := c.File.ListModules(userID)
	if err != nil {
		return nil, err
	}
	if userID == "" || c.Pg == nil {
		return list, nil
	}
	for i := range list {
		list[i].Progress = "not_started"
		list[i].AttemptCount = 0
		list[i].LastStep = ""
		prog, err := c.Pg.GetProgress(userID, list[i].ID)
		if err != nil || prog == nil {
			continue
		}
		list[i].AttemptCount = prog.AttemptCount
		list[i].LastStep = prog.LastStep
		if prog.Completed {
			list[i].Progress = "completed"
		} else if prog.LastStep != "" {
			list[i].Progress = "in_progress"
		}
	}
	return list, nil
}

func (c *CompositeStore) GetModule(id string) (*Module, error) {
	return c.File.GetModule(id)
}

func (c *CompositeStore) GetModuleWithProgress(id, userID string) (*Module, *ModuleProgress, error) {
	m, err := c.File.GetModule(id)
	if err != nil {
		return nil, nil, err
	}
	if userID != "" && c.Pg != nil {
		prog, _ := c.Pg.GetProgress(userID, id)
		if prog == nil {
			prog = &ModuleProgress{}
		}
		return m, prog, nil
	}
	_, prog, err := c.File.GetModuleWithProgress(id, userID)
	if err != nil {
		return nil, nil, err
	}
	return m, prog, nil
}

func (c *CompositeStore) GetLab(labId string) (*LabDef, error) {
	return c.File.GetLab(labId)
}

func (c *CompositeStore) GetModuleIDByLabID(labId string) (string, error) {
	return c.File.GetModuleIDByLabID(labId)
}

func (c *CompositeStore) GetProgress(moduleId, userID string) (*ModuleProgress, error) {
	if userID != "" && c.Pg != nil {
		return c.Pg.GetProgress(userID, moduleId)
	}
	return c.File.GetProgress(moduleId, userID)
}

func (c *CompositeStore) SetProgress(moduleId, userID string, p ModuleProgress) error {
	if userID != "" && c.Pg != nil {
		return c.Pg.SetProgress(userID, moduleId, p)
	}
	return c.File.SetProgress(moduleId, userID, p)
}

func (c *CompositeStore) SaveAttempt(userID, labId, submissionId, status string, results []validator.RuleResult) error {
	if userID != "" && c.Pg != nil {
		return c.Pg.SaveAttempt(userID, labId, submissionId, status, results)
	}
	return c.File.SaveAttempt(userID, labId, submissionId, status, results)
}

func (c *CompositeStore) GetLastLabAttempt(userID, moduleId string) (string, []validator.RuleResult, error) {
	if userID != "" && c.Pg != nil {
		return c.Pg.GetLastLabAttempt(userID, moduleId)
	}
	return "", nil, nil
}

func (c *CompositeStore) RecordTelemetry(userID, moduleId, step string, payload map[string]interface{}) error {
	if userID != "" && c.Pg != nil {
		return c.Pg.RecordTelemetry(userID, moduleId, step, payload)
	}
	return c.File.RecordTelemetry(userID, moduleId, step, payload)
}

func (c *CompositeStore) RecordQuizAnswer(userID, quizId, questionId string, answer int, correct bool) error {
	if userID != "" && c.Pg != nil {
		return c.Pg.RecordQuizAnswer(userID, quizId, questionId, answer, correct)
	}
	return c.File.RecordQuizAnswer(userID, quizId, questionId, answer, correct)
}

// GetQuizStats используется только при наличии Postgres (для анонимного пользователя статистика не считается).
func (c *CompositeStore) GetQuizStats(userID, quizId string) (correct int, total int, err error) {
	if userID != "" && c.Pg != nil {
		return c.Pg.GetQuizStats(userID, quizId)
	}
	return 0, 0, nil
}
