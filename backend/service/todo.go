package service

import "hackpet/backend/store"

type TodoService struct {
	Store *store.PgStore
}

func NewTodoService(st *store.PgStore) *TodoService {
	return &TodoService{Store: st}
}

func (s *TodoService) List(userID string, limit int) ([]store.UserTodo, error) {
	if s.Store == nil || userID == "" {
		return nil, store.ErrUserNotFound
	}
	return s.Store.ListUserTodos(userID, limit)
}

func (s *TodoService) Create(userID, title, description string, priority int) (*store.UserTodo, error) {
	return s.Store.CreateUserTodo(userID, title, description, priority)
}

func (s *TodoService) Update(userID, todoID, title, description string, priority int, done bool, position int) (*store.UserTodo, error) {
	return s.Store.UpdateUserTodo(userID, todoID, title, description, priority, done, position)
}

func (s *TodoService) Delete(userID, todoID string) error {
	return s.Store.DeleteUserTodo(userID, todoID)
}
