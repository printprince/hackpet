package service

import (
	"hackpet/backend/repository"
	"hackpet/backend/store"
)

type CourseService struct {
	Course repository.CourseRepo
}

func NewCourseService(course repository.CourseRepo) *CourseService {
	return &CourseService{Course: course}
}

func (s *CourseService) List(userID string) ([]store.CourseSummary, error) {
	return s.Course.ListCourses(userID)
}

func (s *CourseService) GetByID(id, userID string) (*store.Course, error) {
	return s.Course.GetCourse(id, userID)
}

func (s *CourseService) IsCompleted(courseId, userID string) (bool, error) {
	return s.Course.IsCourseCompleted(courseId, userID)
}

func (s *CourseService) VerifyCTFFlag(courseId, flag string) (bool, error) {
	return s.Course.VerifyCourseCTFFlag(courseId, flag)
}
